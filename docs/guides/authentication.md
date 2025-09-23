---
title: Authentication
layout: default
nav_order: 3
parent: Guides
permalink: /docs/guides/authentication/
---

# Authentication
{: .no_toc }

This guide covers setting up user authentication, managing organizations, and configuring security settings in Armor.

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## JWT Authentication

Armor uses JSON Web Tokens (JWT) for authentication. All API requests must include a valid JWT token in the Authorization header.

### Token Format

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Lifecycle

- **Expiration**: Tokens expire after 24 hours by default (configurable)
- **Refresh**: Users must log in again after token expiration
- **Storage**: Frontend stores tokens in secure HTTP-only cookies

## User Registration

### New Organization Registration

If `allow_new_organizations` is enabled in config:

1. Navigate to the registration page
2. Fill out organization and admin user details:
   - Organization name
   - Admin username
   - Admin email
   - Password (minimum 8 characters)
3. Submit registration to create both organization and admin user

### Invitation-Based Registration

For existing organizations:

1. Admin creates invitation via Settings → Users → Invite User
2. Invitation code is sent via email (if configured) or shared manually
3. New user visits registration page with invitation code
4. User fills out personal details and creates account

## User Management

### Role Hierarchy
**Admin**
- Organization-specific administration
- Can invite users to their organization
- Manage organization settings and users

**User**
- Standard access within organization
- Can manage personal profile and preferences

### Creating Users

#### Via Email Invitation
```yaml
# Configure SMTP in config.yaml
mail:
  smtp_connect:
    host: smtp.example.com
    port: 587
    secure: false
  smtp_auth:
    user: "noreply@company.com"
    password: "smtp-password"
  smtp_settings:
    from: "Armor <noreply@company.com>"
```

1. Go to Settings → Users
2. Click "Invite User"
3. Enter email address and select role
4. System sends invitation email automatically

#### Manual Invitation
1. Generate invitation code in Settings → Users
2. Share invitation code with new user
3. User registers using the code

## Security Configuration

### JWT Settings

```yaml
security:
  jwt_secret: "your-secure-random-secret-here"  # Change this!
  bcrypt_rounds: 10                             # Password hashing strength
  sessionTimeout: 24                            # Hours
  allow_new_organizations: false                # Disable after initial setup
```

### Password Requirements

Current password policy:
- Minimum 8 characters
- No complexity requirements (configurable in future versions)
- Passwords are hashed using bcrypt with configurable rounds

### Session Management

- Sessions expire after configured timeout period
- Users are automatically logged out on token expiration
- No automatic refresh - users must re-authenticate

## Organization Management

### Creating Organizations

**Super Admin Only:**
1. Navigate to Settings → Organizations
2. Click "Add Organization"
3. Enter organization name and description
4. Assign initial admin user

### Organization Settings

Each organization can configure:
- **Name and Description**: Basic organization information
- **User Management**: Control user access and roles
- **Server Assignments**: Which Armor API servers this organization can access

### Multi-Tenant Isolation

- Users can only access their assigned organization's resources
- Organizations cannot see each other's data
- Server assignments are organization-specific

## API Authentication

### Login Endpoint

```bash
curl -X POST https://your-server:3443/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin@example.com",
    "password": "your-password"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "organizationName": "My Organization"
  }
}
```

### Using API Tokens

```bash
curl -X GET https://your-server:3443/api/user/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## Troubleshooting

### Login Issues

**Invalid Credentials**
- Verify username/email and password
- Check if account exists and is active

**Token Expired**
- Login again to get fresh token
- Check sessionTimeout setting

**Server Error**
- Check JWT secret is configured
- Verify database connectivity
- Check server logs for details

### Registration Problems

**Organization Creation Disabled**
- Set `allow_new_organizations: true` in config
- Restart Armor service

**Email Invitation Failed**
- Check SMTP configuration
- Verify email credentials
- Test SMTP connection

**Invalid Invitation Code**
- Check code hasn't expired
- Verify code was copied correctly
- Generate new invitation if needed

## Security Best Practices

### Production Deployment

1. **Strong JWT Secret**: Use a secure random string (32+ characters)
2. **HTTPS Only**: Never run authentication over HTTP in production
3. **Regular Password Updates**: Encourage users to update passwords
4. **Monitor Access**: Review user access logs regularly
5. **Disable New Organizations**: Set `allow_new_organizations: false` after setup

### Network Security

- Use firewall to restrict port 3443 access
- Consider VPN access for administrative functions
- Enable fail2ban for brute force protection
- Regular security updates and monitoring

---

Next: [Backend Integration](backend-integration/) - Connect to Armor API Servers
