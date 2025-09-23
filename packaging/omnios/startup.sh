#!/bin/bash
#
# Armor startup script for SMF
#

set -e

# Environment is set by SMF, but ensure we have the basics
export PATH="/opt/ooce/bin:/opt/ooce/node-22/bin:/usr/gnu/bin:/usr/bin:/usr/sbin:/sbin"
export NODE_ENV="${NODE_ENV:-production}"
export CONFIG_PATH="${CONFIG_PATH:-/etc/armor/config.yaml}"
export HOME="${HOME:-/var/lib/armor}"

cd /opt/armor

PIDFILE="/var/lib/armor/armor.pid"

# Create runtime directories following IPS best practices
# These are unpackaged content - preserved across package operations
mkdir -p /var/lib/armor/database
mkdir -p /etc/armor/ssl
mkdir -p /var/log/armor

# Set proper ownership for runtime directories
chown -R armor:armor /var/lib/armor
chown -R armor:armor /etc/armor/ssl
chown -R armor:armor /var/log/armor

# Set proper permissions for SSL directory (more restrictive)
chmod 700 /etc/armor/ssl

# Check if JWT secret exists (SSL certificates will be handled by Node.js if needed)
if [ ! -f "/etc/armor/.jwt-secret" ]; then
    echo "Warning: JWT secret not found. Node.js may generate default secrets." >&2
fi

# Check if Node.js is available
if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js not found in PATH" >&2
    exit 1
fi

# Check if main application file exists
if [ ! -f "/opt/armor/index.js" ]; then
    echo "Error: Armor application not found at /opt/armor/index.js" >&2
    exit 1
fi

# Check if configuration file exists
if [ ! -f "$CONFIG_PATH" ]; then
    echo "Error: Configuration file not found at $CONFIG_PATH" >&2
    exit 1
fi

# Remove stale PID file if it exists
if [ -f "$PIDFILE" ]; then
    if ! kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
        echo "Removing stale PID file $PIDFILE"
        rm -f "$PIDFILE"
    else
        echo "Error: Armor appears to be already running (PID $(cat "$PIDFILE"))" >&2
        exit 1
    fi
fi

echo "Starting Armor."
echo "Node.js version: $(node --version)"
echo "Configuration: $CONFIG_PATH"
echo "Environment: $NODE_ENV"

# Start the Node.js application in the background
# Output goes to log file so we can see SSL generation messages
nohup node index.js </dev/null >>/var/log/armor/armor.log 2>&1 &
NODE_PID=$!

# Save the PID
echo $NODE_PID > "$PIDFILE"

# Give it a moment to start and check if it's still running
sleep 2
if ! kill -0 $NODE_PID 2>/dev/null; then
    echo "Error: Armor failed to start" >&2
    rm -f "$PIDFILE"
    exit 1
fi

echo "Armor started successfully with PID $NODE_PID"
echo "Log output will be available via SMF logging"
echo "Access the web interface at https://localhost:3443"

exit 0
