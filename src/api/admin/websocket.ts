import { getLauncherEnvironment } from "../../environments/launcher.js";
import {
  CapSecret,
  GrantedFunctions,
  GrantedFunctionsType,
} from "../../hdk/index.js";
import type { AgentPubKey, CellId } from "../../types.js";
import { WsClient } from "../client.js";
import {
  DEFAULT_TIMEOUT,
  HolochainError,
  Requester,
  Transformer,
  WebsocketConnectionOptions,
  catchError,
  promiseTimeout,
  requesterTransformer,
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
  GetCompatibleCellsRequest,
  GetCompatibleCellsResponse,
  GetDnaDefinitionRequest,
  GetDnaDefinitionResponse,
  GrantZomeCallCapabilityRequest,
  GrantZomeCallCapabilityResponse,
  InstallAppRequest,
  InstallAppResponse,
  IssueAppAuthenticationTokenRequest,
  IssueAppAuthenticationTokenResponse,
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
      options.url = new URL(`ws://localhost:${env.ADMIN_INTERFACE_PORT}`);
    }

    if (!options.url) {
      throw new HolochainError(
        "ConnectionUrlMissing",
        `unable to connect to Conductor API - no url provided and not in a launcher environment.`
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

  /// Find installed cells which use a DNA that's forward-compatible with the given DNA hash.
  /// Namely, this finds cells with DNAs whose manifest lists the given DNA hash in its `lineage` field.
  getCompatibleCells: Requester<
    GetCompatibleCellsRequest,
    GetCompatibleCellsResponse
  > = this._requester("get_compatible_cells");

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
  listApps: Requester<ListAppsRequest, ListAppsResponse> =
    this._requester("list_apps");

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

  issueAppAuthenticationToken: Requester<
    IssueAppAuthenticationTokenRequest,
    IssueAppAuthenticationTokenResponse
  > = this._requester("issue_app_authentication_token");

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
      functions || GrantedFunctionsType.All,
      signingKey
    );
    setSigningCredentials(cellId, { capSecret, keyPair, signingKey });
  };
}

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
