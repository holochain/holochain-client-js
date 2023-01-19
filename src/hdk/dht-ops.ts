import { Signature } from "../types.js";
import { Entry } from "./entry.js";
import {
  CreateLink,
  Delete,
  DeleteLink,
  Action,
  NewEntryAction,
  Update,
} from "./action.js";

// https://github.com/holochain/holochain/blob/develop/crates/types/src/dht_op.rs

/**
 * @public
 */
export enum DhtOpType {
  StoreRecord = "StoreRecord",
  StoreEntry = "StoreEntry",
  RegisterAgentActivity = "RegisterAgentActivity",
  RegisterUpdatedContent = "RegisterUpdatedContent",
  RegisterUpdatedRecord = "RegisterUpdatedRecord",
  RegisterDeletedBy = "RegisterDeletedBy",
  RegisterDeletedEntryAction = "RegisterDeletedEntryAction",
  RegisterAddLink = "RegisterAddLink",
  RegisterRemoveLink = "RegisterRemoveLink",
}

/**
 * @public
 */
export type DhtOp =
  | { [DhtOpType.StoreRecord]: [Signature, Action, Entry | undefined] }
  | { [DhtOpType.StoreEntry]: [Signature, NewEntryAction, Entry] }
  | { [DhtOpType.RegisterAgentActivity]: [Signature, Action] }
  | {
      [DhtOpType.RegisterUpdatedContent]: [
        Signature,
        Update,
        Entry | undefined
      ];
    }
  | {
      [DhtOpType.RegisterUpdatedRecord]: [Signature, Update, Entry | undefined];
    }
  | { [DhtOpType.RegisterDeletedBy]: [Signature, Delete] }
  | { [DhtOpType.RegisterDeletedEntryAction]: [Signature, Delete] }
  | { [DhtOpType.RegisterAddLink]: [Signature, CreateLink] }
  | { [DhtOpType.RegisterRemoveLink]: [Signature, DeleteLink] };

/**
 * @public
 */
export function getDhtOpType(op: DhtOp): DhtOpType {
  return Object.keys(op)[0] as DhtOpType;
}

/**
 * @public
 */
export function getDhtOpAction(op: DhtOp): Action {
  const opType = getDhtOpType(op);
  const action = Object.values(op)[0][1];

  if (opType === DhtOpType.RegisterAddLink) {
    return {
      type: "CreateLink",
      ...action,
    };
  }
  if (
    opType === DhtOpType.RegisterUpdatedContent ||
    opType === DhtOpType.RegisterUpdatedRecord
  ) {
    return {
      type: "Update",
      ...action,
    };
  }

  if (action.author) return action;
  else {
    const actionType = Object.keys(action)[0];
    return {
      type: actionType,
      ...action[actionType],
    };
  }
}

/**
 * @public
 */
export function getDhtOpEntry(op: DhtOp): Entry | undefined {
  return Object.values(op)[0][2];
}

/**
 * @public
 */
export function getDhtOpSignature(op: DhtOp): Signature {
  return Object.values(op)[0][1];
}
