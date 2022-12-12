/**
 * Defines AppWebsocket, an easy-to-use websocket implementation of the
 * Conductor API for apps
 *
 *    const client = AppWebsocket.connect('ws://localhost:9000');
 *
 *    client.callZome({...})
 *      .then(() => {
 *        console.log('DNA successfully installed')
 *      })
 *      .catch(err => {
 *        console.error('problem installing DNA:', err)
 *      });
 */
import { hashZomeCall } from "@holochain/serialization/pkg/holochain_serialization_js.js";
import { decode, encode } from "@msgpack/msgpack";
import { invoke } from "@tauri-apps/api/tauri";
import nacl from "tweetnacl";
import Emittery from "emittery";
import {
  getLauncherEnvironment,
  isLauncher,
} from "../../environments/launcher.js";
import { CapSecret } from "../../hdk/capabilities.js";
import { AgentPubKey, CellId, InstalledAppId } from "../../types.js";
import { FunctionName, ZomeName } from "../admin/types.js";
import { AdminWebsocket } from "../admin/websocket.js";
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
import {
  generateSigningKeyPair,
  getNonceExpiration,
  grantSigningKey,
  randomNonce,
} from "./util.js";

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
    //** @deprecated */
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
  cap_secret: CapSecret | null;
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

interface CallZomeRequestSignedTauri // Tauri requires a number array instead of a Uint8Array
  extends Omit<
  CallZomeRequestSigned,
    "cap_secret" | "cell_id" | "provenance" | "nonce"
  > {
  cell_id: [TauriByteArray, TauriByteArray];
  provenance: TauriByteArray;
  nonce: TauriByteArray;
  expires_at: number;
}


const signingProps: Map<
  CellId,
  {
    capSecret: CapSecret;
    keyPair: nacl.SignKeyPair;
    signingKey: AgentPubKey;
  }
> = new Map();
export const setSigningPops = async (
  adminWs: AdminWebsocket,
  cellId: CellId,
  functions: [[ZomeName, FunctionName]]
) => {
  const [keyPair, signingKey] = generateSigningKeyPair();
  const capSecret = await grantSigningKey(
    adminWs,
    cellId,
    functions,
    signingKey
  );
  signingProps.set(cellId, { capSecret, keyPair, signingKey });
};

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
        payload: Array.from(encode(req.payload)),
        nonce: Array.from(randomNonce()),
        expires_at: getNonceExpiration(),
      };

      let signedZomeCallTauri: CallZomeRequestSignedTauri = await invoke(
        "sign_zome_call",
        { zomeCallUnsigned }
      );

      const signedZomeCall: CallZomeRequestSigned = {
        provenance: Uint8Array.from(signedZomeCallTauri.provenance),
        cap_secret: null,
        cell_id: [Uint8Array.from(signedZomeCallTauri.cell_id[0]), Uint8Array.from(signedZomeCallTauri.cell_id[1])],
        zome_name: signedZomeCallTauri.zome_name,
        fn_name: signedZomeCallTauri.fn_name,
        payload: Uint8Array.from(signedZomeCallTauri.payload),
        signature: Uint8Array.from(signedZomeCallTauri.signature),
        expires_at: signedZomeCallTauri.expires_at,
        nonce: Uint8Array.from(signedZomeCallTauri.nonce),
      };

      return signedZomeCall;
    } else {
      const signingPropsForCell = signingProps.get(req.cell_id);
      if (signingPropsForCell) {
        const unsignedZomeCall: CallZomeRequestUnsigned = {
          ...req,
          payload: encode(req.payload),
          cap_secret: signingPropsForCell.capSecret,
          nonce: randomNonce(),
          expires_at: getNonceExpiration(),
        };
        const hashedZomeCall = hashZomeCall(unsignedZomeCall);
        const signature = nacl
          .sign(hashedZomeCall, signingPropsForCell.keyPair.secretKey)
          .subarray(0, nacl.sign.signatureLength);

        const signedZomeCall: CallZomeRequestSigned = {
          ...unsignedZomeCall,
          signature,
        };
        return signedZomeCall;
      } else {
        throw new Error(
          "cannot sign zome call: signing properties have not been set"
        );
      }
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
