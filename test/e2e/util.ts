// import { hashZomeCall } from "@holochain/serialization/holochain_serialization_js.js";
import { spawn } from "node:child_process";
import { Test } from "tape";
import { AdminWebsocket } from "../../src/api/admin/websocket.js";
import { AppWebsocket } from "../../src/api/app/websocket.js";
import { CellId, InstalledAppId } from "../../src/types.js";

export const FIXTURE_PATH = "./test/e2e/fixture";

const LAIR_PASSPHRASE = "passphrase";

export const launch = async (port: number) => {
  // create sandbox conductor
  const args = ["sandbox", "--piped", "create"];
  const createConductorProcess = spawn("hc", args);
  createConductorProcess.stdin.write(LAIR_PASSPHRASE);
  createConductorProcess.stdin.end();

  let conductorDir = "";
  const createConductorPromise = new Promise<void>((resolve) => {
    createConductorProcess.stdout.on("data", (data) => {
      const tmpDirMatches = data.toString().match(/Created (\[".+"])/);
      if (tmpDirMatches) {
        conductorDir = JSON.parse(tmpDirMatches[1])[0];
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
      if (conductorProcess.pid) {
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
  const installed_app_id = "app";
  const admin = await AdminWebsocket.connect(`ws://localhost:${adminPort}`);
  const path = `${FIXTURE_PATH}/test.happ`;
  const agent = await admin.generateAgentPubKey();
  const app = await admin.installApp({
    installed_app_id,
    agent_key: agent,
    path,
    membrane_proofs: {},
  });
  if ("Stem" in app.cell_info.role_name[0]) {
    throw new Error("stem cell not implemented");
  }
  const cell_id =
    "Provisioned" in app.cell_info.role_name[0]
      ? app.cell_info.role_name[0].Provisioned.cell_id
      : app.cell_info.role_name[0].Cloned.cell_id;
  await admin.enableApp({ installed_app_id });
  // destructure to get whatever open port was assigned to the interface
  const { port: appPort } = await admin.attachAppInterface({ port: 0 });
  const client = await AppWebsocket.connect(`ws://localhost:${appPort}`, 12000);
  return { installed_app_id, cell_id, client, admin };
};
