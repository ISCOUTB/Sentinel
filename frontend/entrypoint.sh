#!/bin/sh
set -e

# If node_modules is empty or missing, reinstall dependencies
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/vite" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Execute the command passed to the container
exec "$@"
