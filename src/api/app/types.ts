import {
  AgentPubKey,
  CellId,
  DnaHash,
  DnaProperties,
  InstalledAppId,
  NetworkInfo,
  RoleName,
  Timestamp,
} from "../../types.js";
import {
  AppInfo,
  ClonedCell,
  FunctionName,
  MembraneProof,
  NetworkSeed,
  ZomeName,
} from "../admin/index.js";
import { Requester } from "../common.js";

/**
 * @public
 */
export type CallZomeRequestGeneric<Payload> = {
  cell_id: CellId;
  zome_name: ZomeName;
  fn_name: FunctionName;
  payload: Payload;
  provenance: AgentPubKey;
};
/**
 * @public
 */
export type CallZomeRequest = CallZomeRequestGeneric<any>;

/**
 * @public
 */
export type CallZomeResponseGeneric<Payload> = Payload;
/**
 * @public
 */
export type CallZomeResponse = CallZomeResponseGeneric<any>;

/**
 * @public
 */
export type AppInfoRequest = { installed_app_id: InstalledAppId };
/**
 * @public
 */
export type AppInfoResponse = AppInfo;

/**
 * @public
 */
export interface CreateCloneCellRequest {
  /**
   * The app id that the DNA to clone belongs to
   */
  app_id: InstalledAppId;
  /**
   * The DNA's role id to clone.
   */
  role_name: RoleName;
  /**
   * Modifiers to set for the new cell.
   * At least one of the modifiers must be set to obtain a distinct hash for
   * the clone cell's DNA.
   */
  modifiers: {
    /**
     * The network seed of a DNA is included in the computation of the DNA hash.
     * The DNA hash in turn determines the network peers and the DHT, meaning
     * that only peers with the same DNA hash of a shared DNA participate in the
     * same network and co-create the DHT. To create a separate DHT for the DNA,
     * a unique network seed can be specified.
     */
    network_seed?: NetworkSeed;
    /**
     * Any arbitrary application properties can be included in this object to
     * override the DNA properties.
     */
    properties?: DnaProperties;
    /**
     * The time used to denote the origin of the network, used to calculate
     * time windows during gossip.
     * All Action timestamps must come after this time.
     */
    origin_time?: Timestamp;
  };
  /**
   * Optionally set a proof of membership for the new cell.
   */
  membrane_proof?: MembraneProof;
  /**
   * Optionally a name for the DNA clone.
   */
  name?: string;
}
/**
 * @public
 */
export type CreateCloneCellResponse = ClonedCell;

/**
 * @public
 */
export interface DisableCloneCellRequest {
  /**
   * The app id that the clone cell belongs to
   */
  app_id: InstalledAppId;
  /**
   * The clone id or cell id of the clone cell
   */
  clone_cell_id: RoleName | CellId;
}
/**
 * @public
 */
export type DisableCloneCellResponse = void;

/**
 * @public
 */
export type EnableCloneCellRequest = DisableCloneCellRequest;
/**
 * @public
 */
export type EnableCloneCellResponse = CreateCloneCellResponse;

/**
 * @public
 */
export interface NetworkInfoRequest {
  /**
   * The calling agent
   */
  agent_pub_key: AgentPubKey;
  /**
   * Get network info for these DNAs
   */
  dnas: DnaHash[];
  /**
   * Timestamp in ms since which received amount of bytes from peers will be returned. Defaults to UNIX_EPOCH.
   */
  last_time_queried?: number;
}

/**
 * @public
 */
export const SignalType = {
  App: "App",
  System: "System",
} as const;
/**
 * @public
 */
export type Signal =
  | {
      [SignalType.App]: EncodedAppSignal;
    }
  | {
      [SignalType.System]: unknown;
    };
/**
 * @public
 */
export type EncodedAppSignal = {
  cell_id: CellId;
  zome_name: string;
  signal: Uint8Array;
};
/**
 * @public
 */
export type AppSignal = {
  cell_id: CellId;
  zome_name: string;
  payload: unknown;
};
/**
 * @public
 */
export type AppSignalCb = (signal: AppSignal) => void;

/**
 * @public
 */
export type NetworkInfoResponse = NetworkInfo[];

/**
 * @public
 */
export interface AppApi {
  appInfo: Requester<AppInfoRequest, AppInfoResponse>;
  callZome: Requester<CallZomeRequest, CallZomeResponse>;
  enableCloneCell: Requester<EnableCloneCellRequest, EnableCloneCellResponse>;
  disableCloneCell: Requester<
    DisableCloneCellRequest,
    DisableCloneCellResponse
  >;
}
