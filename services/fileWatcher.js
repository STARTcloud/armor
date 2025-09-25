import chokidar from 'chokidar';
import { promises as fs, createReadStream } from 'fs';
import { join, dirname, basename } from 'path';
import { createHash } from 'crypto';
import { Op } from 'sequelize';
import { getFileModel } from '../models/File.js';
import { sendChecksumUpdate } from '../routes/sse.js';
import { fileWatcherLogger as logger } from '../config/logger.js';
import configLoader from '../config/configLoader.js';

class FileWatcherService {
  constructor(watchPath) {
    this.watchPath = watchPath;
    this.watcher = null;
    this.activeUploads = new Set(); // Track files currently being uploaded
    this.fileStabilityTimers = new Map(); // Track file stability timeouts
    this.activeChecksums = new Set(); // Track active checksum operations
    this.checksumQueue = []; // Queue for checksum operations
    this.config = null; // Will be loaded from configLoader
  }

  async initialize() {
    // Load configuration
    this.config = configLoader.getFileWatcherConfig();
    logger.info(`FileWatcher config loaded`, this.config);

    // Start checksum queue processor
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
      const existingFiles = await File.findAll({
        where: {
          file_path: {
            [Op.like]: `${dirPath}/%`,
          },
        },
        raw: true,
      });

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
      const existingFile = await File.findOne({ where: { file_path: itemPath } });

      const [, created] = await File.upsert({
        file_path: itemPath,
        file_size: stats.size,
        last_modified: stats.mtime,
        is_directory: isDirectory,
        checksum_status: isDirectory ? 'complete' : existingFile?.checksum_status || 'pending',
      });

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
            `${created ? 'Created' : 'Updated'} database record: ${itemPath} (checksum queued)`
          );
        } else {
          logger.info(
            `${created ? 'Created' : 'Updated'} database record: ${itemPath} (checksum valid, skipped)`
          );
        }
      } else {
        logger.info(`${created ? 'Created' : 'Updated'} database record: ${itemPath}`);
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
      usePolling: false, // Use efficient fs.watch (not polling)
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
      // Use stats from chokidar instead of doing our own fs.stat
      this.scheduleFileProcessingWithStats(filePath, stats);
    });

    this.watcher.on('add', (filePath, stats) => {
      logger.info(`File added: ${filePath}`);
      // Use stats from chokidar instead of doing our own fs.stat
      this.scheduleFileProcessingWithStats(filePath, stats);
    });

    this.watcher.on('unlink', filePath => {
      logger.info(`File deleted: ${filePath}`);
      const File = getFileModel();
      File.destroy({ where: { file_path: filePath } });
    });
  }

  calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
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

  // Process checksum with timeout monitoring
  async processChecksumWithTimeout(itemPath) {
    const File = getFileModel();
    const startTime = Date.now();

    try {
      logger.info(`Starting checksum generation for: ${itemPath}`);

      await File.update({ checksum_status: 'generating' }, { where: { file_path: itemPath } });

      logger.info(`Starting checksum calculation for: ${itemPath}`);

      // Add timeout warning (but don't skip file)
      const timeoutWarning = setTimeout(() => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        logger.warn(`Checksum taking longer than expected for ${itemPath} (${elapsed}s elapsed)`);
      }, this.config.checksum_timeout_ms);

      const checksum = await this.calculateChecksum(itemPath);
      clearTimeout(timeoutWarning);

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.info(`Checksum calculation completed for: ${itemPath} (${elapsed}s)`);

      logger.info(`Updating database with checksum for: ${itemPath}`);
      const updateResult = await File.update(
        {
          checksum_sha256: checksum,
          checksum_status: 'complete',
          checksum_generated_at: new Date(),
        },
        {
          where: { file_path: itemPath },
          returning: true,
        }
      );

      if (updateResult[0] === 0) {
        logger.error(`Database update failed for: ${itemPath} - no rows affected`);
      } else {
        logger.info(`Database updated with checksum for: ${itemPath} (${updateResult[0]} rows)`);
      }

      // Get file stats for SSE update
      logger.info(`Getting file stats for SSE update: ${itemPath}`);
      const stats = await fs.stat(itemPath);

      logger.info(`About to send SSE update for ${itemPath}`);
      sendChecksumUpdate(itemPath, checksum, stats);
      logger.info(`SSE update sent for ${itemPath}`);

      logger.info(`Generated checksum for ${itemPath}: ${checksum}`);
    } catch (error) {
      // Mark as error
      logger.error(`Checksum generation failed for ${itemPath}: ${error.message}`, {
        stack: error.stack,
      });
      try {
        await File.update({ checksum_status: 'error' }, { where: { file_path: itemPath } });
        logger.info(`Marked ${itemPath} as error in database`);
      } catch (dbError) {
        logger.error(`Failed to mark ${itemPath} as error: ${dbError.message}`);
      }
    }
  }

  async getCachedDirectoryItems(dirPath) {
    try {
      const cleanDirPath = dirPath.endsWith('/') ? dirPath.slice(0, -1) : dirPath;

      const File = getFileModel();
      const files = await File.findAll({
        where: {
          file_path: {
            [Op.like]: `${cleanDirPath}/%`,
          },
        },
        raw: true,
      });

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

      const File = getFileModel();

      const [, created] = await File.upsert({
        file_path: itemPath,
        file_size: stats.size,
        last_modified: stats.mtime,
        is_directory: isDirectory,
        checksum_status: isDirectory ? 'complete' : existingFile?.checksum_status || 'pending',
      });

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
            `${created ? 'Created' : 'Updated'} database record: ${itemPath} (checksum queued)`
          );
          return { created, itemPath, skipped: false };
        }
        logger.info(
          `${created ? 'Created' : 'Updated'} database record: ${itemPath} (checksum valid, skipped)`
        );
        return { created, itemPath, skipped: true };
      }
      logger.info(`${created ? 'Created' : 'Updated'} database record: ${itemPath}`);
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
      const [, created] = await File.upsert({
        file_path: itemPath,
        file_size: stats ? stats.size : 0,
        last_modified: stats ? stats.mtime : new Date(),
        is_directory: isDirectory,
        checksum_status: isDirectory ? 'complete' : 'pending',
      });

      if (!isDirectory) {
        // Queue checksum generation instead of doing it immediately
        this.queueChecksumGeneration(itemPath);
      }

      logger.info(
        `${created ? 'Created' : 'Updated'} database record: ${itemPath} (using chokidar stats)`
      );
      return { created, itemPath };
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

  close() {
    if (this.watcher) {
      this.watcher.close();
    }

    // Clear all timers
    this.fileStabilityTimers.forEach(timer => clearTimeout(timer));
    this.fileStabilityTimers.clear();
    this.activeUploads.clear();
  }
}

export default FileWatcherService;
