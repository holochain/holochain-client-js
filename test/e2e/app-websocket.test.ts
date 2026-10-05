import { assert, test } from "vitest";
import {
  AdminRequestPayload,
  AdminWebsocket,
  AppEntryDef,
  AppWebsocket,
  CallZomeRequest,
  CellId,
  CellType,
  CloneIdHelper,
  CreateCloneCellPayload,
  DecodedDirectSignal,
  fakeAgentPubKey,
  GrantZomeCallCapabilityPayload,
  HolochainError,
  randomCapSecret,
  RoleName,
  RoleNameCallZomeRequest,
  SignalCb,
  SignalType,
} from "../../src/index.js";
import { FIXTURE_PATH, retryUntilTimeout, withApp } from "./common.js";

const ROLE_NAME: RoleName = "foo";
const TEST_ZOME_NAME = "foo";

test(
  "can call a zome function and get app info",
  withApp(async (testCase) => {
    const {
      installed_app_id,
      cell_id,
      app_ws: appWs,
      admin_ws: admin,
    } = testCase;
    let info = await appWs.appInfo();
    assert(info.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    assert.deepEqual(info.cell_info[ROLE_NAME][0].value.cell_id, cell_id);
    assert.ok(ROLE_NAME in info.cell_info);
    assert.deepEqual(info.status, { type: "enabled" });

    const appEntryDef: AppEntryDef = {
      entry_index: 0,
      zome_index: 0,
      visibility: "Private",
    };

    const response = await appWs.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "echo_app_entry_def",
      payload: appEntryDef,
    });

    assert.equal(response, null, "app entry type deserializes correctly");

    const cellIdFromRoleName = appWs.getCellIdFromRoleName(ROLE_NAME, info);
    assert.deepEqual(cellIdFromRoleName, cell_id);

    const response_from_role_name = await appWs.callZome({
      role_name: ROLE_NAME,
      zome_name: TEST_ZOME_NAME,
      fn_name: "echo_app_entry_def",
      payload: appEntryDef,
    });

    assert.equal(
      response_from_role_name,
      null,
      "app entry type deserializes correctly",
    );

    await admin.disableApp({ installed_app_id });
    info = await appWs.appInfo();
    assert.deepEqual(info.status, {
      type: "disabled",
      value: { type: "user" },
    });
  }),
);

test(
  "can receive a signal",
  withApp(async (testCase) => {
    const { cell_id, app_ws: appWs } = testCase;

    let resolveSignalPromise: (value?: unknown) => void | undefined;
    const signalReceivedPromise = new Promise(
      (resolve) => (resolveSignalPromise = resolve),
    );
    const signalCb: SignalCb = (signal) => {
      assert(signal.type === SignalType.App);
      assert.deepEqual(signal.value.cell_id, cell_id);
      assert.equal(signal.value.zome_name, TEST_ZOME_NAME);
      // The client decodes the app signal payload before handing it to the
      // listener, so this field carries the decoded value, not the wire bytes.
      assert.equal(signal.value.signal, "i am a signal");
      resolveSignalPromise();
    };

    appWs.on("signal", signalCb);

    // trigger an emit_signal
    await appWs.callZome({
      cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "emitter",
      provenance: await fakeAgentPubKey(),
    });
    await signalReceivedPromise;
  }),
);

test(
  "cells only receive their own signals",
  withApp(async (testCase) => {
    const {
      installed_app_id: app_id1,
      cell_id: cell_id1,
      admin_ws: admin,
    } = testCase;

    let received1 = false;
    const signalCb1: SignalCb = () => {
      received1 = true;
    };

    const app_id2 = "app2";
    const agent2 = await admin.generateAgentPubKey();
    await admin.installApp({
      installed_app_id: app_id2,
      agent_key: agent2,
      source: {
        type: "path",
        value: `${FIXTURE_PATH}/test.happ`,
      },
    });
    await admin.enableApp({ installed_app_id: app_id2 });

    let received2 = false;
    const signalCb2: SignalCb = () => {
      received2 = true;
    };

    const issued1 = await admin.issueAppAuthenticationToken({
      installed_app_id: app_id1,
    });
    const { port: appPort } = await admin.attachAppInterface({
      allowed_origins: "client-test-app",
    });
    const clientUrl = new URL(`ws://localhost:${appPort}`);
    const appWs1 = await AppWebsocket.connect({
      url: clientUrl,
      wsClientOptions: { origin: "client-test-app" },
      token: issued1.token,
    });
    const issued2 = await admin.issueAppAuthenticationToken({
      installed_app_id: app_id2,
    });
    const appWs2 = await AppWebsocket.connect({
      url: clientUrl,
      wsClientOptions: { origin: "client-test-app" },
      token: issued2.token,
    });

    appWs1.on("signal", signalCb1);
    appWs2.on("signal", signalCb2);

    // trigger an emit_signal
    await appWs1.callZome({
      cell_id: cell_id1,
      zome_name: TEST_ZOME_NAME,
      fn_name: "emitter",
      provenance: await fakeAgentPubKey(),
    });

    // signals are received before the timeout step in the JS event loop is completed
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(received1, true);
    assert.equal(received2, false);
  }),
);

test(
  "can create a callable clone cell and call it by clone id",
  withApp(async (testCase) => {
    const { app_ws: appWs, admin_ws: admin } = testCase;
    const info = await appWs.appInfo();

    const createCloneCellParams: CreateCloneCellPayload = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await appWs.createCloneCell(createCloneCellParams);
    await admin.authorizeSigningCredentials(cloneCell.cell_id);

    const expectedCloneId = new CloneIdHelper(ROLE_NAME, 0).toString();
    assert.equal(cloneCell.clone_id, expectedCloneId, "correct clone id");
    assert(info.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
    assert.deepEqual(
      cloneCell.cell_id[1],
      info.cell_info[ROLE_NAME][0].value.cell_id[1],
      "clone cell agent key matches base cell agent key",
    );

    const params: RoleNameCallZomeRequest = {
      role_name: cloneCell.clone_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
    };
    const response = await appWs.callZome(params);
    assert.equal(
      response,
      "foo",
      "clone cell can be called with same zome call as base cell, and by clone id",
    );
  }),
);

test(
  "can disable and re-enable a clone cell",
  withApp(async (testCase) => {
    const { app_ws: appWs, admin_ws: admin } = testCase;

    const createCloneCellParams: CreateCloneCellPayload = {
      role_name: ROLE_NAME,
      modifiers: {
        network_seed: "clone-0",
      },
    };
    const cloneCell = await appWs.createCloneCell(createCloneCellParams);
    await admin.authorizeSigningCredentials(cloneCell.cell_id);

    await appWs.disableCloneCell({
      clone_cell_id: { type: "dna_hash", value: cloneCell.cell_id[0] },
    });

    const appInfo = await appWs.appInfo();
    assert.equal(
      appInfo.cell_info[ROLE_NAME].length,
      2,
      "disabled clone cell is part of app info",
    );
    const params: CallZomeRequest = {
      cell_id: cloneCell.cell_id,
      zome_name: TEST_ZOME_NAME,
      fn_name: "foo",
    };
    try {
      await appWs.callZome(params);
      assert.fail();
    } catch {
      // disabled clone call cannot be called
    }

    await appWs.enableCloneCell({
      clone_cell_id: { type: "dna_hash", value: cloneCell.cell_id[0] },
    });
    await appWs.callZome(params);
    // re-enabled clone can be called
  }),
);

test(
  "can grant and revoke zome call capabilities",
  withApp(async (testCase) => {
    const { cell_id, app_ws: appWs, admin_ws: admin } = testCase;
    const info = await appWs.appInfo();

    // grant capability
    const grantRequest: GrantZomeCallCapabilityPayload = {
      cell_id,
      cap_grant: {
        tag: "test-grant",
        constraint: {
          type: "unrestricted",
        },
        grant: {
          functions: {
            type: "all",
          },
        },
      },
    };

    const grantedActionHash = await admin.grantZomeCallCapability(grantRequest);

    // list capability grants
    const listRequest: AdminRequestPayload<"list_capability_grants"> = {
      installed_app_id: info.installed_app_id,
      include_revoked: true,
    };

    const capabilityGrants = await admin.listCapabilityGrants(listRequest);
    // should have 1 item = grants for 1 cell
    assert.equal(capabilityGrants.length, 1, "should have grants for 1 cell");
    const [cellIdFromGrants, grants] = capabilityGrants[0];
    assert.deepEqual(cellIdFromGrants, cell_id, "cell id matches");
    assert.equal(grants.length, 2, "should have 2 grants");
    const capGrantInfo = grants[1];
    assert.equal(capGrantInfo.cap_grant.tag, "test-grant", "grant tag matches");
    assert(
      capGrantInfo.cap_grant.capability.type === "zome_call",
      "cap grant is type zome call",
    );
    assert.equal(
      capGrantInfo.cap_grant.capability.value.functions.type,
      "all",
      "grant functions type matches",
    );
    assert.deepEqual(
      capGrantInfo.action_hash,
      grantedActionHash,
      "action hash matches",
    );

    // revoke capability
    const revokeRequest: AdminRequestPayload<"revoke_zome_call_capability"> = {
      action_hash: grantedActionHash,
      cell_id: cell_id,
    };
    await admin.revokeZomeCallCapability(revokeRequest);

    // list capability grants again
    const capabilityGrantsAfterRevoke =
      await admin.listCapabilityGrants(listRequest);
    // should have 1 item for 1 cell still, but the grant should be revoked
    assert.equal(
      capabilityGrantsAfterRevoke.length,
      1,
      "should still have one capability grant after revoking",
    );
    const [cellIdFromGrantsAfterRevoke, grantsAfterRevoke] =
      capabilityGrantsAfterRevoke[0];
    assert.deepEqual(
      cellIdFromGrantsAfterRevoke,
      cell_id,
      "cell id matches after revoke",
    );
    // check if has revoked_at
    const grant = grantsAfterRevoke.find(
      (info) => info.cap_grant.tag === "test-grant",
    );
    assert(
      grant && grant.revoked_at,
      `grant should be revoked but is ${grant?.revoked_at}`,
    );
  }),
);

// To test unstable features in Holochain, set env var `TEST_UNSTABLE` to `true`.
if (process.env.TEST_UNSTABLE === "true") {
  test(
    "countersigning session interaction calls",
    withApp(async (testCase) => {
      const { cell_id, app_ws: appWs } = testCase;
      const response = await appWs.getCountersigningSessionState(cell_id);
      assert.equal(
        response,
        null,
        "countersigning session state should be null",
      );

      try {
        await appWs.abandonCountersigningSession(cell_id);
        assert.fail(
          "there should not be a countersigning session to be abandoned",
        );
      } catch (error) {
        assert(error instanceof Error);
        assert.isTrue(
          error.message.includes("SessionNotFound"),
          "there should not be a countersigning session",
        );
      }

      try {
        await appWs.publishCountersigningSession(cell_id);
        assert.fail(
          "there should not be a countersigning session to be published",
        );
      } catch (error) {
        assert(error instanceof Error);
        assert.isTrue(
          error.message.includes("SessionNotFound"),
          "there should not be a countersigning session",
        );
      }
    }),
  );
}

/**
 * Install a second copy of the fixture hApp as `installed_app_id` on the
 * conductor behind `admin` and connect an app websocket to it. Both apps
 * share a DNA, so the two agents are peers on one network.
 */
const installSecondApp = async (
  admin: AdminWebsocket,
  installed_app_id: string,
): Promise<{ app_ws: AppWebsocket; cell_id: CellId }> => {
  const agent = await admin.generateAgentPubKey();
  const appInfo = await admin.installApp({
    installed_app_id,
    agent_key: agent,
    source: { type: "path", value: `${FIXTURE_PATH}/test.happ` },
  });
  await admin.enableApp({ installed_app_id });
  assert(appInfo.cell_info[ROLE_NAME][0].type === CellType.Provisioned);
  const cell_id = appInfo.cell_info[ROLE_NAME][0].value.cell_id;
  const { port } = await admin.attachAppInterface({
    allowed_origins: "client-test-app",
  });
  const issued = await admin.issueAppAuthenticationToken({ installed_app_id });
  const app_ws = await AppWebsocket.connect({
    url: new URL(`ws://localhost:${port}`),
    wsClientOptions: { origin: "client-test-app" },
    defaultTimeout: 12000,
    token: issued.token,
  });
  return { app_ws, cell_id };
};

/** Collect every direct signal `appWs` receives. */
const collectDirectSignals = (appWs: AppWebsocket): DecodedDirectSignal[] => {
  const received: DecodedDirectSignal[] = [];
  appWs.on("signal", (signal) => {
    if (signal.type === SignalType.AppDirect) {
      received.push(signal.value);
    }
  });
  return received;
};

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const fromUtf8 = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

test(
  "can grant a direct signal capability over the app websocket and receive direct signals",
  withApp(async (testCase) => {
    const { cell_id: aliceCellId, app_ws: alice, admin_ws: admin } = testCase;
    const bobAppId = "app2";
    const { app_ws: bob, cell_id: bobCellId } = await installSecondApp(
      admin,
      bobAppId,
    );
    const dnaHash = aliceCellId[0];
    assert.deepEqual(bobCellId[0], dnaHash, "both apps share the DNA");

    // A grant for a cell outside the authenticated app is rejected.
    try {
      await alice.grantDirectSignalCapability({
        cell_id: bobCellId,
        tag: "not-my-cell",
        constraint: { type: "unrestricted" },
      });
      assert.fail("granting for another app's cell must fail");
    } catch (error) {
      assert.instanceOf(error, HolochainError);
    }

    // Bob grants with a secret, over his own app websocket.
    const secret = await randomCapSecret();
    const grantHash = await bob.grantDirectSignalCapability({
      cell_id: bobCellId,
      tag: "direct-signal",
      constraint: { type: "transferable", value: { secret } },
    });
    assert.equal(grantHash.length, 39, "an action hash is returned");

    const bobGrants = await admin.listCapabilityGrants({
      installed_app_id: bobAppId,
      include_revoked: false,
    });
    const directGrants = bobGrants
      .flatMap(([, grants]) => grants)
      .filter((info) => info.cap_grant.capability.type === "direct_signal");
    assert.equal(directGrants.length, 1, "exactly one direct signal grant");
    assert.equal(directGrants[0].cap_grant.tag, "direct-signal");
    assert.deepEqual(directGrants[0].action_hash, grantHash);
    assert.isFalse(
      bobGrants.some(([, grants]) =>
        grants.some((info) => info.cap_grant.tag === "not-my-cell"),
      ),
      "the rejected grant was not committed",
    );

    // Alice signals Bob with the right secret. Retry until delivered: a
    // signal to an agent whose URL is not yet known is silently dropped.
    const received = collectDirectSignals(bob);
    const payload = utf8("hello bob");
    await retryUntilTimeout(
      async () => {
        await alice.sendDirectSignal({
          dna_hash: dnaHash,
          agents: [bobCellId[1]],
          signal: payload,
          cap_secret: secret,
        });
        return received.length > 0;
      },
      "bob did not receive the direct signal",
      1000,
      60_000,
    );
    assert.deepEqual(received[0].cell_id, bobCellId, "delivered to bob's cell");
    assert.deepEqual(received[0].from_agent, alice.myPubKey, "sent by alice");
    assert.equal(fromUtf8(received[0].signal), "hello bob");

    // The wrong secret and no secret are accepted by the sender but refused
    // by the recipient.
    await alice.sendDirectSignal({
      dna_hash: dnaHash,
      agents: [bobCellId[1]],
      signal: utf8("wrong secret"),
      cap_secret: await randomCapSecret(),
    });
    await alice.sendDirectSignal({
      dna_hash: dnaHash,
      agents: [bobCellId[1]],
      signal: utf8("no secret"),
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const refused = received.map((signal) => fromUtf8(signal.signal));
    assert.notInclude(refused, "wrong secret");
    assert.notInclude(refused, "no secret");

    // Conductor-side validation errors surface as rejections.
    try {
      await alice.sendDirectSignal({
        dna_hash: dnaHash,
        agents: [],
        signal: payload,
      });
      assert.fail("an empty agent list must be rejected");
    } catch (error) {
      assert.instanceOf(error, HolochainError);
    }
    try {
      await alice.sendDirectSignal({
        dna_hash: dnaHash,
        agents: [bobCellId[1]],
        signal: new Uint8Array(1024 * 1024 + 1),
      });
      assert.fail("a payload over 1 MiB must be rejected");
    } catch (error) {
      assert.instanceOf(error, HolochainError);
    }
  }),
);

test(
  "can grant an unrestricted direct signal capability over the admin websocket",
  withApp(async (testCase) => {
    const { cell_id: aliceCellId, app_ws: alice, admin_ws: admin } = testCase;
    const bobAppId = "app2";
    const { app_ws: bob, cell_id: bobCellId } = await installSecondApp(
      admin,
      bobAppId,
    );
    const dnaHash = aliceCellId[0];

    const grantHash = await admin.grantDirectSignalCapability({
      cell_id: bobCellId,
      tag: "admin-direct-signal",
      constraint: { type: "unrestricted" },
    });
    assert.equal(grantHash.length, 39, "an action hash is returned");

    const bobGrants = await admin.listCapabilityGrants({
      installed_app_id: bobAppId,
      include_revoked: false,
    });
    const grant = bobGrants
      .flatMap(([, grants]) => grants)
      .find((info) => info.cap_grant.tag === "admin-direct-signal");
    assert(grant, "the admin grant is listed");
    assert.equal(grant.cap_grant.capability.type, "direct_signal");
    assert.deepEqual(grant.action_hash, grantHash);

    // An unrestricted grant needs no secret.
    const received = collectDirectSignals(bob);
    await retryUntilTimeout(
      async () => {
        await alice.sendDirectSignal({
          dna_hash: dnaHash,
          agents: [bobCellId[1]],
          signal: utf8("hello from admin grant"),
        });
        return received.length > 0;
      },
      "bob did not receive the direct signal",
      1000,
      60_000,
    );
    assert.deepEqual(received[0].from_agent, alice.myPubKey);
    assert.equal(fromUtf8(received[0].signal), "hello from admin grant");
  }),
);
