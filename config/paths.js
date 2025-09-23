import { join } from 'path';

export const SERVED_DIR = process.env.SERVED_DIR || '/local/www';

export const getSecurePath = requestPath => {
  const fullPath = join(SERVED_DIR, requestPath);

  if (!fullPath.startsWith(SERVED_DIR)) {
    throw new Error('Path traversal attempt');
  }

  return fullPath;
};
