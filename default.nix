{ pkgs ? import (fetchTarball {
  url = "https://github.com/Holo-Host/holo-nixpkgs/archive/4c54f6ded68963b738373396ba51621d2ddafc41.tar.gz";
  sha256 = "1qg7fjgy7rqh3wpczhfbs4l45ll13mbddizdac3pznlkd1v0lvvr";
}) {} }:
with pkgs;

mkShell {
  buildInputs = [
    holochain
    hc
    lair-keystore
    python
  ];
}
