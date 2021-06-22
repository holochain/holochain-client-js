let
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/3e94163765975f35f7d8ec509b33c3da52661bd1.tar.gz";
    sha256 = "07sl281r29ygh54dxys1qpjvlvmnh7iv1ppf79fbki96dj9ip7d2";
  };
  holonix = import (holonixPath) {
    includeHolochainBinaries = true;
    holochainVersionId = "custom";

    holochainVersion = {
     rev = "fbbe611fd19e50637ee5725a5c2e7f0616a6073c";
     sha256 = "sha256:1amm19cy88ywjfm1z9s8i5g6z9rn0cbx4mpw621k3y7lalffzsml";
     cargoSha256 = "sha256:0c4jdb3myw9sdm24sxwk5mmgn5xl9ly11jiwkbpdds4pmnrz2mjd";
     bins = {
       holochain = "holochain";
       hc = "hc";
     };
    };
    holochainOtherDepsNames = ["lair-keystore"];
  };
in holonix.main
