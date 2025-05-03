import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import '../styles/Comments.css';
import { FaComment, FaCommentSlash, FaPaperPlane, FaSpinner, FaTrash, FaExclamationTriangle } from 'react-icons/fa';

const Comments = ({ locationId, locationName }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitStatus, setSubmitStatus] = useState('');
  const { currentUser, userRole } = useAuth();

  // Function to format the date
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Fetch comments for the location
  const fetchComments = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log(`[DEBUG] Fetching comments for locationId: ${locationId}`);
      const token = await currentUser.getIdToken();
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/comments/location/${locationId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      console.log('[DEBUG] Comments API response:', response.data);
      setComments(response.data.comments || []);
      console.log('[DEBUG] Comments after setting state:', response.data.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('Failed to load comments. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Submit a new comment
  const submitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    setError(null);
    setSubmitStatus('');

    try {
      console.log('[DEBUG] Submitting new comment:', newComment);
      const token = await currentUser.getIdToken();
      // Ensure locationId is a string
      const locationIdStr = String(locationId);
      console.log(`[DEBUG] Posting to locationId: ${locationIdStr}`);
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/comments/${locationIdStr}`,
        {
          content: newComment,
          locationName
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('[DEBUG] Comment submission response:', response.data);

      // Check if the comment is pending or approved
      const isPending = response.data.comment && response.data.comment.status === 'pending';
      
      if (isPending) {
        setSubmitStatus('Your comment has been submitted and is awaiting moderation.');
      } else {
        // Refresh comments if the comment was auto-approved
        fetchComments();
        setSubmitStatus('Your comment has been posted successfully.');
      }
      
      // Clear the comment input
      setNewComment('');
    } catch (error) {
      console.error('Error submitting comment:', error);
      
      // Check if we need to refresh comments even though there was an error
      // Some errors happen after the comment is saved to the database
      if (error.message.includes('500')) {
        console.log('Server error, but comment might have been saved. Refreshing comments...');
        // Clear the comment input since it might have been saved
        setNewComment('');
        // Refresh comments list after a short delay
        setTimeout(() => {
          fetchComments();
        }, 1000);
        
        setSubmitStatus('Your comment was processed, but there was a system error. The comment list has been refreshed.');
      } else {
        setError(`Failed to submit comment: ${error.message || 'Please try again later.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Delete a comment
  const deleteComment = async (userId, commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = await currentUser.getIdToken();
      
      // First try deleting with direct ID approach
      try {
        console.log(`Trying to delete comment with direct ID: ${commentId}`);
        await axios.delete(
          `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/comments/by-id/${commentId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        // If we get here, the delete succeeded
        console.log('Comment deleted successfully with direct ID approach');
        fetchComments();
        setSubmitStatus('Comment deleted successfully.');
        setLoading(false);
        return;
      } catch (directIdError) {
        // If direct ID approach fails, try hierarchical approach
        console.error('Error with direct ID delete approach:', directIdError);
        console.log('Falling back to hierarchical delete URL');
      }
      
      // Fall back to hierarchical approach
      await axios.delete(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/comments/${userId}/${locationId}/${commentId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Refresh the comments list
      fetchComments();
      setSubmitStatus('Comment deleted successfully.');
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Failed to delete comment. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Load comments when location changes
  useEffect(() => {
    if (locationId) {
      fetchComments();
    }
    
    // Clear status messages when location changes
    return () => {
      setSubmitStatus('');
      setError(null);
    };
  }, [locationId]);

  // Determine if the user can delete a comment
  const canDeleteComment = (comment) => {
    if (!currentUser) return false;
    
    // Can delete if user is the comment author
    if (comment.userId === currentUser.uid) return true;
    
    // Can delete if user is admin or moderator
    if (userRole === 'admin' || userRole === 'moderator') return true;
    
    return false;
  };

  return (
    <div className="comments-section">
      <h3 className="comments-title">
        <FaComment /> Community Comments
      </h3>
      
      {/* Comment submission form */}
      <form className="comment-form" onSubmit={submitComment}>
        <textarea
          className="comment-input"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts about this location..."
          disabled={loading}
          maxLength={1000}
        />
        <div className="comment-form-footer">
          <span className="char-count">{newComment.length}/1000</span>
          <button 
            type="submit" 
            className="submit-comment-btn"
            disabled={loading || !newComment.trim()}
          >
            {loading ? <FaSpinner className="spinner" /> : <FaPaperPlane />} 
            Post Comment
          </button>
        </div>
      </form>
      
      {/* Status messages */}
      {submitStatus && <div className="status-message success">{submitStatus}</div>}
      {error && <div className="status-message error"><FaExclamationTriangle /> {error}</div>}
      
      {/* Comments list */}
      <div className="comments-list">
        {loading && !comments.length ? (
          <div className="loading-comments">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="no-comments">
            <FaCommentSlash />
            <p>No comments yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="comment-item">
              <div className="comment-header">
                <div className="comment-user">
                  <strong>{comment.userDisplayName}</strong>
                  {comment.status === 'pending' && (
                    <span className="pending-badge">Pending Approval</span>
                  )}
                </div>
                <div className="comment-date">{formatDate(comment.timestamp)}</div>
              </div>
              <div className="comment-content">{comment.content}</div>
              <div className="comment-actions">
                {canDeleteComment(comment) && (
                  <button 
                    className="delete-comment-btn" 
                    onClick={() => deleteComment(comment.userId, comment.id)}
                    title="Delete comment"
                  >
                    <FaTrash />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Comments; 