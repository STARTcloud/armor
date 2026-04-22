import crypto from 'crypto';
import { promisify } from 'util';
import bcrypt from 'bcrypt';

const scryptAsync = promisify(crypto.scrypt);

// Static KDF salt for deriving the API key encryption key from jwt_secret.
// Must remain stable — changing this invalidates every stored encrypted_full_key.
const API_KEY_ENCRYPTION_KDF_SALT = 'armor-api-key-encryption';
const API_KEY_LENGTH = 32;
const API_KEY_PREVIEW_LENGTH = 8;
const API_KEY_BCRYPT_SALT_ROUNDS = 12;
const VALID_PERMISSIONS = ['downloads', 'uploads', 'delete'];

const isHex = value => /^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0;

/**
 * Derives the AES-256 encryption key from the JWT secret via scrypt.
 * Async to avoid blocking the event loop on the ~50-100ms scrypt workload.
 * @param {string} jwtSecret Non-empty jwt_secret from config.
 * @returns {Promise<Buffer>} 32-byte derived key.
 * @throws {Error} If jwtSecret is not a non-empty string.
 * @throws {Error} If key derivation fails in the underlying crypto implementation.
 */
const deriveEncryptionKey = async jwtSecret => {
  if (typeof jwtSecret !== 'string') {
    const receivedType = jwtSecret === null ? 'null' : typeof jwtSecret;
    throw new Error(
      `Invalid jwt_secret: expected a non-empty string from config, received type ${receivedType}`
    );
  }
  if (jwtSecret.trim().length === 0) {
    throw new Error('Invalid jwt_secret: expected a non-empty string from config, received empty');
  }
  try {
    const derivedKey = await scryptAsync(jwtSecret, API_KEY_ENCRYPTION_KDF_SALT, 32);
    return derivedKey;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to derive API key encryption key from jwt_secret: ${message}`);
  }
};

/**
 * AES-256-CBC encrypt a plaintext API key for database storage.
 * @param {string} plainKey Plaintext API key to encrypt.
 * @param {string} jwtSecret Non-empty jwt_secret used to derive the encryption key.
 * @returns {Promise<string>} Encrypted payload in the format "<iv-hex>:<ciphertext-hex>".
 * @throws {Error} If jwtSecret is invalid (propagated from deriveEncryptionKey).
 * @throws {Error} If encryption fails in the underlying crypto implementation.
 */
export const encryptFullKey = async (plainKey, jwtSecret) => {
  // NOTE: plainKey is the output of generateApiKey() in the sole caller
  // (routes/apiKeys.js), which guarantees a 32-char alphanumeric string.
  // Input-type validation is intentionally omitted — it would be dead code.
  const iv = crypto.randomBytes(16);
  const key = await deriveEncryptionKey(jwtSecret);
  try {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plainKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to encrypt API key: ${message}`);
  }
};

/**
 * Decrypt an encrypted API key payload produced by {@link encryptFullKey}.
 * Validates shape (string, "<iv-hex>:<ciphertext-hex>", valid hex, 16-byte IV)
 * before touching the crypto primitives so downstream errors are specific
 * rather than generic OpenSSL noise.
 * @param {string} encryptedPayload Value in the format "<iv-hex>:<ciphertext-hex>".
 * @param {string} jwtSecret Non-empty jwt_secret used to derive the encryption key.
 * @returns {Promise<string>} The decrypted plaintext API key.
 * @throws {Error} If encryptedPayload is not a string.
 * @throws {Error} If encryptedPayload is not in "<iv-hex>:<ciphertext-hex>" format.
 * @throws {Error} If the IV or ciphertext segments contain non-hex content.
 * @throws {Error} If the decoded IV is not exactly 16 bytes.
 * @throws {Error} If jwtSecret is invalid (propagated from deriveEncryptionKey).
 * @throws {Error} If decryption fails (wrong secret or tampered/corrupt ciphertext).
 */
export const decryptFullKey = async (encryptedPayload, jwtSecret) => {
  if (typeof encryptedPayload !== 'string') {
    throw new Error('Invalid encrypted payload: expected string');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid encrypted payload: expected "<iv-hex>:<ciphertext-hex>"');
  }

  const [ivHex, encryptedData] = parts;
  if (!isHex(ivHex) || !isHex(encryptedData)) {
    throw new Error('Invalid encrypted payload: non-hex content');
  }

  const iv = Buffer.from(ivHex, 'hex');
  if (iv.length !== 16) {
    throw new Error('Invalid encrypted payload: IV must be 16 bytes');
  }

  const key = await deriveEncryptionKey(jwtSecret);
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to decrypt API key: ${message}`);
  }
};

/**
 * Generate a fixed-length alphanumeric API key using the CSPRNG.
 * Strategy: draw 48 random bytes per iteration (~48 alphanumeric chars
 * after base64-filter), loop until length ≥ API_KEY_LENGTH, truncate.
 * The loop is effectively a one-shot in practice; the guard is there
 * so we can never return a short key even if consecutive draws filter low.
 * @returns {string} An API_KEY_LENGTH-character key containing only [a-zA-Z0-9].
 */
export const generateApiKey = () => {
  // NOTE: += string concat is fine here — V8 uses rope strings for repeated
  // concatenation, and the loop typically runs once in practice (48 random
  // bytes → ~48 alphanumeric chars after filter, well above the 32-char
  // target). An Array+join() accumulator would add complexity without
  // measurable benefit.
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
// NOTE: `key` is the output of generateApiKey() in the sole caller
// (routes/apiKeys.js). Input-type validation is intentionally omitted — it
// would be dead code.
export const hashApiKey = key => bcrypt.hash(key, API_KEY_BCRYPT_SALT_ROUNDS);

/**
 * Compare a plaintext API key to a bcrypt hash.
 * @param {string} key Plaintext API key from a Bearer token.
 * @param {string} hash bcrypt hash from the database.
 * @returns {Promise<boolean>} true if the key matches. Callers must await and handle rejection.
 */
// NOTE: Inputs are guaranteed by callers —
//   - `key` is pre-guarded by middleware/auth.middleware.js (checkApiKeyAuth
//     returns false before calling us when the Bearer token is missing or
//     empty).
//   - `hash` is read from the `key_hash` column which is NOT NULL in the
//     API keys table (models/ApiKey.js).
// Input-type validation here would be dead code.
export const validateApiKey = (key, hash) => bcrypt.compare(key, hash);

/**
 * Return a short non-sensitive prefix of an API key for display.
 * @param {string} key Plaintext API key.
 * @returns {string} First API_KEY_PREVIEW_LENGTH characters of `key`.
 *   Returns '' if `key` is not a string. If `key` is shorter than
 *   API_KEY_PREVIEW_LENGTH, the full key is returned.
 */
export const getKeyPreview = key => {
  if (typeof key !== 'string') {
    return '';
  }
  return key.substring(0, API_KEY_PREVIEW_LENGTH);
};

/**
 * Validate that all requested API key permissions are allowed.
 * @param {string[]} permissions Array of permission strings to validate.
 * @returns {boolean} `true` only when `permissions` is an array and every
 *   entry is one of `VALID_PERMISSIONS`; `false` otherwise (including for
 *   non-array input).
 */
export const validatePermissions = permissions => {
  if (!Array.isArray(permissions)) {
    return false;
  }
  return permissions.every(permission => VALID_PERMISSIONS.includes(permission));
};

/**
 * Validate an API key expiration date input.
 * Rules:
 * - Must be a valid/parseable date value.
 * - Must be in the future.
 * - Must be no more than 1 year from now.
 * @param {string|number|Date} expiresAt Date input to validate.
 * @returns {{ valid: true } | { valid: false, error: string }}
 *   Validation result with `valid` boolean and, when invalid, an `error`
 *   message describing the failed rule.
 */
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
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(now.getFullYear() + 1);

  if (expiration > oneYearFromNow) {
    return { valid: false, error: 'Expiration date cannot be more than 1 year from now' };
  }

  return { valid: true };
};

/**
 * Determine whether an API key is expired.
 *
 * Fail-secure: an invalid/unparseable stored date is treated as expired
 * rather than throwing, so a single bad DB row can't crash a list endpoint
 * or silently grant perpetual access through auth middleware.
 *
 * @param {string|number|Date} expiresAt Stored expiration value.
 * @returns {boolean} `true` if the key is expired OR if `expiresAt` is
 *   invalid/unparseable (fail-secure).
 */
export const isApiKeyExpired = expiresAt => {
  const expiration = new Date(expiresAt);
  if (Number.isNaN(expiration.getTime())) {
    return true;
  }
  return new Date() > expiration;
};
