const fs = require('fs');
const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create rotating file transports
const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '14d'
});

const combinedFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d'
});

const accessFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'access-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d'
});

// Create Winston logger
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'weather-app-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    errorFileTransport,
    combinedFileTransport
  ]
});

// Create access logger
const accessLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'weather-app-backend-access' },
  transports: [
    accessFileTransport,
    combinedFileTransport
  ]
});

// Enhanced logger with correlation IDs
const logger = {
  error: (message, meta = {}) => {
    winstonLogger.error(message, meta);
  },
  
  warn: (message, meta = {}) => {
    winstonLogger.warn(message, meta);
  },
  
  info: (message, meta = {}) => {
    winstonLogger.info(message, meta);
  },
  
  debug: (message, meta = {}) => {
    winstonLogger.debug(message, meta);
  },
  
  access: (req, res, responseTime) => {
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      responseTime: `${responseTime.toFixed(2)}ms`,
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      userId: req.user ? req.user.uid : 'anonymous',
      correlationId: req.correlationId || 'no-correlation-id'
    };
    
    accessLogger.info('HTTP Access', logData);
  },
  
  // Set log level
  setLogLevel: (level) => {
    winstonLogger.level = level;
    logger.info(`Log level set to ${level}`);
  }
};

module.exports = logger;