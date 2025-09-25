export const generateLoginPage = (errorMessage = '', config = {}) => {
  const {
    title = 'Armor',
    subtitle = 'ARMOR Reliably Manages Online Resources',
    iconClass = 'bi bi-cloud-download',
    iconUrl = null,
    primaryColor = '#0d6efd',
    packageInfo = {
      name: 'Armor',
      version: '1.0.0',
      description: 'ARMOR Reliably Manages Online Resources',
    },
  } = config;

  return `
<!DOCTYPE html>
<html>
<head>
    <title>Login - Armor</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css" rel="stylesheet">
    <style>
        body { background-color: #212529; color: #fff; min-height: 100vh; }
        .login-container { 
            min-height: 100vh; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
        }
        .login-card { 
            background-color: #343a40; 
            border: 1px solid #495057; 
            border-radius: 0.5rem;
            max-width: 400px;
            width: 100%;
        }
        .btn-oidc {
            width: 100%;
            margin-bottom: 0.5rem;
        }
        .divider {
            text-align: center;
            padding: 1rem 0;
            position: relative;
        }
        .divider::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 1px;
            background-color: #6c757d;
        }
        .divider span {
            background-color: #343a40;
            padding: 0 1rem;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-card p-4">
            <div class="text-center mb-4">
                ${(() => {
                  if (iconUrl && (!title || title === '')) {
                    return `<h2><img src="${iconUrl}" alt="Logo"></h2>`;
                  }
                  if (title) {
                    const iconHtml = iconUrl
                      ? `<img src="${iconUrl}" alt="${title}" height="24" class="me-2">`
                      : `<i class="${iconClass} me-2" style="color: ${primaryColor};"></i>`;
                    return `<h2>${iconHtml}${title}</h2>`;
                  }
                  return `<h2><i class="${iconClass} me-2" style="color: ${primaryColor};"></i>Armor</h2>`;
                })()}
                <p class="text-muted mb-0">${subtitle}</p>
            </div>

            ${
              errorMessage
                ? `
            <div class="alert alert-danger" role="alert">
                <i class="bi bi-exclamation-triangle"></i> ${errorMessage}
            </div>
            `
                : ''
            }

            <!-- OIDC Provider Buttons (loaded dynamically) -->
            <div id="oidc-providers" style="display:none;">
            </div>

            <!-- Divider between OIDC and Basic Auth -->
            <div id="auth-divider" class="divider" style="display:none;"></div>

            <!-- Basic Auth Form -->
            <form id="basicAuthForm">
                <div class="mb-3">
                    <label for="username" class="form-label">Username</label>
                    <input type="text" class="form-control bg-dark text-white border-secondary" 
                           id="username" name="username" autocomplete="username" required>
                </div>
                <div class="mb-3">
                    <label for="password" class="form-label">Password</label>
                    <input type="password" class="form-control bg-dark text-white border-secondary" 
                           id="password" name="password" autocomplete="current-password" required>
                </div>
                <button type="submit" class="btn w-100" style="background-color: ${primaryColor}; border-color: ${primaryColor}; color: white;">
                    <i class="bi bi-box-arrow-in-right"></i> Login
                </button>
            </form>

            <div class="text-center mt-3">
                <small class="text-muted">
                    Powered by <a href="https://startcloud.com" target="_blank" class="text-decoration-none text-light">STARTcloud</a>
                </small>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Log application name and version to browser console
        console.log('${packageInfo.name} v${packageInfo.version} - ${packageInfo.description}');

        // Function to lighten dark colors for better contrast
        function lightenColor(color, amount = 0.3) {
            // Convert hex to RGB
            const hex = color.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            
            // Lighten each component
            const newR = Math.min(255, Math.floor(r + (255 - r) * amount));
            const newG = Math.min(255, Math.floor(g + (255 - g) * amount));
            const newB = Math.min(255, Math.floor(b + (255 - b) * amount));
            
            // Convert back to hex
            return '#' + ((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1);
        }

        // Load available auth methods and show OIDC options
        fetch('/auth/methods')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.methods) {
                    let hasOidc = false;
                    const oidcContainer = document.getElementById('oidc-providers');
                    
                    data.methods.forEach(method => {
                        if (method.id.startsWith('oidc-') && method.enabled) {
                            hasOidc = true;
                            const provider = method.id.replace('oidc-', '');
                            const baseColor = method.color || '#198754';
                            const lightColor = lightenColor(baseColor);
                            
                            // Create button element dynamically
                            const buttonElement = document.createElement('a');
                            const returnParam = window.location.search.includes('?return=') ? '?' + window.location.search.substring(1) : '';
                            buttonElement.href = '/auth/oidc/' + provider + returnParam;
                            buttonElement.className = 'btn btn-oidc';
                            buttonElement.style.backgroundColor = 'transparent';
                            buttonElement.style.borderColor = baseColor;  // Exact color for border
                            buttonElement.style.color = lightColor;       // Lightened color for text
                            buttonElement.innerHTML = '<i class="bi bi-shield-lock"></i> ' + method.name;
                            
                            oidcContainer.appendChild(buttonElement);
                        }
                    });
                    
                    if (hasOidc) {
                        document.getElementById('oidc-providers').style.display = 'block';
                        document.getElementById('auth-divider').style.display = 'block';
                    }
                }
            })
            .catch(console.error);

        // Handle basic auth form submission
        document.getElementById('basicAuthForm').onsubmit = async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                const response = await fetch('/auth/login/basic', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // Redirect to return URL or home
                    const returnUrl = window.location.search.includes('?return=') ? 
                        decodeURIComponent(window.location.search.split('return=')[1]) : '/';
                    window.location.href = returnUrl;
                } else {
                    // Show error and stay on login page
                    const errorMsg = result.message || 'Login failed';
                    window.location.href = '/login?error=invalid_credentials&message=' + encodeURIComponent(errorMsg) +
                        (window.location.search.includes('?return=') ? '&' + window.location.search.substring(1) : '');
                }
            } catch (error) {
                window.location.href = '/login?error=network_error' + 
                    (window.location.search.includes('?return=') ? '&' + window.location.search.substring(1) : '');
            }
        };
    </script>
</body>
</html>
    `;
};
