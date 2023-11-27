import test from "tape";
import {
  fakeActionHash,
  fakeAgentPubKey,
  fakeDnaHash,
  fakeEntryHash,
} from "../../src/index.js";
import { installAppAndDna, withConductor } from "./common.js";

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
