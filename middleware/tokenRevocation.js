import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import configLoader from '../config/configLoader.js';
import { getRevokedTokenModel } from '../models/RevokedToken.js';
import { authLogger as logger } from '../config/logger.js';

/**
 * Middleware to check if a JWT token has been revoked
 * This runs after authentication middleware but before route handlers
 * CRITICAL: Checks both specific token JTI and user-level revocations
 */
export const checkTokenRevocation = async (req, res, next) => {
  try {
    const authConfig = configLoader.getAuthenticationConfig();

    // Skip check if backchannel logout is disabled
    if (!authConfig.backchannel_logout?.enabled) {
      return next();
    }

    const token = req.cookies?.auth_token || req.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next();
    }

    // Decode token without verification to get jti and userId/email for sub lookup
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.jti) {
      return next();
    }

    // Determine the sub identifier to check
    // For OIDC users, use sub from ID token; for basic auth, use userId/email/username
    const sub = decoded.sub || decoded.userId || decoded.email || decoded.username;

    const RevokedToken = getRevokedTokenModel();

    // Check if token is revoked by JTI OR if user has been revoked
    const revokedToken = await RevokedToken.findOne({
      where: {
        [Op.or]: [{ jti: decoded.jti }, { sub: sub?.toString() }],
      },
    });

    if (revokedToken) {
      logger.warn('Revoked token used', {
        jti: decoded.jti,
        sub,
        reason: revokedToken.revocation_reason,
        matchType: revokedToken.jti === decoded.jti ? 'jti' : 'sub',
      });

      res.clearCookie('auth_token');

      return res.status(401).json({
        success: false,
        message: 'Token has been revoked',
        error: 'token_revoked',
      });
    }

    return next();
  } catch (error) {
    logger.error('Token revocation check error', { error: error.message });
    return next();
  }
};

/**
 * Revoke all tokens for a given subject (user)
 * Used when backchannel logout receives a logout_token
 */
export const revokeUserTokens = async (sub, reason = 'backchannel_logout') => {
  const RevokedToken = getRevokedTokenModel();

  // Create a user-level revocation marker
  // This will match ANY token with this sub in the middleware check
  await RevokedToken.create({
    jti: `user-revocation-${sub}-${Date.now()}`,
    sub,
    exp: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    revocation_reason: reason,
  });

  logger.info('Created user token revocation marker', { sub, reason });
};

/**
 * Revoke a specific token by its JTI
 */
export const revokeTokenByJti = async (jti, sub, exp, reason = 'backchannel_logout') => {
  const RevokedToken = getRevokedTokenModel();

  await RevokedToken.create({
    jti,
    sub,
    exp: new Date(exp * 1000), // Convert Unix timestamp to Date
    revocation_reason: reason,
  });

  logger.info('Revoked token by JTI', { jti, sub, reason });
};

/**
 * Check if a specific JTI is revoked
 */
export const isTokenRevoked = async jti => {
  const RevokedToken = getRevokedTokenModel();

  const revokedToken = await RevokedToken.findOne({
    where: { jti },
  });

  return !!revokedToken;
};
