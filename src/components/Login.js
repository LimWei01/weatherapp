import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { FaEnvelope, FaLock, FaGoogle } from 'react-icons/fa';
import { WiDaySunny } from 'react-icons/wi';
import { fetchSignInMethodsForEmail, EmailAuthProvider, linkWithCredential } from 'firebase/auth';
import { auth } from '../firebase';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [showPasswordCreateForm, setShowPasswordCreateForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { login, googleSignIn, resetPassword, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect if already authenticated
    if (currentUser) {
      console.log("User already authenticated, redirecting to dashboard");
      navigate('/', { replace: true });
      return;
    }
  }, [currentUser, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return; // Prevent multiple submissions
    
    try {
      setError('');
      setLoading(true);
      
      // Check if this email is associated with Google Sign-In
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      if (signInMethods.includes('google.com') && !signInMethods.includes('password')) {
        // User has a Google account but no password set
        setShowPasswordCreateForm(true);
        setLoading(false);
        return;
      }
      
      console.log("Attempting email/password login for:", email);
      await login(email, password);
      
      console.log("Email/password login successful, navigating to dashboard");
      
      // Similar delay as Google sign-in for consistency
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Navigate to dashboard
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later or reset your password.');
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // First sign in with Google
      await googleSignIn();
      
      // Make sure we have a current user
      if (!auth.currentUser) {
        throw new Error('Failed to authenticate with Google first');
      }
      
      console.log("Current user before linking:", auth.currentUser.email);
      
      // Then link password to account
      const credential = EmailAuthProvider.credential(email, newPassword);
      
      try {
        const linkResult = await linkWithCredential(auth.currentUser, credential);
        console.log("Account linking successful", linkResult);
      } catch (linkError) {
        console.error("Error linking credential:", linkError);
        
        // If credential already exists, this might be a sign that we just need to try logging in directly
        if (linkError.code === 'auth/provider-already-linked' || 
            linkError.code === 'auth/email-already-in-use') {
          setError('This email already has a password. Try logging in with your email and password directly.');
          setShowPasswordCreateForm(false);
          return;
        }
        
        throw linkError;
      }
      
      // Ensure the user data is updated with the new credential
      await auth.currentUser.reload();
      
      setError('Password has been set successfully. You can now login with email and password.');
      setShowPasswordCreateForm(false);
      navigate('/', { replace: true });
    } catch (error) {
      console.error("Error setting password:", error);
      if (error.code === 'auth/requires-recent-login') {
        setError('For security, please sign in with Google again before setting a password. Please sign out and try again.');
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    if (loading) return; // Prevent multiple calls
    
    try {
      setError('');
      setLoading(true);
      
      console.log("Starting Google Sign-In...");
      const result = await googleSignIn();
      console.log("Google sign-in successful, result:", result ? "Success" : "Failed");
      
      // Add a small delay to ensure auth state is fully updated
      console.log("Waiting for auth state to update...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force navigation using window.location for a full page refresh
      console.log("Navigating to dashboard...");
      window.location.href = '/';
    } catch (error) {
      console.error('Google Sign-In error:', error);
      if (error.code === 'auth/too-many-requests') {
        setError('Too many sign-in attempts. Please try again later or use email/password if you have set one up.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled. Please try again.');
      } else {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    try {
      setError('');
      if (!resetEmail) {
        setError('Please enter your email address');
        return;
      }
      await resetPassword(resetEmail);
      setError('Password reset email sent. Please check your inbox.');
      setShowResetForm(false);
    } catch (error) {
      setError(error.message);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <WiDaySunny className="weather-icon" />
          <h2>Welcome Back</h2>
          <p>Enter your credentials to access your account</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        {!showResetForm && !showPasswordCreateForm ? (
          <>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <FaEnvelope className="input-icon" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <FaLock className="input-icon" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button 
                disabled={loading} 
                type="submit" 
                className="auth-button primary"
              >
                {loading ? 'Logging in...' : 'Log In with Email'}
              </button>
            </form>

            <div className="divider">
              <span>or</span>
            </div>

            <button 
              onClick={handleGoogleSignIn} 
              className="auth-button google"
              disabled={loading}
            >
              <FaGoogle className="button-icon" />
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </button>

            <div className="auth-links">
              <Link to="/signup">Need an account? Sign Up</Link>
              <div className="forgot-password-container">
                <Link 
                  to="#" 
                  className="forgot-password" 
                  onClick={(e) => {
                    e.preventDefault();
                    setShowResetForm(true);
                  }}
                >
                  Forgot your password?
                </Link>
              </div>
            </div>
          </>
        ) : showResetForm ? (
          <div className="reset-form">
            <h3>Reset Password</h3>
            <div className="form-group">
              <FaEnvelope className="input-icon" />
              <input
                type="email"
                placeholder="Enter your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>
            <button 
              onClick={handlePasswordReset}
              className="auth-button primary"
            >
              Send Reset Link
            </button>
            <button 
              className="auth-button secondary"
              onClick={() => setShowResetForm(false)}
            >
              Back to Login
            </button>
          </div>
        ) : showPasswordCreateForm ? (
          <div className="password-create-form">
            <h3>Create Password</h3>
            <p>Your account was created with Google Sign-In. Set a password to also log in with email.</p>
            <form onSubmit={handleCreatePassword}>
              <div className="form-group">
                <FaLock className="input-icon" />
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <FaLock className="input-icon" />
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <button 
                disabled={loading} 
                type="submit" 
                className="auth-button primary"
              >
                {loading ? 'Creating Password...' : 'Create Password'}
              </button>
              <button 
                className="auth-button secondary"
                onClick={() => setShowPasswordCreateForm(false)}
                type="button"
              >
                Back to Login
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Login;