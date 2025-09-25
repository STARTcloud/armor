import winston from 'winston';
import morgan from 'morgan';
import { promises as fs, existsSync, mkdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import configLoader from './configLoader.js';

// Load config and logging configuration immediately
configLoader.load();
const loggingConfig = configLoader.getLoggingConfig();

// Daily log rotation function
const rotateLogFile = async (filePath, maxFiles) => {
  try {
    const archiveDir = join(dirname(filePath), 'archive');

    // Create archive directory if it doesn't exist
    try {
      await fs.mkdir(archiveDir, { recursive: true });
    } catch (error) {
      return;
    }

    const baseName = filePath.split('/').pop();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const archiveName = `${baseName}.${today}`;

    // Move current file to archive with date
    if (existsSync(filePath)) {
      await fs.rename(filePath, join(archiveDir, archiveName));
    }

    // Clean up old archives (keep only max_files days)
    const archiveFiles = await fs.readdir(archiveDir);
    const logArchives = archiveFiles
      .filter(file => file.startsWith(baseName))
      .sort()
      .reverse();

    if (logArchives.length > maxFiles) {
      const filesToDelete = logArchives.slice(maxFiles);
      for (const file of filesToDelete) {
        await fs.unlink(join(archiveDir, file));
      }
    }
  } catch (error) {
    // Cannot use console.error - rotation failure is silent
  }
};

// Custom winston transport with daily rotation
class DailyRotatingFileTransport extends winston.transports.File {
  constructor(options) {
    super(options);
    this.maxFiles = options.maxFiles || 5;
    this.lastRotateDate = null;
  }

  async write(info, callback) {
    try {
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Check if we need to rotate (new day)
      if (this.lastRotateDate !== currentDate && existsSync(this.filename)) {
        await rotateLogFile(this.filename, this.maxFiles);
        this.lastRotateDate = currentDate;
      }
    } catch (error) {
      // No console.error - just continue
    }

    // Call parent write method
    super.write(info, callback);
  }
}


// Initialize logger with file transports immediately using loaded config
const transports = [
  new winston.transports.Console({
    format: winston.format.simple(),
  }),
];

// Rotate existing logs on startup
const rotateLogsOnStartup = async (logDir) => {
  const logFiles = ['app.log', 'access.log', 'database.log', 'error.log'];
  
  for (const logFile of logFiles) {
    const logPath = join(logDir, logFile);
    if (existsSync(logPath)) {
      await rotateLogFile(logPath, loggingConfig.max_files);
    }
  }
};

// Rotate logs synchronously BEFORE creating transports
const logDir = loggingConfig.log_directory;

try {
  // Ensure log directory exists synchronously
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  // Rotate existing logs synchronously before creating new transports
  const logFiles = ['app.log', 'access.log', 'database.log', 'error.log', 'filewatcher.log', 'sse.log', 'auth.log'];
  for (const logFile of logFiles) {
    const logPath = join(logDir, logFile);
    if (existsSync(logPath)) {
      try {
        const archiveDir = join(logDir, 'archive');
        if (!existsSync(archiveDir)) {
          mkdirSync(archiveDir, { recursive: true });
        }
        
        const today = new Date().toISOString().split('T')[0];
        let archiveName = `${logFile}.${today}`;
        let archivePath = join(archiveDir, archiveName);
        
        // Add incrementing number if file already exists
        let counter = 1;
        while (existsSync(archivePath)) {
          archiveName = `${logFile}.${today}.${counter}`;
          archivePath = join(archiveDir, archiveName);
          counter++;
        }
        
        renameSync(logPath, archivePath);
      } catch (error) {
        // Silent failure, save any errors to var once logger is loaded so that we can display the error using this logger!
      }
    }
  }

  // Add app.log and error.log (access.log is separate)  
  transports.push(
    new DailyRotatingFileTransport({
      filename: join(logDir, 'app.log'),
      format: winston.format.json(),
      maxFiles: loggingConfig.max_files,
    }),
    new DailyRotatingFileTransport({
      filename: join(logDir, 'error.log'),
      format: winston.format.json(),
      level: 'error',
      maxFiles: loggingConfig.max_files,
    })
  );

} catch (error) {
  // Cannot use console.error - , save any errors to var once logger is loaded so that we can display the error using this logger!
}

// Create separate loggers for different categories
const logger = winston.createLogger({
  level: loggingConfig.log_level,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports,
});

// Separate access logger for HTTP requests only
const accessLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new DailyRotatingFileTransport({
      filename: join(loggingConfig.log_directory, 'access.log'),
      format: winston.format.json(),
      level: 'info',
      maxFiles: loggingConfig.max_files,
    })
  ],
});

// Separate database logger for database operations
const databaseLogger = winston.createLogger({
  level: loggingConfig.log_level,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new DailyRotatingFileTransport({
      filename: join(loggingConfig.log_directory, 'database.log'),
      format: winston.format.json(),
      maxFiles: loggingConfig.max_files,
    })
  ],
});

// Separate file watcher logger for checksum operations
const fileWatcherLogger = winston.createLogger({
  level: loggingConfig.log_level,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new DailyRotatingFileTransport({
      filename: join(loggingConfig.log_directory, 'filewatcher.log'),
      format: winston.format.json(),
      maxFiles: loggingConfig.max_files,
    })
  ],
});

// Separate SSE logger for server-sent events
const sseLogger = winston.createLogger({
  level: loggingConfig.log_level,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new DailyRotatingFileTransport({
      filename: join(loggingConfig.log_directory, 'sse.log'),
      format: winston.format.json(),
      maxFiles: loggingConfig.max_files,
    })
  ],
});

// Separate auth logger for authentication operations
const authLogger = winston.createLogger({
  level: loggingConfig.log_level,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new DailyRotatingFileTransport({
      filename: join(loggingConfig.log_directory, 'auth.log'),
      format: winston.format.json(),
      maxFiles: loggingConfig.max_files,
    })
  ],
});

// Initialize log files with startup entries
logger.info('Application logger initialized');
accessLogger.info('Access logger initialized');
databaseLogger.info('Database logger initialized');
fileWatcherLogger.info('File watcher logger initialized');
sseLogger.info('SSE logger initialized');
authLogger.info('Auth logger initialized');

export const logAccess = (req, action, details = '') => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const path = decodeURIComponent(req.path);

  accessLogger.info('ACCESS_LOG', {
    timestamp,
    ip,
    action,
    path,
    details,
  });
};

export const morganMiddleware = morgan('combined', {
  stream: {
    write: message => accessLogger.info(message.trim()),
  },
});

export { logger, databaseLogger, fileWatcherLogger, sseLogger, authLogger };
export default logger;
