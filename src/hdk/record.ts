import { SignedActionHashed } from "./action.js";
import { Entry } from "./entry.js";

export type Record = {
  signed_action: SignedActionHashed;
  entry: RecordEntry;
};

export type RecordEntry =
  | {
      Present: Entry;
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
