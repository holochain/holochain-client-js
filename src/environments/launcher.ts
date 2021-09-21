import { InstalledAppId } from "../api/types";

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
  if (!env.ok) return undefined;

  return env.json();
}
