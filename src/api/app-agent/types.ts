import Emittery from "emittery";
import {
  ArchiveCloneCellResponse,
  CreateCloneCellRequest,
  CreateCloneCellResponse,
} from "..";
import { CellId, RoleName } from "../..";
import {
  CallZomeRequest,
  AppInfoResponse,
  ArchiveCloneCellRequest,
} from "../app";

export type AppAgentCallZomeRequest = Omit<CallZomeRequest, "cell_id"> & {
  role_name?: RoleName;
  cell_id?: CellId;
};

export type AppCreateCloneCellRequest = Omit<CreateCloneCellRequest, "app_id">;

export type AppArchiveCloneCellRequest = Omit<
  ArchiveCloneCellRequest,
  "app_id"
>;

export interface AppAgentClient extends Emittery {
  callZome(args: AppAgentCallZomeRequest, timeout?: number): Promise<any>;
  appInfo(): Promise<AppInfoResponse>;
  createCloneCell(
    args: AppCreateCloneCellRequest
  ): Promise<CreateCloneCellResponse>;
  archiveCloneCell(
    args: AppArchiveCloneCellRequest
  ): Promise<ArchiveCloneCellResponse>;
}
