#!/bin/bash

REV=c251d3017617b543bb1698024a37d7998483570a

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force hc \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
