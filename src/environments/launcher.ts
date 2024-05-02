import { AppAuthenticationToken, CallZomeRequest } from "../api/index.js";
import {
  CallZomeRequestSigned,
  CallZomeRequestUnsigned,
} from "../api/index.js";
import { InstalledAppId } from "../types.js";

export interface LauncherEnvironment {
  APP_INTERFACE_PORT?: number;
  ADMIN_INTERFACE_PORT?: number;
  INSTALLED_APP_ID?: InstalledAppId;
  APP_INTERFACE_TOKEN?: AppAuthenticationToken;
}

export interface HostZomeCallSigner {
  signZomeCall: (request: CallZomeRequest) => Promise<CallZomeRequestSigned>;
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
