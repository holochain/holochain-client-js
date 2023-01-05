import { FunctionName, ZomeName } from "../api/index.js";
import { AgentPubKey } from "../types.js";

export type CapSecret = Uint8Array;

export interface CapClaim {
  tag: string;
  grantor: AgentPubKey;
  secret: CapSecret;
}

export enum GrantedFunctionsType {
  All = "All",
  Listed = "Listed",
}

export type GrantedFunctions =
  | { [GrantedFunctionsType.All]: null }
  | { [GrantedFunctionsType.Listed]: [ZomeName, FunctionName][] };

export interface ZomeCallCapGrant {
  tag: string;
  access: CapAccess;
  functions: GrantedFunctions;
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
