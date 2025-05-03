import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaKey, FaCheck, FaArrowRight } from 'react-icons/fa';
import axios from 'axios';
import { useAuth } from './AuthContext';
import './MFAVerify.css';

// Fix the API URL construction to avoid double /api
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function MFAVerify({ onSuccess }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Auto-focus the input field
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Reset timer to match server TOTP window
    const now = new Date();
    const secondsIntoCurrentWindow = now.getSeconds() % 60;
    const initialCountdown = 60 - secondsIntoCurrentWindow;
    
    setCountdown(initialCountdown);
    
    // Set up countdown timer for TOTP refresh
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // When timer hits zero, clear the input field
          setToken('');
          // Auto-focus the input field again
          if (inputRef.current) {
            inputRef.current.focus();
          }
          return 60; // Reset to 60 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Handle input change with auto-submit when 6 digits entered
  const handleChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 6);
    setToken(value);
    setError('');

    // Auto-submit when 6 digits are entered, but with a small delay
    // to let the user see what they've entered
    if (value.length === 6) {
      setTimeout(() => {
        handleSubmit(e);
      }, 300);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (token.length !== 6) {
      setError('Verification code must be 6 digits');
      return;
    }

    if (!currentUser) {
      setError('Authentication error. Please try logging in again.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Get current ID token with retry logic for quota errors
      let idToken;
      try {
        // Use cached token (false) instead of forcing refresh (true) to avoid quota limits
        idToken = await currentUser.getIdToken(false);
      } catch (tokenError) {
        if (tokenError.code === 'auth/quota-exceeded') {
          // Wait for 2 seconds and retry
          setError('Temporarily rate limited. Retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          idToken = await currentUser.getIdToken(false);
        } else {
          throw tokenError;
        }
      }
      
      // Set MFA verification in progress in database
      try {
        await axios.post(
          `${API_URL}/api/mfa/verification-status`,
          { inProgress: true },
          {
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          }
        );
        console.log('[MFA] Set verification in progress status in database');
      } catch (statusError) {
        console.error('[MFA] Error setting verification status:', statusError);
        // Continue anyway - the main verification is more important
      }
      
      // Verify MFA token
      console.log('[MFA] Sending verification request to backend');
      const response = await axios.post(
        `${API_URL}/api/mfa/verify`, 
        { token }, 
        {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        }
      );
      
      if (response.data.success) {
        console.log('[MFA] Verification successful');
        
        if (onSuccess && typeof onSuccess === 'function') {
          console.log('[MFA] Calling success callback');
          onSuccess();
        } else {
          console.log('[MFA] No success callback, navigating to home');
          navigate('/');
        }
      }
    } catch (error) {
      console.error('MFA verification error:', error);
      
      // Reset verification status in database in case of error
      try {
        const idToken = await currentUser.getIdToken(false);
        await axios.post(
          `${API_URL}/api/mfa/verification-status`,
          { inProgress: false },
          {
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          }
        );
        console.log('[MFA] Reset verification status in database after error');
      } catch (statusError) {
        console.error('[MFA] Error resetting verification status:', statusError);
      }
      
      // Special handling for quota exceeded errors
      if (error.code === 'auth/quota-exceeded') {
        setError('Temporarily rate limited. Please wait a moment and try again.');
        // Auto retry after 3 seconds
        setTimeout(() => {
          setError('');
          handleSubmit(e);
        }, 3000);
        return;
      }
      
      // More detailed error handling
      if (error.response) {
        setError(error.response.data.error || 'Server error. Please try again.');
      } else if (error.request) {
        setError('No response from server. Please check your connection.');
      } else {
        setError('Failed to verify code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="mfa-container">
      <div className="mfa-card">
        <div className="mfa-header">
        <FaKey className="mfa-icon" />
        <h2>Two-Factor Authentication</h2>
          <p>Enter the 6-digit code from your authenticator app</p>
      </div>
      
      {error && <div className="mfa-error">{error}</div>}
      
        <form onSubmit={handleSubmit}>
          <div className="mfa-input-group">
          <input
              ref={inputRef}
            type="text"
            value={token}
              onChange={handleChange}
              placeholder="000000"
              maxLength="6"
              inputMode="numeric"
            autoComplete="one-time-code"
              disabled={loading}
            />
            <div className="countdown-indicator">
              <div className="countdown-ring">
                <svg width="40" height="40">
                  <circle
                    className="countdown-circle-bg"
                    cx="20"
                    cy="20"
                    r="15"
                  />
                  <circle
                    className="countdown-circle"
                    cx="20"
                    cy="20"
                    r="15"
                    style={{
                      strokeDashoffset: `${94.2 - (94.2 * countdown) / 60}`,
                    }}
                  />
                </svg>
                <span className="countdown-number">{countdown}</span>
              </div>
            </div>
        </div>
          
          <button 
            type="submit"
            className="mfa-button"
            disabled={loading || token.length !== 6}
          >
            {loading ? (
              <span className="loading-spinner"></span>
            ) : token.length === 6 ? (
              <FaCheck />
            ) : (
              <FaArrowRight />
            )}
            Verify
          </button>
        </form>

        <div className="mfa-footer">
          <p>
            Open your authenticator app to view your code
          </p>
        </div>
      </div>
    </div>
  );
}

export default MFAVerify;