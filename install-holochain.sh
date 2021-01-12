#!/bin/bash

REV=d770a2e71df9d4cc87c91b926322be71a0785396

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force dna_util \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
