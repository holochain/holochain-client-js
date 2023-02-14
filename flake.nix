{
  description = "Nix shell for Holochain app development";

  inputs = {
    holonix.url = "github:holochain/holochain";
    nixpkgs.follows = "holonix/nixpkgs";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs@{ flake-parts, holonix, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      # provide a dev shell for all systems that the holonix flake supports
      systems = builtins.attrNames holonix.devShells;

      perSystem = { config, system, pkgs, ... }:
        {
          devShells.default = pkgs.mkShell {
            inputsFrom = [ holonix.devShells.${system}.holonix ];
            packages = with pkgs; [
              # add further packages from nixpkgs
              nodejs
            ];
          };
        };
    };
}
