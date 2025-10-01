---
title: Home
layout: home
nav_order: 1
description: "Armor Documentation - ARMOR Reliably Manages Online Resources"
permalink: /
---

# Armor Documentation
{: .fs-9 }

A secure Node.js file server with comprehensive Swagger UI integration and real-time collaboration features.
{: .fs-6 .fw-300 }

[Get started now](#getting-started){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View API Reference](docs/api/swagger-ui.html){: .btn .fs-5 .mb-4 .mb-md-0 }
[View on GitHub](https://github.com/STARTcloud/armor){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Getting started

**ARMOR Reliably Manages Online Resources** - A production-ready file management system with comprehensive API documentation and real-time collaboration features.

### Key Features

- **Secure File Management**: Upload, download, rename, delete with real-time collaboration
- **Comprehensive Swagger UI**: Dark theme, seamless authentication, clean REST API design
- **Universal Authentication**: HTTP Basic Auth (wget compatible), JWT sessions, API keys
- **Role-Based Security**: Users (downloads only) vs Admins (full access)
- **Real-Time Collaboration**: All operations sync across users instantly via Server-Sent Events
- **Clean REST API**: Dedicated endpoints for search, folder creation, and file operations
- **Multi-Platform**: DEBIAN and OmniOS packages with professional CI/CD

### Architecture
```mermaid
graph TB
    subgraph "Client Layer"
        WB[Web Browser<br/>React SPA]
        CLI[CLI Tools<br/>wget/curl]
        API[API Clients<br/>Third-party Apps]
    end
    
    subgraph "Authentication Layer"
        AUTH{Authentication<br/>Middleware}
        JWT[JWT Sessions<br/>Web Interface]
        APIKEY[API Keys<br/>Bearer Tokens]
        BASIC[HTTP Basic Auth<br/>CLI Compatible]
        OIDC[OIDC Providers<br/>Google/OAuth]
    end
    
    subgraph "Armor Server Core"
        EXPRESS[Express.js Server<br/>HTTPS/Security Headers]
        ROUTER[Route Handlers<br/>REST API Endpoints]
        MIDDLEWARE[Security Middleware<br/>Helmet/CORS/CSRF/Rate Limiting]
    end
    
    subgraph "Real-time Communication"
        SSE[Server-Sent Events<br/>Live Updates]
        EVENTS[Event Broadcasting<br/>File Operations]
    end
    
    subgraph "Background Services"
        FILEWATCHER[File Watcher Service<br/>Chokidar/Real-time FS Monitoring]
        CHECKSUM[Checksum Service<br/>SHA256 Worker Pool]
        MAINTENANCE[Maintenance Service<br/>Database Optimization]
        CACHE[Cache Service<br/>Directory Listings]
    end
    
    subgraph "Data Layer"
        DB[(Database<br/>SQLite/PostgreSQL/MySQL)]
        FS[File System<br/>Secure Directory Serving]
        CONFIG[Configuration<br/>YAML-based Settings]
    end
    
    subgraph "Frontend Services"
        I18N[Internationalization<br/>Multi-language Support]
        PWA[Progressive Web App<br/>Service Worker]
        SWAGGER[Swagger UI<br/>API Documentation]
    end
    
    %% Client connections
    WB -.->|HTTPS/WSS| EXPRESS
    CLI -.->|HTTPS + Basic Auth| EXPRESS
    API -.->|HTTPS + Bearer Token| EXPRESS
    
    %% Authentication flow
    EXPRESS --> AUTH
    AUTH --> JWT
    AUTH --> APIKEY
    AUTH --> BASIC
    AUTH --> OIDC
    
    %% Server processing
    EXPRESS --> MIDDLEWARE
    MIDDLEWARE --> ROUTER
    ROUTER --> FILEWATCHER
    ROUTER --> CHECKSUM
    
    %% Real-time communication
    ROUTER --> SSE
    SSE --> EVENTS
    EVENTS -.->|Live Updates| WB
    
    %% Background services data flow
    FILEWATCHER --> DB
    FILEWATCHER --> EVENTS
    CHECKSUM --> DB
    CHECKSUM --> EVENTS
    MAINTENANCE --> DB
    CACHE --> DB
    
    %% Data persistence
    ROUTER --> DB
    ROUTER --> FS
    ROUTER --> CONFIG
    
    %% Frontend integration
    WB --> I18N
    WB --> PWA
    WB --> SWAGGER
    
    %% Service worker and caching
    PWA -.->|Offline Support| WB
    SWAGGER -.->|API Testing| ROUTER
    
    %% Configuration flow
    CONFIG --> EXPRESS
    CONFIG --> AUTH
    CONFIG --> FILEWATCHER
    CONFIG --> I18N
    
    %% File system monitoring
    FS --> FILEWATCHER
    FILEWATCHER -.->|Change Events| CHECKSUM
    
    classDef client fill:#e1f5fe
    classDef auth fill:#f3e5f5
    classDef server fill:#e8f5e8
    classDef realtime fill:#fff3e0
    classDef services fill:#f1f8e9
    classDef data fill:#fce4ec
    classDef frontend fill:#e3f2fd
    
    class WB,CLI,API client
    class AUTH,JWT,APIKEY,BASIC,OIDC auth
    class EXPRESS,ROUTER,MIDDLEWARE server
    class SSE,EVENTS realtime
    class FILEWATCHER,CHECKSUM,MAINTENANCE,CACHE services
    class DB,FS,CONFIG data
    class I18N,PWA,SWAGGER frontend
```

### Quick start

1. **Installation**: Install via DEBIAN package or build from source
2. **Configuration**: Edit `/etc/armor/config.yaml` for your environment
3. **Authentication**: Configure users and OIDC providers
4. **API Keys**: Generate keys for programmatic access
5. **Access**: Browse files via web interface or use comprehensive REST API
6. **Try API**: Visit the [API documentation](docs/api/swagger-ui.html) for interactive testing

### Core Capabilities

#### **Universal Authentication**
- **HTTP Basic Auth**: `wget --user=admin --password=pass https://domain.com/file.txt`
- **JWT Sessions**: Browser-based authentication with OIDC support
- **API Keys**: Bearer token authentication with configurable permissions

#### **Complete File Management**
- **Upload**: Drag-and-drop or API with automatic checksum calculation
- **Download**: Direct download or force download via long-press
- **Search**: Find files by name or SHA256 checksum
- **Rename**: Real-time file/folder renaming with SSE updates
- **Delete**: Secure deletion with multi-user notification

#### **Swagger UI Integration**
- **Dark theme**: Professional appearance with seamless integration
- **Dynamic server detection**: Auto-detects current host with custom override
- **API key integration**: Fill authentication directly from your existing keys
- **Temporary keys**: Generate testing keys on-demand
- **Clean REST design**: Dedicated endpoints eliminate API confusion

### Documentation

Comprehensive documentation for all aspects of Armor:

- **[API Reference](docs/api/)** - Interactive Swagger UI documentation
- **[Getting Started Guide](docs/guides/getting-started/)** - Step-by-step setup
- **[Installation Guide](docs/guides/installation/)** - DEBIAN and OmniOS packages
- **[Authentication Guide](docs/guides/authentication/)** - User management and API keys
- **[Configuration Reference](docs/configuration/)** - Complete config options

---

## About the project

Armor is &copy; 2025 by STARTcloud.

### License

Armor is distributed under a [GPL-3.0 license](https://github.com/STARTcloud/armor/blob/main/LICENSE.md).

### Contributing

When contributing to this repository, please first discuss the change you wish to make via issue, email, or any other method with the owners of this repository before making a change. Read more about becoming a contributor in [our GitHub repo](https://github.com/STARTcloud/armor#contributing).

#### Thank you to the contributors of Armor!

<ul class="list-style-none">
{% for contributor in site.github.contributors %}
  <li class="d-inline-block mr-1">
     <a href="{{ contributor.html_url }}"><img src="{{ contributor.avatar_url }}" width="32" height="32" alt="{{ contributor.login }}"></a>
  </li>
{% endfor %}
</ul>

### Code of Conduct

Armor is committed to fostering a welcoming community.

[View our Code of Conduct](https://github.com/STARTcloud/armor/tree/main/CODE_OF_CONDUCT.md) on our GitHub repository.
