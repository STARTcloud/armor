import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import configLoader from '../config/configLoader.js';
import { specs } from '../config/swagger.js';
import { getApiKeyModel } from '../models/ApiKey.js';
import { getUserPermissions } from '../utils/auth.js';
import { generateApiKey } from '../utils/apiKeyUtils.js';
import { logger } from '../config/logger.js';
import { getSupportedLocales, getDefaultLocale } from '../config/i18n.js';

const router = express.Router();

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
router.get('/user-api-keys', async (req, res) => {
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
router.post('/user-api-keys/:id/full', async (req, res) => {
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
router.post('/user-api-keys/temp', (req, res) => {
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
router.get('/swagger.json', (req, res) => {
  logger.debug('Serving OpenAPI spec for React Swagger UI', { path: req.path });
  res.json(specs);
});

/**
 * @swagger
 * /api/i18n/languages:
 *   get:
 *     summary: Get available languages
 *     description: Returns the list of available languages that have been auto-detected from translation files in the system
 *     tags: [Internationalization]
 *     responses:
 *       200:
 *         description: Available languages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 languages:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Array of available language codes
 *                   example: ['en', 'es', 'fr']
 *                 defaultLanguage:
 *                   type: string
 *                   description: Default language code used as fallback
 *                   example: 'en'
 *       500:
 *         description: Error retrieving language information (fallback response)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 languages:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Fallback language array
 *                   example: ['en']
 *                 defaultLanguage:
 *                   type: string
 *                   description: Fallback default language
 *                   example: 'en'
 */
router.get('/i18n/languages', (req, res) => {
  try {
    logger.debug('i18n languages requested', { path: req.path });
    res.json({
      success: true,
      languages: getSupportedLocales(),
      defaultLanguage: getDefaultLocale(),
    });
  } catch (error) {
    logger.error('Failed to get i18n languages', { error: error.message });
    res.json({
      success: false,
      languages: [],
      defaultLanguage: undefined,
    });
  }
});

export default router;
