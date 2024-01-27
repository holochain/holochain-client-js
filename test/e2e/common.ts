import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { Test } from "tape";
import { AdminWebsocket } from "../../src/api/admin/websocket.js";
import { AppWebsocket } from "../../src/api/app/websocket.js";
import { CellId, InstalledAppId } from "../../src/types.js";
import {
  AppAgentWebsocket,
  CellType,
  CoordinatorBundle,
} from "../../src/index.js";
import fs from "fs";

export const FIXTURE_PATH = "./test/e2e/fixture";

const LAIR_PASSPHRASE = "passphrase";

export const launch = async (port: number) => {
  // create sandbox conductor
  const args = ["sandbox", "--piped", "create", "--in-process-lair"];
  const createConductorProcess = spawn("hc", args);
  createConductorProcess.stdin.write(LAIR_PASSPHRASE);
  createConductorProcess.stdin.end();

  let conductorDir = "";
  const createConductorPromise = new Promise<void>((resolve) => {
    createConductorProcess.stdout.on("data", (data) => {
      const tmpDirMatches = data.toString().match(/Created.+"(.+)"/);
      if (tmpDirMatches) {
        conductorDir = tmpDirMatches[1];
      }
    });
    createConductorProcess.stdout.on("end", () => {
      resolve();
    });
  });
  await createConductorPromise;

  // start sandbox conductor
  const runConductorProcess = spawn(
    "hc",
    ["sandbox", "--piped", `-f=${port}`, "run", "-e", conductorDir],
    {
      detached: true, // create a process group; without this option, killing
      // the process doesn't kill the conductor
    }
  );
  runConductorProcess.stdin.write(LAIR_PASSPHRASE);
  runConductorProcess.stdin.end();

  const runConductorPromise = new Promise<void>((resolve) => {
    runConductorProcess.stdout.on("data", (data: Buffer) => {
      console.log(data.toString());
      const isConductorStarted = data
        .toString()
        .includes("Connected successfully to a running holochain");
      if (isConductorStarted) {
        // this is the last output of the startup process
        resolve();
      }
    });
  });
  runConductorProcess.stderr.on("data", (data: Buffer) => {
    console.log(data.toString());
  });
  await runConductorPromise;
  return runConductorProcess;
};

export const cleanSandboxConductors = () => {
  const cleanSandboxConductorsProcess = spawn("hc", ["sandbox", "clean"]);
  const cleanSandboxConductorsPromise = new Promise<void>((resolve) => {
    cleanSandboxConductorsProcess.stdout.on("end", () => {
      resolve();
    });
  });
  return cleanSandboxConductorsPromise;
};

export const withConductor =
  (port: number, f: (t: Test) => Promise<void>) => async (t: Test) => {
    const conductorProcess = await launch(port);
    try {
      await f(t);
    } catch (e) {
      console.error("Test caught exception: ", e);
      throw e;
    } finally {
      if (conductorProcess.pid && !conductorProcess.killed) {
        process.kill(-conductorProcess.pid);
      }
      await cleanSandboxConductors();
    }
    t.end();
  };

export const installAppAndDna = async (
  adminPort: number
): Promise<{
  installed_app_id: InstalledAppId;
  cell_id: CellId;
  client: AppWebsocket;
  admin: AdminWebsocket;
}> => {
  const role_name = "foo";
  const installed_app_id = "app";
  const admin = await AdminWebsocket.connect(
    new URL(`ws://127.0.0.1:${adminPort}`)
  );
  const path = `${FIXTURE_PATH}/test.happ`;
  const agent = await admin.generateAgentPubKey();
  const app = await admin.installApp({
    installed_app_id,
    agent_key: agent,
    path,
    membrane_proofs: {},
  });
  assert(CellType.Provisioned in app.cell_info[role_name][0]);
  const cell_id = app.cell_info[role_name][0][CellType.Provisioned].cell_id;
  await admin.enableApp({ installed_app_id });
  // destructure to get whatever open port was assigned to the interface
  const { port: appPort } = await admin.attachAppInterface({ port: 0 });
  const client = await AppWebsocket.connect(
    new URL(`ws://127.0.0.1:${appPort}`)
  );
  return { installed_app_id, cell_id, client, admin };
};

export const createAppAgentWsAndInstallApp = async (
  adminPort: number
): Promise<{
  installed_app_id: InstalledAppId;
  cell_id: CellId;
  client: AppAgentWebsocket;
  admin: AdminWebsocket;
}> => {
  const role_name = "foo";
  const installed_app_id = "app";
  const admin = await AdminWebsocket.connect(
    new URL(`ws://127.0.0.1:${adminPort}`)
  );
  const path = `${FIXTURE_PATH}/test.happ`;
  const agent = await admin.generateAgentPubKey();
  const app = await admin.installApp({
    installed_app_id,
    agent_key: agent,
    path,
    membrane_proofs: {},
  });
  assert(CellType.Provisioned in app.cell_info[role_name][0]);
  const cell_id = app.cell_info[role_name][0][CellType.Provisioned].cell_id;
  await admin.enableApp({ installed_app_id });
  const { port: appPort } = await admin.attachAppInterface({ port: 0 });
  const client = await AppAgentWebsocket.connect(
    new URL(`ws://127.0.0.1:${appPort}`),
    installed_app_id,
    12000
  );
  return { installed_app_id, cell_id, client, admin };
};

export async function makeCoordinatorZomeBundle(): Promise<CoordinatorBundle> {
  const wasm = fs.readFileSync(
    `${process.cwd()}/target/wasm32-unknown-unknown/release/coordinator2.wasm`,
    null
  );

  return {
    manifest: {
      zomes: [
        {
          bundled: "coordinator2",
          name: "coordinator2",
          dependencies: [],
        },
      ],
    },
    resources: {
      coordinator2: new Uint8Array(wasm.buffer),
    },
  };
}
