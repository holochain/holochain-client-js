import { UnsubscribeFunction } from "emittery";
import {
  AgentPubKey,
  AppAuthenticationToken,
  AppInfo,
  CapSecret,
  CellId,
  ClonedCell,
  DnaHash,
  DnaProperties,
  FunctionName,
  MembraneProof,
  NetworkInfo,
  NetworkSeed,
  Nonce256Bit,
  RoleName,
  Timestamp,
  WebsocketConnectionOptions,
  ZomeName,
} from "../../index.js";

/**
 * @public
 */
export type NonProvenanceCallZomeRequest = Omit<CallZomeRequest, "provenance">;

/**
 * @public
 */
export type RoleNameCallZomeRequest = Omit<
  NonProvenanceCallZomeRequest,
  "cell_id"
> & {
  role_name: RoleName;
};

/**
 * @public
 */
export type RoleNameCallZomeRequestSigned = Omit<
  CallZomeRequestSigned,
  "cell_id"
> & { role_name: RoleName };

/**
 * @public
 */
export type AppCallZomeRequest =
  | NonProvenanceCallZomeRequest
  | RoleNameCallZomeRequest
  | CallZomeRequestSigned
  | RoleNameCallZomeRequestSigned;

/**
 * @public
 */
export type AppCreateCloneCellRequest = Omit<CreateCloneCellRequest, "app_id">;

/**
 * @public
 */
export type AppEnableCloneCellRequest = Omit<EnableCloneCellRequest, "app_id">;

/**
 * @public
 */
export type AppDisableCloneCellRequest = Omit<
  DisableCloneCellRequest,
  "app_id"
>;

/**
 * @public
 */
export type AppNetworkInfoRequest = Omit<NetworkInfoRequest, "agent_pub_key">;

/**
 * @public
 */
export interface AppEvents {
  signal: AppSignal;
}

/**
 * @public
 */
export interface CallZomeRequestUnsigned extends CallZomeRequest {
  cap_secret: CapSecret | null;
  nonce: Nonce256Bit;
  expires_at: number;
}

/**
 * @public
 */
export interface CallZomeRequestSigned extends CallZomeRequestUnsigned {
  signature: Uint8Array;
}

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
export type AppInfoResponse = AppInfo | null;

/**
 * @public
 */
export interface CreateCloneCellRequest {
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
export interface AppClient {
  callZome(args: AppCallZomeRequest, timeout?: number): Promise<any>;

  on<Name extends keyof AppEvents>(
    eventName: Name | readonly Name[],
    listener: AppSignalCb
  ): UnsubscribeFunction;

  appInfo(): Promise<AppInfoResponse>;

  myPubKey: AgentPubKey;

  createCloneCell(
    args: AppCreateCloneCellRequest
  ): Promise<CreateCloneCellResponse>;
  enableCloneCell(
    args: AppEnableCloneCellRequest
  ): Promise<EnableCloneCellResponse>;
  disableCloneCell(
    args: AppDisableCloneCellRequest
  ): Promise<DisableCloneCellResponse>;
  networkInfo(args: AppNetworkInfoRequest): Promise<NetworkInfoResponse>;
}

/**
 * @public
 */
export interface AppWebsocketConnectionOptions
  extends WebsocketConnectionOptions {
  token?: AppAuthenticationToken;
}
