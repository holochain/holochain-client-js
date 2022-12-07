import { FnName, ZomeName } from "../api/index.js";
import { AgentPubKey } from "../types.js";

export type CapSecret = Uint8Array;

export interface CapClaim {
  tag: string;
  grantor: AgentPubKey;
  secret: CapSecret;
}

export interface ZomeCallCapGrant {
  tag: string;
  access: CapAccess;
  functions: Array<[ZomeName, FnName]>;
}

export type CapAccess =
  | "Unrestricted"
  | {
      Transferable: { secret: CapSecret };
    }
  | { Assigned: { secret: CapSecret; assignees: AgentPubKey[] } };

export type CapGrant =
  | {
      ChainAuthor: AgentPubKey;
    }
  | {
      RemoteAgent: ZomeCallCapGrant;
    };
