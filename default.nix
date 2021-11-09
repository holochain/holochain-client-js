{
  holonixPath ?  builtins.fetchTarball { url = "https://github.com/holochain/holonix/archive/726694e2889a57a28b553541d2fabd8f1fbb52b2.tar.gz"; }
}:

let
  holonix = import (holonixPath) { };
  nixpkgs = holonix.pkgs;
in nixpkgs.mkShell {
  inputsFrom = [ holonix.main ];
  buildInputs = with nixpkgs; [
    binaryen
    nodejs-16_x
  ];
}
