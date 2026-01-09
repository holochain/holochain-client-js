{
  description = "Nix shell for Holochain app development";

  inputs = {
    holonix.url = "github:holochain/holonix?ref=main";
    holonix.inputs.holochain.url = "github:holochain/holochain?ref=holochain-0.7.0-dev.6";
    nixpkgs.follows = "holonix/nixpkgs";
  };

  outputs = inputs@{ holonix, ... }:
    holonix.inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      # provide a dev shell for all systems that the holonix flake supports
      systems = builtins.attrNames holonix.devShells;

      perSystem = { inputs', pkgs, ... }:
        {
          devShells.default = pkgs.mkShell {
            packages = [
              inputs'.holonix.packages.holochain
              inputs'.holonix.packages.hc
              inputs'.holonix.packages.bootstrap-srv
              inputs'.holonix.packages.lair-keystore
              inputs'.holonix.packages.rust
              # add further packages from nixpkgs
              pkgs.nodejs
            ];

            shellHook = ''
              export PS1='\[\033[1;34m\][holonix:\w]\$\[\033[0m\] '
            '';
          };
        };
    };
}
