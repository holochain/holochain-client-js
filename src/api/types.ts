import { InstalledAppId, InstalledCell } from "../types/common";

export type DeactivationReason =
  | { never_activated: null }
  | { normal: null }
  | { quarantined: { error: string } };

export type PausedAppReason = {
  error: string;
};
export type DisabledAppReason =
  | {
      never_started: null;
    }
  | { user: null }
  | { error: string };

export type InstalledAppInfoStatus =
  | {
      paused: { reason: PausedAppReason };
    }
  | {
      disabled: {
        reason: DisabledAppReason;
      };
    }
  | {
      running: null;
    };

export type InstalledAppInfo = {
  installed_app_id: InstalledAppId;
  cell_data: Array<InstalledCell>;
  status: InstalledAppInfoStatus;
};
export type MembraneProof = Buffer;

export const fakeAgentPubKey = () =>
  Buffer.from(
    [0x84, 0x20, 0x24].concat(
      "000000000000000000000000000000000000"
        .split("")
        .map((x) => parseInt(x, 10))
    )
  );

export interface Header {}
