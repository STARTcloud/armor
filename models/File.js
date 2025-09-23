import { DataTypes } from 'sequelize';

let File = null;

export const initializeFileModel = sequelize => {
  File = sequelize.define(
    'File',
    {
      file_path: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
      },
      checksum_sha256: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: 'checksum_sha256',
      },
      file_size: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      last_modified: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      checksum_generated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      checksum_status: {
        type: DataTypes.ENUM('pending', 'generating', 'complete', 'error'),
        defaultValue: 'pending',
        allowNull: false,
      },
      is_directory: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
    },
    {
      tableName: 'files',
      indexes: [
        {
          fields: ['file_path'],
        },
        {
          fields: ['checksum_status'],
        },
        {
          fields: ['is_directory'],
        },
      ],
    }
  );

  return File;
};

export const getFileModel = () => {
  if (!File) {
    throw new Error('File model not initialized. Call initializeFileModel() first.');
  }
  return File;
};

export default File;
