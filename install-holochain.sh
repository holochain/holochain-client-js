#!/bin/bash

REV=041ad6c2fd88c06eace450074621be2bace0eb05

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force dna_util \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
