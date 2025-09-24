import winston from 'winston';
import morgan from 'morgan';
import { promises as fs, existsSync } from 'fs';
import { join, dirname } from 'path';

let loggingConfig = {
  log_directory: '/var/log/armor',
  log_level: 'info',
  max_file_size_mb: 10,
  max_files: 5,
  enable_rotation: true,
};

// Simple log rotation function
const rotateLogFile = async (filePath, maxFiles) => {
  try {
    const archiveDir = join(dirname(filePath), 'archive');

    // Create archive directory if it doesn't exist
    try {
      await fs.mkdir(archiveDir, { recursive: true });
    } catch (error) {
      console.error(`Cannot create archive directory ${archiveDir}: ${error.message}`);
      return;
    }

    const baseName = filePath.split('/').pop();

    // Move existing numbered files
    for (let i = maxFiles - 1; i >= 1; i--) {
      const oldFile = join(archiveDir, `${baseName}.${i}`);
      const newFile = join(archiveDir, `${baseName}.${i + 1}`);

      if (existsSync(oldFile)) {
        if (i === maxFiles - 1) {
          // Delete the oldest file
          await fs.unlink(oldFile);
        } else {
          // Move file to next number
          await fs.rename(oldFile, newFile);
        }
      }
    }

    // Move current file to .1
    if (existsSync(filePath)) {
      await fs.rename(filePath, join(archiveDir, `${baseName}.1`));
    }
  } catch (error) {
    console.error(`Log rotation failed for ${filePath}: ${error.message}`);
  }
};

// Custom winston transport with rotation
class RotatingFileTransport extends winston.transports.File {
  constructor(options) {
    super(options);
    this.maxSize = (options.maxSize || 10) * 1024 * 1024; // Convert MB to bytes
    this.maxFiles = options.maxFiles || 5;
  }

  async write(info, callback) {
    try {
      // Check if file needs rotation
      if (existsSync(this.filename)) {
        const stats = await fs.stat(this.filename);
        if (stats.size >= this.maxSize) {
          await rotateLogFile(this.filename, this.maxFiles);
        }
      }
    } catch (error) {
      console.error(`Error checking log file size: ${error.message}`);
    }

    // Call parent write method
    super.write(info, callback);
  }
}

// Initialize logger with default config (will be updated later)
const createLoggerTransports = async config => {
  const transports = [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ];

  try {
    // Ensure log directory exists
    const logDir = config.log_directory;
    if (!existsSync(logDir)) {
      await fs.mkdir(logDir, { recursive: true });
    }

    // App log (general application logs)
    transports.push(
      new RotatingFileTransport({
        filename: join(logDir, 'app.log'),
        format: winston.format.json(),
        maxSize: config.max_file_size_mb,
        maxFiles: config.max_files,
      })
    );

    // Access log (HTTP requests)
    transports.push(
      new RotatingFileTransport({
        filename: join(logDir, 'access.log'),
        format: winston.format.json(),
        level: 'info',
        maxSize: config.max_file_size_mb,
        maxFiles: config.max_files,
      })
    );

    // Error log (errors only)
    transports.push(
      new RotatingFileTransport({
        filename: join(logDir, 'error.log'),
        format: winston.format.json(),
        level: 'error',
        maxSize: config.max_file_size_mb,
        maxFiles: config.max_files,
      })
    );

    console.log(`Logging configured: ${logDir} with rotation enabled`);
  } catch (error) {
    console.error(`Cannot setup file logging to ${config.log_directory}: ${error.message}`);
    console.error('Continuing with console-only logging');
  }

  return transports;
};

const logger = winston.createLogger({
  level: loggingConfig.log_level,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Function to update logger configuration after config is loaded
export const updateLoggerConfig = async newConfig => {
  loggingConfig = { ...loggingConfig, ...newConfig };

  // Clear existing transports except console
  logger.clear();

  // Add new transports
  const newTransports = await createLoggerTransports(loggingConfig);
  newTransports.forEach(transport => logger.add(transport));

  logger.info('Logger configuration updated', loggingConfig);
};

export const logAccess = (req, action, details = '') => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const path = decodeURIComponent(req.path);

  logger.info('ACCESS_LOG', {
    timestamp,
    ip,
    action,
    path,
    details,
  });
};

export const morganMiddleware = morgan('combined', {
  stream: {
    write: message => logger.info(message.trim()),
  },
});

export { logger };
export default logger;
