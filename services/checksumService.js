import { getFileModel } from '../models/File.js';
import { sendChecksumUpdate, sendChecksumProgress } from '../routes/sse.js';
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

  async start() {
    if (this.intervalId) {
      logger.warn('Checksum service already running');
      return;
    }

    this.config = configLoader.getFileWatcherConfig();
    this.checksumWorkerPool = new ChecksumWorkerPool(this.config.max_concurrent_checksums);

    // Reset any interrupted files on startup
    await this.resetInterruptedFiles();

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

  async resetInterruptedFiles() {
    try {
      const File = getFileModel();

      // Reset any non-final states (generating, error) to pending on startup
      const result = await withDatabaseRetry(() =>
        File.update(
          { checksum_status: 'pending' },
          {
            where: {
              checksum_status: ['generating', 'error'],
              is_directory: false,
            },
          }
        )
      );

      if (result[0] > 0) {
        logger.info(`Reset ${result[0]} interrupted files to pending status on startup`);
      }
    } catch (error) {
      logger.error('Failed to reset interrupted files:', error);
    }
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
      // Send final completion event when no pending files
      await this.broadcastProgress();
      return;
    }

    logger.info(`Found ${pendingFiles.length} files needing checksums`);

    // Send initial progress update
    await this.broadcastProgress();

    const filesToProcess = pendingFiles.filter(file => !this.activeChecksums.has(file.file_path));

    const promises = filesToProcess
      .slice(0, this.config.max_concurrent_checksums - this.activeChecksums.size)
      .map(file => this.processFileChecksum(file.file_path));

    await Promise.allSettled(promises);

    // Send final progress update after batch
    await this.broadcastProgress();
  }

  async broadcastProgress() {
    try {
      const File = getFileModel();

      // Get progress statistics for files only
      const results = await withDatabaseRetry(() =>
        File.findAll({
          where: {
            is_directory: false,
          },
          attributes: [
            [File.sequelize.fn('COUNT', '*'), 'total'],
            [
              File.sequelize.fn(
                'SUM',
                File.sequelize.literal("CASE WHEN checksum_status = 'complete' THEN 1 ELSE 0 END")
              ),
              'complete',
            ],
            [
              File.sequelize.fn(
                'SUM',
                File.sequelize.literal("CASE WHEN checksum_status = 'pending' THEN 1 ELSE 0 END")
              ),
              'pending',
            ],
            [
              File.sequelize.fn(
                'SUM',
                File.sequelize.literal("CASE WHEN checksum_status = 'generating' THEN 1 ELSE 0 END")
              ),
              'generating',
            ],
            [
              File.sequelize.fn(
                'SUM',
                File.sequelize.literal("CASE WHEN checksum_status = 'error' THEN 1 ELSE 0 END")
              ),
              'error',
            ],
          ],
          raw: true,
        })
      );

      const [stats] = results;
      const total = parseInt(stats.total) || 0;
      const complete = parseInt(stats.complete) || 0;
      const pending = parseInt(stats.pending) || 0;
      const generating = parseInt(stats.generating) || 0;
      const error = parseInt(stats.error) || 0;

      const percentage = total > 0 ? (complete / total) * 100 : 100;
      const activeProcessing = this.activeChecksums.size;
      const isActive = pending > 0 || generating > 0 || activeProcessing > 0;

      const progressData = {
        total,
        complete,
        pending,
        generating,
        error,
        percentage: Math.round(percentage * 10) / 10,
        isActive,
        activeProcessing,
      };

      sendChecksumProgress(progressData);
    } catch (error) {
      logger.error('Failed to broadcast progress:', error);
    }
  }

  async processFileChecksum(filePath) {
    if (this.activeChecksums.has(filePath)) {
      return;
    }

    this.activeChecksums.add(filePath);
    const startTime = Date.now();

    try {
      logger.info(`Starting checksum generation for: ${filePath}`);

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

      // Broadcast progress after each file completes
      await this.broadcastProgress();
    } catch (error) {
      logger.error(`Checksum generation failed for ${filePath}: ${error.message}`);

      await withDatabaseRetry(() =>
        databaseOperationService.queueChecksumUpdate({
          filePath,
          updateFields: { checksum_status: 'error' },
        })
      );

      // Broadcast progress even after errors
      await this.broadcastProgress();
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
