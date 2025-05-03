const { performance } = require('perf_hooks');

// Store metrics in memory (in production, you'd use a proper time-series database)
const metrics = {
  requestCount: 0,
  responseTimeTotal: 0,
  responseTimeAvg: 0,
  statusCodes: {},
  endpoints: {},
  errors: 0,
  lastCalculated: Date.now()
};

// Function to get current metrics
const getMetrics = () => {
  // Calculate average response time
  if (metrics.requestCount > 0) {
    metrics.responseTimeAvg = metrics.responseTimeTotal / metrics.requestCount;
  }
  
  return {
    ...metrics,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: Date.now()
  };
};

// Reset metrics (useful for time-based aggregation)
const resetMetrics = () => {
  metrics.requestCount = 0;
  metrics.responseTimeTotal = 0;
  metrics.responseTimeAvg = 0;
  metrics.statusCodes = {};
  metrics.endpoints = {};
  metrics.errors = 0;
  metrics.lastCalculated = Date.now();
};

// Middleware to track request metrics
const promClient = require('prom-client');

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestCounter);

// Enhanced requestMetrics middleware
const requestMetrics = (req, res, next) => {
  // Skip monitoring endpoint to avoid recursive metrics
  if (req.path === '/api/monitoring' || req.path === '/metrics') {
    return next();
  }
  
  // Mark start time
  const start = performance.now();
  
  // Track endpoint
  const endpoint = `${req.method} ${req.path}`;
  metrics.endpoints[endpoint] = (metrics.endpoints[endpoint] || 0) + 1;
  
  // Increment request counter
  metrics.requestCount++;
  
  // Track response
  const originalSend = res.send;
  res.send = function(body) {
    // Calculate response time
    const responseTime = performance.now() - start;
    metrics.responseTimeTotal += responseTime;
    
    // Track status code
    const statusCode = res.statusCode.toString();
    metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;
    
    // Track errors (status >= 400)
    if (res.statusCode >= 400) {
      metrics.errors++;
    }
    
    // Record Prometheus metrics
    const path = req.route ? req.route.path : req.path;
    httpRequestDurationMicroseconds
      .labels(req.method, path, res.statusCode)
      .observe(responseTime / 1000); // Convert to seconds
    
    httpRequestCounter
      .labels(req.method, path, res.statusCode)
      .inc();
    
    // Call original send
    return originalSend.call(this, body);
  };
  
  next();
};

// Add Prometheus metrics endpoint
const setupPrometheusEndpoint = (app) => {
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
};

// Add to the existing file

const healthCheck = (req, res) => {
  // Basic health check
  const healthStatus = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  };
  
  // Check database connection
  const datastore = global.datastore;
  if (!datastore) {
    healthStatus.status = 'DOWN';
    healthStatus.database = 'DISCONNECTED';
    return res.status(503).json(healthStatus);
  }
  
  // Return healthy status
  res.status(200).json(healthStatus);
};

const deepHealthCheck = async (req, res) => {
  try {
    const healthStatus = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {}
    };
    
    // Check datastore
    const datastore = global.datastore;
    if (datastore) {
      try {
        const query = datastore.createQuery('User').limit(1);
        await datastore.runQuery(query);
        healthStatus.services.datastore = 'UP';
      } catch (error) {
        healthStatus.services.datastore = 'DOWN';
        healthStatus.status = 'DEGRADED';
      }
    } else {
      healthStatus.services.datastore = 'DOWN';
      healthStatus.status = 'DOWN';
    }
    
    // Return appropriate status code
    const statusCode = healthStatus.status === 'UP' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

module.exports = {
  requestMetrics,
  getMetrics,
  resetMetrics,
  setupPrometheusEndpoint,
  register,
  healthCheck,
  deepHealthCheck
};