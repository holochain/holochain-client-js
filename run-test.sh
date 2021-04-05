#!/bin/bash

cd test/e2e/fixture/zomes/foo
cargo build --release --target wasm32-unknown-unknown --target-dir ./target
cd ../.. #into fixtures
hc dna pack . -o test.dna
hc app pack . -o test.happ
cd ../../..
npm install
npm run test
