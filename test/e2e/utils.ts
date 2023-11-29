import test from "tape";
import {
  fakeActionHash,
  fakeAgentPubKey,
  fakeDnaHash,
  fakeEntryHash,
  hashFrom32AndType,
  sliceCore32,
  sliceDhtLocation,
  sliceHashType,
} from "../../src/index.js";
import { installAppAndDna, withConductor } from "./common.js";
import { range } from "lodash-es";

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
  const core = sliceCore32(fakeHash);
  const postfix = sliceDhtLocation(fakeHash);

  t.deepEqual(
    fakeHash,
    Uint8Array.from([...prefix, ...core, ...postfix]),
    "extracted prefix, core, and postfix components of a hash concat back into the original hash"
  );
});

test("hashFrom32AndType generates valid hash with type and 32 core bytes", async (t) => {
  const core = Uint8Array.from(range(0, 32).map(() => 1));
  const fullHash = hashFrom32AndType(core, "Agent");

  t.deepEqual(
    fullHash,
    Uint8Array.from([
      132, 32, 36, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 126, 207, 206, 190,
    ]),
    "generated full valid hash"
  );
});
