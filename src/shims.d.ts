import type {
  LauncherEnvironment,
  __HC_LAUNCHER_ENV__,
} from "./environments/launcher.js";

declare global {
  interface Window {
    [__HC_LAUNCHER_ENV__]: LauncherEnvironment | undefined;
  }
}
