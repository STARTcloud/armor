import winston from 'winston';
import morgan from 'morgan';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new winston.transports.File({
      filename: 'app.log',
      format: winston.format.json(),
    }),
  ],
});

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
