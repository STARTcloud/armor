import { optimizeDatabase } from '../config/database.js';
import { fileWatcherLogger as logger, databaseLogger } from '../config/logger.js';

class MaintenanceService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  start() {
    if (this.intervalId) {
      logger.warn('Database maintenance scheduler already running');
      return;
    }

    this.intervalId = setInterval(
      async () => {
        if (this.isRunning) {
          logger.warn('Database maintenance already in progress, skipping');
          return;
        }

        try {
          this.isRunning = true;
          databaseLogger.info('Starting scheduled database maintenance');
          await optimizeDatabase();
          databaseLogger.info('Scheduled database maintenance completed');
        } catch (error) {
          logger.error(`Scheduled database maintenance failed: ${error.message}`);
        } finally {
          this.isRunning = false;
        }
      },
      24 * 60 * 60 * 1000
    );

    databaseLogger.info('Database maintenance scheduler started (24 hour interval)');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      databaseLogger.info('Database maintenance scheduler stopped');
    }
  }

  async runMaintenance() {
    if (this.isRunning) {
      throw new Error('Database maintenance already in progress');
    }

    try {
      this.isRunning = true;
      databaseLogger.info('Starting manual database maintenance');
      await optimizeDatabase();
      databaseLogger.info('Manual database maintenance completed');
    } finally {
      this.isRunning = false;
    }
  }
}

export default new MaintenanceService();
