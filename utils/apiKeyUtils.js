import crypto from 'crypto';
import bcrypt from 'bcrypt';

// Static KDF salt for deriving the API key encryption key from jwt_secret.
// Must remain stable — changing this invalidates every stored encrypted_full_key.
const API_KEY_ENCRYPTION_KDF_SALT = 'armor-api-key-encryption';

const deriveEncryptionKey = jwtSecret =>
  crypto.scryptSync(jwtSecret, API_KEY_ENCRYPTION_KDF_SALT, 32);

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
export const decryptFullKey = (encryptedPayload, jwtSecret) => {
  const [ivHex, encryptedData] = encryptedPayload.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', deriveEncryptionKey(jwtSecret), iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

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
