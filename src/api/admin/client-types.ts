import type {
  ActionHash,
  AgentPubKey,
  CellId,
  DnaHash,
} from "../../generated/types.js";
import type { AppInfo } from "../../generated/api/app/types.js";
import { Requester } from "../common.js";
import type {
  AdminRequest,
  AdminResponse,
  AppAuthenticationTokenIssued,
  AppCapGrantInfo,
  AppInterfaceInfo,
  DeleteCloneCellPayload,
  DnaDef,
  FullStateDump,
  GrantZomeCallCapabilityPayload,
  HolochainTransportStats,
  InstallAppPayload,
  IssueAppAuthenticationTokenPayload,
  JsonDump,
  NetworkMetricsMap,
  PeerMetaInfoMap,
  StorageInfo,
} from "../../generated/api/admin/types.js";

/**
 * The discriminant of a {@link CellInfo} variant.
 *
 * @public
 */
export enum CellType {
  Provisioned = "provisioned",
  Cloned = "cloned",
  Stem = "stem",
}

/**
 * The payload carried by the {@link AdminRequest} variant tagged `Tag`, or
 * `void` when that variant carries no payload.
 *
 * @public
 */
export type AdminRequestPayload<Tag extends AdminRequest["type"]> =
  Extract<AdminRequest, { type: Tag }> extends { value: infer Payload }
    ? Payload
    : void;

/**
 * The payload carried by the {@link AdminResponse} variant tagged `Tag`, or
 * `void` when that variant carries no payload.
 *
 * @public
 */
export type AdminResponsePayload<Tag extends AdminResponse["type"]> =
  Extract<AdminResponse, { type: Tag }> extends { value: infer Payload }
    ? Payload
    : void;

/**
 * The value returned by the `dump_state` admin call: the structured cell state
 * dump, followed by its human-readable summary string.
 *
 * Unlike every other admin response, this data does not travel over the msgpack
 * wire: `AdminResponse::StateDumped` carries a `serde_json` string that the
 * client parses itself. `serde_json` renders Rust byte sequences as arrays of
 * numbers, so every byte-bearing field reachable from {@link JsonDump} — hashes,
 * signatures, entry bytes — arrives here as a plain `number[]` at runtime, even
 * though the generated types declare `Uint8Array` for the msgpack wire form.
 *
 * @public
 */
export type StateDump = [JsonDump, string];

/**
 * @public
 */
export interface AdminApi {
  attachAppInterface: Requester<
    AdminRequestPayload<"attach_app_interface">,
    AdminResponsePayload<"app_interface_attached">
  >;
  enableApp: Requester<AdminRequestPayload<"enable_app">, AppInfo>;
  disableApp: Requester<AdminRequestPayload<"disable_app">, void>;
  dumpState: Requester<AdminRequestPayload<"dump_state">, StateDump>;
  dumpFullState: Requester<
    AdminRequestPayload<"dump_full_state">,
    FullStateDump
  >;
  generateAgentPubKey: Requester<void, AgentPubKey>;
  getDnaDefinition: Requester<CellId, DnaDef>;
  uninstallApp: Requester<AdminRequestPayload<"uninstall_app">, void>;
  installApp: Requester<InstallAppPayload, AppInfo>;
  listDnas: Requester<void, Array<DnaHash>>;
  listCellIds: Requester<void, Array<CellId>>;
  listApps: Requester<AdminRequestPayload<"list_apps">, Array<AppInfo>>;
  listAppInterfaces: Requester<void, Array<AppInterfaceInfo>>;
  agentInfo: Requester<AdminRequestPayload<"agent_info">, Array<string>>;
  addAgentInfo: Requester<AdminRequestPayload<"add_agent_info">, void>;
  peerMetaInfo: Requester<
    AdminRequestPayload<"peer_meta_info">,
    PeerMetaInfoMap
  >;
  deleteCloneCell: Requester<DeleteCloneCellPayload, void>;
  grantZomeCallCapability: Requester<
    GrantZomeCallCapabilityPayload,
    ActionHash
  >;
  revokeZomeCallCapability: Requester<
    AdminRequestPayload<"revoke_zome_call_capability">,
    void
  >;
  listCapabilityGrants: Requester<
    AdminRequestPayload<"list_capability_grants">,
    AppCapGrantInfo
  >;
  storageInfo: Requester<void, StorageInfo>;
  issueAppAuthenticationToken: Requester<
    IssueAppAuthenticationTokenPayload,
    AppAuthenticationTokenIssued
  >;
  dumpNetworkStats: Requester<void, HolochainTransportStats>;
  dumpNetworkMetrics: Requester<
    AdminRequestPayload<"dump_network_metrics">,
    NetworkMetricsMap
  >;
}
