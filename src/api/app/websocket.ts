import { hashZomeCall } from "@holochain/serialization";
import { decode, encode } from "@msgpack/msgpack";
import _sodium from "libsodium-wrappers";
import Emittery from "emittery";
import {
  getLauncherEnvironment,
  signZomeCallTauri,
  signZomeCallElectron,
  getHostZomeCallSigner,
} from "../../environments/launcher.js";
import { CapSecret } from "../../hdk";
import { InstalledAppId } from "../../types.js";
import { encodeHashToBase64 } from "../../utils";
import { WsClient } from "../client.js";
import {
  WebsocketConnectionOptions,
  DEFAULT_TIMEOUT,
  Requester,
  Transformer,
  catchError,
  promiseTimeout,
  requesterTransformer,
  HolochainError,
  RequesterNoArg,
} from "../common.js";
import {
  Nonce256Bit,
  getNonceExpiration,
  getSigningCredentials,
  randomNonce,
} from "../zome-call-signing.js";
import {
  AppApi,
  AppInfoResponse,
  CallZomeRequest,
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
} from "./types.js";
import { AppAuthenticationToken } from "../admin";

/**
 * A class to establish a websocket connection to an App interface of a
 * Holochain conductor.
 *
 * @public
 */
export class AppWebsocket extends Emittery implements AppApi {
  readonly client: WsClient;
  defaultTimeout: number;
  overrideInstalledAppId?: InstalledAppId;

  private constructor(
    client: WsClient,
    defaultTimeout?: number,
    overrideInstalledAppId?: InstalledAppId
  ) {
    super();
    // Ensure all super methods are bound to this instance because Emittery relies on `this` being the instance.
    // Please retain until the upstream is fixed https://github.com/sindresorhus/emittery/issues/86.
    Object.getOwnPropertyNames(Emittery.prototype).forEach((name) => {
      const to_bind = (this as unknown as { [key: string]: unknown })[name];
      if (typeof to_bind === "function") {
        (this as unknown as { [key: string]: unknown })[name] =
          to_bind.bind(this);
      }
    });

    this.client = client;
    this.defaultTimeout =
      defaultTimeout === undefined ? DEFAULT_TIMEOUT : defaultTimeout;
    this.overrideInstalledAppId = overrideInstalledAppId;
  }

  /**
   * Instance factory for creating AppWebsockets.
   *
   * @param token - A token to authenticate the websocket connection. Get a token using {@link AdminApi#issueAppAuthenticationToken}.
   * @param options - {@link (WebsocketConnectionOptions:interface)}
   * @returns A new instance of an AppWebsocket.
   */
  static async connect(
    token: AppAuthenticationToken,
    options: WebsocketConnectionOptions = {}
  ) {
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

    const wsClient = await WsClient.connect(
      options.url,
      options.wsClientOptions
    );

    const appWebsocket = new AppWebsocket(
      wsClient,
      options.defaultTimeout,
      env?.INSTALLED_APP_ID
    );
    await appWebsocket.client.authenticate({ token });

    wsClient.on("signal", (signal) => appWebsocket.emit("signal", signal));

    return appWebsocket;
  }

  private requester<ReqI, ReqO, ResI, ResO>(
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

  private appInfoRequester: Requester<null, AppInfoResponse> =
    this.requester("app_info");

  /**
   * Request the app's info, including all cell infos.
   *
   * @returns The app's {@link AppInfo}.
   */
  appInfo: RequesterNoArg<AppInfoResponse> = (
    timeout?: number
  ): Promise<AppInfoResponse> => this.appInfoRequester(null, timeout);

  /**
   * Call a zome.
   *
   * @param request - The zome call arguments.
   * @param timeout - A timeout to override the default.
   * @returns The zome call's response.
   */
  callZome: Requester<
    CallZomeRequest | CallZomeRequestSigned,
    CallZomeResponse
  > = this.requester("call_zome", callZomeTransform);

  /**
   * Clone an existing provisioned cell.
   *
   * @param args - Specify the cell to clone.
   * @returns The created clone cell.
   */
  createCloneCell: Requester<CreateCloneCellRequest, CreateCloneCellResponse> =
    this.requester("create_clone_cell");

  /**
   * Enable a disabled clone cell.
   *
   * @param args - Specify the clone cell to enable.
   * @returns The enabled clone cell.
   */
  enableCloneCell: Requester<EnableCloneCellRequest, EnableCloneCellResponse> =
    this.requester("enable_clone_cell");

  /**
   * Disable an enabled clone cell.
   *
   * @param args - Specify the clone cell to disable.
   */
  disableCloneCell: Requester<
    DisableCloneCellRequest,
    DisableCloneCellResponse
  > = this.requester("disable_clone_cell");

  /**
   * Request network info about gossip status.
   */
  networkInfo: Requester<NetworkInfoRequest, NetworkInfoResponse> =
    this.requester("network_info");
}

/**
 * @public
 */
export interface CallZomeRequestUnsigned extends CallZomeRequest {
  cap_secret: CapSecret | null;
  nonce: Nonce256Bit;
  expires_at: number;
}

/**
 * @public
 */
export interface CallZomeRequestSigned extends CallZomeRequestUnsigned {
  signature: Uint8Array;
}

const callZomeTransform: Transformer<
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
      const env = getLauncherEnvironment();
      if (!env) {
        return signZomeCall(request);
      }
      if (env.FRAMEWORK === "electron") {
        return signZomeCallElectron(request);
      }
      return signZomeCallTauri(request);
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
