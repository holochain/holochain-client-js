import {
  AgentPubKey,
  CellId,
  DnaHash,
  HeaderHash,
  KitsuneAgent,
  KitsuneSpace,
  Signature,
} from "../types/common";
import { DhtOp } from "../types/dht-ops";
import { Entry } from "../types/entry";
import { Header } from "../types/header";

export interface AgentInfoDump {
  kitsune_agent: KitsuneAgent;
  kitsune_space: KitsuneSpace;
  dump: string;
}

export interface P2pAgentsDump {
  /// The info of this agents cell.
  this_agent_info: AgentInfoDump | undefined;
  /// The dna as a [`DnaHash`] and [`kitsune_p2p::KitsuneSpace`].
  this_dna: [DnaHash, KitsuneSpace] | undefined;
  /// The agent as [`AgentPubKey`] and [`kitsune_p2p::KitsuneAgent`].
  this_agent: [AgentPubKey, KitsuneAgent] | undefined;
  /// All other agent info.
  peers: Array<AgentInfoDump>;
}

export interface FullIntegrationStateDump {
  validation_limbo: Array<DhtOp>;
  integration_limbo: Array<DhtOp>;
  integrated: Array<DhtOp>;

  dht_ops_cursor: number;
}

export interface SourceChainJsonElement {
  signature: Signature;
  header_address: HeaderHash;
  header: Header;
  entry: Entry | undefined;
}

export interface SourceChainJsonDump {
  elements: Array<SourceChainJsonElement>;
  published_ops_count: number;
}

export interface FullStateDump {
  peer_dump: P2pAgentsDump;
  source_chain_dump: SourceChainJsonDump;
  integration_dump: FullIntegrationStateDump;
}
