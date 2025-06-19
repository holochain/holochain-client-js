import { UnsubscribeFunction } from "emittery";
import {
  AgentPubKey,
  AppAuthenticationToken,
  AppInfo,
  CapSecret,
  CellId,
  ClonedCell,
  DnaHash,
  DnaProperties,
  EntryHash,
  FunctionName,
  InstalledAppId,
  MembraneProof,
  MemproofMap,
  NetworkSeed,
  Nonce256Bit,
  RoleName,
  Timestamp,
  Transformer,
  WebsocketConnectionOptions,
  ZomeName,
  PreflightRequest,
  SignedAction,
  SignedActionHashed,
  DumpNetworkStatsResponse,
  DumpNetworkMetricsResponse,
  DumpNetworkMetricsRequest,
} from "../../index.js";

/**
 * @public
 */
export interface AppEvents {
  signal: Signal;
}

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
export interface CallZomeRequestSigned {
  bytes: Uint8Array;
  signature: Uint8Array;
}

/**
 * @public
 */
export type CallZomeResponseGeneric<Payload> = Payload;
/**
 * @public
 */
export type CallZomeResponse = CallZomeResponseGeneric<any>;

/**
 * @public
 */
export type AppInfoResponse = AppInfo | null;

/**
 * @public
 */
export type ProvideMemproofsRequest = MemproofMap;
/**
 * @public
 */
export type ProvideMemproofsResponse = void;
/**
 * @public
 */
export type EnableRequest = void;
/**
 * @public
 */
export type EnableResponse = void;

/**
 * @public
 */
export interface CreateCloneCellRequest {
  /**
   * The DNA's role id to clone.
   */
  role_name: RoleName;
  /**
   * Modifiers to set for the new cell.
   * At least one of the modifiers must be set to obtain a distinct hash for
   * the clone cell's DNA.
   */
  modifiers: {
    /**
     * The network seed of a DNA is included in the computation of the DNA hash.
     * The DNA hash in turn determines the network peers and the DHT, meaning
     * that only peers with the same DNA hash of a shared DNA participate in the
     * same network and co-create the DHT. To create a separate DHT for the DNA,
     * a unique network seed can be specified.
     */
    network_seed?: NetworkSeed;
    /**
     * Any arbitrary application properties can be included in this object to
     * override the DNA properties.
     */
    properties?: DnaProperties;
  };
  /**
   * Optionally set a proof of membership for the new cell.
   */
  membrane_proof?: MembraneProof;
  /**
   * Optionally a name for the DNA clone.
   */
  name?: string;
}
/**
 * @public
 */
export type CreateCloneCellResponse = ClonedCell;

/**
 * @public
 */
export type CloneId = string;

/**
 * @public
 */
export type CloneCellId =
  | {
      type: "clone_id";
      value: CloneId;
    }
  | {
      type: "dna_hash";
      value: DnaHash;
    };

/**
 * @public
 */
export interface DisableCloneCellRequest {
  /**
   * The clone id or cell id of the clone cell
   */
  clone_cell_id: CloneCellId;
}
/**
 * @public
 */
export type DisableCloneCellResponse = void;

/**
 * @public
 */
export type EnableCloneCellRequest = DisableCloneCellRequest;
/**
 * @public
 */
export type EnableCloneCellResponse = CreateCloneCellResponse;

/**
 * Cell id for which the countersigning session state is requested.
 *
 * @public
 */
export type GetCountersigningSessionStateRequest = CellId;

/**
 * @public
 */
export type GetCountersigningSessionStateResponse =
  null | CountersigningSessionState;

/**
 * Cell id for which the countersigning session should be abandoned.
 *
 * @public
 */
export type AbandonCountersigningSessionStateRequest = CellId;

/**
 * @public
 */
export type AbandonCountersigningSessionStateResponse = null;

/**
 * Cell id for which the countersigning session should be published.
 *
 * @public
 */
export type PublishCountersigningSessionStateRequest = CellId;

/**
 * @public
 */
export type PublishCountersigningSessionStateResponse = null;

/**
 * @public
 */
export enum CountersigningSessionStateType {
  Accepted = "Accepted",
  SignaturesCollected = "SignaturesCollected",
  Unknown = "Unknown",
}

/**
 * @public
 */
export type CountersigningSessionState =
  /**
   * This is the entry state. Accepting a countersigning session through the HDK will immediately
   * register the countersigning session in this state, for management by the countersigning workflow.
   *
   * The session will stay in this state even when the agent commits their countersigning entry and only
   * move to the next state when the first signature bundle is received.
   */
  | { [CountersigningSessionStateType.Accepted]: PreflightRequest }
  /**
   * This is the state where we have collected one or more signatures for a countersigning session.
   *
   * This state can be entered from the [CountersigningSessionState::Accepted] state, which happens
   * when a witness returns a signature bundle to us. While the session has not timed out, we will
   * stay in this state and wait until one of the signatures bundles we have received is valid for
   * the session to be completed.
   *
   * If we entered this state from the [CountersigningSessionState::Accepted] state, we will either
   * complete the session successfully or the session will time out. On a timeout we will move
   * to the [CountersigningSessionState::Unknown] for a limited number of attempts to recover the session.
   *
   * This state can also be entered from the [CountersigningSessionState::Unknown] state, which happens when we
   * have been able to recover the session from the source chain and have requested signed actions
   * from agent authorities to build a signature bundle.
   *
   * If we entered this state from the [CountersigningSessionState::Unknown] state, we will either
   * complete the session successfully, or if the signatures are invalid, we will return to the
   * [CountersigningSessionState::Unknown] state.
   */
  | {
      [CountersigningSessionStateType.SignaturesCollected]: {
        /** The preflight request that has been exchanged among countersigning peers. */
        preflight_request: PreflightRequest;
        /** Signed actions of the committed countersigned entries of all participating peers. */
        signature_bundles: SignedAction[][];
        /**
         * This field is set when the signature bundle came from querying agent activity authorities
         * in the unknown state. If we started from that state, we should return to it if the
         * signature bundle is invalid. Otherwise, stay in this state and wait for more signatures.
         */
        resolution?: SessionResolutionSummary;
      };
    }
  /**
   * The session is in an unknown state and needs to be resolved.
   *
   * This state is used when we have lost track of the countersigning session. This happens if
   * we have got far enough to create the countersigning entry but have crashed or restarted
   * before we could complete the session. In this case we need to try to discover what the other
   * agent or agents involved in the session have done.
   *
   * This state is also entered temporarily when we have published a signature and then the
   * session has timed out. To avoid deadlocking with two parties both waiting for each other to
   * proceed, we cannot stay in this state indefinitely. We will make a limited number of attempts
   * to recover and if we cannot, we will abandon the session.
   *
   * The only exception to the attempt limiting is if we are unable to reach agent activity authorities
   * to progress resolving the session. In this case, the attempts are not counted towards the
   * configured limit. This does not protect us against a network partition where we can only see
   * a subset of the network, but it does protect us against Holochain forcing a decision while
   * it is unable to reach any peers.
   *
   * Note that because the [PreflightRequest] is stored here, we only ever enter the unknown state
   * if we managed to keep the preflight request in memory, or if we have been able to recover it
   * from the source chain as part of the committed [CounterSigningSessionData]. Otherwise, we
   * are unable to discover what session we were participating in, and we must abandon the session
   * without going through this recovery state.
   */
  | {
      [CountersigningSessionStateType.Unknown]: {
        /** The preflight request that has been exchanged. */
        preflight_request: PreflightRequest;
        /** Summary of the attempts to resolve this session. */
        resolution: SessionResolutionSummary;
        /** Flag if the session is programmed to be force-abandoned on the next countersigning workflow run. */
        force_abandon: boolean;
        /** Flag if the session is programmed to be force-published on the next countersigning workflow run. */
        force_publish: boolean;
      };
    };

/**
 * Summary of the workflow's attempts to resolve the outcome a failed countersigning session.
 * This tracks the numbers of attempts and the outcome of the most recent attempt.
 *
 * @public
 */
export interface SessionResolutionSummary {
  /** The reason why session resolution is required. */
  required_reason: ResolutionRequiredReason;
  /**
   * How many attempts have been made to resolve the session.
   *
   * Attempts are made according to the frequency specified by [RETRY_UNKNOWN_SESSION_STATE_DELAY].
   *
   * This count is only correct for the current run of the Holochain conductor. If the conductor
   * is restarted then this counter is also reset.
   */
  attempts: number;
  /** The time of the last attempt to resolve the session. */
  last_attempt_at?: Timestamp;
  /** The outcome of the most recent attempt to resolve the session. */
  outcomes: SessionResolutionOutcome[];
}

/**
 * The reason why a countersigning session can not be resolved automatically and requires manual resolution.
 *
 * @public
 */
export enum ResolutionRequiredReason {
  /** The session has timed out, so we should try to resolve its state before abandoning. */
  Timeout = "Timeout",
  /** Something happened, like a conductor restart, and we lost track of the session. */
  Unknown = "Unknown",
}

/**
 * The outcome for a single agent who participated in a countersigning session.
 *
 * [NUM_AUTHORITIES_TO_QUERY] authorities are made to agent activity authorities for each agent,
 * and the decisions are collected into [SessionResolutionOutcome::decisions].
 *
 * @public
 */
export interface SessionResolutionOutcome {
  /**
   * The agent who participated in the countersigning session and is the subject of this
   * resolution outcome.
   */
  agent: AgentPubKey;
  /** The resolved decision for each authority for the subject agent. */
  decisions: SessionCompletionDecision[];
}

/**
 * Decision about an incomplete countersigning session.
 *
 * @public
 */
export enum SessionCompletionDecisionType {
  /** Evidence found on the network that this session completed successfully. */
  Complete = "Complete",
  /**
   * Evidence found on the network that this session was abandoned and other agents have
   * added to their chain without completing the session.
   */
  Abandoned = "Abandoned",
  /**
   * No evidence, or inconclusive evidence, was found on the network. Holochain will not make an
   * automatic decision until the evidence is conclusive.
   */
  Indeterminate = "Indeterminate",
  /**There were errors encountered while trying to resolve the session. Errors such as network
   * errors are treated differently to inconclusive evidence. We don't want to force a decision
   * when we're offline, for example. In this case, the resolution must be retried later and this
   * attempt should not be counted.
   */
  Failed = "Failed",
}

/**
 * @public
 */
export type SessionCompletionDecision =
  | { [SessionCompletionDecisionType.Complete]: SignedActionHashed }
  | SessionCompletionDecisionType.Abandoned
  | SessionCompletionDecisionType.Indeterminate
  | SessionCompletionDecisionType.Failed;

/**
 * @public
 */
export enum SignalType {
  App = "app",
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
      type: SignalType.System;
      value: SystemSignal;
    };

/**
 * @public
 */
export type Signal =
  | {
      type: SignalType.App;
      value: AppSignal;
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
 * @public
 */
export type AppSignal = {
  cell_id: CellId;
  zome_name: string;
  payload: unknown;
};

/**
 * @public
 */
export type SystemSignal = { SuccessfulCountersigning: EntryHash };

/**
 * @public
 */
export type SignalCb = (signal: Signal) => void;

/**
 * @public
 */
export interface AppClient {
  callZome(
    args: CallZomeRequest | RoleNameCallZomeRequest,
    timeout?: number
  ): Promise<any>;

  on<Name extends keyof AppEvents>(
    eventName: Name | readonly Name[],
    listener: SignalCb
  ): UnsubscribeFunction;

  appInfo(): Promise<AppInfoResponse>;

  myPubKey: AgentPubKey;
  installedAppId: InstalledAppId;

  dumpNetworkStats(): Promise<DumpNetworkStatsResponse>;
  dumpNetworkMetrics(
    args: DumpNetworkMetricsRequest
  ): Promise<DumpNetworkMetricsResponse>;
  createCloneCell(
    args: CreateCloneCellRequest
  ): Promise<CreateCloneCellResponse>;
  enableCloneCell(
    args: EnableCloneCellRequest
  ): Promise<EnableCloneCellResponse>;
  disableCloneCell(
    args: DisableCloneCellRequest
  ): Promise<DisableCloneCellResponse>;
}

/**
 * @public
 */
export interface AppWebsocketConnectionOptions
  extends WebsocketConnectionOptions {
  token?: AppAuthenticationToken;
  callZomeTransform?: CallZomeTransform;
}

/**
 * @public
 */
export type CallZomeTransform = Transformer<
  CallZomeRequest | CallZomeRequestSigned,
  Promise<CallZomeRequestSigned>,
  CallZomeResponseGeneric<Uint8Array>,
  CallZomeResponse
>;
