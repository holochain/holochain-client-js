/**
 * Defines AppAgentWebsocket, an easy-to-use websocket implementation of the
 * Conductor API for apps, restricted to a single app provided on initialization
 *
 *    const appWs = AppWebsocket.connect('ws://localhost:9000')
 *
 *    const client = new AppAgentWebsocket(appWs, 'my_installed_app_id')
 *
 *    client.callZome({
 *      role_name: 'my_role_name' // role_name is unique per app, so you can unambiguously identify your dna with role_name in this client,
 *      zome_name: 'zome',
 *      fn_name: 'fn',
 *      payload: { value: 'v' }
 *    })
 *      .then(result => {
 *        console.log('callZome returned with:', result)
 *      })
 *      .catch(err => {
 *        console.error('callZome errored with:', err)
 *      })
 */

import Emittery, { UnsubscribeFunction } from "emittery";
import { omit } from "lodash-es";
import { getLauncherEnvironment } from "../../environments/launcher.js";

import { InstalledAppId } from "../../types.js";
import {
  AppInfoResponse,
  AppWebsocket,
  ArchiveCloneCellResponse,
  CallZomeRequest,
  CallZomeResponse,
  CreateCloneCellResponse,
  AppInfo,
} from "../index.js";
import {
  AppAgentCallZomeRequest,
  AppAgentClient,
  AppAgentEvents,
  AppArchiveCloneCellRequest,
  AppCreateCloneCellRequest,
  RoleNameCallZomeRequest,
} from "./types.js";

export class AppAgentWebsocket implements AppAgentClient {
  appWebsocket: AppWebsocket;
  installedAppId: InstalledAppId;
  cachedAppInfo?: AppInfo;

  emitter = new Emittery<AppAgentEvents>();

  constructor(appWebsocket: AppWebsocket, installedAppId: InstalledAppId) {
    this.appWebsocket = appWebsocket;

    const env = getLauncherEnvironment();
    this.installedAppId = env?.INSTALLED_APP_ID || installedAppId;

    this.appWebsocket.on("signal", (signal) =>
      this.emitter.emit("signal", signal)
    );
  }

  async appInfo(): Promise<AppInfoResponse> {
    const appInfo = await this.appWebsocket.appInfo({
      installed_app_id: this.installedAppId,
    });

    this.cachedAppInfo = appInfo;
    return appInfo;
  }

  async callZome(
    request: AppAgentCallZomeRequest,
    timeout?: number
  ): Promise<CallZomeResponse> {
    const role_name: string | undefined = (request as RoleNameCallZomeRequest)
      .role_name;
    if (role_name) {
      const appInfo = this.cachedAppInfo || (await this.appInfo());
      const cell_id = appInfo.cell_info.find(
        (c) => c.role_name === role_name
      )?.cell_id;

      if (!cell_id) {
        throw new Error(`No cell found with role_name ${role_name}`);
      }

      const callZomeRequest = {
        ...omit(request, "role_name"),
        cell_id,
      };
      return this.appWebsocket.callZome(callZomeRequest, timeout);
    } else if ((request as CallZomeRequest).cell_id) {
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

  async archiveCloneCell(
    args: AppArchiveCloneCellRequest
  ): Promise<ArchiveCloneCellResponse> {
    return this.appWebsocket.archiveCloneCell({
      app_id: this.installedAppId,
      ...args,
    });
  }

  on<Name extends keyof AppAgentEvents>(
    eventName: Name | readonly Name[],
    listener: (eventData: AppAgentEvents[Name]) => void | Promise<void>
  ): UnsubscribeFunction {
    return this.emitter.on(eventName, listener);
  }
}
