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
  const env = await fetch(LAUNCHER_ENV_URL)

  if (env.ok) {
    const launcherEnvironment = await env.json()
    return launcherEnvironment
  } else {
    // We are not in the launcher environment
    if (env.status === 404) {
      console.warn(
        "[@holochain/conductor-api]: you are in a development environment. When this UI is run in the Holochain Launcher, `AppWebsocket.connect()`, `AdminWebsocket.connect()` and `appWebsocket.appInfo()` will have their parameters ignored and substituted by the ones provided by the Holochain Launcher."
      )
      return undefined
    } else {
      throw new Error(
        `Error trying to fetch the launcher environment: ${env.statusText}`
      )
    }
  }
}

const isBrowser = typeof window !== "undefined"
const isJest =
  typeof process !== "undefined" && process.env && process.env.JEST_WORKER_ID !== undefined

let promise: Promise<any>

if (isBrowser && !isJest) {
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
