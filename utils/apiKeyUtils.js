import crypto from 'crypto';
import bcrypt from 'bcrypt';

// Static KDF salt for deriving the API key encryption key from jwt_secret.
// Must remain stable — changing this invalidates every stored encrypted_full_key.
const API_KEY_ENCRYPTION_KDF_SALT = 'armor-api-key-encryption';
const API_KEY_LENGTH = 32;
const API_KEY_PREVIEW_LENGTH = 8;
const API_KEY_BCRYPT_SALT_ROUNDS = 12;

const deriveEncryptionKey = jwtSecret => {
  if (typeof jwtSecret !== 'string' || jwtSecret.trim().length === 0) {
    throw new Error('Invalid jwt_secret: expected a non-empty string from config');
  }
  return crypto.scryptSync(jwtSecret, API_KEY_ENCRYPTION_KDF_SALT, 32);
};

// AES-256-CBC encrypt a plaintext API key for database storage.
// Output format: "<iv-hex>:<ciphertext-hex>"
export const encryptFullKey = (plainKey, jwtSecret) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', deriveEncryptionKey(jwtSecret), iv);
  let encrypted = cipher.update(plainKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

// Reverse of encryptFullKey. Throws on malformed input or wrong key.
// Validates shape (string, "<iv-hex>:<ciphertext-hex>", valid hex, 16-byte IV)
// before touching the crypto primitives so downstream errors are specific
// rather than generic OpenSSL noise.
export const decryptFullKey = (encryptedPayload, jwtSecret) => {
  if (typeof encryptedPayload !== 'string') {
    throw new Error('Invalid encrypted payload: expected string');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid encrypted payload: expected "<iv-hex>:<ciphertext-hex>"');
  }

  const [ivHex, encryptedData] = parts;
  const isHex = value => /^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0;
  if (!isHex(ivHex) || !isHex(encryptedData)) {
    throw new Error('Invalid encrypted payload: non-hex content');
  }

  const iv = Buffer.from(ivHex, 'hex');
  if (iv.length !== 16) {
    throw new Error('Invalid encrypted payload: IV must be 16 bytes');
  }

  const decipher = crypto.createDecipheriv('aes-256-cbc', deriveEncryptionKey(jwtSecret), iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

export const generateApiKey = () => {
  // Draw 48 random bytes per iteration → ~48 alphanumeric chars after base64
  // filter. The loop is effectively a one-shot in practice; the guard is
  // there so we can never return a short key even if consecutive draws
  // happen to filter low.
  let key = '';
  while (key.length < API_KEY_LENGTH) {
    key += crypto
      .randomBytes(48)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '');
  }
  return key.substring(0, API_KEY_LENGTH);
};

/**
 * Hash a plaintext API key with bcrypt for database storage.
 * @param {string} key Plaintext API key.
 * @returns {Promise<string>} bcrypt hash. Callers must await and handle rejection.
 */
export const hashApiKey = key => bcrypt.hash(key, API_KEY_BCRYPT_SALT_ROUNDS);

/**
 * Compare a plaintext API key to a bcrypt hash.
 * @param {string} key Plaintext API key from a Bearer token.
 * @param {string} hash bcrypt hash from the database.
 * @returns {Promise<boolean>} true if the key matches. Callers must await and handle rejection.
 */
export const validateApiKey = (key, hash) => bcrypt.compare(key, hash);

export const getKeyPreview = key => {
  if (typeof key !== 'string') {
    return '';
  }
  return key.substring(0, API_KEY_PREVIEW_LENGTH);
};

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

  if (Number.isNaN(expiration.getTime())) {
    return { valid: false, error: 'Invalid expiration date' };
  }

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

// Fail-secure: an invalid/unparseable stored date is treated as expired
// rather than throwing, so a single bad DB row can't crash a list endpoint
// or silently grant perpetual access through auth middleware.
export const isApiKeyExpired = expiresAt => {
  const expiration = new Date(expiresAt);
  if (Number.isNaN(expiration.getTime())) {
    return true;
  }
  return new Date() > expiration;
};
