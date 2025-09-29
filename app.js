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
import { specs } from './config/swagger.js';
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

  /**
   * @swagger
   * /api/user-api-keys:
   *   get:
   *     summary: Get user's API keys for Swagger UI
   *     description: Retrieve the current user's API keys that can be used for authorization in Swagger UI
   *     tags: [API Keys]
   *     security:
   *       - JwtAuth: []
   *     responses:
   *       200:
   *         description: Successfully retrieved user API keys
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 api_keys:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ApiKey'
   *                   description: Array of user's API keys
   *                 user_permissions:
   *                   type: array
   *                   items:
   *                     type: string
   *                     enum: [downloads, uploads, delete]
   *                   description: User's current permissions
   *                   example: ['downloads', 'uploads']
   *                 swagger_config:
   *                   type: object
   *                   properties:
   *                     allow_full_key_retrieval:
   *                       type: boolean
   *                       description: Whether full key retrieval is enabled
   *                       example: true
   *                     allow_temp_key_generation:
   *                       type: boolean
   *                       description: Whether temporary key generation is enabled
   *                       example: true
   *                     temp_key_expiration_hours:
   *                       type: integer
   *                       description: Hours until temporary keys expire
   *                       example: 1
   *       401:
   *         description: Authentication required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  /**
   * @swagger
   * /api/user-api-keys/{id}/full:
   *   post:
   *     summary: Get full API key for Swagger authorization
   *     description: Retrieve the complete API key for use in Swagger UI when full key retrieval is enabled in configuration
   *     tags: [API Keys]
   *     security:
   *       - JwtAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: API key ID
   *         example: 1
   *     responses:
   *       200:
   *         description: Full API key retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 full_key:
   *                   type: string
   *                   description: Complete API key for authentication
   *                   example: aL6uDnFgRRQJD0A6uKMNOf3K3jHnnt
   *                 name:
   *                   type: string
   *                   description: API key name
   *                   example: CI Pipeline
   *                 permissions:
   *                   type: array
   *                   items:
   *                     type: string
   *                     enum: [downloads, uploads, delete]
   *                   description: Key permissions
   *                   example: ['downloads', 'uploads']
   *       400:
   *         description: Full key not available for this API key
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       401:
   *         description: Authentication required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Full key retrieval is disabled in configuration
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: API key not found or not retrievable
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error or key decryption failed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  /**
   * @swagger
   * /api/user-api-keys/temp:
   *   post:
   *     summary: Generate temporary API key for Swagger testing
   *     description: Generate a temporary API key for testing API endpoints in Swagger UI. The key expires after a configured time period.
   *     tags: [API Keys]
   *     security:
   *       - JwtAuth: []
   *     responses:
   *       200:
   *         description: Temporary API key generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Temporary API key generated for Swagger testing
   *                 temp_key:
   *                   type: object
   *                   properties:
   *                     key:
   *                       type: string
   *                       description: Temporary API key for authentication
   *                       example: temp_aL6uDnFgRRQJD0A6uKMNOf3K3jHnnt
   *                     permissions:
   *                       type: array
   *                       items:
   *                         type: string
   *                         enum: [downloads, uploads, delete]
   *                       description: User's permissions granted to temp key
   *                       example: ['downloads', 'uploads']
   *                     expires_at:
   *                       type: string
   *                       format: date-time
   *                       description: Temporary key expiration timestamp
   *                       example: 2025-09-29T15:30:10.123Z
   *                     type:
   *                       type: string
   *                       enum: [temporary]
   *                       description: Key type identifier
   *                       example: temporary
   *       401:
   *         description: Authentication required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Temporary key generation is disabled in configuration
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  /**
   * @swagger
   * /api/swagger.json:
   *   get:
   *     summary: Get OpenAPI specification
   *     description: Returns the complete OpenAPI 3.0 specification for this API in JSON format
   *     tags: [API Documentation]
   *     responses:
   *       200:
   *         description: OpenAPI specification retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               description: Complete OpenAPI 3.0 specification document
   *               properties:
   *                 openapi:
   *                   type: string
   *                   example: "3.0.4"
   *                 info:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                       example: "File Server API"
   *                     version:
   *                       type: string
   *                       example: "1.0.0"
   *                 paths:
   *                   type: object
   *                   description: All API endpoints and their specifications
   *                 components:
   *                   type: object
   *                   description: Reusable components including schemas and security schemes
   */
  app.get('/api/swagger.json', (req, res) => {
    console.log('Serving OpenAPI spec for React Swagger UI', req.path);
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
