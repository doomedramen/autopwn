# Email Verification Setup Guide

This document explains how to configure email verification for AutoPWN.

## Overview

Email verification is **automatically enabled in production** (`NODE_ENV=production`) and **disabled in development/test** environments to simplify testing. This is a security feature to prevent account takeover attacks.

## Configuration

### Environment Variables

Add the following SMTP configuration to your `.env` file:

```bash
# Email Configuration (Required for production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@autopwn.local
```

### Common SMTP Providers

#### Gmail

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use these settings:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   ```

#### SendGrid

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

#### Mailgun

```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASS=your-mailgun-smtp-password
```

#### Amazon SES

```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

## Behavior by Environment

### Development (`NODE_ENV=development`)

- ✅ Email verification **disabled** - users can sign up without email verification
- 📧 Email content logged to console with formatted output
- 🔗 Verification URLs displayed in console for testing

### Test (`NODE_ENV=test`)

- ✅ Email verification **disabled** - tests can create users without verification
- 📧 Email content logged to console
- 🔗 No actual emails sent

### Production (`NODE_ENV=production`)

- ⚠️ Email verification **required** - users must verify email before accessing the app
- 📧 Actual emails sent via configured SMTP
- 🔒 Application will fail to start if SMTP is not configured
- ❌ Unverified accounts cannot access protected routes

## Testing Email Verification

### Development Testing

1. Start the API in development mode:
   ```bash
   pnpm dev
   ```

2. Sign up a new user via the web interface or API

3. Check the console output for the verification URL:
   ```
   ╔══════════════════════════════════════════════════════════════╗
   ║            📧 EMAIL VERIFICATION (Development Mode)          ║
   ╠══════════════════════════════════════════════════════════════╣
   ║ User: test@example.com                                        ║
   ║ Verification URL:                                            ║
   ║ http://localhost:3000/verify?token=...                       ║
   ║ Token: abc123...                                             ║
   ╠══════════════════════════════════════════════════════════════╣
   ║ ⚠️  SMTP not configured - email not sent                    ║
   ║ In production, configure SMTP to enable email verification  ║
   ╚══════════════════════════════════════════════════════════════╝
   ```

4. Copy the verification URL and paste it in your browser

### Production Testing

1. Configure SMTP in your production `.env` file

2. Set `NODE_ENV=production`

3. Sign up a new user - they should receive an email

4. Click the verification link in the email

5. User account should now be verified and can access the application

## Security Considerations

### Why Email Verification?

Without email verification:
- ❌ Attackers can sign up with any email address (including yours!)
- ❌ No way to verify account ownership
- ❌ Password reset could be abused
- ❌ Spam accounts can be created easily

With email verification:
- ✅ Proves the user owns the email address
- ✅ Prevents account takeover attacks
- ✅ Enables secure password reset
- ✅ Reduces spam account creation

### Verification Link Expiration

- Verification links expire after **24 hours**
- After expiration, users must request a new verification email
- This prevents old verification links from being used

### Rate Limiting

Email verification endpoints are protected by rate limiting:
- Maximum 10 verification requests per 15 minutes per IP
- Prevents abuse and email flooding

## Troubleshooting

### Emails Not Being Sent

1. **Check SMTP Configuration**
   ```bash
   # Verify your .env file has all required variables
   echo $SMTP_HOST
   echo $SMTP_USER
   ```

2. **Check Logs**
   ```bash
   # Look for email-related errors
   docker logs autopwn-api | grep email
   ```

3. **Test SMTP Connection**
   - The application verifies SMTP connection on startup
   - Check logs for "SMTP connection verified successfully"

### Common SMTP Errors

#### "Authentication Failed"
- Check your SMTP username and password
- For Gmail, ensure you're using an App Password, not your regular password

#### "Connection Timeout"
- Check if port 587 or 465 is blocked by your firewall
- Try using port 465 with SSL

#### "Self-signed Certificate"
- Some providers require SSL certificate validation
- Check provider documentation for SSL settings

### Verification Link Not Working

1. **Check Link Expiration**
   - Links expire after 24 hours
   - Request a new verification email

2. **Check Frontend URL**
   - Ensure `FRONTEND_URL` environment variable is set correctly
   - Verification links use this URL as the base

3. **Check Token Format**
   - Tokens should be URL-safe
   - Check if any special characters were encoded incorrectly

## API Endpoints

### Request Email Verification

```http
POST /api/auth/request-verification
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Verify Email

```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "token": "verification-token-here"
}
```

## Email Templates

Email templates are defined in `apps/api/src/lib/email.ts`:

- `sendVerificationEmail()` - Email verification template
- `sendPasswordResetEmail()` - Password reset template

Templates include:
- ✅ Responsive HTML design
- ✅ Plain text fallback
- ✅ Clear call-to-action buttons
- ✅ Security warnings
- ✅ Expiration notices

## Customization

### Custom Email Templates

To customize email templates, edit `apps/api/src/lib/email.ts`:

```typescript
async sendVerificationEmail(to: string, verificationUrl: string): Promise<boolean> {
  const subject = 'Verify your email address - YOUR_APP_NAME'

  const html = `
    <!-- Your custom HTML template -->
  `

  const text = `
    Your custom plain text template
  `

  return this.sendEmail({ to, subject, html, text })
}
```

### Custom SMTP Provider

The email service uses `nodemailer` which supports many SMTP providers. To use a custom provider:

1. Update `.env` with provider settings
2. Adjust port and security settings if needed
3. Test the connection

## Future Enhancements

Planned improvements:
- [ ] Email templates stored in database for easy editing
- [ ] Multi-language email support
- [ ] Email queue for better performance
- [ ] Email analytics (open rates, click rates)
- [ ] Custom email layouts per tenant

## Support

If you encounter issues with email verification:

1. Check this documentation first
2. Review logs for error messages
3. Verify SMTP configuration
4. Test with a different SMTP provider
5. Open an issue on GitHub with logs

---

**Last Updated:** 2025-10-23
