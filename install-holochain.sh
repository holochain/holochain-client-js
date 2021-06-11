#!/bin/bash

REV=52e76a2fad9e50af3150f60ec09ae8768025e71d
LAIR_REV=a01a40640574d3cfabae33dfe3f861de7bd7a57c

cargo install --force holochain \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install holochain_cli --force --bin hc \
  --git https://github.com/holochain/holochain.git \
  --rev $REV
cargo install --force lair_keystore \
      --git https://github.com/holochain/lair.git \
      --rev $LAIR_REV
