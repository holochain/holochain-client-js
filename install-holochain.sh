#!/bin/bash

REV=5f1d1271ce8a9548ffda50d1fdf3ed37801ae2a9

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force hc \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
