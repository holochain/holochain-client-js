{
  description = "Nix shell for Holochain app development";

  inputs = {
    nixpkgs.follows = "holonix/nixpkgs";
    versions.url = "github:holochain/holochain?dir=versions/0_3";
    holonix.url = "github:holochain/holochain";
    holonix.inputs.versions.follows = "versions";
  };

  outputs = inputs@{ holonix, ... }:
    holonix.inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      # provide a dev shell for all systems that the holonix flake supports
      systems = builtins.attrNames holonix.devShells;

      perSystem = { config, system, pkgs, ... }:
        {
          devShells.default = pkgs.mkShell {
            inputsFrom = [ holonix.devShells.${system}.holochainBinaries ];
            packages = with pkgs; [
              # add further packages from nixpkgs
              nodejs
            ];
          };
        };
    };
}
