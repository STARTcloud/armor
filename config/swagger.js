import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Armor API',
      version: '1.14.7',
      description:
        'API for Armor - ARMOR Reliably Manages Online Resources. A secure file management system with authentication and API key support.',
      license: {
        name: 'GPL-3.0',
        url: 'https://www.gnu.org/licenses/gpl-3.0.html',
      },
      contact: {
        name: 'Armor Project',
        url: 'https://github.com/STARTcloud/armor',
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and session management',
      },
      {
        name: 'API Keys',
        description: 'API key creation and management for programmatic access',
      },
      {
        name: 'Files',
        description: 'File and directory operations including upload, download, and management',
      },
      {
        name: 'Search',
        description: 'File search functionality',
      },
      {
        name: 'Events',
        description: 'Server-Sent Events for real-time updates',
      },
      {
        name: 'API Documentation',
        description: 'OpenAPI specification and documentation endpoints',
      },
      {
        name: 'Static Resources',
        description: 'Static file serving (favicon, robots.txt, etc.)',
      },
      {
        name: 'Checksum',
        description: 'File checksum processing and progress monitoring',
      },
      {
        name: 'Internationalization',
        description: 'Multi-language support and locale management',
      },
    ],
    servers: [
      {
        url: 'https://localhost:443',
        description: 'Current API Server (will be updated dynamically)',
      },
      {
        url: 'http://localhost:80',
        description: 'HTTP API Server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key',
          description:
            'API key authentication. Generate an API key from the web interface, then use format: Bearer <api_key>',
        },
        JwtAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'JWT token authentication. Login via web interface to get JWT token in cookies.',
        },
      },
      schemas: {
        File: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'File or directory name (basename)',
              example: 'document.pdf',
            },
            path: {
              type: 'string',
              description: 'Relative path from server root',
              example: '/uploads/document.pdf',
            },
            size: {
              type: 'integer',
              format: 'int64',
              description: 'File size in bytes (0 for directories)',
              example: 1024000,
            },
            mtime: {
              type: 'string',
              format: 'date-time',
              description: 'Last modified timestamp (mapped from database last_modified)',
              example: '2025-09-22T23:42:51.207Z',
            },
            checksum: {
              type: 'string',
              description:
                'SHA256 checksum (mapped from checksum_sha256, "Pending" for new files, null for directories)',
              example: '1c8bdacfd9077738c1db053d82aefd3601dc091fe94363e5ce344bdc062bf508',
            },
            isDirectory: {
              type: 'boolean',
              description: 'Whether the item is a directory (mapped from is_directory)',
              example: false,
            },
          },
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique API key identifier',
              example: 1,
            },
            name: {
              type: 'string',
              description: 'Human-readable name for the API key',
              example: 'CI Pipeline',
            },
            key_preview: {
              type: 'string',
              description: 'First 8 characters of the API key for display',
              example: 'aL6uDnFg',
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['downloads', 'uploads', 'delete'],
              },
              description: 'Array of permissions granted to this key',
              example: ['downloads', 'uploads'],
            },
            expires_at: {
              type: 'string',
              format: 'date-time',
              description: 'API key expiration date',
              example: '2025-10-22T23:42:51.207Z',
            },
            last_used: {
              type: 'string',
              format: 'date-time',
              description: 'Last usage timestamp',
              example: '2025-09-22T23:42:51.207Z',
              nullable: true,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
              example: '2025-09-22T23:42:51.207Z',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2025-09-22T23:42:51.207Z',
            },
            is_expired: {
              type: 'boolean',
              description: 'Whether the key has expired (computed field)',
              example: false,
            },
          },
        },
        ApiKeyRequest: {
          type: 'object',
          required: ['name', 'permissions', 'expires_at'],
          properties: {
            name: {
              type: 'string',
              description: 'Human-readable name for the API key',
              example: 'CI Pipeline',
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['downloads', 'uploads', 'delete'],
              },
              description: 'Array of permissions to grant to this key',
              example: ['downloads', 'uploads'],
            },
            expires_at: {
              type: 'string',
              format: 'date-time',
              description: 'API key expiration date (maximum 1 year from now)',
              example: '2025-10-22T23:42:51.207Z',
            },
          },
        },
        ApiKeyResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status',
              example: true,
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'API key created successfully',
            },
            api_key: {
              allOf: [
                { $ref: '#/components/schemas/ApiKey' },
                {
                  type: 'object',
                  properties: {
                    key: {
                      type: 'string',
                      description: 'Full API key (only shown once on creation)',
                      example: 'aL6uDnFgRRQJD0A6uKMNOf3K3jHnnt',
                    },
                  },
                },
              ],
            },
          },
        },
        DirectoryListing: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status',
              example: true,
            },
            path: {
              type: 'string',
              description: 'Directory path',
              example: '/uploads/',
            },
            files: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/File',
              },
              description: 'Array of files and directories',
            },
            total: {
              type: 'integer',
              description: 'Total number of items',
              example: 5,
            },
          },
        },
        SearchRequest: {
          type: 'object',
          required: ['query'],
          properties: {
            query: {
              type: 'string',
              description: 'Search term to look for in filenames and checksums',
              example: 'document',
            },
          },
        },
        SearchResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status',
              example: true,
            },
            query: {
              type: 'string',
              description: 'The search term used',
              example: 'document',
            },
            results: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/File',
              },
              description: 'Array of matching files',
            },
            total: {
              type: 'integer',
              description: 'Total number of results',
              example: 3,
            },
          },
        },
        FolderRequest: {
          type: 'object',
          required: ['folderName'],
          properties: {
            folderName: {
              type: 'string',
              description: 'Name of the folder to create',
              example: 'new-folder',
            },
          },
        },
        UploadResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status',
              example: true,
            },
            type: {
              type: 'string',
              enum: ['new', 'replacement'],
              description: 'Whether this was a new file or replacement',
              example: 'new',
            },
            filename: {
              type: 'string',
              description: 'Name of the uploaded file',
              example: 'document.pdf',
            },
            size: {
              type: 'integer',
              description: 'Size of the uploaded file in bytes',
              example: 1024000,
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status',
              example: true,
            },
            message: {
              type: 'string',
              description: 'Success message',
              example: 'Operation completed successfully',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status (always false for errors)',
              example: false,
            },
            message: {
              type: 'string',
              description: 'Error message',
              example: 'Authentication required',
            },
          },
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
      {
        JwtAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './models/*.js'], // paths to files containing OpenAPI definitions
};

const specs = swaggerJsdoc(options);

// This function is no longer used - we now use external JavaScript files

export { specs, swaggerUi };
