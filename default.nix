let
  holonixPath = builtins.fetchTarball {
    url = "https://github.com/holochain/holonix/archive/014d28000c8ed021eb84000edfe260c22e90af8c.tar.gz";
    sha256 = "sha256:0hl5xxxjg2a6ymr44rf5dfvsb0c33dq4s6vibva6yb76yvl6gwfi";
  };
  holonix = import (holonixPath) {
    includeHolochainBinaries = true;
    holochainVersionId = "custom";

    holochainVersion = {
     rev = "1eb5b70f64b2188e6ef0c876367838b8a6a2015d";
     sha256 = "sha256:0i4fh1qhb04f701m4mgr1pw9mv22lxzfqgnp3j3x9pf3kmj2vxah";
     cargoSha256 = "sha256:1xikr23lglh7629g8bdq52r2c20s1r0xdy90w2vlgpsrkq5zn69i";
     bins = {
       holochain = "holochain";
       hc = "hc";
     };
    };
    holochainOtherDepsNames = ["lair-keystore"];
  };
in holonix.main
