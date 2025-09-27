import chokidar from 'chokidar';
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { Op } from 'sequelize';
import { getFileModel } from '../models/File.js';
import { sendFileDeleted, sendFileAdded } from '../routes/sse.js';
import { fileWatcherLogger as logger } from '../config/logger.js';
import configLoader from '../config/configLoader.js';
import { withDatabaseRetry } from '../config/database.js';
import cacheService from './cacheService.js';
import databaseOperationService from './databaseOperationService.js';

class FileWatcherService {
  constructor(watchPath) {
    this.watchPath = watchPath;
    this.watcher = null;
    this.activeUploads = new Set(); // Track files currently being uploaded
    this.fileStabilityTimers = new Map(); // Track file stability timeouts
    this.config = null; // Will be loaded from configLoader
  }

  async initialize() {
    this.config = configLoader.getFileWatcherConfig();
    logger.info(`FileWatcher config loaded`, this.config);

    logger.info(`Starting initial directory scan of: ${this.watchPath}`);
    await this.cacheDirectory(this.watchPath);
    logger.info(`✅ Initial directory scan completed for: ${this.watchPath}`);

    await this.cleanupStaleEntries();

    this.startWatcher();

    const File = getFileModel();
    const fileCount = await File.count();

    logger.info(`🎉 File watcher initialization complete!`);
    logger.info(`📊 Database summary: ${fileCount} total items tracked`);
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
          logger.info(
            `${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath} (checksum will be processed by checksum service)`
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
          logger.info(
            `${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath} (checksum will be processed by checksum service)`
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
          logger.info(
            `${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath} (using chokidar stats, checksum will be processed by checksum service)`
          );
        } else {
          logger.info(
            `${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath} (using chokidar stats, checksum valid, skipped)`
          );
        }

        if (!existingFile) {
          logger.info(`About to send SSE file-added event for ${itemPath}`);
          sendFileAdded(itemPath, {
            size: stats ? stats.size : 0,
            mtime: stats ? stats.mtime : new Date(),
          });
          logger.info(`SSE file-added event sent for ${itemPath}`);
        }
      } else {
        logger.info(
          `${!existingFile ? 'Created' : 'Updated'} database record: ${itemPath} (using chokidar stats)`
        );

        if (!existingFile) {
          logger.info(`About to send SSE file-added event for directory ${itemPath}`);
          sendFileAdded(itemPath, { size: 0, mtime: stats ? stats.mtime : new Date() });
          logger.info(`SSE file-added event sent for directory ${itemPath}`);
        }
      }

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

  async cleanupStaleEntries() {
    logger.info('Starting cleanup of stale database entries');

    try {
      const File = getFileModel();

      const allDbEntries = await withDatabaseRetry(() =>
        File.findAll({
          attributes: ['file_path'],
          raw: true,
        })
      );

      logger.info(`Found ${allDbEntries.length} database entries to verify`);

      let removedCount = 0;
      const batchSize = 100;

      // Process in batches to avoid overwhelming the filesystem
      const processBatch = batch => {
        const checkPromises = batch.map(async entry => {
          try {
            await fs.access(entry.file_path);
            return { filePath: entry.file_path, exists: true };
          } catch {
            return { filePath: entry.file_path, exists: false };
          }
        });

        return Promise.allSettled(checkPromises);
      };

      const removeStaleFiles = filesToRemove =>
        File.destroy({
          where: {
            file_path: {
              [Op.in]: filesToRemove,
            },
          },
        });

      // Create all batches first
      const batches = [];
      for (let i = 0; i < allDbEntries.length; i += batchSize) {
        batches.push(allDbEntries.slice(i, i + batchSize));
      }

      // Process all batches and collect results
      const batchResults = await Promise.all(batches.map(batch => processBatch(batch)));

      const allFilesToRemove = [];
      batchResults.forEach((results, batchIndex) => {
        const filesToRemove = results
          .filter(result => result.status === 'fulfilled' && !result.value.exists)
          .map(result => result.value.filePath);

        if (filesToRemove.length > 0) {
          allFilesToRemove.push(...filesToRemove);
          logger.info(`Found ${filesToRemove.length} stale entries in batch ${batchIndex + 1}`);
        }
      });

      if (allFilesToRemove.length > 0) {
        await withDatabaseRetry(() => removeStaleFiles(allFilesToRemove));
        removedCount = allFilesToRemove.length;
        logger.info(`Removed ${removedCount} stale database entries`);
      }

      logger.info(`✅ Cleanup complete: removed ${removedCount} stale database entries`);
    } catch (error) {
      logger.error(`Failed to cleanup stale entries: ${error.message}`);
      throw error;
    }
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
