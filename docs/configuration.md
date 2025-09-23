---
title: Configuration
layout: default
nav_order: 4
permalink: /docs/configuration/
---

# Configuration Reference
{: .no_toc }

Complete reference for configuring Armor using the configuration file.

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Configuration File Location

The main configuration file is located at:
- **Package Installation**: `/etc/armor/config.yaml`  
- **Development**: `config.yaml` or `dev.config.yaml`

### Configuration Priority

Armor loads configuration in this order:
1. `dev.config.yaml` (development override - highest priority)
2. `config.yaml` (production configuration)
3. `auth.yaml` (legacy fallback - lowest priority)

## Configuration Format

The configuration uses YAML format with the following structure:

```yaml
# Application metadata
version: 1.0.0

# Server configuration
server:
  domain: localhost
  port: 443
  enable_api_docs: true
  show_root_index: false

# Authentication configuration
authentication:
  jwt_secret: "your-jwt-secret-key-change-this"
  jwt_expiration: "24h"
  local:
    users:
      - username: admin
        password: admin123
        role: admin
        id: 1
      - username: user
        password: user123
        role: user
        id: 2
    allowed_directories: ["/"]
    static_directories: []

# SSL configuration
ssl:
  key_file: "/etc/armor/ssl/key.pem"
  cert_file: "/etc/armor/ssl/cert.pem"
  generate_ssl: true

# Database configuration
database:
  dialect: "sqlite"
  storage: "./file-metadata.db"
  logging: false

# Swagger UI configuration
swagger:
  allow_full_key_retrieval: false
  allow_temp_key_generation: true
  temp_key_expiration_hours: 1

# Rate limiting configuration
rate_limiting:
  window_minutes: 10
  max_requests: 100
  message: "Too many requests from this IP, please try again later."
  skip_successful_requests: false
  skip_failed_requests: false
```

## Configuration Sections

### Server Configuration

Controls the web server behavior and features.

```yaml
server:
  domain: localhost                    # Server domain/hostname
  port: 443                           # HTTPS port (requires privileged access)
  enable_api_docs: true               # Enable Swagger UI at /api-docs
  show_root_index: false              # Show file listing at root (/) 
  landing_title: "Armor"              # Landing page title
  landing_subtitle: "ARMOR Reliably Manages Online Resources"
  landing_description: "This is a secured download site"
  landing_icon_class: "bi bi-shield-check"
  landing_primary_color: "#198754"
  login_title: "Armor"                # Login page title
  login_primary_color: "#198754"      # Login page accent color
```

### Authentication Configuration

User authentication and authorization settings.

```yaml
authentication:
  jwt_secret: "your-jwt-secret-key-change-this"
  jwt_expiration: "24h"
  local:
    users:
      - username: admin               # Local user account
        password: admin123            # Plain text password (secured at startup)
        role: admin                   # Role: 'admin' or 'user'
        id: 1                        # Unique user ID
    allowed_directories: ["/"]        # Directories accessible via web
    static_directories: []           # Directories serving static content
```

#### OIDC Provider Configuration

For Google, Microsoft, or other OIDC authentication:

```yaml
authentication:
  oidc_providers:
    google:
      enabled: true
      client_id: "your-google-client-id"
      client_secret: "your-google-client-secret"
      display_name: "Sign in with Google"
      issuer: "https://accounts.google.com"
      scope: "openid email profile"
```

### SSL Configuration

HTTPS/TLS encryption settings.

```yaml
ssl:
  key_file: "/etc/armor/ssl/key.pem"
  cert_file: "/etc/armor/ssl/cert.pem"
  generate_ssl: true                  # Auto-generate self-signed certificates
  ssl_passphrase: ""                  # Optional key passphrase
```

For production, use proper certificates:
```yaml
ssl:
  generate_ssl: false
  key_file: "/etc/letsencrypt/live/domain.com/privkey.pem"
  cert_file: "/etc/letsencrypt/live/domain.com/fullchain.pem"
```

### Database Configuration

File metadata storage settings.

```yaml
database:
  dialect: "sqlite"                   # Database type (sqlite only)
  storage: "/var/lib/armor/database/armor.db"
  logging: false                      # Enable SQL query logging
  pool:
    max: 5                           # Maximum connections
    min: 0                           # Minimum connections
    idle: 10000                      # Idle timeout (ms)
```

### Swagger UI Configuration

API documentation interface settings.

```yaml
swagger:
  allow_full_key_retrieval: false    # Allow retrieving full API keys in browser
  allow_temp_key_generation: true    # Allow generating temporary testing keys
  temp_key_expiration_hours: 1       # Temporary key lifetime
```

**Security Note**: Only enable `allow_full_key_retrieval` in trusted environments.

### Rate Limiting Configuration

Protection against abuse and excessive requests.

```yaml
rate_limiting:
  window_minutes: 10                  # Time window for rate limiting
  max_requests: 100                   # Maximum requests per window
  message: "Too many requests from this IP, please try again later."
  skip_successful_requests: false     # Don't count successful requests
  skip_failed_requests: false         # Don't count failed requests
```

## User Roles and Permissions

### Admin Role (role: admin)
- **File operations**: Upload, download, delete, rename
- **Folder management**: Create and manage directories
- **API key creation**: Generate keys with any permissions (downloads, uploads, delete)
- **Full access**: All file operations and management features

### User Role (role: user)
- **File access**: Download files only
- **Browse directories**: Navigate file structure
- **API key creation**: Generate download-only keys
- **Limited access**: Cannot upload, delete, or modify files

## Environment-Specific Configuration

### Development Configuration

Create `dev.config.yaml` to override production settings:

```yaml
# Override specific settings for development
server:
  port: 8443
  enable_api_docs: true

database:
  logging: true

rate_limiting:
  max_requests: 1000  # More lenient for development
```

### Production Configuration

Secure settings for production deployment:

```yaml
server:
  port: 443
  enable_api_docs: false  # Disable for security

authentication:
  jwt_secret: "long-secure-random-secret"
  jwt_expiration: "8h"    # Shorter sessions

ssl:
  generate_ssl: false
  key_file: "/etc/letsencrypt/live/domain.com/privkey.pem"
  cert_file: "/etc/letsencrypt/live/domain.com/fullchain.pem"

rate_limiting:
  window_minutes: 15
  max_requests: 60
```

## Environment Variables

Configuration values can be overridden using environment variables:

```bash
# Server configuration
export ARMOR_SERVER_PORT=443
export ARMOR_SERVER_DOMAIN=armor.example.com

# SSL configuration  
export ARMOR_SSL_KEY_FILE=/path/to/key.pem
export ARMOR_SSL_CERT_FILE=/path/to/cert.pem

# Database configuration
export ARMOR_DATABASE_STORAGE=/custom/path/database.db

# Security configuration
export ARMOR_JWT_SECRET=your-secret-key
```

Environment variables use the format: `ARMOR_SECTION_OPTION`

## Production Recommendations

### 1. Secure Authentication
```yaml
authentication:
  jwt_secret: "$(openssl rand -hex 32)"  # Generate secure secret
  jwt_expiration: "8h"                   # Reasonable session length
```

### 2. Proper SSL Certificates
```yaml
ssl:
  generate_ssl: false
  key_file: "/etc/letsencrypt/live/your-domain.com/privkey.pem"
  cert_file: "/etc/letsencrypt/live/your-domain.com/fullchain.pem"
```

### 3. Rate Limiting
```yaml
rate_limiting:
  window_minutes: 15
  max_requests: 60                      # Adjust based on usage
  skip_successful_requests: false       # Count all requests for security
```

### 4. Database Security
```yaml
database:
  storage: "/var/lib/armor/database/armor.db"
  logging: false                        # Disable SQL logging in production
```

## Configuration Validation

Armor validates configuration on startup and will:
- Generate SSL certificates if needed
- Create database directories
- Validate user accounts
- Check file permissions
- Log configuration warnings

## Troubleshooting

### Common Configuration Issues

**Service Won't Start**
- Check config file syntax: `armor --check-config`
- Verify file permissions: `sudo chown armor:armor /etc/armor/config.yaml`
- Check logs: `sudo journalctl -u armor -f`

**SSL Certificate Errors**
- Verify certificate files exist and are readable
- Check certificate validity: `openssl x509 -in cert.pem -text -noout`
- Regenerate if needed: `sudo rm /etc/armor/ssl/* && sudo systemctl restart armor`

**Authentication Problems**
- Verify JWT secret is set
- Check user account configuration
- Test with basic auth: `curl -k -u admin:admin123 https://localhost/`

**Database Issues**
- Check SQLite file permissions: `sudo chown armor:armor /var/lib/armor/database/`
- Verify disk space available
- Test database: `sqlite3 /var/lib/armor/database/armor.db .tables`

---

For more help, see [Support Documentation](../support/) or [open an issue](https://github.com/STARTcloud/armor_private/issues).
