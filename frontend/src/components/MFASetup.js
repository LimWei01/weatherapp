import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { FaKey, FaSync, FaCheck } from 'react-icons/fa';

// Use the correct API URL from environment
const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api').replace(/%$/, '');

function MFASetup({ onComplete }) {
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const { currentUser } = useAuth();
  
  useEffect(() => {
    // Get MFA setup when component mounts
    if (currentUser) {
      setupMFA();
    }
  }, [currentUser]);
  
  const setupMFA = async (retryCount = 0) => {
    const maxRetries = 3;
    const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
    
    try {
      setLoading(true);
      setError('');
      
      // Get current ID token
      let idToken;
      try {
        idToken = await currentUser.getIdToken(retryCount > 0 ? false : true);
      } catch (tokenError) {
        if (tokenError.code === 'auth/quota-exceeded' && retryCount < maxRetries) {
          console.log(`Token quota exceeded. Retrying in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries})`);
          setError(`Rate limit reached. Retrying in ${waitTime / 1000} seconds...`);
          
          setTimeout(() => {
            setupMFA(retryCount + 1);
          }, waitTime);
          return;
        }
        throw tokenError;
      }
      
      // Request MFA setup - use the correct API URL
      const response = await axios.post(
        `${API_URL}/mfa/setup`,
        {},
        {
        headers: {
            'Authorization': `Bearer ${idToken}`
          }
        }
      );
      
      if (response.data.success) {
        setQrCode(response.data.qrCode);
        setSecret(response.data.secret);
        setLoading(false); // Set loading to false when successful
      } else {
        setError('Failed to setup MFA. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      console.log('MFA setup error:', error);
      
      // Handle axios errors more specifically
      if (error.response) {
        // The request was made and the server responded with an error status
        console.log('Error response:', error.response.data);
        setError(error.response.data.error || 'Server error. Please try again.');
      } else if (error.request) {
        // The request was made but no response was received
        console.log('No response received:', error.request);
        setError('No response from server. Please check your connection.');
      } else {
        // Something else happened
        setError('Failed to setup MFA. Please try again.');
      }
      
      if (error.code === 'auth/quota-exceeded' && retryCount < maxRetries) {
        console.log(`API quota exceeded. Retrying in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries})`);
        setError(`Rate limit reached. Retrying in ${waitTime / 1000} seconds...`);
        
        setTimeout(() => {
          setupMFA(retryCount + 1);
        }, waitTime);
        return;
      }
      
      setLoading(false);
    }
  };
  
  const verifySetup = async (e) => {
    e.preventDefault();
    
    if (token.length !== 6) {
      setError('Verification code must be 6 digits');
      return;
    }

    try {
      setVerifying(true);
      setError('');
      
      // Get current ID token with retry logic
      let idToken;
      try {
        // Use cached token instead of refreshing to avoid quota issues
        idToken = await currentUser.getIdToken(false);
      } catch (tokenError) {
        if (tokenError.code === 'auth/quota-exceeded') {
          // Wait for 2 seconds and try again
          await new Promise(resolve => setTimeout(resolve, 2000));
          idToken = await currentUser.getIdToken(false);
        } else {
          throw tokenError;
        }
      }
      
      // Set MFA setup in progress in the database
      try {
        await axios.post(
          `${API_URL}/mfa/verification-status`,
          { inProgress: true },
          {
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          }
        );
        console.log('[MFA] Set setup in progress status in database');
      } catch (statusError) {
        console.error('[MFA] Error setting setup status:', statusError);
        // Continue anyway - the main verification is more important
      }
      
      // Verify MFA token for setup
      console.log('[MFA] Sending setup verification request');
      const response = await axios.post(
        `${API_URL}/mfa/verify-setup`,
        { token },
        {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        }
      );

      if (response.data.success) {
        console.log('[MFA] Setup verification successful');
        setVerified(true);
        
        // Notify parent component that setup is complete after a short delay
        setTimeout(() => {
          if (onComplete && typeof onComplete === 'function') {
            console.log('[MFA] Calling setup complete callback');
            onComplete();
          }
        }, 1500);
      } else {
        setError('Verification failed. Please try again.');
        
        // Reset verification status in database on failure
        try {
          await axios.post(
            `${API_URL}/mfa/verification-status`,
            { inProgress: false },
            {
              headers: {
                'Authorization': `Bearer ${idToken}`
              }
            }
          );
          console.log('[MFA] Reset setup status in database after failure');
        } catch (statusError) {
          console.error('[MFA] Error resetting setup status:', statusError);
        }
      }
    } catch (error) {
      console.error('MFA verification error:', error);
      
      // Reset verification status in database in case of error
      try {
        const idToken = await currentUser.getIdToken(false);
        await axios.post(
          `${API_URL}/mfa/verification-status`,
          { inProgress: false },
          {
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          }
        );
        console.log('[MFA] Reset setup status in database after error');
      } catch (statusError) {
        console.error('[MFA] Error resetting setup status:', statusError);
      }
      
      if (error.response && error.response.data && error.response.data.error) {
        setError(error.response.data.error);
      } else {
        setError('Failed to verify code. Please try again.');
      }
    } finally {
      setVerifying(false);
    }
  };
  
  // Handle input change with cleanup
  const handleChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 6);
    setToken(value);
    setError('');
  };

  const formatSecret = (secret) => {
    // Format the secret into groups of 4 for easier reading
    if (!secret) return '';
    return secret.match(/.{1,4}/g).join(' ');
  };

  if (loading) {
    return (
      <div className="mfa-container">
        <div className="mfa-loading">
          <span className="loading-spinner"></span>
          <p>Setting up MFA...</p>
        </div>
      </div>
    );
  }
  
  if (verified) {
    return (
      <div className="mfa-container">
        <div className="mfa-success">
          <FaCheck className="mfa-success-icon" />
          <h2>MFA Enabled Successfully</h2>
          <p>Your account is now protected with two-factor authentication.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mfa-container">
      <div className="mfa-card">
        <div className="mfa-header">
          <FaKey className="mfa-icon" />
          <h2>Set Up Two-Factor Authentication</h2>
          <p>Secure your account with an authenticator app</p>
        </div>
        
        {error && <div className="mfa-error">{error}</div>}
        
        <div className="mfa-setup-steps">
          <div className="mfa-step">
            <h3>1. Scan this QR code</h3>
            <p>Use an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator</p>
            <div className="qr-code-container">
              {qrCode ? (
                <img src={qrCode} alt="QR Code for authenticator app" />
              ) : (
                <div className="qr-placeholder">
                  <FaSync className="qr-loading" />
              </div>
            )}
            </div>
          </div>
          
          <div className="mfa-step">
            <h3>2. Manual setup (if needed)</h3>
            <p>If you can't scan the QR code, enter this code manually:</p>
            <div className="secret-key">{formatSecret(secret)}</div>
          </div>
          
          <div className="mfa-step">
            <h3>3. Enter verification code</h3>
            <p>Enter the 6-digit code from your authenticator app to verify setup</p>
            <form onSubmit={verifySetup}>
              <div className="mfa-input-group">
              <input
                type="text"
                value={token}
                  onChange={handleChange}
                  placeholder="000000"
                  maxLength="6"
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={verifying}
              />
              </div>
              <button 
                type="submit" 
                className="mfa-button"
                disabled={verifying || token.length !== 6}
              >
                {verifying ? (
                  <span className="loading-spinner"></span>
                ) : (
                  <FaCheck />
                )}
                Verify & Activate
              </button>
            </form>
          </div>
        </div>
        </div>
      </div>
    );
  }
  
export default MFASetup; 