import { InstalledAppId } from "../types.js";

export interface LauncherEnvironment {
  APP_INTERFACE_PORT: number;
  ADMIN_INTERFACE_PORT: number;
  INSTALLED_APP_ID: InstalledAppId;
}

export const isLauncher =
  typeof window === "object" && "__HC_LAUNCHER_ENV__" in window;

export const getLauncherEnvironment = (): LauncherEnvironment | undefined =>
  isLauncher
    ? (
        window as Window &
          typeof globalThis & { __HC_LAUNCHER_ENV__: LauncherEnvironment }
      ).__HC_LAUNCHER_ENV__
    : undefined;
