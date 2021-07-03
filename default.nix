let
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/014d28000c8ed021eb84000edfe260c22e90af8c.tar.gz";
    sha256 = "sha256:0hl5xxxjg2a6ymr44rf5dfvsb0c33dq4s6vibva6yb76yvl6gwfi";
  };
  holonix = import (holonixPath) {
    includeHolochainBinaries = true;
    holochainVersionId = "custom";

    holochainVersion = {
     rev = "c6e501eceae06f381c80ed50ea7bb971f8d1edcc";
     sha256 = "1w17jncv675n05z3vr32v5dghkjbqyjgsw5is4vjx029byi2svrq";
     cargoSha256 = "1zj62i0azsa51zjmhc90kyym23hvlhpvas9g45lnndq8cg0vvs8f";
     bins = {
       holochain = "holochain";
       hc = "hc";
     };
    };
    holochainOtherDepsNames = ["lair-keystore"];
  };
in holonix.main
