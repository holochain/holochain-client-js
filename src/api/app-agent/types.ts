import { UnsubscribeFunction } from "emittery";
import {
  DisableCloneCellResponse,
  CreateCloneCellRequest,
  CreateCloneCellResponse,
} from "../index.js";
import { AgentPubKey, RoleName } from "../../index.js";
import {
  AppInfoResponse,
  AppSignal,
  DisableCloneCellRequest,
  CallZomeRequest,
  EnableCloneCellRequest,
  EnableCloneCellResponse,
  CallZomeRequestSigned,
} from "../app/index.js";

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
    listener: (eventData: AppAgentEvents[Name]) => void | Promise<void>
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
