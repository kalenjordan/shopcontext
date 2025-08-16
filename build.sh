#!/bin/bash

# Build script for ShopContext Chrome extension

# Extension name and version
EXTENSION_NAME="shopcontext"
VERSION="1.0.1"

# Output zip file on desktop
OUTPUT_FILE="$HOME/Desktop/${EXTENSION_NAME}-v${VERSION}.zip"

# Files and directories to include in the extension
INCLUDE_FILES=(
    "manifest.json"
    "popup.html"
    "popup.js"
    "popup.css"
    "content.js"
    "background.js"
    "styles.css"
    "icon16.png"
    "icon48.png"
    "icon128.png"
)

# Create the zip file
echo "Building ${EXTENSION_NAME} v${VERSION}..."

# Remove old zip if it exists
if [ -f "$OUTPUT_FILE" ]; then
    rm "$OUTPUT_FILE"
    echo "Removed existing zip file"
fi

# Create the zip with the specified files
zip -r "$OUTPUT_FILE" "${INCLUDE_FILES[@]}"

if [ $? -eq 0 ]; then
    echo "✅ Successfully created: $OUTPUT_FILE"
    echo "Ready to upload to Chrome Web Store!"
else
    echo "❌ Error creating zip file"
    exit 1
fi