import express from 'express';
import path from 'path';
import { existsSync } from 'fs';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import lusca from 'lusca';
import configLoader from './config/configLoader.js';
import { configAwareI18nMiddleware } from './config/i18n.js';
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
import checksumProgressRoutes from './routes/checksumProgress.js';
import swaggerRoutes from './routes/swagger.js';
import { setupHTTPSServer } from './utils/sslManager.js';
import maintenanceService from './services/maintenanceService.js';
import checksumService from './services/checksumService.js';

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

  // CORS configuration - secure by default to prevent CodeQL warnings
  // For security, CORS is disabled by default. Enable only specific origins if needed.
  const origin = false; // CodeQL-safe: explicitly false, not configurable

  const corsOptions = {
    origin, // Hardcoded false - secure and CodeQL-compliant
    preflightContinue: false,
    credentials: false,
  };

  app.use(cors(corsOptions));
  app.options('*splat', cors(corsOptions));

  // Serve static assets from Vite build FIRST - before any other routes
  const frontendDistPath = 'web/dist';
  if (existsSync(frontendDistPath)) {
    app.use(
      '/assets',
      express.static(path.join(frontendDistPath, 'assets'), {
        setHeaders: (response, filePath) => {
          // Ensure proper MIME types for Vite assets
          if (filePath.endsWith('.js')) {
            response.setHeader('Content-Type', 'application/javascript');
          } else if (filePath.endsWith('.css')) {
            response.setHeader('Content-Type', 'text/css');
          } else if (filePath.endsWith('.woff2')) {
            response.setHeader('Content-Type', 'font/woff2');
          }
        },
      })
    );
    app.use(express.static(frontendDistPath));
  } else {
    logger.warn('Frontend dist directory not found. Run "npm run build" to build the frontend.');
  }

  // Enhanced security headers with configurable CSP
  const securityConfig = configLoader.getSecurityConfig();
  const serverConfig = configLoader.getServerConfig();

  const helmetConfig = {};

  // Configure CSP if enabled
  if (securityConfig.content_security_policy.enabled) {
    // Start with base CSP configuration
    const cspDirectives = {
      defaultSrc: [...securityConfig.content_security_policy.default_src],
      scriptSrc: [...securityConfig.content_security_policy.script_src],
      styleSrc: [...securityConfig.content_security_policy.style_src],
      fontSrc: [...securityConfig.content_security_policy.font_src],
      imgSrc: [...securityConfig.content_security_policy.img_src],
      connectSrc: [...securityConfig.content_security_policy.connect_src],
      objectSrc: [...securityConfig.content_security_policy.object_src],
      mediaSrc: [...securityConfig.content_security_policy.media_src],
      frameSrc: [...securityConfig.content_security_policy.frame_src],
      childSrc: [...securityConfig.content_security_policy.child_src],
      workerSrc: [...securityConfig.content_security_policy.worker_src],
      manifestSrc: [...securityConfig.content_security_policy.manifest_src],
    };

    // Auto-add configured icon URLs to img-src
    const iconUrls = [serverConfig.login_icon_url, serverConfig.landing_icon_url].filter(Boolean);

    for (const iconUrl of iconUrls) {
      if (iconUrl.startsWith('https://') || iconUrl.startsWith('http://')) {
        try {
          const url = new URL(iconUrl);
          const domain = `${url.protocol}//${url.hostname}`;
          if (!cspDirectives.imgSrc.includes(domain)) {
            cspDirectives.imgSrc.push(domain);
            logger.info(`Auto-added ${domain} to CSP img-src for configured icon`);
          }
        } catch {
          logger.warn(`Invalid icon URL in config: ${iconUrl}`);
        }
      }
    }

    helmetConfig.contentSecurityPolicy = { directives: cspDirectives };
  }

  // Configure HSTS if enabled
  if (securityConfig.hsts.enabled) {
    helmetConfig.hsts = {
      maxAge: securityConfig.hsts.max_age,
      includeSubDomains: securityConfig.hsts.include_subdomains,
      preload: securityConfig.hsts.preload,
    };
  }

  // Configure additional security headers
  helmetConfig.noSniff = securityConfig.headers.x_content_type_nosniff;
  helmetConfig.frameguard = { action: securityConfig.headers.x_frame_options.toLowerCase() };
  helmetConfig.xssFilter = securityConfig.headers.x_xss_protection;
  helmetConfig.referrerPolicy = { policy: securityConfig.headers.referrer_policy };
  helmetConfig.crossOriginEmbedderPolicy = securityConfig.headers.cross_origin_embedder_policy;

  app.use(helmet(helmetConfig));
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

  // Create selective CSRF middleware - only apply to web form routes
  const selectiveCSRF = (req, res, next) => {
    // Skip CSRF for API routes, SSE, and authentication endpoints
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/auth/') ||
      req.path.startsWith('/static/') ||
      req.method === 'GET' ||
      req.headers.authorization || // Skip for API key/Basic auth requests
      req.headers.accept === 'text/event-stream' // Skip for SSE
    ) {
      return next();
    }

    // Apply CSRF protection for web form operations
    return lusca.csrf()(req, res, next);
  };

  app.use(morganMiddleware);
  app.use(rateLimiterMiddleware());
  app.use(configAwareI18nMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Apply selective CSRF protection
  app.use(selectiveCSRF);

  app.use('/', authRoutes);

  app.use('/api/events', sseRoutes);

  app.use('/api/api-keys', apiKeyRoutes);

  app.use('/api/checksum', checksumProgressRoutes);

  // Swagger and API documentation routes
  app.use('/api', swaggerRoutes);

  // Static assets are now served at the top of the middleware stack

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

  if (configLoader.getServerConfig().enable_api_docs) {
    logger.info('API documentation enabled at /api-docs (React implementation)');
  }

  // API routes for file operations (upload, delete, etc.)
  app.use('/api/files', fileServerRoutes);

  // File server routes for directory listings and custom index.html serving
  // CRITICAL: This must come AFTER static asset serving to avoid interfering with /assets/* paths
  app.use('/', fileServerRoutes);

  // React app catch-all for client-side routing
  // Only serves React app for non-API, non-file paths that don't have custom index.html
  app.get('/*splat', (req, res, next) => {
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/auth/') ||
      req.path.startsWith('/static/') ||
      req.path.startsWith('/swagger/') ||
      req.path.startsWith('/assets/')
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
