import crypto from 'crypto';
import bcrypt from 'bcrypt';

export const generateApiKey = () => {
  // Generate a 32-character cryptographically secure API key
  let key = '';
  while (key.length < 32) {
    const randomBytes = crypto.randomBytes(24);
    const base64 = randomBytes.toString('base64');
    const alphanumeric = base64.replace(/[^a-zA-Z0-9]/g, '');
    key += alphanumeric;
  }
  return key.substring(0, 32);
};

export const hashApiKey = key => {
  const saltRounds = 12;
  return bcrypt.hash(key, saltRounds);
};

export const validateApiKey = (key, hash) => bcrypt.compare(key, hash);

export const getKeyPreview = key => key.substring(0, 8);

export const validatePermissions = permissions => {
  if (!Array.isArray(permissions)) {
    return false;
  }
  const validPermissions = ['downloads', 'uploads', 'delete'];
  return permissions.every(permission => validPermissions.includes(permission));
};

export const validateExpirationDate = expiresAt => {
  const now = new Date();
  const expiration = new Date(expiresAt);

  // Must be in the future
  if (expiration <= now) {
    return { valid: false, error: 'Expiration date must be in the future' };
  }

  // Cannot be more than 1 year from now (prevent infinite-like keys)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(now.getFullYear() + 1);

  if (expiration > oneYearFromNow) {
    return { valid: false, error: 'Expiration date cannot be more than 1 year from now' };
  }

  return { valid: true };
};

export const isApiKeyExpired = expiresAt => new Date() > new Date(expiresAt);
