const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

// Admin stats route
router.get('/stats', authenticateUser, authorizeRoles(['admin']), async (req, res) => {
  try {
    // Get user count from Datastore
    const datastore = global.datastore;
    
    // Get all users
    const userQuery = datastore.createQuery('User');
    const [users] = await datastore.runQuery(userQuery);
    
    // Get all locations
    const locationQuery = datastore.createQuery('Location');
    const [locations] = await datastore.runQuery(locationQuery);
    
    // Get all alerts
    const alertQuery = datastore.createQuery('Alert');
    const [alerts] = await datastore.runQuery(alertQuery);
    
    // Count users by role
    const usersByRole = {
      admin: 0,
      moderator: 0,
      user: 0,
      total: users.length
    };
    
    for (const user of users) {
      const role = user.role || 'user';
      usersByRole[role] = (usersByRole[role] || 0) + 1;
    }
    
    // Send stats to client
    res.status(200).json({ 
      message: 'Admin statistics',
      userRole: req.userRole,
      stats: {
        users: usersByRole,
        locations: {
          total: locations.length
        },
        alerts: {
          total: alerts.length
        },
        system: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch admin statistics',
      message: error.message 
    });
  }
});

module.exports = router; 