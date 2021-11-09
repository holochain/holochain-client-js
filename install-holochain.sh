#!/bin/bash

REV=72c491e2205a33f90f635ab8bc850205da472dc0
LAIR_REV=2d141376680d719c8fb41c514965686681f3f967


cargo install holochain_cli --force --bin hc \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force lair_keystore \
      --git https://github.com/holochain/lair.git \
      --rev $LAIR_REV
