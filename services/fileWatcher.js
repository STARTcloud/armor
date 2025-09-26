import chokidar from 'chokidar';
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { Op } from 'sequelize';
import { getFileModel } from '../models/File.js';
import { sendChecksumUpdate, sendFileDeleted, sendFileAdded } from '../routes/sse.js';
import { fileWatcherLogger as logger } from '../config/logger.js';
import configLoader from '../config/configLoader.js';
import { withDatabaseRetry } from '../config/database.js';
import cacheService from './cacheService.js';
import databaseOperationService from './databaseOperationService.js';
import ChecksumWorkerPool from './checksumWorker.js';

class FileWatcherService {
  constructor(watchPath) {
    this.watchPath = watchPath;
    this.watcher = null;
    this.activeUploads = new Set(); // Track files currently being uploaded
    this.fileStabilityTimers = new Map(); // Track file stability timeouts
    this.activeChecksums = new Set(); // Track active checksum operations
    this.checksumQueue = []; // Queue for checksum operations
    this.config = null; // Will be loaded from configLoader
    this.checksumWorkerPool = null; // Worker pool for checksum calculation
  }

  async initialize() {
    this.config = configLoader.getFileWatcherConfig();
    this.checksumWorkerPool = new ChecksumWorkerPool(this.config.max_concurrent_checksums);
    logger.info(`FileWatcher config loaded`, this.config);

    this.startChecksumProcessor();

    logger.info(`Starting initial directory scan of: ${this.watchPath}`);
    await this.cacheDirectory(this.watchPath);
    logger.info(`✅ Initial directory scan completed for: ${this.watchPath}`);

    this.startWatcher();

    const File = getFileModel();
    const fileCount = await File.count();
    const pendingChecksums = await File.count({ where: { checksum_status: 'pending' } });

    logger.info(`🎉 File watcher initialization complete!`);
    logger.info(
      `📊 Database summary: ${fileCount} total items, ${pendingChecksums} checksums queued, ${this.checksumQueue.length} in processing queue`
    );

    if (pendingChecksums > 0) {
      logger.info(
        `⏳ Checksum processing will continue in background (max ${this.config.max_concurrent_checksums} concurrent)`
      );
    }
  }

  async cacheDirectory(dirPath) {
    logger.info(`Scanning directory: ${dirPath}`);

    try {
      const items = await fs.readdir(dirPath);
      const filteredItems = items.filter(item => !item.startsWith('.'));

      logger.info(`Found ${filteredItems.length} items in ${dirPath}`);

      // BATCH LOAD existing files for this directory (HUGE performance improvement)
      const File = getFileModel();
      const existingFiles = await withDatabaseRetry(() =>
        File.findAll({
          where: {
            file_path: {
              [Op.like]: `${dirPath}/%`,
            },
          },
          raw: true,
        })
      );

      // Create lookup map for O(1) access
      const existingFileMap = new Map();
      existingFiles.forEach(file => {
        existingFileMap.set(file.file_path, file);
      });

      logger.info(`Loaded ${existingFiles.length} existing database records for ${dirPath}`);

      // Process items individually with error recovery
      const processItems = itemsToProcess => {
        let processedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        const processNextItem = async () => {
          if (itemsToProcess.length === 0) {
            return { processedCount, errorCount, skippedCount };
          }

          const item = itemsToProcess.shift();
          try {
            const itemPath = join(dirPath, item);
            const result = await this.cacheItemInfoWithLookup(
              dirPath,
              item,
              existingFileMap.get(itemPath)
            );
            processedCount++;

            if (result?.skipped) {
              skippedCount++;
            }

            if (processedCount % 50 === 0) {
              logger.info(
                `Progress: ${processedCount}/${filteredItems.length} items processed in ${dirPath} (${skippedCount} skipped)`
              );
            }
          } catch (error) {
            errorCount++;
            logger.error(`Failed to cache item ${item} in ${dirPath}: ${error.message}`);
            // Continue with next item instead of stopping
          }

          return processNextItem();
        };

        return processNextItem();
      };

      const { processedCount, errorCount, skippedCount } = await processItems([...filteredItems]);

      logger.info(
        `Completed ${dirPath}: ${processedCount} processed, ${errorCount} errors, ${skippedCount} checksums skipped`
      );

      // Process subdirectories individually with error recovery
      const getSubdirectories = itemsToCheck => {
        const subdirectories = [];

        const checkNextItem = async () => {
          if (itemsToCheck.length === 0) {
            return subdirectories;
          }

          const item = itemsToCheck.shift();
          try {
            const itemPath = join(dirPath, item);
            const stats = await fs.stat(itemPath);
            if (stats.isDirectory()) {
              subdirectories.push(itemPath);
            }
          } catch (error) {
            logger.error(`Failed to stat ${item} in ${dirPath}: ${error.message}`);
            // Continue with next item
          }

          return checkNextItem();
        };

        return checkNextItem();
      };

      const subdirectories = await getSubdirectories([...filteredItems]);
      logger.info(`Processing ${subdirectories.length} subdirectories in ${dirPath}`);

      // Process subdirectories sequentially to avoid overwhelming the system
      const processSubdirectories = subDirs => {
        const processNextDir = async () => {
          if (subDirs.length === 0) {
            return undefined;
          }

          const subDir = subDirs.shift();
          try {
            await this.cacheDirectory(subDir);
          } catch (error) {
            logger.error(`Failed to scan subdirectory ${subDir}: ${error.message}`);
            // Continue with next subdirectory
          }

          return processNextDir();
        };

        return processNextDir();
      };

      await processSubdirectories([...subdirectories]);

      logger.info(`Finished scanning directory: ${dirPath}`);
    } catch (error) {
      logger.error(`Error reading directory ${dirPath}: ${error.message}`);
    }
  }

  async cacheItemInfo(dirPath, itemName) {
    try {
      const itemPath = join(dirPath, itemName);
      const stats = await fs.stat(itemPath);
      const isDirectory = stats.isDirectory();

      const File = getFileModel();

      // Check if file already exists in database
      const existingFile = await withDatabaseRetry(() =>
        File.findOne({ where: { file_path: itemPath } })
      );

      const [, created] = await withDatabaseRetry(() =>
        databaseOperationService.queueFileUpsert({
          file_path: itemPath,
          file_size: stats.size,
          last_modified: stats.mtime,
          is_directory: isDirectory,
          checksum_status: isDirectory ? 'complete' : existingFile?.checksum_status || 'pending',
        })
      );

      // Only queue checksum if:
      // 1. It's a new file (created = true)
      // 2. File changed (different size or mtime)
      // 3. Checksum failed before (status = 'error' or 'pending')
      // 4. No existing checksum
      if (!isDirectory) {
        const needsChecksum =
          created ||
          !existingFile ||
          !existingFile.checksum_sha256 ||
          existingFile.checksum_status === 'error' ||
          existingFile.checksum_status === 'pending' ||
          existingFile.file_size !== stats.size ||
          new Date(existingFile.last_modified).getTime() !== stats.mtime.getTime();

        if (needsChecksum) {
          this.queueChecksumGeneration(itemPath);
          logger.info(
            `${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath} (checksum queued)`
          );
        } else {
          logger.info(
            `${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath} (checksum valid, skipped)`
          );
        }

        if (!existingFile) {
          logger.info(`About to send SSE file-added event for ${itemPath}`);
          sendFileAdded(itemPath, { size: stats.size, mtime: stats.mtime });
          logger.info(`SSE file-added event sent for ${itemPath}`);
        }
      } else {
        logger.info(`${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath}`);

        if (!existingFile) {
          logger.info(`About to send SSE file-added event for directory ${itemPath}`);
          sendFileAdded(itemPath, { size: 0, mtime: stats.mtime });
          logger.info(`SSE file-added event sent for directory ${itemPath}`);
        }
      }

      return { created, itemPath };
    } catch (error) {
      logger.error(`Error updating database for ${dirPath}/${itemName}: ${error.message}`);
      throw error;
    }
  }

  startWatcher() {
    this.watcher = chokidar.watch(this.watchPath, {
      ignored: /(?:^|[/\\])\../,
      persistent: true,
      ignoreInitial: false, // Emit events for existing files
      followSymlinks: true, // Follow symlinks as discussed earlier
      ignorePermissionErrors: true, // Ignore EROFS and permission errors
      usePolling: true, // Use polling for reliable unlink detection across filesystems
      alwaysStat: true, // Provide stats in event callbacks (more efficient)
      atomic: true, // Handle atomic editor writes
      awaitWriteFinish: {
        // Wait for file writes to complete
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    this.watcher.on('change', (filePath, stats) => {
      logger.info(`File changed: ${filePath}`);
      cacheService.invalidate(dirname(filePath));
      // Use stats from chokidar instead of doing our own fs.stat
      this.scheduleFileProcessingWithStats(filePath, stats);
    });

    this.watcher.on('add', (filePath, stats) => {
      logger.info(`File added: ${filePath}`);
      cacheService.invalidate(dirname(filePath));
      // Use stats from chokidar instead of doing our own fs.stat
      this.scheduleFileProcessingWithStats(filePath, stats);
    });

    this.watcher.on('unlink', async filePath => {
      logger.info(`File deleted: ${filePath}`);
      cacheService.invalidate(dirname(filePath));
      const File = getFileModel();
      try {
        await withDatabaseRetry(() => File.destroy({ where: { file_path: filePath } }));
        logger.info(`Database record removed for deleted file: ${filePath}`);

        sendFileDeleted(filePath);
        logger.info(`SSE file deletion event sent for: ${filePath}`);
      } catch (error) {
        logger.error(
          `Failed to remove database record for deleted file ${filePath}: ${error.message}`
        );
      }
    });

    this.watcher.on('unlinkDir', async dirPath => {
      logger.info(`Directory deleted: ${dirPath}`);
      cacheService.invalidate(dirname(dirPath));
      const File = getFileModel();
      try {
        const filesToDelete = await withDatabaseRetry(() =>
          File.findAll({
            where: {
              file_path: {
                [Op.like]: `${dirPath}%`,
              },
            },
            attributes: ['file_path', 'is_directory'],
          })
        );

        if (filesToDelete.length > 0) {
          const deletePromises = filesToDelete.map(file =>
            withDatabaseRetry(() => File.destroy({ where: { file_path: file.file_path } }))
          );

          await Promise.all(deletePromises);
          logger.info(
            `Database records removed for deleted directory: ${dirPath} (${filesToDelete.length} records)`
          );

          filesToDelete.forEach(file => {
            if (!file.is_directory) {
              logger.info(`SSE: Sending file deletion event for: ${file.file_path}`);
              sendFileDeleted(file.file_path, false);
            }
          });

          filesToDelete.forEach(file => {
            if (file.is_directory && file.file_path !== dirPath) {
              logger.info(`SSE: Sending directory deletion event for: ${file.file_path}`);
              sendFileDeleted(file.file_path, true);
            }
          });

          logger.info(`SSE: Sending directory deletion event for: ${dirPath}`);
          sendFileDeleted(dirPath, true);
        } else {
          logger.info(`No database records found for deleted directory: ${dirPath}`);
          logger.info(`SSE: Sending directory deletion event for: ${dirPath}`);
          sendFileDeleted(dirPath, true);
        }
      } catch (error) {
        logger.error(
          `Failed to remove database records for deleted directory ${dirPath}: ${error.message}`
        );
      }
    });
  }

  calculateChecksum(filePath) {
    return this.checksumWorkerPool.calculateChecksum(filePath);
  }

  // Start the checksum queue processor
  startChecksumProcessor() {
    const processQueue = async () => {
      if (
        this.checksumQueue.length === 0 ||
        this.activeChecksums.size >= this.config.max_concurrent_checksums
      ) {
        return;
      }

      const filePath = this.checksumQueue.shift();
      this.activeChecksums.add(filePath);

      logger.info(
        `Starting queued checksum for: ${filePath} (${this.activeChecksums.size}/${this.config.max_concurrent_checksums} active, ${this.checksumQueue.length} queued)`
      );

      try {
        await this.processChecksumWithTimeout(filePath);
      } catch (error) {
        logger.error(`Queued checksum failed for ${filePath}: ${error.message}`);
      } finally {
        this.activeChecksums.delete(filePath);
      }
    };

    // Process queue every 1 second
    setInterval(processQueue, 1000);

    setInterval(async () => {
      await this.retryErrorFiles();
    }, 30000); // Retry every 30 seconds

    logger.info(
      `Checksum processor started with max ${this.config.max_concurrent_checksums} concurrent operations`
    );
  }

  // Add file to checksum queue instead of processing immediately
  queueChecksumGeneration(itemPath) {
    if (!this.checksumQueue.includes(itemPath) && !this.activeChecksums.has(itemPath)) {
      this.checksumQueue.push(itemPath);
      logger.info(`Queued checksum for: ${itemPath} (queue size: ${this.checksumQueue.length})`);
    }
  }

  async retryErrorFiles() {
    try {
      logger.info(`Starting retry check for error files`);
      const File = getFileModel();
      const errorFiles = await withDatabaseRetry(() =>
        File.findAll({
          where: { checksum_status: 'error' },
          raw: true,
        })
      );

      logger.info(`Found ${errorFiles.length} files with error status`);

      for (const file of errorFiles) {
        if (
          !this.checksumQueue.includes(file.file_path) &&
          !this.activeChecksums.has(file.file_path)
        ) {
          // Check if file still exists before requeuing
          try {
            await fs.access(file.file_path);
            this.queueChecksumGeneration(file.file_path);
            logger.info(`Retrying error file: ${file.file_path}`);
          } catch {
            await withDatabaseRetry(() => File.destroy({ where: { file_path: file.file_path } }));
            logger.info(`Removed non-existent error file from database: ${file.file_path}`);
          }
        } else {
          logger.info(`Skipping retry for ${file.file_path} (already queued or processing)`);
        }
      }
      logger.info(`Completed retry check for error files`);
    } catch (error) {
      logger.error(`Error during retry of error files: ${error.message}`);
    }
  }

  async processChecksumWithTimeout(itemPath) {
    const startTime = Date.now();

    try {
      logger.info(`Starting checksum generation for: ${itemPath}`);

      await withDatabaseRetry(() =>
        databaseOperationService.queueChecksumUpdate({
          filePath: itemPath,
          updateFields: { checksum_status: 'generating' },
        })
      );

      logger.info(`Starting checksum calculation for: ${itemPath}`);

      const timeoutWarning = setTimeout(() => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        logger.warn(`Checksum taking longer than expected for ${itemPath} (${elapsed}s elapsed)`);
      }, this.config.checksum_timeout_ms);

      const checksum = await this.calculateChecksum(itemPath);
      clearTimeout(timeoutWarning);

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.info(`Checksum calculation completed for: ${itemPath} (${elapsed}s)`);

      logger.info(`Updating database with checksum for: ${itemPath}`);
      await withDatabaseRetry(() =>
        databaseOperationService.queueChecksumUpdate({
          filePath: itemPath,
          updateFields: {
            checksum_sha256: checksum,
            checksum_status: 'complete',
            checksum_generated_at: new Date(),
          },
        })
      );

      logger.info(`Database updated with checksum for: ${itemPath}`);

      logger.info(`Getting file stats for SSE update: ${itemPath}`);
      const stats = await fs.stat(itemPath);

      logger.info(`About to send SSE update for ${itemPath}`);
      sendChecksumUpdate(itemPath, checksum, stats);
      logger.info(`SSE update sent for ${itemPath}`);

      logger.info(`Generated checksum for ${itemPath}: ${checksum}`);
    } catch (error) {
      logger.error(`Checksum generation failed for ${itemPath}: ${error.message}`, {
        stack: error.stack,
      });
      try {
        await withDatabaseRetry(() =>
          databaseOperationService.queueChecksumUpdate({
            filePath: itemPath,
            updateFields: { checksum_status: 'error' },
          })
        );
        logger.info(`Marked ${itemPath} as error in database`);
      } catch (dbError) {
        logger.error(`Failed to mark ${itemPath} as error: ${dbError.message}`);
      }
    }
  }

  async getCachedDirectoryItems(dirPath) {
    try {
      const cleanDirPath = dirPath.endsWith('/') ? dirPath.slice(0, -1) : dirPath;
      const cacheKey = `dir:${cleanDirPath}`;

      const cached = cacheService.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for directory: ${cleanDirPath}`);
        return cached;
      }

      const File = getFileModel();
      const files = await withDatabaseRetry(() =>
        File.findAll({
          where: {
            file_path: {
              [Op.like]: `${cleanDirPath}/%`,
            },
          },
          raw: true,
        })
      );

      const directChildren = files.filter(file => {
        const relativePath = file.file_path.replace(`${cleanDirPath}/`, '');
        return !relativePath.includes('/');
      });

      const items = directChildren.map(file => ({
        name: basename(file.file_path),
        size: parseInt(file.file_size),
        mtime: new Date(file.last_modified),
        checksum: file.is_directory ? 'N/A' : file.checksum_sha256 || 'Pending',
        isDirectory: file.is_directory,
      }));

      logger.info(`Found ${items.length} items in database for ${dirPath}`);

      cacheService.set(cacheKey, items);

      return items;
    } catch (error) {
      logger.error(`Error querying database for directory ${dirPath}: ${error.message}`);
      return [];
    }
  }

  // Schedule file processing with stability delay (with stats from chokidar)
  scheduleFileProcessingWithStats(filePath, stats) {
    // Clear existing timer for this file
    if (this.fileStabilityTimers.has(filePath)) {
      clearTimeout(this.fileStabilityTimers.get(filePath));
    }

    // Set new timer - wait 2 seconds after last change before processing
    const timer = setTimeout(() => {
      this.fileStabilityTimers.delete(filePath);
      const dirPath = dirname(filePath);
      const itemName = basename(filePath);
      this.cacheItemInfoWithStats(dirPath, itemName, stats);
    }, 2000);

    this.fileStabilityTimers.set(filePath, timer);
    logger.info(`File stability timer set for: ${filePath}`);
  }

  // Schedule file processing with stability delay (legacy for compatibility)
  scheduleFileProcessing(filePath) {
    // Clear existing timer for this file
    if (this.fileStabilityTimers.has(filePath)) {
      clearTimeout(this.fileStabilityTimers.get(filePath));
    }

    // Set new timer - wait 2 seconds after last change before processing
    const timer = setTimeout(() => {
      this.fileStabilityTimers.delete(filePath);
      const dirPath = dirname(filePath);
      const itemName = basename(filePath);
      this.cacheItemInfo(dirPath, itemName);
    }, 2000);

    this.fileStabilityTimers.set(filePath, timer);
    logger.info(`File stability timer set for: ${filePath}`);
  }

  // Cache item info using pre-loaded database lookup (eliminates individual queries)
  async cacheItemInfoWithLookup(dirPath, itemName, existingFile) {
    try {
      const itemPath = join(dirPath, itemName);
      const stats = await fs.stat(itemPath);
      const isDirectory = stats.isDirectory();

      const [, created] = await withDatabaseRetry(() =>
        databaseOperationService.queueFileUpsert({
          file_path: itemPath,
          file_size: stats.size,
          last_modified: stats.mtime,
          is_directory: isDirectory,
          checksum_status: isDirectory ? 'complete' : existingFile?.checksum_status || 'pending',
        })
      );

      // Only queue checksum if:
      // 1. It's a new file (created = true)
      // 2. File changed (different size or mtime)
      // 3. Checksum failed before (status = 'error' or 'pending')
      // 4. No existing checksum
      if (!isDirectory) {
        const needsChecksum =
          created ||
          !existingFile ||
          !existingFile.checksum_sha256 ||
          existingFile.checksum_status === 'error' ||
          existingFile.checksum_status === 'pending' ||
          existingFile.file_size !== stats.size ||
          new Date(existingFile.last_modified).getTime() !== stats.mtime.getTime();

        if (needsChecksum) {
          this.queueChecksumGeneration(itemPath);
          logger.info(
            `${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath} (checksum queued)`
          );

          if (!existingFile) {
            logger.info(`About to send SSE file-added event for: ${itemPath} (checksum queued)`);
            sendFileAdded(itemPath, { size: stats.size, mtime: stats.mtime });
            logger.info(`SSE file-added event sent for: ${itemPath} (checksum queued)`);
          }

          return { created, itemPath, skipped: false };
        }
        logger.info(
          `${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath} (checksum valid, skipped)`
        );

        if (!existingFile) {
          logger.info(`About to send SSE file-added event for: ${itemPath} (checksum skipped)`);
          sendFileAdded(itemPath, { size: stats.size, mtime: stats.mtime });
          logger.info(`SSE file-added event sent for: ${itemPath} (checksum skipped)`);
        }

        return { created, itemPath, skipped: true };
      }
      logger.info(`${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath}`);

      if (!existingFile) {
        logger.info(`About to send SSE file-added event for directory: ${itemPath}`);
        sendFileAdded(itemPath, { size: 0, mtime: new Date() });
        logger.info(`SSE file-added event sent for directory: ${itemPath}`);
      }

      return { created, itemPath, skipped: false };
    } catch (error) {
      logger.error(`Error updating database for ${dirPath}/${itemName}: ${error.message}`);
      throw error;
    }
  }

  // Cache item info using stats provided by chokidar (more efficient)
  async cacheItemInfoWithStats(dirPath, itemName, stats) {
    try {
      const itemPath = join(dirPath, itemName);
      const isDirectory = stats ? stats.isDirectory() : false;

      const File = getFileModel();

      const existingFile = await withDatabaseRetry(() =>
        File.findOne({
          where: { file_path: itemPath },
          raw: true,
        })
      );

      const [, created] = await withDatabaseRetry(() =>
        databaseOperationService.queueFileUpsert({
          file_path: itemPath,
          file_size: stats ? stats.size : 0,
          last_modified: stats ? stats.mtime : new Date(),
          is_directory: isDirectory,
          checksum_status: isDirectory ? 'complete' : existingFile?.checksum_status || 'pending',
        })
      );

      // Only queue checksum if:
      // 1. It's a new file (created = true)
      // 2. File changed (different size or mtime)
      // 3. Checksum failed before (status = 'error' or 'pending')
      // 4. No existing checksum
      if (!isDirectory) {
        const needsChecksum =
          created ||
          !existingFile ||
          !existingFile.checksum_sha256 ||
          existingFile.checksum_status === 'error' ||
          existingFile.checksum_status === 'pending' ||
          existingFile.file_size !== (stats ? stats.size : 0) ||
          new Date(existingFile.last_modified).getTime() !== (stats ? stats.mtime.getTime() : 0);

        if (needsChecksum) {
          this.queueChecksumGeneration(itemPath);
          logger.info(
            `${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath} (using chokidar stats, checksum queued)`
          );

          if (!existingFile) {
            logger.info(`About to send SSE file-added event for: ${itemPath}`);
            sendFileAdded(itemPath, {
              size: stats ? stats.size : 0,
              mtime: stats ? stats.mtime : new Date(),
            });
            logger.info(`SSE file-added event sent for: ${itemPath}`);
          }

          return { created, itemPath, skipped: false };
        }
        logger.info(
          `${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath} (using chokidar stats, checksum valid, skipped)`
        );

        if (!existingFile) {
          logger.info(`About to send SSE file-added event for: ${itemPath} (checksum skipped)`);
          sendFileAdded(itemPath, {
            size: stats ? stats.size : 0,
            mtime: stats ? stats.mtime : new Date(),
          });
          logger.info(`SSE file-added event sent for: ${itemPath} (checksum skipped)`);
        }

        return { created, itemPath, skipped: true };
      }

      logger.info(
        `${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath} (using chokidar stats)`
      );

      if (!existingFile) {
        logger.info(`About to send SSE file-added event for directory: ${itemPath}`);
        sendFileAdded(itemPath, { size: 0, mtime: stats ? stats.mtime : new Date() });
        logger.info(`SSE file-added event sent for directory: ${itemPath}`);
      }

      return { created, itemPath, skipped: false };
    } catch (error) {
      logger.error(`Error updating database for ${dirPath}/${itemName}: ${error.message}`);
      // Fallback to regular method if stats-based method fails
      try {
        return await this.cacheItemInfo(dirPath, itemName);
      } catch (fallbackError) {
        logger.error(`Fallback also failed for ${dirPath}/${itemName}: ${fallbackError.message}`);
        throw fallbackError;
      }
    }
  }

  // Mark file as actively being uploaded - temporarily unwatch to prevent change events
  markUploadStart(filePath) {
    this.activeUploads.add(filePath);

    // Temporarily stop watching this file to eliminate change events during upload
    if (this.watcher) {
      this.watcher.unwatch(filePath);
      logger.info(`Upload started - temporarily unwatched: ${filePath}`);
    } else {
      logger.info(`Upload started - watcher not initialized yet: ${filePath}`);
    }
  }

  // Mark file upload as complete - re-add to watcher
  markUploadComplete(filePath) {
    this.activeUploads.delete(filePath);

    // Re-add file to watcher now that upload is complete
    if (this.watcher) {
      this.watcher.add(filePath);
      logger.info(`Upload complete - re-added to watcher: ${filePath}`);
    } else {
      logger.info(`Upload complete - watcher not initialized yet: ${filePath}`);
    }

    // Process the file now that upload is complete
    setTimeout(() => {
      const dirPath = dirname(filePath);
      const itemName = basename(filePath);
      this.cacheItemInfo(dirPath, itemName);
    }, 1000); // Small delay to ensure file is fully written
  }

  async close() {
    if (this.watcher) {
      this.watcher.close();
    }

    if (this.checksumWorkerPool) {
      await this.checksumWorkerPool.close();
    }

    this.fileStabilityTimers.forEach(timer => clearTimeout(timer));
    this.fileStabilityTimers.clear();
    this.activeUploads.clear();
  }
}

export default FileWatcherService;
