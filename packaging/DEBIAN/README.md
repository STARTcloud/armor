# Building Armor Debian Packages

Production-ready Debian package build process with automated CI/CD via Release Please.

## Prerequisites

```bash
sudo apt update
sudo apt install nodejs npm dpkg-dev gdebi-core
```

## Quick Build Commands

### 1. Prepare Application
```bash
# Clean any existing build artifacts

# Sync versions across all config files
npm run sync-versions

# Install dependencies
npm ci

# Install production dependencies only
npm ci --omit=dev
```

### 2. Create Package Structure
```bash
# Extract version from package.json
export VERSION=$(node -p "require('./package.json').version")
export PACKAGE_NAME="armor"
export ARCH="amd64"

# Create directory structure
mkdir -p "${PACKAGE_NAME}_${VERSION}_${ARCH}"/{opt/armor,etc/armor,etc/systemd/system,var/lib/armor,var/log/armor,usr/share/man/man8,usr/share/man/man5,DEBIAN}
```

### 3. Copy Application Files
```bash
# Application files to /opt/armor (Armor's backend-only structure)
cp -r models routes middleware config utils services scripts app.js package.json "${PACKAGE_NAME}_${VERSION}_${ARCH}/opt/armor/"
cp -r node_modules "${PACKAGE_NAME}_${VERSION}_${ARCH}/opt/armor/"
cp -r web/static "${PACKAGE_NAME}_${VERSION}_${ARCH}/opt/armor/web/"

# Configuration files
cp packaging/config/production-config.yaml "${PACKAGE_NAME}_${VERSION}_${ARCH}/etc/armor/config.yaml"

# Systemd service (with privileged port capabilities)
cp packaging/DEBIAN/systemd/armor.service "${PACKAGE_NAME}_${VERSION}_${ARCH}/etc/systemd/system/"

# DEBIAN control files
cp packaging/DEBIAN/postinst packaging/DEBIAN/prerm packaging/DEBIAN/postrm "${PACKAGE_NAME}_${VERSION}_${ARCH}/DEBIAN/"

# Man pages (compress following Debian Policy)
gzip -9 -c packaging/DEBIAN/man/armor.8 > "${PACKAGE_NAME}_${VERSION}_${ARCH}/usr/share/man/man8/armor.8.gz"
gzip -9 -c packaging/DEBIAN/man/armor.yaml.5 > "${PACKAGE_NAME}_${VERSION}_${ARCH}/usr/share/man/man5/armor.yaml.5.gz"
```

### 4. Generate Control File
```bash
# Create control file with dynamic version
cat > "${PACKAGE_NAME}_${VERSION}_${ARCH}/DEBIAN/control" << EOF
Package: armor
Version: ${VERSION}
Section: misc
Priority: optional
Architecture: ${ARCH}
Maintainer: Makr91 <makr91@users.noreply.github.com>
Depends: nodejs (>= 20.0.0), sqlite3, openssl
Description: Armor
 Web-based management interface for Secure Web Resources
Homepage: https://github.com/STARTcloud/armor
EOF
```

### 5. Set Permissions
```bash
# Set proper permissions
find "${PACKAGE_NAME}_${VERSION}_${ARCH}" -type d -exec chmod 755 {} \;
find "${PACKAGE_NAME}_${VERSION}_${ARCH}" -type f -exec chmod 644 {} \;
chmod 755 "${PACKAGE_NAME}_${VERSION}_${ARCH}/DEBIAN"/{postinst,prerm,postrm}
```

### 6. Build & Install Package
```bash
# Build .deb package
dpkg-deb --build "${PACKAGE_NAME}_${VERSION}_${ARCH}" "${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"

# Install package
sudo gdebi -n "${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"

# Start service
sudo systemctl enable --now armor

# Check status
sudo systemctl status armor
```

## Critical Build Notes

### ⚠️ Required Directories
**Must include these directories in the copy command or the package will fail:**
- `utils/` - Contains config loading utilities
- `scripts/` - Contains version synchronization tools
- `web/static/` - Contains CSS, JS, and image assets

### ✅ Single Source of Truth Versioning
**Root `package.json` is the ONLY place to change version numbers.**

The `npm run sync-versions` script automatically synchronizes the version to:
- ✅ `config/swagger.js` - API documentation version  
- ✅ `packaging/config/production-config.yaml` - Production config version
- ✅ `.release-please-manifest.json` - Release automation tracking

**To change version:** Only edit the `version` field in root `package.json`, then run `npm run sync-versions`

### 🔧 Systemd Service
The service includes:
- **Privileged port capabilities** (`CAP_NET_BIND_SERVICE`) for ports 80/443
- **Environment variables** (`CONFIG_PATH=/etc/armor/config.yaml`)
- **Security restrictions** (NoNewPrivileges, ProtectSystem, etc.)

## Automated CI/CD

### Release Please Integration
Every push to main triggers Release Please:
1. **Creates release PR** with version bumps and changelog
2. **Merges PR** → triggers package build
3. **Creates GitHub release** with `.deb` package attached
4. **Uses semantic versioning** based on conventional commits

### Manual Release Trigger
```bash
gh workflow run release-please.yml
```

## Package Information

- **Service User**: `armor` (created during installation)
- **Configuration**: `/etc/armor/config.yaml`
- **Data Directory**: `/var/lib/armor/`
- **Log Directory**: `/var/log/armor/`
- **SSL Certificates**: `/etc/armor/ssl/` (auto-generated)
- **JWT Secret**: `/etc/armor/.jwt-secret` (auto-generated)
- **Service**: `systemctl {start|stop|status|restart} armor`
- **Default Access**: `https://localhost:3443`
- **Manual Pages**: `man armor` and `man armor.yaml`

## Troubleshooting

### Common Build Errors
1. **Cannot find module '/opt/armor/utils/config.js'**
   - ❌ Missing `utils` in copy command
   - ✅ Fix: Add `utils` to the cp command

2. **Cannot stat 'web/static'**
   - ❌ Static assets missing
   - ✅ Fix: Ensure `web/static/` directory exists

3. **Version mismatch in API documentation**
   - ❌ Version sync issue
   - ✅ Fix: Run `npm run sync-versions`

4. **Static files not serving**
   - ❌ Directory structure incorrect
   - ✅ Fix: Verify `/opt/armor/web/static/` exists after installation

### Service Issues
```bash
# Check logs
sudo journalctl -fu armor

# Check config
sudo cat /etc/armor/config.yaml

# Restart service
sudo systemctl restart armor
```

### Uninstall
```bash
sudo systemctl stop armor

sudo apt remove armor

sudo apt autoremove

### Purge DB and Configs

sudo apt purge armor
