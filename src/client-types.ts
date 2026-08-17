import type { Action, SignedAction } from "./generated/hdk/action.js";
import type { ChainOp, ChainOpType, OpEntry } from "./generated/hdk/dht-ops.js";
import type { Entry } from "./generated/hdk/entry.js";
import type { Signature } from "./generated/types.js";

/**
 * @public
 */
export enum HoloHashType {
  Agent = "agent",
  Entry = "entry",
  DhtOp = "dhtop",
  Warrant = "warrant",
  Dna = "dna",
  Action = "action",
  Wasm = "wasm",
  External = "external",
}

/**
 * @public
 */
export type HoloHashB64 = string;
/**
 * @public
 */
export type AgentPubKeyB64 = HoloHashB64;
/**
 * @public
 */
export type EntryHashB64 = HoloHashB64;
/**
 * @public
 */
export type ActionHashB64 = HoloHashB64;
/**
 * @public
 */
export type AnyDhtHashB64 = HoloHashB64;
/**
 * @public
 */
export type ExternalHashB64 = HoloHashB64;
/**
 * @public
 */
export type DhtOpHashB64 = HoloHashB64;
/**
 * @public
 */
export type WarrantHashB64 = HoloHashB64;

/**
 * @public
 */
export type InstalledAppId = string;

/**
 * @public
 */
export type DnaProperties = unknown;
/**
 * @public
 */
export type RoleName = string;

/**
 * @public
 */
export interface Duration {
  secs: number;
  nanos: number;
}

/**
 * Get the variant name of a {@link ChainOp}.
 *
 * @param op - The chain op to inspect.
 * @returns The op's variant name.
 *
 * @public
 */
export function getChainOpType(op: ChainOp): ChainOpType {
  return Object.keys(op)[0] as ChainOpType;
}

function getChainOpSignedAction(op: ChainOp): SignedAction {
  const value = Object.values(op)[0] as SignedAction | [SignedAction, OpEntry];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Get the action a {@link ChainOp} carries.
 *
 * @param op - The chain op to inspect.
 * @returns The op's action.
 *
 * @public
 */
export function getChainOpAction(op: ChainOp): Action {
  return getChainOpSignedAction(op).data;
}

/**
 * Get the entry a {@link ChainOp} carries, if it carries one.
 *
 * @param op - The chain op to inspect.
 * @returns The op's entry, or undefined when the op has none.
 *
 * @public
 */
export function getChainOpEntry(op: ChainOp): Entry | undefined {
  const value = Object.values(op)[0] as SignedAction | [SignedAction, OpEntry];
  if (!Array.isArray(value)) {
    return undefined;
  }
  const opEntry = value[1];
  if (typeof opEntry === "object" && opEntry !== null && "Present" in opEntry) {
    return opEntry.Present;
  }
  return undefined;
}

/**
 * Get the signature over the action a {@link ChainOp} carries.
 *
 * @param op - The chain op to inspect.
 * @returns The op's signature.
 *
 * @public
 */
export function getChainOpSignature(op: ChainOp): Signature {
  return getChainOpSignedAction(op).signature;
}
