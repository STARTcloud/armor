import { DataTypes } from 'sequelize';

let User = null;

export const initializeUserModel = sequelize => {
  User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmailOrDN(value) {
            // Allow email format or Distinguished Name format
            if (value.includes('@') || value.startsWith('CN=')) {
              return true;
            }
            throw new Error('Must be an email address or Distinguished Name');
          },
        },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      provider: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'OIDC provider identifier (e.g., oidc-google)',
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'OIDC sub claim - unique per provider',
      },
      permissions: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        comment: 'Array of permissions: ["downloads", "uploads"]',
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'user',
        comment: 'User role: "user" or "admin"',
      },
      last_login: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'oidc_users',
      indexes: [
        {
          unique: true,
          fields: ['provider', 'subject'],
        },
        {
          fields: ['email'],
        },
      ],
    }
  );

  return User;
};

export const getUserModel = () => {
  if (!User) {
    throw new Error('User model not initialized. Call initializeUserModel() first.');
  }
  return User;
};

export default User;
