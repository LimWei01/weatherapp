const { Datastore } = require('@google-cloud/datastore');
const { encryptFields, decryptFields } = require('../utils/encryption');

// Function to create a comment key with the proper hierarchy
function createCommentKey(datastore, userId, locationId, commentId) {
  // If commentId is provided, first try direct key approach for flat Comment structure
  if (commentId) {
    console.log(`Creating comment key for ID: ${commentId}`);
    
    // First try with the ID as a string
    try {
      return datastore.key(['Comment', commentId]);
    } catch (err) {
      console.error('Error creating comment key with string ID:', err);
    }
    
    // Then try with the ID as a number, if it looks numeric
    if (!isNaN(commentId)) {
      try {
        return datastore.key(['Comment', datastore.int(commentId)]);
      } catch (err) {
        console.error('Error creating comment key with numeric ID:', err);
        // Fall through to hierarchical key approach
      }
    }
    
    // Fall back to hierarchical key structure
    console.log('Falling back to hierarchical key structure');
    return datastore.key(['User', userId, 'Location', locationId, 'Comment', commentId]);
  }
  
  // For a new comment, return a key with incomplete ID (to be assigned by Datastore)
  return datastore.key(['User', userId, 'Location', locationId, 'Comment']);
}

// Validate comment data
function validateComment(commentData) {
  if (!commentData.content || typeof commentData.content !== 'string' || commentData.content.trim() === '') {
    return { isValid: false, error: 'Comment content is required' };
  }
  
  if (commentData.content.length > 1000) {
    return { isValid: false, error: 'Comment content cannot exceed 1000 characters' };
  }
  
  return { isValid: true };
}

// Fields to encrypt in comments
const ENCRYPTED_FIELDS = ['content'];

// Format comment for consistent API response
function formatComment(commentEntity, userRole = 'unknown') {
  if (!commentEntity) return null;
  
  try {
    // Extract the comment ID from the key
    let commentId;
    if (commentEntity[Datastore.KEY]) {
      const key = commentEntity[Datastore.KEY];
      commentId = key.id || key.name;
    } else if (commentEntity.id) {
      // If the ID was already added as a property
      commentId = commentEntity.id;
    } else {
      // Fallback to a random ID if none exists
      console.warn('Comment has no ID, generating a placeholder');
      commentId = `tmp-${Date.now()}`;
    }
    
    // Always convert ID to string for consistency
    commentId = String(commentId);
    
    console.log(`[Format Comment] Processing comment ID ${commentId} for user role: ${userRole}`);
    console.log(`[Format Comment] Raw content type: ${typeof commentEntity.content}`);
    if (typeof commentEntity.content === 'string') {
      console.log(`[Format Comment] Raw content first 20 chars: ${commentEntity.content.substring(0, 20)}...`);
    }
    
    // Decrypt any encrypted fields before returning
    let decryptedEntity;
    
    try {
      console.log(`[Format Comment] Attempting decryption for comment ID ${commentId}`);
      decryptedEntity = decryptFields(commentEntity, ENCRYPTED_FIELDS);
      console.log(`[Format Comment] Decryption successful for comment ID ${commentId}`);
    } catch (decryptError) {
      console.error(`[Format Comment] Error decrypting comment fields for ID ${commentId}:`, decryptError);
      // Use original entity if decryption fails
      decryptedEntity = { ...commentEntity };
      // If content field failed to decrypt, provide a placeholder
      if (commentEntity.content && decryptedEntity.content === '[DECRYPTION_ERROR]') {
        console.error(`[Format Comment] Content decryption failed for comment ID ${commentId}`);
        decryptedEntity.content = '[Content unavailable due to encryption error]';
      }
    }
    
    // Format timestamp as ISO string if it's a Date object
    let timestamp = decryptedEntity.timestamp;
    if (timestamp instanceof Date) {
      timestamp = timestamp.toISOString();
    } else if (typeof timestamp === 'number') {
      // Convert numeric timestamp to ISO string
      timestamp = new Date(timestamp).toISOString();
    }
    
    // Return a safe, properly formatted comment object
    return {
      id: commentId,
      content: decryptedEntity.content || '',
      locationId: decryptedEntity.locationId || '',
      locationName: decryptedEntity.locationName || 'Unknown Location',
      userId: decryptedEntity.userId || '',
      userDisplayName: decryptedEntity.userDisplayName || 'Anonymous',
      timestamp: timestamp || new Date().toISOString(),
      approved: !!decryptedEntity.approved, // Convert to boolean
      status: decryptedEntity.status || 'pending'
    };
  } catch (error) {
    console.error('Error formatting comment:', error);
    // Return a minimal safe format if anything goes wrong
    return {
      id: commentEntity.id || 'error',
      content: '[Error formatting comment]',
      timestamp: new Date().toISOString(),
      userDisplayName: 'Unknown',
      status: 'error'
    };
  }
}

// Prepare comment for storage by encrypting sensitive fields
function prepareCommentForStorage(commentData) {
  return encryptFields(commentData, ENCRYPTED_FIELDS);
}

module.exports = {
  createCommentKey,
  validateComment,
  formatComment,
  prepareCommentForStorage,
  ENCRYPTED_FIELDS
}; 