# Armor

**ARMOR Reliably Manages Online Resources**

A secure Node.js file server that provides directory listings with SHA256 checksums and authenticated file upload capabilities over HTTPS.

## Features

- Secure HTTPS access
- Basic authentication for uploads
- Clean, dark-themed directory listings
- SHA256 checksums for all files
  - Truncated display with full checksum in tooltip
  - Click-to-copy functionality
  - Visual confirmation when copied
- File upload support (authenticated users only)
  - Drag-and-drop enabled
  - Automatic checksum calculation on upload
- Nested directory support
- File size formatting
- Automatic directory creation on upload

## Installation

### Prerequisites

1. Install Node.js on Debian 12:
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Application Setup

1. Create application directory and set permissions:
```bash
sudo mkdir -p /opt/armor
sudo chown startcloud:startcloud /opt/armor
```

2. Create data directory:
```bash
sudo mkdir -p /local/www
sudo chown startcloud:startcloud /local/www
```

3. Copy application files:
```bash
sudo cp app.js package.json config.yaml /opt/armor/
sudo chown startcloud:startcloud /opt/armor/*
```

4. Install dependencies:
```bash
cd /opt/armor
npm install
```

### Authentication Setup

The application uses a YAML file for user authentication. Edit config.yaml to manage users:
```yaml
users:
  - username: admin
    password: your-secure-password
  - username: user2
    password: another-password
```

### SSL Certificates

The application uses SSL certificates from Let's Encrypt located at:
- `/etc/letsencrypt/live/armor.mydomain.net/fullchain.pem`
- `/etc/letsencrypt/live/armor.mydomain.net/privkey.pem`

Ensure these certificates are readable by the startcloud user:
```bash
sudo setfacl -R -m u:startcloud:rx /etc/letsencrypt/live/armor.mydomain.net/
sudo setfacl -R -m u:startcloud:rx /etc/letsencrypt/archive/armor.mydomain.net/
```

### Service Setup

1. Copy service file:
```bash
sudo cp armor.service /etc/systemd/system/
```

2. Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable armor
sudo systemctl start armor
```

## Usage

1. Access the server at `https://armor.mydomain.net`

2. Authentication:
   - Click the "Login to Upload" button in the top-right corner
   - Enter your credentials from config.yaml when prompted
   - Once logged in, you'll see a "Logged in" indicator
   - The upload form will appear automatically

3. Directory Navigation:
   - Click folders to navigate into them
   - Use the "Back" button to return to parent directory
   - File paths are shown in the page header

4. File Operations:
   - Click on a file name to download it
   - Authenticated users can upload files using the upload form or drag-and-drop
   - Files are automatically saved to the current directory
   - Checksums are calculated automatically on upload

5. Checksum Features:
   - Checksums are displayed in truncated form (first 8 characters)
   - Hover over a checksum to see the full value
   - Click a checksum to copy it to clipboard
   - A green notification appears when copied successfully

## Service Management

- Check service status:
```bash
sudo systemctl status armor
```

- View logs:
```bash
sudo journalctl -u armor
```

- Restart service:
```bash
sudo systemctl restart armor
```

## Troubleshooting

1. If the service fails to start:
   - Check logs: `sudo journalctl -u armor -n 50`
   - Verify Node.js installation: `node --version`
   - Check SSL certificate permissions
   - Verify file permissions in /local/www
   - Ensure startcloud user has necessary permissions

2. If file uploads fail:
   - Verify you are properly authenticated
   - Check directory permissions for startcloud user
   - Check available disk space
   - Ensure the service is running

3. If checksums don't appear:
   - Verify file permissions allow reading
   - Check service logs for errors
   - Ensure file is not corrupted

4. If authentication fails:
   - Verify config.yaml is properly formatted
   - Check config.yaml permissions
   - Ensure credentials are correct
   - Check service logs for auth-related errors
   - Try clearing browser cache and cookies
   - Ensure you're using the correct username/password from config.yaml

## API Documentation

The application provides a comprehensive REST API documented with Swagger UI. Access the interactive documentation at:
```
https://your-domain.com/api-docs
```

### API Authentication

The API supports two authentication methods:
1. **API Keys** - Bearer token authentication (recommended for programmatic access)
2. **JWT Tokens** - Session-based authentication (for web interface)

### API Key Management

Create and manage API keys through the web interface at `/api-keys` or via the API:

```bash
# List your API keys
curl -k -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-domain.com/api/api-keys

# Create new API key
curl -k -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"My App","permissions":["downloads","uploads","delete"],"expires_at":"2025-12-31T23:59:59.000Z"}' \
  https://your-domain.com/api/api-keys
```

### API Endpoints

#### 🔑 API Keys
- `GET /api/api-keys` - List user's API keys
- `POST /api/api-keys` - Create new API key
- `PUT /api/api-keys/{id}` - Update API key
- `DELETE /api/api-keys/{id}` - Delete API key

#### 📁 Files
- `GET /{path}` - Download file or list directory (JSON with Accept: application/json)
- `POST /{path}` - Upload file (multipart/form-data)
- `POST /{path}?action=create-folder` - Create folder
- `DELETE /{path}` - Delete file or directory

#### 🔍 Search
- `POST /{path}?action=search` - Search files by name or checksum

#### 🔐 Authentication
- `GET /auth/methods` - Get available authentication methods
- `POST /auth/login/basic` - Basic username/password login
- `POST /auth/logout` - Logout and clear token

### API Examples

**Note**: Use `-k` flag with curl for self-signed certificates.

#### File Operations
```bash
# List directory contents (JSON)
curl -k -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: application/json" \
  https://your-domain.com/uploads/

# Download a file
curl -k -H "Authorization: Bearer YOUR_API_KEY" \
  --output filename.ext \
  https://your-domain.com/uploads/filename.ext

# Upload file to specific directory
curl -k -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@./local-file.txt" \
  https://your-domain.com/uploads/documents/

# Create folder (clean dedicated endpoint)
curl -k -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"folderName":"new-folder"}' \
  https://your-domain.com/uploads/folders

# Rename file or folder
curl -k -X PUT -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"newName":"new-filename.txt"}' \
  https://your-domain.com/uploads/oldname.txt?action=rename

# Delete file or folder
curl -k -X DELETE -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-domain.com/uploads/filename.ext
```

#### Search Operations
```bash
# Search for files by name or checksum (clean dedicated endpoint)
curl -k -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"document"}' \
  https://your-domain.com/uploads/search
```

#### Authentication
```bash
# Get available authentication methods
curl -k https://your-domain.com/auth/methods

# Login with username/password
curl -k -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' \
  https://your-domain.com/auth/login/basic
```

### API Key Permissions

API keys can have the following permissions:
- **downloads** - Access to download files and list directories
- **uploads** - Access to upload files and create folders
- **delete** - Access to delete files and directories

### Swagger UI Features

The interactive API documentation includes:
- **Dark theme** - Professional dark UI
- **Dynamic server configuration** - Auto-detects current server with custom override
- **API key integration** - Seamless authentication in the browser
- **Temporary key generation** - On-demand testing keys
- **Profile navigation** - Easy access to key management

## Notes

- The server runs on port 443 (HTTPS)
- Files are stored in /local/www
- Service runs as startcloud user and group
- Nested directories are created automatically when needed
- File names are sanitized during upload
- Hidden files and system files are excluded from listings
- All connections are secured with SSL/TLS
- Authentication is required only for file uploads
- API endpoints require appropriate permissions based on operation type
- Path in URL determines target directory for file operations
