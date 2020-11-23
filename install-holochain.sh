#!/bin/bash

REV=2dfe85db10a5d9ba3ee25ff33f4bedb1a28f875f

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force dna_util \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
