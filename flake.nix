{
  description = "Nix shell for Holochain app development";

  inputs = {
    holonix.url = "github:holochain/holochain";
    holonix.inputs.holochain.url = "github:holochain/holochain/9c4f10d16b28c977682010746c4a61641ecb68c8";
    nixpkgs.follows = "holonix/nixpkgs";
  };

  outputs = inputs@{ holonix, ... }:
    holonix.inputs.flake-parts.lib.mkFlake { inherit inputs; } {
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
