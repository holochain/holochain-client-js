import { Requester } from "./common"
import { HoloHash, AgentPubKey, MembraneProof, DnaProperties, InstalledAppId, CellId, CellNick, InstalledAppInfo, SlotId } from "./types"

export type ActivateAppRequest = { installed_app_id: InstalledAppId }
export type ActivateAppResponse = null

export type AttachAppInterfaceRequest = { port: number }
export type AttachAppInterfaceResponse = { port: number }

export type DeactivateAppRequest = { installed_app_id: InstalledAppId }
export type DeactivateAppResponse = null

export type DumpStateRequest = { cell_id: CellId }
export type DumpStateResponse = any

export type GenerateAgentPubKeyRequest = void
export type GenerateAgentPubKeyResponse = AgentPubKey

export type RegisterDnaRequest = {
  uid?: string,
  properties?: DnaProperties,
} & DnaSource

export type RegisterDnaResponse = HoloHash

export type InstallAppRequest = {
  installed_app_id: InstalledAppId,
  agent_key: AgentPubKey,
  dnas: Array<InstallAppDnaPayload>,
}
export type InstallAppResponse = InstalledAppInfo

export type CreateCloneCellRequest = {
    /// Properties to override when installing this Dna
    properties?: DnaProperties,
    /// The DNA to clone
    dna_hash: HoloHash,
    /// The Agent key with which to create this Cell
    /// (TODO: should this be derived from the App?)
    agent_key: AgentPubKey,
    /// The App with which to associate the newly created Cell
    installed_app_id: InstalledAppId,

    /// The SlotId under which to create this clone
    /// (needed to track cloning permissions and `clone_count`)
    slot_id: SlotId,
    /// Proof-of-membership, if required by this DNA
    membrane_proof?: MembraneProof
}
export type CreateCloneCellResponse = CellId

export type ResourceBytes = Buffer
export type ResourceMap = {[key: string]: ResourceBytes}
export type CellProvisioning =
    {
        /// Always create a new Cell when installing this App
        create: {deferred: boolean},
    } | {
        /// Always create a new Cell when installing the App,
        /// and use a unique UID to ensure a distinct DHT network
        create_clone: {deferred: boolean},
    } | {
        /// Require that a Cell is already installed which matches the DNA version
        /// spec, and which has an Agent that's associated with this App's agent
        /// via DPKI. If no such Cell exists, *app installation fails*.
        use_existing: {deferred: boolean},
    } | {
        /// Try `UseExisting`, and if that fails, fallback to `Create`
        create_if_no_exists: {deferred: boolean}
    } | {
        /// Disallow provisioning altogether. In this case, we expect
        /// `clone_limit > 0`: otherwise, no Cells will ever be created.
        disabled: {}
    };


export type HoloHashB64 = string;
export type DnaVersionSpec = Array<HoloHashB64>
export type DnaVersionFlexible =
    {
        singleton: HoloHashB64
    }
    |
    {
        multiple: DnaVersionSpec
    }
export type AppSlotDnaManifest = {
    location?: Location,
    properties?: DnaProperties,
    uid?: string,
    version?: DnaVersionFlexible,
}
export type AppSlotManifest = {
    id: SlotId,
    provisioning?: CellProvisioning,
    dna: AppSlotDnaManifest,
}
export type AppManifest = {
    /// Currently one "1" is supported
    manifest_version: string;

    name: string,
    description?: string,
    slots: Array<AppSlotManifest>,
}
export type AppBundle =
    {
        manifest: AppManifest,

        /// The full or partial resource data. Each entry must correspond to one
        /// of the Bundled Locations specified by the Manifest. Bundled Locations
        /// are always relative paths (relative to the root_dir).
        resources: ResourceMap,
    }

export type AppBundleSource =
    {bundle: AppBundle}
    |
    {path: string}

export type Uid = string;
export type InstallAppBundleRequest = {

    /// The agent to use when creating Cells for this App.
    agent_key: AgentPubKey,

    /// The unique identifier for an installed app in this conductor.
    /// If not specified, it will be derived from the app name in the bundle manifest.
    installed_app_id?: InstalledAppId,

    /// Include proof-of-membrane-membership data for cells that require it,
    /// keyed by the CellNick specified in the app bundle manifest.
    membrane_proofs: {[key: string]: MembraneProof},

    /// Optional global UID override.  If set will override the UID value for all DNAs in the bundle.
    uid?: Uid,
} &
/// The unique identifier for an installed app in this conductor.
AppBundleSource


export type InstallAppBundleResponse = InstalledAppInfo

export type ListDnasRequest = void
export type ListDnasResponse = Array<string>

export type ListCellIdsRequest = void
export type ListCellIdsResponse = Array<CellId>

export type ListActiveAppsRequest = void
export type ListActiveAppsResponse = Array<InstalledAppId>

export type ListAppInterfacesRequest = void
export type ListAppInterfacesResponse = Array<number>

// this type is meant to be opaque
export type AgentInfoSigned = any
/*{
    agent: any,
    signature: any,
    agent_info: any,
}*/

export type RequestAgentInfoRequest = { cell_id: CellId|null }
export type RequestAgentInfoResponse = Array<AgentInfoSigned>
export type AddAgentInfoRequest = { agent_infos: Array<AgentInfoSigned> }
export type AddAgentInfoResponse = any

export interface AdminApi {
  activateApp: Requester<ActivateAppRequest, ActivateAppResponse>
  attachAppInterface: Requester<AttachAppInterfaceRequest, AttachAppInterfaceResponse>
  deactivateApp: Requester<DeactivateAppRequest, DeactivateAppResponse>
  dumpState: Requester<DumpStateRequest, DumpStateResponse>
  generateAgentPubKey: Requester<GenerateAgentPubKeyRequest, GenerateAgentPubKeyResponse>
  registerDna: Requester<RegisterDnaRequest, RegisterDnaResponse>
  installApp: Requester<InstallAppRequest, InstallAppResponse>
  createCloneCell: Requester<CreateCloneCellRequest, CreateCloneCellResponse>
  installAppBundle: Requester<InstallAppBundleRequest, InstallAppBundleResponse>
  listDnas: Requester<ListDnasRequest, ListDnasResponse>
  listCellIds: Requester<ListCellIdsRequest, ListCellIdsResponse>
  listActiveApps: Requester<ListActiveAppsRequest, ListActiveAppsResponse>
  listAppInterfaces: Requester<ListAppInterfacesRequest, ListAppInterfacesResponse>
  requestAgentInfo: Requester<RequestAgentInfoRequest, RequestAgentInfoResponse>
  addAgentInfo: Requester<AddAgentInfoRequest, AddAgentInfoResponse>
}


export type InstallAppDnaPayload = {
  hash: HoloHash
  nick: CellNick,
  properties?: DnaProperties,
  membrane_proof?: MembraneProof
}

export type ZomeLocation = {
    /// Expect file to be part of this bundle
    bundled: string;
} | {
    /// Get file from local filesystem (not bundled)
    path: string;
} | {
    /// Get file from URL
    url: string;
}

export type ZomeManifest = {
    name: string,
    hash?: string,
} & ZomeLocation

export type DnaManifest = {
    /// Currently one "1" is supported
    manifest_version: string;

    /// The friendly "name" of a Holochain DNA.
    name: string,

    /// A UID for uniquifying this Dna.
    // TODO: consider Vec<u8> instead (https://github.com/holochain/holochain/pull/86#discussion_r412689085)
    uid?: string,

    /// Any arbitrary application properties can be included in this object.
    properties?: DnaProperties,

    /// An array of zomes associated with your DNA.
    /// The order is significant: it determines initialization order.
    zomes: Array<ZomeManifest>,
}

export type DnaBundle = {
    manifest: DnaManifest;
    resources: ResourceMap;
}

export type DnaSource =
  {
    hash: HoloHash
  }
  |
  {
    path: string
  }
   |
  {
    bundle: DnaBundle
  };

export interface HoloHashed<T> {
  hash: HoloHash;
  content: T;
}

export type Zomes = Array<[string, { wasm_hash: Array<HoloHash> }]>;
export type WasmCode = [HoloHash, { code: Array<number> }];
