import { UnsubscribeFunction } from "emittery";
import { AgentPubKey, RoleName } from "../../index.js";
import {
  AppInfoResponse,
  AppSignal,
  AppSignalCb,
  CallZomeRequest,
  CallZomeRequestSigned,
  DisableCloneCellRequest,
  EnableCloneCellRequest,
  EnableCloneCellResponse,
} from "../app/index.js";
import {
  CreateCloneCellRequest,
  CreateCloneCellResponse,
  DisableCloneCellResponse,
} from "../index.js";

export type NonProvenanceCallZomeRequest = Omit<CallZomeRequest, "provenance">;

export type RoleNameCallZomeRequest = Omit<
  NonProvenanceCallZomeRequest,
  "cell_id"
> & {
  role_name: RoleName;
};

export type RoleNameCallZomeRequestSigned = Omit<
  CallZomeRequestSigned,
  "cell_id"
> & { role_name: RoleName };

export type AppAgentCallZomeRequest =
  | NonProvenanceCallZomeRequest
  | RoleNameCallZomeRequest
  | CallZomeRequestSigned
  | RoleNameCallZomeRequestSigned;

export type AppCreateCloneCellRequest = Omit<CreateCloneCellRequest, "app_id">;

export type AppEnableCloneCellRequest = Omit<EnableCloneCellRequest, "app_id">;

export type AppDisableCloneCellRequest = Omit<
  DisableCloneCellRequest,
  "app_id"
>;

export interface AppAgentEvents {
  signal: AppSignal;
}

export interface AppAgentClient {
  callZome(args: AppAgentCallZomeRequest, timeout?: number): Promise<any>;

  on<Name extends keyof AppAgentEvents>(
    eventName: Name | readonly Name[],
    listener: AppSignalCb
  ): UnsubscribeFunction;

  appInfo(): Promise<AppInfoResponse>;

  myPubKey: AgentPubKey;

  createCloneCell(
    args: AppCreateCloneCellRequest
  ): Promise<CreateCloneCellResponse>;
  enableCloneCell(
    args: AppEnableCloneCellRequest
  ): Promise<EnableCloneCellResponse>;
  disableCloneCell(
    args: AppDisableCloneCellRequest
  ): Promise<DisableCloneCellResponse>;
}
