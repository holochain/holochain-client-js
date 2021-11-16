import { AgentPubKey } from "./common";

export type CapSecret = Buffer;

export interface CapClaim {
  tag: string;
  grantor: AgentPubKey;
  secret: CapSecret;
}

export interface ZomeCallCapGrant {
  tag: string;
  access: CapAccess;
  functions: Array<{ zome: string; fn_name: string }>;
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
