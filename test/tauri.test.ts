import { decode, encode } from "@msgpack/msgpack";
import { assert, test } from "vitest";
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

test("isTauriHolochain detects the plugin webview environment", () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window = {};
  assert.isFalse(isTauriHolochain(), "false with no markers");

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window.__TAURI_INTERNALS__ = { invoke: async () => [] };
  assert.isFalse(isTauriHolochain(), "false with only the Tauri bridge");

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window.__HC_TAURI_HOLOCHAIN__ = { INSTALLED_APP_ID: "my-app" };
  assert.isTrue(
    isTauriHolochain(),
    "true with both the bridge and the holochain marker",
  );
  assert.equal(
    getTauriHolochainEnvironment()?.INSTALLED_APP_ID,
    "my-app",
    "exposes the injected environment",
  );
});

test("TauriAppTransport.request encodes the request, invokes the plugin command, and decodes the response", async () => {
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

  assert.equal(
    capturedCmd,
    "plugin:holochain|app_request",
    "calls the plugin's app_request command",
  );
  assert.isTrue(
    Array.isArray(capturedArgs.request),
    "request is sent as a byte array",
  );
  assert.isFalse(
    "appId" in capturedArgs,
    "no app id is sent — the conductor scopes the request to the window",
  );
  assert.deepEqual(
    decode(Uint8Array.from(capturedArgs.request)),
    requestTagged,
    "the bytes on the wire are the msgpack of the tagged request",
  );
  assert.deepEqual(
    result,
    responseTagged,
    "returns the decoded tagged response",
  );
});

test("TauriAppTransport.request converts byte-array map keys to Base64, like the websocket client", async () => {
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

  assert.equal(
    result.value[encodeHashToBase64(hashKey)],
    42,
    "a HoloHash map key is decoded to its Base64 form",
  );
});

test("AppWebsocket.connect uses the Tauri transport in a Tauri webview", async () => {
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

  assert.isTrue(
    appWs.client instanceof TauriAppTransport,
    "the AppWebsocket is backed by the Tauri transport, not a websocket",
  );
  assert.equal(
    appWs.installedAppId,
    "my-app",
    "installed app id comes from app_info",
  );
  assert.equal(
    encodeHashToBase64(appWs.myPubKey),
    encodeHashToBase64(agentKey),
    "agent key comes from app_info",
  );
  assert.equal(
    invokedCmd,
    "plugin:holochain|app_request",
    "app_info was fetched through the plugin command",
  );
});

test("AppWebsocket.callZome signs with the host signer and routes the call over Tauri IPC", async () => {
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

  assert.isTrue(signerCalled, "the host zome-call signer was used");
  assert.isTrue(callZomeSeen, "a call_zome request was sent over Tauri IPC");
  assert.deepEqual(
    result,
    zomeResult,
    "the zome response was decoded and returned",
  );
});

test("TauriAppTransport delivers app signals from the plugin's signal bridge", async () => {
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

  assert.ok(captured, "transport subscribed to the plugin signal bridge");

  // The bytes the plugin forwards are the msgpack of holochain's Signal:
  // { type: "app", value: { cell_id, zome_name, signal: <encoded payload> } }.
  const rawSignal = {
    type: "app",
    value: { cell_id: cellId, zome_name: zomeName, signal: encode(payload) },
  };
  captured!(encode(rawSignal));

  // Emittery delivers on a microtask.
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(received.length, 1, "one signal was emitted");
  assert.equal(received[0].type, "app", "emitted as an app signal");
  assert.equal(received[0].value.zome_name, zomeName, "zome name preserved");
  assert.deepEqual(
    received[0].value.payload,
    payload,
    "inner app signal payload decoded",
  );
});

test("TauriAppTransport passes system signals through unchanged", async () => {
  let captured: ((bytes: Uint8Array) => void) | undefined;
  const systemValue = { Activity: { agent: "alice" } };

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

  // A system signal carries no inner app payload: { type: "system", value }.
  captured!(encode({ type: "system", value: systemValue }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(received.length, 1, "one signal was emitted");
  assert.equal(received[0].type, "system", "emitted as a system signal");
  assert.deepEqual(
    received[0].value,
    systemValue,
    "system signal value passed through unchanged, not decoded as an app signal",
  );
});

test("AppWebsocket.connect rejects with a HolochainError when app_info returns an error response", async () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window = {
    __HC_TAURI_HOLOCHAIN__: { INSTALLED_APP_ID: "my-app" },
    __TAURI_INTERNALS__: {
      // The conductor's tagged error response: { type: "error", value: { type, value } }.
      invoke: async () =>
        Array.from(
          encode({
            type: "error",
            value: { type: "ribosome_error", value: "boom" },
          }),
        ),
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let err: any;
  try {
    await AppWebsocket.connect();
  } catch (e) {
    err = e;
  }
  assert.ok(err, "connect rejected on an error response");
  assert.equal(
    err.name,
    "ribosome_error",
    "catchError turns the error response into a HolochainError with the response's error type",
  );
  assert.equal(err.message, "boom", "the error value becomes the message");
});

test("AppWebsocket.connect throws AppNotFound when app_info is empty", async () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window = {
    __HC_TAURI_HOLOCHAIN__: { INSTALLED_APP_ID: "my-app" },
    __TAURI_INTERNALS__: {
      invoke: async () => Array.from(encode({ type: "app_info", value: null })),
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let err: any;
  try {
    await AppWebsocket.connect();
  } catch (e) {
    err = e;
  }
  assert.ok(err, "connect rejected when no app is bound");
  assert.equal(
    err.name,
    "AppNotFound",
    "throws AppNotFound when app_info returns no app",
  );
});

test("TauriAppTransport.request throws TauriInternalsMissing without the Tauri bridge", async () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window = {}; // no __TAURI_INTERNALS__

  const transport = new TauriAppTransport("holochain");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let err: any;
  try {
    await transport.request({ type: "app_info", value: null });
  } catch (e) {
    err = e;
  }
  assert.ok(err, "request threw without the Tauri IPC bridge");
  assert.equal(
    err.name,
    "TauriInternalsMissing",
    "request throws when window.__TAURI_INTERNALS__ is absent",
  );
});

test("TauriAppTransport.close unsubscribes from the signal bridge", () => {
  let unsubscribed = false;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore-next-line
  globalThis.window = {
    __HC_TAURI_HOLOCHAIN__: {
      INSTALLED_APP_ID: "my-app",
      subscribeSignals: () => () => {
        unsubscribed = true;
      },
    },
    __TAURI_INTERNALS__: { invoke: async () => [] },
  };

  const transport = new TauriAppTransport("holochain");
  assert.isFalse(unsubscribed, "not unsubscribed before close()");
  transport.close();
  assert.isTrue(
    unsubscribed,
    "close() invokes the bridge's unsubscribe function",
  );
});
