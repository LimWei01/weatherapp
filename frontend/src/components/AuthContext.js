import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, 
         onAuthStateChanged, GoogleAuthProvider, signInWithPopup, 
         sendPasswordResetEmail, sendEmailVerification, fetchSignInMethodsForEmail } from 'firebase/auth';

const AuthContext = createContext();

// Set up a token refresh interval (in minutes)
const TOKEN_REFRESH_INTERVAL = 45; // minutes

// API URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Function to refresh the auth token
  async function refreshAuthToken() {
    try {
      if (auth.currentUser) {
        console.log('Refreshing Firebase auth token');
        await auth.currentUser.getIdToken(true);
        console.log('Token refreshed successfully');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
    }
  }

  // Function to update user profile in backend
  async function updateUserProfile(userId, userData) {
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update user profile');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  async function signup(email, password, displayName) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await sendEmailVerification(user);
      
      // Create user profile in backend
      await updateUserProfile(user.uid, {
        email: email,
        displayName: displayName,
        createdAt: new Date().toISOString(),
        emailVerified: false
      });
      
      return userCredential;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  }

  async function login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Reload user to get latest state
      await user.reload();
      
      // Check if this is a Google-authenticated user
      const isGoogleUser = user.providerData.some(provider => provider.providerId === 'google.com');
      
      // Only enforce email verification for non-Google users
      if (!user.emailVerified && !isGoogleUser) {
        await signOut(auth);
        throw new Error('Please verify your email before logging in. Check your inbox for a verification link.');
      }
      
      // Update currentUser state
      setCurrentUser(user);
      
      return userCredential;
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email. Please sign up first.');
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        // Check if this might be a Google account without password
        try {
          const signInMethods = await fetchSignInMethodsForEmail(auth, email);
          if (signInMethods.includes('google.com') && !signInMethods.includes('password')) {
            throw new Error('This account uses Google Sign-In. Please use the Google Sign-In button or set a password.');
          }
        } catch (secondaryError) {
          console.error('Error checking sign-in methods:', secondaryError);
        }
        throw new Error('Incorrect password. Please try again or reset your password.');
      }
      throw error;
    }
  }

  function logout() {
    return signOut(auth);
  }

  function googleSignIn() {
    return new Promise(async (resolve, reject) => {
      try {
        setLoading(true);
        console.log("Starting Google sign-in process");
        
        // Sign in with Google
        const result = await signInWithPopup(auth, googleProvider);
        console.log('Google sign-in successful, user:', result.user.email);

        // Create or update user profile in backend
        await updateUserProfile(result.user.uid, {
          email: result.user.email,
          displayName: result.user.displayName,
          lastSignInTime: new Date().toISOString(),
          emailVerified: true
        });

        // Force a reload of the user to ensure state is updated
        await result.user.reload();
        
        // Update the currentUser state
        setCurrentUser(result.user);
        console.log("Current user set after Google sign-in:", result.user.email);
        
        // Return the result
        resolve(result);
      } catch (error) {
        console.error('Google sign in error:', error);
        if (error.code === 'auth/too-many-requests') {
          reject(new Error('Account temporarily disabled due to many failed login attempts. Reset your password or try again later.'));
        } else if (error.code === 'auth/popup-closed-by-user') {
          reject(new Error('Sign in was cancelled'));
        } else {
          reject(error);
        }
      } finally {
        setLoading(false);
      }
    });
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Force a reload of the user to ensure we have the latest state
        await user.reload();
        setCurrentUser(user);
        
        // Refresh the token immediately on login
        refreshAuthToken();
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });
    
    // Set up scheduled token refresh every TOKEN_REFRESH_INTERVAL minutes
    const tokenRefreshInterval = setInterval(() => {
      refreshAuthToken();
    }, TOKEN_REFRESH_INTERVAL * 60 * 1000);

    // Add window unload event listener
    const handleUnload = () => {
      if (auth.currentUser) {
        signOut(auth);
      }
    };
    window.addEventListener('unload', handleUnload);

    return () => {
      unsubscribe();
      clearInterval(tokenRefreshInterval);
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

  const value = {
    currentUser,
    signup,
    login,
    logout,
    googleSignIn,
    resetPassword,
    refreshAuthToken,
    error,
    setError
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}