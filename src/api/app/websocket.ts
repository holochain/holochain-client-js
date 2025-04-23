import { decode, encode } from "@msgpack/msgpack";
import Emittery, { UnsubscribeFunction } from "emittery";
import sha512 from "js-sha512";
import _sodium from "libsodium-wrappers";
import { omit } from "lodash-es";
import {
  getHostZomeCallSigner,
  getLauncherEnvironment,
} from "../../environments/launcher.js";
import { AgentPubKey, InstalledAppId, RoleName } from "../../types.js";
import { encodeHashToBase64 } from "../../utils/index.js";
import {
  AppInfo,
  CellType,
  // Required to TSDoc generation.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ClonedCell,
  DumpNetworkMetricsRequest,
  DumpNetworkMetricsResponse,
  DumpNetworkStatsRequest,
  DumpNetworkStatsResponse,
  MemproofMap,
} from "../admin/index.js";
import { WsClient } from "../client.js";
import {
  catchError,
  DEFAULT_TIMEOUT,
  getBaseRoleNameFromCloneId,
  HolochainError,
  isCloneId,
  promiseTimeout,
  Requester,
  requesterTransformer,
  Transformer,
} from "../common.js";
import {
  getNonceExpiration,
  getSigningCredentials,
  randomNonce,
} from "../zome-call-signing.js";
import {
  AbandonCountersigningSessionStateRequest,
  AbandonCountersigningSessionStateResponse,
  AppClient,
  AppEvents,
  AppInfoResponse,
  AppWebsocketConnectionOptions,
  CallZomeRequest,
  CallZomeRequestSigned,
  CallZomeResponse,
  CallZomeResponseGeneric,
  CallZomeTransform,
  CreateCloneCellRequest,
  CreateCloneCellResponse,
  DisableCloneCellRequest,
  DisableCloneCellResponse,
  EnableCloneCellRequest,
  EnableCloneCellResponse,
  EnableRequest,
  EnableResponse,
  GetCountersigningSessionStateRequest,
  GetCountersigningSessionStateResponse,
  ProvideMemproofsRequest,
  ProvideMemproofsResponse,
  PublishCountersigningSessionStateRequest,
  PublishCountersigningSessionStateResponse,
  RoleNameCallZomeRequest,
  Signal,
  SignalCb,
} from "./types.js";

/**
 * A class to establish a websocket connection to an App interface, for a
 * specific agent and app.
 *
 * @public
 */
export class AppWebsocket implements AppClient {
  readonly client: WsClient;
  readonly myPubKey: AgentPubKey;
  readonly installedAppId: InstalledAppId;
  private readonly defaultTimeout: number;
  private readonly emitter: Emittery<AppEvents>;
  private readonly callZomeTransform: Transformer<
    CallZomeRequest | CallZomeRequestSigned,
    Promise<CallZomeRequestSigned>,
    CallZomeResponseGeneric<Uint8Array>,
    CallZomeResponse
  >;

  cachedAppInfo?: AppInfo | null;

  private readonly appInfoRequester: Requester<null, AppInfoResponse>;
  private readonly callZomeRequester: Requester<
    CallZomeRequest | CallZomeRequestSigned,
    CallZomeResponse
  >;
  private readonly provideMemproofRequester: Requester<
    ProvideMemproofsRequest,
    ProvideMemproofsResponse
  >;
  private readonly enableAppRequester: Requester<EnableRequest, EnableResponse>;
  private readonly createCloneCellRequester: Requester<
    CreateCloneCellRequest,
    CreateCloneCellResponse
  >;
  private readonly enableCloneCellRequester: Requester<
    EnableCloneCellRequest,
    EnableCloneCellResponse
  >;
  private readonly disableCloneCellRequester: Requester<
    DisableCloneCellRequest,
    DisableCloneCellResponse
  >;
  private readonly dumpNetworkStatsRequester: Requester<
    DumpNetworkStatsRequest,
    DumpNetworkStatsResponse
  >;
  private readonly dumpNetworkMetricsRequester: Requester<
    DumpNetworkMetricsRequest,
    DumpNetworkMetricsResponse
  >;
  private readonly getCountersigningSessionStateRequester: Requester<
    GetCountersigningSessionStateRequest,
    GetCountersigningSessionStateResponse
  >;
  private readonly abandonCountersigningSessionRequester: Requester<
    AbandonCountersigningSessionStateRequest,
    AbandonCountersigningSessionStateResponse
  >;
  private readonly publishCountersigningSessionRequester: Requester<
    PublishCountersigningSessionStateRequest,
    PublishCountersigningSessionStateResponse
  >;

  private constructor(
    client: WsClient,
    appInfo: AppInfo,
    callZomeTransform?: CallZomeTransform,
    defaultTimeout?: number
  ) {
    this.client = client;
    this.myPubKey = appInfo.agent_pub_key;
    this.installedAppId = appInfo.installed_app_id;
    this.defaultTimeout = defaultTimeout ?? DEFAULT_TIMEOUT;
    this.callZomeTransform = callZomeTransform ?? defaultCallZomeTransform;
    this.emitter = new Emittery<AppEvents>();
    this.cachedAppInfo = appInfo;

    this.appInfoRequester = AppWebsocket.requester(
      this.client,
      "app_info",
      this.defaultTimeout
    );
    this.callZomeRequester = AppWebsocket.requester(
      this.client,
      "call_zome",
      this.defaultTimeout,
      this.callZomeTransform
    );
    this.provideMemproofRequester = AppWebsocket.requester(
      this.client,
      "provide_memproofs",
      this.defaultTimeout
    );
    this.enableAppRequester = AppWebsocket.requester(
      this.client,
      "enable_app",
      this.defaultTimeout
    );
    this.createCloneCellRequester = AppWebsocket.requester(
      this.client,
      "create_clone_cell",
      this.defaultTimeout
    );
    this.enableCloneCellRequester = AppWebsocket.requester(
      this.client,
      "enable_clone_cell",
      this.defaultTimeout
    );
    this.disableCloneCellRequester = AppWebsocket.requester(
      this.client,
      "disable_clone_cell",
      this.defaultTimeout
    );
    this.dumpNetworkStatsRequester = AppWebsocket.requester(
      this.client,
      "dump_network_stats",
      this.defaultTimeout
    );
    this.dumpNetworkMetricsRequester = AppWebsocket.requester(
      this.client,
      "dump_network_metrics",
      this.defaultTimeout
    );
    this.getCountersigningSessionStateRequester = AppWebsocket.requester(
      this.client,
      "get_countersigning_session_state",
      this.defaultTimeout
    );
    this.abandonCountersigningSessionRequester = AppWebsocket.requester(
      this.client,
      "abandon_countersigning_session",
      this.defaultTimeout
    );
    this.publishCountersigningSessionRequester = AppWebsocket.requester(
      this.client,
      "publish_countersigning_session",
      this.defaultTimeout
    );

    // Ensure all super methods are bound to this instance because Emittery relies on `this` being the instance.
    // Please retain until the upstream is fixed https://github.com/sindresorhus/emittery/issues/86.
    Object.getOwnPropertyNames(Emittery.prototype).forEach((name) => {
      const to_bind = (this.emitter as unknown as { [key: string]: unknown })[
        name
      ];
      if (typeof to_bind === "function") {
        (this.emitter as unknown as { [key: string]: unknown })[name] =
          to_bind.bind(this.emitter);
      }
    });

    this.client.on("signal", (signal: Signal) => {
      this.emitter.emit("signal", signal).catch(console.error);
    });
  }

  /**
   * Instance factory for creating an {@link AppWebsocket}.
   *
   * @param token - A token to authenticate the websocket connection. Get a token using AdminWebsocket#issueAppAuthenticationToken.
   * @param options - {@link (WebsocketConnectionOptions:interface)}
   * @returns A new instance of an AppWebsocket.
   */
  static async connect(options: AppWebsocketConnectionOptions = {}) {
    // Check if we are in the launcher's environment, and if so, redirect the url to connect to
    const env = getLauncherEnvironment();

    if (env?.APP_INTERFACE_PORT) {
      options.url = new URL(`ws://localhost:${env.APP_INTERFACE_PORT}`);
    }

    if (!options.url) {
      throw new HolochainError(
        "ConnectionUrlMissing",
        `unable to connect to Conductor API - no url provided and not in a launcher environment.`
      );
    }

    const client = await WsClient.connect(options.url, options.wsClientOptions);

    const token = options.token ?? env?.APP_INTERFACE_TOKEN;

    if (!token)
      throw new HolochainError(
        "AppAuthenticationTokenMissing",
        `unable to connect to Conductor API - no app authentication token provided.`
      );

    await client.authenticate({ token });

    const appInfo = await (
      AppWebsocket.requester(client, "app_info", DEFAULT_TIMEOUT) as Requester<
        null,
        AppInfoResponse
      >
    )(null);
    if (!appInfo) {
      throw new HolochainError(
        "AppNotFound",
        `The app your connection token was issued for was not found. The app needs to be installed and enabled.`
      );
    }

    return new AppWebsocket(
      client,
      appInfo,
      options.callZomeTransform,
      options.defaultTimeout
    );
  }

  /**
   * Request the app's info, including all cell infos.
   *
   * @param timeout - A timeout to override the default.
   * @returns The app's {@link AppInfo}.
   */
  async appInfo(timeout?: number) {
    const appInfo = await this.appInfoRequester(null, timeout);
    if (!appInfo) {
      throw new HolochainError(
        "AppNotFound",
        `App info not found. App needs to be installed and enabled.`
      );
    }

    this.cachedAppInfo = appInfo;
    return appInfo;
  }

  /**
   * Request network stats.
   *
   * @returns The conductor's {@link TransportStats}.
   */
  async dumpNetworkStats(timeout?: number): Promise<DumpNetworkStatsResponse> {
    return await this.dumpNetworkStatsRequester(undefined, timeout);
  }

  /**
   * Request network metrics.
   *
   * @returns The {@link NetworkMetrics}.
   */
  async dumpNetworkMetrics(
    req: DumpNetworkMetricsRequest,
    timeout?: number
  ): Promise<DumpNetworkMetricsResponse> {
    return await this.dumpNetworkMetricsRequester(req, timeout);
  }

  /**
   * Provide membrane proofs for the app.
   *
   * @param memproofs - A map of {@link MembraneProof}s.
   */
  async provideMemproofs(memproofs: MemproofMap) {
    await this.provideMemproofRequester(memproofs);
  }

  /**
   * Enable an app only if the app is in the `AppStatus::Disabled(DisabledAppReason::NotStartedAfterProvidingMemproofs)`
   * state. Attempting to enable the app from other states (other than Running) will fail.
   */
  async enableApp() {
    await this.enableAppRequester();
  }

  /**
   * Get a cell id by its role name or clone id.
   *
   * @param roleName - The role name or clone id of the cell.
   * @param appInfo - The app info containing all cell infos.
   * @returns The cell id or throws an error if not found.
   */
  getCellIdFromRoleName(roleName: RoleName, appInfo: AppInfo) {
    if (isCloneId(roleName)) {
      const baseRoleName = getBaseRoleNameFromCloneId(roleName);
      if (!(baseRoleName in appInfo.cell_info)) {
        throw new HolochainError(
          "NoCellForRoleName",
          `no cell found with role_name ${roleName}`
        );
      }
      const cloneCell = appInfo.cell_info[baseRoleName].find(
        (c) => c.type === CellType.Cloned && c.value.clone_id === roleName
      );
      if (!cloneCell || cloneCell.type !== CellType.Cloned) {
        throw new HolochainError(
          "NoCellForCloneId",
          `no clone cell found with clone id ${roleName}`
        );
      }
      return cloneCell.value.cell_id;
    }

    if (!(roleName in appInfo.cell_info)) {
      throw new HolochainError(
        "NoCellForRoleName",
        `no cell found with role_name ${roleName}`
      );
    }
    const cell = appInfo.cell_info[roleName].find(
      (c) => c.type === CellType.Provisioned
    );
    if (!cell || cell.type !== CellType.Provisioned) {
      throw new HolochainError(
        "NoProvisionedCellForRoleName",
        `no provisioned cell found with role_name ${roleName}`
      );
    }
    return cell.value.cell_id;
  }

  /**
   * Call a zome.
   *
   * @param request - The zome call arguments.
   * @param timeout - A timeout to override the default.
   * @returns The zome call's response.
   */
  async callZome<ReturnType>(
    request: CallZomeRequest | RoleNameCallZomeRequest,
    timeout?: number
  ): Promise<ReturnType> {
    if (!("provenance" in request)) {
      request = {
        ...request,
        provenance: this.myPubKey,
      };
    }
    if ("role_name" in request && request.role_name) {
      const appInfo = this.cachedAppInfo || (await this.appInfo());
      const cell_id = this.getCellIdFromRoleName(request.role_name, appInfo);
      request = {
        ...omit(request, "role_name"),
        // Some problem here with the launcher with just the `cell_id`.
        cell_id: [cell_id[0], cell_id[1]],
      };
    } else if (!("cell_id" in request)) {
      throw new HolochainError(
        "MissingRoleNameOrCellId",
        "callZome requires a role_name or cell_id argument"
      );
    }
    return this.callZomeRequester(request, timeout);
  }

  /**
   * Clone an existing provisioned cell.
   *
   * @param args - Specify the cell to clone.
   * @returns The created clone cell.
   */
  async createCloneCell(args: CreateCloneCellRequest) {
    const clonedCell = this.createCloneCellRequester({
      ...args,
    });

    this.cachedAppInfo = undefined;

    return clonedCell;
  }

  /**
   * Enable a disabled clone cell.
   *
   * @param args - Specify the clone cell to enable.
   * @returns The enabled clone cell.
   */
  async enableCloneCell(args: EnableCloneCellRequest) {
    return this.enableCloneCellRequester({
      ...args,
    });
  }

  /**
   * Disable an enabled clone cell.
   *
   * @param args - Specify the clone cell to disable.
   */
  async disableCloneCell(args: DisableCloneCellRequest) {
    return this.disableCloneCellRequester({
      ...args,
    });
  }

  /**
   * Get the state of a countersigning session.
   */
  async getCountersigningSessionState(
    args: GetCountersigningSessionStateRequest
  ) {
    return this.getCountersigningSessionStateRequester(args);
  }

  /**
   * Abandon an unresolved countersigning session.
   *
   * If the current session has not been resolved automatically, it can be forcefully abandoned.
   * A condition for this call to succeed is that at least one attempt has been made to resolve
   * it automatically.
   *
   * # Returns
   *
   * [`AppResponse::CountersigningSessionAbandoned`]
   *
   * The session is marked for abandoning and the countersigning workflow was triggered. The session
   * has not been abandoned yet.
   *
   * Upon successful abandoning the system signal [`SystemSignal::AbandonedCountersigning`] will
   * be emitted and the session removed from state, so that [`AppRequest::GetCountersigningSessionState`]
   * would return `None`.
   *
   * In the countersigning workflow it will first be attempted to resolve the session with incoming
   * signatures of the countersigned entries, before force-abandoning the session. In a very rare event
   * it could happen that in just the moment where the [`AppRequest::AbandonCountersigningSession`]
   * is made, signatures for this session come in. If they are valid, the session will be resolved and
   * published as usual. Should they be invalid, however, the flag to abandon the session is erased.
   * In such cases this request can be retried until the session has been abandoned successfully.
   *
   * # Errors
   *
   * [`CountersigningError::WorkspaceDoesNotExist`] likely indicates that an invalid cell id was
   * passed in to the call.
   *
   * [`CountersigningError::SessionNotFound`] when no ongoing session could be found for the provided
   * cell id.
   *
   * [`CountersigningError::SessionNotUnresolved`] when an attempt to resolve the session
   * automatically has not been made.
   */
  async abandonCountersigningSession(
    args: AbandonCountersigningSessionStateRequest
  ) {
    return this.abandonCountersigningSessionRequester(args);
  }

  /**
   * Publish an unresolved countersigning session.
   *
   * If the current session has not been resolved automatically, it can be forcefully published.
   * A condition for this call to succeed is that at least one attempt has been made to resolve
   * it automatically.
   *
   * # Returns
   *
   * [`AppResponse::PublishCountersigningSessionTriggered`]
   *
   * The session is marked for publishing and the countersigning workflow was triggered. The session
   * has not been published yet.
   *
   * Upon successful publishing the system signal [`SystemSignal::SuccessfulCountersigning`] will
   * be emitted and the session removed from state, so that [`AppRequest::GetCountersigningSessionState`]
   * would return `None`.
   *
   * In the countersigning workflow it will first be attempted to resolve the session with incoming
   * signatures of the countersigned entries, before force-publishing the session. In a very rare event
   * it could happen that in just the moment where the [`AppRequest::PublishCountersigningSession`]
   * is made, signatures for this session come in. If they are valid, the session will be resolved and
   * published as usual. Should they be invalid, however, the flag to publish the session is erased.
   * In such cases this request can be retried until the session has been published successfully.
   *
   * # Errors
   *
   * [`CountersigningError::WorkspaceDoesNotExist`] likely indicates that an invalid cell id was
   * passed in to the call.
   *
   * [`CountersigningError::SessionNotFound`] when no ongoing session could be found for the provided
   * cell id.
   *
   * [`CountersigningError::SessionNotUnresolved`] when an attempt to resolve the session
   * automatically has not been made.
   */
  async publishCountersigningSession(
    args: PublishCountersigningSessionStateRequest
  ) {
    return this.publishCountersigningSessionRequester(args);
  }

  /**
   * Register an event listener for signals.
   *
   * @param eventName - Event name to listen to (currently only "signal").
   * @param listener - The function to call when event is triggered.
   * @returns A function to unsubscribe the event listener.
   */
  on<Name extends keyof AppEvents>(
    eventName: Name | readonly Name[],
    listener: SignalCb
  ): UnsubscribeFunction {
    return this.emitter.on(eventName, listener);
  }

  private static requester<ReqI, ReqO, ResI, ResO>(
    client: WsClient,
    tag: string,
    defaultTimeout: number,
    transformer?: Transformer<ReqI, ReqO, ResI, ResO>
  ) {
    return requesterTransformer(
      (req, timeout) =>
        promiseTimeout(
          client.request(req),
          tag,
          timeout || defaultTimeout
        ).then(catchError),
      tag,
      transformer
    );
  }
}

const defaultCallZomeTransform: Transformer<
  // either an already signed zome call which is returned as is, or a zome call
  // payload to be signed
  CallZomeRequest | CallZomeRequestSigned,
  Promise<CallZomeRequestSigned>,
  CallZomeResponseGeneric<Uint8Array>,
  CallZomeResponse
> = {
  input: async (request) => {
    if ("signature" in request) {
      return request;
    }

    const hostSigner = getHostZomeCallSigner();
    if (hostSigner) {
      return hostSigner.signZomeCall(request);
    } else {
      return signZomeCall(request);
    }
  },
  output: (response) => decode(response),
};

/**
 * @public
 */
export const signZomeCall = async (request: CallZomeRequest) => {
  const signingCredentialsForCell = getSigningCredentials(request.cell_id);
  if (!signingCredentialsForCell) {
    throw new HolochainError(
      "NoSigningCredentialsForCell",
      `no signing credentials have been authorized for cell [${encodeHashToBase64(
        request.cell_id[0]
      )}, ${encodeHashToBase64(request.cell_id[1])}]`
    );
  }
  const zome_call_params: CallZomeRequest = {
    cap_secret: signingCredentialsForCell.capSecret,
    cell_id: request.cell_id,
    zome_name: request.zome_name,
    fn_name: request.fn_name,
    provenance: signingCredentialsForCell.signingKey,
    payload: encode(request.payload),
    nonce: await randomNonce(),
    expires_at: getNonceExpiration(),
  };
  const bytes = encode(zome_call_params);
  const bytesHash = new Uint8Array(sha512.array(bytes));
  await _sodium.ready;
  const sodium = _sodium;
  const signature = sodium
    .crypto_sign(bytesHash, signingCredentialsForCell.keyPair.privateKey)
    .subarray(0, sodium.crypto_sign_BYTES);

  const signedZomeCall: CallZomeRequestSigned = {
    bytes,
    signature,
  };
  return signedZomeCall;
};
