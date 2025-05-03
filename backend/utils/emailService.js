const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a transporter using the service configuration from environment variables
let transporter = null;

// Initialize email transporter
function initTransporter() {
  // Only initialize once
  if (transporter) return;

  // Check if email service environment variables are set
  const emailService = process.env.EMAIL_SERVICE;
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  const emailHost = process.env.EMAIL_HOST;
  const emailPort = process.env.EMAIL_PORT;

  if (!emailUser || !emailPassword) {
    console.warn('Email credentials are not set. Email sending is disabled.');
    return;
  }

  try {
    // Create the transporter based on available config
    if (emailService) {
      // Service-based configuration (Gmail, Yahoo, etc.)
      transporter = nodemailer.createTransport({
        service: emailService,
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });
      console.log(`Email service initialized using ${emailService} service`);
    } else if (emailHost && emailPort) {
      // Custom SMTP server configuration
      transporter = nodemailer.createTransport({
        host: emailHost,
        port: parseInt(emailPort),
        secure: parseInt(emailPort) === 465, // true for 465, false for other ports
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });
      console.log(`Email service initialized using custom SMTP: ${emailHost}:${emailPort}`);
    } else {
      // Gmail fallback with OAuth2 option if available
      const clientId = process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;
      const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
      
      if (clientId && clientSecret && refreshToken) {
        // OAuth2 configuration for Gmail
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: emailUser,
            clientId,
            clientSecret,
            refreshToken,
          },
        });
        console.log('Email service initialized using Gmail with OAuth2');
      } else {
        // Simple Gmail configuration (app password required)
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: emailUser,
            pass: emailPassword,
          },
        });
        console.log('Email service initialized using Gmail with app password');
      }
    }

    // Verify the connection configuration
    transporter.verify(function(error, success) {
      if (error) {
        console.error('Email transporter verification failed:', error);
        transporter = null;
      } else {
        console.log('Email server is ready to send messages');
      }
    });
  } catch (error) {
    console.error('Error initializing email transporter:', error);
    transporter = null;
  }
}

// Function to send OTP email
async function sendOTPEmail(email, otp) {
  try {
    // Initialize transporter if not already done
    initTransporter();

    // If transporter couldn't be initialized
    if (!transporter) {
      console.error(`Cannot send OTP email to ${email} - Email service not configured properly`);
      return { success: false, error: 'Email service not configured properly' };
    }

    // Email options
    const mailOptions = {
      from: `"CloudWeatherPro" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your CloudWeatherPro Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50; text-align: center;">CloudWeatherPro Verification</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center;">
            <p>Your verification code is:</p>
            <h1 style="color: #3498db; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
            <p>This code will expire in 5 minutes.</p>
          </div>
          <p style="font-size: 12px; color: #7f8c8d; text-align: center; margin-top: 20px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `,
      // Add plaintext version as fallback
      text: `Your CloudWeatherPro verification code is: ${otp}. This code will expire in 5 minutes.`,
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return { success: false, error: error.message };
  }
}

// Export the functions
module.exports = {
  initTransporter,
  sendOTPEmail
}; 