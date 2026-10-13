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
 * The inner properties of a zome call {@link Capability}.
 *
 * @public
 */
export interface ZomeCallGrant {
  functions: GrantedFunctions;
}

/**
 * The capability a {@link CapGrant} grants.
 *
 * @public
 */
export type Capability =
  | {
      type: "zome_call";
      value: ZomeCallGrant;
    }
  | {
      type: "direct_signal";
    };

/**
 * A capability grant, committed to the grantor's source chain as a private
 * entry.
 *
 * @public
 */
export interface CapGrant {
  tag: string;
  constraint: GrantConstraint;
  capability: Capability;
}

/**
 * Who may claim a {@link CapGrant}, and by what means.
 *
 * @public
 */
export type GrantConstraint =
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
 * {@link GrantConstraint} info with secrets removed.
 *
 * @public
 */
export interface GrantConstraintInfo {
  access_type: string;
  assignees: AgentPubKey[] | null;
}

/**
 * A {@link CapGrant} with secrets removed.
 *
 * @public
 */
export interface DesensitizedCapGrant {
  tag: string;
  constraint: GrantConstraintInfo;
  capability: Capability;
}

/**
 * @public
 */
export type CapAccess =
  | {
      ChainAuthor: AgentPubKey;
    }
  | {
      RemoteAgent: CapGrant;
    };
