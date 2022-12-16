import {
  ActionHash,
  AgentPubKey,
  EntryHash,
  Signature,
  Timestamp,
} from "../types.js";
import { EntryType } from "./entry.js";

export interface CounterSigningSessionData {
  preflight_request: PreflightRequest;
  responses: Array<[CountersigningAgentState, Signature]>;
}

export interface PreflightRequest {
  /// The hash of the app entry, as if it were not countersigned.
  /// The final entry hash will include the countersigning session.
  app_entry_hash: EntryHash;
  /// The agents that are participating in this countersignature session.
  signing_agents: CounterSigningAgents;
  /// The agent that must receive and include all other actions in their own action.
  /// @todo implement enzymes
  enzyme_index: number | undefined;
  /// The session times.
  /// Session actions must all have the same timestamp, which is the session offset.
  session_times: CounterSigningSessionTimes;
  /// The action information that is shared by all agents.
  /// Contents depend on the action type, create, update, etc.
  action_base: ActionBase;
  /// The preflight bytes for session.
  preflight_bytes: PreflightBytes;
}

export interface CounterSigningSessionTimes {
  start: Timestamp;
  end: Timestamp;
}

export type ActionBase = { Create: CreateBase } | { Update: UpdateBase };

export interface CreateBase {
  entry_type: EntryType;
}

export interface UpdateBase {
  original_action_address: ActionHash;
  original_entry_address: EntryHash;
  entry_type: EntryType;
}

export type CounterSigningAgents = Array<[AgentPubKey, Array<Role>]>;

export type PreflightBytes = Uint8Array;
export type Role = number;

export interface CountersigningAgentState {
  agent_index: number;
  chain_top: ActionHash;
  action_seq: number;
}
