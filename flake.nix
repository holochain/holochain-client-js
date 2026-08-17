{
  description = "Nix shell for Holochain app development";

  inputs = {
    holonix.url = "github:holochain/holonix?ref=main";
    nixpkgs.follows = "holonix/nixpkgs";
  };

  outputs = inputs@{ holonix, ... }:
    holonix.inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      # provide a dev shell for all systems that the holonix flake supports
      systems = builtins.attrNames holonix.devShells;

      perSystem = { inputs', self', pkgs, ... }:
        {
          devShells.default = pkgs.mkShell {
            packages = [
              inputs'.holonix.packages.holochain
              # `hc`, with its `export-ts-bindings` subcommand enabled via
              # the opt-in `ts_rs`/`unstable-countersigning` Cargo features.
              (inputs'.holonix.packages.hc.override {
                cargoExtraArgs = "--features ts_rs,unstable-countersigning";
              })
              inputs'.holonix.packages.bootstrap-srv
              inputs'.holonix.packages.lair-keystore
              inputs'.holonix.packages.rust
              # add further packages from nixpkgs
              pkgs.nodejs_24
            ];

            shellHook = ''
              export PS1='\[\033[1;34m\][holonix:\w]\$\[\033[0m\] '
            '';
          };
        };
    };
}
