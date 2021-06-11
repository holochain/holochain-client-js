let
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/3e94163765975f35f7d8ec509b33c3da52661bd1.tar.gz";
    sha256 = "07sl281r29ygh54dxys1qpjvlvmnh7iv1ppf79fbki96dj9ip7d2";
  };
  holonix = import (holonixPath) {
    includeHolochainBinaries = true;
    holochainVersionId = "custom";

    holochainVersion = {
     rev = "52e76a2fad9e50af3150f60ec09ae8768025e71d";
     sha256 = "0j0npgvwn4qpvfbncg2iid0f9ygdh7nbzkdr23sp0k0k8ahzvy55";
     cargoSha256 = "0w29y8w5k5clq74k84ksj5aqxbxhqxh2djhll6vv694djw277rpj";
     bins = {
       holochain = "holochain";
       hc = "hc";
     };
    };
    holochainOtherDepsNames = ["lair-keystore"];
  };
in holonix.main
