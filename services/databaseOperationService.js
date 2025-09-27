import { getFileModel } from '../models/File.js';

class DatabaseOperationService {
  queueFileUpsert(fileData) {
    const File = getFileModel();
    return File.upsert(fileData);
  }

  queueChecksumUpdate(checksumData) {
    const File = getFileModel();
    return File.update(checksumData.updateFields, {
      where: { file_path: checksumData.filePath },
    });
  }
}

export default new DatabaseOperationService();
