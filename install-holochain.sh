#!/bin/bash

REV=5bb86c1e7e069bfe883b557a18a53ff7bb51b79c

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force dna_util \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
