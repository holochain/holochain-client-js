import { Requester } from "."

export type InstallDnaRequest = { path: string }
export type InstallDnaResponse = null

export type AddCellRequest = { todo: void }
export type AddCellResponse = { todo: void }

export interface AdminApi {
  installDna: Requester<InstallDnaRequest, InstallDnaResponse>
  addCell: Requester<AddCellRequest, AddCellResponse>
}
