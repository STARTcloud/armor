import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import * as client from 'openid-client';
import { URL } from 'url';
import configLoader from './configLoader.js';
import { getUserModel } from '../models/User.js';
import { authLogger as logger } from './logger.js';

// Store OIDC configurations globally
const oidcConfigurations = new Map();

const matchDomain = (email, pattern) => {
  if (pattern === '*') {
    return true;
  }
  if (pattern.startsWith('*@')) {
    const domain = pattern.slice(2);
    return email.endsWith(`@${domain}`);
  }
  if (pattern.startsWith('O=')) {
    // Handle Distinguished Name organization patterns
    return email.includes(pattern);
  }
  return email === pattern;
};

const matchClaim = (userinfo, rule) => {
  const claimValue = userinfo[rule.claim];
  if (!claimValue) {
    return false;
  }

  if (Array.isArray(claimValue)) {
    return rule.values.some(value => claimValue.includes(value));
  }

  return rule.values.includes(claimValue);
};

export const resolveUserPermissions = (email, userinfo) => {
  const authConfig = configLoader.getAuthenticationConfig();
  const strategy = authConfig.permission_strategy || 'domain_based';
  const permissions = [];

  if (strategy === 'domain_based') {
    const domainMappings = authConfig.domain_mappings || {};

    // Use original email (DN) for permission matching
    const originalEmail = userinfo.email || email;

    const downloadDomains = domainMappings.downloads || [];
    if (downloadDomains.some(pattern => matchDomain(originalEmail, pattern))) {
      permissions.push('downloads');
    }

    const uploadDomains = domainMappings.uploads || [];
    if (uploadDomains.some(pattern => matchDomain(originalEmail, pattern))) {
      permissions.push('uploads');
    }

    const deleteDomains = domainMappings.delete || [];
    if (deleteDomains.some(pattern => matchDomain(originalEmail, pattern))) {
      permissions.push('delete');
    }
  } else if (strategy === 'claims_based') {
    const claimsMappings = authConfig.claims_mappings || {};

    const downloadClaims = claimsMappings.downloads || [];
    if (downloadClaims.some(rule => matchClaim(userinfo, rule))) {
      permissions.push('downloads');
    }

    const uploadClaims = claimsMappings.uploads || [];
    if (uploadClaims.some(rule => matchClaim(userinfo, rule))) {
      permissions.push('uploads');
    }
  }

  return permissions;
};

export const handleOidcUser = async (provider, userinfo) => {
  const User = getUserModel();
  let { email } = userinfo;

  // Handle DN format when no email provided using fallback_domain
  if (email && email.startsWith('CN=') && !email.includes('@')) {
    const authConfig = configLoader.getAuthenticationConfig();
    const providerConfig = authConfig.oidc_providers[provider];
    const fallbackDomain = providerConfig?.fallback_domain;

    if (fallbackDomain) {
      const cnMatch = email.match(/CN=(?<name>[^/]+)/);
      if (cnMatch) {
        const userName = cnMatch.groups.name.toLowerCase().replace(/\s+/g, '.');
        email = `${userName}@${fallbackDomain}`;

        logger.info('Converted DN to email using fallback_domain', {
          originalDN: userinfo.email,
          convertedEmail: email,
          fallbackDomain,
          provider,
        });
      }
    }
  }

  const name = userinfo.name || userinfo.given_name || userinfo.CN || email.split('@')[0];
  const subject = userinfo.sub;
  const providerKey = `oidc-${provider}`;

  let user = await User.findOne({
    where: { provider: providerKey, subject },
  });

  if (!user) {
    const permissions = resolveUserPermissions(email, userinfo);

    user = await User.create({
      email,
      name,
      provider: providerKey,
      subject,
      permissions,
      last_login: new Date(),
    });

    logger.info(`Created new OIDC user: ${email} with permissions: ${permissions.join(', ')}`);
  } else {
    const permissions = resolveUserPermissions(email, userinfo);
    await user.update({
      permissions,
      last_login: new Date(),
    });

    logger.info(`Updated OIDC user: ${email} with permissions: ${permissions.join(', ')}`);
  }

  return user;
};

// Get OIDC configuration for a provider
export const getOidcConfiguration = providerName => oidcConfigurations.get(providerName);

// Generate authorization URL for a provider
export const buildAuthorizationUrl = async (providerName, redirectUri, state, codeVerifier) => {
  const config = oidcConfigurations.get(providerName);
  if (!config) {
    throw new Error(`OIDC configuration not found for provider: ${providerName}`);
  }

  const authConfig = configLoader.getAuthenticationConfig();
  const providerConfig = authConfig.oidc_providers[providerName];

  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

  const authParams = {
    redirect_uri: redirectUri,
    scope: providerConfig.scope || 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  };

  logger.info('=== AUTHORIZATION URL DEBUG ===', {
    provider: providerName,
    clientId: providerConfig.client_id,
    authParams,
  });

  const authUrl = client.buildAuthorizationUrl(config, authParams);

  logger.info('=== GENERATED AUTHORIZATION URL ===', {
    provider: providerName,
    url: authUrl.toString(),
    clientIdInUrl: authUrl.searchParams.get('client_id'),
  });

  return authUrl;
};

// Handle OIDC callback
export const handleOidcCallback = async (providerName, currentUrl, state, codeVerifier) => {
  const config = oidcConfigurations.get(providerName);
  if (!config) {
    throw new Error(`OIDC configuration not found for provider: ${providerName}`);
  }

  try {
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      expectedState: state,
      pkceCodeVerifier: codeVerifier,
    });

    const userinfo = tokens.claims();
    const user = await handleOidcUser(providerName, userinfo);

    return { user, tokens };
  } catch (error) {
    logger.error(`OIDC callback error for ${providerName}:`, error);
    throw error;
  }
};

export const setupPassportStrategies = async () => {
  const authConfig = configLoader.getAuthenticationConfig();

  // Setup JWT strategy
  passport.use(
    'jwt',
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: authConfig.jwt_secret,
        issuer: 'file-server',
        audience: 'file-server-users',
      },
      async (payload, done) => {
        try {
          const User = getUserModel();
          const user = await User.findByPk(payload.userId);

          if (!user) {
            return done(null, false, { message: 'Invalid token - user not found' });
          }

          return done(null, {
            userId: user.id,
            email: user.email,
            name: user.name,
            provider: user.provider,
            permissions: user.permissions,
          });
        } catch (error) {
          logger.error('JWT Strategy error', { error: error.message });
          return done(error, false);
        }
      }
    )
  );

  // Setup OIDC configurations
  const oidcProviders = authConfig.oidc_providers || {};

  const providerPromises = Object.entries(oidcProviders)
    .filter(([, providerConfig]) => providerConfig.enabled)
    .filter(([providerName, providerConfig]) => {
      if (!providerConfig.issuer || !providerConfig.client_id || !providerConfig.client_secret) {
        logger.error(`Invalid OIDC provider configuration: ${providerName}`);
        return false;
      }
      return true;
    })
    .map(async ([providerName, providerConfig]) => {
      try {
        logger.info(`Setting up OIDC provider: ${providerName}`);

        const authMethod = providerConfig.token_endpoint_auth_method || 'client_secret_basic';
        logger.info(`Using auth method: ${authMethod} for provider: ${providerName}`);

        // Create custom fetch function for debugging and Basic auth fix
        const customFetch = async (url, options = {}) => {
          // Fix Basic auth URL encoding bug for token endpoint requests
          if (url.toString().includes('/token') && authMethod === 'client_secret_basic') {
            const credentials = `${providerConfig.client_id}:${providerConfig.client_secret}`;
            const base64Credentials = Buffer.from(credentials, 'utf-8').toString('base64');

            logger.info('=== CUSTOM BASIC AUTH FIX ===', {
              originalCredentials: credentials,
              base64Encoded: base64Credentials,
              authHeader: `Basic ${base64Credentials}`,
            });

            options.headers = {
              ...options.headers,
              authorization: `Basic ${base64Credentials}`,
            };
          }

          // Debug logging
          logger.debug('=== DEBUGGING OUTGOING HTTP REQUEST ===', {
            url: url.toString(),
            method: options.method || 'GET',
            headers: options.headers || {},
            hasBody: !!options.body,
            bodyPreview: options.body ? options.body.toString().substring(0, 200) : null,
          });

          // Special attention to Authorization header
          if (options.headers?.authorization || options.headers?.Authorization) {
            const authHeader = options.headers.authorization || options.headers.Authorization;
            logger.info('=== AUTHORIZATION HEADER DETAILS ===', {
              authHeader,
              isBasic: authHeader.startsWith('Basic '),
              length: authHeader.length,
            });

            if (authHeader.startsWith('Basic ')) {
              const base64Part = authHeader.substring(6);
              try {
                const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
                logger.info('=== DECODED BASIC AUTH ===', {
                  base64: base64Part,
                  decoded,
                  expectedPattern: 'downloads:clientsecret',
                });
              } catch (decodeError) {
                logger.error('=== BASIC AUTH DECODE ERROR ===', { error: decodeError.message });
              }
            }
          }

          // Call the actual fetch
          const response = await fetch(url, options);

          logger.info('=== HTTP RESPONSE ===', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
          });

          return response;
        };

        // Create standard client authentication method
        let clientAuth;
        switch (authMethod) {
          case 'client_secret_basic':
            clientAuth = client.ClientSecretBasic(providerConfig.client_secret);
            break;
          case 'client_secret_post':
            clientAuth = client.ClientSecretPost(providerConfig.client_secret);
            break;
          case 'none':
            clientAuth = client.None();
            break;
          default:
            clientAuth = client.ClientSecretBasic(providerConfig.client_secret);
        }

        // Discover issuer and create configuration with custom fetch
        const config = await client.discovery(
          new URL(providerConfig.issuer),
          providerConfig.client_id,
          providerConfig.client_secret,
          clientAuth,
          {
            [client.customFetch]: customFetch,
          }
        );

        // Store configuration for later use
        oidcConfigurations.set(providerName, config);

        logger.info(`OIDC provider configured: ${providerName}`);
        return { success: true, provider: providerName };
      } catch (error) {
        logger.error(`Failed to setup OIDC provider ${providerName}:`, {
          message: error.message,
          stack: error.stack,
          cause: error.cause,
          name: error.name,
          code: error.code,
        });
        return { success: false, provider: providerName, error };
      }
    });

  await Promise.allSettled(providerPromises);
};

export default passport;
