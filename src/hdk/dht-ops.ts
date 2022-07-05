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

export function getDhtOpType(op: DhtOp): DhtOpType {
  return Object.keys(op)[0] as DhtOpType;
}

export function getDhtOpAction(op: DhtOp): Action {
  const action = Object.values(op)[0][1];

  if (action.author) return action;
  else {
    const actionType = Object.keys(action)[0];
    return {
      type: actionType,
      ...action[actionType],
    };
  }
}

export function getDhtOpEntry(op: DhtOp): Entry | undefined {
  return Object.values(op)[0][2];
}

export function getDhtOpSignature(op: DhtOp): Signature {
  return Object.values(op)[0][1];
}
