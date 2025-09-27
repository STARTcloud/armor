import { getFileModel } from '../models/File.js';
import { sendChecksumUpdate } from '../routes/sse.js';
import { fileWatcherLogger as logger, databaseLogger } from '../config/logger.js';
import { withDatabaseRetry } from '../config/database.js';
import { promises as fs } from 'fs';
import configLoader from '../config/configLoader.js';
import ChecksumWorkerPool from './checksumWorker.js';
import databaseOperationService from './databaseOperationService.js';

class ChecksumService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.checksumWorkerPool = null;
    this.config = null;
    this.activeChecksums = new Set();
  }

  start() {
    if (this.intervalId) {
      logger.warn('Checksum service already running');
      return;
    }

    this.config = configLoader.getFileWatcherConfig();
    this.checksumWorkerPool = new ChecksumWorkerPool(this.config.max_concurrent_checksums);

    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        return;
      }

      try {
        this.isRunning = true;
        await this.processPendingChecksums();
      } catch (error) {
        logger.error(`Checksum processing failed: ${error.message}`);
      } finally {
        this.isRunning = false;
      }
    }, 5000);

    logger.info('Checksum service started');
  }

  async processPendingChecksums() {
    const File = getFileModel();

    const pendingFiles = await withDatabaseRetry(() =>
      File.findAll({
        where: {
          checksum_status: ['pending', 'error'],
          is_directory: false,
        },
        limit: this.config.max_concurrent_checksums * 2,
        raw: true,
      })
    );

    if (pendingFiles.length === 0) {
      return;
    }

    logger.info(`Found ${pendingFiles.length} files needing checksums`);

    const filesToProcess = pendingFiles.filter(file => !this.activeChecksums.has(file.file_path));

    const promises = filesToProcess
      .slice(0, this.config.max_concurrent_checksums - this.activeChecksums.size)
      .map(file => this.processFileChecksum(file.file_path));

    await Promise.allSettled(promises);
  }

  async processFileChecksum(filePath) {
    if (this.activeChecksums.has(filePath)) {
      return;
    }

    this.activeChecksums.add(filePath);
    const startTime = Date.now();

    try {
      logger.info(`Starting checksum generation for: ${filePath}`);

      const File = getFileModel();
      await withDatabaseRetry(() =>
        databaseOperationService.queueChecksumUpdate({
          filePath,
          updateFields: { checksum_status: 'generating' },
        })
      );

      try {
        await fs.access(filePath);
      } catch {
        const File = getFileModel();
        await withDatabaseRetry(() => File.destroy({ where: { file_path: filePath } }));
        databaseLogger.info(`Removed non-existent file from database: ${filePath}`);
        return;
      }

      const checksum = await this.checksumWorkerPool.calculateChecksum(filePath);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.info(`Checksum calculation completed for: ${filePath} (${elapsed}s)`);

      await withDatabaseRetry(() =>
        databaseOperationService.queueChecksumUpdate({
          filePath,
          updateFields: {
            checksum_sha256: checksum,
            checksum_status: 'complete',
            checksum_generated_at: new Date(),
          },
        })
      );

      const stats = await fs.stat(filePath);
      sendChecksumUpdate(filePath, checksum, stats);
      logger.info(`Generated checksum for ${filePath}: ${checksum}`);
    } catch (error) {
      logger.error(`Checksum generation failed for ${filePath}: ${error.message}`);

      await withDatabaseRetry(() =>
        databaseOperationService.queueChecksumUpdate({
          filePath,
          updateFields: { checksum_status: 'error' },
        })
      );
    } finally {
      this.activeChecksums.delete(filePath);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Checksum service stopped');
    }
  }

  async close() {
    this.stop();
    if (this.checksumWorkerPool) {
      await this.checksumWorkerPool.close();
    }
  }
}

export default new ChecksumService();
