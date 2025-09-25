import { optimizeDatabase } from '../config/database.js';
import { fileWatcherLogger as logger } from '../config/logger.js';

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
          logger.info('Starting scheduled database maintenance');
          await optimizeDatabase();
          logger.info('Scheduled database maintenance completed');
        } catch (error) {
          logger.error(`Scheduled database maintenance failed: ${error.message}`);
        } finally {
          this.isRunning = false;
        }
      },
      24 * 60 * 60 * 1000
    );

    logger.info('Database maintenance scheduler started (24 hour interval)');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Database maintenance scheduler stopped');
    }
  }

  async runMaintenance() {
    if (this.isRunning) {
      throw new Error('Database maintenance already in progress');
    }

    try {
      this.isRunning = true;
      logger.info('Starting manual database maintenance');
      await optimizeDatabase();
      logger.info('Manual database maintenance completed');
    } finally {
      this.isRunning = false;
    }
  }
}

export default new MaintenanceService();
