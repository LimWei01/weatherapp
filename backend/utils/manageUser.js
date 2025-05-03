const admin = require('firebase-admin');
const { Datastore } = require('@google-cloud/datastore');

// Initialize Datastore
const datastore = new Datastore();

// Check if Firebase admin is already initialized
if (!admin.apps.length) {
  try {
    // Initialize with credentials if available, or let it auto-detect
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    process.exit(1);
  }
}

// Helper function to create a user key
const createUserKey = (userId) => {
  if (!userId) {
    console.error('Attempted to create user key with undefined userId');
    throw new Error('UserId cannot be undefined or null');
  }
  
  const key = datastore.key(['User', userId]);
  return key;
};

// Function to update user role
async function updateUserRole(userId, role) {
  if (!userId) {
    console.error('User ID is required');
    return { success: false, error: 'User ID is required' };
  }
  
  if (!role || !['user', 'admin', 'moderator'].includes(role)) {
    console.error('Invalid role. Must be one of: user, admin, moderator');
    return { success: false, error: 'Invalid role' };
  }
  
  try {
    // Get user from Firebase Auth to validate the userId
    try {
      await admin.auth().getUser(userId);
    } catch (authError) {
      console.error('User does not exist in Firebase Auth:', authError);
      return { success: false, error: 'User does not exist in Firebase Auth' };
    }
    
    // Get existing user from Datastore
    const userKey = createUserKey(userId);
    const [existingUser] = await datastore.get(userKey);
    
    if (!existingUser) {
      console.log(`User not found in Datastore, creating new user entry with role: ${role}`);
      const newUser = {
        key: userKey,
        data: {
          role: role,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
      
      await datastore.save(newUser);
      console.log(`Created new user with role: ${role}`);
    } else {
      console.log(`Existing user found. Current role: ${existingUser.role || 'undefined'}`);
      
      // Update role
      existingUser.role = role;
      existingUser.updatedAt = new Date();
      
      const entityToSave = {
        key: userKey,
        data: { ...existingUser }
      };
      
      await datastore.save(entityToSave);
      console.log(`Updated user role to: ${role}`);
    }
    
    // Verify the update
    const [updatedUser] = await datastore.get(userKey);
    if (!updatedUser || updatedUser.role !== role) {
      console.error('Role update verification failed');
      return { 
        success: false, 
        error: 'Role update verification failed',
        expected: role,
        actual: updatedUser ? updatedUser.role : 'undefined'
      };
    }
    
    return { 
      success: true, 
      message: `User role updated to ${role} successfully`,
      userId,
      role
    };
  } catch (error) {
    console.error('Error updating user role:', error);
    return { success: false, error: error.message };
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node manageUser.js <userId> <role>');
    console.log('Valid roles: user, moderator, admin');
    process.exit(1);
  }
  
  const userId = args[0];
  const role = args[1];
  
  console.log(`Updating user ${userId} to role: ${role}`);
  
  const result = await updateUserRole(userId, role);
  
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error in main:', error);
    process.exit(1);
  });
}

module.exports = {
  updateUserRole
}; 