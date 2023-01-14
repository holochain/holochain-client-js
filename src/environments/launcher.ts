import { InstalledAppId } from "../types.js";
import { invoke } from "@tauri-apps/api/tauri";
import {
  CallZomeRequest,
  CallZomeRequestSigned,
  CallZomeRequestUnsigned,
  getNonceExpiration,
  randomNonce,
} from "../api/index.js";
import { encode } from "@msgpack/msgpack";

export interface LauncherEnvironment {
  APP_INTERFACE_PORT?: number;
  ADMIN_INTERFACE_PORT?: number;
  INSTALLED_APP_ID?: InstalledAppId;
}

const __HC_LAUNCHER_ENV__ = "__HC_LAUNCHER_ENV__";

export const isLauncher =
  typeof window === "object" && __HC_LAUNCHER_ENV__ in window;

export const getLauncherEnvironment = (): LauncherEnvironment | undefined =>
  isLauncher ? window[__HC_LAUNCHER_ENV__] : undefined;

declare global {
  interface Window {
    [__HC_LAUNCHER_ENV__]: LauncherEnvironment | undefined;
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
