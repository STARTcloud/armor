import express from 'express';
import path from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import configLoader from './config/configLoader.js';
import { initializeDatabase } from './config/database.js';
import { setupPassportStrategies } from './config/passport.js';
import { SERVED_DIR } from './config/paths.js';
import { morganMiddleware, logger } from './config/logger.js';
import { rateLimiterMiddleware } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import FileWatcherService from './services/fileWatcher.js';
import fileServerRoutes from './routes/fileServer.js';
import authRoutes from './routes/auth.js';
import sseRoutes from './routes/sse.js';
import apiKeyRoutes from './routes/apiKeys.js';
import { setupHTTPSServer } from './utils/sslManager.js';
import { specs, swaggerUi } from './config/swagger.js';
import { getApiKeyModel } from './models/ApiKey.js';
import { getUserPermissions } from './utils/auth.js';
import maintenanceService from './services/maintenanceService.js';
import checksumService from './services/checksumService.js';
import { generateApiKey } from './utils/apiKeyUtils.js';

const app = express();

const startServer = async () => {
  configLoader.load();

  const serverPortConfig = configLoader.getServerConfig();
  const port = process.env.PORT || serverPortConfig.port || 443;

  await initializeDatabase();

  await setupPassportStrategies();

  const fileWatcher = new FileWatcherService(SERVED_DIR);

  // Initialize file watcher in background (non-blocking)
  fileWatcher.initialize().catch(error => {
    logger.error('File watcher initialization failed', { error: error.message });
  });

  maintenanceService.start();
  checksumService.start();

  app.use((req, res, next) => {
    req.fileWatcher = fileWatcher;
    res.locals.fileWatcher = fileWatcher;
    next();
  });

  // CORS configuration from YAML (like zoneweaver)
  const corsConfig = configLoader.getCorsConfig();

  let origin;
  if (corsConfig.allow_origin === true) {
    origin = corsConfig.whitelist;
  } else if (corsConfig.allow_origin === false) {
    origin = false;
  } else if (corsConfig.allow_origin === 'specific') {
    origin = corsConfig.whitelist;
  } else {
    origin = corsConfig.allow_origin; // fallback for other values
  }

  const corsOptions = {
    origin,
    preflightContinue: corsConfig.preflight_continue,
    credentials: corsConfig.credentials,
  };

  app.use(cors(corsOptions));
  app.options('*splat', cors(corsOptions));

  // Use helmet without CSP to avoid blocking configured logo URLs
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP to allow configured logo URLs
    })
  );
  app.use((req, res, next) => {
    if (req.path === '/api/events') {
      logger.debug('Skipping compression for SSE endpoint', { path: req.path });
      next();
    } else {
      compression()(req, res, next);
    }
  });
  app.use(cookieParser());

  const authConfig = configLoader.getAuthenticationConfig();
  app.use(
    session({
      secret: authConfig.jwt_secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(morganMiddleware);
  app.use(rateLimiterMiddleware());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/', authRoutes);

  app.use('/api/events', sseRoutes);

  app.use('/api/api-keys', apiKeyRoutes);

  // API endpoint to get user's API keys for Swagger
  app.get('/api/user-api-keys', async (req, res) => {
    try {
      let userApiKeys = [];
      let userPermissions = [];
      const swaggerConfig = configLoader.getSwaggerConfig();

      if (req.cookies?.auth_token) {
        try {
          const authConfigForJWT = configLoader.getAuthenticationConfig();
          const decoded = jwt.verify(req.cookies.auth_token, authConfigForJWT.jwt_secret);

          userPermissions = decoded.permissions || [];

          if (decoded) {
            const ApiKey = getApiKeyModel();
            let whereClause = {};

            if (decoded.userId) {
              whereClause = { user_type: 'oidc', user_id: decoded.userId };
            } else if (decoded.username) {
              const localUsers = configLoader.getAuthUsers();
              const localUser = localUsers.find(u => u.username === decoded.username);
              if (localUser?.id) {
                whereClause = { user_type: 'local', local_user_id: localUser.id };
              }
            }

            if (Object.keys(whereClause).length > 0) {
              // If full key retrieval is enabled, only show retrievable keys
              if (swaggerConfig.allow_full_key_retrieval) {
                whereClause.is_retrievable = true;
              }

              const apiKeys = await ApiKey.findAll({
                where: whereClause,
                attributes: [
                  'id',
                  'name',
                  'key_preview',
                  'permissions',
                  'expires_at',
                  'is_retrievable',
                ],
                order: [['created_at', 'DESC']],
              });

              userApiKeys = apiKeys.map(key => key.toJSON());
            }
          }
        } catch (error) {
          logger.debug('Could not fetch user API keys', { error: error.message });
        }
      }

      res.json({
        success: true,
        api_keys: userApiKeys,
        user_permissions: userPermissions,
        swagger_config: {
          allow_full_key_retrieval: swaggerConfig.allow_full_key_retrieval,
          allow_temp_key_generation: swaggerConfig.allow_temp_key_generation,
          temp_key_expiration_hours: swaggerConfig.temp_key_expiration_hours,
        },
      });
    } catch (error) {
      logger.error('User API keys error', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to get API keys' });
    }
  });

  // Get full API key for Swagger authorization (when enabled in config)
  app.post('/api/user-api-keys/:id/full', async (req, res) => {
    try {
      const swaggerConfig = configLoader.getSwaggerConfig();

      if (!swaggerConfig.allow_full_key_retrieval) {
        return res.status(403).json({
          success: false,
          message: 'Full key retrieval is disabled',
        });
      }

      if (!req.cookies?.auth_token) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const authConfigForFull = configLoader.getAuthenticationConfig();
      const decoded = jwt.verify(req.cookies.auth_token, authConfigForFull.jwt_secret);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication',
        });
      }

      const ApiKey = getApiKeyModel();
      const keyId = parseInt(req.params.id);

      const whereClause = { id: keyId };
      if (decoded.userId) {
        whereClause.user_type = 'oidc';
        whereClause.user_id = decoded.userId;
      } else if (decoded.username) {
        const localUsers = configLoader.getAuthUsers();
        const localUser = localUsers.find(u => u.username === decoded.username);
        if (localUser?.id) {
          whereClause.user_type = 'local';
          whereClause.local_user_id = localUser.id;
        }
      }

      const apiKey = await ApiKey.findOne({
        where: { ...whereClause, is_retrievable: true },
        attributes: ['id', 'name', 'permissions', 'encrypted_full_key'],
      });

      if (!apiKey) {
        return res.status(404).json({
          success: false,
          message: 'API key not found or not retrievable',
        });
      }

      if (!apiKey.encrypted_full_key) {
        return res.status(400).json({
          success: false,
          message: 'Full key not available for this API key',
        });
      }

      // Decrypt the stored full key
      try {
        // Parse IV and encrypted data
        const [ivHex, encryptedData] = apiKey.encrypted_full_key.split(':');
        const iv = Buffer.from(ivHex, 'hex');

        const decipher = crypto.createDecipheriv(
          'aes-256-cbc',
          Buffer.from(authConfigForFull.jwt_secret).subarray(0, 32),
          iv
        );
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        res.json({
          success: true,
          full_key: decrypted,
          name: apiKey.name,
          permissions: apiKey.permissions,
        });
      } catch (decryptError) {
        logger.error('Key decryption error', { error: decryptError.message });
        return res.status(500).json({
          success: false,
          message: 'Failed to decrypt API key',
        });
      }

      logger.info('Full API key retrieved for Swagger', {
        user: decoded.username || decoded.userId,
        keyId,
        keyName: apiKey.name,
      });
      return undefined;
    } catch (error) {
      logger.error('Full API key retrieval error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve full key',
      });
    }
  });

  // Generate temporary API key for Swagger testing
  app.post('/api/user-api-keys/temp', (req, res) => {
    try {
      const swaggerConfig = configLoader.getSwaggerConfig();

      if (!swaggerConfig.allow_temp_key_generation) {
        return res.status(403).json({
          success: false,
          message: 'Temporary key generation is disabled',
        });
      }

      if (!req.cookies?.auth_token) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const authConfigForTemp = configLoader.getAuthenticationConfig();
      const decoded = jwt.verify(req.cookies.auth_token, authConfigForTemp.jwt_secret);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication',
        });
      }

      // Get user permissions based on user type
      let userPermissions = [];
      if (decoded.userId) {
        // OIDC user - use permissions from JWT token directly
        userPermissions = decoded.permissions || ['downloads'];
      } else if (decoded.username) {
        const localUsers = configLoader.getAuthUsers();
        const localUser = localUsers.find(u => u.username === decoded.username);
        if (localUser) {
          userPermissions = getUserPermissions(localUser) || ['downloads'];
        }
      }

      // Generate temporary key
      const tempKey = `temp_${generateApiKey()}`;
      const expirationHours = swaggerConfig.temp_key_expiration_hours || 1;
      const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

      res.json({
        success: true,
        message: 'Temporary API key generated for Swagger testing',
        temp_key: {
          key: tempKey,
          permissions: userPermissions,
          expires_at: expiresAt,
          type: 'temporary',
        },
      });

      logger.info('Temporary API key generated for Swagger', {
        user: decoded.username || decoded.userId,
        permissions: userPermissions,
        expires_at: expiresAt,
      });
      return undefined;
    } catch (error) {
      logger.error('Temporary API key generation error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to generate temporary key',
      });
    }
  });

  // Serve static CSS files for Swagger theming
  app.use(
    '/static',
    express.static('web/public', {
      setHeaders: (response, filePath) => {
        logger.debug('Setting headers for static file', { filePath });
        if (filePath.endsWith('.css')) {
          response.setHeader('Content-Type', 'text/css');
        }
      },
    })
  );

  // Serve static assets from Vite build
  const frontendDistPath = 'web/dist';
  if (existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
  } else {
    logger.warn('Frontend dist directory not found. Run "npm run build" to build the frontend.');
  }

  app.get('/api/swagger.json', (req, res) => {
    res.json(specs);
  });

  if (configLoader.getServerConfig().enable_api_docs) {
    logger.info('API documentation enabled at /api-docs (React implementation)');
  }

  // API routes for file operations (upload, delete, etc.)
  app.use('/api/files', fileServerRoutes);

  // File server routes for directory listings and custom index.html serving
  // CRITICAL: This must come BEFORE the React app catch-all to allow custom index.html files
  app.use('/', fileServerRoutes);

  // React app catch-all for client-side routing
  // Only serves React app for non-API, non-file paths that don't have custom index.html
  app.get('/*splat', (req, res, next) => {
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/auth/') ||
      req.path.startsWith('/static/') ||
      req.path.startsWith('/swagger/')
    ) {
      return next();
    }

    const distPath = 'web/dist';
    if (existsSync(distPath)) {
      return res.sendFile(path.resolve(distPath, 'index.html'));
    }
    return next();
  });

  app.use(errorHandler);

  const sslConfig = configLoader.getSSLConfig();
  const httpsServer = await setupHTTPSServer(app, sslConfig, port);

  if (!httpsServer) {
    logger.info('Starting HTTP server instead...');
    app.listen(port, () => {
      logger.info(`HTTP Server running at http://localhost:${port}`);
    });
  }
};

startServer();
