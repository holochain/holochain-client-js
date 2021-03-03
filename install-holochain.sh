#!/bin/bash

REV=11c2d2391a71cc6d589e48d081f87d6f477ab83d

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install holochain_cli --force --bin hc \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
