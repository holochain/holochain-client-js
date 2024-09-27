import { CellId } from "../types.js";
import { encodeHashToBase64 } from "./base64.js";

export const isSameCell = (cellId1: CellId, cellId2: CellId) => {
  const dnaHashB64_1 = encodeHashToBase64(cellId1[0]);
  const agentPubKeyB64_1 = encodeHashToBase64(cellId1[1]);
  const dnaHashB64_2 = encodeHashToBase64(cellId2[0]);
  const agentPubKeyB64_2 = encodeHashToBase64(cellId2[1]);
  return dnaHashB64_1 === dnaHashB64_2 && agentPubKeyB64_1 === agentPubKeyB64_2;
};
