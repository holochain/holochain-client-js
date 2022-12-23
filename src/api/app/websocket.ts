import { hashZomeCall } from "@holochain/serialization";
import { decode, encode } from "@msgpack/msgpack";
import Emittery from "emittery";
import nacl from "tweetnacl";
import {
  getLauncherEnvironment,
  isLauncher,
  signZomeCallTauri,
} from "../../environments/launcher.js";
import { CapSecret } from "../../hdk/capabilities.js";
import { InstalledAppId } from "../../types.js";
import { WsClient } from "../client.js";
import {
  catchError,
  DEFAULT_TIMEOUT,
  promiseTimeout,
  Requester,
  requesterTransformer,
  Transformer,
} from "../common.js";
import {
  getNonceExpiration,
  getSigningCredentials,
  Nonce256Bit,
  randomNonce,
} from "../zome-call-signing.js";
import {
  AppApi,
  AppInfoRequest,
  AppInfoResponse,
  AppSignalCb,
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
    this.client = client;
    this.defaultTimeout =
      defaultTimeout === undefined ? DEFAULT_TIMEOUT : defaultTimeout;
    this.overrideInstalledAppId = overrideInstalledAppId;
  }

  static async connect(
    url: string,
    defaultTimeout?: number,
    signalCb?: AppSignalCb
  ): Promise<AppWebsocket> {
    // Check if we are in the launcher's environment, and if so, redirect the url to connect to
    const env = getLauncherEnvironment();

    if (env) {
      url = `ws://127.0.0.1:${env.APP_INTERFACE_PORT}`;
    }

    if (signalCb) {
      console.warn(
        "Providing a signal callback on client initialization is deprecated. Instead add an event handler using `.on('signal', signalCb)`."
      );
    }
    const wsClient = await WsClient.connect(url, signalCb);

    const appWebsocket = new AppWebsocket(
      wsClient,
      defaultTimeout,
      env ? env.INSTALLED_APP_ID : undefined
    );

    wsClient.on("signal", (signal) => appWebsocket.emit("signal", signal));

    return appWebsocket;
  }

  _requester = <ReqI, ReqO, ResI, ResO>(
    tag: string,
    transformer?: Transformer<ReqI, ReqO, ResI, ResO>
  ) =>
    requesterTransformer(
      (req, timeout) =>
        promiseTimeout(
          this.client.request(req),
          tag,
          timeout || this.defaultTimeout
        ).then(catchError),
      tag,
      transformer
    );

  appInfo: Requester<AppInfoRequest, AppInfoResponse> = this._requester(
    "app_info",
    appInfoTransform(this)
  );

  callZome: Requester<
    CallZomeRequest | CallZomeRequestSigned,
    CallZomeResponse
  > = this._requester("call_zome", callZomeTransform);

  createCloneCell: Requester<CreateCloneCellRequest, CreateCloneCellResponse> =
    this._requester("create_clone_cell");

  enableCloneCell: Requester<EnableCloneCellRequest, EnableCloneCellResponse> =
    this._requester("enable_clone_cell");

  disableCloneCell: Requester<
    DisableCloneCellRequest,
    DisableCloneCellResponse
  > = this._requester("disable_clone_cell");

  networkInfo: Requester<NetworkInfoRequest, NetworkInfoResponse> =
    this._requester("network_info");
}

export interface CallZomeRequestUnsigned extends CallZomeRequest {
  cap_secret: CapSecret | null;
  nonce: Nonce256Bit;
  expires_at: number;
}

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
    const signedZomeCall = isLauncher
      ? await signZomeCallTauri(request)
      : await signZomeCall(request);
    return signedZomeCall;
  },
  output: (response) => decode(response),
};

const appInfoTransform = (
  appWs: AppWebsocket
): Transformer<
  AppInfoRequest,
  AppInfoRequest,
  AppInfoResponse,
  AppInfoResponse
> => ({
  input: (request) => {
    if (appWs.overrideInstalledAppId) {
      return {
        installed_app_id: appWs.overrideInstalledAppId,
      };
    }
    return request;
  },
  output: (response) => response,
});

export const signZomeCall = async (request: CallZomeRequest) => {
  const signingCredentialsForCell = getSigningCredentials(request.cell_id);
  if (!signingCredentialsForCell) {
    throw new Error(
      `cannot sign zome call: no signing credentials have been authorized for cell ${request.cell_id}`
    );
  }
  const unsignedZomeCallPayload: CallZomeRequestUnsigned = {
    cap_secret: signingCredentialsForCell.capSecret,
    cell_id: request.cell_id,
    zome_name: request.zome_name,
    fn_name: request.fn_name,
    provenance: signingCredentialsForCell.signingKey,
    payload: encode(request.payload),
    nonce: randomNonce(),
    expires_at: getNonceExpiration(),
  };
  const hashedZomeCall = await hashZomeCall(unsignedZomeCallPayload);
  const signature = nacl
    .sign(hashedZomeCall, signingCredentialsForCell.keyPair.secretKey)
    .subarray(0, nacl.sign.signatureLength);

  const signedZomeCall: CallZomeRequestSigned = {
    ...unsignedZomeCallPayload,
    signature,
  };
  return signedZomeCall;
};
