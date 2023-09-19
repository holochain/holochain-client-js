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
  NetworkInfoRequest,
  NetworkInfoResponse,
} from "../app/index.js";
import {
  CreateCloneCellRequest,
  CreateCloneCellResponse,
  DisableCloneCellResponse,
} from "../index.js";

/**
 * @public
 */
export type NonProvenanceCallZomeRequest = Omit<CallZomeRequest, "provenance">;

/**
 * @public
 */
export type RoleNameCallZomeRequest = Omit<
  NonProvenanceCallZomeRequest,
  "cell_id"
> & {
  role_name: RoleName;
};

/**
 * @public
 */
export type RoleNameCallZomeRequestSigned = Omit<
  CallZomeRequestSigned,
  "cell_id"
> & { role_name: RoleName };

/**
 * @public
 */
export type AppAgentCallZomeRequest =
  | NonProvenanceCallZomeRequest
  | RoleNameCallZomeRequest
  | CallZomeRequestSigned
  | RoleNameCallZomeRequestSigned;

/**
 * @public
 */
export type AppCreateCloneCellRequest = Omit<CreateCloneCellRequest, "app_id">;

/**
 * @public
 */
export type AppEnableCloneCellRequest = Omit<EnableCloneCellRequest, "app_id">;

/**
 * @public
 */
export type AppDisableCloneCellRequest = Omit<
  DisableCloneCellRequest,
  "app_id"
>;

/**
 * @public
 */
export type AppAgentNetworkInfoRequest = Omit<
  NetworkInfoRequest,
  "agent_pub_key"
>;

/**
 * @public
 */
export interface AppAgentEvents {
  signal: AppSignal;
}

/**
 * @public
 */
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
  networkInfo(args: AppAgentNetworkInfoRequest): Promise<NetworkInfoResponse>;
}
