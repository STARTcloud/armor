import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ConfigLoader {
  constructor() {
    this.config = null;
  }

  async load() {
    if (!this.config) {
      try {
        // Check environment variable first (set by systemd)
        const configFiles = [];

        if (process.env.CONFIG_PATH) {
          configFiles.push(process.env.CONFIG_PATH);
        }

        // Then check local files in priority order
        configFiles.push(
          join(__dirname, '../dev.config.yaml'),
          join(__dirname, '../config.yaml'),
          join(__dirname, '../auth.yaml') // Legacy fallback
        );

        let configContent = null;
        let loadedFile = null;

        const readPromises = configFiles.map(async configFile => {
          try {
            const content = await fs.readFile(configFile, 'utf8');
            return { content, file: configFile };
          } catch {
            return null;
          }
        });

        const results = await Promise.all(readPromises);
        const validResult = results.find(result => result !== null);

        if (validResult) {
          configContent = validResult.content;
          loadedFile = validResult.file;
        }

        if (!configContent) {
          throw new Error(
            'No configuration file found. Expected dev.config.yaml, config.yaml, or auth.yaml'
          );
        }

        this.config = yaml.load(configContent);
        console.log(`Configuration loaded from: ${basename(loadedFile)}`);
      } catch (error) {
        throw new Error(`Failed to load configuration: ${error.message}`);
      }
    }
    return this.config;
  }

  getConfig() {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.');
    }
    return this.config;
  }

  getAuthUsers() {
    return this.getConfig().authentication?.local?.users || [];
  }

  getAllowedDirectories() {
    return this.getConfig().authentication?.local?.allowed_directories || [];
  }

  getStaticDirectories() {
    return this.getConfig().authentication?.local?.static_directories || [];
  }

  getSSLConfig() {
    return this.getConfig().ssl;
  }

  getServerConfig() {
    return (
      this.getConfig().server || {
        domain: 'localhost',
        port: 443,
        show_root_index: false,
      }
    );
  }

  getSwaggerConfig() {
    return (
      this.getConfig().swagger || {
        allow_full_key_retrieval: false,
        allow_temp_key_generation: true,
        temp_key_expiration_hours: 1,
      }
    );
  }

  getDatabaseConfig() {
    return (
      this.getConfig().database || {
        dialect: 'sqlite',
        storage: './file-metadata.db',
        logging: false,
      }
    );
  }

  getAuthenticationConfig() {
    return (
      this.getConfig().authentication || {
        jwt_secret: 'your-jwt-secret-key-change-this',
        jwt_expiration: '24h',
        oidc_providers: {},
        permission_strategy: 'domain_based',
        domain_mappings: {
          downloads: ['*'],
          uploads: [],
        },
        claims_mappings: {
          downloads: [],
          uploads: [],
        },
      }
    );
  }

  getRateLimitConfig() {
    return (
      this.getConfig().rate_limiting || {
        window_minutes: 10,
        max_requests: 100,
        message: 'Too many requests from this IP, please try again later.',
        skip_successful_requests: false,
        skip_failed_requests: false,
      }
    );
  }

  getFileWatcherConfig() {
    return (
      this.getConfig().file_watcher || {
        batch_size: 10,
        max_concurrent_checksums: 5,
        batch_delay_ms: 2000,
        checksum_timeout_ms: 300000,
        enable_progress_logging: true,
      }
    );
  }

  getLoggingConfig() {
    return (
      this.getConfig().logging || {
        log_directory: '/var/log/armor',
        log_level: 'info',
        max_file_size_mb: 10,
        max_files: 5,
        enable_rotation: true,
      }
    );
  }
}

export default new ConfigLoader();
