import { getLauncherEnvironment } from "../../environments/launcher.js";
import {
  CapSecret,
  GrantedFunctions,
  GrantedFunctionsType,
} from "../../hdk/capabilities.js";
import type { AgentPubKey, CellId } from "../../types.js";
import { WsClient } from "../client.js";
import {
  WebsocketConnectionOptions,
  catchError,
  DEFAULT_TIMEOUT,
  promiseTimeout,
  Requester,
  requesterTransformer,
  Transformer,
} from "../common.js";
import {
  generateSigningKeyPair,
  randomCapSecret,
  setSigningCredentials,
} from "../zome-call-signing.js";
import {
  AddAgentInfoRequest,
  AddAgentInfoResponse,
  AdminApi,
  AgentInfoRequest,
  AgentInfoResponse,
  AppStatusFilter,
  AttachAppInterfaceRequest,
  AttachAppInterfaceResponse,
  DeleteCloneCellRequest,
  DeleteCloneCellResponse,
  DisableAppRequest,
  DisableAppResponse,
  DumpFullStateRequest,
  DumpFullStateResponse,
  DumpNetworkStatsRequest,
  DumpNetworkStatsResponse,
  DumpStateRequest,
  DumpStateResponse,
  EnableAppRequest,
  EnableAppResponse,
  GenerateAgentPubKeyRequest,
  GenerateAgentPubKeyResponse,
  GetDnaDefinitionRequest,
  GetDnaDefinitionResponse,
  GrantZomeCallCapabilityRequest,
  GrantZomeCallCapabilityResponse,
  InstallAppRequest,
  InstallAppResponse,
  ListAppInterfacesRequest,
  ListAppInterfacesResponse,
  ListAppsRequest,
  ListAppsResponse,
  ListCellIdsRequest,
  ListCellIdsResponse,
  ListDnasRequest,
  ListDnasResponse,
  RegisterDnaRequest,
  RegisterDnaResponse,
  StorageInfoRequest,
  StorageInfoResponse,
  UninstallAppRequest,
  UninstallAppResponse,
  UpdateCoordinatorsRequest,
  UpdateCoordinatorsResponse,
} from "./types.js";

/**
 * A class for interacting with a conductor's Admin API.
 *
 * @public
 */
export class AdminWebsocket implements AdminApi {
  /**
   * The websocket client used for transporting requests and responses.
   */
  readonly client: WsClient;
  /**
   * Default timeout for any request made over the websocket.
   */
  defaultTimeout: number;

  private constructor(client: WsClient, defaultTimeout?: number) {
    this.client = client;
    this.defaultTimeout =
      defaultTimeout === undefined ? DEFAULT_TIMEOUT : defaultTimeout;
  }

  /**
   * Factory mehtod to create a new instance connected to the given URL.
   *
   * @param options - {@link (WebsocketConnectionOptions:interface)}
   * @returns A promise for a new connected instance.
   */
  static async connect(
    options: WebsocketConnectionOptions = {}
  ): Promise<AdminWebsocket> {
    // Check if we are in the launcher's environment, and if so, redirect the url to connect to
    const env = getLauncherEnvironment();

    if (env?.ADMIN_INTERFACE_PORT) {
      options.url = new URL(`ws://127.0.0.1:${env.ADMIN_INTERFACE_PORT}`);
    }

    if (!options.url) {
      throw new Error(
        "Unable to connect to Admin Websocket: No url provided and not in a Launcher environment."
      );
    }

    const wsClient = await WsClient.connect(
      options.url,
      options.wsClientOptions
    );
    return new AdminWebsocket(wsClient, options.defaultTimeout);
  }

  _requester<ReqI, ReqO, ResI, ResO>(
    tag: string,
    transformer?: Transformer<ReqI, ReqO, ResI, ResO>
  ) {
    return requesterTransformer(
      (req, timeout) =>
        promiseTimeout(
          this.client.request(req),
          tag,
          timeout || this.defaultTimeout
        ).then(catchError),
      tag,
      transformer
    );
  }

  /**
   * Send a request to open the given port for {@link AppWebsocket} connections.
   */
  attachAppInterface: Requester<
    AttachAppInterfaceRequest,
    AttachAppInterfaceResponse
  > = this._requester("attach_app_interface");

  /**
   * Enable a stopped app.
   */
  enableApp: Requester<EnableAppRequest, EnableAppResponse> =
    this._requester("enable_app");

  /**
   * Disable a running app.
   */
  disableApp: Requester<DisableAppRequest, DisableAppResponse> =
    this._requester("disable_app");

  /**
   * Dump the state of the specified cell, including its source chain, as JSON.
   */
  dumpState: Requester<DumpStateRequest, DumpStateResponse> = this._requester(
    "dump_state",
    dumpStateTransform
  );

  /**
   * Dump the full state of the specified cell, including its chain and DHT
   * shard, as JSON.
   */
  dumpFullState: Requester<DumpFullStateRequest, DumpFullStateResponse> =
    this._requester("dump_full_state");

  /**
   * Generate a new agent pub key.
   */
  generateAgentPubKey: Requester<
    GenerateAgentPubKeyRequest,
    GenerateAgentPubKeyResponse
  > = this._requester("generate_agent_pub_key");

  /**
   * Register a DNA for later app installation.
   *
   * Stores the given DNA into the Holochain DNA database and returns the hash of it.
   */
  registerDna: Requester<RegisterDnaRequest, RegisterDnaResponse> =
    this._requester("register_dna");

  /**
   * Get the DNA definition for the specified DNA hash.
   */
  getDnaDefinition: Requester<
    GetDnaDefinitionRequest,
    GetDnaDefinitionResponse
  > = this._requester("get_dna_definition");

  /**
   * Uninstall the specified app from Holochain.
   */
  uninstallApp: Requester<UninstallAppRequest, UninstallAppResponse> =
    this._requester("uninstall_app");

  /**
   * Install the specified app into Holochain.
   */
  installApp: Requester<InstallAppRequest, InstallAppResponse> =
    this._requester("install_app");

  /**
   * Update coordinators for an installed app.
   */
  updateCoordinators: Requester<
    UpdateCoordinatorsRequest,
    UpdateCoordinatorsResponse
  > = this._requester("update_coordinators");

  /**
   * List all registered DNAs.
   */
  listDnas: Requester<ListDnasRequest, ListDnasResponse> =
    this._requester("list_dnas");

  /**
   * List all installed cell ids.
   */
  listCellIds: Requester<ListCellIdsRequest, ListCellIdsResponse> =
    this._requester("list_cell_ids");

  /**
   * List all installed apps.
   */
  listApps: Requester<ListAppsRequest, ListAppsResponse> = this._requester(
    "list_apps",
    listAppsTransform
  );

  /**
   * List all attached app interfaces.
   */
  listAppInterfaces: Requester<
    ListAppInterfacesRequest,
    ListAppInterfacesResponse
  > = this._requester("list_app_interfaces");

  /**
   * Request all available info about an agent.
   */
  agentInfo: Requester<AgentInfoRequest, AgentInfoResponse> =
    this._requester("agent_info");

  /**
   * Add an existing agent to Holochain.
   */
  addAgentInfo: Requester<AddAgentInfoRequest, AddAgentInfoResponse> =
    this._requester("add_agent_info");

  /**
   * Delete a disabled clone cell.
   */
  deleteCloneCell: Requester<DeleteCloneCellRequest, DeleteCloneCellResponse> =
    this._requester("delete_clone_cell");

  /**
   * Grant a zome call capability for an agent, to be used for signing zome
   * calls.
   */
  grantZomeCallCapability: Requester<
    GrantZomeCallCapabilityRequest,
    GrantZomeCallCapabilityResponse
  > = this._requester("grant_zome_call_capability");

  storageInfo: Requester<StorageInfoRequest, StorageInfoResponse> =
    this._requester("storage_info");

  dumpNetworkStats: Requester<
    DumpNetworkStatsRequest,
    DumpNetworkStatsResponse
  > = this._requester("dump_network_stats");

  // zome call signing related methods

  /**
   * Grant a capability for signing zome calls.
   *
   * @param cellId - The cell to grant the capability for.
   * @param functions - The zome functions to grant the capability for.
   * @param signingKey - The assignee of the capability.
   * @returns The cap secret of the created capability.
   */
  grantSigningKey = async (
    cellId: CellId,
    functions: GrantedFunctions,
    signingKey: AgentPubKey
  ): Promise<CapSecret> => {
    const capSecret = await randomCapSecret();
    await this.grantZomeCallCapability({
      cell_id: cellId,
      cap_grant: {
        tag: "zome-call-signing-key",
        functions,
        access: {
          Assigned: {
            secret: capSecret,
            assignees: [signingKey],
          },
        },
      },
    });
    return capSecret;
  };

  /**
   * Generate and authorize a new key pair for signing zome calls.
   *
   * @param cellId - The cell id to create the capability grant for.
   * @param functions - Zomes and functions to authorize the signing key for
   * (optional). When no functions are specified, the capability will be
   * granted for all zomes and functions.
   */
  authorizeSigningCredentials = async (
    cellId: CellId,
    functions?: GrantedFunctions
  ) => {
    const [keyPair, signingKey] = await generateSigningKeyPair();
    const capSecret = await this.grantSigningKey(
      cellId,
      functions || { [GrantedFunctionsType.All]: null },
      signingKey
    );
    setSigningCredentials(cellId, { capSecret, keyPair, signingKey });
  };
}

interface InternalListAppsRequest {
  status_filter?:
    | { Running: null }
    | { Enabled: null }
    | { Paused: null }
    | { Disabled: null }
    | { Stopped: null };
}

const listAppsTransform: Transformer<
  ListAppsRequest,
  InternalListAppsRequest,
  ListAppsResponse,
  ListAppsResponse
> = {
  input: (req) => {
    const args: InternalListAppsRequest = {};

    if (req.status_filter) {
      args.status_filter = getAppStatusInApiForm(req.status_filter);
    }

    return args;
  },
  output: (res) => res,
};

const dumpStateTransform: Transformer<
  DumpStateRequest,
  DumpStateRequest,
  string,
  DumpStateResponse
> = {
  input: (req) => req,
  output: (res: string): DumpStateResponse => {
    return JSON.parse(res);
  },
};

function getAppStatusInApiForm(status_filter: AppStatusFilter) {
  switch (status_filter) {
    case AppStatusFilter.Running:
      return {
        Running: null,
      };
    case AppStatusFilter.Enabled:
      return {
        Enabled: null,
      };
    case AppStatusFilter.Paused:
      return {
        Paused: null,
      };
    case AppStatusFilter.Disabled:
      return {
        Disabled: null,
      };
    case AppStatusFilter.Stopped:
      return {
        Stopped: null,
      };
  }
}
