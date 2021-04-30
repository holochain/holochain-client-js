{ pkgs ? import (fetchTarball {
  url = "https://github.com/Holo-Host/holo-nixpkgs/archive/4c54f6ded68963b738373396ba51621d2ddafc41.tar.gz";
  sha256 = "1qg7fjgy7rqh3wpczhfbs4l45ll13mbddizdac3pznlkd1v0lvvr";
}) {} }:
with pkgs;

let
    #
    # Make holo-nixpkg's rustPlatform and cargo available here.  This allows us
    # to make cargo/rustc available to build DNAs in a functionally defined way.
    # Once we have reliable builds running on Hydra, this will make eg. Github
    # Actions be able to provision build/test environments quickly...
    #
    inherit (rust.packages.stable.rustPlatform) rust;
    inherit (darwin.apple_sdk.frameworks) CoreServices Security;
in

{
  #
  # An example Node application build procedure; nix-shell's shell.nix will
  # inherit these buildInputs?  Once we recover dnaPackages and buildDna, we
  # should be able to build DNAs again in a functionally defined way.
  #
  servicelogger = stdenv.mkDerivation rec {
    name = "servicelogger";
    src = gitignoreSource ./.;

    buildInputs = [
      holochain
      lair-keystore
      cargo
    ];

    nativeBuildInputs = [
      nodejs
    ];
  };
}
