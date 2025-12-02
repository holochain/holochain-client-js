import { SignedActionHashed } from "./action.js";
import { Entry } from "./entry.js";
import { ValidationStatus } from "./validation-receipts.js";

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

/**
 * @public
 */
export interface RecordDetails {
  record: Record;
  validation_status: ValidationStatus;
  deletes: Array<SignedActionHashed>;
  updates: Array<SignedActionHashed>;
}
