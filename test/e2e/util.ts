import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import { InstalledAppId, CellId, CellNick } from '../../src/api/types'
import { AppWebsocket } from '../../src/websocket/app'
import { AdminWebsocket } from '../../src/websocket/admin'
import yaml from 'js-yaml'
const CONFIG_PATH = './test/e2e/fixture/test-config.yml'

const writeConfig = (port) => {

  const dir = fs.mkdtempSync(`${os.tmpdir()}/holochain-test-`)
  let yamlStr = yaml.safeDump({
    environment_path: dir,
    passphrase_service: {
      type: 'cmd'
    },
    admin_interfaces: [{
      driver: {
        type: 'websocket',
        port,
      }
    }]
  });
  fs.writeFileSync(CONFIG_PATH, yamlStr, 'utf8');
  console.info(`using LMDB environment path: ${dir}`)
}

const awaitInterfaceReady = (handle): Promise<null> => new Promise((fulfill, reject) => {
  const pattern = 'Conductor ready.'
  let resolved = false
  handle.on('close', code => {
    resolved = true
    console.info(`Conductor exited with code ${code}`)
    reject(`Conductor exited before starting interface (code ${code})`)
  })
  handle.stdout.on('data', data => {
    if (resolved) {
      return
    }
    const line = data.toString('utf8')
    if (line.match(pattern)) {
      console.info(`Conductor process spawning completed.`)
      resolved = true
      fulfill()
    }
  })
})

const HOLOCHAIN_BIN = 'holochain'

const launch = async (port) => {
  await writeConfig(port)
  const handle = spawn(HOLOCHAIN_BIN, ['-c', CONFIG_PATH])
  handle.stdout.on('data', data => {
    console.info('conductor: ', data.toString('utf8'))
  })
  handle.stderr.on('data', data => {
    console.info('conductor> ', data.toString('utf8'))
  })
  await awaitInterfaceReady(handle)
  return handle
}

export const withConductor = (port, f) => async t => {
  const handle = await launch(port)
  try {
    await f(t)
  } catch (e) {
    console.error("Test caught exception: ", e)
    handle.kill()
    throw e
  } finally {
    handle.kill()
  }
  t.end()
}

export const installAppAndDna = async (
  adminPort: number,
  signalCb: (signal: any) => void = () => {}
): Promise<[InstalledAppId, CellId, CellNick, AppWebsocket]> => {
  const installed_app_id = 'app'
  const nick = 'mydna'
  const admin = await AdminWebsocket.connect(`http://localhost:${adminPort}`)
  const agent = await admin.generateAgentPubKey()
  const app = await admin.installApp({
    installed_app_id,
    agent_key: agent,
    dnas: [
      {
        path: 'test/e2e/fixture/test.dna.gz',
        nick,
      },
    ],
  })
  const cell_id = app.cell_data[0][0]
  await admin.activateApp({ installed_app_id })
  // destructure to get whatever open port was assigned to the interface
  const { port: appPort } = await admin.attachAppInterface({ port: 0 })
  const client = await AppWebsocket.connect(`http://localhost:${appPort}`, signalCb)
  return [installed_app_id, cell_id, nick, client]
}
