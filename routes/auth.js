import express from 'express';
import jwt from 'jsonwebtoken';
import * as client from 'openid-client';
import configLoader from '../config/configLoader.js';
import { isValidUser, getUserPermissions } from '../utils/auth.js';
import { logAccess, authLogger as logger } from '../config/logger.js';
import { generateLoginPage } from '../utils/loginPage.js';
import {
  buildAuthorizationUrl,
  handleOidcCallback,
  buildEndSessionUrl,
} from '../config/passport.js';

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: User authentication and session management endpoints
 */

const router = express.Router();

router.get('/login', (req, res) => {
  const errorParam = req.query.error;
  const logoutParam = req.query.logout;
  const oidcProviderParam = req.query.oidc_provider;
  const authMethodParam = req.query.auth_method;
  let errorMessage = '';

  if (logoutParam === 'success') {
    errorMessage = 'You have been successfully logged out.';
  } else {
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
      case 'logout_failed':
        errorMessage = 'Logout failed. Please try again.';
        break;
    }
  }

  // Get login page configuration from config loader
  const serverConfig = configLoader.getServerConfig();
  const packageInfo = configLoader.getPackageInfo();

  // Determine title based on config
  let pageTitle;
  if (serverConfig.login_title !== undefined) {
    pageTitle = serverConfig.login_title;
  } else if (serverConfig.login_icon_url) {
    pageTitle = '';
  } else {
    pageTitle = 'Armor';
  }

  const loginConfig = {
    title: pageTitle,
    subtitle: serverConfig.login_subtitle || 'ARMOR Reliably Manages Online Resources',
    iconClass: serverConfig.login_icon_class || 'bi bi-cloud-download',
    iconUrl: serverConfig.login_icon_url || null,
    primaryColor: serverConfig.login_primary_color || '#198754', // Use Armor green
    packageInfo,
    oidcProvider: oidcProviderParam,
    authMethod: authMethodParam,
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
    const oidcProviderParam = req.query.oidc_provider;
    const authMethodParam = req.query.auth_method;

    const methods = [];

    const isBasicHidden = authConfig.basic_auth_hidden || false;
    const shouldShowBasic = authMethodParam === 'basic' || !isBasicHidden;

    if (shouldShowBasic) {
      methods.push({
        id: 'basic',
        name: 'Username/Password',
        enabled: true,
      });
    }

    const oidcProviders = authConfig.oidc_providers || {};
    const isGloballyHidden = authConfig.oidc_global_hidden || false;

    const oidcMethods = Object.entries(oidcProviders)
      .filter(([, providerConfig]) => providerConfig.enabled)
      .filter(([providerName, providerConfig]) => {
        if (oidcProviderParam) {
          return providerName === oidcProviderParam;
        }

        if (isGloballyHidden) {
          return false;
        }

        if (providerConfig.hidden) {
          return false;
        }

        return true;
      })
      .map(([providerName, providerConfig]) => ({
        id: `oidc-${providerName}`,
        name: providerConfig.display_name || `Sign in with ${providerName}`,
        enabled: true,
        color: providerConfig.color || '#198754',
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

router.get('/auth/oidc/callback', async (req, res) => {
  logger.info('OIDC callback received', {
    sessionId: req.sessionID,
    hasSession: !!req.session,
    sessionKeys: req.session ? Object.keys(req.session) : [],
  });

  const provider = req.session?.oidcProvider;
  const state = req.session?.oidcState;
  const codeVerifier = req.session?.oidcCodeVerifier;
  const returnUrl = req.session?.oidcReturnUrl || '/';

  logger.info('OIDC callback provider resolution', {
    provider,
    hasState: !!state,
    hasCodeVerifier: !!codeVerifier,
    returnUrl,
  });

  if (!provider || !state || !codeVerifier) {
    logger.error('Missing OIDC session data during callback');
    return res.redirect('/login?error=oidc_failed');
  }

  // Clean up session data
  if (req.session) {
    delete req.session.oidcProvider;
    delete req.session.oidcState;
    delete req.session.oidcCodeVerifier;
    delete req.session.oidcReturnUrl;
  }

  try {
    logger.info(`Processing OIDC callback for provider: ${provider}`);

    // Create current URL from request
    const serverConfig = configLoader.getServerConfig();
    // Don't include port 443 for HTTPS as it's the default
    const baseUrl =
      serverConfig.port === 443
        ? `https://${serverConfig.domain}`
        : `https://${serverConfig.domain}:${serverConfig.port}`;
    const currentUrl = new URL(baseUrl + req.url);

    // Handle the callback using v6 API
    const { user, tokens } = await handleOidcCallback(provider, currentUrl, state, codeVerifier);

    // Generate JWT token
    const authConfig = configLoader.getAuthenticationConfig();
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider,
        permissions: user.permissions,
        role: user.role,
        id_token: tokens?.id_token,
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
    return res.redirect(returnUrl);
  } catch (error) {
    logger.error('OIDC callback authentication error', {
      error: error.message,
      provider,
    });
    logAccess(req, 'OIDC_CALLBACK_ERROR', error.message);
    return res.redirect('/login?error=oidc_failed');
  }
});

router.get('/auth/oidc/:provider', async (req, res) => {
  const { provider } = req.params;

  try {
    logger.info(`Starting OIDC auth with provider: ${provider}`);
    logAccess(req, 'OIDC_START', `provider: ${provider}`);

    // Extract return URL from request query parameters
    const returnUrl = req.query.return ? decodeURIComponent(req.query.return) : '/';

    logger.info('OIDC return URL extraction', { queryReturn: req.query.return, returnUrl });

    // Generate security parameters
    const state = client.randomState();
    const codeVerifier = client.randomPKCECodeVerifier();

    // Store in session
    if (req.session) {
      req.session.oidcProvider = provider;
      req.session.oidcState = state;
      req.session.oidcCodeVerifier = codeVerifier;
      req.session.oidcReturnUrl = returnUrl;
      logger.info(`Stored OIDC session data for provider: ${provider}, returnUrl: ${returnUrl}`);
    } else {
      logger.error('No session available to store OIDC data');
      return res.redirect('/login?error=oidc_failed');
    }

    // Generate authorization URL
    const serverConfig = configLoader.getServerConfig();
    // Don't include port 443 for HTTPS as it's the default
    const redirectUri =
      serverConfig.port === 443
        ? `https://${serverConfig.domain}/auth/oidc/callback`
        : `https://${serverConfig.domain}:${serverConfig.port}/auth/oidc/callback`;

    const authUrl = await buildAuthorizationUrl(provider, redirectUri, state, codeVerifier);

    logger.info(`Redirecting to authorization URL for provider: ${provider}`);
    return res.redirect(authUrl.toString());
  } catch (error) {
    logger.error(`Failed to start OIDC auth for provider ${provider}:`, error.message);
    logAccess(req, 'OIDC_START_ERROR', error.message);
    return res.redirect('/login?error=oidc_failed');
  }
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
  try {
    // Extract JWT token to determine authentication method
    const token = req.cookies.auth_token;
    let userProvider = null;
    let idToken = null;

    if (token) {
      try {
        const authConfig = configLoader.getAuthenticationConfig();
        const decoded = jwt.verify(token, authConfig.jwt_secret);
        userProvider = decoded.provider;
        idToken = decoded.id_token;
      } catch (jwtError) {
        logger.warn('Failed to decode JWT token during logout', { error: jwtError.message });
      }
    }

    res.clearCookie('auth_token');
    logAccess(req, 'LOGOUT', 'JWT cookie cleared');

    if (userProvider && userProvider.startsWith('oidc-')) {
      const providerName = userProvider.replace('oidc-', '');

      try {
        const serverConfig = configLoader.getServerConfig();
        const postLogoutRedirectUri =
          serverConfig.port === 443
            ? `https://${serverConfig.domain}/login?logout=success`
            : `https://${serverConfig.domain}:${serverConfig.port}/login?logout=success`;

        const state = client.randomState();

        const endSessionUrl = buildEndSessionUrl(
          providerName,
          postLogoutRedirectUri,
          state,
          idToken
        );

        if (endSessionUrl) {
          logger.info(`Redirecting to OIDC provider logout: ${providerName}`);
          return res.json({
            success: true,
            message: 'Logged out successfully',
            redirect_url: endSessionUrl.toString(),
          });
        }
      } catch (error) {
        logger.error(`Failed to build end session URL for provider ${providerName}:`, {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code,
          cause: error.cause,
        });
      }
    }

    return res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
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
  try {
    // Extract JWT token to determine authentication method
    const token = req.cookies.auth_token;
    let userProvider = null;
    let idToken = null;

    if (token) {
      try {
        const authConfig = configLoader.getAuthenticationConfig();
        const decoded = jwt.verify(token, authConfig.jwt_secret);
        userProvider = decoded.provider;
        idToken = decoded.id_token;
      } catch (jwtError) {
        logger.warn('Failed to decode JWT token during logout', { error: jwtError.message });
      }
    }

    res.clearCookie('auth_token');
    logAccess(req, 'LOGOUT', 'JWT cookie cleared via GET');

    if (userProvider && userProvider.startsWith('oidc-')) {
      const providerName = userProvider.replace('oidc-', '');

      try {
        const serverConfig = configLoader.getServerConfig();
        const postLogoutRedirectUri =
          serverConfig.port === 443
            ? `https://${serverConfig.domain}/login?logout=success`
            : `https://${serverConfig.domain}:${serverConfig.port}/login?logout=success`;

        const state = client.randomState();

        const endSessionUrl = buildEndSessionUrl(
          providerName,
          postLogoutRedirectUri,
          state,
          idToken
        );

        if (endSessionUrl) {
          logger.info(`Redirecting to OIDC provider logout: ${providerName}`);
          return res.redirect(endSessionUrl.toString());
        }
      } catch (error) {
        logger.error(`Failed to build end session URL for provider ${providerName}:`, {
          message: error.message,
          stack: error.stack,
          name: error.name,
          code: error.code,
          cause: error.cause,
        });
      }
    }

    return res.redirect('/login');
  } catch (error) {
    logger.error('Logout error', { error: error.message });
    return res.redirect('/login?error=logout_failed');
  }
});

/**
 * @swagger
 * /logout/local:
 *   get:
 *     summary: Local logout only (skips OIDC provider logout)
 *     description: Clears local JWT token without redirecting to OIDC provider logout endpoint
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirected to login page
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: /login?logout=success
 */
router.get('/logout/local', (req, res) => {
  try {
    res.clearCookie('auth_token');
    logAccess(req, 'LOCAL_LOGOUT', 'JWT cookie cleared via local logout');
    return res.redirect('/login?logout=success');
  } catch (error) {
    logger.error('Local logout error', { error: error.message });
    return res.redirect('/login?error=logout_failed');
  }
});

/**
 * @swagger
 * /auth/logout/local:
 *   post:
 *     summary: Local logout only (skips OIDC provider logout)
 *     description: Clears local JWT token without redirecting to OIDC provider logout endpoint
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Local logout successful
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
 *                   example: Logged out locally
 *       500:
 *         description: Logout failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/auth/logout/local', (req, res) => {
  try {
    res.clearCookie('auth_token');
    logAccess(req, 'LOCAL_LOGOUT', 'JWT cookie cleared via local logout POST');
    return res.json({
      success: true,
      message: 'Logged out locally',
    });
  } catch (error) {
    logger.error('Local logout error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Local logout failed',
    });
  }
});

router.get('/web/public/images/favicon.ico', (req, res) => {
  logger.debug('Serving favicon', { ip: req.ip, userAgent: req.get('User-Agent') });
  res.set('Cache-Control', 'public, max-age=86400');
  return res.sendFile('/web/public/images/favicon.ico', { root: '.' });
});

router.get('/robots.txt', (req, res) => {
  logger.debug('Serving robots.txt', { ip: req.ip, userAgent: req.get('User-Agent') });
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Content-Type', 'text/plain');
  return res.sendFile('/web/public/robots.txt', { root: '.' });
});

export default router;
