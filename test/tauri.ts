import { decode, encode } from "@msgpack/msgpack";
import test from "tape";
import {
  AppWebsocket,
  encodeHashToBase64,
  getTauriHolochainEnvironment,
  isTauriHolochain,
  TauriAppTransport,
} from "../src/index.js";

// These are pure unit tests: they mock Tauri's `window.__TAURI_INTERNALS__.invoke`
// and never open a websocket or start a conductor. They lock in the contract
// between the JS transport and the plugin's `app_request` command — that the
// same msgpack `{ type, value }` payloads the websocket carries are moved over
// Tauri IPC instead.

// A throwaway 39-byte value standing in for a HoloHash.
const fakeHash = (fill: number) => Uint8Array.from(new Array(39).fill(fill));

// Minimal msgpack encoders for hand-crafting a map with a *binary* key, the
// way Rust (rmp) serializes a HashMap keyed by a HoloHash. @msgpack/msgpack's
// encode() cannot produce a binary-keyed map from JS (a JS Map serializes as
// empty), so we build the bytes directly.
const mpStr = (s: string) => {
  const b = Array.from(new TextEncoder().encode(s));
  return [0xa0 | b.length, ...b]; // fixstr, len < 32
};
const mpBin = (b: Uint8Array) => [0xc4, b.length, ...Array.from(b)]; // bin8, len < 256

test("isTauriHolochain detects the plugin webview environment", (t) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window = {};
  t.notOk(isTauriHolochain(), "false with no markers");

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window.__TAURI_INTERNALS__ = { invoke: async () => [] };
  t.notOk(isTauriHolochain(), "false with only the Tauri bridge");

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window.__HC_TAURI_HOLOCHAIN__ = { INSTALLED_APP_ID: "my-app" };
  t.ok(
    isTauriHolochain(),
    "true with both the bridge and the holochain marker",
  );
  t.equal(
    getTauriHolochainEnvironment()?.INSTALLED_APP_ID,
    "my-app",
    "exposes the injected environment",
  );

  t.end();
});

test("TauriAppTransport.request encodes the request, invokes the plugin command, and decodes the response", async (t) => {
  let capturedCmd: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let capturedArgs: any;
  const responseTagged = {
    type: "app_info",
    value: { installed_app_id: "my-app" },
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window = {
    __TAURI_INTERNALS__: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: async (cmd: string, args: any) => {
        capturedCmd = cmd;
        capturedArgs = args;
        return Array.from(encode(responseTagged));
      },
    },
  };

  const transport = new TauriAppTransport("holochain");
  const requestTagged = { type: "app_info", value: null };
  const result = await transport.request(requestTagged);

  t.equal(
    capturedCmd,
    "plugin:holochain|app_request",
    "calls the plugin's app_request command",
  );
  t.ok(Array.isArray(capturedArgs.request), "request is sent as a byte array");
  t.notOk(
    "appId" in capturedArgs,
    "no app id is sent — the conductor scopes the request to the window",
  );
  t.deepEqual(
    decode(Uint8Array.from(capturedArgs.request)),
    requestTagged,
    "the bytes on the wire are the msgpack of the tagged request",
  );
  t.deepEqual(result, responseTagged, "returns the decoded tagged response");
});

test("TauriAppTransport.request converts byte-array map keys to Base64, like the websocket client", async (t) => {
  const hashKey = fakeHash(7);
  // { type: "agent_info", value: { <hashKey bytes>: 42 } } as Rust would serialize it.
  const responseBytes = Uint8Array.from([
    0x82, // map, 2 entries
    ...mpStr("type"),
    ...mpStr("agent_info"),
    ...mpStr("value"),
    0x81, // map, 1 entry
    ...mpBin(hashKey),
    42, // positive fixint
  ]);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window = {
    __TAURI_INTERNALS__: {
      invoke: async () => Array.from(responseBytes),
    },
  };

  const transport = new TauriAppTransport("holochain");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await transport.request({
    type: "agent_info",
    value: null,
  });

  t.equal(
    result.value[encodeHashToBase64(hashKey)],
    42,
    "a HoloHash map key is decoded to its Base64 form",
  );
});

test("AppWebsocket.connect uses the Tauri transport in a Tauri webview", async (t) => {
  const agentKey = fakeHash(1);
  let invokedCmd: string | undefined;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window = {
    __HC_TAURI_HOLOCHAIN__: {
      INSTALLED_APP_ID: "my-app",
      PLUGIN_NAME: "holochain",
    },
    __TAURI_INTERNALS__: {
      invoke: async (cmd: string) => {
        invokedCmd = cmd;
        return Array.from(
          encode({
            type: "app_info",
            value: {
              agent_pub_key: agentKey,
              installed_app_id: "my-app",
              cell_info: {},
            },
          }),
        );
      },
    },
  };

  const appWs = await AppWebsocket.connect();

  t.ok(
    appWs.client instanceof TauriAppTransport,
    "the AppWebsocket is backed by the Tauri transport, not a websocket",
  );
  t.equal(
    appWs.installedAppId,
    "my-app",
    "installed app id comes from app_info",
  );
  t.equal(
    encodeHashToBase64(appWs.myPubKey),
    encodeHashToBase64(agentKey),
    "agent key comes from app_info",
  );
  t.equal(
    invokedCmd,
    "plugin:holochain|app_request",
    "app_info was fetched through the plugin command",
  );
});

test("AppWebsocket.callZome signs with the host signer and routes the call over Tauri IPC", async (t) => {
  let signerCalled = false;
  let callZomeSeen = false;
  const zomeResult = ["post-a", "post-b"];
  const fakeSigned = {
    bytes: Uint8Array.from([1, 2, 3]),
    signature: Uint8Array.from([4, 5, 6]),
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window = {
    __HC_TAURI_HOLOCHAIN__: { INSTALLED_APP_ID: "my-app" },
    __HC_ZOME_CALL_SIGNER__: {
      signZomeCall: async () => {
        signerCalled = true;
        return fakeSigned;
      },
    },
    __TAURI_INTERNALS__: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoke: async (_cmd: string, args: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req: any = decode(Uint8Array.from(args.request));
        if (req.type === "app_info") {
          return Array.from(
            encode({
              type: "app_info",
              value: {
                agent_pub_key: fakeHash(2),
                installed_app_id: "my-app",
                cell_info: {},
              },
            }),
          );
        }
        if (req.type === "call_zome") {
          callZomeSeen = true;
          // ZomeCalled.value is the msgpack-encoded zome output (ExternIO bytes).
          return Array.from(
            encode({ type: "call_zome", value: encode(zomeResult) }),
          );
        }
        throw new Error(`unexpected request type ${req.type}`);
      },
    },
  };

  const appWs = await AppWebsocket.connect();
  const result = await appWs.callZome({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cell_id: [fakeHash(3), fakeHash(2)] as any,
    zome_name: "posts",
    fn_name: "get_all_posts",
    payload: null,
  });

  t.ok(signerCalled, "the host zome-call signer was used");
  t.ok(callZomeSeen, "a call_zome request was sent over Tauri IPC");
  t.deepEqual(result, zomeResult, "the zome response was decoded and returned");
});

test("TauriAppTransport delivers app signals from the plugin's signal bridge", async (t) => {
  let captured: ((bytes: Uint8Array) => void) | undefined;
  const cellId = [fakeHash(1), fakeHash(2)];
  const zomeName = "posts";
  const payload = { EntryCreated: { hash: "abc" } };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window = {
    __HC_TAURI_HOLOCHAIN__: {
      INSTALLED_APP_ID: "my-app",
      subscribeSignals: (cb: (bytes: Uint8Array) => void) => {
        captured = cb;
        return () => {};
      },
    },
    __TAURI_INTERNALS__: { invoke: async () => [] },
  };

  const transport = new TauriAppTransport("holochain");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const received: any[] = [];
  transport.on("signal", (s) => received.push(s));

  t.ok(captured, "transport subscribed to the plugin signal bridge");

  // The bytes the plugin forwards are the msgpack of holochain's Signal:
  // { type: "app", value: { cell_id, zome_name, signal: <encoded payload> } }.
  const rawSignal = {
    type: "app",
    value: { cell_id: cellId, zome_name: zomeName, signal: encode(payload) },
  };
  captured!(encode(rawSignal));

  // Emittery delivers on a microtask.
  await new Promise((resolve) => setTimeout(resolve, 0));

  t.equal(received.length, 1, "one signal was emitted");
  t.equal(received[0].type, "app", "emitted as an app signal");
  t.equal(received[0].value.zome_name, zomeName, "zome name preserved");
  t.deepEqual(
    received[0].value.payload,
    payload,
    "inner app signal payload decoded",
  );
});
