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
import { hashZomeCall } from "@holochain/serialization";
import { decode, encode } from "@msgpack/msgpack";
import {
  getLauncherEnvironment,
  isLauncher,
} from "../../environments/launcher.js";
import { AgentPubKey, InstalledAppId } from "../../types.js";
import { FunctionName, ZomeName } from "../admin/types.js";
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
  CallZomeRequestGeneric,
  CallZomeResponseGeneric,
  ArchiveCloneCellRequest,
  CreateCloneCellRequest,
  CreateCloneCellResponse,
  ArchiveCloneCellResponse,
  CallZomeRequest,
} from "./types.js";
import { randomNonce } from "./util.js";
import { invoke } from "@tauri-apps/api/tauri";

type TauriByteArray = number[];
interface CallZomeRequestUnsignedTauri<Payload> {
  cap_secret: TauriByteArray | null;
  cell_id: [TauriByteArray, TauriByteArray];
  zome_name: ZomeName;
  fn_name: FunctionName;
  payload: Payload;
  provenance: TauriByteArray;
  nonce: TauriByteArray;
  expires_at: number;
}

export class AppWebsocket implements AppApi {
  client: WsClient;
  defaultTimeout: number;
  overrideInstalledAppId?: InstalledAppId;

  constructor(
    client: WsClient,
    defaultTimeout?: number,
    overrideInstalledAppId?: InstalledAppId
  ) {
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
    return new AppWebsocket(
      wsClient,
      defaultTimeout,
      env ? env.INSTALLED_APP_ID : undefined
    );
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

  callZome: Requester<CallZomeRequest, CallZomeResponseGeneric<any>> =
    this._requester("zome_call", callZomeTransform);

  createCloneCell: Requester<CreateCloneCellRequest, CreateCloneCellResponse> =
    this._requester("create_clone_cell");

  archiveCloneCell: Requester<
    ArchiveCloneCellRequest,
    ArchiveCloneCellResponse
  > = this._requester("archive_clone_cell");
}

const callZomeTransform: Transformer<
  CallZomeRequestGeneric<any>,
  Promise<CallZomeRequest>,
  CallZomeResponseGeneric<Uint8Array>,
  CallZomeResponseGeneric<any>
> = {
  input: async (req) => {
    if (isLauncher) {
      const zomeCallUnsigned: CallZomeRequestUnsignedTauri<any> = {
        provenance: Array.from(req.provenance),
        cell_id: [Array.from(req.cell_id[0]), Array.from(req.cell_id[1])],
        zome_name: req.zome_name,
        fn_name: req.fn_name,
        cap_secret: req.cap_secret === null ? null : Array.from(req.cap_secret),
        payload: req.payload,
        nonce: Array.from(randomNonce()),
        expires_at: Date.now() + 5 * 60 * 60 * 1000,
      };
      const signedZomeCall: CallZomeRequest = await invoke("sign_zome_call", {
        zomeCallUnsigned,
      });
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
