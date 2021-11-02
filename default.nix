{
  holonixPath ?  builtins.fetchTarball { url = "https://github.com/holochain/holonix/archive/develop.tar.gz"; }
}:

let
  holonix = import (holonixPath) {
    include = {
        # making this explicit even though it's the default
        holochainBinaries = true;
    };

    holochainVersionId = "custom";

    holochainVersion = {
      rev = "14ee16ecf0bd20c215b0f238e853f6762b113c51";
      sha256 = "0rck0j1w8p8xap4s41ary2ikxz2rjnwg5ycr00yd59lbmwly53rq";
      cargoSha256 = "16gwnc13j5f7q644nqixivw08bz4fmaxjjmhiiz213ksgi8kwbbz";
      bins = {
        holochain = "holochain";
        hc = "hc";
        kitsune-p2p-proxy = "kitsune_p2p/proxy";
      };

      lairKeystoreHashes = {
        sha256 = "1zq8mpxcy8p7kbj4xl4qhp2hb0fjxakixhzcb4y1rnygc90q9v01";
        cargoSha256 = "1ln0vx1blzjr4p9rqfhcl4b34blk6jiyziz2w5gh09wv2xbhyaa5";
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
