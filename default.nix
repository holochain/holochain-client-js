let
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/3e94163765975f35f7d8ec509b33c3da52661bd1.tar.gz";
    sha256 = "07sl281r29ygh54dxys1qpjvlvmnh7iv1ppf79fbki96dj9ip7d2";
  };
  holonix = import (holonixPath) {
    includeHolochainBinaries = true;
    holochainVersionId = "custom";

    holochainVersion = {
     rev = "e40dae0a1994ecbb1da695e2b603257f1bc96839";
     sha256 = "sha256:0lkbps933lgqx31n8fa4k5mi4dnc52svksj4klxp7g457ywbfh8g";
     cargoSha256 = "sha256:0c4jdb3myw9sdm24sxwk5mmgn5xl9ly11jiwkbpdds4pmnrz2mjd";
     bins = {
       holochain = "holochain";
       hc = "hc";
     };
    };
    holochainOtherDepsNames = ["lair-keystore"];
  };
in holonix.main
