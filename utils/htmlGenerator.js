import { join } from 'path';
import { formatBytes } from './fileUtils.js';

export const getSecuredSiteMessage = (config = {}, userInfo = null) => {
  const {
    title = 'Prominic Armor',
    subtitle = 'ARMOR Reliably Manages Online Resources',
    description = 'This is a secured download site',
    iconClass = 'bi bi-shield-check',
    iconUrl = null,
    supportEmail = 'support@prominic.net',
    primaryColor = '#198754',
    packageInfo = {
      name: 'Armor',
      version: '1.0.0',
      description: 'ARMOR Reliably Manages Online Resources',
    },
  } = config;

  // Check if user is admin (has uploads permission)
  const isAdmin = userInfo?.permissions?.includes('uploads');

  return `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css" rel="stylesheet">
    <style>
        body { 
            background-color: #212529; 
            color: #fff; 
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .landing-card {
            text-align: center;
            max-width: 500px;
            padding: 3rem;
        }
        .shield-icon {
            font-size: 4rem;
            color: ${primaryColor};
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <div class="landing-card">
        <div class="shield-icon">
            ${
              isAdmin
                ? `<a href="/?view=index" style="color: inherit; text-decoration: none;">
                    ${iconUrl ? `<img src="${iconUrl}" alt="${title}" height="64">` : `<i class="${iconClass}"></i>`}
                </a>`
                : `${iconUrl ? `<img src="${iconUrl}" alt="${title}" height="64">` : `<i class="${iconClass}"></i>`}`
            }
        </div>
        <h1 class="display-4 mb-4">${title}</h1>
        <p class="lead mb-3">${description}</p>
        <p class="text-muted">${subtitle}</p>
        <hr class="my-4">
        <p class="small text-muted">
            <i class="bi bi-info-circle me-2"></i>
            Access to resources requires proper authentication
        </p>
        <div class="mt-4">
            <a href="mailto:${supportEmail}" class="btn btn-outline-light btn-sm">
                <i class="bi bi-envelope me-2"></i>
                Contact Support
            </a>
        </div>
        <div class="mt-3">
            <small class="text-muted">
                Powered by <a href="https://startcloud.com" target="_blank" class="text-decoration-none text-light">STARTcloud</a>
            </small>
        </div>
    </div>

    <script>
        // Log application name and version to browser console  
        console.log('${packageInfo.name} v${packageInfo.version} - ${packageInfo.description}');
    </script>
</body>
</html>
`;
};

export const generate404Page = (config = {}) => {
  const {
    title = 'Armor',
    subtitle = 'ARMOR Reliably Manages Online Resources',
    primaryColor = '#198754',
  } = config;

  return `
<!DOCTYPE html>
<html>
<head>
    <title>Page Not Found - ${title}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css" rel="stylesheet">
    <style>
        body { 
            background-color: #212529; 
            color: #fff; 
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .error-card {
            text-align: center;
            max-width: 500px;
            padding: 3rem;
        }
        .error-icon {
            font-size: 4rem;
            color: #dc3545;
            margin-bottom: 1rem;
        }
        .btn-custom {
            background-color: ${primaryColor};
            border-color: ${primaryColor};
            color: white;
        }
        .btn-custom:hover {
            background-color: ${primaryColor}dd;
            border-color: ${primaryColor}dd;
            color: white;
        }
    </style>
</head>
<body>
    <div class="error-card">
        <div class="error-icon">
            <i class="bi bi-exclamation-triangle"></i>
        </div>
        <h1 class="display-4 mb-3">Page Not Found</h1>
        <p class="lead mb-3">The page you're looking for doesn't exist.</p>
        <p class="text-muted mb-4">${subtitle}</p>
        <div class="d-flex gap-2 justify-content-center flex-wrap">
            <a href="/" class="btn btn-custom">
                <i class="bi bi-shield me-2"></i>Go Home
            </a>
            <a href="/login" class="btn btn-outline-light">
                <i class="bi bi-box-arrow-in-right me-2"></i>Login
            </a>
        </div>
        <div class="mt-4">
            <small class="text-muted">
                Powered by <a href="https://startcloud.com" target="_blank" class="text-decoration-none text-light">STARTcloud</a>
            </small>
        </div>
    </div>
</body>
</html>
`;
};

const generateBreadcrumbs = relativePath => {
  if (!relativePath || relativePath === '/') {
    return '<li class="breadcrumb-item active" aria-current="page"><i class="bi bi-folder me-1"></i>Home</li>';
  }

  const pathSegments = relativePath.split('/').filter(segment => segment);
  let currentPath = '';

  return pathSegments
    .map((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      if (isLast) {
        return `<li class="breadcrumb-item active" aria-current="page"><i class="bi bi-folder-fill me-1"></i>${segment}</li>`;
      }
      return `<li class="breadcrumb-item"><a href="${currentPath}/"><i class="bi bi-folder me-1"></i>${segment}</a></li>`;
    })
    .join('');
};

export const getUserDisplayName = userInfo => {
  if (!userInfo) {
    return 'User';
  }

  // Prioritize proper names over email
  if (userInfo.name && !userInfo.name.includes('@')) {
    return userInfo.name;
  }
  if (userInfo.username && !userInfo.username.includes('@')) {
    return userInfo.username;
  }
  if (userInfo.given_name) {
    return userInfo.given_name;
  }
  if (userInfo.email) {
    // Extract username from email as better display name
    const [emailUsername] = userInfo.email.split('@');
    return emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
  }

  return 'User';
};

export const generateDirectoryListing = (
  authType,
  query,
  itemsInfo,
  relativePath,
  indexContent = '',
  userInfo = null,
  serverConfig = {},
  packageInfo = {
    name: 'Armor',
    version: '1.0.0',
    description: 'ARMOR Reliably Manages Online Resources',
  }
) => {
  const sortBy = query.sort || 'name';
  const sortOrder = query.order || 'asc';

  itemsInfo.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    switch (sortBy) {
      case 'modified':
        return sortOrder === 'asc'
          ? a.mtime.getTime() - b.mtime.getTime()
          : b.mtime.getTime() - a.mtime.getTime();
      case 'size':
        if (a.isDirectory && !b.isDirectory) {
          return -1;
        }
        if (!a.isDirectory && b.isDirectory) {
          return 1;
        }
        if (a.isDirectory && b.isDirectory) {
          return 0;
        } // Both directories, maintain order
        return sortOrder === 'asc' ? a.size - b.size : b.size - a.size;
      case 'name':
      default:
        return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
  });

  return `
<!DOCTYPE html>
<html>
<head>
    <title>Armor</title>
    <link rel="icon" type="image/x-icon" href="/web/static/images/favicon.ico">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css" rel="stylesheet">
    <style>
        html, body { 
            height: 100%;
            background-color: #212529; 
            color: #fff;
        }
        body {
            display: flex;
            flex-direction: column;
        }
        .main-content {
            flex: 1;
            padding: 1.5rem 0;
        }
        .table { color: #fff; }
        .table td { vertical-align: middle; }
        .checksum { cursor: pointer; }
        .checksum:hover { text-decoration: underline; }
        .copy-indicator { 
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 10px 20px;
            background-color: #198754;
            border-radius: 5px;
            display: none;
            z-index: 1000;
        }
        .file-icon, .folder-icon {
            cursor: pointer;
            transition: transform 0.2s ease, color 0.2s ease;
        }
        .file-icon:hover, .folder-icon:hover {
            transform: scale(1.2);
            color: #198754 !important;
        }
        .copy-animation {
            transform: scale(1.3) !important;
            color: #198754 !important;
        }
        .long-press-animation {
            transform: scale(1.4) !important;
            color: #dc3545 !important;
        }
        .file-icon, .folder-icon {
            cursor: pointer;
            transition: transform 0.2s ease, color 0.2s ease;
        }
        .file-icon:hover, .folder-icon:hover {
            transform: scale(1.2);
            color: #198754 !important;
        }
        .copy-animation {
            transform: scale(1.3) !important;
            color: #198754 !important;
        }
        .upload-drop-zone {
            border: 3px dashed #6c757d;
            border-radius: 12px;
            padding: 40px 20px;
            margin: 20px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 18px;
            cursor: pointer;
            color: #adb5bd;
            background-color: rgba(52, 58, 64, 0.3);
            transition: all 0.3s ease;
            min-height: 120px;
        }
        .upload-drop-zone:hover {
            border-color: #198754;
            background-color: rgba(25, 135, 84, 0.1);
            color: #fff;
        }
        .upload-drop-zone--over {
            border-style: solid;
            border-color: #0d6efd;
            background-color: rgba(13, 110, 253, 0.2);
            color: #fff;
        }
        .upload-drop-zone__input {
            display: none;
        }
        .upload-drop-zone__prompt {
            pointer-events: none;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        }
        .upload-drop-zone__thumb {
            width: 100%;
            height: 100%;
            border-radius: 8px;
            overflow: hidden;
            background-color: #495057;
            background-size: cover;
            background-position: center;
            position: relative;
            min-height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .upload-drop-zone__thumb::after {
            content: attr(data-label);
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            padding: 8px;
            color: #ffffff;
            background: rgba(0, 0, 0, 0.8);
            font-size: 14px;
            text-align: center;
        }
        .auth-status {
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        footer {
            margin-top: auto;
            background-color: #1a1d20;
        }
        .breadcrumb {
            background-color: transparent;
            margin-bottom: 0;
        }
        .breadcrumb-item > a {
            color: #6c757d;
            text-decoration: none;
        }
        .breadcrumb-item > a:hover {
            color: #fff;
        }
        .breadcrumb-item.active {
            color: #fff;
        }
        .breadcrumb-item + .breadcrumb-item::before {
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="main-content">
        <div class="container">
        ${
          indexContent
            ? `
        <div class="card bg-dark border-secondary mb-4">
            <div class="card-body">
                ${indexContent}
            </div>
        </div>
        `
            : ''
        }
        <div class="d-flex align-items-center justify-content-between mb-4">
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item">
                        ${
                          authType === 'uploads' && relativePath === ''
                            ? `<a href="/?view=index" style="cursor: pointer;"><i class="bi bi-shield me-1" style="color: ${serverConfig.login_primary_color || '#198754'};"></i>Armor</a>`
                            : `<a href="/"><i class="bi bi-shield me-1" style="color: ${serverConfig.login_primary_color || '#198754'};"></i>Armor</a>`
                        }
                    </li>
                    ${generateBreadcrumbs(relativePath)}
                </ol>
            </nav>
            <div class="auth-status">
                <div class="dropdown">
                    <button class="btn btn-outline-light btn-sm dropdown-toggle" type="button" id="profileDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="bi bi-person-circle me-1"></i> ${getUserDisplayName(userInfo)}
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark" aria-labelledby="profileDropdown">
                        <li><a class="dropdown-item" href="/api-keys"><i class="bi bi-key me-2"></i>API Keys</a></li>
                        ${serverConfig?.enable_api_docs ? '<li><a class="dropdown-item" href="/api-docs"><i class="bi bi-book me-2"></i>API Documentation</a></li>' : ''}
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="/logout"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>
                        <li><a class="dropdown-item" href="/logout/local"><i class="bi bi-box-arrow-left me-2"></i>Logout (Local)</a></li>
                    </ul>
                </div>
            </div>
        </div>
        
        ${
          authType === 'uploads'
            ? `
        <div class="upload-drop-zone" id="uploadSection" style="display: none;">
            <div class="upload-drop-zone__prompt">
                <i class="bi bi-cloud-upload" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <div>Drop files here or click to upload</div>
            </div>
            <input type="file" class="upload-drop-zone__input">
        </div>
        
        <!-- Upload Progress Bar -->
        <div id="uploadProgress" class="mt-3" style="display: none;">
            <div class="d-flex justify-content-between mb-1">
                <small class="text-light">Uploading...</small>
                <small class="text-light" id="progressText">0%</small>
            </div>
            <div class="progress">
                <div class="progress-bar progress-bar-striped progress-bar-animated bg-success" 
                     role="progressbar" 
                     id="progressBar" 
                     style="width: 0%" 
                     aria-valuenow="0" 
                     aria-valuemin="0" 
                     aria-valuemax="100">
                </div>
            </div>
        </div>
        
        <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="d-flex align-items-center gap-2">
                <button type="button" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#createFolderModal" title="Create Folder">
                    <i class="bi bi-folder-plus"></i>
                </button>
                <button type="button" class="btn btn-outline-primary" id="toggleUploadSection" title="Show Upload Section">
                    <i class="bi bi-cloud-upload"></i>
                </button>
            </div>
            <div class="d-flex align-items-center gap-2">
                <div class="input-group" style="width: 300px;">
                    <input type="text" class="form-control bg-dark text-light border-secondary" id="searchInput" placeholder="Search files or checksums...">
                    <button type="button" class="btn btn-outline-light" id="searchButton" title="Search">
                        <i class="bi bi-search"></i>
                    </button>
                </div>
                <button type="button" class="btn btn-outline-secondary" id="clearSearchButton" style="display: none;" title="Clear search">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        </div>
        
        <!-- Search Results -->
        <div id="searchResults" class="mb-3" style="display: none;">
            <div class="card bg-dark border-secondary">
                <div class="card-header">
                    <h6 class="m-0 text-light">
                        <i class="bi bi-search me-2"></i>
                        Search Results: <span id="searchResultsTitle"></span>
                    </h6>
                </div>
                <div class="card-body">
                    <div id="searchResultsList"></div>
                </div>
            </div>
        </div>
        
        <!-- Create Folder Modal -->
        <div class="modal fade" id="createFolderModal" tabindex="-1" aria-labelledby="createFolderModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content bg-dark">
                    <div class="modal-header">
                        <h5 class="modal-title text-light" id="createFolderModalLabel">Create New Folder</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="createFolderForm">
                            <div class="mb-3">
                                <label for="folderNameInput" class="form-label text-light">Folder Name</label>
                                <input type="text" class="form-control bg-dark text-light border-secondary" id="folderNameInput" placeholder="Enter folder name" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" form="createFolderForm" class="btn btn-success">Create Folder</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Rename Modal -->
        <div class="modal fade" id="renameModal" tabindex="-1" aria-labelledby="renameModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content bg-dark">
                    <div class="modal-header">
                        <h5 class="modal-title text-light" id="renameModalLabel">Rename Item</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="renameForm">
                            <div class="mb-3">
                                <label for="newNameInput" class="form-label text-light">New Name</label>
                                <input type="text" class="form-control bg-dark text-light border-secondary" id="newNameInput" placeholder="Enter new name" required>
                                <small class="form-text text-muted">Special characters will be replaced with underscores</small>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" form="renameForm" class="btn btn-warning">Rename</button>
                    </div>
                </div>
            </div>
        </div>
        `
            : ''
        }

        <table class="table table-dark table-striped">
            <thead>
                <tr>
                    <th>
                        <a href="?sort=name&order=${sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc'}" 
                           class="text-light text-decoration-none">
                            Name ${(() => {
                              if (sortBy !== 'name') {
                                return '';
                              }
                              return sortOrder === 'asc' ? '↑' : '↓';
                            })()}
                        </a>
                    </th>
                    <th>Type</th>
                    <th>
                        <a href="?sort=size&order=${sortBy === 'size' && sortOrder === 'asc' ? 'desc' : 'asc'}"
                           class="text-light text-decoration-none">
                            Size ${(() => {
                              if (sortBy !== 'size') {
                                return '';
                              }
                              return sortOrder === 'asc' ? '↑' : '↓';
                            })()}
                        </a>
                    </th>
                    <th>
                        <a href="?sort=modified&order=${sortBy === 'modified' && sortOrder === 'asc' ? 'desc' : 'asc'}"
                           class="text-light text-decoration-none">
                            Last Modified ${(() => {
                              if (sortBy !== 'modified') {
                                return '';
                              }
                              return sortOrder === 'asc' ? '↑' : '↓';
                            })()}
                        </a>
                    </th>
                    <th>Checksum</th>
                    ${authType === 'uploads' ? '<th>Actions</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${itemsInfo
                  .map(
                    item => `
                    <tr>
                        <td>
                            <i class="bi ${item.isDirectory ? 'bi-folder folder-icon' : 'bi-file-earmark file-icon'} me-2" 
                               data-file-path="${join(relativePath, item.name).replace(/\\/g, '/')}"
                               title="Click to copy link"></i>
                            <a href="${join(relativePath, item.name).replace(/\\/g, '/')}" class="text-light">
                                ${item.name}
                            </a>
                        </td>
                        <td>${item.isDirectory ? 'Directory' : 'File'}</td>
                        <td>${item.isDirectory ? '-' : formatBytes(item.size)}</td>
                        <td>${item.mtime.toLocaleString()}</td>
                        <td>
                            ${(() => {
                              if (item.isDirectory) {
                                return 'N/A';
                              }
                              if (item.checksum === 'N/A' || item.checksum === 'Pending') {
                                return `<span class="text-muted">${item.checksum}</span>`;
                              }
                              return `
                                <span class="checksum" 
                                      data-checksum="${item.checksum}"
                                      title="Click to copy: ${item.checksum}"
                                      style="cursor: pointer; text-decoration: underline;">
                                    ${item.checksum.substring(0, 8)}...
                                </span>
                              `;
                            })()}
                        </td>
                        ${
                          authType === 'uploads'
                            ? `
                        <td>
                            <div class="btn-group" role="group">
                                <button class="btn btn-outline-warning btn-sm rename-btn" 
                                        data-path="${join(relativePath, item.name).replace(/\\/g, '/')}"
                                        data-name="${item.name}"
                                        title="Rename ${item.isDirectory ? 'directory' : 'file'}">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-outline-danger btn-sm delete-btn" 
                                        data-path="${join(relativePath, item.name).replace(/\\/g, '/')}"
                                        title="Delete ${item.isDirectory ? 'directory' : 'file'}">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </td>
                        `
                            : ''
                        }
                    </tr>
                `
                  )
                  .join('')}
            </tbody>
        </table>
        </div>
    </div>

    <!-- Footer -->
    <footer class="py-4 border-top border-secondary">
        <div class="container text-center">
            <div class="d-flex align-items-center justify-content-center">
                <span class="text-muted me-2">Powered by</span>
                <a href="https://startcloud.com" target="_blank" class="text-decoration-none d-flex align-items-center">
                    <img src="https://startcloud.com/assets/images/logos/startcloud-logo40.png" alt="STARTcloud" height="20" class="me-2">
                    <span class="text-light">STARTcloud</span>
                </a>
            </div>
        </div>
    </footer>

    <div id="copyIndicator" class="copy-indicator">
        Checksum copied to clipboard!
    </div>

    <script>
        // Log application name and version to browser console
        console.log('${packageInfo.name} v${packageInfo.version} - ${packageInfo.description}');

        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                const indicator = document.getElementById('copyIndicator');
                indicator.style.display = 'block';
                setTimeout(() => {
                    indicator.style.display = 'none';
                }, 2000);
            });
        }

        function copyFileLink(filePath, iconElement) {
            const fullUrl = window.location.origin + filePath;
            navigator.clipboard.writeText(fullUrl).then(() => {
                // Add animation class
                iconElement.classList.add('copy-animation');
                
                // Show copy indicator
                const indicator = document.getElementById('copyIndicator');
                indicator.textContent = 'Link copied to clipboard!';
                indicator.style.display = 'block';
                
                // Remove animation and hide indicator
                setTimeout(() => {
                    iconElement.classList.remove('copy-animation');
                    indicator.style.display = 'none';
                    indicator.textContent = 'Checksum copied to clipboard!';
                }, 1500);
            }).catch(() => {
                // Fallback for copy failure
                iconElement.classList.add('copy-animation');
                setTimeout(() => {
                    iconElement.classList.remove('copy-animation');
                }, 1500);
            });
        }

        function downloadFile(filePath, iconElement) {
            // Add long press animation
            iconElement.classList.add('long-press-animation');
            
            // Create download link with Content-Disposition header to force download
            const downloadUrl = window.location.origin + filePath;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filePath.split('/').pop(); // Use filename
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show download indicator
            const indicator = document.getElementById('copyIndicator');
            indicator.textContent = 'Download started!';
            indicator.style.display = 'block';
            
            // Remove animation and hide indicator
            setTimeout(() => {
                iconElement.classList.remove('long-press-animation');
                indicator.style.display = 'none';
                indicator.textContent = 'Checksum copied to clipboard!';
            }, 1500);
        }

        // Long press detection variables
        let pressTimer = null;
        let isLongPress = false;

        function login() {
            fetch(window.location.pathname + '?auth=1', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then(() => {
                window.location.reload();
            });
        }

        function logout() {
            // Simple redirect to logout URL - server handles cookie clearing
            window.location.href = '/logout';
        }

        function redirectToLogin() {
            window.location.href = '/login?return=' + encodeURIComponent(window.location.pathname);
        }

        function deleteItem(itemPath) {
            console.log('Delete button clicked for:', itemPath);
            if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
                console.log('User confirmed deletion, sending DELETE request');
                fetch(itemPath, {
                    method: 'DELETE',
                    credentials: 'same-origin'
                }).then(response => {
                    console.log('DELETE response:', response.status);
                    if (response.ok) {
                        console.log('Delete successful, waiting for SSE update (no page reload)');
                        // Don't reload - SSE will handle real-time removal
                    } else {
                        response.json().then(data => {
                            console.error('Delete failed:', data);
                            alert('Delete failed: ' + (data.message || 'Unknown error'));
                        }).catch(() => {
                            console.error('Delete failed: Server error');
                            alert('Delete failed: Server error');
                        });
                    }
                }).catch(error => {
                    console.error('Delete failed: Network error', error);
                    alert('Delete failed: Network error');
                });
            } else {
                console.log('User cancelled deletion');
            }
        }
        
        function removeFileFromTable(filePath, isDirectory) {
            console.log('Removing file from table:', filePath, 'isDirectory:', isDirectory);
            
            // Extract filename from path
            const fileName = filePath.split('/').pop();
            const rows = document.querySelectorAll('tbody tr');
            
            console.log('Looking for filename to remove:', fileName, 'in', rows.length, 'rows');
            
            // Find and remove the matching row
            for (const row of rows) {
                const nameCell = row.querySelector('td:first-child a');
                
                if (nameCell) {
                    const cellText = nameCell.textContent.trim();
                    
                    console.log('Checking row for deletion - filename:', cellText);
                    
                    // Match exact filename
                    if (cellText.includes(fileName)) {
                        console.log('Found matching row, removing from table');
                        row.remove();
                        console.log('Row removed successfully');
                        return;
                    }
                }
            }
            
            console.log('No matching row found for deletion:', fileName);
        }

        // Long press event handlers
        document.addEventListener('mousedown', function(e) {
            if (e.target.classList.contains('file-icon')) {
                isLongPress = false;
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    const filePath = e.target.getAttribute('data-file-path');
                    if (filePath) {
                        downloadFile(filePath, e.target);
                    }
                }, 500); // 500ms for long press
            }
        });

        document.addEventListener('mouseup', function(e) {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
            
            // Reset long press flag after mouseup with delay to prevent click interference
            if (isLongPress) {
                setTimeout(() => { isLongPress = false; }, 100);
            }
        });

        document.addEventListener('mouseleave', function(e) {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
            
            // Reset long press flag on mouse leave
            setTimeout(() => { isLongPress = false; }, 100);
        });

        // Event delegation for checksum copying, file icon copying, and delete buttons (CSP-compliant)
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('checksum')) {
                const checksum = e.target.getAttribute('data-checksum');
                if (checksum) {
                    copyToClipboard(checksum);
                }
            }
            
            // Handle file/folder icon clicks - only copy link if NOT long press
            if ((e.target.classList.contains('file-icon') || e.target.classList.contains('folder-icon')) && !isLongPress) {
                const filePath = e.target.getAttribute('data-file-path');
                if (filePath) {
                    copyFileLink(filePath, e.target);
                }
            }
            
            // Handle rename button clicks
            if (e.target.classList.contains('rename-btn') || e.target.closest('.rename-btn')) {
                const button = e.target.classList.contains('rename-btn') ? e.target : e.target.closest('.rename-btn');
                const itemPath = button.getAttribute('data-path');
                const itemName = button.getAttribute('data-name');
                if (itemPath && itemName) {
                    showRenameModal(itemPath, itemName);
                }
            }
            
            // Handle delete button clicks (including icon clicks)
            if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
                const button = e.target.classList.contains('delete-btn') ? e.target : e.target.closest('.delete-btn');
                const itemPath = button.getAttribute('data-path');
                if (itemPath) {
                    deleteItem(itemPath);
                }
            }
        });

        // Server-Sent Events for real-time checksum updates
        console.log('Setting up EventSource connection to /events');
        const eventSource = new EventSource('/events');
        
        eventSource.onopen = function(event) {
            console.log('SSE connection opened successfully!', event);
        };
        
        eventSource.onerror = function(error) {
            console.error('SSE connection error occurred:', error);
            console.error('EventSource readyState:', eventSource.readyState);
            console.error('EventSource url:', eventSource.url);
        };
        
        eventSource.onmessage = function(event) {
            console.log('Received SSE message:', event);
            console.log('Event data:', event.data);
        };
        
        eventSource.addEventListener('checksum-update', function(event) {
            console.log('Received checksum-update event:', event);
            console.log('Event data:', event.data);
            
            try {
                const data = JSON.parse(event.data);
                console.log('Parsed checksum data:', data);
                updateChecksumInTable(data.filePath, data.checksum, data.size, data.mtime);
            } catch (error) {
                console.error('Error parsing SSE data:', error);
            }
        });
        
        eventSource.addEventListener('file-added', function(event) {
            console.log('Received file-added event:', event);
            console.log('Event data:', event.data);
            
            try {
                const data = JSON.parse(event.data);
                console.log('Parsed file addition data:', data);
                const fileName = data.filePath.split('/').pop();
                addFileToTable(fileName);
            } catch (error) {
                console.error('Error parsing file addition SSE data:', error);
            }
        });

        eventSource.addEventListener('file-deleted', function(event) {
            console.log('Received file-deleted event:', event);
            console.log('Event data:', event.data);
            
            try {
                const data = JSON.parse(event.data);
                console.log('Parsed delete data:', data);
                removeFileFromTable(data.filePath, data.isDirectory);
            } catch (error) {
                console.error('Error parsing delete SSE data:', error);
            }
        });
        
        eventSource.addEventListener('folder-created', function(event) {
            console.log('Received folder-created event:', event);
            console.log('Event data:', event.data);
            
            try {
                const data = JSON.parse(event.data);
                console.log('Parsed folder creation data:', data);
                addFolderToTable(data.folderPath);
            } catch (error) {
                console.error('Error parsing folder creation SSE data:', error);
            }
        });
        
        eventSource.addEventListener('file-renamed', function(event) {
            console.log('Received file-renamed event:', event);
            console.log('Event data:', event.data);
            
            try {
                const data = JSON.parse(event.data);
                console.log('Parsed rename data:', data);
                updateFileNameInTable(data.oldPath, data.newPath, data.isDirectory);
            } catch (error) {
                console.error('Error parsing rename SSE data:', error);
            }
        });
        
        // Add additional debugging
        setTimeout(() => {
            console.log('EventSource readyState after 1 second:', eventSource.readyState);
            console.log('EventSource URL:', eventSource.url);
        }, 1000);
        
        function addFileToTable(fileName) {
            const tbody = document.querySelector('tbody');
            const currentPath = window.location.pathname;
            const isUploads = ${authType === 'uploads' ? 'true' : 'false'};
            
            const row = document.createElement('tr');
            row.innerHTML = 
                \`<td><i class="bi bi-file-earmark file-icon me-2" data-file-path="\${currentPath}\${fileName}" title="Click to copy link"></i><a href="\${currentPath}\${fileName}" class="text-light">\${fileName}</a></td>\` +
                \`<td>File</td>\` +
                \`<td>-</td>\` +
                \`<td>\${new Date().toLocaleString()}</td>\` +
                \`<td><span class="text-warning">Pending...</span></td>\` +
                (isUploads ? \`<td><div class="btn-group" role="group"><button class="btn btn-outline-warning btn-sm rename-btn" data-path="\${currentPath}\${fileName}" data-name="\${fileName}" title="Rename file"><i class="bi bi-pencil"></i></button><button class="btn btn-outline-danger btn-sm delete-btn" data-path="\${currentPath}\${fileName}" title="Delete file"><i class="bi bi-trash"></i></button></div></td>\` : '');
            
            tbody.appendChild(row);
        }
        
        function updateChecksumInTable(filePath, checksum, size = null, mtime = null) {
            console.log('Updating checksum for:', filePath, 'with checksum:', checksum, 'size:', size, 'mtime:', mtime);
            
            // Extract filename from path
            const fileName = filePath.split('/').pop();
            const rows = document.querySelectorAll('tbody tr');
            
            console.log('Looking for filename:', fileName, 'in', rows.length, 'rows');
            
            // Find the row with matching filename AND "Pending" status (for duplicates)
            for (const row of rows) {
                const nameCell = row.querySelector('td:first-child a');
                const checksumCell = row.querySelector('td:nth-child(5)');
                const sizeCell = row.querySelector('td:nth-child(3)');
                const timestampCell = row.querySelector('td:nth-child(4)');
                
                if (nameCell && checksumCell) {
                    const cellText = nameCell.textContent.trim();
                    const checksumText = checksumCell.textContent.trim();
                    
                    console.log('Checking row - filename:', cellText, 'checksum status:', checksumText);
                    
                    // Match exact filename and look for "Pending..." status (handles duplicates)
                    if (cellText === fileName && checksumText === 'Pending...') {
                        console.log('Found matching row with Pending status, updating...');
                        
                        // Update checksum
                        checksumCell.innerHTML = \`<span class="checksum" data-checksum="\${checksum}" title="Click to copy: \${checksum}" style="cursor: pointer; text-decoration: underline;">\${checksum.substring(0, 8)}...</span>\`;
                        
                        // Update size if provided
                        if (size !== null && sizeCell) {
                            const formattedSize = formatBytes(size);
                            sizeCell.textContent = formattedSize;
                            console.log('Updated size to:', formattedSize);
                        }
                        
                        // Update timestamp if provided
                        if (mtime !== null && timestampCell) {
                            const formattedTime = new Date(mtime).toLocaleString();
                            timestampCell.textContent = formattedTime;
                            console.log('Updated timestamp to:', formattedTime);
                        }
                        
                        console.log('Checksum and metadata updated successfully');
                        return; // Exit after updating the first match
                    }
                }
            }
            
            console.log('No matching row found for filename:', fileName);
        }
        
        // Format bytes function (same as server-side)
        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        function updateExistingFileToPending(fileName) {
            console.log('Updating existing file to Pending:', fileName);
            
            const rows = document.querySelectorAll('tbody tr');
            
            // Find the existing row for this filename and reset it to "Pending"
            for (const row of rows) {
                const nameCell = row.querySelector('td:first-child a');
                const checksumCell = row.querySelector('td:nth-child(5)');
                const timestampCell = row.querySelector('td:nth-child(4)');
                
                if (nameCell && checksumCell) {
                    const cellText = nameCell.textContent.trim();
                    
                    // Match exact filename
                    if (cellText.includes(fileName)) {
                        console.log('Found existing row for replacement, updating timestamp and setting to Pending');
                        
                        // Update timestamp to now
                        if (timestampCell) {
                            timestampCell.textContent = new Date().toLocaleString();
                        }
                        
                        // Set checksum back to "Pending"
                        checksumCell.innerHTML = \`<span class="text-muted">Pending</span>\`;
                        console.log('Existing file updated to Pending status');
                        return true; // Return true to indicate row was found and updated
                    }
                }
            }
            
            console.log('No existing row found for replacement:', fileName);
            return false; // Return false to indicate no row was found
        }

        ${
          authType === 'uploads'
            ? `
        // Modern upload drop zone functionality
        const fileInput = document.querySelector('.upload-drop-zone__input');
        const dropZone = document.querySelector('.upload-drop-zone');

        // Handle drop zone click to open file dialog
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // Auto-upload when file is selected
        fileInput.addEventListener('change', (e) => {
            if (fileInput.files.length) {
                updateThumbnail(dropZone, fileInput.files[0]);
                uploadFile(fileInput.files[0]);
            }
        });

        // Drag and drop handlers
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('upload-drop-zone--over');
        });

        ['dragleave', 'dragend'].forEach((type) => {
            dropZone.addEventListener(type, () => {
                dropZone.classList.remove('upload-drop-zone--over');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('upload-drop-zone--over');
            
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                updateThumbnail(dropZone, e.dataTransfer.files[0]);
                uploadFile(e.dataTransfer.files[0]);
            }
        });

        // Update thumbnail/preview after file selection
        function updateThumbnail(dropZoneElement, file) {
            let thumbnailElement = dropZoneElement.querySelector('.upload-drop-zone__thumb');

            // Remove the prompt on first upload
            const promptElement = dropZoneElement.querySelector('.upload-drop-zone__prompt');
            if (promptElement) {
                promptElement.style.display = 'none';
            }

            // Create thumbnail element if it doesn't exist
            if (!thumbnailElement) {
                thumbnailElement = document.createElement('div');
                thumbnailElement.classList.add('upload-drop-zone__thumb');
                dropZoneElement.appendChild(thumbnailElement);
            }

            thumbnailElement.dataset.label = file.name;

            // Show thumbnail for image files
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    thumbnailElement.style.backgroundImage = 'url(' + reader.result + ')';
                };
            } else {
                thumbnailElement.style.backgroundImage = null;
                thumbnailElement.innerHTML = '<i class="bi bi-file-earmark text-light" style="font-size: 2rem;"></i>';
            }

            thumbnailElement.style.display = 'flex';
        }

        // Upload file function
        function uploadFile(file) {
            const formData = new FormData();
            formData.append('file', file);
            
            // Show progress bar
            const uploadProgress = document.getElementById('uploadProgress');
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progressText');
            
            uploadProgress.style.display = 'block';
            
            // Use XMLHttpRequest for upload progress tracking
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    progressBar.style.width = percentComplete + '%';
                    progressBar.setAttribute('aria-valuenow', percentComplete);
                    progressText.textContent = percentComplete + '%';
                    console.log(\`Upload progress: \${Math.round(percentComplete)}%\`);
                }
            };
            
            // Handle upload completion
            xhr.onload = () => {
                uploadProgress.style.display = 'none';
                progressBar.style.width = '0%';
                progressText.textContent = '0%';
                
                if (xhr.status === 200) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        console.log('Upload response:', result);
                        
                        if (result.type === 'new') {
                            console.log('New file uploaded, adding to table');
                            addFileToTable(result.filename);
                        } else if (result.type === 'replacement') {
                            console.log('File replacement detected, updating existing row');
                            const rowFound = updateExistingFileToPending(result.filename);
                            if (!rowFound) {
                                console.log('No existing row found for replacement, adding as new');
                                addFileToTable(result.filename);
                            }
                        }
                        
                        // Reset drop zone after successful upload
                        resetDropZone();
                        
                    } catch (error) {
                        console.error('Error parsing upload response:', error);
                        alert('Upload completed but response parsing failed');
                        resetDropZone();
                    }
                } else {
                    console.error('Upload failed with status:', xhr.status);
                    alert('Upload failed: ' + xhr.responseText);
                    resetDropZone();
                }
            };
            
            // Handle upload errors
            xhr.onerror = () => {
                uploadProgress.style.display = 'none';
                progressBar.style.width = '0%';
                progressText.textContent = '0%';
                console.error('Upload error occurred');
                alert('Upload failed: Network error');
                resetDropZone();
            };
            
            // Start the upload
            xhr.open('POST', window.location.pathname + '?path=' + encodeURIComponent(window.location.pathname));
            xhr.send(formData);
        }

        // Reset drop zone to initial state
        function resetDropZone() {
            const dropZone = document.querySelector('.upload-drop-zone');
            const thumbnail = dropZone.querySelector('.upload-drop-zone__thumb');
            const prompt = dropZone.querySelector('.upload-drop-zone__prompt');
            
            if (thumbnail) {
                thumbnail.remove();
            }
            if (prompt) {
                prompt.style.display = 'flex';
            }
            
            // Clear file input
            fileInput.value = '';
        }
        
        // Folder creation form handler
        const createFolderForm = document.getElementById('createFolderForm');
        const folderNameInput = document.getElementById('folderNameInput');
        
        createFolderForm.onsubmit = async (e) => {
            e.preventDefault();
            const folderName = folderNameInput.value.trim();
            
            if (!folderName) {
                alert('Please enter a folder name');
                return;
            }
            
            try {
                const response = await fetch(window.location.pathname + 'folders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ folderName })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    console.log('Folder created successfully:', result);
                    folderNameInput.value = ''; // Clear the form
                    
                    // Close the modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('createFolderModal'));
                    modal.hide();
                    
                    // SSE will handle adding the folder to the table
                } else {
                    alert('Folder creation failed: ' + result.message);
                }
            } catch (error) {
                console.error('Folder creation error:', error);
                alert('Folder creation failed: ' + error.message);
            }
        };
        
        function addFolderToTable(folderPath) {
            console.log('Adding folder to table:', folderPath);
            
            const folderName = folderPath.split('/').pop();
            const tbody = document.querySelector('tbody');
            const currentPath = window.location.pathname;
            const isUploads = ${authType === 'uploads' ? 'true' : 'false'};
            
            const row = document.createElement('tr');
            row.innerHTML = 
                \`<td><a href="\${currentPath}\${folderName}/" class="text-light"><i class="bi bi-folder me-2"></i>\${folderName}</a></td>\` +
                \`<td>Directory</td>\` +
                \`<td>-</td>\` +
                \`<td>\${new Date().toLocaleString()}</td>\` +
                \`<td>N/A</td>\` +
                (isUploads ? \`<td><button class="btn btn-outline-danger btn-sm delete-btn" data-path="\${currentPath}\${folderName}" title="Delete directory"><i class="bi bi-trash"></i></button></td>\` : '');
            
            tbody.appendChild(row);
            console.log('Folder added to table successfully');
        }
        
        function updateFileNameInTable(oldPath, newPath, isDirectory) {
            console.log('Updating filename in table:', oldPath, '→', newPath, 'isDirectory:', isDirectory);
            
            const oldFileName = oldPath.split('/').pop();
            const newFileName = newPath.split('/').pop();
            const rows = document.querySelectorAll('tbody tr');
            
            console.log('Looking for old filename:', oldFileName, 'to rename to:', newFileName);
            
            // Find the row with the old filename
            for (const row of rows) {
                const nameCell = row.querySelector('td:first-child a');
                const iconElement = row.querySelector('td:first-child i');
                const deleteBtn = row.querySelector('.delete-btn');
                const renameBtn = row.querySelector('.rename-btn');
                
                if (nameCell) {
                    const cellText = nameCell.textContent.trim();
                    
                    console.log('Checking row for rename - filename:', cellText);
                    
                    // Match exact filename
                    if (cellText.includes(oldFileName)) {
                        console.log('Found matching row, updating filename and links');
                        
                        // Update the filename text
                        nameCell.textContent = newFileName;
                        
                        // Update the href
                        const newHref = nameCell.href.replace(oldFileName, newFileName);
                        nameCell.href = newHref;
                        
                        // Update icon data attribute for copy functionality
                        if (iconElement) {
                            const newDataPath = iconElement.getAttribute('data-file-path').replace(oldFileName, newFileName);
                            iconElement.setAttribute('data-file-path', newDataPath);
                        }
                        
                        // Update button data attributes
                        if (deleteBtn) {
                            const newDeletePath = deleteBtn.getAttribute('data-path').replace(oldFileName, newFileName);
                            deleteBtn.setAttribute('data-path', newDeletePath);
                        }
                        
                        if (renameBtn) {
                            const newRenamePath = renameBtn.getAttribute('data-path').replace(oldFileName, newFileName);
                            renameBtn.setAttribute('data-path', newRenamePath);
                            renameBtn.setAttribute('data-name', newFileName);
                        }
                        
                        console.log('Filename updated successfully in table');
                        return;
                    }
                }
            }
            
            console.log('No matching row found for rename:', oldFileName);
        }
        
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        const clearSearchButton = document.getElementById('clearSearchButton');
        const searchResults = document.getElementById('searchResults');
        const searchResultsTitle = document.getElementById('searchResultsTitle');
        const searchResultsList = document.getElementById('searchResultsList');
        
        function performSearch() {
            const query = searchInput.value.trim();
            
            if (!query) {
                alert('Please enter a search term');
                return;
            }
            
            console.log('Performing search for:', query);
            
            fetch(window.location.pathname + 'search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    displaySearchResults(result);
                    clearSearchButton.style.display = 'inline-block';
                } else {
                    alert('Search failed: ' + result.message);
                }
            })
            .catch(error => {
                console.error('Search error:', error);
                alert(\`Search failed: \${error.message}\`);
            });
        }
        
        function displaySearchResults(result) {
            searchResultsTitle.textContent = \`\${result.total} results for "\${result.query}"\`;
            
            if (result.results.length === 0) {
                searchResultsList.innerHTML = '<p class="text-muted">No files or checksums found matching your search.</p>';
            } else {
                const resultItems = result.results.map(file => {
                    const checksum = (() => {
                        if (file.checksum !== 'Pending' && file.checksum !== 'N/A') {
                            return \`<span class="checksum" data-checksum="\${file.checksum}" title="Click to copy: \${file.checksum}" style="cursor: pointer; text-decoration: underline;">\${file.checksum.substring(0, 8)}...</span>\`;
                        }
                        return \`<span class="text-muted">\${file.checksum}</span>\`;
                    })();
                    
                    return \`
                        <div class="d-flex justify-content-between align-items-center py-2 border-bottom border-secondary">
                            <div>
                                <div>
                                    <a href="\${file.path}" class="text-light text-decoration-none">
                                        <i class="bi \${file.isDirectory ? 'bi-folder' : 'bi-file-earmark'} me-2"></i>
                                        \${file.name}
                                    </a>
                                </div>
                                <small class="text-muted">\${file.path}</small>
                            </div>
                            <div class="text-end">
                                <div>\${checksum}</div>
                                <small class="text-muted">\${file.isDirectory ? 'Directory' : formatBytes(file.size)}</small>
                            </div>
                        </div>
                    \`;
                }).join('');
                
                searchResultsList.innerHTML = resultItems;
            }
            
            searchResults.style.display = 'block';
        }
        
        function clearSearch() {
            searchInput.value = '';
            searchResults.style.display = 'none';
            clearSearchButton.style.display = 'none';
        }
        
        // Rename functionality
        let currentRenamePath = '';
        
        function showRenameModal(itemPath, currentName) {
            currentRenamePath = itemPath;
            const newNameInput = document.getElementById('newNameInput');
            newNameInput.value = currentName;
            
            const modal = new bootstrap.Modal(document.getElementById('renameModal'));
            modal.show();
            
            // Focus and select the filename (without extension for files)
            setTimeout(() => {
                newNameInput.focus();
                if (currentName.includes('.')) {
                    const dotIndex = currentName.lastIndexOf('.');
                    newNameInput.setSelectionRange(0, dotIndex);
                } else {
                    newNameInput.select();
                }
            }, 100);
        }
        
        // Rename form handler
        const renameForm = document.getElementById('renameForm');
        const newNameInput = document.getElementById('newNameInput');
        
        if (renameForm) {
            renameForm.onsubmit = async (e) => {
                e.preventDefault();
                const newName = newNameInput.value.trim();
                
                if (!newName) {
                    alert('Please enter a new name');
                    return;
                }
                
                try {
                    const response = await fetch(currentRenamePath + '?action=rename', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ newName })
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        console.log('Rename successful:', result);
                        
                        // Close the modal
                        const modal = bootstrap.Modal.getInstance(document.getElementById('renameModal'));
                        modal.hide();
                        
                        // SSE will handle updating the table in real-time
                    } else {
                        alert('Rename failed: ' + result.message);
                    }
                } catch (error) {
                    console.error('Rename error:', error);
                    alert('Rename failed: ' + error.message);
                }
            };
        }

        // Search event handlers
        if (searchButton) {
            searchButton.onclick = performSearch;
        }
        
        if (clearSearchButton) {
            clearSearchButton.onclick = clearSearch;
        }
        
        if (searchInput) {
            searchInput.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    performSearch();
                }
            };
        }

        // Upload section toggle functionality
        const toggleUploadBtn = document.getElementById('toggleUploadSection');
        const uploadSection = document.getElementById('uploadSection');
        
        if (toggleUploadBtn && uploadSection) {
            toggleUploadBtn.addEventListener('click', () => {
                const isHidden = uploadSection.style.display === 'none';
                uploadSection.style.display = isHidden ? 'block' : 'none';
                
                // Update button icon to reflect state
                const icon = toggleUploadBtn.querySelector('i');
                if (isHidden) {
                    icon.className = 'bi bi-cloud-upload-fill';
                    toggleUploadBtn.title = 'Hide Upload Section';
                } else {
                    icon.className = 'bi bi-cloud-upload';
                    toggleUploadBtn.title = 'Show Upload Section';
                }
            });
        }
        `
            : ''
        }
    </script>
    
    <!-- Bootstrap JavaScript for modal functionality -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
    `;
};
