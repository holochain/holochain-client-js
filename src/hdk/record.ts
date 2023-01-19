import { SignedActionHashed } from "./action.js";
import { Entry } from "./entry.js";

/**
 * @public
 */
export type Record = {
  signed_action: SignedActionHashed;
  entry: RecordEntry;
};

/**
 * @public
 */
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
