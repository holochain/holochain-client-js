import {
  AgentPubKey,
  DnaHash,
  EntryHash,
  ActionHash,
  HoloHashed,
  Signature,
  Timestamp,
} from "../types.js";
import { Entry, EntryType } from "./entry.js";
import { LinkTag, LinkType, RateWeight } from "./link.js";

/**
 * @public
 */
export interface SignedActionHashed<H extends Action = Action> {
  hashed: HoloHashed<H>;
  signature: Signature;
}

/**
 * @public
 */
export interface RegisterAgentActivity {
  action: SignedActionHashed;
  cached_entry?: Entry;
}

/**
 * @public
 */
export type ActionHashed = HoloHashed<Action>;

/**
 * @public
 */
export enum ActionType {
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

/**
 * @public
 */
export type Action =
  | Dna
  | AgentValidationPkg
  | InitZomesComplete
  | CreateLink
  | DeleteLink
  | OpenChain
  | CloseChain
  | Delete
  | NewEntryAction;

/**
 * @public
 */
export type NewEntryAction = Create | Update;

/**
 * @public
 */
export interface Dna {
  type: ActionType.Dna;

  author: AgentPubKey;
  timestamp: Timestamp;
  hash: DnaHash;
}

/**
 * @public
 */
export interface AgentValidationPkg {
  type: ActionType.AgentValidationPkg;

  author: AgentPubKey;
  timestamp: Timestamp;
  action_seq: number;
  prev_action: ActionHash;

  membrane_proof: any;
}

/**
 * @public
 */
export interface InitZomesComplete {
  type: ActionType.InitZomesComplete;

  author: AgentPubKey;
  timestamp: Timestamp;
  action_seq: number;
  prev_action: ActionHash;
}

/**
 * @public
 */
export interface CreateLink {
  type: ActionType.CreateLink;

  author: AgentPubKey;
  timestamp: Timestamp;
  action_seq: number;
  prev_action: ActionHash;

  base_address: EntryHash;
  target_address: EntryHash;
  zome_index: number;
  link_type: LinkType;
  tag: LinkTag;

  weight: RateWeight;
}

/**
 * @public
 */
export interface DeleteLink {
  type: ActionType.DeleteLink;

  author: AgentPubKey;
  timestamp: Timestamp;
  action_seq: number;
  prev_action: ActionHash;

  base_address: EntryHash;
  link_add_address: ActionHash;
}

/**
 * @public
 */
export interface OpenChain {
  type: ActionType.OpenChain;

  author: AgentPubKey;
  timestamp: Timestamp;
  action_seq: number;
  prev_action: ActionHash;

  prev_dna_hash: DnaHash;
}

/**
 * @public
 */
export interface CloseChain {
  type: ActionType.CloseChain;

  author: AgentPubKey;
  timestamp: Timestamp;
  action_seq: number;
  prev_action: ActionHash;

  new_dna_hash: DnaHash;
}

/**
 * @public
 */
export interface Update {
  type: ActionType.Update;

  author: AgentPubKey;
  timestamp: Timestamp;
  action_seq: number;
  prev_action: ActionHash;

  original_action_address: ActionHash;
  original_entry_address: EntryHash;

  entry_type: EntryType;
  entry_hash: EntryHash;
}

/**
 * @public
 */
export interface Delete {
  type: ActionType.Delete;

  author: AgentPubKey;
  timestamp: Timestamp;
  action_seq: number;
  prev_action: ActionHash;

  deletes_address: ActionHash;
  deletes_entry_address: EntryHash;
}

/**
 * @public
 */
export interface Create {
  type: ActionType.Create;

  author: AgentPubKey;
  timestamp: Timestamp;
  action_seq: number;
  prev_action: ActionHash;

  entry_type: EntryType;
  entry_hash: EntryHash;
}
