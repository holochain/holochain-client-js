import { encode } from "@msgpack/msgpack";
import { invoke } from "@tauri-apps/api/tauri";
import { CallZomeRequest } from "../api";
import {
  CallZomeRequestSigned,
  CallZomeRequestUnsigned,
} from "../api";
import { getNonceExpiration, randomNonce } from "../api";
import { InstalledAppId } from "../types.js";

export interface LauncherEnvironment {
  APP_INTERFACE_PORT?: number;
  ADMIN_INTERFACE_PORT?: number;
  INSTALLED_APP_ID?: InstalledAppId;
  FRAMEWORK?: "tauri" | "electron";
}

export interface HostZomeCallSigner {
  signZomeCall: (request: CallZomeRequest) => Promise<CallZomeRequestSigned>;
}

const __HC_LAUNCHER_ENV__ = "__HC_LAUNCHER_ENV__";
const __HC_ZOME_CALL_SIGNER__ = "__HC_ZOME_CALL_SIGNER__";

export const isLauncher = () =>
  globalThis.window && __HC_LAUNCHER_ENV__ in globalThis.window;

export const getLauncherEnvironment = (): LauncherEnvironment | undefined =>
  isLauncher() ? globalThis.window[__HC_LAUNCHER_ENV__] : undefined;

export const getHostZomeCallSigner = (): HostZomeCallSigner | undefined =>
  globalThis.window && globalThis.window[__HC_ZOME_CALL_SIGNER__];

declare global {
  interface Window {
    [__HC_LAUNCHER_ENV__]?: LauncherEnvironment;
    [__HC_ZOME_CALL_SIGNER__]?: HostZomeCallSigner;
    electronAPI?: {
      signZomeCall: (
        data: CallZomeRequestUnsignedElectron
      ) => CallZomeRequestSignedElectron;
    };
  }
}

type TauriByteArray = number[]; // Tauri requires a number array instead of a Uint8Array

interface CallZomeRequestSignedTauri
  extends Omit<
    CallZomeRequestSigned,
    "cap_secret" | "cell_id" | "provenance" | "nonce"
  > {
  cell_id: [TauriByteArray, TauriByteArray];
  provenance: TauriByteArray;
  nonce: TauriByteArray;
  expires_at: number;
}

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

interface CallZomeRequestSignedElectron
  extends Omit<
    CallZomeRequestSigned,
    | "cap_secret"
    | "cell_id"
    | "provenance"
    | "nonce"
    | "zome_name"
    | "fn_name"
    | "expires_at"
  > {
  cellId: [Array<number>, Array<number>];
  provenance: Array<number>;
  zomeName: string;
  fnName: string;
  nonce: Array<number>;
  expiresAt: number;
}

interface CallZomeRequestUnsignedElectron
  extends Omit<
    CallZomeRequestUnsigned,
    | "cap_secret"
    | "cell_id"
    | "provenance"
    | "nonce"
    | "zome_name"
    | "fn_name"
    | "expires_at"
  > {
  cellId: [Array<number>, Array<number>];
  provenance: Array<number>;
  zomeName: string;
  fnName: string;
  nonce: Array<number>;
  expiresAt: number;
}

export const signZomeCallTauri = async (request: CallZomeRequest) => {
  const zomeCallUnsigned: CallZomeRequestUnsignedTauri = {
    provenance: Array.from(request.provenance),
    cell_id: [Array.from(request.cell_id[0]), Array.from(request.cell_id[1])],
    zome_name: request.zome_name,
    fn_name: request.fn_name,
    payload: Array.from(encode(request.payload)),
    nonce: Array.from(await randomNonce()),
    expires_at: getNonceExpiration(),
  };

  const signedZomeCallTauri: CallZomeRequestSignedTauri = await invoke(
    "sign_zome_call",
    { zomeCallUnsigned }
  );

  const signedZomeCall: CallZomeRequestSigned = {
    provenance: Uint8Array.from(signedZomeCallTauri.provenance),
    cap_secret: null,
    cell_id: [
      Uint8Array.from(signedZomeCallTauri.cell_id[0]),
      Uint8Array.from(signedZomeCallTauri.cell_id[1]),
    ],
    zome_name: signedZomeCallTauri.zome_name,
    fn_name: signedZomeCallTauri.fn_name,
    payload: Uint8Array.from(signedZomeCallTauri.payload),
    signature: Uint8Array.from(signedZomeCallTauri.signature),
    expires_at: signedZomeCallTauri.expires_at,
    nonce: Uint8Array.from(signedZomeCallTauri.nonce),
  };

  return signedZomeCall;
};

export const signZomeCallElectron = async (request: CallZomeRequest) => {
  if (!window.electronAPI) {
    throw Error(
      "Unable to signZomeCallElectron. window.electronAPI not defined"
    );
  }

  const zomeCallUnsignedElectron: CallZomeRequestUnsignedElectron = {
    provenance: Array.from(request.provenance),
    cellId: [Array.from(request.cell_id[0]), Array.from(request.cell_id[1])],
    zomeName: request.zome_name,
    fnName: request.fn_name,
    payload: Array.from(encode(request.payload)),
    nonce: Array.from(await randomNonce()),
    expiresAt: getNonceExpiration(),
  };

  const zomeCallSignedElectron: CallZomeRequestSignedElectron =
    await window.electronAPI.signZomeCall(zomeCallUnsignedElectron);

  const zomeCallSigned: CallZomeRequestSigned = {
    provenance: Uint8Array.from(zomeCallSignedElectron.provenance),
    cap_secret: null,
    cell_id: [
      Uint8Array.from(zomeCallSignedElectron.cellId[0]),
      Uint8Array.from(zomeCallSignedElectron.cellId[1]),
    ],
    zome_name: zomeCallSignedElectron.zomeName,
    fn_name: zomeCallSignedElectron.fnName,
    payload: Uint8Array.from(zomeCallSignedElectron.payload),
    signature: Uint8Array.from(zomeCallSignedElectron.signature),
    expires_at: zomeCallSignedElectron.expiresAt,
    nonce: Uint8Array.from(zomeCallSignedElectron.nonce),
  };

  return zomeCallSigned;
};
