const { performance } = require('perf_hooks');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Middleware to add correlation ID to requests
const correlationIdMiddleware = (req, res, next) => {
  // Use existing correlation ID from headers or generate a new one
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  
  // Add correlation ID to response headers
  res.setHeader('x-correlation-id', req.correlationId);
  
  next();
};

// Middleware to log HTTP requests
const requestLogger = (req, res, next) => {
  // Skip logging for health check endpoint to reduce noise
  if (req.path === '/health' || req.path === '/metrics') {
    return next();
  }
  
  const start = performance.now();
  
  // Log request
  logger.debug(`Incoming request: ${req.method} ${req.url}`, {
    correlationId: req.correlationId,
    headers: req.headers,
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined
  });
  
  // Capture response
  const originalSend = res.send;
  res.send = function(body) {
    const responseTime = performance.now() - start;
    
    // Log access
    logger.access(req, res, responseTime);
    
    // Log detailed response for non-200 status codes
    if (res.statusCode >= 400) {
      logger.error(`Request failed: ${req.method} ${req.url} ${res.statusCode}`, {
        correlationId: req.correlationId,
        responseTime: `${responseTime.toFixed(2)}ms`,
        response: typeof body === 'string' ? body : JSON.stringify(body)
      });
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, {
    correlationId: req.correlationId,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });
  
  next(err);
};

module.exports = {
  correlationIdMiddleware,
  requestLogger,
  errorLogger
};