import test from "tape";
import {
  dhtLocationFrom32,
  fakeActionHash,
  fakeAgentPubKey,
  fakeDnaHash,
  fakeEntryHash,
  getHashType,
  hashFrom32AndType,
  hashFromContentAndType,
  HoloHashType,
  sliceCore32,
  sliceDhtLocation,
  sliceHashType,
} from "../../src";
import { installAppAndDna, withConductor } from "./common.js";
import { range } from "lodash-es";
import { encode } from "@msgpack/msgpack";
import blake2b from "@bitgo/blake2b";

const ADMIN_PORT = 33001;

const TEST_ZOME_NAME = "foo";

test(
  "fakeAgentPubKey generates valid AgentPubKey",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin, cell_id } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const fakeHash = await fakeAgentPubKey();
    const response = await client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "decode_as_agentpubkey",
      payload: Array.from(fakeHash),
      provenance: cell_id[0],
    });
    t.deepEqual(
      response,
      Buffer.from(fakeHash),
      "fakeAgentPubKey generates valid hash that decodes to AgentPubKey"
    );
  })
);

test(
  "fakeEntryHash generates valid EntryHash",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin, cell_id } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const fakeHash = await fakeEntryHash();
    const response = await client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "decode_as_entryhash",
      payload: Array.from(fakeHash),
      provenance: cell_id[0],
    });
    t.deepEqual(
      response,
      Buffer.from(fakeHash),
      "fakeEntryHash generates valid hash that decodes to EntryHash"
    );
  })
);

test(
  "fakeActionHash generates valid ActionHash",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin, cell_id } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const fakeHash = await fakeActionHash();
    const response = await client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "decode_as_actionhash",
      payload: Array.from(fakeHash),
      provenance: cell_id[0],
    });
    t.deepEqual(
      response,
      Buffer.from(fakeHash),
      "fakeActionHash generates valid hash that decodes to ActionHash"
    );
  })
);

test(
  "fakeDnaHash generates valid DnaHash",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin, cell_id } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const fakeHash = await fakeDnaHash();
    const response = await client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "decode_as_dnahash",
      payload: Array.from(fakeHash),
      provenance: cell_id[0],
    });
    t.deepEqual(
      response,
      Buffer.from(fakeHash),
      "fakeDnaHash generates valid hash that decodes to DnaHash"
    );
  })
);

test(
  "fakeAgentPubKey generates deterministic valid AgentPubKey when coreByte defined",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin, cell_id } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const fakeHash = await fakeAgentPubKey(1);
    const response = await client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "decode_as_agentpubkey",
      payload: Array.from(fakeHash),
      provenance: cell_id[0],
    });
    t.deepEqual(
      response,
      Buffer.from([
        132, 32, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
      ]),
      "fakeAgentPubKey with coreByte set generates deterministic valid hash that decodes to AgentPubKey"
    );
  })
);

test(
  "fakeEntryHash generates deterministic valid EntryHash when coreByte defined",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin, cell_id } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const fakeHash = await fakeEntryHash(1);
    const response = await client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "decode_as_entryhash",
      payload: Array.from(fakeHash),
      provenance: cell_id[0],
    });
    t.deepEqual(
      response,
      Buffer.from([
        132, 33, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
      ]),
      "fakeEntryHash with coreByte set generates deterministic valid hash that decodes to EntryHash"
    );
  })
);

test(
  "fakeActionHash generates deterministic valid ActionHash  when coreByte defined",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin, cell_id } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const fakeHash = await fakeActionHash(1);
    const response = await client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "decode_as_actionhash",
      payload: Array.from(fakeHash),
      provenance: cell_id[0],
    });
    t.deepEqual(
      response,
      Buffer.from([
        132, 41, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
      ]),
      "fakeActionHash with coreByte set generates deterministic valid hash that decodes to ActionHash"
    );
  })
);

test(
  "fakeDnaHash generates deterministic valid DnaHash when coreByte defined",
  withConductor(ADMIN_PORT, async (t) => {
    const { client, admin, cell_id } = await installAppAndDna(ADMIN_PORT);
    await admin.authorizeSigningCredentials(cell_id);

    const fakeHash = await fakeDnaHash(1);
    const response = await client.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "decode_as_dnahash",
      payload: Array.from(fakeHash),
      provenance: cell_id[0],
    });
    t.deepEqual(
      response,
      Buffer.from([
        132, 45, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
      ]),
      "fakeDnaHash with coreByte set generates deterministic valid hash that decodes to DnaHash"
    );
  })
);

test("sliceDhtLocation, sliceCore32, sliceHashType extract components of a hash", async (t) => {
  const fakeHash = await fakeDnaHash(1);
  const prefix = sliceHashType(fakeHash);
  const hash = sliceCore32(fakeHash);
  const dhtLocation = sliceDhtLocation(fakeHash);

  t.deepEqual(
    fakeHash,
    Uint8Array.from([...prefix, ...hash, ...dhtLocation]),
    "extracted hash type, core hash, and dht location components of a hash concat back into the original hash"
  );
});

test("hashFrom32AndType generates valid hash with type and 32 core bytes", async (t) => {
  const core = Uint8Array.from(range(0, 32).map(() => 1));
  let hash = hashFrom32AndType(core, HoloHashType.Agent);

  t.deepEqual(
    hash,
    Uint8Array.from([
      132, 32, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ]),
    "generated full valid hash"
  );

  hash = hashFrom32AndType(core, HoloHashType.Entry);
  t.deepEqual(
    hash,
    Uint8Array.from([
      132, 33, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ]),
    "generated full valid hash"
  );

  hash = hashFrom32AndType(core, HoloHashType.DhtOp);
  t.deepEqual(
    hash,
    Uint8Array.from([
      132, 36, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ]),
    "generated full valid hash"
  );

  hash = hashFrom32AndType(core, HoloHashType.Warrant);
  t.deepEqual(
    hash,
    Uint8Array.from([
      132, 44, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ]),
    "generated full valid hash"
  );

  hash = hashFrom32AndType(core, HoloHashType.Dna);
  t.deepEqual(
    hash,
    Uint8Array.from([
      132, 45, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ]),
    "generated full valid hash"
  );

  hash = hashFrom32AndType(core, HoloHashType.Action);
  t.deepEqual(
    hash,
    Uint8Array.from([
      132, 41, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ]),
    "generated full valid hash"
  );

  hash = hashFrom32AndType(core, HoloHashType.Wasm);
  t.deepEqual(
    hash,
    Uint8Array.from([
      132, 42, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ]),
    "generated full valid hash"
  );

  hash = hashFrom32AndType(core, HoloHashType.External);
  t.deepEqual(
    hash,
    Uint8Array.from([
      132, 47, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ]),
    "generated full valid hash"
  );
});

test("getHashType determines hash type name from valid 39 byte hash", async (t) => {
  const core = Uint8Array.from(range(0, 32).map(() => 1));
  const fullHash = hashFrom32AndType(core, HoloHashType.Agent);

  let hashType = getHashType(
    Uint8Array.from([
      132, 32, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ])
  );
  t.equal(hashType, HoloHashType.Agent);

  hashType = getHashType(
    Uint8Array.from([
      132, 33, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ])
  );
  t.equal(hashType, HoloHashType.Entry);

  hashType = getHashType(
    Uint8Array.from([
      132, 36, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ])
  );
  t.equal(hashType, HoloHashType.DhtOp);

  hashType = getHashType(
    Uint8Array.from([
      132, 44, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ])
  );
  t.equal(hashType, HoloHashType.Warrant);

  hashType = getHashType(
    Uint8Array.from([
      132, 45, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ])
  );
  t.equal(hashType, HoloHashType.Dna);

  hashType = getHashType(
    Uint8Array.from([
      132, 41, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ])
  );
  t.equal(hashType, HoloHashType.Action);

  hashType = getHashType(
    Uint8Array.from([
      132, 42, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ])
  );
  t.equal(hashType, HoloHashType.Wasm);

  hashType = getHashType(
    Uint8Array.from([
      132, 47, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ])
  );
  t.equal(hashType, HoloHashType.External);
});

test("getHashType throws error on hash with invalid 3 byte prefix", async (t) => {
  // Invalid hash type prefix throws error
  t.throws(() => {
    getHashType(
      Uint8Array.from([
        0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
      ])
    );
  });
});

test("hashFromContentAndType generates valid HoloHash with specified type", async (t) => {
  const content = {
    name: "Joe",
    age: 20,
    hobbies: ["Ice Skating", "Basketball", "Dance"],
  };

  // Determine expected hash by hashing manually with blake2
  const expectedHash = new Uint8Array(32);
  blake2b(expectedHash.length).update(encode(content)).digest(expectedHash);

  // Hash from util function
  const hash = hashFromContentAndType(content, HoloHashType.Entry);

  // Valid type bytes
  const hashType = getHashType(hash);
  t.deepEqual(hashType, HoloHashType.Entry);

  // Valid hash bytes
  const core = sliceCore32(hash);
  t.deepEqual(core.length, 32);
  t.deepEqual(core, expectedHash);

  // Valid location bytes
  const loc = sliceDhtLocation(hash);
  t.deepEqual(loc, dhtLocationFrom32(expectedHash));
});
