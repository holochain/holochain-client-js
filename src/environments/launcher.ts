import { InstalledAppId } from "../api/types";
import fetch from "cross-fetch";

// This is coupled with https://github.com/holochain/launcher/blob/develop/src-tauri/src/uis/caddy.rs#L13
export const LAUNCHER_ENV_URL = "/.launcher-env.json";

export interface LauncherEnvironment {
  APP_INTERFACE_PORT: number;
  ADMIN_INTERFACE_PORT: number;
  INSTALLED_APP_ID: InstalledAppId;
}

// If _launcherEnvironment is undefined, we are in a local development environment
let _launcherEnvironment: LauncherEnvironment | undefined = undefined;

// Whether we have already fetched the environment, and we don't have to fetch again
let loaded: boolean = false;

export async function fetchLauncherEnvironment(): Promise<
  LauncherEnvironment | undefined
> {
  if (loaded) return _launcherEnvironment;

  const env = await fetch(LAUNCHER_ENV_URL);

  if (env.ok) {
    _launcherEnvironment = await env.json();
    loaded = true;
    return _launcherEnvironment;
  } else {
    loaded = true;
    // We are not in the launcher environment
    if (env.status === 404) {
      console.warn(
        "[@holochain/conductor-api]: you are in a development environment. When this UI is running in the Holochain Launcher, `AppWebsocket.connect()`, `AdminWebsocket.connect()` and `appWebsocket.appInfo()` will have their parameters ignored and substituted by the ones provided by the Holochain Launcher."
      );
      return undefined;
    } else {
      throw new Error(
        `Error trying to fetch the launcher environment: ${env.statusText}`
      );
    }
  }
}

fetchLauncherEnvironment();
