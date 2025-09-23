import { logAccess, logger } from '../config/logger.js';

export const errorHandler = (err, req, res) => {
  logger.error('Express error handler', { error: err.message, stack: err.stack });

  if (req) {
    logAccess(req, 'ERROR', err.message);
  }

  res.status(500).send('Internal server error');
};
