import { CapClaim, ZomeCallCapGrant } from "./capabilities.js";
import { AgentPubKey } from "../types.js";
import { CounterSigningSessionData } from "./countersigning.js";

export type EntryVisibility = "Public" | "Private";
export type AppEntryType = {
  id: number;
  zome_id: number;
  visibility: EntryVisibility;
};

export type EntryType =
  | "Agent"
  | { App: AppEntryType }
  | "CapClaim"
  | "CapGrant";

export interface EntryContent<E extends string, C> {
  entry_type: E;
  entry: C;
}

export type Entry =
  | EntryContent<"Agent", AgentPubKey>
  | EntryContent<"App", Uint8Array>
  | EntryContent<"CounterSign", [CounterSigningSessionData, Uint8Array]>
  | EntryContent<"CapGrant", ZomeCallCapGrant>
  | EntryContent<"CapClaim", CapClaim>;
