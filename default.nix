let
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/9a1f11bacf0a4a8d5cfb83b449df5f726c569c7c.tar.gz";
    sha256 = "0j4v354rlipifw2ibydr02nv6bwm33vv63197srswkvv6wi6dr9c";
  };
  holonix = import (holonixPath) {
    includeHolochainBinaries = true;
    holochainVersionId = "custom";

    holochainVersion = {
     rev = "24477159cd80f3a44fd82bba60baa360e76b9f0d";
     sha256 = "sha256:1qiypsr37v5m1sqbz2mnlwfrnksds88ag8m78fjwszsh6nx1yhgz";
     cargoSha256 = "0q9nl0wqvyd5jbxq92f1h4l7i439kl5j1bkzxlz929q4m43r3apn";
     bins = {
       holochain = "holochain";
       hc = "hc";
     };
    };
    holochainOtherDepsNames = ["lair-keystore"];
  };
in holonix.main
