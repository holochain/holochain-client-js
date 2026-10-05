import { EmitteryEvent, UnsubscribeFunction } from "emittery";
import { InstalledAppId, RoleName } from "../../client-types.js";
import { CapSecret } from "../../hdk/index.js";
import type {
  AgentPubKey,
  ActionHash,
  CellId,
  ClonedCell,
  DnaHash,
  FunctionName,
  ZomeName,
} from "../../generated/types.js";
import { Nonce256Bit } from "../zome-call-signing.js";
import type {
  AppAuthenticationToken,
  HolochainTransportStats,
  NetworkMetricsMap,
} from "../../generated/api/admin/types.js";
import { Transformer, WebsocketConnectionOptions } from "../common.js";
import type {
  AppInfo,
  AppRequest,
  AppResponse,
  CreateCloneCellPayload,
  DisableCloneCellPayload,
  EnableCloneCellPayload,
  SystemSignal,
  ZomeCallParamsSigned,
} from "../../generated/api/app/types.js";

/**
 * @public
 */
export interface AppEvents {
  signal: DecodedSignal;
}

/**
 * The payload carried by the {@link AppRequest} variant tagged `Tag`, or
 * `void` when that variant carries no payload.
 *
 * @public
 */
export type AppRequestPayload<Tag extends AppRequest["type"]> =
  Extract<AppRequest, { type: Tag }> extends { value: infer Payload }
    ? Payload
    : void;

/**
 * The payload carried by the {@link AppResponse} variant tagged `Tag`, or
 * `void` when that variant carries no payload.
 *
 * @public
 */
export type AppResponsePayload<Tag extends AppResponse["type"]> =
  Extract<AppResponse, { type: Tag }> extends { value: infer Payload }
    ? Payload
    : void;

/**
 * @public
 */
export type CallZomeRequestGeneric<Payload> = {
  cell_id: CellId;
  zome_name: ZomeName;
  fn_name: FunctionName;
  provenance?: AgentPubKey;
  payload?: Payload;
  cap_secret?: CapSecret;
  nonce?: Nonce256Bit;
  expires_at?: number;
};

/**
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CallZomeRequest = CallZomeRequestGeneric<any>;

/**
 * @public
 */
export type RoleNameCallZomeRequest = Omit<CallZomeRequest, "cell_id"> & {
  role_name: RoleName;
};

/**
 * @public
 */
export type CallZomeResponseGeneric<Payload> = Payload;

/**
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CallZomeResponse = CallZomeResponseGeneric<any>;

/**
 * @public
 */
export enum SignalType {
  App = "app",
  AppDirect = "app_direct",
  System = "system",
}

/**
 * @public
 */
export type RawSignal =
  | {
      type: SignalType.App;
      value: EncodedAppSignal;
    }
  | {
      type: SignalType.AppDirect;
      value: EncodedDirectSignal;
    }
  | {
      type: SignalType.System;
      value: SystemSignal;
    };

/**
 * @public
 */
export type EncodedAppSignal = {
  cell_id: CellId;
  zome_name: string;
  signal: Uint8Array;
};

/**
 * The wire form of the `app_direct` variant of the generated {@link Signal}:
 * a direct signal sent by a remote agent with `send_direct_signal`. Rust
 * serializes the `Vec<u8>` payload as a msgpack array of integers, hence
 * `Array<number>` rather than bytes.
 *
 * @public
 */
export type EncodedDirectSignal = {
  cell_id: CellId;
  from_agent: AgentPubKey;
  signal: Array<number>;
};

/**
 * The app signal handed to listeners: same shape as the app variant of the
 * generated {@link Signal}, except that the msgpack payload in `signal` has
 * already been decoded by the client, so its type is whatever the emitting
 * zome produced rather than the wire `AppSignal` byte string.
 *
 * @public
 */
export type DecodedAppSignal = {
  cell_id: CellId;
  zome_name: ZomeName;
  signal: unknown;
};

/**
 * The direct signal handed to listeners. Holochain treats the payload as
 * opaque bytes, so it is surfaced as a `Uint8Array`; the application decides
 * how to decode it.
 *
 * @public
 */
export type DecodedDirectSignal = {
  /** The cell that received the signal. */
  cell_id: CellId;
  /** The agent that sent the signal. */
  from_agent: AgentPubKey;
  /** The opaque payload sent by the remote agent. */
  signal: Uint8Array;
};

/**
 * The decoded counterpart of the generated {@link Signal}: system signals pass
 * through unchanged, app signals carry a {@link DecodedAppSignal}, direct
 * signals carry a {@link DecodedDirectSignal}. This is what every
 * {@link SignalCb} receives.
 *
 * @public
 */
export type DecodedSignal =
  | {
      type: SignalType.App;
      value: DecodedAppSignal;
    }
  | {
      type: SignalType.AppDirect;
      value: DecodedDirectSignal;
    }
  | {
      type: SignalType.System;
      value: SystemSignal;
    };

/**
 * @public
 */
export type SignalCb = (signal: DecodedSignal) => void;

/**
 * @public
 */
export interface AppClient {
  callZome(
    args: CallZomeRequest | RoleNameCallZomeRequest,
    timeout?: number,
  ): Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  on<Name extends keyof AppEvents>(
    eventName: Name | readonly Name[],
    listener: SignalCb,
  ): UnsubscribeFunction;

  appInfo(): Promise<AppInfo | null>;

  myPubKey: AgentPubKey;
  installedAppId: InstalledAppId;

  dumpNetworkStats(): Promise<HolochainTransportStats>;
  dumpNetworkMetrics(
    args: AppRequestPayload<"dump_network_metrics">,
  ): Promise<NetworkMetricsMap>;
  createCloneCell(args: CreateCloneCellPayload): Promise<ClonedCell>;
  enableCloneCell(args: EnableCloneCellPayload): Promise<ClonedCell>;
  disableCloneCell(args: DisableCloneCellPayload): Promise<void>;
  sendDirectSignal(
    args: SendDirectSignalRequest,
    timeout?: number,
  ): Promise<void>;
  grantDirectSignalCapability(
    args: AppRequestPayload<"grant_direct_signal_capability">,
    timeout?: number,
  ): Promise<ActionHash>;
}

/**
 * The transport an {@link AppClient} uses to reach the conductor: either a
 * websocket (`WsClient`) or Tauri IPC ({@link TauriAppTransport}). It must
 * carry tagged App API requests and surface `signal` events. This is the only
 * surface {@link AppWebsocket} needs from its transport.
 *
 * @public
 */
export interface AppClientTransport {
  request<Response>(request: unknown): Promise<Response>;
  // Emittery v2 delivers an `{ name, data }` pair to listeners rather than the
  // bare event data, so the transport surface mirrors that. `AppWebsocket`
  // unwraps the pair before invoking the public {@link SignalCb} listeners, so
  // this does not leak into the app client API.
  on(
    eventName: "signal",
    listener: (event: EmitteryEvent<"signal", DecodedSignal>) => void,
  ): UnsubscribeFunction;
}

/**
 * @public
 */
export interface AppWebsocketConnectionOptions extends WebsocketConnectionOptions {
  token?: AppAuthenticationToken;
  callZomeTransform?: CallZomeTransform;
}

/**
 * @public
 */
export type CallZomeTransform = Transformer<
  CallZomeRequest | ZomeCallParamsSigned,
  Promise<ZomeCallParamsSigned>,
  CallZomeResponseGeneric<Uint8Array>,
  CallZomeResponse
>;

/**
 * Arguments for {@link AppWebsocket.sendDirectSignal}.
 *
 * @public
 */
export type SendDirectSignalRequest = {
  /** The network (DNA) the recipients are on. */
  dna_hash: DnaHash;
  /** The agents to deliver the signal to. Must not be empty. */
  agents: Array<AgentPubKey>;
  /**
   * The opaque payload. Up to 1 MiB; Holochain never inspects it. On the wire
   * it travels as a msgpack array of integers, which the client takes care
   * of, so pass plain bytes here.
   */
  signal: Uint8Array;
  /**
   * The secret of the recipients' direct signal capability grant, when their
   * grant carries one. The same secret is offered to every agent in `agents`.
   */
  cap_secret?: CapSecret;
};
