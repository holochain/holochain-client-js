import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import { InstalledAppId, CellId, CellNick } from '../../src/api/types'
import { AppWebsocket } from '../../src/websocket/app'
import { AdminWebsocket } from '../../src/websocket/admin'
import yaml from 'js-yaml'
export const FIXTURE_PATH = './test/e2e/fixture'
export const CONFIG_PATH = `${FIXTURE_PATH}/test-config.yml`
export const CONFIG_PATH_1 = `${FIXTURE_PATH}/test-config-1.yml`

const writeConfig = (port, configPath) : string => {

  const dir = fs.mkdtempSync(`${os.tmpdir()}/holochain-test-`)
  const lairDir = `${dir}/keystore`
  if (!fs.existsSync(lairDir)) {
    fs.mkdirSync(lairDir);
  }

  let yamlStr = yaml.safeDump({
    environment_path: dir,
    passphrase_service: {
      type: 'danger_insecure_from_config',
      passphrase: 'password'
    },
    keystore_path: lairDir,
    admin_interfaces: [{
      driver: {
        type: 'websocket',
        port,
      }
    }]
  });
  fs.writeFileSync(configPath, yamlStr, 'utf8');
  console.info(`using database environment path: ${dir}`)
  return lairDir
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
const LAIR_BIN = 'lair-keystore'

export const launch = async (port, configPath) => {
  const lairDir = await writeConfig(port, configPath)
  console.log(`Spawning lair for test with keystore at:  ${lairDir}`)
  const lairHandle = spawn(LAIR_BIN, ["-d", lairDir], {
    env: {
      // TODO: maybe put this behind a flag?
      "RUST_BACKTRACE": "1",
      ...process.env,
    }
  })
  // Wait for lair to output data such as "#lair-keystore-ready#" before starting holochain
  await new Promise((resolve) => { lairHandle.stdout.once("data", resolve) })

  const handle = spawn(HOLOCHAIN_BIN, ['-c', configPath])
  handle.stdout.on('data', data => {
    console.info('conductor: ', data.toString('utf8'))
  })
  handle.stderr.on('data', data => {
    console.info('conductor> ', data.toString('utf8'))
  })
  await awaitInterfaceReady(handle)
  return [handle,lairHandle]
}

export const withConductor = (port, f) => async t => {
  const [handle, lairHandle] = await launch(port, CONFIG_PATH)
  try {
    await f(t)
  } catch (e) {
    console.error("Test caught exception: ", e)
    lairHandle.kill()
    handle.kill()
    throw e
  } finally {
    lairHandle.kill()
    handle.kill()
  }
  t.end()
}

export const installAppAndDna = async (
  adminPort: number,
  signalCb: (signal: any) => void = () => {}
): Promise<[InstalledAppId, CellId, CellNick, AppWebsocket, AdminWebsocket]> => {
  const installed_app_id = 'app'
  const nick = 'mydna'
  const admin = await AdminWebsocket.connect(`http://localhost:${adminPort}`)

  const path = `${FIXTURE_PATH}/test.dna`;
  const hash = await admin.registerDna({
    path
  })

  console.log("THE HASH:", hash)

  const agent = await admin.generateAgentPubKey()
  const app = await admin.installApp({
    installed_app_id,
    agent_key: agent,
    dnas: [
      {
        hash,
        nick,
      },
    ],
  })
  console.log("THE INSTALL RESULT:", app)
  const cell_id = app.cell_data[0].cell_id
  await admin.activateApp({ installed_app_id })
  // destructure to get whatever open port was assigned to the interface
  const { port: appPort } = await admin.attachAppInterface({ port: 0 })
  const client = await AppWebsocket.connect(`http://localhost:${appPort}`, 12000, signalCb)
    return [installed_app_id, cell_id, nick, client, admin]
}
