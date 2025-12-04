# Security Policy & Best Practices

## Overview

This document outlines the security measures implemented in the Inventario API and best practices for maintaining a secure application.

---

## ✅ Security Improvements Implemented

### 1. **Environment Variables Management**

**Issue**: Database credentials and secrets were hardcoded in `config.json` and exposed in git history.

**Solution**:
- Created `.env` file (excluded from git via `.gitignore`)
- Created `.env.example` for reference
- Implemented `config/environment.js` for centralized configuration
- All sensitive data is loaded from environment variables only

**Usage**:
```bash
# Copy the example file
cp .env.example .env

# Edit with your actual values
nano .env

# Ensure NODE_ENV matches your deployment
export NODE_ENV=production
```

### 2. **Dependency Vulnerabilities Fixed**

| Package | Issue | Solution |
|---------|-------|----------|
| validator | CVE vulnerabilities in URL validation | Updated to 13.16.0 (secure) |
| body-parser | DoS vulnerability | Updated to 2.3.0+ |
| express | Updated to latest | 5.1.0 |

**To update dependencies**:
```bash
npm install
npm audit
```

### 3. **HTTP Security Headers (Helmet)**

**Implemented**:
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options (MIME sniffing prevention)
- XSS Protection headers
- Referrer Policy

**Configuration**: See `middleware/security.js`

### 4. **CORS Protection**

**Implemented**:
- Whitelist origin validation
- Restricted HTTP methods
- Credential handling
- Preflight caching

**Configuration**:
```javascript
CORS_ORIGIN=http://localhost:3000  // In .env
```

**Update for production**:
```bash
CORS_ORIGIN=https://yourdomain.com
```

### 5. **Rate Limiting**

**Purpose**: Prevent DDoS, brute force attacks, and API abuse

**Configuration** (in `.env`):
```
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100    # 100 requests per window
```

**Adjust based on your needs**:
- More restrictive for login endpoints: 5 requests per 15 minutes
- Less restrictive for public APIs: 1000 requests per 15 minutes

### 6. **Input Validation & Sanitization**

**Implemented**:
- Express-validator for strict input validation
- Automatic input sanitization (trimming, length limits)
- Type validation (email, URL, integer, date)
- Custom validation rules in `middleware/validators.js`

**Usage in routes**:
```javascript
const { body, validationResult } = require('express-validator');
const { validationRules, handleValidationErrors } = require('../middleware/validators');

router.post('/users',
  validationRules.email(),
  validationRules.password(),
  handleValidationErrors,
  createUser
);
```

### 7. **Request Size Limits**

**Implemented**:
- JSON payload limit: 10KB
- URL-encoded payload limit: 10KB

**Why**: Prevents memory exhaustion attacks and large payload bombs

**Modify if needed** (in `app.js`):
```javascript
express.json({ limit: '50kb' })  // Increase if needed
```

### 8. **Secure Cookie Handling**

**Implemented**:
- Cookie parser with session secret from environment
- HttpOnly flag (framework default)
- Secure flag in production (configured via reverse proxy)

**Configure in reverse proxy** (Nginx/Apache):
```nginx
proxy_cookie_path /;
proxy_cookie_flags ~ secure httponly samesite=strict;
```

### 9. **Error Handling & Information Disclosure**

**Implemented**:
- Stack traces hidden in production
- Generic error messages to clients
- Detailed logging for admins only
- Proper HTTP status codes

**Environment-based behavior**:
```javascript
if (config.isDevelopment) {
  // Show detailed errors
} else {
  // Show generic errors, log details separately
}
```

### 10. **Health Check Endpoint**

**Added**: `/health` endpoint for monitoring (excluded from rate limiting)

```bash
curl http://localhost:3000/health
# Response: { "status": "ok", "timestamp": "2025-12-04T..." }
```

---

## 🔐 Secret Management

### Critical Secrets to Protect

1. **JWT_SECRET**: Used for signing JWT tokens
   - Generate strong: `openssl rand -hex 32`
   - Minimum 32 characters
   - Rotate annually

2. **SESSION_SECRET**: Used for session encryption
   - Generate strong: `openssl rand -hex 32`
   - Minimum 32 characters

3. **Database credentials**: Never hardcode
   - Use database user with minimal permissions
   - Use separate credentials for each environment

### Secure Practices

```bash
# Never commit .env
cat .gitignore | grep .env

# Rotate secrets regularly
# 1. Update in environment
# 2. Redeploy application
# 3. Monitor for issues

# For production, use:
# - AWS Secrets Manager
# - Azure Key Vault
# - Hashicorp Vault
# - Kubernetes Secrets
```

---

## 🛡️ Application Hardening Checklist

- [x] Environment variables for all secrets
- [x] Security headers (Helmet)
- [x] CORS properly configured
- [x] Rate limiting enabled
- [x] Input validation & sanitization
- [x] Request size limits
- [x] Error handling without info disclosure
- [x] Dependencies up-to-date
- [x] .gitignore configured

**Additional items to implement**:

- [ ] HTTPS/TLS in production
- [ ] Database encryption
- [ ] Authentication (JWT/OAuth)
- [ ] Authorization (role-based access control)
- [ ] API versioning
- [ ] Comprehensive logging
- [ ] Intrusion detection
- [ ] Regular security audits
- [ ] Dependency scanning (npm audit in CI/CD)
- [ ] SQL injection prevention (use parameterized queries)

---

## 📋 Deployment Security

### Pre-Deployment Checklist

```bash
# 1. Run security audit
npm audit

# 2. Check for exposed secrets
npm run audit

# 3. Set environment variables
export NODE_ENV=production
export JWT_SECRET=your_secure_secret
# ... set all required variables

# 4. Verify configuration loads
node -e "require('./config/environment')"

# 5. Run tests
npm test

# 6. Build/Start application
npm start
```

### Production Environment Variables

```bash
NODE_ENV=production
PORT=8080

DB_HOST=db.example.com
DB_PORT=5432
DB_USERNAME=prod_user
DB_PASSWORD=*** (use secrets manager)
DB_NAME=inventario_prod
DB_DIALECT=postgres

JWT_SECRET=*** (use secrets manager)
SESSION_SECRET=*** (use secrets manager)

CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

LOG_LEVEL=warn
```

---

## 🔍 Security Monitoring

### Regular Tasks

1. **Weekly**: Run `npm audit`
2. **Monthly**: Review security logs
3. **Quarterly**: Update dependencies
4. **Annually**: Security assessment

### Monitoring Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Check rate limiting response
for i in {1..110}; do
  curl -s -w "%{http_code}\n" http://localhost:3000/api/endpoint
done
# Should see 429 status after rate limit
```

---

## 🚨 Incident Response

If a security issue is discovered:

1. **Assess severity**: Critical, High, Medium, Low
2. **Isolate affected systems** if necessary
3. **Patch or mitigate**
4. **Deploy fix**
5. **Rotate secrets** if credentials exposed
6. **Monitor for exploitation**
7. **Document incident**

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Guide](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)

---

## 📞 Reporting Security Issues

Found a vulnerability? Please report it responsibly:

1. Do NOT open public issues
2. Email: security@yourdomain.com
3. Include: Description, steps to reproduce, impact assessment
4. Allow 30 days for response before public disclosure

---

**Last Updated**: December 2024
**Next Review**: June 2025
