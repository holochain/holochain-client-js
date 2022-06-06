import { CapSecret } from "../../hdk/capabilities.js";
import { AgentPubKey, CellId, InstalledAppId } from "../../types.js";
import { Requester } from "../common.js";
import { InstalledAppInfo } from "../admin/index.js";

export type CallZomeRequestGeneric<Payload> = {
  cap_secret: CapSecret | null;
  cell_id: CellId;
  zome_name: string;
  fn_name: string;
  payload: Payload;
  provenance: AgentPubKey;
};
export type CallZomeResponseGeneric<Payload> = Payload;
export type CallZomeRequest = CallZomeRequestGeneric<any>;
export type CallZomeResponse = CallZomeResponseGeneric<any>;

export type AppInfoRequest = { installed_app_id: InstalledAppId };
export type AppInfoResponse = InstalledAppInfo;

export type AppSignal = {
  type: string;
  data: {
    cellId: CellId;
    payload: any;
  };
};

export type AppSignalCb = (signal: AppSignal) => void;

export type SignalResponseGeneric<Payload> = Payload;

export interface AppApi {
  appInfo: Requester<AppInfoRequest, AppInfoResponse>;
  callZome: Requester<CallZomeRequest, CallZomeResponse>;
}
