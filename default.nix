let
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/3e94163765975f35f7d8ec509b33c3da52661bd1.tar.gz";
    sha256 = "07sl281r29ygh54dxys1qpjvlvmnh7iv1ppf79fbki96dj9ip7d2";
  };
  holonix = import (holonixPath) {
    includeHolochainBinaries = true;
    holochainVersionId = "custom";

    holochainVersion = {
     rev = "278a9dc2d29b4f31188fdf8c5543529cee6760a5";
     sha256 = "sha256:08sxvsawwdjbz3xj6h8dvdab5lpkhbwhcxr4rz47i7kqxv5lmpx9";
     cargoSha256 = "sha256:07gdvccvjbg5zina751r8d8ga87pb84ss2a5ib453ykwparr53i3";
     bins = {
       holochain = "holochain";
       hc = "hc";
     };
    };
    holochainOtherDepsNames = ["lair-keystore"];
  };
in holonix.main
