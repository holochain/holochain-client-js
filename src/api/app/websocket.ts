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
import { decode, encode } from "@msgpack/msgpack";
import { EventEmitter } from "events";
import { getLauncherEnvironment } from "../../environments/launcher.js";
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
  CallZomeRequestGeneric,
  CallZomeResponseGeneric,
  ArchiveCloneCellRequest,
  CreateCloneCellRequest,
  CreateCloneCellResponse,
  ArchiveCloneCellResponse,
} from "./types.js";

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

  _requester = <ReqO, ReqI, ResI, ResO>(
    tag: string,
    transformer?: Transformer<ReqO, ReqI, ResI, ResO>
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
    CallZomeRequestGeneric<any>,
    CallZomeResponseGeneric<any>
  > = this._requester("zome_call", callZomeTransform);

  createCloneCell: Requester<CreateCloneCellRequest, CreateCloneCellResponse> =
    this._requester("create_clone_cell");

  archiveCloneCell: Requester<
    ArchiveCloneCellRequest,
    ArchiveCloneCellResponse
  > = this._requester("archive_clone_cell");
}

const callZomeTransform: Transformer<
  CallZomeRequestGeneric<any>,
  CallZomeRequestGeneric<Uint8Array>,
  CallZomeResponseGeneric<Uint8Array>,
  CallZomeResponseGeneric<any>
> = {
  input: (
    req: CallZomeRequestGeneric<any>
  ): CallZomeRequestGeneric<Uint8Array> => {
    return {
      ...req,
      payload: encode(req.payload),
    };
  },
  output: (
    res: CallZomeResponseGeneric<Uint8Array>
  ): CallZomeResponseGeneric<any> => {
    return decode(res);
  },
};

const appInfoTransform = (
  appWs: AppWebsocket
): Transformer<
  AppInfoRequest,
  AppInfoRequest,
  AppInfoResponse,
  AppInfoResponse
> => ({
  input: (req: AppInfoRequest): AppInfoRequest => {
    if (appWs.overrideInstalledAppId) {
      return {
        installed_app_id: appWs.overrideInstalledAppId,
      };
    }

    return req;
  },
  output: (res: AppInfoResponse): AppInfoResponse => {
    return res;
  },
});
