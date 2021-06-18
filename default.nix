let
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/3e94163765975f35f7d8ec509b33c3da52661bd1.tar.gz";
    sha256 = "07sl281r29ygh54dxys1qpjvlvmnh7iv1ppf79fbki96dj9ip7d2";
  };
  holonix = import (holonixPath) {
    includeHolochainBinaries = true;
    holochainVersionId = "custom";

    holochainVersion = {
     rev = "6b34b1797042b72aa7ae80364d3616a321924f75";
     sha256 = "sha256:0ky2aq367ava09w19371fa77mp23kr99vp26g5gncm6nwjbazx89";
     cargoSha256 = "sha256:07gdvccvjbg5zina751r8d8ga87pb84ss2a5ib453ykwparr53i3";
     bins = {
       holochain = "holochain";
       hc = "hc";
     };
    };
    holochainOtherDepsNames = ["lair-keystore"];
  };
in holonix.main
