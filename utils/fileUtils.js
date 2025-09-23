import { promises as fs } from 'fs';
import { join } from 'path';
import logger from '../config/logger.js';

export const formatBytes = bytes => {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};

export const getDirectoryItems = async (path, fileWatcher = null) => {
  if (fileWatcher) {
    return fileWatcher.getCachedDirectoryItems(path);
  }

  logger.warn('Using fallback file listing - file watcher should be available');

  const items = await fs.readdir(path);
  const itemPromises = items
    .filter(item => !item.startsWith('.'))
    .map(async item => {
      const fullPath = join(path, item);
      const stats = await fs.stat(fullPath);

      return {
        name: item,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        mtime: stats.mtime,
        checksum: 'N/A',
      };
    });

  return Promise.all(itemPromises);
};
