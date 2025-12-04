# Setup Guide - Inventario API

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL 12+

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Create environment configuration
cp .env.example .env

# 3. Edit .env with your database credentials
nano .env
# Or on Windows:
# notepad .env
```

### Required Environment Variables

```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=inventario_db
DB_DIALECT=postgres

# Security
JWT_SECRET=your-very-long-random-secret-min-32-chars
SESSION_SECRET=your-session-secret-min-32-chars

# CORS
CORS_ORIGIN=http://localhost:3000

# Optional - Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Generate Secure Secrets

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate Session secret
openssl rand -hex 32

# Copy values to .env
```

### Running the Application

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
NODE_ENV=production npm start

# Check health
curl http://localhost:3000/health
```

---

## Database Setup

### Create PostgreSQL Database

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE inventario_db;

-- Create application user (best practice)
CREATE USER inventario_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE inventario_db TO inventario_user;

-- Update .env with these credentials
```

### Run Migrations (If Sequelize configured)

```bash
# Create migration
npx sequelize-cli migration:generate --name initial_schema

# Run migrations
npx sequelize-cli db:migrate

# Undo migrations
npx sequelize-cli db:migrate:undo:all
```

---

## Verify Security Setup

```bash
# Check npm audit
npm audit

# Test health endpoint
curl http://localhost:3000/health

# Test security headers
curl -I http://localhost:3000/health

# Expected headers:
# - X-Content-Type-Options: nosniff
# - X-Frame-Options: DENY
# - X-XSS-Protection: 1; mode=block
# - Strict-Transport-Security: max-age=31536000

# Test rate limiting (should return 429 after limit)
for i in {1..110}; do curl -s http://localhost:3000/health; done
```

---

## File Structure

```
inventario/
├── bin/
│   └── www                 # Application entry point
├── config/
│   ├── config.json        # Database config (use .env instead)
│   └── environment.js     # Environment configuration (NEW)
├── controllers/            # Route handlers
├── middleware/
│   ├── security.js        # Security middleware (NEW)
│   └── validators.js      # Input validation (NEW)
├── models/                # Sequelize models
├── migrations/            # Database migrations
├── routes/                # Express routes
├── views/                 # EJS templates
├── public/                # Static files
├── app.js                 # Express app (UPDATED)
├── package.json           # Dependencies (UPDATED)
├── .env.example          # Environment template (NEW)
├── .gitignore            # Git ignore rules (NEW)
├── SECURITY.md           # Security policy (NEW)
└── SETUP.md              # This file (NEW)
```

---

## Common Issues

### "Missing required environment variables"

**Solution**: Ensure all variables in `.env` are set:
```bash
# Check .env exists
ls -la .env

# Verify all required variables
grep -E "^[^#]" .env
```

### Database Connection Error

**Solution**: Test database connection:
```bash
# Test PostgreSQL connection
psql -h 127.0.0.1 -U postgres -d inventario_db -c "SELECT 1"

# Check .env values match
cat .env | grep DB_
```

### Rate limiting too restrictive

**Solution**: Adjust in `.env`:
```bash
# Increase limit for testing
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=60000  # 1 minute
```

### Port already in use

**Solution**: Change port or kill existing process:
```bash
# Use different port
PORT=3001 npm start

# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

---

## Next Steps

1. ✅ Set up environment variables
2. ✅ Configure database
3. ✅ Run the application
4. ⚠️ Update routes with input validation (see `middleware/validators.js`)
5. ⚠️ Implement authentication middleware
6. ⚠️ Configure CORS_ORIGIN for production
7. ⚠️ Set up monitoring and logging
8. ⚠️ Deploy with HTTPS

---

## Support

For more details on security, see [SECURITY.md](./SECURITY.md)

For more details on configuration, see [config/environment.js](./config/environment.js)
