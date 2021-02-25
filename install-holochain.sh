#!/bin/bash

REV=cb9b8bfd93c41891198fb0a18cc7d574f08c5a10

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force dna_util \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
