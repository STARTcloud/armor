import { logAccess, logger } from '../config/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('Express error handler', { error: err.message, stack: err.stack });

  if (req) {
    logAccess(req, 'ERROR', err.message);
  }

  // Check if response already sent
  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).send('Internal server error');
};
