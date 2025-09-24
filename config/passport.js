import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as OidcStrategy } from 'openid-client/passport';
import * as client from 'openid-client';
import { URL } from 'url';
import configLoader from './configLoader.js';
import { getUserModel } from '../models/User.js';
import logger from './logger.js';

const matchDomain = (email, pattern) => {
  if (pattern === '*') {
    return true;
  }
  if (pattern.startsWith('*@')) {
    const domain = pattern.slice(2);
    return email.endsWith(`@${domain}`);
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

    const downloadDomains = domainMappings.downloads || [];
    if (downloadDomains.some(pattern => matchDomain(email, pattern))) {
      permissions.push('downloads');
    }

    const uploadDomains = domainMappings.uploads || [];
    if (uploadDomains.some(pattern => matchDomain(email, pattern))) {
      permissions.push('uploads');
    }

    // Check delete permissions
    const deleteDomains = domainMappings.delete || [];
    if (deleteDomains.some(pattern => matchDomain(email, pattern))) {
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
  const { email } = userinfo;
  const name = userinfo.name || userinfo.given_name || email.split('@')[0];
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

export const setupPassportStrategies = async () => {
  const authConfig = configLoader.getAuthenticationConfig();
  const serverConfig = configLoader.getServerConfig();

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

        const oidcConfig = await client.discovery(
          new URL(providerConfig.issuer),
          providerConfig.client_id,
          providerConfig.client_secret,
          {
            token_endpoint_auth_method: providerConfig.token_endpoint_auth_method || 'client_secret_basic',
          }
        );

        const strategyName = `oidc-${providerName}`;
        const callbackUrl = `https://${serverConfig.domain}:${serverConfig.port}/auth/oidc/callback`;

        passport.use(
          strategyName,
          new OidcStrategy(
            {
              name: strategyName,
              config: oidcConfig,
              scope: providerConfig.scope || 'openid profile email',
              callbackURL: callbackUrl,
            },
            async (tokens, verified) => {
              try {
                const userinfo = tokens.claims();
                logger.info(`OIDC authentication successful for provider: ${providerName}`);

                const result = await handleOidcUser(providerName, userinfo);
                return verified(null, result);
              } catch (error) {
                logger.error(`OIDC Strategy error for ${providerName}:`, error.message);
                return verified(error, false);
              }
            }
          )
        );

        logger.info(`OIDC provider configured: ${providerName}`);
        return { success: true, provider: providerName };
      } catch (error) {
        logger.error(`Failed to setup OIDC provider ${providerName}:`, error.message);
        return { success: false, provider: providerName, error };
      }
    });

  await Promise.allSettled(providerPromises);
};

export default passport;
