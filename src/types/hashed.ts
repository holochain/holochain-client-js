import { HoloHash } from "./common";

export interface HoloHashed<T> {
  hash: HoloHash;
  content: T;
}
