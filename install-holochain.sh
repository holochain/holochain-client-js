#!/bin/bash

REV=d2ce21aa51672328e162f9a5c8137ccba9efd5b8

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force dna_util \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
