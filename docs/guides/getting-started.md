---
title: Getting Started
layout: default
nav_order: 1
parent: Guides
permalink: /docs/guides/getting-started/
---

# Getting Started
{: .no_toc }

This guide will walk you through setting up Armor for the first time, from initial installation to configuring your first Armor API connection.

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** - Required for running the frontend server
- **Network Access** - Frontend needs to communicate with backend servers
- **SSL Certificates** (Recommended) - For secure HTTPS connections

## Quick Start

### 1. Installation

#### Option A: From Package (Recommended)
```bash
# Install Armor package
pkg install armor

# Enable service
svcadm enable armor
```

#### Option B: From Source
```bash
# Clone repository
git clone https://github.com/STARTcloud/armor_private.git
cd armor

# Install dependencies
npm install
cd web && npm install && cd ..

# Build frontend
npm run build

# Start service
npm start
```

### 2. Initial Configuration

Edit the configuration file at `/etc/armor/config.yaml`:

```yaml
server:
  hostname: localhost
  port: 3443
  ssl:
    enabled: true
    generate_ssl: true
    key: /etc/armor/ssl/key.pem
    cert: /etc/armor/ssl/cert.pem

security:
  allow_new_organizations: true
  jwt_secret: "your-secure-random-secret-here"

database:
  path: /var/lib/armor/database/armor.db
```

### 3. First Access

1. **Open your browser** and navigate to `https://your-server:3443`
2. **Create Organization**: If `allow_new_organizations` is enabled, you'll see registration
3. **Register Admin User**: Create your first admin account
4. **Login**: Use your new credentials to access the dashboard

### 4. Add Armor API

After logging in:

1. Navigate to **Settings** → **Servers**
2. Click **Add Server**
3. Configure your Armor API:
   - **Hostname**: Your Armor API Server address
   - **Port**: Usually 5001 (HTTPS) or 5000 (HTTP)  
   - **Protocol**: HTTPS recommended
   - **API Key**: Your Armor API API key

## Configuration Options

### Security Settings

```yaml
security:
  jwt_secret: "change-this-to-a-secure-random-string"
  bcrypt_rounds: 10
  sessionTimeout: 24  # Hours
  allow_new_organizations: true  # Allow new org creation
```

### Email Configuration

```yaml
mail:
  smtp_connect:
    host: smtp.example.com
    port: 587
    secure: false
  smtp_auth:
    user: "your-email@example.com"
    password: "your-email-password"
  smtp_settings:
    from: "Armor <noreply@example.com>"
```

### SSL/TLS Setup

For production, use proper SSL certificates:

```yaml
server:
  ssl:
    enabled: true
    generate_ssl: false  # Use existing certificates
    key: /path/to/private.key
    cert: /path/to/certificate.crt
```

## User Management

### Creating Users

As an admin, you can:

1. **Invite Users**: Send invitation codes via email
2. **Direct Registration**: Share invitation codes manually
3. **Organization Management**: Control user access per organization

### Role Hierarchy

- **Super Admin**: Global access, can manage all organizations
- **Admin**: Organization-specific admin rights
- **User**: Standard user with limited permissions

## Armor API Integration

### Backend Requirements

Your Armor API must be:
- **Accessible**: Network connectivity from frontend
- **Configured**: Proper API key authentication
- **Running**: Service active and responding

### Testing Connection

Use the built-in connection test:
1. Go to **Settings** → **Servers**
2. Click **Test Connection** on your server
3. Verify successful API communication

## Troubleshooting

### Common Issues

**Cannot Access Web Interface**
- Check port 3443 is open
- Verify SSL certificate validity
- Check service status: `svcs armor`

**Backend Connection Failed**
- Test network connectivity: `curl https://backend:5001/api/`
- Verify API key is correct
- Check Armor API service status

**User Registration Issues**
- Ensure `allow_new_organizations: true` in config
- Check email configuration for invitations
- Verify database permissions

### Log Locations

- **Frontend Service**: `/var/log/armor/armor.log`
- **System Logs**: `svcs -xv armor`
- **Browser Console**: F12 Developer Tools

## Next Steps

Once your basic setup is working:

1. **[Configure Authentication](authentication/)** - Set up proper user management
2. **[User Guide](../user-guide/)** - Learn the web interface
3. **[Backend Integration](backend-integration/)** - Advanced Armor API configuration
4. **[Installation Guide](installation/)** - Production deployment options

---

Need help? Check our [Support Documentation](../support/) or visit the [GitHub repository](https://github.com/STARTcloud/armor_private).
