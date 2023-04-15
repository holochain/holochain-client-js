#!/bin/bash

# build fixture
cd test/e2e/fixture/zomes/foo
cargo build --release --target wasm32-unknown-unknown --target-dir ./target
cd ../../
hc dna pack . -o test.dna
hc app pack . -o test.happ
echo "Built fixture"

# build fixture 2
cd ../fixture2/coordinator2
cargo build --release --target wasm32-unknown-unknown --target-dir ./target
echo "Built fixture 2"
