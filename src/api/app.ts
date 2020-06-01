import { Requester } from "./common"

// export type CallZomeRequest = {
//   /// The ID of the [Cell] in which this Zome-call would be invoked
//   cell_id: CellId,
//   /// The name of the Zome containing the function that would be invoked
//   zome_name: ZomeName,
//   /// The capability request authorization required
//   cap: CapSecret,
//   /// The name of the Zome function to call
//   fn_name: String,
//   /// The serialized data to pass an an argument to the Zome call
//   payload: any,
//   /// the provenance of the call
//   provenance: AgentPubKey,
// }
export type CallZomeRequest = { todo: void }
export type CallZomeResponse = { todo: void }

export interface AppApi {
  callZome: Requester<CallZomeRequest, CallZomeResponse>
}
