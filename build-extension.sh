#!/bin/bash

echo "Creating clean extension ZIP..."

zip -r dottie-extension.zip . \
  -x "*.env*" \
  -x "*.DS_Store" \
  -x "*.log" \
  -x "*.sh" \
  -x "*.zip" \
  -x "node_modules/*" \
  -x "dist/*" \
  -x "README.md" \
  -x ".git/*"


echo "✅ dottie-extension.zip created successfully."
