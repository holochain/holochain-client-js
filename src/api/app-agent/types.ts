import { EventEmitter } from "events";
import {
  ArchiveCloneCellResponse,
  CreateCloneCellRequest,
  CreateCloneCellResponse,
} from "..";
import { CellId, RoleId } from "../..";
import {
  CallZomeRequest,
  AppInfoResponse,
  ArchiveCloneCellRequest,
} from "../app";

export type AppAgentCallZomeRequest = Omit<CallZomeRequest, "cell_id"> & {
  role_id?: RoleId;
  cell_id?: CellId;
};

export type AppCreateCloneCellRequest = Omit<CreateCloneCellRequest, "app_id">;

export type AppArchiveCloneCellRequest = Omit<
  ArchiveCloneCellRequest,
  "app_id"
>;

export interface AppAgentClient extends EventEmitter {
  callZome(args: AppAgentCallZomeRequest, timeout?: number): Promise<any>;
  appInfo(): Promise<AppInfoResponse>;
  createCloneCell(
    args: AppCreateCloneCellRequest
  ): Promise<CreateCloneCellResponse>;
  archiveCloneCell(
    args: AppArchiveCloneCellRequest
  ): Promise<ArchiveCloneCellResponse>;
}
