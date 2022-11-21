import { EventEmitter } from 'events'
import { CellId, RoleId } from '../..'
import {
  CallZomeRequest,
  AppInfoResponse
} from '../app'

export type AppAgentCallZomeRequest = Omit<CallZomeRequest, "cell_id"> & ({
  role_id?: RoleId,
  cell_id?: CellId
})

export interface AppAgentClient extends EventEmitter {
  callZome(args: AppAgentCallZomeRequest): Promise<any>;
  appInfo(): Promise<AppInfoResponse>
}