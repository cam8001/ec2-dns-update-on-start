#!/bin/bash

# Build and analyze Lambda bundle size
# Usage: ./analyze-bundle.sh

LAMBDA_DIR="src/lambda/updateDnsRecord"
OUTPUT_DIR="dist"

echo "Building Lambda bundle..."
mkdir -p "$OUTPUT_DIR"

esbuild "$LAMBDA_DIR/index.ts" \
  --bundle \
  --platform=node \
  --target=node22 \
  --external:@aws-sdk/client-ec2 \
  --external:@aws-sdk/client-dynamodb \
  --external:@aws-sdk/lib-dynamodb \
  --external:@aws-sdk/client-route-53 \
  --outfile="$OUTPUT_DIR/index.js" \
  --metafile="$OUTPUT_DIR/meta.json" \
  --minify

echo ""
echo "Bundle created at: $OUTPUT_DIR/index.js"
echo "Bundle size: $(du -h $OUTPUT_DIR/index.js | cut -f1)"
echo ""
echo "Analyzing bundle contents..."
echo ""

# Show what's in the bundle
esbuild --analyze "$OUTPUT_DIR/meta.json"

echo ""
echo "To see detailed analysis, run:"
echo "  npx esbuild-visualizer --metadata $OUTPUT_DIR/meta.json"
