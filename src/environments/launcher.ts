import { InstalledAppId } from "../api/types"
import fetch from "cross-fetch"

// This is coupled with https://github.com/holochain/launcher/blob/develop/src-tauri/src/uis/caddy.rs#L13
export const LAUNCHER_ENV_URL = "/.launcher-env.json"

export interface LauncherEnvironment {
  APP_INTERFACE_PORT: number;
  ADMIN_INTERFACE_PORT: number;
  INSTALLED_APP_ID: InstalledAppId;
}

async function fetchLauncherEnvironment(): Promise<
  LauncherEnvironment | undefined
  > {
  let env
  try {
    env = await fetch(LAUNCHER_ENV_URL)
  } catch (e) {
    return
  }
  if (!env.ok || env.status === 404) {
    return
  }

  return await env.json()
}

const isBrowser = typeof window !== "undefined"
let promise: Promise<any>

if (isBrowser) {
  promise = fetchLauncherEnvironment().catch(console.error)
}

export async function getLauncherEnvironment(): Promise<
  LauncherEnvironment | undefined
  > {
  if (isBrowser) {
    return promise
  } else {
    return undefined
  }
}
