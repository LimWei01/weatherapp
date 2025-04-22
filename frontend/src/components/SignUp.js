import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { FaUser, FaEnvelope, FaLock, FaInfoCircle } from 'react-icons/fa';
import { WiDaySunny } from 'react-icons/wi';

function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const validatePassword = (password) => {
    const hasCapital = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasMinLength = password.length >= 8;
    
    return {
      isValid: hasCapital && hasNumber && hasMinLength,
      errors: {
        capital: !hasCapital,
        number: !hasNumber,
        length: !hasMinLength
      }
    };
  };

  async function handleSubmit(e) {
    e.preventDefault();

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError('Please meet all password requirements');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setError('');
      setLoading(true);
      alert('Please check your email to verify your account before logging in.');
      navigate('/login', { replace: true });
      await signup(email, password, displayName);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <WiDaySunny className="weather-icon" />
          <h2>Create Account</h2>
          <p>Sign up to get started with Weather App</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <FaUser className="input-icon" />
            <input
              type="text"
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
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
          <div className="password-requirements">
            <FaInfoCircle className="info-icon" />
            <p>Password must contain:</p>
            <ul>
              <li className={password.match(/[A-Z]/) ? 'valid' : ''}>
                At least one capital letter
              </li>
              <li className={password.match(/[0-9]/) ? 'valid' : ''}>
                At least one number
              </li>
              <li className={password.length >= 8 ? 'valid' : ''}>
                Minimum 8 characters
              </li>
            </ul>
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
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Already have an account? Log In</Link>
        </div>
      </div>
    </div>
  );
}

export default Signup;