import { join } from 'path';

export const SERVED_DIR = process.env.SERVED_DIR || '/local/www';

export const getSecurePath = requestPath => {
  const fullPath = join(SERVED_DIR, requestPath);

  if (!fullPath.startsWith(SERVED_DIR)) {
    throw new Error('Path traversal attempt');
  }

  return fullPath;
};

export const isLocalUrl = urlPath => {
  try {
    const url = new URL(urlPath, 'https://localhost');
    return url.origin === 'https://localhost';
  } catch {
    return false;
  }
};
