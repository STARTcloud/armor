import { Sequelize } from 'sequelize';
import configLoader from './configLoader.js';
import { databaseLogger } from './logger.js';
import { initializeFileModel } from '../models/File.js';
import { initializeUserModel } from '../models/User.js';
import { initializeApiKeyModel } from '../models/ApiKey.js';

let sequelize = null;

export const initializeDatabase = async () => {
  const dbConfig = configLoader.getDatabaseConfig();

  const sequelizeConfig = {
    dialect: dbConfig.dialect,
    logging: dbConfig.logging ? msg => databaseLogger.info(msg) : false,
    define: {
      timestamps: true,
      underscored: true,
    },
    pool: {
      max: 10,
      min: 2,
      acquire: 60000,
      idle: 30000,
      evict: 5000,
    },
  };

  if (dbConfig.dialect === 'sqlite') {
    sequelizeConfig.storage = dbConfig.storage;
    sequelizeConfig.dialectOptions = {
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
    };
    sequelizeConfig.retry = {
      match: [/SQLITE_BUSY/, /SQLITE_LOCKED/],
      max: 5,
      backoffBase: 100,
      backoffExponent: 1.5,
    };
  } else if (dbConfig.dialect === 'postgres') {
    sequelizeConfig.host = dbConfig.host || 'localhost';
    sequelizeConfig.port = dbConfig.port || 5432;
    sequelizeConfig.database = dbConfig.database;
    sequelizeConfig.username = dbConfig.username;
    sequelizeConfig.password = dbConfig.password;
    sequelizeConfig.dialectOptions = {
      ssl: dbConfig.ssl || false,
    };
  } else if (dbConfig.dialect === 'mysql') {
    sequelizeConfig.host = dbConfig.host || 'localhost';
    sequelizeConfig.port = dbConfig.port || 3306;
    sequelizeConfig.database = dbConfig.database;
    sequelizeConfig.username = dbConfig.username;
    sequelizeConfig.password = dbConfig.password;
    sequelizeConfig.dialectOptions = {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    };
  }

  sequelize = new Sequelize(sequelizeConfig);

  try {
    await sequelize.authenticate();
    databaseLogger.info('Database connection established successfully');

    initializeFileModel(sequelize);
    initializeUserModel(sequelize);
    initializeApiKeyModel(sequelize);

    await sequelize.sync({ alter: false });
    databaseLogger.info('Database synchronized');

    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA optimize=0x10002');
      databaseLogger.info('SQLite optimization pragmas applied');
    }

    return sequelize;
  } catch (error) {
    databaseLogger.error(`Unable to connect to database: ${error.message}`);
    throw error;
  }
};

export const getDatabase = () => {
  if (!sequelize) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return sequelize;
};

export const optimizeDatabase = async () => {
  if (!sequelize) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }

  try {
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA optimize');
      databaseLogger.info('SQLite database optimization completed');
    } else if (sequelize.getDialect() === 'postgres') {
      await sequelize.query('ANALYZE');
      databaseLogger.info('PostgreSQL database analysis completed');
    } else if (sequelize.getDialect() === 'mysql') {
      await sequelize.query('ANALYZE TABLE files');
      databaseLogger.info('MySQL table analysis completed');
    }
  } catch (error) {
    databaseLogger.error(`Database optimization failed: ${error.message}`);
  }
};

export default sequelize;
