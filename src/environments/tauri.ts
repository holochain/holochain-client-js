import { HolochainError } from "../api/common.js";
import { InstalledAppId } from "../types.js";

/**
 * Environment injected by the in-process Tauri plugin (tauri-plugin-holochain)
 * into a webview that is wired to a Holochain conductor running in the same
 * process. Its presence signals that the App API should be reached through
 * Tauri IPC rather than by opening a websocket.
 *
 * @public
 */
export interface TauriHolochainEnvironment {
  /** The app this webview is bound to. */
  INSTALLED_APP_ID: InstalledAppId;
  /**
   * The Tauri plugin name used to build the IPC command name. Defaults to
   * `"holochain"` when not provided.
   */
  PLUGIN_NAME?: string;
  /**
   * Subscribe to the conductor's signal stream for this window, provided by the
   * plugin's injected env (it bridges the plugin's Tauri signal events). The
   * callback receives each signal as the msgpack bytes the app websocket would
   * have carried. Returns a function that unsubscribes.
   *
   * Absent when the plugin injects no signal bridge; the transport then simply
   * delivers no signals.
   */
  subscribeSignals?: (cb: (bytes: Uint8Array) => void) => () => void;
}

/**
 * The slice of Tauri's internal IPC bridge this client uses: the `invoke`
 * function.
 *
 * @public
 */
export type TauriInvokeFn = <T>(
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<T>;

const __HC_TAURI_HOLOCHAIN__ = "__HC_TAURI_HOLOCHAIN__";
const __TAURI_INTERNALS__ = "__TAURI_INTERNALS__";

/**
 * Whether the code is running inside a Tauri webview opened by
 * tauri-plugin-holochain. True only when both the Tauri IPC bridge and the
 * plugin's holochain marker are present on `window`.
 *
 * @public
 */
export const isTauriHolochain = (): boolean =>
  !!globalThis.window &&
  __HC_TAURI_HOLOCHAIN__ in globalThis.window &&
  __TAURI_INTERNALS__ in globalThis.window;

/**
 * The injected {@link TauriHolochainEnvironment}, or `undefined` when not in a
 * Tauri holochain webview.
 *
 * @public
 */
export const getTauriHolochainEnvironment = ():
  | TauriHolochainEnvironment
  | undefined =>
  isTauriHolochain() ? globalThis.window[__HC_TAURI_HOLOCHAIN__] : undefined;

/**
 * Get Tauri's `invoke` from the webview, bound to its IPC bridge. Throws a
 * {@link HolochainError} if the Tauri IPC bridge is not present.
 *
 * @public
 */
export const getTauriInvoke = (): TauriInvokeFn => {
  const internals = globalThis.window?.[__TAURI_INTERNALS__];
  if (!internals) {
    throw new HolochainError(
      "TauriInternalsMissing",
      "not running in a Tauri webview - window.__TAURI_INTERNALS__ is not available",
    );
  }
  return internals.invoke.bind(internals);
};

declare global {
  interface Window {
    [__HC_TAURI_HOLOCHAIN__]?: TauriHolochainEnvironment;
    [__TAURI_INTERNALS__]?: { invoke: TauriInvokeFn };
  }
}
