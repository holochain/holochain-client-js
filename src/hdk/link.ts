import {
  ActionHash,
  AgentPubKey,
  EntryHash,
  ExternalHash,
  Timestamp,
} from "../types.js";

/**
 * @public
 */
export type AnyLinkableHash = EntryHash | ActionHash | ExternalHash;

/**
 * An internal zome index within the DNA, from 0 to 255.
 *
 * @public
 */
export type ZomeIndex = number;

/**
 * An internal link type index within the DNA, from 0 to 255.
 *
 * @public
 */
export type LinkType = number;

/**
 * @public
 */
export type LinkTag = Uint8Array;

/**
 * @public
 */
export interface RateWeight {
  bucket_id: RateBucketId;
  units: RateUnits;
}

/**
 * @public
 */
export type RateBucketId = number;

/**
 * @public
 */
export type RateUnits = number;

/**
 * @public
 */
export interface Link {
  author: AgentPubKey;
  target: AnyLinkableHash;
  timestamp: Timestamp;
  zome_index: ZomeIndex;
  link_type: LinkType;
  tag: Uint8Array;
  create_link_hash: ActionHash;
}
