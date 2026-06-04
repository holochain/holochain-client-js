export * from "./api/index.js";
// Only the environment-detection surface is public. getTauriInvoke /
// TauriInvokeFn are transport-internal (used by TauriAppTransport) and are
// deliberately not re-exported, so they stay out of the package's semver
// contract.
export {
  isTauriHolochain,
  getTauriHolochainEnvironment,
} from "./environments/tauri.js";
export type { TauriHolochainEnvironment } from "./environments/tauri.js";
export * from "./hdk/index.js";
export * from "./types.js";
export * from "./utils/index.js";
