#!/bin/bash

# Test the plan generation API endpoint directly
# Usage: ./test-plan-endpoint.sh <guide-id>

GUIDE_ID="${1:-test-guide-id}"

echo "Testing /api/ai/plan endpoint..."
echo "Guide ID: $GUIDE_ID"
echo ""

# Get auth cookie from browser if needed
# For now, test without auth (will show auth error)

curl -v -X POST http://localhost:3000/api/ai/plan \
  -H "Content-Type: application/json" \
  -d "{\"guideId\": \"$GUIDE_ID\"}" \
  2>&1 | tee plan-test-response.log

echo ""
echo ""
echo "Response saved to plan-test-response.log"
echo ""
echo "If you see 401 Unauthorized, you need to:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Open DevTools (F12)"
echo "3. Go to Console tab"
echo "4. Run: document.cookie"
echo "5. Copy the session cookie and add -H 'Cookie: ...' to the curl command"
