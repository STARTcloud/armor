#!/usr/bin/bash
#
# CDDL HEADER START
#
# The contents of this file are subject to the terms of the
# Common Development and Distribution License, Version 1.0 only
# (the "License").  You may not use this file except in compliance
# with the License.
#
# You can obtain a copy of the license at usr/src/OPENSOLARIS.LICENSE
# or http://www.opensolaris.org/os/licensing.
# See the License for the specific language governing permissions
# and limitations under the License.
#
# When distributing Covered Code, include this CDDL HEADER in each
# file and include the License file at usr/src/OPENSOLARIS.LICENSE.
# If applicable, add the following below this CDDL HEADER, with the
# fields enclosed by brackets "[]" replaced with your own identifying
# information: Portions Copyright [yyyy] [name of copyright owner]
#
# CDDL HEADER END
#
#
# Copyright 2025 Makr91. All rights reserved.
# Use is subject to license terms.
#

set -e

# Simple logging functions
logmsg() { echo "=== $*"; }
logcmd() { echo ">>> $*"; "$@"; }
logerr() { echo "ERROR: $*" >&2; }

# Set up variables
SRCDIR="$(pwd)"
DESTDIR="${SRCDIR}/proto"
PROG=armor
VER=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")
PKG=application/management/armor

# Clean and create staging directory
rm -rf "$DESTDIR"
mkdir -p "$DESTDIR"

#### Build Structure
# /opt/armor/
#   # Node.js application files
#   app.js
#   package.json
#   controllers/
#   models/
#   routes/
#   middleware/
#   config/
#   utils/
#   scripts/
#   node_modules/
#   startup.sh
#   shutdown.sh
# /var/lib/armor/
# /var/log/armor/

build_app() {
    logmsg "Building Armor"
    
    # Set up environment for OmniOS/Solaris
    export MAKE=gmake
    export CC=gcc
    export CXX=g++
    
    # Set POSIX compilation flags for better-sqlite3 compatibility on Solaris
    export CPPFLAGS="-D_POSIX_C_SOURCE=199309L -D__EXTENSIONS__"
    export CFLAGS="-D_POSIX_C_SOURCE=199309L -D__EXTENSIONS__"
    
    # Install dependencies using structured scripts
    MAKE=gmake logcmd npm run install:all:nodev
    
    # TODO: Enable when Vite builds are ready
    # Build frontend
    # logcmd npm run build
}

install_app() {
    pushd $DESTDIR >/dev/null

    # Create main application directory
    logcmd mkdir -p opt/armor
    pushd opt/armor >/dev/null

    # Copy application files
    logmsg "Installing Armor application files"
    logcmd cp $SRCDIR/app.js .
    logcmd cp $SRCDIR/package.json .
    logcmd cp $SRCDIR/LICENSE.md .
    
    # Copy application directories (Armor's actual structure)
    for dir in models routes middleware config utils services scripts; do
        if [ -d "$SRCDIR/$dir" ]; then
            logcmd cp -r $SRCDIR/$dir .
        fi
    done
    
    # Copy web assets
    logcmd mkdir -p web
    # TODO: Enable when Vite builds are ready
    # logcmd cp -r $SRCDIR/web/dist web/
    # Temporary: Copy public assets directly
    logcmd cp -r $SRCDIR/web/public web/
    
    # Copy node_modules (production only)
    if [ -d "$SRCDIR/node_modules" ]; then
        logcmd cp -r $SRCDIR/node_modules .
    fi
    
    # Copy SMF method scripts
    logcmd cp $SRCDIR/packaging/omnios/startup.sh .
    logcmd cp $SRCDIR/packaging/omnios/shutdown.sh .
    logcmd chmod 755 startup.sh shutdown.sh
    
    popd >/dev/null # /opt/armor

    # Install configuration
    logmsg "Installing configuration files"
    logcmd mkdir -p etc/armor

    # Create data and log directories
    logcmd mkdir -p var/lib/armor
    logcmd mkdir -p var/log/armor

    # Install SMF manifest
    logmsg "Installing SMF manifest"
    logcmd mkdir -p lib/svc/manifest/system
    logcmd cp $SRCDIR/packaging/omnios/armor-smf.xml lib/svc/manifest/system/armor.xml

    # Install man pages in standard OOCE location
    logmsg "Installing man pages"
    logcmd mkdir -p opt/ooce/share/man/man8 opt/ooce/share/man/man5
    logcmd cp $SRCDIR/packaging/omnios/man/armor.8 opt/ooce/share/man/man8/ || \
        logerr "--- copying main man page failed"
    logcmd cp $SRCDIR/packaging/omnios/man/armor.yaml.5 opt/ooce/share/man/man5/ || \
        logerr "--- copying config man page failed"

    popd >/dev/null # $DESTDIR
}

post_install() {
    logmsg "--- Setting up Armor staging directory"
    
    pushd $DESTDIR >/dev/null
    
    # Create SSL directory (certificates will be generated during installation)
    logcmd mkdir -p etc/armor/ssl
    
    # Create database directory
    logcmd mkdir -p var/lib/armor/database

    popd >/dev/null
    
    logmsg "Armor staging setup completed"
}

# Main build process
logmsg "Starting Armor build process"
build_app
install_app
post_install

# Create the complete package
logmsg "Creating IPS package"
cd "$SRCDIR"
export VERSION="$VER"
sed "s/@VERSION@/${VERSION}/g" packaging/omnios/armor.p5m > armor.p5m.tmp
pkgsend generate proto | pkgfmt > armor.p5m.generated
pkgmogrify -DVERSION="${VERSION}" armor.p5m.tmp armor.p5m.generated > armor.p5m.final

# Create temporary local repository
TEMP_REPO="${SRCDIR}/temp-repo"
rm -rf "$TEMP_REPO"
pkgrepo create "$TEMP_REPO"
pkgrepo set -s "$TEMP_REPO" publisher/prefix=Makr91

# Publish package to temporary repository
pkgsend -s "file://${TEMP_REPO}" publish -d proto armor.p5m.final

# Create .p5p package archive
PACKAGE_FILE="armor-${VERSION}.p5p"
pkgrecv -s "file://${TEMP_REPO}" -a -d "${PACKAGE_FILE}" "${PKG}"

# Clean up temporary repository
rm -rf "$TEMP_REPO"

logmsg "Package build completed: ${PACKAGE_FILE}"
logmsg "Complete package ready for upload to GitHub artifacts"

# Vim hints
# vim:ts=4:sw=4:et:
