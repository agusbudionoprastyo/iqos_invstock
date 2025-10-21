#!/bin/bash

# Build the application
echo "Building application..."
npm run build

# Copy redirect files to dist
echo "Copying redirect files..."
cp public/.htaccess dist/.htaccess
cp public/_redirects dist/_redirects

echo "Deployment completed!"
