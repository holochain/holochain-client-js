
import * as TOML from '@iarna/toml'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const CONFIG_PATH = './test/e2e/fixture/test-config.toml'

const writeConfig = (port) => {

  const dir = fs.mkdtempSync(`${os.tmpdir()}/holochain-test-`)
  fs.writeFileSync(CONFIG_PATH, TOML.stringify({
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
  }))
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

const HOLOCHAIN_BIN = path.join(__dirname, '../..', 'holochain')

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
