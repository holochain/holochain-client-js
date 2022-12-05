import { hashZomeCall } from "@holochain/serialization/holochain_serialization_js.js";
import { encode } from "@msgpack/msgpack";
import { spawn } from "node:child_process";
import { Test } from "tape";
import nacl from "tweetnacl";
import { AdminWebsocket } from "../../src/api/admin/websocket.js";
import {
  AppSignalCb,
  CallZomeRequest,
  CallZomeRequestUnsigned,
} from "../../src/api/app/types.js";
import {
  generateSigningKeyPair,
  randomCapSecret,
  randomNonce,
} from "../../src/api/app/util.js";
import { AppWebsocket } from "../../src/api/app/websocket.js";
import { FunctionName, ZomeName } from "../../src/api/index.js";
import { CapSecret } from "../../src/hdk/capabilities.js";
import {
  AgentPubKey,
  CellId,
  InstalledAppId,
  RoleName,
} from "../../src/types.js";

export const FIXTURE_PATH = "./test/e2e/fixture";
export type ZomeCallUnsignedPayload =
  | Pick<
      CallZomeRequestUnsigned,
      "cell_id" | "zome_name" | "fn_name" | "provenance" | "payload"
    > & { cap_secret?: CapSecret };

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
  adminPort: number,
  signalCb?: AppSignalCb
): Promise<{
  installed_app_id: InstalledAppId;
  cell_id: CellId;
  role_name: RoleName;
  client: AppWebsocket;
  admin: AdminWebsocket;
}> => {
  const installed_app_id = "app";
  const role_name = "mydna";
  const admin = await AdminWebsocket.connect(`ws://localhost:${adminPort}`);

  const path = `${FIXTURE_PATH}/test.dna`;
  const hash = await admin.registerDna({
    modifiers: {},
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
        role_name: role_name,
      },
    ],
  });
  console.log("THE INSTALL RESULT:", app);
  const cell_id = app.cell_data[0].cell_id;
  await admin.enableApp({ installed_app_id });
  // destructure to get whatever open port was assigned to the interface
  const { port: appPort } = await admin.attachAppInterface({ port: 0 });
  const client = await AppWebsocket.connect(
    `ws://localhost:${appPort}`,
    12000,
    signalCb
  );
  return { installed_app_id, cell_id, role_name: role_name, client, admin };
};

export const grantSigningKey = async (
  admin: AdminWebsocket,
  cellId: CellId,
  functions: Array<[ZomeName, FunctionName]>,
  signingKey: AgentPubKey
) => {
  const capSecret = randomCapSecret();
  await admin.grantZomeCallCapability({
    cell_id: cellId,
    cap_grant: {
      tag: "zome-call-signing-key",
      functions,
      access: {
        Assigned: {
          secret: capSecret,
          assignees: [signingKey],
        },
      },
    },
  });
  return capSecret;
};

export const signZomeCall = (
  capSecret: CapSecret,
  signingKey: AgentPubKey,
  keyPair: nacl.SignKeyPair,
  payload: ZomeCallUnsignedPayload
) => {
  const unsignedZomeCallPayload: CallZomeRequestUnsigned = {
    cap_secret: capSecret,
    cell_id: payload.cell_id,
    zome_name: payload.zome_name,
    fn_name: payload.fn_name,
    provenance: signingKey,
    payload: encode(payload.payload),
    nonce: randomNonce(),
    expires_at: new Date().getTime() * 1000 + 1000000 * 60 * 5, // 5 mins from now in microseconds
  };
  const hashedZomeCall = hashZomeCall(unsignedZomeCallPayload);
  const signature = nacl
    .sign(hashedZomeCall, keyPair.secretKey)
    .subarray(0, nacl.sign.signatureLength);

  const signedZomeCall: CallZomeRequest = {
    ...unsignedZomeCallPayload,
    signature,
  };
  return signedZomeCall;
};

export const grantSigningKeyAndSignZomeCall = async (
  admin: AdminWebsocket,
  payload: ZomeCallUnsignedPayload
) => {
  const [keyPair, signingKey] = generateSigningKeyPair();
  const capSecret = await grantSigningKey(
    admin,
    payload.cell_id,
    [[payload.zome_name, payload.fn_name]],
    signingKey
  );
  payload = { ...payload, cap_secret: capSecret };
  const signedZomeCall = signZomeCall(capSecret, signingKey, keyPair, payload);
  return signedZomeCall;
};
