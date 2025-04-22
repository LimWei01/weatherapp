// routes/users.js
const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Helper function to create a user key
const createUserKey = (userId) => {
  return global.datastore.key(['User', userId]);
};

// Helper function to format user entity
const formatUser = (entity) => {
  if (!entity) return null;
  
  const formattedUser = { ...entity };
  
  // Remove the datastore KEY from the returned object
  delete formattedUser[global.datastore.KEY];
  
  return formattedUser;
};

// Get user profile
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const datastore = global.datastore;
    
    // Get user from Firebase Auth
    const userRecord = await admin.auth().getUser(userId);
    
    // Get user profile from Datastore
    const userKey = createUserKey(userId);
    const [userEntity] = await datastore.get(userKey);
    
    if (!userEntity) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = formatUser(userEntity);
    
    res.status(200).json({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      ...userData
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update user profile
router.post('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userData = req.body;
    const datastore = global.datastore;
    
    // Prepare user entity
    const userKey = createUserKey(userId);
    const userEntity = {
      key: userKey,
      data: {
        ...userData,
        updatedAt: new Date()
      }
    };
    
    // Save to Datastore (automatically overwrites if exists)
    await datastore.save(userEntity);
    
    res.status(200).json({ message: 'User data updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;