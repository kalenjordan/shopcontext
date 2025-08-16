#!/bin/bash

# Release script for ShopContext
# Usage: ./release.sh <new_version>
# Example: ./release.sh 1.0.3

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_error() {
    echo -e "${RED}❌ Error: $1${NC}" >&2
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if version argument is provided
if [ $# -eq 0 ]; then
    print_error "No version number provided"
    echo "Usage: $0 <new_version>"
    echo "Example: $0 1.0.3"
    exit 1
fi

NEW_VERSION=$1

# Validate version format (basic semantic versioning)
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "Invalid version format. Please use semantic versioning (e.g., 1.0.3)"
    exit 1
fi

# Check if claude CLI is available
if ! command -v claude &> /dev/null; then
    print_error "Claude CLI is not installed or not in PATH"
    echo "Please install Claude CLI first: https://docs.anthropic.com/en/docs/claude-code"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes"
    echo "Please commit or stash your changes before creating a release"
    echo ""
    echo "Uncommitted files:"
    git status --porcelain
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborting release"
        exit 1
    fi
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]] && [[ "$CURRENT_BRANCH" != "master" ]]; then
    print_warning "You are not on main/master branch (current: $CURRENT_BRANCH)"
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborting release"
        exit 1
    fi
fi

# Get current version from manifest.json
if [ ! -f "manifest.json" ]; then
    print_error "manifest.json not found"
    exit 1
fi

OLD_VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')

if [ -z "$OLD_VERSION" ]; then
    print_error "Could not extract version from manifest.json"
    exit 1
fi

print_info "Current version: $OLD_VERSION"
print_info "New version: $NEW_VERSION"

# Compare versions (basic check)
if [ "$OLD_VERSION" == "$NEW_VERSION" ]; then
    print_error "New version is the same as current version"
    exit 1
fi

# Create tag for old version if it doesn't exist
if ! git tag | grep -q "^v$OLD_VERSION$"; then
    print_info "Creating tag for current version v$OLD_VERSION"
    git tag -a "v$OLD_VERSION" -m "Release v$OLD_VERSION" HEAD
    print_success "Tagged current state as v$OLD_VERSION"
else
    print_info "Tag v$OLD_VERSION already exists"
fi

# Update manifest.json with new version
print_info "Updating manifest.json with version $NEW_VERSION"
sed -i.bak "s/\"version\": *\"$OLD_VERSION\"/\"version\": \"$NEW_VERSION\"/" manifest.json
rm manifest.json.bak

# Get today's date in YYYY-MM-DD format
TODAY=$(date +%Y-%m-%d)

# Generate changelog using Claude CLI
print_info "Generating changelog with Claude CLI..."
echo ""

# Create a temporary file for the Claude response
TEMP_CHANGELOG=$(mktemp)

# Call Claude to update the changelog
claude --no-chat --max-tokens 8192 << EOF > "$TEMP_CHANGELOG" 2>&1
You are updating the CHANGELOG.md file for the ShopContext browser extension.

Current version being released: $NEW_VERSION
Previous version: $OLD_VERSION
Today's date: $TODAY

Please analyze the git commits since version v$OLD_VERSION and update the CHANGELOG.md file.

Here are the commits since the last version:
\`\`\`
$(git log v$OLD_VERSION..HEAD --oneline --no-decorate)
\`\`\`

Here is the current CHANGELOG.md content:
\`\`\`
$(cat CHANGELOG.md)
\`\`\`

Please output ONLY the complete updated CHANGELOG.md content with the new version section added. 
The new section should:
1. Be added right after the "# Changelog" header and description line
2. Follow the format: ## [$NEW_VERSION] - $TODAY
3. Group changes into categories like: Added, Changed, Fixed, Removed (only include categories that have changes)
4. Be based on the actual commits, not generic descriptions
5. Keep all existing version entries intact

Output the complete file content, nothing else.
EOF

# Check if Claude command succeeded
if [ $? -ne 0 ]; then
    print_error "Failed to generate changelog with Claude CLI"
    echo "Error output:"
    cat "$TEMP_CHANGELOG"
    # Restore original manifest.json
    git checkout -- manifest.json
    rm "$TEMP_CHANGELOG"
    exit 1
fi

# Save the original changelog for comparison
cp CHANGELOG.md CHANGELOG.md.backup

# Update the changelog file
cp "$TEMP_CHANGELOG" CHANGELOG.md

# Show the changes
echo ""
print_info "Generated changelog entry:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
# Show just the new section (approximate by showing the diff)
if command -v diff &> /dev/null; then
    diff --unified=0 CHANGELOG.md.backup CHANGELOG.md | grep "^+" | grep -v "^+++" | sed 's/^+//' || true
else
    # Fallback: show first 30 lines which should include the new section
    head -n 30 CHANGELOG.md
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Clean up temporary file
rm "$TEMP_CHANGELOG"

# Ask for confirmation
print_warning "Please review the changelog above"
echo ""
read -p "Do you want to proceed with the release? (Press Enter to continue, Ctrl+C to abort): "

# If we get here, user wants to proceed
print_info "Proceeding with release..."

# Stage the changes
git add manifest.json CHANGELOG.md

# Commit the changes
print_info "Creating commit..."
git commit -m "Release v$NEW_VERSION

- Updated version in manifest.json
- Updated CHANGELOG.md with recent changes"

# Create the new version tag
print_info "Creating tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION

See CHANGELOG.md for details"

# Success message
echo ""
print_success "Release v$NEW_VERSION created successfully!"
echo ""
print_info "Next steps:"
echo "  1. Push the changes: git push origin $CURRENT_BRANCH"
echo "  2. Push the tags: git push origin v$NEW_VERSION"
echo "  3. Create a GitHub release (optional)"
echo ""
echo "Or push everything at once with:"
echo "  git push origin $CURRENT_BRANCH --tags"

# Clean up backup
rm -f CHANGELOG.md.backup