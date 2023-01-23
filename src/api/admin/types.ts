import { Action, DhtOp, Entry, ZomeCallCapGrant } from "../../hdk/index.js";
import {
  ActionHash,
  AgentPubKey,
  CellId,
  DnaHash,
  DnaProperties,
  Duration,
  HoloHash,
  HoloHashB64,
  InstalledAppId,
  KitsuneAgent,
  KitsuneSpace,
  RoleName,
  Signature,
  Timestamp,
  WasmHash,
} from "../../types.js";
import { Requester } from "../common.js";
import { DisableCloneCellRequest } from "../index.js";

/**
 * @public
 */
export type AttachAppInterfaceRequest = { port: number };
/**
 * @public
 */
export type AttachAppInterfaceResponse = { port: number };

/**
 * @public
 */
export type EnableAppRequest = { installed_app_id: InstalledAppId };
/**
 * @public
 */
export type EnableAppResponse = {
  app: AppInfo;
  errors: Array<[CellId, string]>;
};

/**
 * @public
 */
export type DeactivationReason =
  | { never_activated: null }
  | { normal: null }
  | { quarantined: { error: string } };

/**
 * @public
 */
export type PausedAppReason = {
  error: string;
};

/**
 * @public
 */
export type DisabledAppReason =
  | {
      never_started: null;
    }
  | { user: null }
  | { error: string };

/**
 * @public
 */
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

/**
 * @public
 */
export interface StemCell {
  dna: DnaHash;
  name?: string;
  dna_modifiers: DnaModifiers;
}

/**
 * @public
 */
export interface ProvisionedCell {
  cell_id: CellId;
  dna_modifiers: DnaModifiers;
  name: string;
}

/**
 * @public
 */
export interface ClonedCell {
  cell_id: CellId;
  clone_id: RoleName;
  original_dna_hash: DnaHash;
  dna_modifiers: DnaModifiers;
  name: string;
  enabled: boolean;
}

/**
 * @public
 */
export enum CellType {
  Provisioned = "provisioned",
  Cloned = "cloned",
  Stem = "stem",
}

/**
 * @public
 */
export type CellInfo =
  | { [CellType.Provisioned]: ProvisionedCell }
  | { [CellType.Cloned]: ClonedCell }
  | { [CellType.Stem]: StemCell };

/**
 * @public
 */
export type AppInfo = {
  installed_app_id: InstalledAppId;
  cell_info: Record<RoleName, Array<CellInfo>>;
  status: InstalledAppInfoStatus;
};

/**
 * @public
 */
export type MembraneProof = Buffer;

/**
 * @public
 */
export type DisableAppRequest = { installed_app_id: InstalledAppId };
/**
 * @public
 */
export type DisableAppResponse = null;

/**
 * @public
 */
export type StartAppRequest = { installed_app_id: InstalledAppId };
/**
 * @public
 */
export type StartAppResponse = boolean;

/**
 * @public
 */
export type DumpStateRequest = { cell_id: CellId };
/**
 * @public
 */
export type DumpStateResponse = any;

/**
 * @public
 */
export type DumpFullStateRequest = {
  cell_id: CellId;
  dht_ops_cursor: number | undefined;
};
/**
 * @public
 */
export type DumpFullStateResponse = FullStateDump;

/**
 * @public
 */
export type GenerateAgentPubKeyRequest = void;
/**
 * @public
 */
export type GenerateAgentPubKeyResponse = AgentPubKey;

/**
 * @public
 */
export type RegisterDnaRequest = {
  modifiers?: {
    network_seed?: string;
    properties?: DnaProperties;
  };
} & DnaSource;

/**
 * @public
 */
export type RegisterDnaResponse = HoloHash;

/**
 * @public
 */
export type DnaModifiers = {
  network_seed: NetworkSeed;
  properties: DnaProperties;
  origin_time: Timestamp;
  quantum_time: Duration;
};

/**
 * @public
 */
export type FunctionName = string;
/**
 * @public
 */
export type ZomeName = string;
/**
 * @public
 */
export type ZomeDefinition = [
  ZomeName,
  { wasm_hash: WasmHash; dependencies: ZomeName[] }
];
/**
 * @public
 */
export type IntegrityZome = ZomeDefinition;
/**
 * @public
 */
export type CoordinatorZome = ZomeDefinition;

/**
 * @public
 */
export type DnaDefinition = {
  name: string;
  modifiers: DnaModifiers;
  integrity_zomes: IntegrityZome[];
  coordinator_zomes: CoordinatorZome[];
};

/**
 * @public
 */
export type GetDnaDefinitionRequest = DnaHash;
/**
 * @public
 */
export type GetDnaDefinitionResponse = DnaDefinition;

/**
 * @public
 */
export type UninstallAppRequest = {
  installed_app_id: InstalledAppId;
};
/**
 * @public
 */
export type UninstallAppResponse = null;

/**
 * @public
 */
export type ResourceBytes = number[];
/**
 * @public
 */
export type ResourceMap = { [key: string]: ResourceBytes };
/**
 * @public
 */
export enum CellProvisioningStrategy {
  /**
   * Always create a new Cell when installing this App
   */
  Create = "create",
  /**
   * Always create a new Cell when installing the App,
   * and use a unique network seed to ensure a distinct DHT network.
   *
   * Not implemented
   */
  // CreateClone = "create_clone",
  /**
   * Require that a Cell is already installed which matches the DNA version
   * spec, and which has an Agent that's associated with this App's agent
   * via DPKI. If no such Cell exists, *app installation fails*.
   */
  UseExisting = "use_existing",
  /**
   * Try `UseExisting`, and if that fails, fallback to `Create`
   */
  CreateIfNoExists = "create_if_no_exists",
  /**
   * Disallow provisioning altogether. In this case, we expect
   * `clone_limit > 0`: otherwise, no Cells will ever be created.
   *
   * Not implemented
   */
  // Disabled = "disabled",
}
/**
 * @public
 */
export interface CellProvisioning {
  strategy: CellProvisioningStrategy;
  deferred?: boolean;
}

/**
 * @public
 */
export type Location =
  | {
      /**
       * Expect file to be part of this bundle
       */
      bundled: string;
    }
  | {
      /**
       * Get file from local filesystem (not bundled)
       */
      path: string;
    }
  | {
      /**
       * Get file from URL
       */
      url: string;
    };

/**
 * @public
 */
export type DnaVersionSpec = Array<HoloHashB64>;
/**
 * @public
 */
export type DnaVersionFlexible =
  | {
      singleton: HoloHashB64;
    }
  | {
      multiple: DnaVersionSpec;
    };
/**
 * @public
 */
export type AppRoleDnaManifest = {
  clone_limit?: number;
  modifiers?: Partial<DnaModifiers>;
  version?: DnaVersionFlexible;
} & Location;
/**
 * @public
 */
export type AppRoleManifest = {
  name: RoleName;
  provisioning?: CellProvisioning;
  dna: AppRoleDnaManifest;
};
/**
 * @public
 */
export type AppManifest = {
  // Currently "1" is supported
  manifest_version: string;

  name: string;
  description?: string;
  roles: Array<AppRoleManifest>;
};
/**
 * @public
 */
export type AppBundle = {
  manifest: AppManifest;

  // The full or partial resource data. Each entry must correspond to one
  // of the Bundled Locations specified by the Manifest. Bundled Locations
  // are always relative paths (relative to the root_dir).
  resources: ResourceMap;
};

/**
 * @public
 */
export type AppBundleSource = { bundle: AppBundle } | { path: string };

/**
 * @public
 */
export type NetworkSeed = string;
/**
 * @public
 */
export type InstallAppRequest = {
  // The agent to use when creating Cells for this App.
  agent_key: AgentPubKey;

  // The unique identifier for an installed app in this conductor.
  // If not specified, it will be derived from the app name in the bundle manifest.
  installed_app_id?: InstalledAppId;

  // Include proof-of-membrane-membership data for cells that require it,
  // keyed by the CellNick specified in the app bundle manifest.
  membrane_proofs: { [key: string]: MembraneProof };

  // Optional global network seed override.  If set will override the network seed value for all DNAs in the bundle.
  network_seed?: NetworkSeed;
} & AppBundleSource; // The unique identifier for an installed app in this conductor.

/**
 * @public
 */
export type InstallAppResponse = AppInfo;

/**
 * @public
 */
export type ListDnasRequest = void;

/**
 * @public
 */
export type ListDnasResponse = Array<string>;

/**
 * @public
 */
export type ListCellIdsRequest = void;

/**
 * @public
 */
export type ListCellIdsResponse = Array<CellId>;

/**
 * @public
 */
export type ListActiveAppsRequest = void;

/**
 * @public
 */
export type ListActiveAppsResponse = Array<InstalledAppId>;

/**
 * @public
 */
export enum AppStatusFilter {
  Enabled = "enabled",
  Disabled = "disabled",
  Running = "running",
  Stopped = "stopped",
  Paused = "paused",
}

/**
 * @public
 */
export type ListAppsRequest = {
  status_filter?: AppStatusFilter;
};

/**
 * @public
 */
export type ListAppsResponse = Array<AppInfo>;

/**
 * @public
 */
export type ListAppInterfacesRequest = void;

/**
 * @public
 */
export type ListAppInterfacesResponse = Array<number>;

/**
 * This type is meant to be opaque
 *
 * @public
 */
/*
 * agent: any,
 * signature: any,
 * agent_info: any,
 */
export type AgentInfoSigned = unknown;

/**
 * @public
 */
export type AgentInfoRequest = { cell_id: CellId | null };

/**
 * @public
 */
export type AgentInfoResponse = Array<AgentInfoSigned>;

/**
 * @public
 */
export type AddAgentInfoRequest = { agent_infos: Array<AgentInfoSigned> };

/**
 * @public
 */
export type AddAgentInfoResponse = any;

/**
 * @public
 */
export type DeleteCloneCellRequest = DisableCloneCellRequest;

/**
 * @public
 */
export type DeleteCloneCellResponse = void;

/**
 * @public
 */
export interface GrantZomeCallCapabilityRequest {
  /**
   * Cell for which to authorize the capability.
   */
  cell_id: CellId;
  /**
   * Specifies the capability, consisting of zomes and functions to allow
   * signing for as well as access level, secret and assignees.
   */
  cap_grant: ZomeCallCapGrant;
}

/**
 * @public
 */
export type GrantZomeCallCapabilityResponse = void;

/**
 * @public
 */
export type InstallAppDnaPayload = {
  hash: HoloHash;
  role_name: RoleName;
  membrane_proof?: MembraneProof;
};

/**
 * @public
 */
export type ZomeLocation = Location;

/**
 * @public
 */
export type ZomeManifest = {
  name: string;
  hash?: string;
} & ZomeLocation;

/**
 * @public
 */
export type DnaManifest = {
  /**
   * Currently one "1" is supported
   */
  manifest_version: string;

  /**
   * The friendly "name" of a Holochain DNA.
   */
  name: string;

  /**
   * A network seed for uniquifying this DNA.
   */
  network_seed?: NetworkSeed;

  /**
   * Any arbitrary application properties can be included in this object.
   */
  properties?: DnaProperties;

  /**
   * An array of zomes associated with your DNA.
   * The order is significant: it determines initialization order.
   */
  zomes: Array<ZomeManifest>;
};

/**
 * @public
 */
export type DnaBundle = {
  manifest: DnaManifest;
  resources: ResourceMap;
};

/**
 * @public
 */
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

/**
 * @public
 */
export type Zomes = Array<[string, { wasm_hash: Array<HoloHash> }]>;
/**
 * @public
 */
export type WasmCode = [HoloHash, { code: Array<number> }];

/**
 * @public
 */
export interface AgentInfoDump {
  kitsune_agent: KitsuneAgent;
  kitsune_space: KitsuneSpace;
  dump: string;
}

/**
 * @public
 */
export interface P2pAgentsDump {
  /**
   * The info of this agent's cell.
   */
  this_agent_info: AgentInfoDump | undefined;
  /**
   * The dna as a [`DnaHash`] and [`kitsune_p2p::KitsuneSpace`].
   */
  this_dna: [DnaHash, KitsuneSpace] | undefined;
  /**
   * The agent as [`AgentPubKey`] and [`kitsune_p2p::KitsuneAgent`].
   */
  this_agent: [AgentPubKey, KitsuneAgent] | undefined;
  /**
   * All other agent info.
   */
  peers: Array<AgentInfoDump>;
}

/**
 * @public
 */
export interface FullIntegrationStateDump {
  validation_limbo: Array<DhtOp>;
  integration_limbo: Array<DhtOp>;
  integrated: Array<DhtOp>;

  dht_ops_cursor: number;
}

/**
 * @public
 */
export interface SourceChainJsonRecord {
  signature: Signature;
  action_address: ActionHash;
  action: Action;
  entry: Entry | undefined;
}

/**
 * @public
 */
export interface SourceChainJsonDump {
  records: Array<SourceChainJsonRecord>;
  published_ops_count: number;
}

/**
 * @public
 */
export interface FullStateDump {
  peer_dump: P2pAgentsDump;
  source_chain_dump: SourceChainJsonDump;
  integration_dump: FullIntegrationStateDump;
}

/**
 * @public
 */
export interface AdminApi {
  attachAppInterface: Requester<
    AttachAppInterfaceRequest,
    AttachAppInterfaceResponse
  >;
  enableApp: Requester<EnableAppRequest, EnableAppResponse>;
  disableApp: Requester<DisableAppRequest, DisableAppResponse>;
  dumpState: Requester<DumpStateRequest, DumpStateResponse>;
  dumpFullState: Requester<DumpFullStateRequest, DumpFullStateResponse>;
  generateAgentPubKey: Requester<
    GenerateAgentPubKeyRequest,
    GenerateAgentPubKeyResponse
  >;
  registerDna: Requester<RegisterDnaRequest, RegisterDnaResponse>;
  getDnaDefinition: Requester<
    GetDnaDefinitionRequest,
    GetDnaDefinitionResponse
  >;
  uninstallApp: Requester<UninstallAppRequest, UninstallAppResponse>;
  installApp: Requester<InstallAppRequest, InstallAppResponse>;
  listDnas: Requester<ListDnasRequest, ListDnasResponse>;
  listCellIds: Requester<ListCellIdsRequest, ListCellIdsResponse>;
  listApps: Requester<ListAppsRequest, ListAppsResponse>;
  listAppInterfaces: Requester<
    ListAppInterfacesRequest,
    ListAppInterfacesResponse
  >;
  agentInfo: Requester<AgentInfoRequest, AgentInfoResponse>;
  addAgentInfo: Requester<AddAgentInfoRequest, AddAgentInfoResponse>;
  deleteCloneCell: Requester<DeleteCloneCellRequest, DeleteCloneCellResponse>;
  grantZomeCallCapability: Requester<
    GrantZomeCallCapabilityRequest,
    GrantZomeCallCapabilityResponse
  >;
}
