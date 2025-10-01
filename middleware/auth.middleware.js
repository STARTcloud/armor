import auth from 'basic-auth';
import jwt from 'jsonwebtoken';
import configLoader from '../config/configLoader.js';
import { isValidUser, getUserPermissions } from '../utils/auth.js';
import { logAccess, authLogger as logger, databaseLogger } from '../config/logger.js';
import { getApiKeyModel } from '../models/ApiKey.js';
import { validateApiKey, isApiKeyExpired } from '../utils/apiKeyUtils.js';

const checkApiKeyAuth = async (req, permission) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const apiKey = authHeader.substring(7);

  if (!apiKey) {
    return false;
  }

  try {
    const ApiKey = getApiKeyModel();

    const allKeys = await ApiKey.findAll({
      attributes: [
        'id',
        'key_hash',
        'permissions',
        'expires_at',
        'user_type',
        'user_id',
        'local_user_id',
        'name',
      ],
    });

    if (allKeys.length === 0) {
      databaseLogger.info('No API keys found in database');
      return false;
    }

    const validationResults = await Promise.all(
      allKeys.map(async keyRecord => ({
        keyRecord,
        isValid: await validateApiKey(apiKey, keyRecord.key_hash),
      }))
    );

    const validResult = validationResults.find(result => result.isValid);

    if (validResult) {
      const { keyRecord } = validResult;

      // Check if key is expired
      if (isApiKeyExpired(keyRecord.expires_at)) {
        logger.info('API key expired', { keyId: keyRecord.id });
        return false;
      }

      // Check if key has required permission
      if (!keyRecord.permissions.includes(permission)) {
        logger.info('API key lacks permission', {
          keyId: keyRecord.id,
          permission,
          keyPermissions: keyRecord.permissions,
        });
        return false;
      }

      // Update last_used timestamp
      keyRecord.update({ last_used: new Date() });

      // Create user context for API key
      if (keyRecord.user_type === 'oidc') {
        req.oidcUser = {
          userId: keyRecord.user_id,
          permissions: keyRecord.permissions,
          authType: 'api_key',
          apiKeyId: keyRecord.id,
        };
      } else {
        // Local user - need to get username
        const localUsers = configLoader.getAuthUsers();
        const localUser = localUsers.find(u => u.id === keyRecord.local_user_id);

        if (localUser) {
          req.oidcUser = {
            username: localUser.username,
            permissions: keyRecord.permissions,
            authType: 'api_key',
            apiKeyId: keyRecord.id,
          };
        }
      }

      logger.info('API key auth success', {
        keyId: keyRecord.id,
        permission,
        keyName: keyRecord.name,
      });

      return true;
    }

    logger.info('API key validation failed');
    return false;
  } catch (error) {
    logger.error('API key validation error', { error: error.message });
    return false;
  }
};

const checkJwtAuth = (req, permission) => {
  const token = req.cookies?.auth_token;

  logger.info('JWT auth check', {
    hasToken: !!token,
    permission,
    cookies: Object.keys(req.cookies || {}),
  });

  if (!token) {
    return false;
  }

  try {
    const authConfig = configLoader.getAuthenticationConfig();
    const decoded = jwt.verify(token, authConfig.jwt_secret);

    logger.info('JWT decoded successfully', {
      decoded,
      permission,
      hasPermissions: !!decoded.permissions,
      authType: decoded.authType,
    });

    // NEW: If this JWT represents a basic auth user, use local role instead of domain mappings
    if (decoded.authType === 'basic' && decoded.username) {
      const localUsers = configLoader.getAuthUsers();
      const localUser = localUsers.find(u => u.username === decoded.username);
      if (localUser) {
        const rolePermissions = getUserPermissions(localUser);
        const hasPermission = rolePermissions.includes(permission);

        logger.info('Basic auth user via JWT - using local role', {
          username: decoded.username,
          localRole: localUser.role,
          rolePermissions,
          permission,
          hasPermission,
        });

        if (hasPermission) {
          req.oidcUser = {
            ...decoded,
            permissions: rolePermissions,
          };
          return true;
        }
        return false;
      }
    }

    // For OIDC users, use existing domain/claims mapping logic
    const permissions = decoded.permissions || [];

    if (permissions.includes(permission)) {
      req.oidcUser = decoded;
      logger.info('JWT auth success (OIDC user)', { permission, permissions });
      return true;
    }
    logger.info('JWT auth failed - permission not found', {
      permission,
      userPermissions: permissions,
    });
  } catch (error) {
    logger.error('JWT verification failed', { error: error.message });
    return false;
  }

  return false;
};

export const authenticateDownloads = async (req, res, next) => {
  if (checkJwtAuth(req, 'downloads')) {
    logAccess(req, 'JWT_AUTH_SUCCESS', 'downloads');
    req.isAuthenticated = 'downloads';
    return next();
  }

  if (await checkApiKeyAuth(req, 'downloads')) {
    logAccess(req, 'API_KEY_AUTH_SUCCESS', 'downloads');
    req.isAuthenticated = 'downloads';
    return next();
  }

  const credentials = auth(req);
  const hasAuthHeader = req.headers.authorization;

  // If basic auth credentials were provided, validate them
  if (credentials) {
    if (isValidUser(credentials, 'downloads')) {
      logAccess(req, 'BASIC_AUTH_SUCCESS', 'downloads');
      req.isAuthenticated = 'downloads';
      return next();
    }
    // Basic auth credentials provided but invalid
    logAccess(req, 'BASIC_AUTH_FAILED', 'downloads');
    res.set('WWW-Authenticate', 'Basic realm="Download Access"');
    return res.status(401).send('Invalid credentials');
  }

  // No credentials provided - handle based on request type
  logAccess(req, 'AUTH_FAILED', 'downloads');

  // Handle EventSource requests differently (no redirects or JSON)
  if (req.headers.accept === 'text/event-stream') {
    return res.status(401).send('Authentication required for SSE');
  }

  // RFC 7617 compliant: If Authorization header attempted, always send 401 challenge
  if (hasAuthHeader) {
    res.set('WWW-Authenticate', 'Basic realm="Download Access"');
    return res.status(401).send('Authentication required for downloads');
  }

  // Industry standard: Only redirect if it's clearly a browser request
  const acceptsBrowser =
    req.headers.accept?.includes('text/html') &&
    req.headers.accept?.includes('application/xhtml+xml');

  if (acceptsBrowser) {
    return res.redirect(`/login?return=${encodeURIComponent(req.originalUrl)}`);
  }

  // Default: 401 challenge for API clients and CLI tools
  res.set('WWW-Authenticate', 'Basic realm="Download Access"');
  return res.status(401).send('Authentication required for downloads');
};

export const authenticateUploads = async (req, res, next) => {
  if (checkJwtAuth(req, 'uploads')) {
    logAccess(req, 'JWT_AUTH_SUCCESS', 'uploads');
    req.isAuthenticated = 'uploads';
    return next();
  }

  if (await checkApiKeyAuth(req, 'uploads')) {
    logAccess(req, 'API_KEY_AUTH_SUCCESS', 'uploads');
    req.isAuthenticated = 'uploads';
    return next();
  }

  const credentials = auth(req);

  // If basic auth credentials were provided, validate them
  if (credentials) {
    if (isValidUser(credentials, 'uploads')) {
      logAccess(req, 'BASIC_AUTH_SUCCESS', 'uploads');
      req.isAuthenticated = 'uploads';
      return next();
    }
    // Basic auth credentials provided but invalid
    logAccess(req, 'BASIC_AUTH_FAILED', 'uploads');
    res.set('WWW-Authenticate', 'Basic realm="Upload Access"');
    return res.status(401).send('Invalid credentials');
  }

  // No credentials provided - handle based on request type
  logAccess(req, 'AUTH_FAILED', 'uploads');

  // Redirect browser requests to login page
  if (req.accepts('html')) {
    return res.redirect(`/login?return=${encodeURIComponent(req.originalUrl)}`);
  }

  // For API clients, return 401 with WWW-Authenticate header
  res.set('WWW-Authenticate', 'Basic realm="Upload Access"');
  return res.status(401).send('Authentication required for uploads');
};

export const authenticateDelete = async (req, res, next) => {
  if (checkJwtAuth(req, 'delete')) {
    logAccess(req, 'JWT_AUTH_SUCCESS', 'delete');
    req.isAuthenticated = 'delete';
    return next();
  }

  if (await checkApiKeyAuth(req, 'delete')) {
    logAccess(req, 'API_KEY_AUTH_SUCCESS', 'delete');
    req.isAuthenticated = 'delete';
    return next();
  }

  const credentials = auth(req);
  if (!credentials || !isValidUser(credentials, 'uploads')) {
    logAccess(req, 'AUTH_FAILED', 'delete');
    return res.status(401).json({
      success: false,
      message: 'Admin privileges required for file deletion',
    });
  }

  logAccess(req, 'AUTH_SUCCESS', 'delete');
  req.isAuthenticated = 'delete';
  return next();
};

export const authenticateApiKeyAccess = async (req, res, next) => {
  if (checkJwtAuth(req, 'downloads')) {
    req.isAuthenticated = 'api_key_management';
    return next();
  }

  if (await checkApiKeyAuth(req, 'downloads')) {
    req.isAuthenticated = 'api_key_management';
    return next();
  }

  const credentials = auth(req);
  if (!credentials || !isValidUser(credentials, 'downloads')) {
    logAccess(req, 'AUTH_FAILED', 'api_key_management');

    if (req.accepts('html')) {
      return res.redirect(`/login?return=${encodeURIComponent(req.originalUrl)}`);
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication required for API key management',
    });
  }

  const localUsers = configLoader.getAuthUsers();
  const localUser = localUsers.find(u => u.username === credentials.name);

  if (localUser) {
    req.oidcUser = {
      username: localUser.username,
      permissions: getUserPermissions(localUser),
      authType: 'basic',
    };
  }

  logAccess(req, 'AUTH_SUCCESS', 'api_key_management');
  req.isAuthenticated = 'api_key_management';
  return next();
};
