import { getLauncherEnvironment } from "../../environments/launcher.js";
import { CapSecret, GrantedFunctions } from "../../hdk/index.js";
import type {
  ActionHash,
  AgentPubKey,
  CellId,
  DnaHash,
} from "../../generated/types.js";
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
import type { AppInfo } from "../../generated/api/app/types.js";
import {
  AdminApi,
  AdminRequestPayload,
  AdminResponsePayload,
  StateDump,
} from "./client-types.js";
import type {
  AdminRequest,
  AppAuthenticationTokenIssued,
  AppCapGrantInfo,
  AppInterfaceInfo,
  DeleteCloneCellPayload,
  DnaDef,
  FullStateDump,
  GrantZomeCallCapabilityPayload,
  HolochainTransportStats,
  InstallAppPayload,
  IssueAppAuthenticationTokenPayload,
  NetworkMetricsMap,
  PeerMetaInfoMap,
  StorageInfo,
  UpdateCoordinatorsPayload,
} from "../../generated/api/admin/types.js";

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
    options: WebsocketConnectionOptions = {},
  ): Promise<AdminWebsocket> {
    // Check if we are in the launcher's environment, and if so, redirect the url to connect to
    const env = getLauncherEnvironment();

    if (env?.ADMIN_INTERFACE_PORT) {
      options.url = new URL(`ws://localhost:${env.ADMIN_INTERFACE_PORT}`);
    }

    if (!options.url) {
      throw new HolochainError(
        "ConnectionUrlMissing",
        `unable to connect to Conductor API - no url provided and not in a launcher environment.`,
      );
    }

    const wsClient = await WsClient.connect(
      options.url,
      options.wsClientOptions,
    );
    return new AdminWebsocket(wsClient, options.defaultTimeout);
  }

  _requester<ReqI, ReqO, ResI, ResO>(
    tag: AdminRequest["type"],
    transformer?: Transformer<ReqI, ReqO, ResI, ResO>,
  ): Requester<ReqI, ResO> {
    return requesterTransformer(
      (req, timeout) =>
        promiseTimeout(
          this.client.request(req),
          tag,
          timeout || this.defaultTimeout,
        ).then(catchError),
      tag,
      transformer,
    );
  }

  /**
   * Send a request to open the given port for {@link AppWebsocket} connections.
   */
  attachAppInterface: Requester<
    AdminRequestPayload<"attach_app_interface">,
    AdminResponsePayload<"app_interface_attached">
  > = this._requester("attach_app_interface");

  /**
   * Enable a stopped app.
   */
  enableApp: Requester<AdminRequestPayload<"enable_app">, AppInfo> =
    this._requester("enable_app");

  /**
   * Disable a running app.
   */
  disableApp: Requester<AdminRequestPayload<"disable_app">, void> =
    this._requester("disable_app");

  /**
   * Dump the state of the specified cell, including its source chain, as JSON.
   *
   * The conductor answers with a JSON string holding a two-element array, so
   * the resolved value is a {@link StateDump} tuple of the structured dump and
   * a human-readable summary of it.
   *
   * Because this payload is JSON rather than msgpack, byte fields nested in the
   * dump (hashes, signatures, entry bytes) arrive as plain `number[]` at
   * runtime, even where the generated types declare `Uint8Array`. See
   * {@link StateDump}.
   */
  dumpState: Requester<AdminRequestPayload<"dump_state">, StateDump> =
    this._requester("dump_state", dumpStateTransform);

  /**
   * Dump the full state of the specified cell, including its chain and DHT
   * shard, as JSON.
   */
  dumpFullState: Requester<
    AdminRequestPayload<"dump_full_state">,
    FullStateDump
  > = this._requester("dump_full_state");

  /**
   * Generate a new agent pub key.
   */
  generateAgentPubKey: Requester<void, AgentPubKey> = this._requester(
    "generate_agent_pub_key",
  );

  /**
   * Get the DNA definition for the specified DNA hash.
   */
  getDnaDefinition: Requester<CellId, DnaDef> =
    this._requester("get_dna_definition");

  /**
   * Uninstall the specified app from Holochain.
   */
  uninstallApp: Requester<AdminRequestPayload<"uninstall_app">, void> =
    this._requester("uninstall_app");

  /**
   * Install the specified app into Holochain.
   */
  installApp: Requester<InstallAppPayload, AppInfo> =
    this._requester("install_app");

  /**
   * Update coordinators for an installed app.
   */
  updateCoordinators: Requester<UpdateCoordinatorsPayload, void> =
    this._requester("update_coordinators");

  /**
   * List all registered DNAs.
   */
  listDnas: Requester<void, Array<DnaHash>> = this._requester("list_dnas");

  /**
   * List all installed cell ids.
   */
  listCellIds: Requester<void, Array<CellId>> =
    this._requester("list_cell_ids");

  /**
   * List all installed apps.
   */
  listApps: Requester<AdminRequestPayload<"list_apps">, Array<AppInfo>> =
    this._requester("list_apps");

  /**
   * List all attached app interfaces.
   */
  listAppInterfaces: Requester<void, Array<AppInterfaceInfo>> = this._requester(
    "list_app_interfaces",
  );

  /**
   * Request all available info about an agent.
   */
  agentInfo: Requester<AdminRequestPayload<"agent_info">, Array<string>> =
    this._requester("agent_info");

  /**
   * Add an existing agent to Holochain.
   */
  addAgentInfo: Requester<AdminRequestPayload<"add_agent_info">, void> =
    this._requester("add_agent_info");

  /**
   * Request peer meta info for a peer.
   */
  peerMetaInfo: Requester<
    AdminRequestPayload<"peer_meta_info">,
    PeerMetaInfoMap
  > = this._requester("peer_meta_info");

  /**
   * Delete a disabled clone cell.
   */
  deleteCloneCell: Requester<DeleteCloneCellPayload, void> =
    this._requester("delete_clone_cell");

  /**
   * Grant a zome call capability for an agent, to be used for signing zome
   * calls.
   */
  grantZomeCallCapability: Requester<
    GrantZomeCallCapabilityPayload,
    ActionHash
  > = this._requester("grant_zome_call_capability");

  /**
   * Revoke a zome call capability for an agent, which was previously granted
   * using {@link AdminWebsocket.grantZomeCallCapability}.
   */
  revokeZomeCallCapability: Requester<
    AdminRequestPayload<"revoke_zome_call_capability">,
    void
  > = this._requester("revoke_zome_call_capability");

  /**
   * List all capability grants for all cells.
   */
  listCapabilityGrants: Requester<
    AdminRequestPayload<"list_capability_grants">,
    AppCapGrantInfo
  > = this._requester("list_capability_grants");

  storageInfo: Requester<void, StorageInfo> = this._requester("storage_info");

  issueAppAuthenticationToken: Requester<
    IssueAppAuthenticationTokenPayload,
    AppAuthenticationTokenIssued
  > = this._requester("issue_app_authentication_token");

  dumpNetworkStats: Requester<void, HolochainTransportStats> =
    this._requester("dump_network_stats");

  dumpNetworkMetrics: Requester<
    AdminRequestPayload<"dump_network_metrics">,
    NetworkMetricsMap
  > = this._requester("dump_network_metrics");

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
    signingKey: AgentPubKey,
  ): Promise<CapSecret> => {
    const capSecret = await randomCapSecret();
    await this.grantZomeCallCapability({
      cell_id: cellId,
      cap_grant: {
        tag: "zome-call-signing-key",
        functions,
        access: {
          type: "assigned",
          value: {
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
    functions?: GrantedFunctions,
  ): Promise<void> => {
    const [keyPair, signingKey] = await generateSigningKeyPair();
    const capSecret = await this.grantSigningKey(
      cellId,
      functions || { type: "all" },
      signingKey,
    );
    setSigningCredentials(cellId, { capSecret, keyPair, signingKey });
  };
}

const dumpStateTransform: Transformer<
  AdminRequestPayload<"dump_state">,
  AdminRequestPayload<"dump_state">,
  string,
  StateDump
> = {
  input: (req): AdminRequestPayload<"dump_state"> => req,
  // The conductor serializes a `(JsonDump, String)` pair, which `serde_json`
  // renders as a two-element array of the dump and its summary.
  output: (res: string): StateDump => JSON.parse(res),
};
