# This is an example of what downstream consumers of holonix should do
# This is also used to dogfood as many commands as possible for holonix
# For example the release process for holonix uses this file
let

 # point this to your local config.nix file for this project
 # example.config.nix shows and documents a lot of the options
 config = import ./config.nix;

 # START HOLONIX IMPORT BOILERPLATE
 holonix = import (
  if ! config.holonix.use-github
  then config.holonix.local.path
  else fetchTarball {
   url = "https://github.com/${config.holonix.github.owner}/${config.holonix.github.repo}/tarball/${config.holonix.github.ref}";
   sha256 = config.holonix.github.sha256;
  }
 ) { config = config; use-stable-rust = true; };
 # END HOLONIX IMPORT BOILERPLATE

in
with holonix.pkgs;
{
 dev-shell = stdenv.mkDerivation (holonix.shell // {
  name = "dev-shell";

  shellHook = holonix.pkgs.lib.concatStrings [
   holonix.shell.shellHook
   # NIX_ENFORCE_PURITY to fix = note: impure path `/[...]' used in link
   # https://nixos.wiki/wiki/Development_environment_with_nix-shell
   ''
    export NIX_ENFORCE_PURITY=0
    cargo install --force holochain --git https://github.com/holochain/holochain.git --rev 45dd3f827caea18f41f77486ca2c37149a18b4ca
    cargo install --force dna_util --git https://github.com/holochain/holochain.git --rev 45dd3f827caea18f41f77486ca2c37149a18b4ca
    npm install
   ''
  ];

  buildInputs = [ ]
   ++ holonix.shell.buildInputs
   ++ config.buildInputs
   ++ ([(
    holonix.pkgs.writeShellScriptBin "conductor-api-test" ''
     cd test/e2e/fixture/zomes/foo
     cargo build --release --target wasm32-unknown-unknown --target-dir ./target
     cd ../../../../..
     dna-util -c test/e2e/fixture/test.dna.workdir
     npm run test
    ''
   )])
  ;
 });
}
