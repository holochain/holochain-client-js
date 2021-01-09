#!/bin/bash

REV=3af5e8d6c1d7a167db808af9f2de7003a5d7bff0

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force dna_util \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
