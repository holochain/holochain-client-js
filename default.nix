let
  holonixPath = builtins.fetchTarball "https://github.com/holochain/holonix/archive/main.tar.gz";
  holonix = import (holonixPath) {
    holochainVersionId = "v0_0_122";
  };
  nixpkgs = holonix.pkgs;
in nixpkgs.mkShell {
  inputsFrom = [ holonix.main ];
  packages = with nixpkgs; [
    nodejs-16_x
  ];
}
