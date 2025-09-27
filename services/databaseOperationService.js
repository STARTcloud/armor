import { getDatabase } from '../config/database.js';
import { getFileModel } from '../models/File.js';
import { databaseLogger as logger } from '../config/logger.js';

class DatabaseOperationService {
  constructor() {
    this.batchQueue = [];
    this.batchTimer = null;
    this.batchSize = 50;
    this.batchDelayMs = 0;
    this.isProcessing = false;
  }

  queueFileUpsert(fileData) {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ type: 'upsert', data: fileData, resolve, reject });
      this.scheduleBatchProcess();
    });
  }

  queueChecksumUpdate(checksumData) {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ type: 'checksum_update', data: checksumData, resolve, reject });
      this.scheduleBatchProcess();
    });
  }

  async processBatch() {
    if (this.isProcessing || this.batchQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const sequelize = getDatabase();
    const File = getFileModel();

    try {
      await sequelize.transaction(async t => {
        const batch = this.batchQueue.splice(0, this.batchSize);
        const upsertPromises = batch.map(async operation => {
          try {
            let result;
            if (operation.type === 'upsert') {
              result = await File.upsert(operation.data, { transaction: t });
            } else if (operation.type === 'checksum_update') {
              result = await File.update(operation.data.updateFields, {
                where: { file_path: operation.data.filePath },
                transaction: t,
              });
            }
            operation.resolve(result);
          } catch (error) {
            operation.reject(error);
          }
        });
        await Promise.all(upsertPromises);
      });
    } catch (error) {
      logger.error('Batch operation failed:', error);
    } finally {
      this.isProcessing = false;
      if (this.batchQueue.length > 0) {
        this.scheduleBatchProcess();
      }
    }
  }

  scheduleBatchProcess() {
    if (this.batchTimer) {
      return;
    }

    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.processBatch();
    }, this.batchDelayMs);
  }
}

export default new DatabaseOperationService();
