#!/bin/bash

REV=ea026def01d1573d5e0edfb7f4e3e9453f88c43e

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force dna_util \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
