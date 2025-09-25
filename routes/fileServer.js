import express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { Op } from 'sequelize';
import auth from 'basic-auth';
import { SERVED_DIR, getSecurePath } from '../config/paths.js';
import {
  authenticateDownloads,
  authenticateUploads,
  authenticateDelete,
  authenticateApiKeyAccess,
} from '../middleware/auth.middleware.js';
import {
  isValidUser,
  isAllowedDirectory,
  isStaticDirectory,
  getStaticContent,
} from '../utils/auth.js';
import { getDirectoryItems } from '../utils/fileUtils.js';
import {
  generateDirectoryListing,
  getSecuredSiteMessage,
  generate404Page,
  getUserDisplayName,
} from '../utils/htmlGenerator.js';
import { logAccess, logger } from '../config/logger.js';
import configLoader from '../config/configLoader.js';

// Helper function to create landing config
const createLandingConfig = () => {
  const serverConfig = configLoader.getServerConfig();
  return {
    title: serverConfig.landing_title || 'Prominic Armor',
    subtitle: serverConfig.landing_subtitle || 'ARMOR Reliably Manages Online Resources',
    description: serverConfig.landing_description || 'This is a secured download site',
    iconClass: serverConfig.landing_icon_class || 'bi bi-shield-check',
    iconUrl: serverConfig.landing_icon_url || null,
    supportEmail: serverConfig.support_email || 'support@prominic.net',
    primaryColor: serverConfig.landing_primary_color || '#198754',
  };
};

// Helper function to handle directory listing
const handleDirectoryListing = async (req, res, fullPath, requestPath) => {
  const isAllowed = isAllowedDirectory(fullPath, SERVED_DIR);
  const isStatic = isStaticDirectory(fullPath, SERVED_DIR);

  if (!isAllowed) {
    logAccess(req, 'ACCESS_DENIED', 'directory not in allowed list');
    return res.send(getSecuredSiteMessage(createLandingConfig()));
  }

  if (isStatic) {
    const staticContent = await getStaticContent(fullPath);
    if (staticContent) {
      const baseUrl = requestPath.endsWith('/') ? requestPath : `${requestPath}/`;
      const contentWithBase = staticContent.replace('</head>', `<base href="${baseUrl}"></head>`);
      logAccess(req, 'STATIC_PAGE', 'serving static index.html');
      return res.send(contentWithBase);
    }
  }

  const serverConfig = configLoader.getServerConfig();
  const relativePath = fullPath.replace(SERVED_DIR, '').replace(/\\/g, '/');

  const isRoot = fullPath === SERVED_DIR || fullPath === `${SERVED_DIR}/`;
  
  // Check if user is admin (has uploads permission)
  const isAdmin = req.oidcUser?.permissions?.includes('uploads') || 
                  (req.isAuthenticated === 'uploads');
  
  // Check if admin wants to view directory index
  const viewIndex = req.query.view === 'index';
  
  logger.info('Root page check', {
    fullPath,
    SERVED_DIR,
    isRoot,
    showRootIndex: serverConfig.show_root_index,
    isAdmin,
    viewIndex,
    willShowLandingPage: isRoot && !serverConfig.show_root_index && !(isAdmin && viewIndex),
  });

  if (isRoot && !serverConfig.show_root_index && !(isAdmin && viewIndex)) {
    logger.info('Showing landing page for root access');
    logAccess(req, 'LANDING_PAGE', 'showing secured site message');
    const landingConfig = createLandingConfig();
    landingConfig.packageInfo = configLoader.getPackageInfo();
    return res.send(getSecuredSiteMessage(landingConfig));
  }

  const uploadCredentials = auth(req);
  const hasBasicUploadAccess = uploadCredentials && isValidUser(uploadCredentials, 'uploads');
  const hasOidcUploadAccess = req.oidcUser && req.oidcUser.permissions.includes('uploads');
  const hasUploadAccess = hasBasicUploadAccess || hasOidcUploadAccess;

  const itemsInfo = await getDirectoryItems(fullPath, req.fileWatcher);

  logAccess(req, 'LIST_DIRECTORY', `size: ${itemsInfo.length} items`);

  // Check if client wants JSON response
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    // Return JSON directory listing for API clients
    const files = itemsInfo.map(item => ({
      name: item.name,
      path: join(relativePath, item.name).replace(/\\/g, '/'),
      size: item.size,
      mtime: item.mtime.toISOString(),
      checksum: item.checksum || 'Pending',
      isDirectory: item.isDirectory,
    }));

    return res.json({
      success: true,
      path: relativePath,
      files,
      total: files.length,
    });
  }

  // Return HTML for web browsers
  let indexContent = '';
  if (fullPath !== SERVED_DIR) {
    indexContent = (await getStaticContent(fullPath)) || '';
  }

  // Extract user info from JWT token or oidcUser
  const userInfo =
    req.oidcUser || (uploadCredentials ? { username: uploadCredentials.name } : null);

  const html = generateDirectoryListing(
    hasUploadAccess ? 'uploads' : 'downloads',
    req.query,
    itemsInfo,
    relativePath,
    indexContent,
    userInfo,
    serverConfig,
    configLoader.getPackageInfo()
  );
  return res.send(html);
};

/**
 * @swagger
 * tags:
 *   - name: Files
 *     description: File and directory management endpoints
 *   - name: Search
 *     description: File search endpoints
 */

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const requestPath = decodeURIComponent(req.path);
    const targetDir = getSecurePath(requestPath);
    logger.debug('Multer destination', { file: file.originalname, targetDir });
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');

    const requestPath = decodeURIComponent(req.path);
    const targetDir = getSecurePath(requestPath);
    const fullPath = join(targetDir, sanitizedName);

    if (req.fileWatcher) {
      req.fileWatcher.markUploadStart(fullPath);
    }

    cb(null, sanitizedName);
  },
});

const upload = multer({ storage });

router.get('/api-keys', authenticateApiKeyAccess, (req, res) => {
  try {
    const serverConfig = configLoader.getServerConfig();
    const userInfo = req.oidcUser || null;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>API Keys - Armor</title>
    <link rel="icon" type="image/x-icon" href="/web/static/images/favicon.ico">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css" rel="stylesheet">
    <style>
        html, body { 
            height: 100%;
            background-color: #212529; 
            color: #fff;
        }
        .table { color: #fff; }
        .table td { vertical-align: middle; }
        .key-preview { font-family: monospace; }
        .expired { opacity: 0.6; }
        .badge { font-size: 0.75em; }
        .modal-content { background-color: #343a40; }
        .form-control, .form-select { 
            background-color: #495057; 
            border-color: #6c757d; 
            color: #fff; 
        }
        .form-control:focus, .form-select:focus {
            background-color: #495057;
            border-color: #198754;
            color: #fff;
            box-shadow: 0 0 0 0.2rem rgba(25, 135, 84, 0.25);
        }
        #generatedKey {
            background-color: #343a40 !important;
            color: #fff !important;
            border-color: #495057 !important;
        }
    </style>
</head>
<body>
    <div class="container mt-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h1><i class="bi bi-key me-2"></i>API Key Management</h1>
                <p class="text-muted">Manage your API keys for programmatic access to Armor</p>
            </div>
            <div class="d-flex align-items-center gap-2">
                <button type="button" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#createKeyModal" title="Generate New API Key">
                    <i class="bi bi-key"></i>
                </button>
                <div class="dropdown">
                    <button class="btn btn-outline-light dropdown-toggle" type="button" id="profileDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="bi bi-person-circle me-1"></i> ${getUserDisplayName(userInfo)}
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark" aria-labelledby="profileDropdown">
                        <li><a class="dropdown-item" href="/"><i class="bi bi-shield me-2"></i>Dashboard</a></li>
                        ${serverConfig?.enable_api_docs ? '<li><a class="dropdown-item" href="/api-docs"><i class="bi bi-book me-2"></i>API Documentation</a></li>' : ''}
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="/logout"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="card bg-dark border-secondary">
            <div class="card-header">
                <h5 class="mb-0">Your API Keys</h5>
            </div>
            <div class="card-body">
                <div id="apiKeysTable">
                    <div class="text-center py-4">
                        <div class="spinner-border text-success" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2 text-muted">Loading API keys...</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Create API Key Modal -->
        <div class="modal fade" id="createKeyModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><i class="bi bi-key me-2"></i>Generate New API Key</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="createKeyForm">
                            <div class="mb-3">
                                <label for="keyName" class="form-label">Key Name</label>
                                <input type="text" class="form-control" id="keyName" placeholder="e.g., CI Pipeline, Mobile App" required>
                                <small class="form-text text-muted">Choose a descriptive name to identify this key</small>
                            </div>
                            <div class="mb-3">
                                <label for="keyPermissions" class="form-label">Permissions</label>
                                <div id="keyPermissions">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" value="downloads" id="perm-downloads" checked>
                                        <label class="form-check-label" for="perm-downloads">Downloads</label>
                                        <small class="form-text text-muted d-block">Access to download files</small>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" value="uploads" id="perm-uploads">
                                        <label class="form-check-label" for="perm-uploads">Uploads</label>
                                        <small class="form-text text-muted d-block">Access to upload files</small>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" value="delete" id="perm-delete">
                                        <label class="form-check-label" for="perm-delete">Delete</label>
                                        <small class="form-text text-muted d-block">Access to delete files</small>
                                    </div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="keyExpiration" class="form-label">Expiration</label>
                                <select class="form-select" id="keyExpiration" required>
                                    <option value="">Select expiration period</option>
                                    <option value="7">7 days</option>
                                    <option value="30" selected>30 days</option>
                                    <option value="90">90 days</option>
                                    <option value="180">180 days</option>
                                    <option value="365">1 year</option>
                                </select>
                                <small class="form-text text-muted">API keys cannot be set to never expire</small>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" form="createKeyForm" class="btn btn-success">Generate Key</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Key Display Modal -->
        <div class="modal fade" id="keyDisplayModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title text-success"><i class="bi bi-check-circle me-2"></i>API Key Generated</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            <strong>Important:</strong> This is the only time you'll see this key. Please copy it now and store it securely.
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Your API Key:</label>
                            <div class="input-group">
                                <input type="text" class="form-control font-monospace" id="generatedKey" readonly>
                                <button class="btn btn-outline-success" type="button" id="copyKeyButton">
                                    <i class="bi bi-clipboard"></i> Copy
                                </button>
                            </div>
                        </div>
                        <div class="card bg-dark border-secondary">
                            <div class="card-header">
                                <h6 class="mb-0">Usage Example</h6>
                            </div>
                            <div class="card-body">
                                <code class="text-light" id="usageExample">
                                    curl -H "Authorization: Bearer YOUR_API_KEY" https://your-domain.com/path/to/file
                                </code>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-success" data-bs-dismiss="modal">Got it!</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        let userPermissions = [];
        
        // Load API keys on page load
        document.addEventListener('DOMContentLoaded', () => {
            loadApiKeys();
            filterPermissionCheckboxes();
        });

        async function loadApiKeys() {
            try {
                const response = await fetch('/api/api-keys');
                const result = await response.json();
                
                if (result.success) {
                    displayApiKeys(result.api_keys);
                } else {
                    showError('Failed to load API keys: ' + result.message);
                }
            } catch (error) {
                showError('Failed to load API keys: ' + error.message);
            }
        }

        function displayApiKeys(keys) {
            const tableContainer = document.getElementById('apiKeysTable');
            
            if (keys.length === 0) {
                tableContainer.innerHTML = 
                    '<div class="text-center py-4">' +
                    '<i class="bi bi-key display-4 text-muted"></i>' +
                    '<h5 class="mt-3 text-muted">No API Keys</h5>' +
                    '<p class="text-muted">Create your first API key to get started</p>' +
                    '</div>';
                return;
            }

            let tableRows = '';
            keys.forEach(key => {
                const isExpired = key.is_expired;
                const expiresDate = new Date(key.expires_at);
                const lastUsed = key.last_used ? new Date(key.last_used).toLocaleString() : 'Never';
                const expiredClass = isExpired ? 'expired' : '';
                const expiredBadge = isExpired ? '<span class="badge bg-danger ms-2">Expired</span>' : '';
                const permissionBadges = key.permissions.map(perm => 
                    '<span class="badge bg-secondary me-1">' + perm + '</span>'
                ).join('');
                
                tableRows += '<tr class="' + expiredClass + '">' +
                    '<td>' + key.name + expiredBadge + '</td>' +
                    '<td class="key-preview">' + key.key_preview + '...</td>' +
                    '<td>' + permissionBadges + '</td>' +
                    '<td>' + expiresDate.toLocaleDateString() + '</td>' +
                    '<td>' + lastUsed + '</td>' +
                    '<td><button class="btn btn-outline-danger btn-sm delete-key-btn" data-key-id="' + key.id + '" data-key-name="' + key.name + '">' +
                    '<i class="bi bi-trash"></i></button></td>' +
                    '</tr>';
            });

            const table = '<div class="table-responsive">' +
                '<table class="table table-dark table-striped">' +
                '<thead>' +
                '<tr>' +
                '<th>Name</th>' +
                '<th>Key Preview</th>' +
                '<th>Permissions</th>' +
                '<th>Expires</th>' +
                '<th>Last Used</th>' +
                '<th>Actions</th>' +
                '</tr>' +
                '</thead>' +
                '<tbody>' + tableRows + '</tbody>' +
                '</table>' +
                '</div>';
            
            tableContainer.innerHTML = table;
        }

        function filterPermissionCheckboxes() {
            // Get user permissions from the current user context
            const checkboxes = document.querySelectorAll('#keyPermissions input[type="checkbox"]');
            
            // Only show permissions the user actually has
            fetch('/api/user-api-keys')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Get user permissions from their existing keys or default to downloads only
                        let userHasUploads = false;
                        let userHasDelete = false;
                        
                        if (data.api_keys && data.api_keys.length > 0) {
                            // Check what permissions user's existing keys have
                            const allPermissions = data.api_keys.flatMap(key => key.permissions);
                            userHasUploads = allPermissions.includes('uploads');
                            userHasDelete = allPermissions.includes('delete');
                        }
                        
                        checkboxes.forEach(checkbox => {
                            const permission = checkbox.value;
                            if (permission === 'downloads') {
                                // Everyone can have downloads
                                checkbox.disabled = false;
                            } else if (permission === 'uploads') {
                                // Only enable if user has upload keys (admin user)
                                checkbox.disabled = !userHasUploads;
                                if (!userHasUploads) {
                                    checkbox.checked = false;
                                    checkbox.parentElement.style.opacity = '0.5';
                                }
                            } else if (permission === 'delete') {
                                // Only enable if user has delete keys (admin user)
                                checkbox.disabled = !userHasDelete;
                                if (!userHasDelete) {
                                    checkbox.checked = false;
                                    checkbox.parentElement.style.opacity = '0.5';
                                }
                            }
                        });
                    }
                })
                .catch(error => {
                    console.error('Failed to fetch user permissions:', error);
                    // Default to downloads only on error
                    checkboxes.forEach(checkbox => {
                        if (checkbox.value !== 'downloads') {
                            checkbox.disabled = true;
                            checkbox.checked = false;
                            checkbox.parentElement.style.opacity = '0.5';
                        }
                    });
                });
        }

        document.getElementById('createKeyForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('keyName').value;
            const expirationDays = parseInt(document.getElementById('keyExpiration').value);
            const permissions = Array.from(document.querySelectorAll('#keyPermissions input:checked'))
                .map(cb => cb.value);
            
            if (!name || !expirationDays || permissions.length === 0) {
                showError('Please fill in all fields');
                return;
            }
            
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + expirationDays);
            
            try {
                const response = await fetch('/api/api-keys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        permissions,
                        expires_at: expirationDate.toISOString()
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Close create modal
                    const createModal = bootstrap.Modal.getInstance(document.getElementById('createKeyModal'));
                    createModal.hide();
                    
                    // Show the generated key
                    document.getElementById('generatedKey').value = result.api_key.key;
                    
                    // Update the usage example with the actual key
                    const usageExample = document.getElementById('usageExample');
                    usageExample.textContent = 'curl -H "Authorization: Bearer ' + result.api_key.key + '" https://your-domain.com/path/to/file';
                    
                    const keyModal = new bootstrap.Modal(document.getElementById('keyDisplayModal'));
                    keyModal.show();
                    
                    // Reset form
                    document.getElementById('createKeyForm').reset();
                    document.getElementById('perm-downloads').checked = true;
                    document.getElementById('keyExpiration').value = '30';
                    
                    // Reload keys
                    loadApiKeys();
                } else {
                    showError('Failed to create API key: ' + result.message);
                }
            } catch (error) {
                showError('Failed to create API key: ' + error.message);
            }
        });

        document.getElementById('copyKeyButton').addEventListener('click', () => {
            const keyInput = document.getElementById('generatedKey');
            keyInput.select();
            document.execCommand('copy');
            
            const button = document.getElementById('copyKeyButton');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="bi bi-check"></i> Copied!';
            button.classList.remove('btn-outline-success');
            button.classList.add('btn-success');
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('btn-success');
                button.classList.add('btn-outline-success');
            }, 2000);
        });

        async function deleteKey(keyId, keyName) {
            if (!confirm('Are you sure you want to delete the API key "' + keyName + '"? This action cannot be undone.')) {
                return;
            }
            
            try {
                const response = await fetch('/api/api-keys/' + keyId, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    loadApiKeys(); // Reload the table
                } else {
                    showError('Failed to delete API key: ' + result.message);
                }
            } catch (error) {
                showError('Failed to delete API key: ' + error.message);
            }
        }

        function showError(message) {
            // Simple error display - in production you might want a toast or better UX
            alert(message);
        }

        // Event delegation for delete buttons (CSP-compliant)
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-key-btn') || e.target.closest('.delete-key-btn')) {
                const button = e.target.classList.contains('delete-key-btn') ? e.target : e.target.closest('.delete-key-btn');
                const keyId = button.getAttribute('data-key-id');
                const keyName = button.getAttribute('data-key-name');
                if (keyId && keyName) {
                    deleteKey(keyId, keyName);
                }
            }
        });
    </script>
</body>
</html>
    `;

    logAccess(req, 'API_KEYS_PAGE', 'API key management page accessed');
    return res.send(html);
  } catch (error) {
    logger.error('API keys page error', { error: error.message });
    return res.status(500).send('Internal server error');
  }
});

/**
 * @swagger
 * /{path}:
 *   get:
 *     summary: Download file or list directory contents
 *     description: Download a file or get directory listing. Returns JSON when Accept header includes application/json, otherwise returns HTML or file content.
 *     tags: [Files]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: File or directory path
 *         example: /uploads/document.pdf
 *       - in: header
 *         name: Accept
 *         schema:
 *           type: string
 *         description: Set to 'application/json' for JSON directory listing
 *         example: application/json
 *     responses:
 *       200:
 *         description: Success - file content, HTML page, or JSON directory listing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DirectoryListing'
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML directory listing page
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *               description: File content
 *       301:
 *         description: Redirect to add trailing slash for directories
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: File or directory not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('*splat', authenticateDownloads, async (req, res) => {
  const requestPath = Array.isArray(req.params.splat)
    ? req.params.splat.join('/')
    : req.params.splat || '';

  try {
    const fullPath = getSecurePath(requestPath);

    try {
      await fs.access(fullPath);
    } catch {
      logAccess(req, 'NOT_FOUND', fullPath);
      const serverConfig = configLoader.getServerConfig();
      const errorConfig = {
        title: serverConfig.login_title || 'Armor',
        subtitle: serverConfig.login_subtitle || 'ARMOR Reliably Manages Online Resources',
        primaryColor: serverConfig.login_primary_color || '#198754',
      };
      return res.status(404).send(generate404Page(errorConfig));
    }

    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      if (!requestPath.endsWith('/')) {
        return res.redirect(301, `${requestPath}/`);
      }
      return handleDirectoryListing(req, res, fullPath, requestPath);
    }

    // Handle file download
    logAccess(req, 'DOWNLOAD', `size: ${stats.size} bytes`);
    return res.sendFile(fullPath);
  } catch (error) {
    logger.error('File server error', { error: error.message, path: requestPath });
    logAccess(req, 'ERROR', error.message);
    return res.status(500).send('Internal server error');
  }
});

router.put('*splat', authenticateUploads, async (req, res, next) => {
  if (req.query.action !== 'rename') {
    return next();
  }

  try {
    const { newName } = req.body;

    if (!newName || newName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'New name is required',
      });
    }

    const sanitizedNewName = newName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const requestPath = Array.isArray(req.params.splat)
      ? req.params.splat.join('/')
      : req.params.splat || '';
    const oldFullPath = getSecurePath(requestPath);
    const parentDir = oldFullPath.substring(
      0,
      oldFullPath.lastIndexOf('/') || oldFullPath.lastIndexOf('\\')
    );
    const newFullPath = join(parentDir, sanitizedNewName);

    // Check if old file/folder exists
    try {
      await fs.access(oldFullPath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'File or folder not found',
      });
    }

    // Check if new name already exists
    try {
      await fs.access(newFullPath);
      return res.status(400).json({
        success: false,
        message: 'A file or folder with that name already exists',
      });
    } catch {
      // Good - new name doesn't exist
    }

    const oldName = basename(oldFullPath);

    // Perform the rename
    await fs.rename(oldFullPath, newFullPath);

    // Update database records
    const { getFileModel } = await import('../models/File.js');
    const File = getFileModel();

    const stats = await fs.stat(newFullPath);

    if (stats.isDirectory()) {
      // For directories, update all files within
      await File.update(
        {
          file_path: newFullPath,
        },
        {
          where: { file_path: oldFullPath },
        }
      );

      // Update all files within the directory
      const filesInDir = await File.findAll({
        where: {
          file_path: {
            [Op.like]: `${oldFullPath}%`,
          },
        },
      });

      const updatePromises = filesInDir.map(file => {
        const newFilePath = file.file_path.replace(oldFullPath, newFullPath);
        return file.update({ file_path: newFilePath });
      });

      await Promise.all(updatePromises);
    } else {
      // For files, just update the single record
      await File.update(
        {
          file_path: newFullPath,
        },
        {
          where: { file_path: oldFullPath },
        }
      );
    }

    // Send SSE event for real-time UI update
    const { sendFileRenamed } = await import('./sse.js');
    sendFileRenamed(oldFullPath, newFullPath, stats.isDirectory());

    logAccess(req, 'RENAME_SUCCESS', `${oldName} → ${sanitizedNewName}`);

    return res.json({
      success: true,
      oldName,
      newName: sanitizedNewName,
      message: `${stats.isDirectory() ? 'Folder' : 'File'} renamed successfully`,
    });
  } catch (error) {
    logger.error('Rename error', { error: error.message });
    logAccess(req, 'RENAME_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to rename item',
    });
  }
});

// Dedicated search endpoint - much cleaner!
/**
 * @swagger
 * /{path}/search:
 *   post:
 *     summary: Search files in directory
 *     description: Search for files by name or checksum within the specified directory
 *     tags: [Search]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Directory path to search in
 *         example: /uploads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SearchRequest'
 *     responses:
 *       200:
 *         description: Search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResponse'
 *       400:
 *         description: Invalid search query
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('*splat/search', authenticateDownloads, async (req, res) => {
  try {
    const { query: searchQuery } = req.body;

    if (!searchQuery || searchQuery.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const requestPath = decodeURIComponent(req.path.replace('/search', ''));
    const currentDir = getSecurePath(requestPath);

    const { getFileModel } = await import('../models/File.js');
    const File = getFileModel();

    const searchResults = await File.findAll({
      where: {
        [Op.and]: [
          {
            file_path: {
              [Op.like]: `${currentDir}%`,
            },
          },
          {
            [Op.or]: [
              {
                file_path: {
                  [Op.like]: `%${searchQuery}%`,
                },
              },
              {
                checksum_sha256: {
                  [Op.like]: `%${searchQuery}%`,
                },
              },
            ],
          },
        ],
      },
      limit: 100,
      raw: true,
    });

    const results = searchResults.map(file => ({
      name: basename(file.file_path),
      path: file.file_path.replace(SERVED_DIR, ''),
      size: file.file_size,
      mtime: file.last_modified,
      checksum: file.checksum_sha256 || 'Pending',
      isDirectory: file.is_directory,
    }));

    logAccess(req, 'SEARCH', `query: "${searchQuery}", results: ${results.length}`);

    return res.json({
      success: true,
      query: searchQuery,
      results,
      total: results.length,
    });
  } catch (error) {
    logger.error('Search error', { error: error.message });
    logAccess(req, 'SEARCH_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Search failed',
    });
  }
});

// Dedicated folder creation endpoint - much cleaner!
/**
 * @swagger
 * /{path}/folders:
 *   post:
 *     summary: Create folder in directory
 *     description: Create a new folder in the specified directory
 *     tags: [Files]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Directory path where folder should be created
 *         example: /uploads
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FolderRequest'
 *     responses:
 *       200:
 *         description: Folder created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 folderName:
 *                   type: string
 *                   example: new-folder
 *                 message:
 *                   type: string
 *                   example: Folder created successfully
 *       400:
 *         description: Invalid request or folder already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('*splat/folders', authenticateUploads, async (req, res) => {
  try {
    const { folderName } = req.body;

    if (!folderName || folderName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required',
      });
    }

    const sanitizedFolderName = folderName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const requestPath = decodeURIComponent(req.path.replace('/folders', ''));
    const targetDir = getSecurePath(requestPath);
    const newFolderPath = join(targetDir, sanitizedFolderName);

    try {
      await fs.access(newFolderPath);
      return res.status(400).json({
        success: false,
        message: 'Folder already exists',
      });
    } catch {
      logger.debug(`Folder doesn't exist, proceeding with creation: ${newFolderPath}`);
    }

    await fs.mkdir(newFolderPath);

    const { getFileModel } = await import('../models/File.js');
    const File = getFileModel();
    const stats = await fs.stat(newFolderPath);

    await File.create({
      file_path: newFolderPath,
      file_size: 0,
      last_modified: stats.mtime,
      is_directory: true,
      checksum_status: 'complete',
    });

    logger.info(`Added folder to database: ${newFolderPath}`);

    const { sendFolderCreated } = await import('./sse.js');
    sendFolderCreated(newFolderPath);

    logAccess(req, 'CREATE_FOLDER', `path: ${newFolderPath}`);

    return res.status(200).json({
      success: true,
      folderName: sanitizedFolderName,
      message: 'Folder created successfully',
    });
  } catch (error) {
    logger.error('Folder creation error', { error: error.message });
    logAccess(req, 'CREATE_FOLDER_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create folder',
    });
  }
});

// Keep legacy support for backwards compatibility
router.post('*splat', (req, res, next) => {
  if (req.query.auth === '1') {
    return authenticateUploads(req, res, () => {
      res.status(200).send('Authenticated');
    });
  } else if (req.query.action === 'create-folder') {
    // Redirect to new endpoint
    const newPath = `${req.path}/folders`;
    return res.redirect(307, newPath);
  } else if (req.query.action === 'search') {
    // Redirect to new endpoint
    const newPath = `${req.path}/search`;
    return res.redirect(307, newPath);
  }
  return next();
});

/**
 * @swagger
 * /{path}:
 *   put:
 *     summary: Rename file or folder
 *     description: Rename a file or folder to a new name
 *     tags: [Files]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Current file or folder path
 *         example: /uploads/oldname.txt
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [rename]
 *         description: Must be 'rename' for rename operations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newName]
 *             properties:
 *               newName:
 *                 type: string
 *                 description: New name for the file or folder
 *                 example: newname.txt
 *     responses:
 *       200:
 *         description: File or folder renamed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 oldName:
 *                   type: string
 *                   example: oldname.txt
 *                 newName:
 *                   type: string
 *                   example: newname.txt
 *                 message:
 *                   type: string
 *                   example: File renamed successfully
 *       400:
 *         description: Invalid request or name conflict
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: File or folder not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('*splat', authenticateUploads, async (req, res, next) => {
  if (req.query.action !== 'create-folder') {
    return next();
  }

  try {
    const { folderName } = req.body;

    if (!folderName || folderName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required',
      });
    }

    const sanitizedFolderName = folderName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const requestPath = decodeURIComponent(req.path);
    const targetDir = getSecurePath(requestPath);
    const newFolderPath = join(targetDir, sanitizedFolderName);

    try {
      await fs.access(newFolderPath);
      return res.status(400).json({
        success: false,
        message: 'Folder already exists',
      });
    } catch {
      logger.debug(`Folder doesn't exist, proceeding with creation: ${newFolderPath}`);
    }

    await fs.mkdir(newFolderPath);

    const { getFileModel } = await import('../models/File.js');
    const File = getFileModel();
    const stats = await fs.stat(newFolderPath);

    await File.create({
      file_path: newFolderPath,
      file_size: 0,
      last_modified: stats.mtime,
      is_directory: true,
      checksum_status: 'complete',
    });

    logger.info(`Added folder to database: ${newFolderPath}`);

    const { sendFolderCreated } = await import('./sse.js');
    sendFolderCreated(newFolderPath);

    logAccess(req, 'CREATE_FOLDER', `path: ${newFolderPath}`);

    return res.status(200).json({
      success: true,
      folderName: sanitizedFolderName,
      message: 'Folder created successfully',
    });
  } catch (error) {
    logger.error('Folder creation error', { error: error.message });
    logAccess(req, 'CREATE_FOLDER_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create folder',
    });
  }
});

/**
 * @swagger
 * /{path}:
 *   post:
 *     summary: Upload file
 *     description: Upload a file to the specified directory path
 *     tags: [Files]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Directory path where file should be uploaded
 *         example: /uploads/
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadResponse'
 *       400:
 *         description: No file provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('*splat', authenticateUploads, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      logAccess(req, 'UPLOAD_FAILED', 'no file provided');
      return res.status(400).send('No file uploaded');
    }

    req.fileWatcher.markUploadComplete(req.file.path);

    const { getFileModel } = await import('../models/File.js');
    const File = getFileModel();

    logger.info('Upload duplicate check', {
      uploadedFilePath: req.file.path,
      filename: req.file.filename,
    });

    const existingFile = await File.findOne({ where: { file_path: req.file.path } });

    logger.info('Duplicate check result', {
      existingFile: !!existingFile,
      existingFilePath: existingFile?.file_path,
    });

    const uploadType = existingFile ? 'replacement' : 'new';

    logAccess(
      req,
      'UPLOAD_SUCCESS',
      `file: ${req.file.filename}, size: ${req.file.size} bytes, type: ${uploadType}`
    );

    return res.status(200).json({
      success: true,
      type: uploadType,
      filename: req.file.filename,
      size: req.file.size,
    });
  } catch (error) {
    if (req.file?.path) {
      req.fileWatcher.markUploadComplete(req.file.path);
    }

    logger.error('Upload error', { error: error.message, filename: req.file?.filename });
    logAccess(req, 'UPLOAD_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Upload failed',
    });
  }
});

/**
 * @swagger
 * /{path}:
 *   delete:
 *     summary: Delete file or directory
 *     description: Delete a file or directory (recursively) at the specified path
 *     tags: [Files]
 *     security:
 *       - ApiKeyAuth: []
 *       - JwtAuth: []
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: File or directory path to delete
 *         example: /uploads/document.pdf
 *     responses:
 *       200:
 *         description: File or directory deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Cannot delete directory (permission or system error)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: File or directory not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('*splat', authenticateDelete, async (req, res) => {
  const requestPath = Array.isArray(req.params.splat)
    ? req.params.splat.join('/')
    : req.params.splat || '';

  try {
    const fullPath = getSecurePath(requestPath);

    try {
      await fs.access(fullPath);
    } catch {
      logAccess(req, 'DELETE_NOT_FOUND', fullPath);
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      try {
        await fs.rm(fullPath, { recursive: true, force: true });

        const { getFileModel } = await import('../models/File.js');
        const File = getFileModel();
        await File.destroy({
          where: {
            file_path: {
              [Op.like]: `${fullPath}%`,
            },
          },
        });

        const { sendFileDeleted } = await import('./sse.js');
        sendFileDeleted(fullPath, true);

        logAccess(req, 'DELETE_DIRECTORY', `path: ${fullPath} (recursive)`);
        return res.json({
          success: true,
          message: 'Directory deleted successfully',
        });
      } catch (error) {
        logAccess(req, 'DELETE_DIRECTORY_FAILED', `path: ${fullPath}, error: ${error.message}`);
        return res.status(400).json({
          success: false,
          message: `Cannot delete directory: ${error.message}`,
        });
      }
    } else {
      await fs.unlink(fullPath);

      const { getFileModel } = await import('../models/File.js');
      const File = getFileModel();
      await File.destroy({ where: { file_path: fullPath } });

      const { sendFileDeleted } = await import('./sse.js');
      sendFileDeleted(fullPath, false);

      logAccess(req, 'DELETE_FILE', `path: ${fullPath}, size: ${stats.size} bytes`);
      return res.json({
        success: true,
        message: 'File deleted successfully',
      });
    }
  } catch (error) {
    logger.error('Delete error', { error: error.message, path: requestPath });
    logAccess(req, 'DELETE_ERROR', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete file',
    });
  }
});

export default router;
