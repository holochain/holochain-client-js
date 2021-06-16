let
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/3e94163765975f35f7d8ec509b33c3da52661bd1.tar.gz";
    sha256 = "07sl281r29ygh54dxys1qpjvlvmnh7iv1ppf79fbki96dj9ip7d2";
  };
  holonix = import (holonixPath) {
    includeHolochainBinaries = true;
    holochainVersionId = "custom";

    holochainVersion = {
     rev = "759006f0242683a2e1524bb3b1f85d21a381ef24";
     sha256 = "sha256:0yvhxvims1bhp61psglhncpcnfcn9lak8zasivhy7f4amvh13gfg";
     cargoSha256 = "sha256:07gdvccvjbg5zina751r8d8ga87pb84ss2a5ib453ykwparr53i3";
     bins = {
       holochain = "holochain";
       hc = "hc";
     };
    };
    holochainOtherDepsNames = ["lair-keystore"];
  };
in holonix.main
