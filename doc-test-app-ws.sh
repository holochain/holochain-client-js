#!/bin/bash
set -xe

hc s clean
echo "" | hc s --piped create
echo "" | hc s --piped -f=65000 run &
HC_ID=$!
echo "HC_ID is $HC_ID"
sleep 5

set +e

npm run build
npx tsx doc-test-app-ws.ts

pkill -15 -P $HC_ID
