import {AdminWebsocket} from './src/websocket/admin'

const connect = async () => {
  const ws = await AdminWebsocket.connect('ws://localhost:49677')
  const cells = await ws.listCellIds()
  const dnaHash = cells[0][0]
  console.log('cells', dnaHash)
  await ws.client.close()
}

connect()
// const a = Uint8Array.from([257])
// console.log('a', a)
// const agentInfo = await ws.requestAgentInfo({cell_id:})