import { Requester, Tagged } from "./common"

export type InstallDnaRequest = { path: string }
export type InstallDnaResponse = null

export type ListDnasRequest = null
export type ListDnasResponse = Array<string>


export interface AdminApi {
  installDna: Requester<InstallDnaRequest, InstallDnaResponse>
  listDnas: Requester<ListDnasRequest, ListDnasResponse>
}
