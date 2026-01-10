#!/bin/bash
# Validate JavaScript syntax in public directory

echo "Validating JavaScript files..."

ERRORS=0

for file in /app/public/*.js; do
    if [ -f "$file" ]; then
        echo "Checking: $file"
        if ! node --check "$file" 2>&1; then
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "Found $ERRORS file(s) with syntax errors!"
    exit 1
else
    echo ""
    echo "All JavaScript files are valid!"
    exit 0
fi
