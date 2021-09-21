import { InstalledAppId } from "../api/types";
import fetch from "cross-fetch";

// This is coupled with https://github.com/holochain/launcher/blob/develop/src-tauri/src/uis/caddy.rs#L13
export const LAUNCHER_ENV_URL = "/.launcher-env.json";

export interface LauncherEnvironment {
  APP_INTERFACE_PORT: number;
  ADMIN_INTERFACE_PORT: number;
  INSTALLED_APP_ID: InstalledAppId;
}

export async function fetchLauncherEnvironment(): Promise<
  LauncherEnvironment | undefined
> {
  const env = await fetch(LAUNCHER_ENV_URL);

  // We are not in the launcher environment
  if (!env.ok) {
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

  return env.json();
}
