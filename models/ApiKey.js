import { DataTypes } from 'sequelize';

let ApiKey = null;

export const initializeApiKeyModel = sequelize => {
  ApiKey = sequelize.define(
    'ApiKey',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Human-readable name for the API key',
      },
      key_hash: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Hashed API key for secure storage',
      },
      key_preview: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'First 8 characters of key for display purposes',
      },
      encrypted_full_key: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Encrypted full API key (only stored when allow_full_key_retrieval is enabled)',
      },
      is_retrievable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the full key can be retrieved (set during creation based on config)',
      },
      permissions: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of permissions: ["downloads", "uploads", "delete"]',
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Expiration date for the API key',
      },
      last_used: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Last time this API key was used for authentication',
      },
      user_type: {
        type: DataTypes.ENUM('oidc', 'local'),
        allowNull: false,
        comment: 'Type of user who owns this key',
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'OIDC user ID from oidc_users table',
      },
      local_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Local user ID from config.yaml config',
      },
    },
    {
      tableName: 'api_keys',
      indexes: [
        {
          fields: ['key_hash'],
          unique: true,
        },
        {
          fields: ['user_type', 'user_id'],
        },
        {
          fields: ['user_type', 'local_user_id'],
        },
        {
          fields: ['expires_at'],
        },
      ],
    }
  );

  return ApiKey;
};

export const getApiKeyModel = () => {
  if (!ApiKey) {
    throw new Error('ApiKey model not initialized. Call initializeApiKeyModel() first.');
  }
  return ApiKey;
};

export default ApiKey;
