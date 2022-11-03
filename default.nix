let
  holonixPath = (import ./nix/sources.nix).holonix;
  holonix = import (holonixPath) {
    holochainVersionId = "v0_0_170";
    include = {
      holochainBinaries = true;
      node = false;
      happs = false;
      scaffolding = false;
      niv = false;
    };
  };
  nixpkgs = holonix.pkgs;
in
nixpkgs.mkShell {
  inputsFrom = [ holonix.main ];
  packages = with nixpkgs; [
    nodejs
  ];
}
