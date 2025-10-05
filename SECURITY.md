# Security Policy

## Ethical Use Statement

AutoPWN is designed for **authorized security testing and educational purposes only**. This tool should only be used:

- On networks you own
- On networks where you have explicit written permission to perform security testing
- In controlled lab environments for educational purposes
- For authorized penetration testing engagements

**Unauthorized access to computer networks is illegal** and may result in criminal prosecution under laws such as:
- Computer Fraud and Abuse Act (CFAA) in the United States
- Computer Misuse Act in the United Kingdom
- Similar legislation in other jurisdictions

## Reporting Security Issues

If you discover a security vulnerability in AutoPWN itself (the software, not its intended use), please report it responsibly:

### How to Report

1. **Do NOT** open a public GitHub issue
2. Email security details to: m@rtin.page
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: 90 days

### Disclosure Policy

- We ask that you allow us time to fix the vulnerability before public disclosure
- We will credit you in the security advisory (unless you prefer to remain anonymous)
- We may ask for your assistance in validating the fix

## Supported Versions

Security updates are provided for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Best Practices

When using AutoPWN:

### Deployment
- **Never expose the web dashboard to the public internet** without authentication
- Use Docker network isolation
- Keep dependencies updated
- Use strong passwords for any authentication you add
- Run containers with minimal privileges
- Use read-only volumes where possible

### Data Handling
- Cracked passwords contain sensitive information
- Secure the SQLite database file
- Use encryption for data at rest if needed
- Implement proper access controls
- Regularly backup and securely delete old data

### Environment
- Keep `.env` files secure and never commit them
- Use environment-specific configurations
- Rotate any credentials regularly
- Monitor for unauthorized access

### Updates
- Regularly update AutoPWN to the latest version
- Keep Docker images updated
- Update hashcat and hcxtools
- Monitor for security advisories

## Responsible Use Guidelines

1. **Authorization**: Always obtain written permission before testing
2. **Scope**: Stay within the agreed scope of testing
3. **Reporting**: Report findings to the network owner
4. **Cleanup**: Remove any test files or data after testing
5. **Confidentiality**: Keep findings confidential until addressed

## Legal Disclaimer

The developers of AutoPWN:
- Provide this software "as is" without warranty
- Are not responsible for misuse of this software
- Do not endorse or encourage illegal activity
- Assume no liability for damages or legal consequences

By using AutoPWN, you agree to use it responsibly and in accordance with all applicable laws and regulations.

## Contact

For security concerns: m@rtin.page
For general questions: [GitHub Issues](https://github.com/DoomedRamen/autopwn/issues)
