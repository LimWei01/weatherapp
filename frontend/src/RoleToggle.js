import React, { useState, useEffect } from 'react';
import { useAuth } from './components/AuthContext';
import { getAuth } from 'firebase/auth';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const RoleToggle = () => {
  const { currentUser, userRole, refreshAuthToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedRole, setSelectedRole] = useState('admin');

  useEffect(() => {
    if (userRole) {
      setSelectedRole(userRole);
    }
  }, [userRole]);

  const handleRoleChange = async () => {
    if (!currentUser) {
      setError('You must be logged in to change your role');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Get a fresh token
      const token = await currentUser.getIdToken(true);
      
      // Call the role update API
      const response = await axios.put(
        `${API_URL}/users/${currentUser.uid}/role`,
        { role: selectedRole },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.role === selectedRole) {
        setSuccess(`Role changed to ${selectedRole}. Please log out and log in again.`);
        
        // Refresh the token to get the new role
        await refreshAuthToken();
      } else {
        setError(`Role update failed. Expected ${selectedRole}, got ${response.data.role || 'nothing'}`);
      }
    } catch (error) {
      console.error('Error updating role:', error);
      setError(error.response?.data?.error || error.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Manual development method to update local role state
  const setLocalAdminRole = () => {
    // This is for development only
    localStorage.setItem('DEV_ADMIN_OVERRIDE', 'true');
    setSuccess('Admin override enabled. Reload the page to see changes.');
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      zIndex: 9999,
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
    }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Role Manager</h3>
      
      {currentUser ? (
        <>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Current role: <strong>{userRole || 'user'}</strong>
            </label>
            
            <select 
              value={selectedRole} 
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{
                width: '100%',
                padding: '5px',
                marginBottom: '10px',
                borderRadius: '4px'
              }}
            >
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
            
            <button 
              onClick={handleRoleChange} 
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Updating...' : `Set Role to ${selectedRole}`}
            </button>
            
            <button 
              onClick={setLocalAdminRole}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                background: '#ff9800',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              Enable Admin Override
            </button>
          </div>
          
          {error && (
            <div style={{ 
              color: '#f44336', 
              marginTop: '10px', 
              padding: '8px',
              background: 'rgba(244, 67, 54, 0.1)', 
              borderRadius: '4px' 
            }}>
              {error}
            </div>
          )}
          
          {success && (
            <div style={{ 
              color: '#4caf50', 
              marginTop: '10px', 
              padding: '8px',
              background: 'rgba(76, 175, 80, 0.1)', 
              borderRadius: '4px' 
            }}>
              {success}
            </div>
          )}
        </>
      ) : (
        <div>Please log in to manage roles</div>
      )}
    </div>
  );
};

export default RoleToggle; 