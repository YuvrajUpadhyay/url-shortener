#!/usr/bin/env bash
# run_load_tests.sh
# Runs all k6 load test scenarios in sequence and collects results.
#
# Prerequisites:
#   - k6 installed: https://k6.io/docs/getting-started/installation/
#   - Server running at BASE_URL
#   - Results directory created
#
# Usage:
#   chmod +x load-tests/run_load_tests.sh
#   BASE_URL=http://localhost:5000 ./load-tests/run_load_tests.sh

set -e

BASE_URL="${BASE_URL:-http://localhost:5000}"
RESULTS_DIR="./load-tests/results"

mkdir -p "$RESULTS_DIR"

echo ""
echo "=================================================="
echo "  URL Shortener Load Test Suite"
echo "  Target: $BASE_URL"
echo "  Results: $RESULTS_DIR"
echo "=================================================="
echo ""

# Check k6 is available
if ! command -v k6 &>/dev/null; then
  echo "ERROR: k6 is not installed."
  echo "Install: https://k6.io/docs/getting-started/installation/"
  exit 1
fi

# Check server is reachable
if ! curl -sf "$BASE_URL/health" > /dev/null; then
  echo "ERROR: Server not reachable at $BASE_URL"
  echo "Make sure the server is running: cd server && npm start"
  exit 1
fi

echo "[1/4] Running: URL Shortening Test..."
k6 run \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/shorten_raw.json" \
  load-tests/shorten_test.js
echo ""

echo "[2/4] Running: URL Redirect Test (with Redis cache)..."
k6 run \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/redirect_raw.json" \
  load-tests/redirect_test.js
echo ""

echo "[3/4] Running: Full Flow Test (mixed traffic)..."
k6 run \
  --env BASE_URL="$BASE_URL" \
  --out json="$RESULTS_DIR/full_raw.json" \
  load-tests/full_test.js
echo ""

echo "[4/4] Running: Cache Comparison (cached mode)..."
k6 run \
  --env BASE_URL="$BASE_URL" \
  --env MODE=cached \
  --out json="$RESULTS_DIR/cache_cached_raw.json" \
  load-tests/cache_comparison_test.js
echo ""

echo "=================================================="
echo "  All tests complete. Results saved to $RESULTS_DIR"
echo "  For Redis baseline comparison, see README.md"
echo "=================================================="
