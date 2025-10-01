import express from 'express';
import { getApiKeyModel } from '../models/ApiKey.js';
import configLoader from '../config/configLoader.js';
import {
  generateApiKey,
  hashApiKey,
  getKeyPreview,
  validatePermissions,
  validateExpirationDate,
  isApiKeyExpired,
} from '../utils/apiKeyUtils.js';
import { getUserPermissions } from '../utils/auth.js';
import { logAccess, logger } from '../config/logger.js';
import { authenticateApiKeyAccess } from '../middleware/auth.middleware.js';

/**
 * @swagger
 * tags:
 *   name: API Keys
 *   description: API key management endpoints for programmatic access
 */

const router = express.Router();

const getCurrentUser = req => {
  if (req.oidcUser) {
    if (req.oidcUser.userId) {
      // OIDC user
      return {
        type: 'oidc',
        id: req.oidcUser.userId,
        identifier: req.oidcUser.email,
        permissions: req.oidcUser.permissions || [],
      };
    } else if (req.oidcUser.username) {
      // Local user
      const localUsers = configLoader.getAuthUsers();
      const localUser = localUsers.find(u => u.username === req.oidcUser.username);

      if (!localUser || !localUser.id) {
        throw new Error('Local user missing ID field in configuration');
      }

      return {
        type: 'local',
        id: localUser.id,
        identifier: req.oidcUser.username,
        permissions: getUserPermissions(localUser),
      };
    }
  }
  throw new Error('No authenticated user found');
};

router.use(authenticateApiKeyAccess);

/**
 * @swagger
 * /api/api-keys:
 *   get:
 *     summary: List user's API keys
 *     description: Retrieve all API keys belonging to the authenticated user
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved API keys
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
router.get('/', async (req, res) => {
  try {
    const currentUser = getCurrentUser(req);
    const ApiKey = getApiKeyModel();

    const whereClause =
      currentUser.type === 'oidc'
        ? { user_type: 'oidc', user_id: currentUser.id }
        : { user_type: 'local', local_user_id: currentUser.id };

    const apiKeys = await ApiKey.findAll({
      where: whereClause,
      attributes: [
        'id',
        'name',
        'key_preview',
        'permissions',
        'expires_at',
        'last_used',
        'created_at',
      ],
      order: [['created_at', 'DESC']],
    });

    const keysWithStatus = apiKeys.map(key => ({
      ...key.toJSON(),
      is_expired: isApiKeyExpired(key.expires_at),
    }));

    return res.json({
      success: true,
      api_keys: keysWithStatus,
    });
  } catch (error) {
    logger.error('Get API keys error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve API keys',
    });
  }
});

/**
 * @swagger
 * /api/api-keys:
 *   post:
 *     summary: Create a new API key
 *     description: Generate a new API key with specified permissions and expiration
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApiKeyRequest'
 *     responses:
 *       200:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiKeyResponse'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient permissions
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
router.post('/', async (req, res) => {
  try {
    const { name, permissions, expires_at } = req.body;

    if (!name || !permissions || !expires_at) {
      return res.status(400).json({
        success: false,
        message: 'Name, permissions, and expiration date are required',
      });
    }

    // Validate permissions
    if (!validatePermissions(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid permissions specified',
      });
    }

    // Validate expiration date
    const expirationValidation = validateExpirationDate(expires_at);
    if (!expirationValidation.valid) {
      return res.status(400).json({
        success: false,
        message: expirationValidation.error,
      });
    }

    const currentUser = getCurrentUser(req);

    // Ensure user can only assign permissions they have
    const hasAllPermissions = permissions.every(permission =>
      currentUser.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        success: false,
        message: 'Cannot assign permissions you do not have',
      });
    }

    // Generate API key
    const apiKey = generateApiKey();
    const hashedKey = await hashApiKey(apiKey);
    const keyPreview = getKeyPreview(apiKey);

    const ApiKey = getApiKeyModel();

    // Check if full key retrieval is enabled in config
    const swaggerConfig = configLoader.getSwaggerConfig();
    const isRetrievable = swaggerConfig.allow_full_key_retrieval || false;

    // Create the new API key with optional encrypted storage
    const newApiKeyData = {
      name,
      key_hash: hashedKey,
      key_preview: keyPreview,
      permissions,
      expires_at: new Date(expires_at),
      user_type: currentUser.type,
      user_id: currentUser.type === 'oidc' ? currentUser.id : null,
      local_user_id: currentUser.type === 'local' ? currentUser.id : null,
      is_retrievable: isRetrievable,
    };

    // If retrievable keys are enabled, store encrypted full key
    if (isRetrievable) {
      const crypto = await import('crypto');
      const authConfig = configLoader.getAuthenticationConfig();

      // Use modern encryption with IV
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(authConfig.jwt_secret).subarray(0, 32),
        iv
      );
      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Store IV + encrypted data
      newApiKeyData.encrypted_full_key = `${iv.toString('hex')}:${encrypted}`;
    }

    const newApiKey = await ApiKey.create(newApiKeyData);

    logAccess(req, 'API_KEY_CREATED', `name: ${name}, permissions: ${permissions.join(',')}`);

    // Return the full API key only once, on creation
    return res.json({
      success: true,
      message: 'API key created successfully',
      api_key: {
        id: newApiKey.id,
        name: newApiKey.name,
        key: apiKey, // Full key shown only once
        key_preview: keyPreview,
        permissions: newApiKey.permissions,
        expires_at: newApiKey.expires_at,
        created_at: newApiKey.created_at,
      },
    });
  } catch (error) {
    logger.error('Create API key error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to create API key',
    });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}:
 *   delete:
 *     summary: Delete an API key
 *     description: Delete a specific API key by ID
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: API key ID
 *     responses:
 *       200:
 *         description: API key deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: API key not found
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
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = getCurrentUser(req);
    const ApiKey = getApiKeyModel();

    const whereClause = {
      id: parseInt(id),
      ...(currentUser.type === 'oidc'
        ? { user_type: 'oidc', user_id: currentUser.id }
        : { user_type: 'local', local_user_id: currentUser.id }),
    };

    const apiKey = await ApiKey.findOne({ where: whereClause });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found',
      });
    }

    await apiKey.destroy();

    logAccess(req, 'API_KEY_DELETED', `id: ${id}`);

    return res.json({
      success: true,
      message: 'API key deleted successfully',
    });
  } catch (error) {
    logger.error('Delete API key error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to delete API key',
    });
  }
});

/**
 * @swagger
 * /api/api-keys/{id}:
 *   put:
 *     summary: Update an API key
 *     description: Update name and/or permissions of an existing API key
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: API key ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: New name for the API key
 *                 example: 'Updated CI Pipeline'
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [downloads, uploads, delete]
 *                 description: New permissions for the API key
 *                 example: ['downloads', 'uploads']
 *     responses:
 *       200:
 *         description: API key updated successfully
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
 *                   example: 'API key updated successfully'
 *                 api_key:
 *                   $ref: '#/components/schemas/ApiKey'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: API key not found
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
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions } = req.body;

    if (!name && !permissions) {
      return res.status(400).json({
        success: false,
        message: 'Name or permissions must be provided',
      });
    }

    if (permissions && !validatePermissions(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid permissions specified',
      });
    }

    const currentUser = getCurrentUser(req);
    const ApiKey = getApiKeyModel();

    const whereClause = {
      id: parseInt(id),
      ...(currentUser.type === 'oidc'
        ? { user_type: 'oidc', user_id: currentUser.id }
        : { user_type: 'local', local_user_id: currentUser.id }),
    };

    const apiKey = await ApiKey.findOne({ where: whereClause });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: 'API key not found',
      });
    }

    if (permissions) {
      // Ensure user can only assign permissions they have
      const hasAllPermissions = permissions.every(permission =>
        currentUser.permissions.includes(permission)
      );

      if (!hasAllPermissions) {
        return res.status(403).json({
          success: false,
          message: 'Cannot assign permissions you do not have',
        });
      }
    }

    const updateData = {};
    if (name) {
      updateData.name = name;
    }
    if (permissions) {
      updateData.permissions = permissions;
    }

    await apiKey.update(updateData);

    logAccess(req, 'API_KEY_UPDATED', `id: ${id}`);

    return res.json({
      success: true,
      message: 'API key updated successfully',
      api_key: {
        id: apiKey.id,
        name: apiKey.name,
        key_preview: apiKey.key_preview,
        permissions: apiKey.permissions,
        expires_at: apiKey.expires_at,
        last_used: apiKey.last_used,
        created_at: apiKey.created_at,
        updated_at: apiKey.updated_at,
      },
    });
  } catch (error) {
    logger.error('Update API key error', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to update API key',
    });
  }
});

export default router;
