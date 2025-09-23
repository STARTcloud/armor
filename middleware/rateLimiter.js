import { rateLimit } from 'express-rate-limit';
import configLoader from '../config/configLoader.js';

export const rateLimiterMiddleware = () => {
  const rateLimitConfig = configLoader.getRateLimitConfig();

  return rateLimit({
    windowMs: rateLimitConfig.window_minutes * 60 * 1000,
    max: rateLimitConfig.max_requests,
    message: rateLimitConfig.message,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: rateLimitConfig.skip_successful_requests,
    skipFailedRequests: rateLimitConfig.skip_failed_requests,
  });
};
