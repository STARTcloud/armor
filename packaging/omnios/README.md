# Building Armor OmniOS IPS Packages

Production-ready OmniOS IPS package build process for Armor.

## Build Methods

There are two approaches for building Armor OmniOS packages:

### Method 1: OmniOS Build Framework (Recommended)
If you're using the OmniOS build framework (omniosorg/omnios-build), place the Armor source in the build tree and use the provided `build.sh` script.

### Method 2: Manual Build Process
Traditional manual building using direct IPS commands.

## Prerequisites

On your OmniOS build system:

```bash
pfexec pkg install ooce/runtime/node-22 database/sqlite-3
```

## Package Information

- **Package Name:** `application/management/armor`
- **Publisher:** `MarkProminic`
- **Service FMRI:** `svc:/application/management/armor:default`
- **Install Path:** `/opt/armor/`
- **Config Path:** `/etc/armor/config.yaml`
- **User/Group:** `armor`

## Method 1: OmniOS Build Framework

If you're using the OmniOS build framework, follow these steps:

### Setup in Build Tree
```bash
# Place Armor in your build tree (example path)
cd /path/to/omnios-build/build
mkdir armor
cd armor

# Copy Armor source
cp -r /path/to/armor-source/* .

# The build.sh script expects these files:
# - build.sh (provided)
# - local.mog (provided)  
# - armor-smf.xml (SMF manifest)
# - startup.sh, shutdown.sh (method scripts)
# - All source files (controllers, models, etc.)
```

### Build with Framework
```bash
# From the armor directory in build tree
./build.sh

# This will:
# 1. Download/prepare source (if needed)
# 2. Run npm to build frontend and install dependencies
# 3. Create package structure in $DESTDIR
# 4. Generate and publish IPS package
```

### Integration Notes
- The `build.sh` script follows OmniOS build framework conventions
- Version is automatically extracted from `package.json`
- Dependencies are handled via `BUILD_DEPENDS_IPS` and `RUN_DEPENDS_IPS`
- SMF manifest and method scripts are automatically installed
- Package name: `application/management/armor`

## Method 2: Manual Build Commands

### 1. Build Application (On OmniOS)
```bash
cd /Array-0/armor/frontend

# Build the frontend first  
export PATH="/opt/ooce/bin:/opt/ooce/node-22/bin:$PATH"
npm run sync-versions
MAKE=gmake npm ci
cd web && MAKE=gmake npm ci && cd ..
npm run build

# Install production Node.js dependencies (this removes dev dependencies)
MAKE=gmake npm ci --omit=dev

export VERSION=$(node -p "require('./package.json').version")
```

### 2. Build IPS Package
```bash
# Set version in manifest
sed -i "s/@VERSION@/${VERSION}/g" packaging/omnios/armor.p5m

# Generate package manifest from current directory
pkgsend generate . | pkgfmt > armor.p5m.generated

# Apply transforms and create final manifest
pkgmogrify -DVERSION=${VERSION} packaging/omnios/armor.p5m armor.p5m.generated > armor.p5m.final

# Create a local repository for testing (if needed)
mkdir -p /tmp/local-repo
pkgrepo create /tmp/local-repo
pkgrepo set -s /tmp/local-repo publisher/prefix=MarkProminic

# Publish to local repository
pkgsend publish -d . -s /tmp/local-repo armor.p5m.final
```

### 3. Install & Test Package
```bash
# Add your local repository
pfexec pkg set-publisher -g file:///tmp/local-repo MarkProminic

# Install the package
pfexec pkg install application/management/armor

# Start the service
pfexec svcadm disable application/management/armor

pfexec svcadm enable application/management/armor

# Check status
svcs -l application/management/armor

# Check logs
tail -f /var/svc/log/system-virtualization-armor:default.log

# Test web interface
curl https://localhost:3443
```

## Package Structure

The IPS package will create:

```
/opt/armor/                    # Application files
├── app.js                        # Main Node.js application  
├── package.json                    # Package metadata
├── controllers/                    # API controllers
├── models/                         # Data models
├── routes/                         # Route definitions
├── middleware/                     # Express middleware
├── config/                         # Configuration files
├── utils/                          # Utility functions
├── scripts/                        # Build/maintenance scripts
├── web/dist/                       # Built frontend files
├── node_modules/                   # Production dependencies
├── startup.sh                      # SMF start method
└── shutdown.sh                     # SMF stop method

/etc/armor/                    # Configuration
└── config.yaml                     # Production configuration

/var/lib/armor/                # Data directory
└── database.sqlite                 # SQLite database

/var/log/armor/                # Log directory

/lib/svc/manifest/system/           # SMF manifest
└── armor.xml
```

## Dependencies

The package depends on:
- `ooce/runtime/node-22` (Node.js runtime)
- `database/sqlite-3` (SQLite database)
- Standard OmniOS system packages

## User & Service Management

The package automatically:
- Creates `armor` user and group
- Installs SMF service manifest
- Sets up proper file permissions
- Configures service dependencies

## Troubleshooting

### Build Errors

1. **Node.js not found:**
   ```bash
   export PATH="/opt/ooce/bin:/opt/ooce/node-22/bin:$PATH"
   ```

2. **npm install fails:**
   ```bash
   # Ensure you have the latest npm
   npm install -g npm@latest
   ```

3. **Package validation errors:**
   ```bash
   # Check manifest syntax
   pkglint armor.p5m.final
   ```

### Service Issues

```bash
# Check service status
svcs -xv application/management/armor

# View detailed logs
tail -f /var/svc/log/system-virtualization-armor:default.log

# Debug startup issues
/opt/armor/startup.sh

# Test Node.js directly
su - armor -c "cd /opt/armor && NODE_ENV=production CONFIG_PATH=/etc/armor/config.yaml node app.js"
```

### Network Issues

```bash
# Check if port 3443 is available
netstat -an | grep 3443

# Test with different port
# Edit /etc/armor/config.yaml

# Restart service
svcadm restart application/management/armor
```

### Permission Issues

```bash
# Fix ownership
chown -R armor:armor /opt/armor
chown -R armor:armor /var/lib/armor
chown -R armor:armor /var/log/armor

# Fix permissions
chmod 755 /opt/armor/startup.sh
chmod 755 /opt/armor/shutdown.sh
```

## Service Management

```bash
# Start service
svcadm enable application/management/armor

# Stop service  
svcadm disable application/management/armor

# Restart service
svcadm restart application/management/armor

# View service status
svcs -l application/management/armor

# Clear maintenance state
svcadm clear application/management/armor
```

## Uninstall

```bash
# Stop and disable service
svcadm disable application/management/armor

# Remove package
pkg uninstall application/management/armor

# Clean up any remaining files (optional)
rm -rf /var/lib/armor
rm -rf /var/log/armor
```

## Version Management

The package version is automatically synchronized with the main `package.json` via the build process. The SMF service will show the current version in its description.

## Default Access

After installation, Armor will be available at:
- **HTTPS:** `https://localhost:3443` (default)
- **Configuration:** `/etc/armor/config.yaml`

The default configuration can be customized before starting the service.
