import chokidar from 'chokidar';
import { promises as fs, createReadStream } from 'fs';
import { join, dirname, basename } from 'path';
import { createHash } from 'crypto';
import { Op } from 'sequelize';
import { getFileModel } from '../models/File.js';
import { sendChecksumUpdate } from '../routes/sse.js';
import logger from '../config/logger.js';

class FileWatcherService {
  constructor(watchPath) {
    this.watchPath = watchPath;
    this.watcher = null;
    this.activeUploads = new Set(); // Track files currently being uploaded
    this.fileStabilityTimers = new Map(); // Track file stability timeouts
  }

  async initialize() {
    await this.cacheDirectory(this.watchPath);
    this.startWatcher();

    const File = getFileModel();
    const fileCount = await File.count();
    logger.info(`File watcher initialized, ${fileCount} items in database`);
  }

  async cacheDirectory(dirPath) {
    try {
      const items = await fs.readdir(dirPath);
      const itemPromises = items
        .filter(item => !item.startsWith('.'))
        .map(item => this.cacheItemInfo(dirPath, item));

      await Promise.all(itemPromises);

      const subDirPromises = items
        .filter(item => !item.startsWith('.'))
        .map(async item => {
          const itemPath = join(dirPath, item);
          const stats = await fs.stat(itemPath);
          if (stats.isDirectory()) {
            return this.cacheDirectory(itemPath);
          }
          return Promise.resolve();
        });

      await Promise.all(subDirPromises);
    } catch (error) {
      logger.error(`Error caching directory ${dirPath}: ${error.message}`);
    }
  }

  async cacheItemInfo(dirPath, itemName) {
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
        checksum_status: isDirectory ? 'complete' : 'pending',
      });

      if (!isDirectory) {
        this.generateChecksumAsync(itemPath);
      }

      logger.info(`${created ? 'Created' : 'Updated'} database record: ${itemPath}`);
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
    });

    this.watcher.on('change', filePath => {
      logger.info(`File changed: ${filePath}`);
      // Use stability timer to ensure file is done being written
      this.scheduleFileProcessing(filePath);
    });

    this.watcher.on('add', filePath => {
      logger.info(`File added: ${filePath}`);
      // Use stability timer to ensure file is done being written
      this.scheduleFileProcessing(filePath);
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

  async generateChecksumAsync(itemPath) {
    try {
      const File = getFileModel();

      await File.update({ checksum_status: 'generating' }, { where: { file_path: itemPath } });

      const checksum = await this.calculateChecksum(itemPath);

      await File.update(
        {
          checksum_sha256: checksum,
          checksum_status: 'complete',
          checksum_generated_at: new Date(),
        },
        { where: { file_path: itemPath } }
      );

      // Get file stats for SSE update
      const stats = await fs.stat(itemPath);

      logger.info(`About to send SSE update for ${itemPath}`);
      sendChecksumUpdate(itemPath, checksum, stats);
      logger.info(`SSE update sent for ${itemPath}`);

      logger.info(`Generated checksum for ${itemPath}: ${checksum}`);
    } catch (error) {
      // Mark as error
      const File = getFileModel();
      await File.update({ checksum_status: 'error' }, { where: { file_path: itemPath } });
      logger.error(`Failed to generate checksum for ${itemPath}: ${error.message}`);
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

  // Schedule file processing with stability delay
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

  // Mark file as actively being uploaded - temporarily unwatch to prevent change events
  markUploadStart(filePath) {
    this.activeUploads.add(filePath);

    // Temporarily stop watching this file to eliminate change events during upload
    this.watcher.unwatch(filePath);

    logger.info(`Upload started - temporarily unwatched: ${filePath}`);
  }

  // Mark file upload as complete - re-add to watcher
  markUploadComplete(filePath) {
    this.activeUploads.delete(filePath);

    // Re-add file to watcher now that upload is complete
    this.watcher.add(filePath);

    logger.info(`Upload complete - re-added to watcher: ${filePath}`);

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
