---
title: Installation
layout: default
nav_order: 2
parent: Guides
permalink: /docs/guides/installation/
---

# Installation
{: .no_toc }

This guide covers different methods for installing and deploying Armor in various environments.

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## System Requirements

### Minimum Requirements

- **Operating System**: OmniOS, Linux, or other Unix-like system
- **Node.js**: Version 18 or higher
- **Memory**: 512MB RAM minimum, 1GB recommended
- **Storage**: 1GB available disk space
- **Network**: Internet access for package downloads

### Recommended Production Environment

- **CPU**: 2+ cores
- **Memory**: 2GB+ RAM
- **Storage**: 5GB+ available space (for logs and database)
- **Network**: Dedicated network interface
- **SSL**: Valid SSL certificates for HTTPS

## Installation Methods

### Option 1: Package Installation (Recommended)

For OmniOS systems, use the official package:

```bash
# Update package repository
pkg refresh

# Install Armor package
pkg install armor

# Enable and start service
svcadm enable armor

# Check service status
svcs armor
```

Package installation includes:
- Armor application files
- Configuration templates
- SMF service manifest
- Automatic dependency handling

### Option 2: From Source

For development or custom deployments:

```bash
# Clone repository
git clone https://github.com/STARTcloud/armor_private.git
cd armor

# Install backend dependencies
npm install

# Install frontend dependencies  
cd web
npm install
cd ..

# Build frontend
npm run build

# Configure application
cp packaging/config/production-config.yaml config/config.yaml
# Edit config.yaml as needed

# Start application
npm start
```

### Option 3: Development Setup

For development and testing:

```bash
# Clone repository
git clone https://github.com/STARTcloud/armor_private.git
cd armor

# Install all dependencies
npm install
cd web && npm install && cd ..

# Start in development mode (with auto-reload)
npm run dev
```

Development mode features:
- Auto-restart on file changes
- Detailed error logging
- Hot reload for frontend changes

## Configuration

### Configuration File Location

**Package Installation:**
```bash
/etc/armor/config.yaml
```

**Source Installation:**
```bash
./config/config.yaml
```

### Basic Configuration

```yaml
# Basic server settings
server:
  hostname: localhost
  port: 3443
  ssl:
    enabled: true
    generate_ssl: true  # Auto-generate for testing
    key: /etc/armor/ssl/key.pem
    cert: /etc/armor/ssl/cert.pem

# Application settings
app:
  name: Armor
  version: 0.0.15
  frontend_url: https://localhost:3443

# Database location
database:
  path: /var/lib/armor/database/armor.db

# Security settings
security:
  jwt_secret: "CHANGE-THIS-TO-A-SECURE-RANDOM-STRING"
  bcrypt_rounds: 10
  sessionTimeout: 24
  allow_new_organizations: true  # Disable after setup
```

### SSL Certificate Setup

#### Auto-Generated Certificates (Development)

For testing and development:
```yaml
server:
  ssl:
    enabled: true
    generate_ssl: true  # Armor generates self-signed cert
```

#### Production Certificates

For production deployments:
```yaml
server:
  ssl:
    enabled: true
    generate_ssl: false
    key: /etc/ssl/private/armor.key
    cert: /etc/ssl/certs/armor.crt
```

Generate certificates:
```bash
# Create certificate directory
mkdir -p /etc/ssl/armor

# Generate private key
openssl genrsa -out /etc/ssl/armor/armor.key 2048

# Generate certificate signing request
openssl req -new -key /etc/ssl/armor/armor.key \
  -out /etc/ssl/armor/armor.csr

# Get certificate from your CA or generate self-signed:
openssl x509 -req -days 365 \
  -in /etc/ssl/armor/armor.csr \
  -signkey /etc/ssl/armor/armor.key \
  -out /etc/ssl/armor/armor.crt

# Set permissions
chmod 600 /etc/ssl/armor/armor.key
chmod 644 /etc/ssl/armor/armor.crt
```

## Service Management

### OmniOS (SMF)

```bash
# Enable service
svcadm enable armor

# Disable service  
svcadm disable armor

# Restart service
svcadm restart armor

# Check service status
svcs -xv armor

# View service logs
svcs -L armor
tail -f /var/svc/log/application-armor:default.log
```

### Linux (systemd)

Create service file `/etc/systemd/system/armor.service`:

```ini
[Unit]
Description=Armor Frontend
After=network.target

[Service]
Type=simple
User=armor
WorkingDirectory=/opt/armor
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Service management:
```bash
# Enable and start service
systemctl enable --now armor

# Check status
systemctl status armor

# View logs
journalctl -u armor -f
```

## Directory Structure

### Package Installation

```
/opt/armor/              # Application files
/etc/armor/              # Configuration
/var/lib/armor/          # Database and data
/var/log/armor/          # Log files
/var/run/armor/          # Runtime files
```

### Source Installation

```
./                            # Application root
./config/                     # Configuration files
./web/dist/                   # Built frontend files
./logs/                       # Log files (if configured)
./database/                   # Database files
```

## Database Setup

Armor uses SQLite for user/organization data:

### Automatic Setup

Database is created automatically on first run with:
- User tables
- Organization tables
- Server configuration tables
- Session management tables

### Manual Database Initialization

If needed, initialize database manually:
```bash
# Navigate to application directory
cd /opt/armor

# Initialize database
node -e "
const Database = require('./models/Database.js');
Database.init().then(() => console.log('Database initialized'));
"
```

## Firewall Configuration

### OmniOS (ipfilter)

```bash
# Edit /etc/ipf/ipf.conf
echo "pass in quick proto tcp from any to any port = 3443" >> /etc/ipf/ipf.conf

# Reload firewall rules
ipf -Fa -f /etc/ipf/ipf.conf
```

### Linux (iptables)

```bash
# Allow HTTPS traffic
iptables -A INPUT -p tcp --dport 3443 -j ACCEPT

# Save rules (varies by distribution)
iptables-save > /etc/iptables/rules.v4
```

### Linux (firewalld)

```bash
# Open port for Armor
firewall-cmd --permanent --add-port=3443/tcp
firewall-cmd --reload
```

## Reverse Proxy Setup

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name armor.example.com;
    
    ssl_certificate /etc/ssl/certs/armor.crt;
    ssl_certificate_key /etc/ssl/private/armor.key;
    
    location / {
        proxy_pass https://127.0.0.1:3443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Apache

```apache
<VirtualHost *:443>
    ServerName armor.example.com
    
    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/armor.crt
    SSLCertificateKeyFile /etc/ssl/private/armor.key
    
    ProxyPreserveHost On
    ProxyRequests Off
    ProxyPass / https://127.0.0.1:3443/
    ProxyPassReverse / https://127.0.0.1:3443/
</VirtualHost>
```

## Post-Installation

### First Access

1. **Navigate** to `https://your-server:3443`
2. **Create Organization** (if enabled)
3. **Register Admin User**
4. **Configure Settings**
5. **Add Armor API Servers**

### Security Hardening

1. **Disable Organization Creation**:
   ```yaml
   security:
     allow_new_organizations: false
   ```

2. **Strong JWT Secret**:
   ```bash
   # Generate secure random string
   openssl rand -hex 32
   ```

3. **Regular Updates**:
   ```bash
   # Package installation
   pkg update armor
   
   # Source installation  
   git pull origin main
   npm install
   npm run build
   ```

## Troubleshooting

### Installation Issues

**Package Not Found**
```bash
# Update package repository
pkg refresh
pkg search armor
```

**Node.js Version Issues**
```bash
# Check Node.js version
node --version

# Update Node.js if needed
pkg install nodejs-18
```

**Permission Denied**
```bash
# Fix file permissions
chown -R armor:armor /opt/armor
chmod +x /opt/armor/index.js
```

### Service Issues

**Service Won't Start**
```bash
# Check service status and logs
svcs -xv armor
tail -f /var/svc/log/application-armor:default.log
```

**Port Already in Use**
```bash
# Find process using port 3443
lsof -i :3443
netstat -tulpn | grep 3443
```

**SSL Certificate Errors**
```bash
# Verify certificate files exist and have correct permissions
ls -la /etc/armor/ssl/
```

---

Next: [Authentication](authentication/) - Set up user management
