import { MembraneProof } from "../api/index.js";
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
import { AnyLinkableHash, LinkTag, LinkType } from "./link.js";

/**
 * @public
 */
export interface SignedAction {
  data: Action;
  signature: Signature;
}

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
export interface Action {
  header: ActionHeader;

  data: ActionData;
}

/**
 * @public
 */
export interface ActionHeader {
  author: AgentPubKey;
  timestamp: Timestamp;
  action_seq: number;
  prev_action?: ActionHash;
}

/**
 * @public
 */
export type ActionData =
  | Dna
  | AgentValidationPkg
  | InitZomesComplete
  | CreateLink
  | DeleteLink
  | OpenChain
  | CloseChain
  | Delete;

/**
 * @public
 */
export interface Dna {
  type: ActionType.Dna;

  dna_hash: DnaHash;
}

/**
 * @public
 */
export interface AgentValidationPkg {
  type: ActionType.AgentValidationPkg;

  membrane_proof?: MembraneProof;
}

/**
 * @public
 */
export interface InitZomesComplete {
  type: ActionType.InitZomesComplete;
}

/**
 * @public
 */
export interface CreateLink {
  type: ActionType.CreateLink;

  base_address: AnyLinkableHash;
  target_address: AnyLinkableHash;
  zome_index: number;
  link_type: LinkType;
  tag: LinkTag;
}

/**
 * @public
 */
export interface DeleteLink {
  type: ActionType.DeleteLink;

  base_address: AnyLinkableHash;
  link_add_address: ActionHash;
}

/**
 * @public
 */
export interface OpenChain {
  type: ActionType.OpenChain;

  prev_target: MigrationTarget;
  close_hash: ActionHash;
}

/**
 * @public
 */
export type MigrationTarget = DnaMigrationTarget | AgentMigrationTarget;

/**
 * @public
 */
export type DnaMigrationTarget = DnaHash;

/**
 * @public
 */
export type AgentMigrationTarget = AgentPubKey;

/**
 * @public
 */
export interface CloseChain {
  type: ActionType.CloseChain;

  new_target?: MigrationTarget;
}

/**
 * @public
 */
export interface Update {
  type: ActionType.Update;

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

  deletes_address: ActionHash;
  deletes_entry_address: EntryHash;
}

/**
 * @public
 */
export interface Create {
  type: ActionType.Create;

  entry_type: EntryType;
  entry_hash: EntryHash;
}
