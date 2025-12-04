import { AgentPubKey, DhtOpHash, Timestamp } from "../types";

/**
 * @public
 */
export enum ValidationStatus {
  Valid = 0,
  Rejected = 1,
  Abandoned = 2,
}

/**
 * @public
 */
export interface ValidationReceipt {
  dht_op_hash: DhtOpHash;
  validation_status: ValidationStatus;
  validator: AgentPubKey;
  when_integrated: Timestamp;
}
