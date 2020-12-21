#!/bin/bash

REV=3675b588de0aaf7eb9dc852b4012f3cfa5a27df7

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force dna_util \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
