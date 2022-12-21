import { decode } from "@msgpack/msgpack";
import Emittery from "emittery";
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
import { getSigningCredentials, signZomeCall } from "../zome-call-signing.js";
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
  client: WsClient;
  defaultTimeout: number;
  overrideInstalledAppId?: InstalledAppId;

  constructor(
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

export type Nonce256Bit = Uint8Array;

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
  input: async (req) => {
    if ("signature" in req) {
      return req;
    }
    if (isLauncher) {
      const signedZomeCall = await signZomeCallTauri(req);
      return signedZomeCall;
    } else {
      const signingCredentials = getSigningCredentials(req.cell_id);
      if (!signingCredentials) {
        throw new Error(
          "cannot sign zome call: no signing credentials have been authorized"
        );
      }
      const signedZomeCall = await signZomeCall(
        signingCredentials,
        req.payload
      );
      return signedZomeCall;
    }
  },
  output: (res) => decode(res),
};

const appInfoTransform = (
  appWs: AppWebsocket
): Transformer<
  AppInfoRequest,
  AppInfoRequest,
  AppInfoResponse,
  AppInfoResponse
> => ({
  input: (req) => {
    if (appWs.overrideInstalledAppId) {
      return {
        installed_app_id: appWs.overrideInstalledAppId,
      };
    }
    return req;
  },
  output: (res) => res,
});
