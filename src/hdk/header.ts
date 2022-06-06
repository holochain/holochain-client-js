import {
  AgentPubKey,
  DnaHash,
  EntryHash,
  HeaderHash,
  HoloHashed,
  Signature,
  Timestamp,
} from "../types.js";
import { EntryType } from "./entry.js";

export interface SignedHeaderHashed<H extends Header = Header> {
  header: HoloHashed<H>;
  signature: Signature;
}

export type HeaderHashed = HoloHashed<Header>;

export enum HeaderType {
  Dna = "Dna",
  AgentValidationPkg = "AgentValidationPkg",
  InitZomesComplete = "InitZomesComplete",
  CreateLink = "CreateLink",
  DeleteLink = "DeleteLink",
  OpenChain = "OpenChain",
  CloseChain = "CloseChain",
  Create = "Create",
  Update = "Update",
  Delete = "Delete",
}

export type Header =
  | Dna
  | AgentValidationPkg
  | InitZomesComplete
  | CreateLink
  | DeleteLink
  | OpenChain
  | CloseChain
  | Delete
  | NewEntryHeader;

export type NewEntryHeader = Create | Update;

export interface Dna {
  type: HeaderType.Dna;

  author: AgentPubKey;
  timestamp: Timestamp;
  hash: DnaHash;
}

export interface AgentValidationPkg {
  type: HeaderType.AgentValidationPkg;

  author: AgentPubKey;
  timestamp: Timestamp;
  header_seq: number;
  prev_header: HeaderHash;

  membrane_proof: any;
}

export interface InitZomesComplete {
  type: HeaderType.InitZomesComplete;

  author: AgentPubKey;
  timestamp: Timestamp;
  header_seq: number;
  prev_header: HeaderHash;
}

export interface CreateLink {
  type: HeaderType.CreateLink;

  author: AgentPubKey;
  timestamp: Timestamp;
  header_seq: number;
  prev_header: HeaderHash;

  base_address: EntryHash;
  target_address: EntryHash;
  zome_id: number;
  tag: any;
}

export interface DeleteLink {
  type: HeaderType.DeleteLink;

  author: AgentPubKey;
  timestamp: Timestamp;
  header_seq: number;
  prev_header: HeaderHash;

  base_address: EntryHash;
  link_add_address: HeaderHash;
}

export interface OpenChain {
  type: HeaderType.OpenChain;

  author: AgentPubKey;
  timestamp: Timestamp;
  header_seq: number;
  prev_header: HeaderHash;

  prev_dna_hash: DnaHash;
}

export interface CloseChain {
  type: HeaderType.CloseChain;

  author: AgentPubKey;
  timestamp: Timestamp;
  header_seq: number;
  prev_header: HeaderHash;

  new_dna_hash: DnaHash;
}

export interface Update {
  type: HeaderType.Update;

  author: AgentPubKey;
  timestamp: Timestamp;
  header_seq: number;
  prev_header: HeaderHash;

  original_header_address: HeaderHash;
  original_entry_address: EntryHash;

  entry_type: EntryType;
  entry_hash: EntryHash;
}

export interface Delete {
  type: HeaderType.Delete;

  author: AgentPubKey;
  timestamp: Timestamp;
  header_seq: number;
  prev_header: HeaderHash;

  deletes_address: HeaderHash;
  deletes_entry_address: EntryHash;
}

export interface Create {
  type: HeaderType.Create;

  author: AgentPubKey;
  timestamp: Timestamp;
  header_seq: number;
  prev_header: HeaderHash;

  entry_type: EntryType;
  entry_hash: EntryHash;
}
