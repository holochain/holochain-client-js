import { assert, test } from "vitest";
import {
  ChainOp,
  Entry,
  fakeActionHash,
  fakeAgentPubKey,
  fakeEntryHash,
  getChainOpAction,
  getChainOpEntry,
  getChainOpSignature,
  getChainOpType,
  SignedAction,
} from "../src";

const SIGNATURE = new Uint8Array(64).fill(7);

const APP_ENTRY: Entry = {
  entry_type: "App",
  entry: new Uint8Array([1, 2, 3]),
};

async function makeCreateSignedAction(): Promise<SignedAction> {
  return {
    data: {
      header: {
        author: await fakeAgentPubKey(),
        timestamp: 1700000000000000,
        action_seq: 4,
        prev_action: await fakeActionHash(),
      },
      data: {
        type: "Create",
        entry_type: {
          App: { entry_index: 0, zome_index: 0, visibility: "Public" },
        },
        entry_hash: await fakeEntryHash(),
      },
    },
    signature: SIGNATURE,
  };
}

async function makeDeleteSignedAction(): Promise<SignedAction> {
  return {
    data: {
      header: {
        author: await fakeAgentPubKey(),
        timestamp: 1700000000000000,
        action_seq: 5,
        prev_action: await fakeActionHash(),
      },
      data: {
        type: "Delete",
        deletes_address: await fakeActionHash(),
        deletes_entry_address: await fakeEntryHash(),
      },
    },
    signature: SIGNATURE,
  };
}

test("chain op helpers on a tuple variant with a present entry", async () => {
  const signedAction = await makeCreateSignedAction();
  const op: ChainOp = {
    ["CreateEntry"]: [signedAction, { Present: APP_ENTRY }],
  };

  assert.equal(getChainOpType(op), "CreateEntry");
  assert.deepEqual(getChainOpAction(op), signedAction.data);
  assert.deepEqual(getChainOpSignature(op), SIGNATURE);
  assert.deepEqual(getChainOpEntry(op), APP_ENTRY);
});

test("chain op helpers on a tuple variant with a unit-variant op entry", async () => {
  const signedAction = await makeCreateSignedAction();
  const op: ChainOp = {
    ["UpdateEntry"]: [signedAction, "Hidden"],
  };

  assert.equal(getChainOpType(op), "UpdateEntry");
  assert.deepEqual(getChainOpAction(op), signedAction.data);
  assert.deepEqual(getChainOpSignature(op), SIGNATURE);
  assert.isUndefined(getChainOpEntry(op));
});

test("chain op helpers on a newtype variant", async () => {
  const signedAction = await makeDeleteSignedAction();
  const op: ChainOp = { ["DeleteRecord"]: signedAction };

  assert.equal(getChainOpType(op), "DeleteRecord");
  assert.deepEqual(getChainOpAction(op), signedAction.data);
  assert.deepEqual(getChainOpSignature(op), SIGNATURE);
  assert.isUndefined(getChainOpEntry(op));
});

test("chain op helpers on an action-only tuple variant", async () => {
  const signedAction = await makeCreateSignedAction();
  const op: ChainOp = {
    ["CreateRecord"]: [signedAction, "ActionOnly"],
  };

  assert.equal(getChainOpType(op), "CreateRecord");
  assert.isUndefined(getChainOpEntry(op));
});
