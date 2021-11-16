import {
  Create,
  CreateLink,
  Delete,
  DeleteLink,
  Header,
  HeaderType,
  NewEntryHeader,
  SignedHeaderHashed,
  Update,
} from "./header";
import { Entry } from "./entry";

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

export interface DhtOpContent<T, H extends Header> {
  type: T;
  header: SignedHeaderHashed<H>;
}

export type DhtOp =
  | (DhtOpContent<DhtOpType.StoreElement, Header> & {
      maybe_entry: Entry | undefined;
    })
  | (DhtOpContent<DhtOpType.StoreEntry, NewEntryHeader> & { entry: Entry })
  | DhtOpContent<DhtOpType.RegisterAgentActivity, Header>
  | DhtOpContent<DhtOpType.RegisterUpdatedContent, Update>
  | DhtOpContent<DhtOpType.RegisterUpdatedElement, Update>
  | DhtOpContent<DhtOpType.RegisterDeletedBy, Delete>
  | DhtOpContent<DhtOpType.RegisterDeletedEntryHeader, Delete>
  | DhtOpContent<DhtOpType.RegisterAddLink, CreateLink>
  | DhtOpContent<DhtOpType.RegisterRemoveLink, DeleteLink>;
