#!/bin/bash

REV=b337f81080d35821344d7565778d8e70e2947a92

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force dna_util \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
