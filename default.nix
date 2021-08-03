let
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/014d28000c8ed021eb84000edfe260c22e90af8c.tar.gz";
    sha256 = "sha256:0hl5xxxjg2a6ymr44rf5dfvsb0c33dq4s6vibva6yb76yvl6gwfi";
  };
  holonix = import (holonixPath) {
    includeHolochainBinaries = true;
    holochainVersionId = "custom";

    holochainVersion = {
     rev = "c5dbdf28825927106bc32d186dd54f20d35df468";
     sha256 = "sha256:0spkrpl8bcpckbwpvl3b17izqd7yh88gdrc7iianzl3phh7kkwz6";
     cargoSha256 = "sha256:086snrrywkrdzr1hngra4vib2c3ci7wa1782w7mb5ya5bpa2m28h";
     bins = {
       holochain = "holochain";
       hc = "hc";
     };
    };
    holochainOtherDepsNames = ["lair-keystore"];
  };
in holonix.main
