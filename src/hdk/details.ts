import { EntryDetails } from "./entry.js";
import { RecordDetails } from "./record.js";

/**
 * @public
 */
export enum DetailsType {
  Entry = "entry",
  Record = "record",
}

/**
 * @public
 */
export type Details =
  | {
      type: DetailsType.Record;
      content: RecordDetails;
    }
  | {
      type: DetailsType.Entry;
      content: EntryDetails;
    };
