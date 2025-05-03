import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import '../styles/ModeratorPanel.css';
import { 
  FaCheck, 
  FaTimes, 
  FaComments, 
  FaSpinner, 
  FaBell,
  FaSyncAlt
} from 'react-icons/fa';

const ModeratorPanel = () => {
  const [pendingComments, setPendingComments] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const { currentUser, userRole, verifyAdminModeratorRoles } = useAuth();
  
  // Check if user has appropriate permissions
  const hasAccess = userRole === 'admin' || userRole === 'moderator';
  
  // Verify roles on component mount
  useEffect(() => {
    if (currentUser) {
      console.log('[ModPanel] Verifying privileges');
      verifyAdminModeratorRoles()
        .then(hasPrivileges => {
          console.log(`[ModPanel] Role verification: user ${currentUser.uid} ${hasPrivileges ? 'has' : 'does not have'} admin/mod privileges`);
        })
        .catch(error => {
          console.error('[ModPanel] Error verifying privileges:', error);
        });
    }
  }, [currentUser, verifyAdminModeratorRoles]);

  // Function to format the date
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Function to fetch pending comments
  const fetchPendingComments = useCallback(async () => {
    if (!currentUser) return;
    if (userRole !== 'moderator' && userRole !== 'admin') return;

    setLoading(true);
    setError(null);
    try {
      const token = await currentUser.getIdToken();
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/comments/pending`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const commentsData = response.data.comments || [];
      console.log('Pending comments full data:', JSON.stringify(commentsData));
      setPendingComments(commentsData);
      setPendingCount(commentsData ? commentsData.length : 0);
    } catch (error) {
      console.error('Error fetching pending comments:', error);
      setError('Failed to load pending comments. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, userRole]);

  // Function to fetch pending counts
  const fetchPendingCounts = useCallback(async () => {
    if (!currentUser) return;
    if (userRole !== 'moderator' && userRole !== 'admin') return;

    try {
      const token = await currentUser.getIdToken(true); // Force token refresh
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/moderator/pending`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      setPendingCount(response.data.pendingCounts.total);
    } catch (error) {
      console.error('Error fetching pending counts:', error);
      // Don't set error state here to avoid disrupting the UI
      // Just log the error and continue
    }
  }, [currentUser, userRole]);

  // Fetch pending comments and counts when component mounts
  useEffect(() => {
    if (hasAccess && currentUser) {
      // Log access state for debugging
      console.log('ModeratorPanel access check:', { hasAccess, userRole, userId: currentUser.uid });
      
      // Attempt to refresh token before making API calls
      currentUser.getIdToken(true)
        .then(() => {
          console.log('Token refreshed before loading moderator data');
      fetchPendingComments();
      fetchPendingCounts();
      
      // Set up polling for pending counts (every 60 seconds)
      const intervalId = setInterval(fetchPendingCounts, 60000);
      
      // Clean up interval on unmount
      return () => {
        console.log('[ModPanel] Cleaning up interval');
        clearInterval(intervalId);
      };
        })
        .catch(err => {
          console.error('Failed to refresh token for moderator panel:', err);
          setError('Authentication error. Please try logging out and back in.');
        });
    }
  }, [fetchPendingComments, fetchPendingCounts, hasAccess, currentUser, userRole]);

  // Add error boundary for consistent error handling
  useEffect(() => {
    // Reset error after 5 seconds to prevent persistent errors
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // If user doesn't have the right permissions, show error
  if (!hasAccess) {
    return (
      <div className="moderator-panel error-panel">
        <h3>Access Denied</h3>
        <p>You don't have permission to access the moderator panel.</p>
      </div>
    );
  }

  // Debug function to test a specific comment
  const testSpecificComment = async (commentId) => {
    if (!currentUser) return;
    if (userRole !== 'moderator' && userRole !== 'admin') return;
    
    console.log(`Testing specific comment with ID: ${commentId}`);
    
    try {
      const token = await currentUser.getIdToken();
      const debugUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/comments/debug/${commentId}`;
      
      const response = await axios.get(
        debugUrl,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('Debug comment data:', response.data);
      setSuccessMessage(`Found comment with ID ${commentId}`);
    } catch (error) {
      console.error('Error in debug test:', error);
      setError(`Failed to find comment with ID ${commentId}`);
    }
  };

  // Function to handle moderator actions (approve/reject)
  const handleModeratorAction = async (userId, locationId, commentId, action) => {
    if (!currentUser) return;
    if (userRole !== 'moderator' && userRole !== 'admin') return;

    console.log('Approving/rejecting comment with:', {
      userId,
      locationId,
      commentId,
      action
    });
    
    // For debugging - test if we can find this comment directly
    await testSpecificComment(commentId);
    
    setLoading(true);
    setError(null);
    setSuccessMessage('');
    
    try {
      const token = await currentUser.getIdToken();
      
      // First try the direct ID-based endpoint (simpler, more reliable)
      let apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/comments/by-id/${commentId}`;
      console.log('Trying direct ID API URL:', apiUrl);
      
      try {
        const response = await axios.put(
          apiUrl,
          {
            status: action // 'approved' or 'rejected'
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        console.log('Comment moderation response:', response.data);
        
        // Remove the comment from the list
        setPendingComments(prev => prev.filter(comment => comment.id !== commentId));
        setPendingCount(prev => prev - 1);
        
        setSuccessMessage(`Comment ${action} successfully.`);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
        
        return; // Success! Exit early
      } catch (directIdError) {
        // If the direct ID approach fails, try the hierarchical approach
        console.error('Error with direct ID approach:', directIdError);
        
        // Fall through to the hierarchical approach
      }
      
      // Fallback to hierarchical approach if direct ID fails
      apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/comments/${userId}/${locationId}/${commentId}`;
      console.log('Falling back to hierarchical API URL:', apiUrl);
      
      const response = await axios.put(
        apiUrl,
        {
          status: action // 'approved' or 'rejected'
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('Comment moderation response:', response.data);
      
      // Remove the comment from the list
      setPendingComments(prev => prev.filter(comment => comment.id !== commentId));
      setPendingCount(prev => prev - 1);
      
      setSuccessMessage(`Comment ${action} successfully.`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error(`Error ${action} comment:`, error);
      
      // Provide a more detailed error message based on the error
      if (error.response) {
        if (error.response.status === 404) {
          setError(`Comment not found. The comment may have been deleted or the ID structure is incorrect.`);
        } else {
          setError(`Failed to ${action} comment: ${error.response.data?.error || error.message}`);
        }
      } else {
        setError(`Failed to ${action} comment. Please try again later.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="moderator-panel">
      <div className="moderator-panel-header">
        <h3>
          <FaComments /> Moderator Panel
          {pendingCount > 0 && (
            <span className="pending-count">
              <FaBell /> {pendingCount}
            </span>
          )}
        </h3>
        <button 
          className="refresh-button" 
          onClick={fetchPendingComments}
          disabled={loading}
          title="Refresh pending comments"
        >
          <FaSyncAlt className={loading ? 'spinning' : ''} />
        </button>
      </div>
      
      {/* Status messages */}
      {successMessage && <div className="status-message success">{successMessage}</div>}
      {error && <div className="status-message error">{error}</div>}
      
      {/* Pending comments list */}
      <div className="pending-items">
        <h4>Pending Comments ({pendingComments.length})</h4>
        
        {loading && pendingComments.length === 0 ? (
          <div className="loading-items">
            <FaSpinner className="spinner" /> Loading pending comments...
          </div>
        ) : pendingComments.length === 0 ? (
          <div className="no-pending-items">No pending comments to review.</div>
        ) : (
          <div className="pending-comments-list">
            {pendingComments.map(comment => (
              <div key={comment.id} className="pending-comment-item">
                <div className="pending-comment-header">
                  <div className="pending-comment-meta">
                    <span className="pending-comment-user">{comment.userDisplayName}</span>
                    <span className="pending-comment-date">{formatDate(comment.timestamp)}</span>
                  </div>
                  <div className="pending-comment-location">
                    <strong>Location:</strong> {comment.locationName}
                  </div>
                </div>
                <div className="pending-comment-content">{comment.content}</div>
                <div className="pending-comment-actions">
                  <button
                    className="approve-button"
                    onClick={() => handleModeratorAction(comment.userId, comment.locationId, comment.id, 'approved')}
                    disabled={loading}
                  >
                    <FaCheck /> Approve
                  </button>
                  <button
                    className="reject-button"
                    onClick={() => handleModeratorAction(comment.userId, comment.locationId, comment.id, 'rejected')}
                    disabled={loading}
                  >
                    <FaTimes /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModeratorPanel; 