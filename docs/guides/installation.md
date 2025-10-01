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

- **Operating System**: Linux (DEBIAN/Ubuntu) or OmniOS
- **Node.js**: Version 22 or higher
- **Memory**: 512MB RAM minimum, 1GB recommended
- **Storage**: 2GB available disk space (for files, database, logs)
- **Network**: HTTPS port 443 access

### Recommended Production Environment

- **CPU**: 2+ cores
- **Memory**: 4GB+ RAM
- **Storage**: 100GB+ available space (depending on file storage needs)
- **Network**: Dedicated network interface, proper SSL certificates
- **Security**: Firewall configuration, regular backups

## Installation Methods

### Option 1: DEBIAN Package (Recommended)

For Ubuntu, Debian, and compatible systems:

```bash
# Download latest package
wget https://github.com/STARTcloud/armor/releases/latest/download/armor_*_amd64.deb

# Install package
sudo gdebi -n armor_*.deb

# Start service
sudo systemctl enable --now armor

# Check status
sudo systemctl status armor
```

Package installation includes:
- Armor application files at `/opt/armor/`
- Configuration at `/etc/armor/config.yaml`
- Systemd service with security restrictions
- Automatic user creation (`armor` system user)
- SSL certificate auto-generation

### Option 2: OmniOS Package

For OmniOS systems:

```bash
# Add STARTcloud repository (if not already added)
pkg set-publisher -g https://packages.startcloud.com/r151054 STARTcloud

# Install Armor package
pkg install armor

# Enable service
svcadm enable armor

# Check status
svcs armor
```

Package includes:
- Application at `/opt/armor/`
- SMF service manifest
- Configuration at `/etc/armor/config.yaml`
- Automatic dependency handling

### Option 3: From Source

For development or custom deployments:

```bash
# Clone repository
git clone https://github.com/STARTcloud/armor.git
cd armor

# Install dependencies
npm ci

# Configure application
cp packaging/config/production-config.yaml config.yaml
# Edit config.yaml with your settings

# Start application
npm start
```

## Initial Configuration

### Configuration File

Edit `/etc/armor/config.yaml` (package) or `config.yaml` (source):

```yaml
# Server configuration
server:
  domain: localhost
  port: 443
  enable_api_docs: true

# Authentication
authentication:
  jwt_secret: "your-jwt-secret-key-change-this"
  local:
    users:
      - username: admin
        password: admin123
        role: admin
        id: 1

# SSL Configuration  
ssl:
  key_file: "/etc/armor/ssl/key.pem"
  cert_file: "/etc/armor/ssl/cert.pem"
  generate_ssl: true

# Database
database:
  storage: "/var/lib/armor/database/armor.db"

# File serving
served_directory: "/var/lib/armor/files"
```

### Directory Setup

For source installations, create required directories:

```bash
# Create application user
sudo useradd -r -s /bin/false armor

# Create directories
sudo mkdir -p /var/lib/armor/files
sudo mkdir -p /var/lib/armor/database
sudo mkdir -p /var/log/armor
sudo mkdir -p /etc/armor/ssl

# Set permissions
sudo chown -R armor:armor /var/lib/armor
sudo chown -R armor:armor /var/log/armor
sudo chown -R armor:armor /etc/armor
```

## SSL Certificate Setup

### Auto-Generated (Development)

For testing:
```yaml
ssl:
  generate_ssl: true  # Armor creates self-signed certificate
```

### Let's Encrypt (Production)

For production with proper certificates:

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d armor.yourdomain.com

# Configure Armor
sudo nano /etc/armor/config.yaml
```

```yaml
ssl:
  generate_ssl: false
  key_file: "/etc/letsencrypt/live/armor.yourdomain.com/privkey.pem"
  cert_file: "/etc/letsencrypt/live/armor.yourdomain.com/fullchain.pem"
```

## Database Setup

Armor supports SQLite (default), PostgreSQL, and MySQL databases.

### SQLite (Default)

No additional setup required. SQLite database is created automatically.

```yaml
database:
  dialect: "sqlite"
  storage: "/var/lib/armor/database/armor.db"
  logging: false
```

### PostgreSQL Setup

#### Install Dependencies

```bash
# Add PostgreSQL support
npm install pg
```

#### Create Database and User

```bash
# Create database and user
sudo -u postgres createdb armor_db
sudo -u postgres createuser armor_user
sudo -u postgres psql -c "ALTER USER armor_user WITH PASSWORD 'armor_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE armor_db TO armor_user;"

# Critical: Set schema ownership for ENUM creation
sudo -u postgres psql -d armor_db -c "ALTER SCHEMA public OWNER TO armor_user;"
```

#### Configure Armor

```yaml
database:
  dialect: "postgres"
  host: "localhost"
  port: 5432
  database: "armor_db"
  username: "armor_user"
  password: "armor_password"
  logging: false
```

### MySQL Setup

#### Install Dependencies

```bash
# Add MySQL support
npm install mysql2
```

#### Create Database and User

```bash
# Connect to MySQL as root
mysql -u root -p

# Create database and user
CREATE DATABASE armor_db;
CREATE USER 'armor_user'@'localhost' IDENTIFIED BY 'armor_password';
GRANT ALL PRIVILEGES ON armor_db.* TO 'armor_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Configure Armor

```yaml
database:
  dialect: "mysql"
  host: "localhost"
  port: 3306
  database: "armor_db"
  username: "armor_user"
  password: "armor_password"
  logging: false
```

## Service Configuration

### DEBIAN/Ubuntu (systemd)

The package includes a secure systemd service:

```ini
[Unit]
Description=Armor - ARMOR Reliably Manages Online Resources
After=network.target

[Service]
Type=simple
User=armor
Group=armor
WorkingDirectory=/opt/armor
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10

# Security restrictions
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/armor /var/log/armor /etc/armor

[Install]
WantedBy=multi-user.target
```

### OmniOS (SMF)

SMF manifest provides robust service management:

```xml
<?xml version="1.0"?>
<!DOCTYPE service_bundle SYSTEM "/usr/share/lib/xml/dtd/service_bundle.dtd.1">
<service_bundle type='manifest' name='armor'>
  <service name='application/armor' type='service' version='1'>
    <method_context working_directory='/opt/armor'>
      <method_credential user='armor' group='armor'/>
    </method_context>
    <exec_method type='method' name='start' exec='/opt/armor/startup.sh' timeout_seconds='60'/>
    <exec_method type='method' name='stop' exec='/opt/armor/shutdown.sh' timeout_seconds='30'/>
  </service>
</service_bundle>
```

## Post-Installation

### First Access

1. **Open browser**: Navigate to `https://your-server` (or `https://localhost` for local)
2. **Login**: Use configured admin credentials
3. **Upload test file**: Verify file operations work
4. **Check API**: Visit `/api-docs` for Swagger UI
5. **Create API keys**: Generate keys for automation

### Production Hardening

1. **Change Default Passwords**:
   ```yaml
   authentication:
     local:
       users:
         - username: admin
           password: "strong-random-password"  # Change default!
   ```

2. **Configure Rate Limiting**:
   ```yaml
   rate_limiting:
     window_minutes: 15
     max_requests: 60
     message: "Rate limit exceeded"
   ```

3. **Secure File Directory**:
   ```bash
   sudo chmod 750 /var/lib/armor/files
   sudo chown armor:armor /var/lib/armor/files
   ```

## Backup and Recovery

### Configuration Backup
```bash
# Backup configuration
sudo cp /etc/armor/config.yaml /etc/armor/config.yaml.backup

# Backup database
sudo cp /var/lib/armor/database/armor.db /var/lib/armor/database/armor.db.backup
```

### Restore Process
```bash
# Stop service
sudo systemctl stop armor

# Restore configuration
sudo cp /etc/armor/config.yaml.backup /etc/armor/config.yaml

# Restore database  
sudo cp /var/lib/armor/database/armor.db.backup /var/lib/armor/database/armor.db

# Start service
sudo systemctl start armor
```

## Monitoring

### Health Checks

```bash
# Service status
sudo systemctl status armor

# File operations
curl -k https://localhost/

# API health
curl -k https://localhost/auth/methods

# Database check
sudo -u armor sqlite3 /var/lib/armor/database/armor.db ".tables"
```

### Log Monitoring

```bash
# Service logs
sudo journalctl -u armor -f

# File access logs (built into Armor)
sudo tail -f /var/log/armor/access.log

# Error logs
sudo tail -f /var/log/armor/error.log
```

---

## Troubleshooting

### Common Installation Issues

**Package Installation Failed**
- Check Node.js version: `node --version` (must be 22+)
- Verify architecture: `dpkg --print-architecture` (should be amd64)
- Check dependencies: `apt list --installed | grep nodejs`

**Service Won't Start**
```bash
# Check detailed status
sudo systemctl status armor -l

# Check configuration
sudo armor --check-config

# Verify file permissions
sudo ls -la /opt/armor/
```

**Port Access Issues**
- Check if port 443 is available: `sudo ss -tulpn | grep :443`
- Verify user has permission for privileged port
- Check firewall: `sudo ufw status`

---

Next: [Authentication](authentication/) - Configure user management and API keys
