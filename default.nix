{ pkgs ? import (fetchTarball {
  url = "https://github.com/Holo-Host/holo-nixpkgs/archive/3de358aa2d1473bd721f4e39228d18c4162096f4.tar.gz";
  sha256 = "1s15x9yvf6idajyhxhklb6wgmn322n4cy58w2929gw4df8xq4w9s";
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
