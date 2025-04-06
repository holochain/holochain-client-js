import { AppAuthenticationToken, CallZomeRequest } from "../api/index.js";
import { CallZomeRequestSigned } from "../api/index.js";
import { InstalledAppId } from "../types.js";

export interface LauncherEnvironment {
  APP_INTERFACE_PORT?: number;
  ADMIN_INTERFACE_PORT?: number;
  INSTALLED_APP_ID?: InstalledAppId;
  APP_INTERFACE_TOKEN?: AppAuthenticationToken;
}

export interface AwaitLauncherEnvironment {
  interval?: number;
  timeout?: number;
}

export interface HostZomeCallSigner {
  signZomeCall: (request: CallZomeRequest) => Promise<CallZomeRequestSigned>;
}

const __HC_AWAIT_LAUNCHER_ENV__ = "__HC_AWAIT_LAUNCHER_ENV__";
const __HC_LAUNCHER_ENV__ = "__HC_LAUNCHER_ENV__";
const __HC_ZOME_CALL_SIGNER__ = "__HC_ZOME_CALL_SIGNER__";

const isLauncher = () =>
  globalThis.window && __HC_LAUNCHER_ENV__ in globalThis.window;

const isAwaitLauncher = () =>
  globalThis.window && __HC_AWAIT_LAUNCHER_ENV__ in globalThis.window;

const getAwaitLauncherEnv = (): AwaitLauncherEnvironment | undefined =>
  isAwaitLauncher() ? globalThis.window[__HC_AWAIT_LAUNCHER_ENV__] : undefined;

const getLauncherEnvironment = (): LauncherEnvironment | undefined =>
  isLauncher() ? globalThis.window[__HC_LAUNCHER_ENV__] : undefined;

export const getHostZomeCallSigner = (): HostZomeCallSigner | undefined =>
  globalThis.window && globalThis.window[__HC_ZOME_CALL_SIGNER__];

export const launcherEnv = async (): Promise<
  LauncherEnvironment | undefined
> => {
  let launcherEnv = getLauncherEnvironment();
  if (launcherEnv !== undefined) return launcherEnv;

  const awaitLauncherEnv = getAwaitLauncherEnv();
  if (awaitLauncherEnv !== undefined) {
    const interval = awaitLauncherEnv.interval || 10;
    const timeout = awaitLauncherEnv.timeout || 5000;

    await new Promise<void>((resolve) => {
      let elapsed = 0;
      const i = setInterval(() => {
        elapsed += interval;
        if (elapsed >= timeout) {
          clearInterval(i);
          resolve();
        }

        launcherEnv = getLauncherEnvironment();
        if (launcherEnv !== undefined) {
          clearInterval(i);
          resolve();
        }
      }, interval);
    });

    return launcherEnv;
  }
};

declare global {
  interface Window {
    [__HC_AWAIT_LAUNCHER_ENV__]?: AwaitLauncherEnvironment;
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
    CallZomeRequest,
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
