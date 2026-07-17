import { ActionHash, AgentPubKey, Signature, Timestamp } from "../types.js";
import { Entry } from "./entry.js";
import { Action, SignedAction } from "./action.js";

// https://github.com/holochain/holochain/blob/develop/crates/types/src/dht_op.rs

/**
 * @public
 */
export enum ChainOpType {
  CreateRecord = "CreateRecord",
  CreateEntry = "CreateEntry",
  AgentActivity = "AgentActivity",
  UpdateEntry = "UpdateEntry",
  UpdateRecord = "UpdateRecord",
  DeleteEntry = "DeleteEntry",
  DeleteRecord = "DeleteRecord",
  CreateLink = "CreateLink",
  DeleteLink = "DeleteLink",
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
  data: Warrant;
  signature: Signature;
}

/**
 * @public
 */
export interface Warrant {
  /** The proof for the warrant which was issued */
  proof: WarrantProof;
  /** author of the warrant */
  author: AgentPubKey;
  /** Time when the warrant was issued */
  timestamp: Timestamp;
  /** The warranted agen */
  warrantee: AgentPubKey;
}

/**
 * @public
 */
export enum OpEntryType {
  Present = "Present",
  Hidden = "Hidden",
  ActionOnly = "ActionOnly",
}

/**
 * @public
 */
export type OpEntry =
  | { [OpEntryType.Present]: Entry }
  | { [OpEntryType.Hidden]: null }
  | { [OpEntryType.ActionOnly]: null };

/**
 * @public
 */
export type ChainOp =
  | { [ChainOpType.CreateRecord]: [SignedAction, OpEntry] }
  | { [ChainOpType.CreateEntry]: [Signature, OpEntry] }
  | { [ChainOpType.AgentActivity]: [SignedAction] }
  | {
      [ChainOpType.UpdateEntry]: [SignedAction, OpEntry];
    }
  | {
      [ChainOpType.UpdateRecord]: [SignedAction, OpEntry];
    }
  | { [ChainOpType.DeleteEntry]: [SignedAction] }
  | { [ChainOpType.DeleteRecord]: [SignedAction] }
  | { [ChainOpType.CreateLink]: [SignedAction] }
  | { [ChainOpType.DeleteLink]: [SignedAction] };

/**
 * @public
 */
export interface WarrantProof {
  /**
   * Signifies evidence of a breach of chain integrity
   */
  ChainIntegrity: ChainIntegrityWarrant;
}

/**
 * @public
 */
export type ChainIntegrityWarrant =
  | {
      /**
       * Something invalid was authored on a chain.
       * When we receive this warrant, we fetch the Action and validate it
       * under every applicable DhtOpType.
       */
      InvalidChainOp: {
        /** The author of the action */
        action_author: AgentPubKey;
        /** The hash of the action to fetch by */
        action: ActionHashAndSig;
        /** The chain op type that was the validation context for this validation failure */
        chain_op_type: ChainOpType;
        /** The reason for the warrant */
        reason: string;
      };
    }
  | {
      /** Proof of chain fork. */
      ChainFork: {
        /** Author of the chain which is forked */
        chain_author: AgentPubKey;
        /** Two actions of the same seq number which prove the fork */
        action_pair: [ActionHashAndSig, ActionHashAndSig];
        /** The seq number at which the fork occurs */
        seq: number;
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
export function getChainOpType(op: ChainOp): ChainOpType {
  return Object.keys(op)[0] as ChainOpType;
}

/**
 * @public
 */
export function getChainOpAction(op: ChainOp): Action {
  const opType = getChainOpType(op);
  const action = Object.values(op)[0][1];

  if (opType === ChainOpType.CreateLink) {
    return {
      type: "CreateLink",
      ...action,
    };
  }
  if (
    opType === ChainOpType.UpdateEntry ||
    opType === ChainOpType.UpdateRecord
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
export function getChainOpEntry(op: ChainOp): Entry | undefined {
  return Object.values(op)[0][2];
}

/**
 * @public
 */
export function getChainOpSignature(op: ChainOp): Signature {
  return Object.values(op)[0][1];
}
