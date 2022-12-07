/**
 * Defines AppWebsocket, an easy-to-use websocket implementation of the
 * Conductor API for apps
 *
 *    const client = AppWebsocket.connect(
 *      'ws://localhost:9000',
 *      signal => console.log('got a signal:', signal)
 *    )
 *
 *    client.callZome({...})  // TODO: show what's in here
 *      .then(() => {
 *        console.log('DNA successfully installed')
 *      })
 *      .catch(err => {
 *        console.error('problem installing DNA:', err)
 *      })
 */
import { decode } from "@msgpack/msgpack";
import { invoke } from "@tauri-apps/api/tauri";
import { EventEmitter } from "events";
import {
  getLauncherEnvironment,
  isLauncher,
} from "../../environments/launcher.js";
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
  AppApi,
  AppInfoRequest,
  AppInfoResponse,
  AppSignalCb,
  ArchiveCloneCellRequest,
  ArchiveCloneCellResponse,
  CallZomeRequest,
  CallZomeResponse,
  CallZomeResponseGeneric,
  CreateCloneCellRequest,
  CreateCloneCellResponse,
  GossipInfoRequest,
  GossipInfoResponse,
} from "./types.js";
import { getNonceExpiration, randomNonce } from "./util.js";

export class AppWebsocket extends EventEmitter implements AppApi {
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
    const env = await getLauncherEnvironment();

    if (env) {
      url = `ws://localhost:${env.APP_INTERFACE_PORT}`;
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

  callZome: Requester<CallZomeRequest, CallZomeResponse> = this._requester(
    "zome_call",
    callZomeTransform
  );

  createCloneCell: Requester<CreateCloneCellRequest, CreateCloneCellResponse> =
    this._requester("create_clone_cell");

  archiveCloneCell: Requester<
    ArchiveCloneCellRequest,
    ArchiveCloneCellResponse
  > = this._requester("archive_clone_cell");

  gossipInfo: Requester<GossipInfoRequest, GossipInfoResponse> =
    this._requester("gossip_info");
}

export type Nonce256Bit = Uint8Array;

export interface CallZomeRequestUnsigned extends CallZomeRequest {
  nonce: Nonce256Bit;
  expires_at: number;
}

export interface CallZomeRequestSigned extends CallZomeRequestUnsigned {
  signature: Uint8Array;
}

type TauriByteArray = number[]; // Tauri requires a number array instead of a Uint8Array
interface CallZomeRequestUnsignedTauri
  extends Omit<
    CallZomeRequestUnsigned,
    "cap_secret" | "cell_id" | "provenance" | "nonce"
  > {
  cell_id: [TauriByteArray, TauriByteArray];
  provenance: TauriByteArray;
  nonce: TauriByteArray;
  expires_at: number;
}

const callZomeTransform: Transformer<
  CallZomeRequest,
  Promise<CallZomeRequestSigned>,
  CallZomeResponseGeneric<Uint8Array>,
  CallZomeResponse
> = {
  input: async (req) => {
    if (isLauncher) {
      const zomeCallUnsigned: CallZomeRequestUnsignedTauri = {
        provenance: Array.from(req.provenance),
        cell_id: [Array.from(req.cell_id[0]), Array.from(req.cell_id[1])],
        zome_name: req.zome_name,
        fn_name: req.fn_name,
        payload: req.payload,
        nonce: Array.from(randomNonce()),
        expires_at: getNonceExpiration(),
      };
      const signedZomeCall: CallZomeRequestSigned = await invoke(
        "sign_zome_call",
        { zomeCallUnsigned }
      );
      return signedZomeCall;
    } else {
      throw new Error("not implemented!");
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
