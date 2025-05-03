const admin = require('firebase-admin');

// Helper function to create a user key
const createUserKey = (userId) => {
  if (!userId) {
    console.error('Attempted to create user key with undefined userId');
    throw new Error('UserId cannot be undefined or null');
  }
  
  const key = global.datastore.key(['User', userId]);
  return key;
};

/**
 * Middleware to authenticate users using Firebase Admin
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      
      console.log(`User authenticated: ${decodedToken.uid} (email: ${decodedToken.email || 'unknown'})`);
      
      // Get user role from Datastore
      try {
        const datastore = global.datastore;
        const userId = decodedToken.uid;
        const userKey = createUserKey(userId);
        const [userEntity] = await datastore.get(userKey);
        
        if (userEntity && userEntity.role) {
          // Use the role from Datastore
          req.userRole = userEntity.role;
          console.log(`Role found in Datastore for user ${userId}: ${userEntity.role}`);
        } else {
          // Default to regular user if no role is specified
          req.userRole = 'user';
          
          // Log this situation separately as it could indicate a missing user profile
          if (!userEntity) {
            console.warn(`No user profile found in Datastore for authenticated user ${userId}. Setting default role 'user'.`);
            
            // Auto-create user profile if it doesn't exist (useful for first-time logins)
            if (req.method === 'POST' && req.originalUrl.includes(`/users/${userId}`)) {
              console.log(`User profile creation in progress for ${userId} - allowing request to continue`);
            } else {
              console.log(`Creating default user profile for ${userId} in Datastore`);
              try {
                // Create a basic user profile to avoid future issues
                const newUserEntity = {
                  key: userKey,
                  data: {
                    email: decodedToken.email || null,
                    displayName: decodedToken.name || null,
                    role: 'user',
                    createdAt: new Date(),
                    autoCreated: true
                  }
                };
                await datastore.save(newUserEntity);
                console.log(`Auto-created default user profile for ${userId}`);
              } catch(createError) {
                console.error(`Failed to auto-create user profile for ${userId}:`, createError);
              }
            }
          } else {
            console.warn(`User ${userId} has profile in Datastore but no role defined. Setting default role 'user'.`);
          }
        }
      } catch (dbError) {
        console.error(`Error retrieving user role from Datastore for user ${decodedToken.uid}:`, dbError);
        // Default to regular user if there was a database error
        req.userRole = 'user';
      }
      
      next();
    } catch (error) {
      console.error('Error verifying token:', error);
      
      // More specific error handling
      if (error.code === 'auth/id-token-expired') {
        return res.status(401).json({ error: 'Token expired', code: 'token-expired' });
      } else if (error.code === 'auth/argument-error') {
        return res.status(401).json({ error: 'Invalid token format', code: 'invalid-token' });
      } else {
        return res.status(401).json({ error: 'Invalid token', code: error.code || 'unknown' });
      }
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

/**
 * Middleware to check if user has required roles
 */
const authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userRole = req.userRole || 'user';
    
    if (!roles.includes(userRole)) {
      console.log(`User ${req.user.uid} with role ${userRole} tried to access a resource requiring roles: ${JSON.stringify(roles)}`);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

module.exports = {
  authenticateUser,
  authorizeRoles
};