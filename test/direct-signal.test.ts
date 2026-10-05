import { decode, encode } from "@msgpack/msgpack";
import { assert, test } from "vitest";
import { AppWebsocket } from "../src/index.js";

// Pure unit tests: no conductor, no websocket. They drive AppWebsocket over a
// mocked Tauri IPC bridge (the same trick as test/tauri.test.ts) to pin the
// exact `{ type, value }` payloads the direct signal methods put on the wire,
// which the e2e tests cannot observe.

// A throwaway 39-byte value standing in for a HoloHash.
const fakeHash = (fill: number): Uint8Array =>
  Uint8Array.from(new Array(39).fill(fill));

// A throwaway 64-byte value standing in for a CapSecret.
const fakeSecret = (fill: number): Uint8Array =>
  Uint8Array.from(new Array(64).fill(fill));

interface TaggedMessage {
  type: string;
  value: unknown;
}

interface MockedBridge {
  appWs: AppWebsocket;
  /** Every request other than the initial `app_info`, in order. */
  captured: TaggedMessage[];
}

/**
 * Connect an AppWebsocket through a mocked Tauri bridge that answers the
 * initial `app_info` and then replies to every other request with `response`.
 */
const connectWithMockedBridge = async (
  response: TaggedMessage,
): Promise<MockedBridge> => {
  const captured: TaggedMessage[] = [];
  (globalThis as { window: unknown }).window = {
    __HC_TAURI_HOLOCHAIN__: {
      INSTALLED_APP_ID: "my-app",
      PLUGIN_NAME: "holochain",
    },
    __TAURI_INTERNALS__: {
      invoke: async (
        _cmd: string,
        args: { request: number[] },
      ): Promise<number[]> => {
        const request = decode(Uint8Array.from(args.request)) as TaggedMessage;
        if (request.type === "app_info") {
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
        captured.push(request);
        return Array.from(encode(response));
      },
    },
  };
  const appWs = await AppWebsocket.connect();
  return { appWs, captured };
};

test("sendDirectSignal sends send_direct_signal with the payload as an int array", async () => {
  const { appWs, captured } = await connectWithMockedBridge({
    type: "ok",
    value: null,
  });
  const dnaHash = fakeHash(5);
  const bob = fakeHash(6);
  const secret = fakeSecret(7);

  const result = await appWs.sendDirectSignal({
    dna_hash: dnaHash,
    agents: [bob],
    signal: Uint8Array.from([1, 2, 3]),
    cap_secret: secret,
  });

  assert.isUndefined(result, "resolves with no value on an ok response");
  assert.equal(captured.length, 1, "exactly one request after app_info");
  assert.equal(captured[0].type, "send_direct_signal");
  const value = captured[0].value as {
    dna_hash: Uint8Array;
    agents: Uint8Array[];
    signal: unknown;
    cap_secret: Uint8Array | null;
  };
  assert.deepEqual(value.dna_hash, dnaHash, "dna hash passed through");
  assert.deepEqual(value.agents, [bob], "agents passed through");
  assert.isTrue(
    Array.isArray(value.signal),
    "the payload travels as a msgpack array, as Rust's Vec<u8> expects",
  );
  assert.deepEqual(value.signal, [1, 2, 3]);
  assert.deepEqual(value.cap_secret, secret, "cap secret passed through");
});

test("sendDirectSignal without a cap_secret sends nil for it", async () => {
  const { appWs, captured } = await connectWithMockedBridge({
    type: "ok",
    value: null,
  });

  await appWs.sendDirectSignal({
    dna_hash: fakeHash(5),
    agents: [fakeHash(6)],
    signal: Uint8Array.from([9]),
  });

  const value = captured[0].value as { cap_secret: unknown };
  assert.isNull(
    value.cap_secret,
    "an absent secret is encoded as nil so the conductor reads None",
  );
});

test("grantDirectSignalCapability sends the grant and returns the action hash", async () => {
  const actionHash = fakeHash(9);
  const { appWs, captured } = await connectWithMockedBridge({
    type: "direct_signal_capability_granted",
    value: actionHash,
  });
  const cellId = [fakeHash(5), fakeHash(2)];
  const secret = fakeSecret(3);

  const result = await appWs.grantDirectSignalCapability({
    cell_id: cellId,
    tag: "direct-signal",
    constraint: { type: "transferable", value: { secret } },
  });

  assert.deepEqual(result, actionHash, "returns the grant's action hash");
  assert.equal(captured[0].type, "grant_direct_signal_capability");
  assert.deepEqual(
    captured[0].value,
    {
      cell_id: cellId,
      tag: "direct-signal",
      constraint: { type: "transferable", value: { secret } },
    },
    "the payload is sent untouched",
  );
});
