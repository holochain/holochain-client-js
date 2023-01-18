import Emittery, { UnsubscribeFunction } from "emittery";
import { omit } from "lodash-es";
import { getLauncherEnvironment } from "../../environments/launcher.js";

import { AgentPubKey, CellId, InstalledAppId, RoleName } from "../../types.js";
import { getBaseRoleNameFromCloneId, isCloneId } from "../common.js";
import {
  AppInfo,
  AppSignal,
  AppSignalCb,
  AppWebsocket,
  CallZomeRequest,
  CallZomeResponse,
  CellType,
  CreateCloneCellResponse,
  DisableCloneCellResponse,
  EnableCloneCellResponse,
} from "../index.js";
import {
  AppAgentCallZomeRequest,
  AppAgentClient,
  AppAgentEvents,
  AppCreateCloneCellRequest,
  AppDisableCloneCellRequest,
  AppEnableCloneCellRequest,
} from "./types.js";

function getPubKey(appInfo: AppInfo): AgentPubKey {
  // This is fine for now cause `UseExisting` as a provisioning strategy doesn't work yet.
  // TODO: change this when AppInfo contains the `AgentPubKey` for this app, like `return appInfo.my_pub_key`

  for (const cells of Object.values(appInfo.cell_info)) {
    for (const cell of cells) {
      if (CellType.Provisioned in cell) {
        return cell.Provisioned.cell_id[1];
      } else if (CellType.Cloned in cell) {
        return cell.Cloned.cell_id[1];
      }
    }
  }

  throw new Error(
    `This app doesn't have any cells, so we can't return the agent public key for it. This is a known issue, and is going to be fixed in the near future.`
  );
}

/**
 * A class to establish a websocket connection to an App interface, for a
 * specific agent and app.
 *
 * @public
 */
export class AppAgentWebsocket implements AppAgentClient {
  readonly appWebsocket: AppWebsocket;
  installedAppId: InstalledAppId;
  cachedAppInfo?: AppInfo;
  readonly emitter: Emittery<AppAgentEvents>;

  private constructor(
    appWebsocket: AppWebsocket,
    installedAppId: InstalledAppId,
    public myPubKey: AgentPubKey
  ) {
    this.appWebsocket = appWebsocket;
    this.emitter = new Emittery<AppAgentEvents>();

    const env = getLauncherEnvironment();
    this.installedAppId = env?.INSTALLED_APP_ID || installedAppId;

    this.appWebsocket.on("signal", (signal: AppSignal) => {
      if (this.containsCell(signal.cell_id)) {
        this.emitter.emit("signal", signal);
      }
    });
  }

  async appInfo() {
    const appInfo = await this.appWebsocket.appInfo({
      installed_app_id: this.installedAppId,
    });

    this.cachedAppInfo = appInfo;
    return appInfo;
  }

  static async connect(
    url: string,
    installed_app_id: InstalledAppId,
    defaultTimeout?: number
  ) {
    const appWebsocket = await AppWebsocket.connect(url, defaultTimeout);
    const appInfo = await appWebsocket.appInfo({
      installed_app_id: installed_app_id,
    });

    const myPubKey = getPubKey(appInfo);

    const appAgentWs = new AppAgentWebsocket(
      appWebsocket,
      installed_app_id,
      myPubKey
    );
    appAgentWs.cachedAppInfo = appInfo;

    return appAgentWs;
  }

  getCellIdFromRoleName(roleName: RoleName, appInfo: AppInfo) {
    if (isCloneId(roleName)) {
      const baseRoleName = getBaseRoleNameFromCloneId(roleName);
      if (!(baseRoleName in appInfo.cell_info)) {
        throw new Error(`No cell found with role_name ${roleName}`);
      }
      const cloneCell = appInfo.cell_info[baseRoleName].find(
        (c) => CellType.Cloned in c && c.Cloned.clone_id === roleName
      );
      if (!cloneCell || !(CellType.Cloned in cloneCell)) {
        throw new Error(`No clone cell found with clone id ${roleName}`);
      }
      return cloneCell.Cloned.cell_id;
    }

    if (!(roleName in appInfo.cell_info)) {
      throw new Error(`No cell found with role_name ${roleName}`);
    }
    const cell = appInfo.cell_info[roleName].find(
      (c) => CellType.Provisioned in c
    );
    if (!cell || !(CellType.Provisioned in cell)) {
      throw new Error(`No provisioned cell found with role_name ${roleName}`);
    }
    return cell[CellType.Provisioned].cell_id;
  }

  async callZome(
    request: AppAgentCallZomeRequest,
    timeout?: number
  ): Promise<CallZomeResponse> {
    if (!("provenance" in request)) {
      request = {
        ...request,
        provenance: this.myPubKey,
      };
    }
    if ("role_name" in request && request.role_name) {
      const appInfo = this.cachedAppInfo || (await this.appInfo());
      const cell_id = this.getCellIdFromRoleName(request.role_name, appInfo);
      const zomeCallPayload: CallZomeRequest = {
        ...omit(request, "role_name"),
        provenance: this.myPubKey,
        cell_id,
      };
      return this.appWebsocket.callZome(zomeCallPayload, timeout);
    } else if ("cell_id" in request && request.cell_id) {
      return this.appWebsocket.callZome(request as CallZomeRequest, timeout);
    } else {
      throw new Error("callZome requires a role_name or cell_id arg");
    }
  }

  async createCloneCell(
    args: AppCreateCloneCellRequest
  ): Promise<CreateCloneCellResponse> {
    const clonedCell = this.appWebsocket.createCloneCell({
      app_id: this.installedAppId,
      ...args,
    });

    this.cachedAppInfo = undefined;

    return clonedCell;
  }

  async enableCloneCell(
    args: AppEnableCloneCellRequest
  ): Promise<EnableCloneCellResponse> {
    return this.appWebsocket.enableCloneCell({
      app_id: this.installedAppId,
      ...args,
    });
  }

  async disableCloneCell(
    args: AppDisableCloneCellRequest
  ): Promise<DisableCloneCellResponse> {
    return this.appWebsocket.disableCloneCell({
      app_id: this.installedAppId,
      ...args,
    });
  }

  on<Name extends keyof AppAgentEvents>(
    eventName: Name | readonly Name[],
    listener: AppSignalCb
  ): UnsubscribeFunction {
    return this.emitter.on(eventName, listener);
  }

  private containsCell(cellId: CellId) {
    const appInfo = this.cachedAppInfo;
    if (!appInfo) {
      return false;
    }
    for (const roleName of Object.keys(appInfo.cell_info)) {
      for (const cellInfo of appInfo.cell_info[roleName]) {
        const currentCellId =
          CellType.Provisioned in cellInfo
            ? cellInfo[CellType.Provisioned].cell_id
            : CellType.Cloned in cellInfo
            ? cellInfo[CellType.Cloned].cell_id
            : undefined;
        if (currentCellId && isSameCell(currentCellId, cellId)) {
          return true;
        }
      }
    }
    return false;
  }
}

const isSameCell = (cellId1: CellId, cellId2: CellId) =>
  cellId1[0].every((byte, index) => byte === cellId2[0][index]) &&
  cellId1[1].every((byte, index) => byte === cellId2[1][index]);
