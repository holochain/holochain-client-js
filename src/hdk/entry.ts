import { CapClaim, ZomeCallCapGrant } from "./capabilities.js";
import { AgentPubKey } from "../types.js";
import { CounterSigningSessionData } from "./countersigning.js";

/**
 * @public
 */
export type EntryVisibility = { Public: null } | { Private: null };
/**
 * @public
 */
export type AppEntryDef = {
  entry_index: number;
  zome_index: number;
  visibility: EntryVisibility;
};

/**
 * @public
 */
export type EntryType =
  | "Agent"
  | { App: AppEntryDef }
  | "CapClaim"
  | "CapGrant";

/**
 * @public
 */
export interface EntryContent<E extends string, C> {
  entry_type: E;
  entry: C;
}

/**
 * @public
 */
export type Entry =
  | EntryContent<"Agent", AgentPubKey>
  | EntryContent<"App", Uint8Array>
  | EntryContent<"CounterSign", [CounterSigningSessionData, Uint8Array]>
  | EntryContent<"CapGrant", ZomeCallCapGrant>
  | EntryContent<"CapClaim", CapClaim>;
