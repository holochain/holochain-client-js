import { InstalledAppId } from "../types.js";
import fetch from "cross-fetch";

// This is based on
// https://github.com/holochain/launcher/blob/213aae208c58f2496811d80859723b71f6750426/crates/holochain_web_app_manager/src/caddy/utils.rs#L49
export const LAUNCHER_ENV_URL = "/.launcher-env.json";

export interface LauncherEnvironment {
  APP_INTERFACE_PORT: number;
  ADMIN_INTERFACE_PORT: number;
  INSTALLED_APP_ID: InstalledAppId;
}

async function fetchLauncherEnvironment(): Promise<
  LauncherEnvironment | undefined
> {
  const env = await fetch(LAUNCHER_ENV_URL);

  if (env.ok) {
    const launcherEnvironment = await env.json();
    return launcherEnvironment;
  } else {
    // We are not in the launcher environment
    if (env.status === 404) {
      console.warn(
        "[@holochain/client]: you are in a development environment. When this UI is run in the Holochain Launcher, `AppWebsocket.connect()`, `AdminWebsocket.connect()` and `appWebsocket.appInfo()` will have their parameters ignored and substituted by the ones provided by the Holochain Launcher."
      );
      return undefined;
    } else {
      throw new Error(
        `Error trying to fetch the launcher environment: ${env.statusText}`
      );
    }
  }
}

const isTauriWindow = !!(window as any).__TAURI__;
const isBrowser = typeof window !== "undefined";
const isJest =
  typeof process !== "undefined" &&
  process.env &&
  process.env.JEST_WORKER_ID !== undefined;

let promise: Promise<any>;

if (isBrowser && !isJest) {
  promise = fetchLauncherEnvironment().catch(console.error);
}

export async function getLauncherEnvironment(): Promise<
  LauncherEnvironment | undefined
> {
  if (isBrowser || isTauriWindow) {
    return promise;
  } else {
    return undefined;
  }
}
