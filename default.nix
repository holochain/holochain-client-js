{
  holonixPath ?  builtins.fetchTarball { url = "https://github.com/holochain/holonix/archive/62659a81d9f2d25740c2b2f424b90f50a60eb80c.tar.gz"; }
}:

let
  holonix = import (holonixPath) {
    include = {
      # making this explicit even though it's the default
      holochainBinaries = true;
    };

    holochainVersionId = "custom";

    holochainVersion = {
      rev = "4bd6738d7cb2d89aa606901045669b573e8b5b99";
      sha256 = "sha256:145f7ciibab3mzzgn9jrcj4r1fwdhbq4l9q93ghnn5yng2bbz6s4";
      cargoSha256 = "sha256:1i8sgf1pamjzlx9p62dm81b795z8gvgcd51w42ivxwfp8jq95qrx";
      bins = {
        holochain = "holochain";
        hc = "hc";
      };

      lairKeystoreHashes = {
        sha256 = "0khg5w5fgdp1sg22vqyzsb2ri7znbxiwl7vr2zx6bwn744wy2cyv";
        cargoSha256 = "1lm8vrxh7fw7gcir9lq85frfd0rdcca9p7883nikjfbn21ac4sn4";
      };
    };
  };
  nixpkgs = holonix.pkgs;
in nixpkgs.mkShell {
  inputsFrom = [ holonix.main ];
  buildInputs = with nixpkgs; [
    binaryen
    nodejs-16_x
  ];
}
