import { promises as fs } from 'fs';
import { join } from 'path';
import configLoader from '../config/configLoader.js';
import logger from '../config/logger.js';

export const isValidUser = (credentials, requiredRole = null) => {
  const users = configLoader.getAuthUsers();
  const foundUser = users.find(
    userItem => userItem.username === credentials.name && userItem.password === credentials.pass
  );

  if (!foundUser) {
    return false;
  }

  // If no specific role required, just validate credentials
  if (!requiredRole) {
    return foundUser;
  }

  // Role-based permissions: user = downloads only, admin = downloads + uploads
  if (requiredRole === 'downloads') {
    return foundUser.role === 'user' || foundUser.role === 'admin';
  }

  if (requiredRole === 'uploads') {
    return foundUser.role === 'admin';
  }

  return false;
};

export const getUserPermissions = user => {
  const permissions = ['downloads']; // All users get downloads

  if (user.role === 'admin') {
    permissions.push('uploads'); // Admins also get uploads
    permissions.push('delete'); // Admins can delete files
  }

  return permissions;
};

export const isAllowedDirectory = (path, servedDir) => {
  const relativePath = path.replace(servedDir, '').replace(/\\/g, '/');
  const allowedDirs = configLoader.getAllowedDirectories();

  return allowedDirs.some(dir => relativePath.startsWith(dir));
};

export const isStaticDirectory = (path, servedDir) => {
  const relativePath = path.replace(servedDir, '').replace(/\\/g, '/');
  const staticDirs = configLoader.getStaticDirectories();

  return staticDirs.some(dir => relativePath.startsWith(dir));
};

export const getStaticContent = async path => {
  try {
    const indexPath = join(path, 'index.html');
    const indexExists = await fs
      .access(indexPath)
      .then(() => true)
      .catch(() => false);
    if (indexExists) {
      return await fs.readFile(indexPath, 'utf8');
    }
    return null;
  } catch (error) {
    logger.error('Error reading static index.html', { error: error.message });
    return null;
  }
};
