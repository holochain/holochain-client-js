import Emittery, { UnsubscribeFunction } from "emittery";
import { omit } from "lodash-es";
import { AgentPubKey, CellId, InstalledAppId, RoleName } from "../../types.js";
import {
  AppAuthenticationToken,
  AppInfo,
  CellType,
  MemproofMap,
} from "../admin/index.js";
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
  AppCallZomeRequest,
  AppClient,
  AppEvents,
  AppNetworkInfoRequest,
  AppCreateCloneCellRequest,
  AppDisableCloneCellRequest,
  AppEnableCloneCellRequest,
  AppInfoResponse,
  SignalCb,
  CallZomeRequest,
  CallZomeRequestSigned,
  CallZomeRequestUnsigned,
  CallZomeResponse,
  CallZomeResponseGeneric,
  CreateCloneCellRequest,
  CreateCloneCellResponse,
  DisableCloneCellRequest,
  DisableCloneCellResponse,
  EnableCloneCellRequest,
  EnableCloneCellResponse,
  NetworkInfoRequest,
  NetworkInfoResponse,
  AppWebsocketConnectionOptions,
  CallZomeTransform,
  ProvideMemproofsRequest,
  ProvideMemproofsResponse,
  EnableRequest,
  EnableResponse,
  Signal,
} from "./types.js";
import {
  getHostZomeCallSigner,
  getLauncherEnvironment,
} from "../../environments/launcher.js";
import { decode, encode } from "@msgpack/msgpack";
import {
  getNonceExpiration,
  getSigningCredentials,
  randomNonce,
} from "../zome-call-signing.js";
import { encodeHashToBase64 } from "../../utils/index.js";
import { hashZomeCall } from "@holochain/serialization";
import _sodium from "libsodium-wrappers";
import { WsClient } from "../client.js";

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
  private readonly appAuthenticationToken: AppAuthenticationToken;

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
  private readonly networkInfoRequester: Requester<
    NetworkInfoRequest,
    NetworkInfoResponse
  >;

  private constructor(
    client: WsClient,
    appInfo: AppInfo,
    token: AppAuthenticationToken,
    callZomeTransform?: CallZomeTransform,
    defaultTimeout?: number
  ) {
    this.client = client;
    this.myPubKey = appInfo.agent_pub_key;
    this.installedAppId = appInfo.installed_app_id;
    this.defaultTimeout = defaultTimeout ?? DEFAULT_TIMEOUT;
    this.callZomeTransform = callZomeTransform ?? defaultCallZomeTransform;
    this.appAuthenticationToken = token;
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
    this.networkInfoRequester = AppWebsocket.requester(
      this.client,
      "network_info",
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

    const token = options.token ? options.token : env?.APP_INTERFACE_TOKEN;

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
      token,
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
   * Provide membrane proofs for the app.
   *
   * @param memproofs - A map of {@link MembraneProof}s.
   */
  async provideMemproofs(memproofs: MemproofMap) {
    await this.provideMemproofRequester(memproofs);
  }

  /**
   * Enablie an app only if the app is in the `AppStatus::Disabled(DisabledAppReason::NotStartedAfterProvidingMemproofs)`
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
        (c) => CellType.Cloned in c && c[CellType.Cloned].clone_id === roleName
      );
      if (!cloneCell || !(CellType.Cloned in cloneCell)) {
        throw new HolochainError(
          "NoCellForCloneId",
          `no clone cell found with clone id ${roleName}`
        );
      }
      return cloneCell[CellType.Cloned].cell_id;
    }

    if (!(roleName in appInfo.cell_info)) {
      throw new HolochainError(
        "NoCellForRoleName",
        `no cell found with role_name ${roleName}`
      );
    }
    const cell = appInfo.cell_info[roleName].find(
      (c) => CellType.Provisioned in c
    );
    if (!cell || !(CellType.Provisioned in cell)) {
      throw new HolochainError(
        "NoProvisionedCellForRoleName",
        `no provisioned cell found with role_name ${roleName}`
      );
    }
    return cell[CellType.Provisioned].cell_id;
  }

  /**
   * Call a zome.
   *
   * @param request - The zome call arguments.
   * @param timeout - A timeout to override the default.
   * @returns The zome call's response.
   */
  async callZome(
    request: AppCallZomeRequest,
    timeout?: number
  ): Promise<CallZomeResponse> {
    if (!("provenance" in request)) {
      request = {
        ...request,
        provenance: this.myPubKey,
      };
    }
    if ("role_name" in request && request.role_name) {
      const appInfo = this.cachedAppInfo || (await this.appInfo());
      const cell_id = this.getCellIdFromRoleName(request.role_name, appInfo);
      const zomeCallPayload: CallZomeRequest = {
        ...omit(request, "role_name"),
        provenance: this.myPubKey,
        cell_id: [cell_id[0], cell_id[1]],
      };
      return this.callZomeRequester(zomeCallPayload, timeout);
    } else if ("cell_id" in request && request.cell_id) {
      return this.callZomeRequester(request as CallZomeRequest, timeout);
    }
    throw new HolochainError(
      "MissingRoleNameOrCellId",
      "callZome requires a role_name or cell_id argument"
    );
  }

  /**
   * Clone an existing provisioned cell.
   *
   * @param args - Specify the cell to clone.
   * @returns The created clone cell.
   */
  async createCloneCell(
    args: AppCreateCloneCellRequest
  ): Promise<CreateCloneCellResponse> {
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
  async enableCloneCell(
    args: AppEnableCloneCellRequest
  ): Promise<EnableCloneCellResponse> {
    return this.enableCloneCellRequester({
      ...args,
    });
  }

  /**
   * Disable an enabled clone cell.
   *
   * @param args - Specify the clone cell to disable.
   */
  async disableCloneCell(
    args: AppDisableCloneCellRequest
  ): Promise<DisableCloneCellResponse> {
    return this.disableCloneCellRequester({
      ...args,
    });
  }

  /**
   * Request network info about gossip status.
   *  @param args - Specify the DNAs for which you want network info
   *  @returns Network info for the specified DNAs
   */
  async networkInfo(args: AppNetworkInfoRequest): Promise<NetworkInfoResponse> {
    return this.networkInfoRequester({
      ...args,
      agent_pub_key: this.myPubKey,
    });
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

  private containsCell(cellId: CellId) {
    const appInfo = this.cachedAppInfo;
    if (!appInfo) {
      return false;
    }
    for (const roleName of Object.keys(appInfo.cell_info)) {
      for (const cellInfo of appInfo.cell_info[roleName]) {
        const currentCellId =
          CellType.Provisioned in cellInfo
            ? cellInfo[CellType.Provisioned].cell_id
            : CellType.Cloned in cellInfo
            ? cellInfo[CellType.Cloned].cell_id
            : undefined;
        if (currentCellId && isSameCell(currentCellId, cellId)) {
          return true;
        }
      }
    }
    return false;
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

const isSameCell = (cellId1: CellId, cellId2: CellId) =>
  cellId1[0].every((byte, index) => byte === cellId2[0][index]) &&
  cellId1[1].every((byte, index) => byte === cellId2[1][index]);

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
  const unsignedZomeCallPayload: CallZomeRequestUnsigned = {
    cap_secret: signingCredentialsForCell.capSecret,
    cell_id: request.cell_id,
    zome_name: request.zome_name,
    fn_name: request.fn_name,
    provenance: signingCredentialsForCell.signingKey,
    payload: encode(request.payload),
    nonce: await randomNonce(),
    expires_at: getNonceExpiration(),
  };
  const hashedZomeCall = await hashZomeCall(unsignedZomeCallPayload);
  await _sodium.ready;
  const sodium = _sodium;
  const signature = sodium
    .crypto_sign(hashedZomeCall, signingCredentialsForCell.keyPair.privateKey)
    .subarray(0, sodium.crypto_sign_BYTES);

  const signedZomeCall: CallZomeRequestSigned = {
    ...unsignedZomeCallPayload,
    signature,
  };
  return signedZomeCall;
};
