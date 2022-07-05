import {
  AgentPubKey,
  CellId,
  DnaHash,
  DnaProperties,
  ActionHash,
  HoloHash,
  InstalledAppId,
  InstalledCell,
  KitsuneAgent,
  KitsuneSpace,
  RoleId,
  Signature,
} from "../../types.js";
import { DhtOp, Entry, Action } from "../../hdk/index.js";
import { Requester } from "../common.js";

export type AttachAppInterfaceRequest = { port: number };
export type AttachAppInterfaceResponse = { port: number };

// Deprecated
export type ActivateAppRequest = EnableAppRequest;
// Deprecated
export type ActivateAppResponse = EnableAppResponse;

// Deprecated
export type DeactivateAppRequest = { installed_app_id: InstalledAppId };
// Deprecated
export type DeactivateAppResponse = null;

export type EnableAppRequest = { installed_app_id: InstalledAppId };
export type EnableAppResponse = {
  app: InstalledAppInfo;
  errors: Array<[CellId, string]>;
};

export type DeactivationReason =
  | { never_activated: null }
  | { normal: null }
  | { quarantined: { error: string } };

export type PausedAppReason = {
  error: string;
};

export type DisabledAppReason =
  | {
      never_started: null;
    }
  | { user: null }
  | { error: string };

export type InstalledAppInfoStatus =
  | {
      paused: { reason: PausedAppReason };
    }
  | {
      disabled: {
        reason: DisabledAppReason;
      };
    }
  | {
      running: null;
    };

export type InstalledAppInfo = {
  installed_app_id: InstalledAppId;
  cell_data: Array<InstalledCell>;
  status: InstalledAppInfoStatus;
};

export type MembraneProof = Buffer;

export type DisableAppRequest = { installed_app_id: InstalledAppId };
export type DisableAppResponse = null;

export type StartAppRequest = { installed_app_id: InstalledAppId };
export type StartAppResponse = boolean;

export type DumpStateRequest = { cell_id: CellId };
export type DumpStateResponse = any;

export type DumpFullStateRequest = {
  cell_id: CellId;
  dht_ops_cursor: number | undefined;
};
export type DumpFullStateResponse = FullStateDump;

export type GenerateAgentPubKeyRequest = void;
export type GenerateAgentPubKeyResponse = AgentPubKey;

export type RegisterDnaRequest = {
  uid?: string;
  properties?: DnaProperties;
} & DnaSource;

export type RegisterDnaResponse = HoloHash;

export type InstallAppRequest = {
  installed_app_id: InstalledAppId;
  agent_key: AgentPubKey;
  dnas: Array<InstallAppDnaPayload>;
};
export type InstallAppResponse = InstalledAppInfo;

export type UninstallAppRequest = {
  installed_app_id: InstalledAppId;
};
export type UninstallAppResponse = null;

export type CreateCloneCellRequest = {
  /// Properties to override when installing this Dna
  properties?: DnaProperties;
  /// The DNA to clone
  dna_hash: HoloHash;
  /// The Agent key with which to create this Cell
  /// (TODO: should this be derived from the App?)
  agent_key: AgentPubKey;
  /// The App with which to associate the newly created Cell
  installed_app_id: InstalledAppId;

  /// The RoleId under which to create this clone
  /// (needed to track cloning permissions and `clone_count`)
  role_id: RoleId;
  /// Proof-of-membership, if required by this DNA
  membrane_proof?: MembraneProof;
};
export type CreateCloneCellResponse = CellId;

export type ResourceBytes = Buffer;
export type ResourceMap = { [key: string]: ResourceBytes };
export type CellProvisioning =
  | {
      /// Always create a new Cell when installing this App
      create: { deferred: boolean };
    }
  | {
      /// Always create a new Cell when installing the App,
      /// and use a unique UID to ensure a distinct DHT network
      create_clone: { deferred: boolean };
    }
  | {
      /// Require that a Cell is already installed which matches the DNA version
      /// spec, and which has an Agent that's associated with this App's agent
      /// via DPKI. If no such Cell exists, *app installation fails*.
      use_existing: { deferred: boolean };
    }
  | {
      /// Try `UseExisting`, and if that fails, fallback to `Create`
      create_if_no_exists: { deferred: boolean };
    }
  | {
      /// Disallow provisioning altogether. In this case, we expect
      /// `clone_limit > 0`: otherwise, no Cells will ever be created.
      disabled: Record<string, never>;
    };

export type HoloHashB64 = string;
export type DnaVersionSpec = Array<HoloHashB64>;
export type DnaVersionFlexible =
  | {
      singleton: HoloHashB64;
    }
  | {
      multiple: DnaVersionSpec;
    };
export type AppRoleDnaManifest = {
  location?: Location;
  properties?: DnaProperties;
  uid?: string;
  version?: DnaVersionFlexible;
};
export type AppRoleManifest = {
  id: RoleId;
  provisioning?: CellProvisioning;
  dna: AppRoleDnaManifest;
};
export type AppManifest = {
  /// Currently one "1" is supported
  manifest_version: string;

  name: string;
  description?: string;
  roles: Array<AppRoleManifest>;
};
export type AppBundle = {
  manifest: AppManifest;

  /// The full or partial resource data. Each entry must correspond to one
  /// of the Bundled Locations specified by the Manifest. Bundled Locations
  /// are always relative paths (relative to the root_dir).
  resources: ResourceMap;
};

export type AppBundleSource = { bundle: AppBundle } | { path: string };

export type Uid = string;
export type InstallAppBundleRequest = {
  /// The agent to use when creating Cells for this App.
  agent_key: AgentPubKey;

  /// The unique identifier for an installed app in this conductor.
  /// If not specified, it will be derived from the app name in the bundle manifest.
  installed_app_id?: InstalledAppId;

  /// Include proof-of-membrane-membership data for cells that require it,
  /// keyed by the CellNick specified in the app bundle manifest.
  membrane_proofs: { [key: string]: MembraneProof };

  /// Optional global UID override.  If set will override the UID value for all DNAs in the bundle.
  uid?: Uid;
} & AppBundleSource; /// The unique identifier for an installed app in this conductor.

export type InstallAppBundleResponse = InstalledAppInfo;

export type ListDnasRequest = void;
export type ListDnasResponse = Array<string>;

export type ListCellIdsRequest = void;
export type ListCellIdsResponse = Array<CellId>;

export type ListActiveAppsRequest = void;
export type ListActiveAppsResponse = Array<InstalledAppId>;

export enum AppStatusFilter {
  Enabled = "enabled",
  Disabled = "disabled",
  Running = "running",
  Stopped = "stopped",
  Paused = "paused",
}
export type ListAppsRequest = {
  status_filter?: AppStatusFilter;
};
export type ListAppsResponse = Array<InstalledAppInfo>;

export type ListAppInterfacesRequest = void;
export type ListAppInterfacesResponse = Array<number>;

// this type is meant to be opaque
export type AgentInfoSigned = any;
/*{
    agent: any,
    signature: any,
    agent_info: any,
}*/

export type RequestAgentInfoRequest = { cell_id: CellId | null };
export type RequestAgentInfoResponse = Array<AgentInfoSigned>;
export type AddAgentInfoRequest = { agent_infos: Array<AgentInfoSigned> };
export type AddAgentInfoResponse = any;

export interface AdminApi {
  attachAppInterface: Requester<
    AttachAppInterfaceRequest,
    AttachAppInterfaceResponse
  >;
  // Deprecated
  activateApp: Requester<ActivateAppRequest, ActivateAppResponse>;
  // Deprecated
  deactivateApp: Requester<DeactivateAppRequest, DeactivateAppResponse>;
  enableApp: Requester<EnableAppRequest, EnableAppResponse>;
  disableApp: Requester<DisableAppRequest, DisableAppResponse>;
  startApp: Requester<StartAppRequest, StartAppResponse>;
  dumpState: Requester<DumpStateRequest, DumpStateResponse>;
  dumpFullState: Requester<DumpFullStateRequest, DumpFullStateResponse>;
  generateAgentPubKey: Requester<
    GenerateAgentPubKeyRequest,
    GenerateAgentPubKeyResponse
  >;
  registerDna: Requester<RegisterDnaRequest, RegisterDnaResponse>;
  installApp: Requester<InstallAppRequest, InstallAppResponse>;
  uninstallApp: Requester<UninstallAppRequest, UninstallAppResponse>;
  createCloneCell: Requester<CreateCloneCellRequest, CreateCloneCellResponse>;
  installAppBundle: Requester<
    InstallAppBundleRequest,
    InstallAppBundleResponse
  >;
  listDnas: Requester<ListDnasRequest, ListDnasResponse>;
  listCellIds: Requester<ListCellIdsRequest, ListCellIdsResponse>;
  // Deprecated
  listActiveApps: Requester<ListActiveAppsRequest, ListActiveAppsResponse>;
  listApps: Requester<ListAppsRequest, ListAppsResponse>;
  listAppInterfaces: Requester<
    ListAppInterfacesRequest,
    ListAppInterfacesResponse
  >;
  requestAgentInfo: Requester<
    RequestAgentInfoRequest,
    RequestAgentInfoResponse
  >;
  addAgentInfo: Requester<AddAgentInfoRequest, AddAgentInfoResponse>;
}

export type InstallAppDnaPayload = {
  hash: HoloHash;
  role_id: RoleId;
  membrane_proof?: MembraneProof;
};

export type ZomeLocation =
  | {
      /// Expect file to be part of this bundle
      bundled: string;
    }
  | {
      /// Get file from local filesystem (not bundled)
      path: string;
    }
  | {
      /// Get file from URL
      url: string;
    };

export type ZomeManifest = {
  name: string;
  hash?: string;
} & ZomeLocation;

export type DnaManifest = {
  /// Currently one "1" is supported
  manifest_version: string;

  /// The friendly "name" of a Holochain DNA.
  name: string;

  /// A UID for uniquifying this Dna.
  // TODO: consider Vec<u8> instead (https://github.com/holochain/holochain/pull/86#discussion_r412689085)
  uid?: string;

  /// Any arbitrary application properties can be included in this object.
  properties?: DnaProperties;

  /// An array of zomes associated with your DNA.
  /// The order is significant: it determines initialization order.
  zomes: Array<ZomeManifest>;
};

export type DnaBundle = {
  manifest: DnaManifest;
  resources: ResourceMap;
};

export type DnaSource =
  | {
      hash: HoloHash;
    }
  | {
      path: string;
    }
  | {
      bundle: DnaBundle;
    };

export type Zomes = Array<[string, { wasm_hash: Array<HoloHash> }]>;
export type WasmCode = [HoloHash, { code: Array<number> }];

export interface AgentInfoDump {
  kitsune_agent: KitsuneAgent;
  kitsune_space: KitsuneSpace;
  dump: string;
}

export interface P2pAgentsDump {
  /// The info of this agent's cell.
  this_agent_info: AgentInfoDump | undefined;
  /// The dna as a [`DnaHash`] and [`kitsune_p2p::KitsuneSpace`].
  this_dna: [DnaHash, KitsuneSpace] | undefined;
  /// The agent as [`AgentPubKey`] and [`kitsune_p2p::KitsuneAgent`].
  this_agent: [AgentPubKey, KitsuneAgent] | undefined;
  /// All other agent info.
  peers: Array<AgentInfoDump>;
}

export interface FullIntegrationStateDump {
  validation_limbo: Array<DhtOp>;
  integration_limbo: Array<DhtOp>;
  integrated: Array<DhtOp>;

  dht_ops_cursor: number;
}

export interface SourceChainJsonRecord {
  signature: Signature;
  action_address: ActionHash;
  action: Action;
  entry: Entry | undefined;
}

export interface SourceChainJsonDump {
  records: Array<SourceChainJsonRecord>;
  published_ops_count: number;
}

export interface FullStateDump {
  peer_dump: P2pAgentsDump;
  source_chain_dump: SourceChainJsonDump;
  integration_dump: FullIntegrationStateDump;
}
