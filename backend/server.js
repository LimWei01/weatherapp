// server.js
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { Datastore } = require('@google-cloud/datastore');
const serviceAccount = require('./service-account-key.json');
const usersRoutes = require('./routes/users');
const weatherRoutes = require('./routes/weather');

// Initialize Firebase Admin for authentication only
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Initialize Datastore
const datastore = new Datastore({
  projectId: serviceAccount.project_id,
  keyFilename: './service-account-key.json'
});

// Make datastore available globally
global.datastore = datastore;

const app = express();
const PORT = process.env.PORT || 8000;

// Define allowed origins
const allowedOrigins = ['http://localhost:3000', 'http://localhost:5000', 'https://weatherapp-456015.web.app'];

// Detailed CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours
};

// Pre-flight OPTIONS middleware
app.options('*', cors(corsOptions));

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Handle preflight requests explicitly
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Auth middleware
const authenticateUser = async (req, res, next) => {
  // Skip authentication for OPTIONS requests
  if (req.method === 'OPTIONS') {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Routes
app.use('/api/users', usersRoutes);
app.use('/api/weather', authenticateUser, weatherRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});