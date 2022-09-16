import { spawn } from "node:child_process";
import { Test } from "tape";
import { AdminWebsocket } from "../../src/api/admin/websocket.js";
import { AppSignalCb } from "../../src/api/app/types.js";
import { AppWebsocket } from "../../src/api/app/websocket.js";
import { CellId, DnaHash, InstalledAppId, RoleId } from "../../src/types.js";
export const FIXTURE_PATH = "./test/e2e/fixture";
export const CONFIG_PATH = `${FIXTURE_PATH}/test-config.yml`;
export const CONFIG_PATH_1 = `${FIXTURE_PATH}/test-config-1.yml`;

const LAIR_PASSWORD = "lair-password";

export const launch = async (port?: number) => {
  // create sandbox conductor
  const args = ["sandbox", "--piped", "create", "network", "quic"];
  if (port) {
    args.push("--override-port", port.toString());
  }
  const createConductorProcess = spawn("hc", args);
  createConductorProcess.stdin.write(LAIR_PASSWORD);
  createConductorProcess.stdin.end();

  let conductorDir = "";
  const createConductorPromise = new Promise<void>((resolve) => {
    createConductorProcess.stdout.on("data", (data) => {
      // console.info(
      //   "data coming from create conductor process",
      //   data.toString()
      // );
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
    ["sandbox", "--piped", "run", "-e", conductorDir],
    {
      detached: true, // create a process group; without this option, killing
      // the process doesn't kill the conductor
    }
  );
  runConductorProcess.stdin.write(LAIR_PASSWORD);
  runConductorProcess.stdin.end();

  const runConductorPromise = new Promise<void>((resolve) => {
    runConductorProcess.stdout.on("data", (data: Buffer) => {
      const adminPortMatches = data
        .toString()
        .match(/Running conductor on admin port (\d+)/);
      const isConductorStarted = data
        .toString()
        .includes("Connected successfully to a running holochain");
      if (adminPortMatches || isConductorStarted) {
        // if (adminPortMatches) {
        //   this.adminApiUrl.port = adminPortMatches[1];
        //   logger.debug(`starting conductor\n${data}`);
        // }
        if (isConductorStarted) {
          // this is the last output of the startup process
          resolve();
        }
      }
    });
  });
  await runConductorPromise;
  return runConductorProcess;
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
    }
    t.end();
  };

export const installAppAndDna = async (
  adminPort: number,
  signalCb?: AppSignalCb
): Promise<{
  installed_app_id: InstalledAppId;
  cell_id: CellId;
  role_id: RoleId;
  client: AppWebsocket;
  admin: AdminWebsocket;
  dna_hash: DnaHash;
}> => {
  const installed_app_id = "app";
  const role_id = "mydna";
  const admin = await AdminWebsocket.connect(`ws://localhost:${adminPort}`);

  const path = `${FIXTURE_PATH}/test.dna`;
  const hash = await admin.registerDna({
    path,
  });

  console.log("THE HASH:", hash);

  const agent = await admin.generateAgentPubKey();
  const app = await admin.installApp({
    installed_app_id,
    agent_key: agent,
    dnas: [
      {
        hash,
        role_id,
      },
    ],
  });
  console.log("THE INSTALL RESULT:", app);
  const cell_id = app.cell_data[0].cell_id;
  await admin.activateApp({ installed_app_id });
  // destructure to get whatever open port was assigned to the interface
  const { port: appPort } = await admin.attachAppInterface({ port: 0 });
  const client = await AppWebsocket.connect(
    `ws://localhost:${appPort}`,
    12000,
    signalCb
  );
  return { installed_app_id, cell_id, role_id, client, admin, dna_hash: hash };
};
