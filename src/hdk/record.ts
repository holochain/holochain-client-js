import { SignedActionHashed } from "./action.js";

export type Record = {
  signed_action: SignedActionHashed;
  entry: RecordEntry;
};

export type RecordEntry =
  | {
      Present: {
        entry: Uint8Array;
      };
    }
  | {
      Hidden: void;
    }
  | {
      NotApplicable: void;
    }
  | {
      NotStored: void;
    };
