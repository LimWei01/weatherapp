import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function PrivateRoute({ children }) {
  const { currentUser } = useAuth();

  // Redirect to login if not authenticated
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Only check email verification for non-Google users
  const isGoogleUser = currentUser.providerData.some(provider => provider.providerId === 'google.com');
  
  if (!currentUser.emailVerified && !isGoogleUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
}