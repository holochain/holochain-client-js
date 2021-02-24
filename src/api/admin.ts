import { Requester } from "./common"
import { HoloHash, AgentPubKey, MembraneProof, DnaProperties, InstalledAppId, CellId, CellNick, InstalledApp, SlotId } from "./types"

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
  source: DnaSource,
  uuid?: string,
  properties?: DnaProperties,
}

export type RegisterDnaResponse = HoloHash

export type InstallAppRequest = {
  installed_app_id: InstalledAppId,
  agent_key: AgentPubKey,
  dnas: Array<InstallAppDnaPayload>,
}
export type InstallAppResponse = InstalledApp

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
        /// and use a unique UUID to ensure a distinct DHT network
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
    uuid?: string,
    version?: DnaVersionFlexible,
}
export type AppSlotManifest = {
    id: SlotId,
    provisioning?: CellProvisioning,
    dna: AppSlotDnaManifest,
}
export type AppManifest = {
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
    AppBundle
    |
    string

export type InstallAppBundleRequest = {
    /// The unique identifier for an installed app in this conductor.
    source: AppBundleSource,

    /// The agent to use when creating Cells for this App.
    agent_key: AgentPubKey,

    /// The unique identifier for an installed app in this conductor.
    /// If not specified, it will be derived from the app name in the bundle manifest.
    installed_app_id?: InstalledAppId,

    /// Include proof-of-membrane-membership data for cells that require it,
    /// keyed by the CellNick specified in the app bundle manifest.
    membrane_proofs: {[key: string]: MembraneProof},
}

export type InstallAppBundleResponse = InstalledApp

export type ListDnasRequest = void
export type ListDnasResponse = Array<string>

export type ListCellIdsRequest = void
export type ListCellIdsResponse = Array<CellId>

export type ListActiveAppsRequest = void
export type ListActiveAppsResponse = Array<InstalledAppId>

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
  requestAgentInfo: Requester<RequestAgentInfoRequest, RequestAgentInfoResponse>
  addAgentInfo: Requester<AddAgentInfoRequest, AddAgentInfoResponse>
}


type InstallAppDnaPayload = {
  path?: string,
  hash?: HoloHash
  nick: CellNick,
  properties?: DnaProperties,
  membrane_proof?: MembraneProof
}

type DnaSource =
  {
    hash: HoloHash
  }
  |
  {
    path: string
  }
   |
  {
    dna_file: DnaFile
  };

export interface HoloHashed<T> {
  hash: HoloHash;
  content: T;
}

export interface DnaFile {
  dna: HoloHashed<DnaDef>;
  code: Array<WasmCode>;
}

export interface DnaDef {
  name: String;
  uuid: String;
  properties: HoloHash;
  zomes: Zomes;
}

export type Zomes = Array<[string, { wasm_hash: Array<HoloHash> }]>;
export type WasmCode = [HoloHash, { code: Array<number> }];
