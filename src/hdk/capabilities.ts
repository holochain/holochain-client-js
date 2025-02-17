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
  | {
      type: "all";
    }
  | {
      type: "listed";
      value: [ZomeName, FunctionName][];
    };

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
export type CapAccess =
  | {
      type: "unrestricted";
    }
  | {
      type: "transferable";
      value: { secret: CapSecret };
    }
  | {
      type: "assigned";
      value: { secret: CapSecret; assignees: AgentPubKey[] };
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
