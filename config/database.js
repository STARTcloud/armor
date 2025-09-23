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
  });

  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    initializeFileModel(sequelize);
    initializeUserModel(sequelize);
    initializeApiKeyModel(sequelize);

    await sequelize.sync({ alter: true });
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
