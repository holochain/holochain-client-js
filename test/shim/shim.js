const path = require('path')
const log = require('@whi/stdlog')(path.basename(__filename), {
  level: process.env.LOG_LEVEL || 'fatal'
})

const net = require('net')
const { structs, MessageParser } = require('@holochain/lair-client')
const { Codec } = require('@holo-host/cryptolib')
const { decode } = require('@msgpack/msgpack')
let counter = 0;
async function init (lair_socket, shim_socket) {
  log.normal('init wormhole')
  let connections = []

  const shim = net.createServer(async function (conductor_stream) {
    log.info('New conductor connections')
    const lair_stream = net.createConnection(lair_socket)
    const parser = new MessageParser()

    connections.push({
      lair: lair_stream,
      conductor: conductor_stream,
      parser: parser
    })

    lair_stream.pipe(conductor_stream)
    conductor_stream.pipe(parser)

    for await (let header of parser) {
      if (header === null) continue

      if (
        header.wire_type_id ===
        structs.Ed25519.SignByPublicKey.Request.WIRE_TYPE
      ) {
        log.normal('Intercepted sign by public key')
        const request = header.wire_type_class.from(await header.payload())
        const pubkey = request.get(0)
        const message = request.get(1)
        try{
          let decodedMsg = decode(message);
          console.log("Received message: ", decodedMsg);
          console.log("Counter: ", counter);

          // NOTE: Only throws error on second InitZomesComplete signing request
          if (decodedMsg.type == 'InitZomesComplete') {
            if(counter == 1) {
              throw Error()
            }
            counter++
          }
          // Else forward
        } catch(e) {
          log.normal("TIMEOUT!!!");
          continue
        }
      }

      log.normal('Forwarding message to Lair')
      header.forward(lair_stream)
    }
  })
  // Make sure that the socket is accessible to holochain (needs read+write access to connect)
  const prevMask = process.umask(0o000) // 000 on a file results in rw-rw-rw-
  shim.listen(shim_socket)
  // Reset umask and check if it changed since we last set it
  const prevMask2 = process.umask(prevMask)
  if (prevMask2 !== 0o000) {
    log.warn(
      `umask changed unexpectedly during creating of shim. Unexpected umask: ${prevMask2.toString(
        8
      )}`
    )
  }

  return {
    stop () {
      log.normal('Stopping wormhole')
      connections.map(conns => {
        conns.lair.destroy()
        conns.conductor.destroy()
        conns.parser.stop()
      })
      return new Promise(f => shim.close(f))
    }
  }
}

init(path.resolve(__dirname, '../tmp/keystore/socket'), path.resolve(__dirname, '../tmp/shim/socket'))
