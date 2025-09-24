import { Sequelize } from 'sequelize';
import configLoader from './configLoader.js';
import logger from './logger.js';
import { initializeFileModel } from '../models/File.js';
import { initializeUserModel } from '../models/User.js';
import { initializeApiKeyModel } from '../models/ApiKey.js';

let sequelize = null;

export const initializeDatabase = async () => {
  const dbConfig = configLoader.getDatabaseConfig();

  sequelize = new Sequelize({
    dialect: dbConfig.dialect,
    storage: dbConfig.storage,
    logging: dbConfig.logging ? msg => logger.info(msg) : false,
    define: {
      timestamps: true,
      underscored: true,
    },
    dialectOptions: {
      pragma: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: -128 * 1024, // 128MB in negative KB
        temp_store: 'MEMORY',
        mmap_size: 512 * 1024 * 1024, // 512MB
        busy_timeout: 30000,
        wal_autocheckpoint: 1000,
        foreign_keys: 'ON',
      },
    },
    retry: {
      match: [/SQLITE_BUSY/, /SQLITE_LOCKED/],
      max: 5,
      backoffBase: 100,
      backoffExponent: 1.5,
    },
    pool: {
      max: 10,
      min: 2,
      acquire: 60000,
      idle: 30000,
      evict: 5000,
    },
  });

  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    initializeFileModel(sequelize);
    initializeUserModel(sequelize);
    initializeApiKeyModel(sequelize);

    await sequelize.sync({ alter: false });
    logger.info('Database synchronized');

    return sequelize;
  } catch (error) {
    logger.error(`Unable to connect to database: ${error.message}`);
    throw error;
  }
};

export const getDatabase = () => {
  if (!sequelize) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return sequelize;
};

export default sequelize;
