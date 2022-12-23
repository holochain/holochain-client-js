import { getLauncherEnvironment } from "../../environments/launcher.js";
import {
  CapSecret,
  GrantedFunctions,
  GrantedFunctionsType,
} from "../../hdk/capabilities.js";
import type { AgentPubKey, CellId } from "../../types.js";
import { WsClient } from "../client.js";
import {
  catchError,
  DEFAULT_TIMEOUT,
  promiseTimeout,
  Requester,
  requesterTransformer,
  Transformer,
} from "../common.js";
import {
  generateSigningKeyPair,
  randomCapSecret,
  setSigningCredentials,
} from "../zome-call-signing.js";
import {
  AddAgentInfoRequest,
  AddAgentInfoResponse,
  AdminApi,
  AgentInfoRequest,
  AgentInfoResponse,
  AppStatusFilter,
  AttachAppInterfaceRequest,
  AttachAppInterfaceResponse,
  DeleteCloneCellRequest,
  DeleteCloneCellResponse,
  DisableAppRequest,
  DisableAppResponse,
  DumpFullStateRequest,
  DumpFullStateResponse,
  DumpStateRequest,
  DumpStateResponse,
  EnableAppRequest,
  EnableAppResponse,
  GenerateAgentPubKeyRequest,
  GenerateAgentPubKeyResponse,
  GetDnaDefinitionRequest,
  GetDnaDefinitionResponse,
  GrantZomeCallCapabilityRequest,
  GrantZomeCallCapabilityResponse,
  InstallAppRequest,
  InstallAppResponse,
  ListAppInterfacesRequest,
  ListAppInterfacesResponse,
  ListAppsRequest,
  ListAppsResponse,
  ListCellIdsRequest,
  ListCellIdsResponse,
  ListDnasRequest,
  ListDnasResponse,
  RegisterDnaRequest,
  RegisterDnaResponse,
  StartAppRequest,
  StartAppResponse,
  UninstallAppRequest,
  UninstallAppResponse,
} from "./types.js";

export class AdminWebsocket implements AdminApi {
  readonly client: WsClient;
  defaultTimeout: number;

  private constructor(client: WsClient, defaultTimeout?: number) {
    this.client = client;
    this.defaultTimeout =
      defaultTimeout === undefined ? DEFAULT_TIMEOUT : defaultTimeout;
  }

  static async connect(
    url: string,
    defaultTimeout?: number
  ): Promise<AdminWebsocket> {
    // Check if we are in the launcher's environment, and if so, redirect the url to connect to
    const env = getLauncherEnvironment();

    if (env) {
      url = `ws://127.0.0.1:${env.ADMIN_INTERFACE_PORT}`;
    }

    const wsClient = await WsClient.connect(url);
    return new AdminWebsocket(wsClient, defaultTimeout);
  }

  _requester = <ReqO, ReqI, ResI, ResO>(
    tag: string,
    transformer?: Transformer<ReqO, ReqI, ResI, ResO>
  ) =>
    requesterTransformer(
      (req, timeout) =>
        promiseTimeout(
          this.client.request(req),
          tag,
          timeout || this.defaultTimeout
        ).then(catchError),
      tag,
      transformer
    );

  // the specific request/response types come from the Interface
  // which this class implements
  attachAppInterface: Requester<
    AttachAppInterfaceRequest,
    AttachAppInterfaceResponse
  > = this._requester("attach_app_interface");
  enableApp: Requester<EnableAppRequest, EnableAppResponse> =
    this._requester("enable_app");
  disableApp: Requester<DisableAppRequest, DisableAppResponse> =
    this._requester("disable_app");
  startApp: Requester<StartAppRequest, StartAppResponse> =
    this._requester("start_app");
  dumpState: Requester<DumpStateRequest, DumpStateResponse> = this._requester(
    "dump_state",
    dumpStateTransform
  );
  dumpFullState: Requester<DumpFullStateRequest, DumpFullStateResponse> =
    this._requester("dump_full_state");
  generateAgentPubKey: Requester<
    GenerateAgentPubKeyRequest,
    GenerateAgentPubKeyResponse
  > = this._requester("generate_agent_pub_key");
  registerDna: Requester<RegisterDnaRequest, RegisterDnaResponse> =
    this._requester("register_dna");
  getDnaDefinition: Requester<
    GetDnaDefinitionRequest,
    GetDnaDefinitionResponse
  > = this._requester("get_dna_definition");
  uninstallApp: Requester<UninstallAppRequest, UninstallAppResponse> =
    this._requester("uninstall_app");
  installApp: Requester<InstallAppRequest, InstallAppResponse> =
    this._requester("install_app");
  listDnas: Requester<ListDnasRequest, ListDnasResponse> =
    this._requester("list_dnas");
  listCellIds: Requester<ListCellIdsRequest, ListCellIdsResponse> =
    this._requester("list_cell_ids");
  listApps: Requester<ListAppsRequest, ListAppsResponse> = this._requester(
    "list_apps",
    listAppsTransform
  );
  listAppInterfaces: Requester<
    ListAppInterfacesRequest,
    ListAppInterfacesResponse
  > = this._requester("list_app_interfaces");
  agentInfo: Requester<AgentInfoRequest, AgentInfoResponse> =
    this._requester("agent_info");
  addAgentInfo: Requester<AddAgentInfoRequest, AddAgentInfoResponse> =
    this._requester("add_agent_info");
  deleteCloneCell: Requester<DeleteCloneCellRequest, DeleteCloneCellResponse> =
    this._requester("delete_clone_cell");
  grantZomeCallCapability: Requester<
    GrantZomeCallCapabilityRequest,
    GrantZomeCallCapabilityResponse
  > = this._requester("grant_zome_call_capability");

  // zome call signing related methods

  /**
   * Grant a capability for signing zome calls.
   *
   * @param cellId - The cell to grant the capability for.
   * @param functions - The zome functions to grant the capability for.
   * @param signingKey - The assignee of the capability.
   * @returns The cap secret of the created capability.
   */
  grantSigningKey = async (
    cellId: CellId,
    functions: GrantedFunctions,
    signingKey: AgentPubKey
  ): Promise<CapSecret> => {
    const capSecret = randomCapSecret();
    await this.grantZomeCallCapability({
      cell_id: cellId,
      cap_grant: {
        tag: "zome-call-signing-key",
        functions,
        access: {
          Assigned: {
            secret: capSecret,
            assignees: [signingKey],
          },
        },
      },
    });
    return capSecret;
  };

  /**
   * Generate and authorize a new key pair for signing zome calls.
   *
   * @param cellId - The cell id to create the capability grant for.
   * @param functions - Zomes and functions to authorize the signing key for
   * (optional). When no functions are specified, the capability will be
   * granted for all zomes and functions.
   */
  authorizeSigningCredentials = async (
    cellId: CellId,
    functions?: GrantedFunctions
  ) => {
    const [keyPair, signingKey] = generateSigningKeyPair();
    const capSecret = await this.grantSigningKey(
      cellId,
      functions || { [GrantedFunctionsType.All]: null },
      signingKey
    );
    setSigningCredentials(cellId, { capSecret, keyPair, signingKey });
  };
}

interface InternalListAppsRequest {
  status_filter?:
    | { Running: null }
    | { Enabled: null }
    | { Paused: null }
    | { Disabled: null }
    | { Stopped: null };
}

const listAppsTransform: Transformer<
  ListAppsRequest,
  InternalListAppsRequest,
  ListAppsResponse,
  ListAppsResponse
> = {
  input: (req) => {
    const args: InternalListAppsRequest = {};

    if (req.status_filter) {
      args.status_filter = getAppStatusInApiForm(req.status_filter);
    }

    return args;
  },
  output: (res) => res,
};

const dumpStateTransform: Transformer<
  DumpStateRequest,
  DumpStateRequest,
  string,
  DumpStateResponse
> = {
  input: (req) => req,
  output: (res: string): DumpStateResponse => {
    return JSON.parse(res);
  },
};

function getAppStatusInApiForm(status_filter: AppStatusFilter) {
  switch (status_filter) {
    case AppStatusFilter.Running:
      return {
        Running: null,
      };
    case AppStatusFilter.Enabled:
      return {
        Enabled: null,
      };
    case AppStatusFilter.Paused:
      return {
        Paused: null,
      };
    case AppStatusFilter.Disabled:
      return {
        Disabled: null,
      };
    case AppStatusFilter.Stopped:
      return {
        Stopped: null,
      };
  }
}
