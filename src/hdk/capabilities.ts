import { FunctionName, ZomeName } from "../api/admin/index.js";
import { AgentPubKey } from "../types.js";

/**
 * @public
 */
export type CapSecret = Uint8Array;

/**
 * @public
 */
export interface CapClaim {
  tag: string;
  grantor: AgentPubKey;
  secret: CapSecret;
}

/**
 * @public
 */
export enum GrantedFunctionsType {
  All = "All",
  Listed = "Listed",
}

/**
 * @public
 */
export type GrantedFunctions =
  | GrantedFunctionsType.All
  | { [GrantedFunctionsType.Listed]: [ZomeName, FunctionName][] };

/**
 * @public
 */
export interface ZomeCallCapGrant {
  tag: string;
  access: CapAccess;
  functions: GrantedFunctions;
}

/**
 * @public
 */
export enum CapAccessType {
  Unrestricted = "Unrestricted",
  Transferable = "Transferable",
  Assigned = "Assigned",
}

/**
 * @public
 */
export type CapAccess =
  | [CapAccessType.Unrestricted]
  | {
      [CapAccessType.Transferable]: { secret: CapSecret };
    }
  | {
      [CapAccessType.Assigned]: { secret: CapSecret; assignees: AgentPubKey[] };
    };

/**
 * @public
 */
export type CapGrant =
  | {
      ChainAuthor: AgentPubKey;
    }
  | {
      RemoteAgent: ZomeCallCapGrant;
    };
