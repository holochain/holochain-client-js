#!/bin/bash

cd test/e2e/fixture/zomes/foo
cargo build --release --target wasm32-unknown-unknown --target-dir ./target
cd ../../../../..
dna-util -c test/e2e/fixture/test.dna.workdir
npm install
npm run test
