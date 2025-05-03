import React from 'react';
import { useAuth } from './AuthContext';
import './UserRoleBadge.css';

const UserRoleBadge = () => {
  const { userRole } = useAuth();

  if (!userRole) return null;

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return '#ff4444'; // Red for admin
      case 'moderator':
        return '#4a90e2'; // Blue for moderator
      case 'user':
        return '#4caf50'; // Green for user
      default:
        return '#888'; // Gray for unknown
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'moderator':
        return 'Moderator';
      case 'user':
        return 'User';
      default:
        return role;
    }
  };

  return (
    <div 
      className="user-role-badge"
      style={{ backgroundColor: getRoleColor(userRole) }}
    >
      {getRoleLabel(userRole)}
    </div>
  );
};

export default UserRoleBadge; 