import {
  Create,
  CreateLink,
  Delete,
  DeleteLink,
  Header,
  HeaderType,
  NewEntryHeader,
  SignedHeaderHashed,
  Update
} from "./header"
import { Entry } from "./entry"
import { Signature } from "./common"

// https://github.com/holochain/holochain/blob/develop/crates/types/src/dht_op.rs

export enum DhtOpType {
  StoreElement = "StoreElement",
  StoreEntry = "StoreEntry",
  RegisterAgentActivity = "RegisterAgentActivity",
  RegisterUpdatedContent = "RegisterUpdatedContent",
  RegisterUpdatedElement = "RegisterUpdatedElement",
  RegisterDeletedBy = "RegisterDeletedBy",
  RegisterDeletedEntryHeader = "RegisterDeletedEntryHeader",
  RegisterAddLink = "RegisterAddLink",
  RegisterRemoveLink = "RegisterRemoveLink",
}

export type DhtOp =
  | { [DhtOpType.StoreElement]: [Signature, Header, Entry | undefined] }
  | { [DhtOpType.StoreEntry]: [Signature, NewEntryHeader, Entry] }
  | { [DhtOpType.RegisterAgentActivity]: [Signature, Header] }
  | {
    [DhtOpType.RegisterUpdatedContent]: [
      Signature,
      Update,
      Entry | undefined
    ];
  }
  | {
    [DhtOpType.RegisterUpdatedElement]: [
      Signature,
      Update,
      Entry | undefined
    ];
  }
  | { [DhtOpType.RegisterDeletedBy]: [Signature, Delete] }
  | { [DhtOpType.RegisterDeletedEntryHeader]: [Signature, Delete] }
  | { [DhtOpType.RegisterAddLink]: [Signature, CreateLink] }
  | { [DhtOpType.RegisterRemoveLink]: [Signature, DeleteLink] };

export function getDhtOpType(op: DhtOp): DhtOpType {
  return Object.keys(op)[0] as DhtOpType
}

export function getDhtOpHeader(op: DhtOp): Header {
  const header = Object.values(op)[0][1]

  if (header.author) return header
  else {
    const headerType = Object.keys(header)[0]
    return {
      type: headerType,
      ...header[headerType],
    }
  }
}

export function getDhtOpEntry(op: DhtOp): Entry | undefined {
  return Object.values(op)[0][2]
}

export function getDhtOpSignature(op: DhtOp): Signature {
  return Object.values(op)[0][1]
}