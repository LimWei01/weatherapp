const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

// Moderator dashboard route
router.get('/dashboard', authenticateUser, authorizeRoles(['admin', 'moderator']), (req, res) => {
  console.log(`User ${req.user.uid} with role ${req.userRole} accessed the moderator dashboard`);
  res.status(200).json({ 
    message: 'Moderator dashboard',
    userRole: req.userRole
  });
});

// Moderator pending content route
router.get('/pending', authenticateUser, authorizeRoles(['admin', 'moderator']), async (req, res) => {
  try {
    console.log(`User ${req.user.uid} with role ${req.userRole} fetching pending content counts`);
    const datastore = global.datastore;
    
    // Get all pending comments
    const query = datastore.createQuery('Comment')
      .filter('status', '=', 'pending');
    
    const [pendingComments] = await datastore.runQuery(query);
    console.log(`Found ${pendingComments.length} pending comments`);
    
    // Count of pending items by type
    const pendingCounts = {
      comments: pendingComments.length,
      total: pendingComments.length
    };
    
    res.status(200).json({
      success: true,
      message: 'Pending content counts retrieved successfully',
      userRole: req.userRole,
      pendingCounts
    });
  } catch (error) {
    console.error(`Error getting pending content counts for user ${req.user.uid}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending content counts',
      message: error.message
    });
  }
});

module.exports = router; 