import { getDatabase } from '../config/database.js';
import { getFileModel } from '../models/File.js';
import { databaseLogger as logger } from '../config/logger.js';

class DatabaseOperationService {
  constructor() {
  }

  async queueFileUpsert(fileData) {
    const File = getFileModel();
    return await File.upsert(fileData);
  }

  async queueChecksumUpdate(checksumData) {
    const File = getFileModel();
    return await File.update(checksumData.updateFields, {
      where: { file_path: checksumData.filePath }
    });
  }

}

export default new DatabaseOperationService();
