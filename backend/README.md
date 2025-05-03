# Weather App Backend

## Email Configuration for OTP Verification

To receive OTP codes in your email (required for normal email/password login), you must properly configure the email settings:

## Option 1: Gmail (Recommended for Most Users)

1. Create a `.env` file in the backend directory with:

```
# Email Service for OTP delivery
EMAIL_SERVICE=Gmail
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-password
```

2. To create an App Password (required for Gmail):
   - Go to your Google Account → Security
   - Enable 2-Step Verification if not already done
   - Go to Security → App passwords
   - Select "Mail" and "Other (Custom name)" → enter "CloudWeatherPro"
   - Copy the 16-character password and use it for EMAIL_PASSWORD
   - **Important**: Do NOT use your regular Gmail password, it won't work!

## Option 2: Other Email Providers (Yahoo, Outlook, etc.)

```
EMAIL_SERVICE=Outlook  # or Yahoo, Hotmail, etc.
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

## Option 3: Custom SMTP Server

```
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-password
```

## Troubleshooting Email Issues

If you're still not receiving emails:

1. Check server logs for specific error messages
2. Make sure your antivirus/firewall isn't blocking the server
3. Check if your email provider is blocking the authentication:
   - For Gmail, make sure "Less secure app access" is enabled or use an App Password
   - For some providers, you might need to allow access from your IP address

## Google Sign-In MFA Bypass

For Google Sign-In users, MFA verification is automatically bypassed for a better user experience.

## Testing Without Email Configuration

During development, OTP codes are displayed in the server console. However, the app now requires properly configured email settings for normal operations.

If you just want to quickly test the application without setting up email:

1. Use Google Sign-In which doesn't require OTP verification
2. Or temporarily modify the code in `backend/routes/mfa.js` to allow bypassing email verification
