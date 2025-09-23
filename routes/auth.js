import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import configLoader from '../config/configLoader.js';
import { isValidUser, getUserPermissions } from '../utils/auth.js';
import { logAccess, logger } from '../config/logger.js';
import { generateLoginPage } from '../utils/loginPage.js';

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: User authentication and session management endpoints
 */

const router = express.Router();

router.get('/login', (req, res) => {
  const errorParam = req.query.error;
  let errorMessage = '';

  switch (errorParam) {
    case 'invalid_credentials':
      errorMessage = 'Invalid username or password';
      break;
    case 'oidc_failed':
      errorMessage = 'OIDC authentication failed. Please try again or use basic authentication.';
      break;
    case 'network_error':
      errorMessage = 'Network error occurred. Please try again.';
      break;
    case 'token_failed':
      errorMessage = 'Failed to generate authentication token';
      break;
    case 'no_oidc_providers':
      errorMessage = 'No OIDC providers are configured';
      break;
  }

  // Get login page configuration from config loader
  const serverConfig = configLoader.getServerConfig();
  const loginConfig = {
    title: serverConfig.login_title || 'Armor',
    subtitle: serverConfig.login_subtitle || 'ARMOR Reliably Manages Online Resources',
    iconClass: serverConfig.login_icon_class || 'bi bi-cloud-download',
    iconUrl: serverConfig.login_icon_url || null,
    primaryColor: serverConfig.login_primary_color || '#198754', // Use Armor green
    oidcButtonStyle: serverConfig.oidc_button_style || 'btn-outline-success', // Match primary color
  };

  const html = generateLoginPage(errorMessage, loginConfig);
  return res.send(html);
});

/**
 * @swagger
 * /auth/methods:
 *   get:
 *     summary: Get available authentication methods
 *     description: Retrieve list of enabled authentication methods including basic auth and OIDC providers
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Successfully retrieved authentication methods
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 methods:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Unique identifier for the auth method
 *                         example: basic
 *                       name:
 *                         type: string
 *                         description: Display name for the auth method
 *                         example: Username/Password
 *                       enabled:
 *                         type: boolean
 *                         description: Whether this method is available
 *                         example: true
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/auth/methods', (req, res) => {
  try {
    const authConfig = configLoader.getAuthenticationConfig();
    const methods = [
      {
        id: 'basic',
        name: 'Username/Password',
        enabled: true,
      },
    ];

    const oidcProviders = authConfig.oidc_providers || {};
    const oidcMethods = Object.entries(oidcProviders)
      .filter(([, providerConfig]) => providerConfig.enabled)
      .map(([providerName, providerConfig]) => ({
        id: `oidc-${providerName}`,
        name: providerConfig.display_name || `Sign in with ${providerName}`,
        enabled: true,
      }));

    methods.push(...oidcMethods);

    return res.json({
      success: true,
      methods,
    });
  } catch (error) {
    logger.error('Auth methods error', { error: error.message });
    logAccess(req, 'AUTH_METHODS_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to load authentication methods',
    });
  }
});

router.get('/auth/oidc/callback', (req, res, next) => {
  logger.info('OIDC callback received', {
    sessionId: req.sessionID,
    hasSession: !!req.session,
    sessionKeys: req.session ? Object.keys(req.session) : [],
  });

  const provider = req.session?.oidcProvider;

  logger.info('OIDC callback provider resolution', {
    provider,
    sessionProvider: req.session?.oidcProvider,
  });

  if (!provider) {
    logger.error('No provider found in session during OIDC callback');
    return res.redirect('/login?error=oidc_failed');
  }

  if (req.session) {
    delete req.session.oidcProvider;
  }

  const strategyName = `oidc-${provider}`;
  logger.info(`Using OIDC strategy: ${strategyName}`);

  return passport.authenticate(strategyName, { session: false }, (err, user) => {
    if (err) {
      logger.error('OIDC callback authentication error', {
        error: err.message,
        provider,
        strategyName,
      });
      logAccess(req, 'OIDC_CALLBACK_ERROR', err.message);
      return res.redirect('/login?error=oidc_failed');
    }

    if (!user) {
      logger.error('OIDC callback: no user returned', { provider, strategyName });
      logAccess(req, 'OIDC_CALLBACK_NOUSER', 'no user returned');
      return res.redirect('/login?error=oidc_failed');
    }

    try {
      const authConfig = configLoader.getAuthenticationConfig();
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          name: user.name,
          provider: user.provider,
          permissions: user.permissions,
        },
        authConfig.jwt_secret,
        {
          expiresIn: authConfig.jwt_expiration,
          issuer: 'file-server',
          audience: 'file-server-users',
        }
      );

      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: true,
        maxAge: 24 * 60 * 60 * 1000,
      });

      logger.info('OIDC authentication completed successfully', { email: user.email, provider });
      logAccess(req, 'OIDC_SUCCESS', `user: ${user.email}`);
      return res.redirect('/');
    } catch (tokenError) {
      logger.error('JWT token generation error', { error: tokenError.message, provider });
      logAccess(req, 'JWT_ERROR', tokenError.message);
      return res.redirect('/login?error=token_failed');
    }
  })(req, res, next);
});

router.get('/auth/oidc/:provider', (req, res, next) => {
  const { provider } = req.params;
  const strategyName = `oidc-${provider}`;

  if (req.session) {
    req.session.oidcProvider = provider;
    logger.info(`Stored provider in session: ${provider}`);
  } else {
    logger.error('No session available to store OIDC provider');
  }

  logger.info(`Starting OIDC auth with strategy: ${strategyName}`);
  logAccess(req, 'OIDC_START', `provider: ${provider}`);

  return passport.authenticate(strategyName)(req, res, next);
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Clear authentication token and logout the user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout successful
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
 *                   example: Logged out successfully
 */
router.post('/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  logAccess(req, 'LOGOUT', 'JWT cookie cleared');
  return res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * @swagger
 * /auth/login/basic:
 *   post:
 *     summary: Basic authentication login
 *     description: Authenticate using username and password to receive JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username for authentication
 *                 example: admin
 *               password:
 *                 type: string
 *                 description: Password for authentication
 *                 example: admin123
 *     responses:
 *       200:
 *         description: Login successful
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
 *                   example: Login successful
 *       400:
 *         description: Missing username or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/auth/login/basic', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password required',
    });
  }

  const credentials = { name: username, pass: password };
  const user = isValidUser(credentials);

  if (!user) {
    logAccess(req, 'BASIC_AUTH_FAILED', `username: ${username}`);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }

  const permissions = getUserPermissions(user);

  const authConfig = configLoader.getAuthenticationConfig();
  const token = jwt.sign(
    {
      username: user.username,
      role: user.role,
      permissions,
      authType: 'basic',
    },
    authConfig.jwt_secret,
    {
      expiresIn: authConfig.jwt_expiration,
      issuer: 'file-server',
      audience: 'file-server-users',
    }
  );

  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: true,
    maxAge: 24 * 60 * 60 * 1000,
  });

  logAccess(
    req,
    'BASIC_AUTH_SUCCESS',
    `username: ${username}, role: ${user.role}, permissions: ${permissions.join(',')}`
  );

  return res.json({
    success: true,
    message: 'Login successful',
  });
});

router.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  logAccess(req, 'LOGOUT', 'JWT cookie cleared via GET');
  return res.redirect('/login');
});

router.get('/web/static/images/favicon.ico', (req, res) => {
  logger.debug('Serving favicon', { ip: req.ip, userAgent: req.get('User-Agent') });
  res.set('Cache-Control', 'public, max-age=86400');
  return res.sendFile('/web/static/images/favicon.ico', { root: '.' });
});

export default router;
