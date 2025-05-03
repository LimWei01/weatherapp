// routes/mfa.js
const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const MFA = require('../models/mfa');

// MFA setup
router.post('/setup', async (req, res) => {
  console.log('MFA setup request received:', {
    headers: req.headers,
    origin: req.headers.origin,
    method: req.method
  });
  try {
    const userId = req.user.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const mfaModel = new MFA(global.datastore);
    
    // Check if user already has MFA setup
    const existingSecret = await mfaModel.getSecret(userId);
    if (existingSecret) {
      return res.status(400).json({ error: 'MFA already setup for this user' });
    }

    // Generate a new secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `CloudWeatherPro:${req.user.email || userId}`
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store the secret for the user - DON'T store the QR code
    await mfaModel.generateSecret(userId, secret.base32);

    // Return the secret and QR code to display to the user
    res.status(200).json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ error: 'Failed to setup MFA' });
  }
});

// Endpoint to set MFA verification flow status
router.post('/verification-status', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { inProgress } = req.body;
    
    if (inProgress === undefined) {
      return res.status(400).json({ error: 'inProgress status is required' });
    }

    const mfaModel = new MFA(global.datastore);
    
    // Update verification status in database
    await mfaModel.updateVerificationStatus(userId, inProgress);
    
    res.status(200).json({ 
      success: true, 
      message: inProgress ? 'MFA verification in progress' : 'MFA verification completed'
    });
  } catch (error) {
    console.error('MFA verification status update error:', error);
    res.status(500).json({ error: 'Failed to update MFA verification status' });
  }
});

// Update the verify-setup endpoint to set verification status
router.post('/verify-setup', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const mfaModel = new MFA(global.datastore);
    const secret = await mfaModel.getSecret(userId);

    if (!secret) {
      return res.status(404).json({ error: 'MFA not set up for this user' });
    }

    console.log('Verifying TOTP with secret:', secret.secret);
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: secret.secret,
      encoding: 'base32',
      token: token,
      window: 4 // Allow 120 seconds before/after (more lenient)
    });

    console.log('TOTP verification result:', verified);

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Mark as verified in the database and clear verification in progress flag
    await mfaModel.verifySetup(userId);

    res.status(200).json({ success: true, message: 'MFA verified and enabled' });
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({ error: 'Failed to verify MFA' });
  }
});

// Update the verify endpoint to set verification status
router.post('/verify', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const mfaModel = new MFA(global.datastore);
    const secret = await mfaModel.getSecret(userId);

    if (!secret) {
      return res.status(404).json({ error: 'MFA not set up for this user' });
    }

    console.log('Verifying login TOTP with secret:', secret.secret);
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: secret.secret,
      encoding: 'base32',
      token: token,
      window: 4 // Allow 120 seconds before/after (more lenient)
    });
    
    console.log('Login TOTP verification result:', verified);

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Clear verification in progress flag
    await mfaModel.updateVerificationStatus(userId, false);

    res.status(200).json({ 
      success: true, 
      message: 'MFA verified successfully',
      userId: userId
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({ error: 'Failed to verify MFA' });
  }
});

// Update the status endpoint to include verification in progress
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const mfaModel = new MFA(global.datastore);
    const secret = await mfaModel.getSecret(userId);

    if (!secret) {
      return res.status(200).json({ 
        enabled: false,
        verified: false,
        setup: false,
        verificationInProgress: false
      });
    }

    res.status(200).json({
      enabled: secret.enabled !== false, // Default to true if field is missing
      verified: secret.verified === true,
      setup: true,
      verificationInProgress: secret.verificationInProgress === true
    });
  } catch (error) {
    console.error('MFA status check error:', error);
    res.status(500).json({ error: 'Failed to check MFA status' });
  }
});

// Toggle MFA state
router.post('/toggle', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({ error: 'Enabled status is required' });
    }

    const mfaModel = new MFA(global.datastore);
    const secret = await mfaModel.getSecret(userId);

    if (!secret) {
      return res.status(404).json({ error: 'MFA not set up for this user' });
    }

    // Update enabled status
    await mfaModel.updateSettings(userId, enabled);

    res.status(200).json({ 
      success: true, 
      message: enabled ? 'MFA enabled' : 'MFA disabled' 
    });
  } catch (error) {
    console.error('MFA toggle error:', error);
    res.status(500).json({ error: 'Failed to update MFA settings' });
  }
});

// Reset MFA for a user
router.delete('/reset', async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const mfaModel = new MFA(global.datastore);
    await mfaModel.deleteSecret(userId);

    res.status(200).json({ 
      success: true, 
      message: 'MFA reset successfully' 
    });
  } catch (error) {
    console.error('MFA reset error:', error);
    res.status(500).json({ error: 'Failed to reset MFA' });
  }
});

module.exports = router; 