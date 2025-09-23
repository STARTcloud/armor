---
title: Configuration
layout: default
nav_order: 4
permalink: /docs/configuration/
---

# Configuration Reference
{: .no_toc }

Complete reference for configuring the Armor using the configuration file.

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Configuration File Location

The main configuration file is located at:
- **Package Installation**: `/etc/armor/config.yaml`  
- **Development**: `config/config.yaml`

## Configuration Format

The configuration uses YAML format with the following structure:

```yaml
app:
  name: "Armor"
  version: "1.0.0"
  description: "Armor Reliably Manages Online Resources"

server:
  port: 3443
  host: "0.0.0.0"

ssl:
  enabled: true
  key_path: "/etc/armor/ssl/server.key"
  cert_path: "/etc/armor/ssl/server.crt"
  force_ssl: true

mail:
  smtp_host: "localhost"
  smtp_port: 587
  smtp_secure: false
  smtp_auth_user: ""
  smtp_auth_pass: ""
  from_email: "noreply@armor.local"
  from_name: "Armor"

security:
  jwt_secret: "auto-generated-secret"
  jwt_expiry: "24h"
  session_timeout: 3600
  bcrypt_rounds: 12

database:
  dialect: "sqlite"
  storage: "/var/lib/armor/database/armor.db"
  logging: false

frontend:
  theme: "default"
  logo_url: "/web/public/images/logo.png"
  favicon_url: "/web/public/favicon.ico"
  company_name: "Your Company"

cors:
  origin: "*"
  credentials: true

backend_servers:
  default_timeout: 30000
  retry_attempts: 3
  ssl_verify: true

environment: "production"

logging:
  level: "info"
  file: "/var/log/armor/armor.log"
  max_size: "10MB"
  max_files: 5

limits:
  max_organizations: 50
  max_users_per_org: 100
  max_backend_servers: 10

gravatar:
  enabled: true
  default_avatar: "identicon"
  rating: "g"
```

## Configuration Sections

### App Configuration

Basic application metadata and identification.

```yaml
app:
  name: "Armor"
  version: "1.0.0" 
  description: "Armor Reliably Manages Online Resources"
```

### Server Configuration

Controls the web server behavior and network binding.

```yaml
server:
  port: 3443              # HTTPS port
  host: "0.0.0.0"         # Bind address
  trust_proxy: false      # Trust proxy headers
```

### SSL Configuration

Configures HTTPS/TLS encryption (highly recommended for production).

```yaml
ssl:
  enabled: true
  key_path: "/etc/armor/ssl/server.key"
  cert_path: "/etc/armor/ssl/server.crt"
  ca_path: "/etc/armor/ssl/ca.crt"    # Optional
  force_ssl: true                          # Redirect HTTP to HTTPS
  protocols: ["TLSv1.2", "TLSv1.3"]      # Supported protocols
```

### Mail Configuration

Email settings for notifications and user management.

```yaml
mail:
  smtp_host: "smtp.example.com"
  smtp_port: 587
  smtp_secure: true                        # Use TLS
  smtp_auth_user: "armor@example.com"
  smtp_auth_pass: "password"
  from_email: "noreply@armor.example.com"
  from_name: "Armor System"
```

### Security Configuration

Authentication and security-related settings.

```yaml
security:
  jwt_secret: "your-secret-key-here"       # JWT signing secret
  jwt_expiry: "24h"                        # Token expiration
  session_timeout: 3600                    # Session timeout (seconds)
  bcrypt_rounds: 12                        # Password hashing rounds
  password_min_length: 8                   # Minimum password length
  require_email_verification: true         # Require email verification
```

### Database Configuration

Database connection and behavior settings.

```yaml
database:
  dialect: "sqlite"
  storage: "/var/lib/armor/database/armor.db"
  logging: false                           # Enable SQL query logging
  pool:
    max: 5                                 # Max connections
    min: 0                                 # Min connections
    idle: 10000                            # Idle timeout
```

### Frontend Configuration

Web interface customization and branding.

```yaml
frontend:
  theme: "default"
  logo_url: "/web/public/images/logo.png"
  favicon_url: "/web/public/favicon.ico"
  company_name: "Your Company"
  company_url: "https://example.com"
  footer_text: "© 2025 Your Company"
```

### CORS Configuration

Cross-Origin Resource Sharing settings.

```yaml
cors:
  origin: ["https://example.com", "https://app.example.com"]
  credentials: true
  methods: ["GET", "POST", "PUT", "DELETE"]
  allowed_headers: ["Content-Type", "Authorization"]
```

### Backend Servers Configuration

Settings for connecting to Armor instances.

```yaml
backend_servers:
  default_timeout: 30000                   # Connection timeout (ms)
  retry_attempts: 3                        # Retry failed requests
  ssl_verify: true                         # Verify SSL certificates
  connection_pool_size: 10                 # Connection pool size
```

### Environment Settings

Runtime environment configuration.

```yaml
environment: "production"                  # Environment mode
debug: false                              # Enable debug mode
```

### Logging Configuration

Application logging settings.

```yaml
logging:
  level: "info"                           # Log level
  file: "/var/log/armor/armor.log"
  console: false                          # Log to console
  max_size: "10MB"                        # Max log file size
  max_files: 5                            # Max log files to keep
  date_pattern: "YYYY-MM-DD"              # Log rotation pattern
```

### Resource Limits

System resource and usage limits.

```yaml
limits:
  max_organizations: 50                   # Max organizations
  max_users_per_org: 100                  # Max users per organization
  max_backend_servers: 10                 # Max backend server connections
  max_concurrent_requests: 1000           # Max concurrent requests
  rate_limit_requests: 100                # Requests per minute per IP
```

### Gravatar Configuration

User avatar integration with Gravatar service.

```yaml
gravatar:
  enabled: true                           # Enable Gravatar integration
  default_avatar: "identicon"             # Default avatar type
  rating: "g"                             # Content rating
  size: 80                                # Default avatar size
```

## Environment Variables

Configuration values can be overridden using environment variables:

```bash
# Server configuration
export ARMOR_SERVER_PORT=3443
export ARMOR_SERVER_HOST=0.0.0.0

# SSL configuration
export ARMOR_SSL_KEY_PATH=/path/to/key.pem
export ARMOR_SSL_CERT_PATH=/path/to/cert.pem

# Database configuration
export ARMOR_DATABASE_STORAGE=/custom/path/database.db

# Security configuration
export ARMOR_SECURITY_JWT_SECRET=your-secret-key
```

Environment variables use the format: `ARMOR_SECTION_OPTION`

## Production Recommendations

For production deployments:

1. **Enable HTTPS**:
   ```yaml
   ssl:
     enabled: true
     force_ssl: true
     key_path: /etc/ssl/private/armor.key
     cert_path: /etc/ssl/certs/armor.crt
   ```

2. **Secure JWT Secret**:
   ```yaml
   security:
     jwt_secret: "long-random-secure-secret-key"
     jwt_expiry: "1h"
     session_timeout: 1800
   ```

3. **Configure SMTP**:
   ```yaml
   mail:
     smtp_host: "your-smtp-server.com"
     smtp_port: 587
     smtp_secure: true
     smtp_auth_user: "armor@yourdomain.com"
   ```

4. **Set Resource Limits**:
   ```yaml
   limits:
     max_organizations: 10
     max_users_per_org: 50
     rate_limit_requests: 60
   ```

## Configuration Validation

The application validates configuration on startup and will log warnings for:
- Missing SSL certificates (when HTTPS is enabled)
- Invalid SMTP settings
- Missing JWT secret
- Invalid database storage directory
- Unreachable backend servers

## Configuration Backup

Create backups of your configuration:

```bash
# Create backup
cp /etc/armor/config.yaml /etc/armor/config.yaml.backup

# Restore from backup
cp /etc/armor/config.yaml.backup /etc/armor/config.yaml
svcadm restart armor
