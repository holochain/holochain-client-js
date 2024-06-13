import { ActionHash, AgentPubKey, Signature, Timestamp } from "../types.js";
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
  | {
      ChainOp: ChainOp;
    }
  | { WarrantOp: WarrantOp };

/**
 * @public
 */
export interface WarrantOp {
  /** The warrant which was issued */
  warrant: Warrant;
  /** author of the warrant */
  author: AgentPubKey;
  /** signature of (Warrant, Timestamp) by the author */
  signature: Signature;
  /** time when the warrant was issued */
  timestamp: Timestamp;
}

/**
 * @public
 */
export type ChainOp =
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
export interface Warrant {
  /**
   * Signifies evidence of a breach of chain integrity
   */
  ChainIntegrity: ChainIntegrityWarrant;
}

/**
 * @public
 */
export type ChainIntegrityWarrant = {
  /**
   * Something invalid was authored on a chain.
   * When we receive this warrant, we fetch the Action and validate it
   * under every applicable DhtOpType.
   */
  InvalidChainOp:
    | {
        /** The author of the action */
        action_author: AgentPubKey;
        /** The hash of the action to fetch by */
        action: ActionHashAndSig;
        /** Whether to run app or sys validation */
        validation_type: ValidationType;
      }
    | {
        /** Proof of chain fork. */
        ChainFork: {
          /** Author of the chain which is forked */
          chain_author: AgentPubKey;
          /** Two actions of the same seq number which prove the fork */
          action_pair: [ActionHashAndSig, ActionHashAndSig];
        };
      };
};

/**
 * @public
 */
export type ValidationType = {
  /** Sys validation */
  Sys: null;
  /** App validation */
  App: null;
};

/**
 * Action hash with the signature of the action at that hash
 * @public
 */
export type ActionHashAndSig = [ActionHash, Signature];

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
