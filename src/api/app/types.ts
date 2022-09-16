import { CapSecret } from "../../hdk/capabilities.js";
import {
  AgentPubKey,
  CellId,
  DnaProperties,
  InstalledAppId,
  InstalledCell,
  RoleId,
  Timestamp,
} from "../../types.js";
import { Requester } from "../common.js";
import {
  InstalledAppInfo,
  MembraneProof,
  NetworkSeed,
} from "../admin/index.js";

export type CallZomeRequestGeneric<Payload> = {
  cap_secret: CapSecret | null;
  cell_id: CellId;
  zome_name: string;
  fn_name: string;
  payload: Payload;
  provenance: AgentPubKey;
};
export type CallZomeRequest = CallZomeRequestGeneric<any>;
export type CallZomeResponseGeneric<Payload> = Payload;
export type CallZomeResponse = CallZomeResponseGeneric<any>;

export type AppInfoRequest = { installed_app_id: InstalledAppId };
export type AppInfoResponse = InstalledAppInfo;

export interface CreateCloneCellRequest {
  /// The app id that the DNA to clone belongs to
  app_id: InstalledAppId;
  /// The DNA's role id to clone
  /// The Role id under which to create this clone
  role_id: RoleId;
  /// The network seed of a DNA is included in the computation of the DNA hash.
  /// The DNA hash in turn determines the network peers and the DHT, meaning
  /// that only peers with the same DNA hash of a shared DNA participate in the
  /// same network and co-create the DHT. To create a separate DHT for the DNA,
  /// a unique network seed can be specified.
  network_seed?: NetworkSeed;
  /// Any arbitrary application properties can be included in this object to override the DNA properties.
  properties?: DnaProperties;
  /// The time used to denote the origin of the network, used to calculate
  /// time windows during gossip.
  /// All Action timestamps must come after this time.
  origin_time?: Timestamp;
  /// Optionally set a proof of membership for the new cell
  membrane_proof?: MembraneProof;
  /// Optionally a name for the DNA clone
  name?: string;
}
export type CreateCloneCellResponse = InstalledCell;

export type AppSignal = {
  type: string;
  data: {
    cellId: CellId;
    payload: any;
  };
};

export type AppSignalCb = (signal: AppSignal) => void;

export type SignalResponseGeneric<Payload> = Payload;

export interface AppApi {
  appInfo: Requester<AppInfoRequest, AppInfoResponse>;
  callZome: Requester<CallZomeRequest, CallZomeResponse>;
}
