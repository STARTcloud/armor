import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import configLoader from './config/configLoader.js';
import { initializeDatabase } from './config/database.js';
import { setupPassportStrategies } from './config/passport.js';
import { SERVED_DIR } from './config/paths.js';
import { morganMiddleware, logger, updateLoggerConfig } from './config/logger.js';
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

const app = express();
const port = process.env.PORT || 443;

const startServer = async () => {
  await configLoader.load();

  // Update logger configuration after config is loaded
  const loggingConfig = configLoader.getLoggingConfig();
  await updateLoggerConfig(loggingConfig);

  await initializeDatabase();

  await setupPassportStrategies();

  const fileWatcher = new FileWatcherService(SERVED_DIR);

  // Initialize file watcher in background (non-blocking)
  fileWatcher.initialize().catch(error => {
    logger.error('File watcher initialization failed', { error: error.message });
  });

  app.use((req, res, next) => {
    req.fileWatcher = fileWatcher;
    res.locals.fileWatcher = fileWatcher;
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:', 'https://startcloud.com'],
          connectSrc: ["'self'"],
        },
      },
    })
  );
  app.use((req, res, next) => {
    if (req.path === '/events') {
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

  app.use('/', sseRoutes);

  app.use('/api/api-keys', apiKeyRoutes);

  // API endpoint to get user's API keys for Swagger
  app.get('/api/user-api-keys', async (req, res) => {
    try {
      let userApiKeys = [];
      const swaggerConfig = configLoader.getSwaggerConfig();

      if (req.cookies?.auth_token) {
        try {
          const jwt = await import('jsonwebtoken');
          const authConfigForJWT = configLoader.getAuthenticationConfig();
          const decoded = jwt.default.verify(req.cookies.auth_token, authConfigForJWT.jwt_secret);

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

      const jwt = await import('jsonwebtoken');
      const authConfigForFull = configLoader.getAuthenticationConfig();
      const decoded = jwt.default.verify(req.cookies.auth_token, authConfigForFull.jwt_secret);

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
        const crypto = await import('crypto');

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
  app.post('/api/user-api-keys/temp', async (req, res) => {
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

      const jwt = await import('jsonwebtoken');
      const authConfigForTemp = configLoader.getAuthenticationConfig();
      const decoded = jwt.default.verify(req.cookies.auth_token, authConfigForTemp.jwt_secret);

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
      const { generateApiKey } = await import('./utils/apiKeyUtils.js');
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
    express.static('web/static', {
      setHeaders: (response, filePath) => {
        logger.debug('Setting headers for static file', { filePath });
        if (filePath.endsWith('.css')) {
          response.setHeader('Content-Type', 'text/css');
        }
      },
    })
  );

  // Conditionally enable API documentation
  const serverConfig = configLoader.getServerConfig();
  if (serverConfig.enable_api_docs) {
    const ApiKey = getApiKeyModel();

    // Dynamic API key fetching for Swagger setup
    app.use('/api-docs', async (req, res, next) => {
      let userApiKeys = [];

      if (req.cookies?.auth_token) {
        try {
          const jwt = await import('jsonwebtoken');
          const authConfigForAPI = configLoader.getAuthenticationConfig();
          const decoded = jwt.default.verify(req.cookies.auth_token, authConfigForAPI.jwt_secret);

          if (decoded) {
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
              const apiKeys = await ApiKey.findAll({
                where: whereClause,
                attributes: ['id', 'name', 'key_preview', 'permissions', 'expires_at'],
                order: [['created_at', 'DESC']],
              });

              userApiKeys = apiKeys.map(key => key.toJSON());
            }
          }
        } catch (error) {
          logger.debug('Could not fetch user API keys for Swagger', { error: error.message });
        }
      }

      req.userApiKeys = userApiKeys;
      logger.debug('API keys loaded for Swagger', {
        count: userApiKeys.length,
        userAgent: req.headers['user-agent'],
      });
      res.locals.swaggerApiKeys = userApiKeys;
      next();
    });

    app.use('/api-docs', swaggerUi.serve);
    app.get('/api-docs', (req, res) => {
      // Clean implementation using external JS file
      const specsJson = JSON.stringify(specs)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');

      const userApiKeysJson = JSON.stringify(req.userApiKeys || [])
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');

      const options = {
        explorer: true,
        customfavIcon: '/web/static/images/favicon.ico',
        customSiteTitle: 'Armor API Documentation',
        swaggerOptions: {
          persistAuthorization: true,
        },
        customCssUrl: ['/static/css/SwaggerDark.css', '/static/css/SwaggerDark.user.css'],
        customJs: ['/static/js/swagger-custom.js'],
        customJsStr: [
          `window.swaggerSpec = ${specsJson};`,
          `window.userApiKeys = ${userApiKeysJson};`,
        ],
      };

      res.send(swaggerUi.generateHTML(specs, options));
    });

    logger.info('API documentation enabled at /api-docs');
  }

  app.use('/', fileServerRoutes);

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
