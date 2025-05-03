const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { createCommentKey, validateComment, formatComment, prepareCommentForStorage } = require('../models/comment');
const { v4: uuidv4 } = require('uuid');
const { authenticateUser, authorizeRoles } = require('./users');
const { Datastore } = require('@google-cloud/datastore');

// Get user's role helper function
const getUserRole = async (userId) => {
  try {
    const datastore = global.datastore;
    const userKey = datastore.key(['User', userId]);
    const [userEntity] = await datastore.get(userKey);
    
    if (!userEntity) {
      return 'user'; // Default to 'user' if not found
    }
    
    return userEntity.role || 'user';
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'user'; // Default to 'user' on error
  }
};

// Add a comment for a location
router.post('/:locationId', authenticateUser, async (req, res) => {
  try {
    const { locationId } = req.params;
    const { content, locationName } = req.body;
    const userId = req.user.uid;
    
    console.log(`Attempting to add comment. LocationId: ${locationId}, UserId: ${userId}`);
    
    if (!locationId) {
      return res.status(400).json({ error: 'Location ID is required' });
    }
    
    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    // Get user display name from Firebase Auth
    let userRecord;
    try {
      userRecord = await admin.auth().getUser(userId);
    } catch (authError) {
      console.error('Error getting user record:', authError);
      return res.status(500).json({ error: 'Failed to authenticate user', details: authError.message });
    }
    
    const userDisplayName = userRecord.displayName || userRecord.email || 'Anonymous';
    
    // Validate comment data
    const commentData = { content };
    const validation = validateComment(commentData);
    
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const datastore = global.datastore;
    if (!datastore) {
      console.error('Datastore is not initialized');
      return res.status(500).json({ error: 'Database connection error' });
    }
    
    // Get user role to determine if comment needs approval
    let userRole;
    try {
      userRole = await getUserRole(userId);
    } catch (roleError) {
      console.error('Error getting user role:', roleError);
      userRole = 'user'; // Default to user role on error
    }
    
    const needsApproval = userRole === 'user'; // Only regular users' comments need approval
    
    // Create a new comment entity
    // Use a flat structure (Comment kind) with a Datastore-generated ID
    const commentKey = datastore.key(['Comment']);
    
    // Prepare comment data with sensitive fields encrypted
    try {
      const commentEntity = prepareCommentForStorage({
        content,
        locationId,
        locationName: locationName || 'Unknown Location',
        userId,
        userDisplayName,
        timestamp: new Date(),
        approved: !needsApproval, // Auto-approve for admins and moderators
        status: !needsApproval ? 'approved' : 'pending'
      });
      
      // Save the comment to Datastore
      await datastore.save({
        key: commentKey,
        data: commentEntity
      });
      
      // Get the saved comment to return the generated ID
      const id = commentKey.id;
      
      // Create a safe copy of the entity, avoiding direct modification
      const entityCopy = { ...commentEntity, id: String(id) };
      
      try {
        // Format the comment for response (this will decrypt the encrypted fields)
        const formattedComment = formatComment(entityCopy, userRole);
        
        // Ensure all fields are properly JSON-serializable
        const safeComment = {
          ...formattedComment,
          id: String(formattedComment.id), // Ensure ID is a string
          timestamp: formattedComment.timestamp instanceof Date 
            ? formattedComment.timestamp.toISOString() 
            : formattedComment.timestamp
        };
        
        res.status(201).json({
          success: true,
          message: needsApproval ? 'Comment submitted for approval' : 'Comment posted successfully',
          comment: safeComment
        });
      } catch (formatError) {
        console.error('Error formatting comment response:', formatError);
        // Even if formatting fails, we've still saved the comment
        res.status(201).json({
          success: true,
          message: 'Comment saved, but could not be formatted for display',
          error: formatError.message
        });
      }
    } catch (encryptionError) {
      console.error('Error with comment encryption or storage:', encryptionError);
      return res.status(500).json({ 
        error: 'Failed to process comment data',
        details: encryptionError.message
      });
    }
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ 
      error: 'Failed to add comment',
      details: error.message
    });
  }
});

// Get all approved comments for a location (public)
router.get('/location/:locationId', authenticateUser, async (req, res) => {
  try {
    const { locationId } = req.params;
    const datastore = global.datastore;
    const userId = req.user.uid;
    
    // Get user's role to determine what comments to show
    const userRole = await getUserRole(userId);
    console.log(`[Comments API] Fetching comments for user role: ${userRole}, userId: ${userId}, locationId: ${locationId}`);
    
    // Create a query for comments for this location from all users
    const query = datastore.createQuery('Comment')
      .filter('locationId', '=', locationId);
    
    // For regular users, only show approved comments
    if (userRole === 'user') {
      query.filter('approved', '=', true);
    }
    
    const [comments] = await datastore.runQuery(query);
    console.log(`[Comments API] Found ${comments.length} comments for location ${locationId}`);
    
    if (comments.length > 0) {
      console.log(`[Comments API] Sample comment before formatting:`, {
        id: comments[0][datastore.KEY].id || comments[0][datastore.KEY].name,
        content: typeof comments[0].content === 'string' ? 
          `${comments[0].content.substring(0, 20)}...` : 'not a string',
        contentType: typeof comments[0].content
      });
    }
    
    // Format comments for response
    const formattedComments = comments.map(comment => {
      const formatted = formatComment(comment, userRole);
      // Log sample of first comment after decryption
      if (comment === comments[0]) {
        console.log(`[Comments API] Sample comment after formatting:`, {
          id: formatted.id,
          content: formatted.content ? 
            `${formatted.content.substring(0, 20)}...` : 'empty content',
          contentLength: formatted.content ? formatted.content.length : 0
        });
      }
      return formatted;
    });
    
    // Sort comments by timestamp (newest first)
    formattedComments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.status(200).json({
      success: true,
      comments: formattedComments,
      _userRole: userRole // Include the role in the response for debugging
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Get all comments pending approval (moderator/admin only)
router.get('/pending', authenticateUser, authorizeRoles(['admin', 'moderator']), async (req, res) => {
  try {
    const datastore = global.datastore;
    
    // Get all comments with status 'pending'
    const query = datastore.createQuery('Comment')
      .filter('status', '=', 'pending');
    
    const [pendingComments] = await datastore.runQuery(query);
    console.log(`Found ${pendingComments.length} pending comments`);
    
    // Format comments for response and ensure they have the correct key structure
    const formattedComments = pendingComments.map(comment => {
      // Extract the full path from the key to ensure we have the proper hierarchy
      const key = comment[Datastore.KEY];
      console.log('Comment key path:', key.path);
      
      const formattedComment = formatComment(comment, req.userRole);
      
      // Use the locationId from the entity data, not from the key
      if (!formattedComment.locationId && comment.locationId) {
        formattedComment.locationId = comment.locationId;
      }
      
      return formattedComment;
    });
    
    // Sort comments by timestamp (oldest first, for FIFO moderation)
    formattedComments.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.status(200).json({
      success: true,
      comments: formattedComments
    });
  } catch (error) {
    console.error('Error fetching pending comments:', error);
    res.status(500).json({ error: 'Failed to fetch pending comments' });
  }
});

// Approve or reject a comment (moderator/admin only)
router.put('/:userId/:locationId/:commentId', authenticateUser, authorizeRoles(['admin', 'moderator']), async (req, res) => {
  try {
    const { userId, locationId, commentId } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'
    
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    console.log(`Approving/rejecting comment. UserId: ${userId}, LocationId: ${locationId}, CommentId: ${commentId}`);
    console.log(`Commentid type: ${typeof commentId}, value: ${commentId}`);
    
    const datastore = global.datastore;
    
    // First try with string ID
    let commentKey = datastore.key(['Comment', commentId]);
    console.log('Trying with string ID key:', JSON.stringify(commentKey));
    let [commentEntity] = await datastore.get(commentKey);
    
    // Then try with numeric ID - handle safely
    if (!commentEntity) {
      console.log('Comment not found with string ID, trying numeric ID');
      try {
        commentKey = datastore.key(['Comment', datastore.int(commentId)]);
        console.log('Trying with numeric ID key:', JSON.stringify(commentKey));
        [commentEntity] = await datastore.get(commentKey);
      } catch (err) {
        console.error('Error converting to datastore int:', err);
        // Continue with hierarchical approach
      }
    }
    
    // If not found with direct key, try hierarchical key as fallback
    if (!commentEntity) {
      console.log('Comment not found with direct key, trying hierarchical key');
      commentKey = createCommentKey(datastore, userId, locationId, commentId);
      console.log('Trying with hierarchical key:', JSON.stringify(commentKey));
      [commentEntity] = await datastore.get(commentKey);
    }
    
    if (!commentEntity) {
      console.log('Comment not found with any standard key structure, trying broader search');
      
      // Try a broader search
      const query = datastore.createQuery('Comment');
      const [allComments] = await datastore.runQuery(query);
      
      console.log(`Found ${allComments.length} total comments`);
      
      // Look for comments with matching ID and other attributes
      const matchingComments = allComments.filter(comment => {
        const key = comment[Datastore.KEY];
        const id = key.id || key.name;
        // Match by ID first
        const idMatches = id.toString() === commentId || 
                         (comment.id && comment.id.toString() === commentId);
        // Then check other attributes if needed
        const attributesMatch = comment.userId === userId && 
                               comment.locationId === locationId;
                                
        return idMatches || attributesMatch;
      });
      
      if (matchingComments.length > 0) {
        console.log(`Found ${matchingComments.length} matching comments`);
        commentEntity = matchingComments[0];
        commentKey = commentEntity[Datastore.KEY];
        console.log('Using comment key from broader search:', JSON.stringify(commentKey));
      } else {
        console.log('Comment not found with either key structure');
        return res.status(404).json({ error: 'Comment not found' });
      }
    }
    
    // Update the comment status
    commentEntity.status = status;
    commentEntity.approved = status === 'approved';
    commentEntity.moderatedAt = new Date();
    commentEntity.moderatedBy = req.user.uid;
    
    // Save the updated comment
    await datastore.save({
      key: commentKey,
      data: commentEntity
    });
    
    res.status(200).json({
      success: true,
      message: `Comment ${status} successfully`,
      comment: formatComment(commentEntity, req.userRole)
    });
  } catch (error) {
    console.error('Error updating comment status:', error);
    res.status(500).json({ error: 'Failed to update comment status' });
  }
});

// Approve or reject a comment by ID only (moderator/admin only)
router.put('/by-id/:commentId', authenticateUser, authorizeRoles(['admin', 'moderator']), async (req, res) => {
  try {
    const { commentId } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'
    
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    console.log(`Approving/rejecting comment by ID only: ${commentId}`);
    console.log(`Commentid type: ${typeof commentId}, value: ${commentId}`);
    
    const datastore = global.datastore;
    
    // First try with string ID
    let commentKey = datastore.key(['Comment', commentId]);
    console.log('Trying with string ID key:', JSON.stringify(commentKey));
    let [commentEntity] = await datastore.get(commentKey);
    
    // Then try with numeric ID - handle safely
    if (!commentEntity) {
      console.log('Comment not found with string ID, trying numeric ID');
      try {
        commentKey = datastore.key(['Comment', datastore.int(commentId)]);
        console.log('Trying with numeric ID key:', JSON.stringify(commentKey));
        [commentEntity] = await datastore.get(commentKey);
      } catch (err) {
        console.error('Error converting to datastore int:', err);
        // Continue with next approach
      }
    }
    
    if (!commentEntity) {
      console.log('Comment not found with either key structure');
      
      // Try a broader search
      console.log('Trying broader search for comment ID');
      const query = datastore.createQuery('Comment');
      const [allComments] = await datastore.runQuery(query);
      
      console.log(`Found ${allComments.length} total comments`);
      
      // Look for comments with matching ID attributes
      const matchingComments = allComments.filter(comment => {
        const key = comment[Datastore.KEY];
        const id = key.id || key.name;
        return id.toString() === commentId || 
               (comment.id && comment.id.toString() === commentId);
      });
      
      if (matchingComments.length > 0) {
        console.log(`Found ${matchingComments.length} matching comments`);
        commentEntity = matchingComments[0];
        commentKey = commentEntity[Datastore.KEY];
        console.log('Using comment key from broader search:', JSON.stringify(commentKey));
      } else {
        return res.status(404).json({ error: 'Comment not found' });
      }
    }
    
    console.log('Found comment:', commentEntity);
    
    // Update the comment status
    commentEntity.status = status;
    commentEntity.approved = status === 'approved';
    commentEntity.moderatedAt = new Date();
    commentEntity.moderatedBy = req.user.uid;
    
    // Save the updated comment
    await datastore.save({
      key: commentKey,
      data: commentEntity
    });
    
    res.status(200).json({
      success: true,
      message: `Comment ${status} successfully`,
      comment: formatComment(commentEntity, req.userRole)
    });
  } catch (error) {
    console.error('Error updating comment status by ID:', error);
    res.status(500).json({ error: 'Failed to update comment status' });
  }
});

// Delete a comment (owner or moderator/admin)
router.delete('/:userId/:locationId/:commentId', authenticateUser, async (req, res) => {
  try {
    const { userId, locationId, commentId } = req.params;
    const currentUserId = req.user.uid;
    
    console.log(`Deleting comment. UserId: ${userId}, LocationId: ${locationId}, CommentId: ${commentId}`);
    console.log(`Commentid type: ${typeof commentId}, value: ${commentId}`);
    
    // Check if user can delete this comment (own comment or moderator/admin)
    const userRole = await getUserRole(currentUserId);
    const canModerate = userRole === 'admin' || userRole === 'moderator';
    
    // Regular users can only delete their own comments
    if (userId !== currentUserId && !canModerate) {
      return res.status(403).json({ error: 'You do not have permission to delete this comment' });
    }
    
    const datastore = global.datastore;
    
    // First try with string ID
    let commentKey = datastore.key(['Comment', commentId]);
    console.log('Trying with string ID key:', JSON.stringify(commentKey));
    let [commentEntity] = await datastore.get(commentKey);
    
    // Then try with numeric ID - handle safely
    if (!commentEntity) {
      console.log('Comment not found with string ID, trying numeric ID');
      try {
        commentKey = datastore.key(['Comment', datastore.int(commentId)]);
        console.log('Trying with numeric ID key:', JSON.stringify(commentKey));
        [commentEntity] = await datastore.get(commentKey);
      } catch (err) {
        console.error('Error converting to datastore int:', err);
        // Continue with hierarchical approach
      }
    }
    
    // If not found with direct key, try hierarchical key as fallback
    if (!commentEntity) {
      console.log('Comment not found with direct key, trying hierarchical key');
      commentKey = createCommentKey(datastore, userId, locationId, commentId);
      console.log('Trying with hierarchical key:', JSON.stringify(commentKey));
      [commentEntity] = await datastore.get(commentKey);
    }
    
    if (!commentEntity) {
      console.log('Comment not found with any standard key structure, trying broader search');
      
      // Try a broader search
      const query = datastore.createQuery('Comment');
      const [allComments] = await datastore.runQuery(query);
      
      console.log(`Found ${allComments.length} total comments`);
      
      // Look for comments with matching ID and other attributes
      const matchingComments = allComments.filter(comment => {
        const key = comment[Datastore.KEY];
        const id = key.id || key.name;
        // Match by ID first
        const idMatches = id.toString() === commentId || 
                         (comment.id && comment.id.toString() === commentId);
        // Then check other attributes if needed
        const attributesMatch = comment.userId === userId && 
                               comment.locationId === locationId;
                                
        return idMatches || attributesMatch;
      });
      
      if (matchingComments.length > 0) {
        console.log(`Found ${matchingComments.length} matching comments`);
        commentEntity = matchingComments[0];
        commentKey = commentEntity[Datastore.KEY];
        console.log('Using comment key from broader search:', JSON.stringify(commentKey));
      } else {
        console.log('Comment not found with either key structure');
        return res.status(404).json({ error: 'Comment not found' });
      }
    }
    
    // Check permissions again if needed
    if (!canModerate && commentEntity.userId !== currentUserId) {
      return res.status(403).json({ error: 'You do not have permission to delete this comment' });
    }
    
    // Delete the comment
    await datastore.delete(commentKey);
    
    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Delete a comment by ID only (owner or moderator/admin)
router.delete('/by-id/:commentId', authenticateUser, async (req, res) => {
  try {
    const { commentId } = req.params;
    const currentUserId = req.user.uid;
    
    console.log(`Deleting comment by ID only: ${commentId}`);
    console.log(`Commentid type: ${typeof commentId}, value: ${commentId}`);
    
    // Get user role for permission check
    const userRole = await getUserRole(currentUserId);
    const canModerate = userRole === 'admin' || userRole === 'moderator';
    
    const datastore = global.datastore;
    
    // First try with string ID
    let commentKey = datastore.key(['Comment', commentId]);
    console.log('Trying with string ID key:', JSON.stringify(commentKey));
    let [commentEntity] = await datastore.get(commentKey);
    
    // Then try with numeric ID - handle safely
    if (!commentEntity) {
      console.log('Comment not found with string ID, trying numeric ID');
      try {
        commentKey = datastore.key(['Comment', datastore.int(commentId)]);
        console.log('Trying with numeric ID key:', JSON.stringify(commentKey));
        [commentEntity] = await datastore.get(commentKey);
      } catch (err) {
        console.error('Error converting to datastore int:', err);
        // Continue with next approach
      }
    }
    
    if (!commentEntity) {
      console.log('Comment not found with direct keys, trying broader search');
      
      // Try a broader search
      const query = datastore.createQuery('Comment');
      const [allComments] = await datastore.runQuery(query);
      
      console.log(`Found ${allComments.length} total comments`);
      
      // Look for comments with matching ID attributes
      const matchingComments = allComments.filter(comment => {
        const key = comment[Datastore.KEY];
        const id = key.id || key.name;
        return id.toString() === commentId || 
               (comment.id && comment.id.toString() === commentId);
      });
      
      if (matchingComments.length > 0) {
        console.log(`Found ${matchingComments.length} matching comments`);
        commentEntity = matchingComments[0];
        commentKey = commentEntity[Datastore.KEY];
        console.log('Using comment key from broader search:', JSON.stringify(commentKey));
      } else {
        console.log('Comment not found with any approach');
        return res.status(404).json({ error: 'Comment not found' });
      }
    }
    
    // Check if user can delete this comment (own comment or moderator/admin)
    if (!canModerate && commentEntity.userId !== currentUserId) {
      return res.status(403).json({ error: 'You do not have permission to delete this comment' });
    }
    
    // Delete the comment
    await datastore.delete(commentKey);
    
    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment by ID:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Debug endpoint to get comment by ID (moderator/admin only)
router.get('/debug/:commentId', authenticateUser, authorizeRoles(['admin', 'moderator']), async (req, res) => {
  try {
    const { commentId } = req.params;
    const datastore = global.datastore;
    
    console.log(`Debug: Trying to fetch comment with ID: ${commentId}`);
    
    // Try with string ID first
    let commentKey = datastore.key(['Comment', commentId]);
    let [commentEntity] = await datastore.get(commentKey);
    
    // If not found, try with numeric ID
    if (!commentEntity) {
      console.log('Debug: Comment not found with string ID, trying numeric ID');
      commentKey = datastore.key(['Comment', datastore.int(commentId)]);
      [commentEntity] = await datastore.get(commentKey);
    }
    
    if (!commentEntity) {
      console.log('Debug: Comment not found with either ID format');
      
      // Try a broader search
      const query = datastore.createQuery('Comment');
      const [allComments] = await datastore.runQuery(query);
      
      console.log(`Debug: Found ${allComments.length} total comments`);
      
      // Look for comments with matching attributes
      const matchingComments = allComments.filter(comment => {
        const key = comment[Datastore.KEY];
        const id = key.id || key.name;
        return id.toString() === commentId || 
               (comment.id && comment.id.toString() === commentId);
      });
      
      if (matchingComments.length > 0) {
        console.log(`Debug: Found ${matchingComments.length} matching comments`);
        return res.status(200).json({
          success: true,
          comment: formatComment(matchingComments[0], req.userRole),
          allMatches: matchingComments.map(c => formatComment(c, req.userRole))
        });
      }
      
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    res.status(200).json({
      success: true,
      comment: formatComment(commentEntity, req.userRole),
      keyInfo: {
        kind: commentKey.kind,
        id: commentKey.id,
        path: commentKey.path
      }
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ error: 'Failed to get comment for debugging' });
  }
});

module.exports = router; 