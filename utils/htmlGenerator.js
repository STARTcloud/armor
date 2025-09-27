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
    <title>404 - Page Not Found | ${title}</title>
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
            color: ${primaryColor};
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <div class="error-card">
        <div class="error-icon">
            <i class="bi bi-exclamation-triangle"></i>
        </div>
        <h1 class="display-4 mb-4">404</h1>
        <p class="lead mb-3">Page Not Found</p>
        <p class="text-muted">${subtitle}</p>
        <hr class="my-4">
        <div class="mt-4">
            <a href="/" class="btn btn-outline-light">
                <i class="bi bi-house me-2"></i>
                Go Home
            </a>
        </div>
    </div>
</body>
</html>
`;
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
