import { UnsubscribeFunction } from "emittery";
import {
  ArchiveCloneCellResponse,
  CreateCloneCellRequest,
  CreateCloneCellResponse,
} from "../index.js";
import { RoleName } from "../../index.js";
import {
  AppInfoResponse,
  AppSignal,
  ArchiveCloneCellRequest,
  CallZomeRequest,
} from "../app/index.js";

export type RoleNameCallZomeRequest = Omit<CallZomeRequest, "cell_id"> & {
  role_name: RoleName;
};

export type AppAgentCallZomeRequest = CallZomeRequest | RoleNameCallZomeRequest;

export type AppCreateCloneCellRequest = Omit<CreateCloneCellRequest, "app_id">;

export type AppArchiveCloneCellRequest = Omit<
  ArchiveCloneCellRequest,
  "app_id"
>;

export interface AppAgentEvents {
  signal: AppSignal;
}

export interface AppAgentClient {
  callZome(args: AppAgentCallZomeRequest, timeout?: number): Promise<any>;

  on<Name extends keyof AppAgentEvents>(
    eventName: Name | readonly Name[],
    listener: (eventData: AppAgentEvents[Name]) => void | Promise<void>
  ): UnsubscribeFunction;

  appInfo(): Promise<AppInfoResponse>;

  createCloneCell(
    args: AppCreateCloneCellRequest
  ): Promise<CreateCloneCellResponse>;
  archiveCloneCell(
    args: AppArchiveCloneCellRequest
  ): Promise<ArchiveCloneCellResponse>;
}
