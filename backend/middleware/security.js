// Security-related middleware

/**
 * Middleware to enforce HTTPS in production environments
 */
const enforceHttps = (req, res, next) => {
  // Skip in development environment
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Check if the connection is already secure
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }

  // Redirect to HTTPS
  const httpsUrl = `https://${req.hostname}${req.originalUrl}`;
  return res.redirect(301, httpsUrl);
};

/**
 * Set security headers to protect against common web vulnerabilities
 */
const setSecurityHeaders = (req, res, next) => {
  // Set strict transport security header to enforce HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS protection in browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Control which features can be used in the browser
  res.setHeader('Feature-Policy', "camera 'none'; microphone 'none'");
  
  // Set content security policy to prevent XSS but allow necessary connections
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; connect-src * 'self'; img-src 'self' data: https://openweathermap.org; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-src 'self' https://accounts.google.com;");
  
  // Prevent browsers from disclosing sensitive information in referrer headers
  res.setHeader('Referrer-Policy', 'same-origin');
  
  // Set Cross-Origin-Opener-Policy to unsafe-none to allow Google Sign-In popups
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  
  // Remove custom CORS handling from here as it conflicts with the cors middleware
  // Let the cors middleware in server.js handle all CORS-related headers
  
  next();
};