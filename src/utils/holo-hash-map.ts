import {
  ActionHash,
  ActionHashB64,
  AgentPubKey,
  AgentPubKeyB64,
  AnyDhtHash,
  AnyDhtHashB64,
  DhtOpHash,
  DhtOpHashB64,
  DnaHash,
  DnaHashB64,
  EntryHash,
  EntryHashB64,
  ExternalHash,
  ExternalHashB64,
  HoloHash,
  HoloHashB64,
  WarrantHash,
  WarrantHashB64,
  WasmHash,
  WasmHashB64,
} from "../types.js";
import { encodeHashToBase64, decodeHashFromBase64 } from "./base64.js";

/**
 * A Map of HoloHashB64 to a value.
 *
 * @param initialEntries - Optional array of [key, value] pairs to insert into the map.
 *
 * @public
 */
export class HoloHashB64Map<K extends HoloHashB64, V> extends Map<K, V> {
  constructor(initialEntries?: Array<[K, V]>) {
    super();

    if (initialEntries) {
      for (const [key, value] of initialEntries) {
        this.set(key, value);
      }
    }
  }
}

/**
 * @public
 */
export class AgentPubKeyB64Map<V> extends HoloHashB64Map<AgentPubKeyB64, V> {}

/**
 * @public
 */
export class DnaHashB64Map<V> extends HoloHashB64Map<DnaHashB64, V> {}

/**
 * @public
 */
export class WasmHashB64Map<V> extends HoloHashB64Map<WasmHashB64, V> {}

/**
 * @public
 */
export class EntryHashB64Map<V> extends HoloHashB64Map<EntryHashB64, V> {}

/**
 * @public
 */
export class ActionHashB64Map<V> extends HoloHashB64Map<ActionHashB64, V> {}

/**
 * @public
 */
export class AnyDhtHashB64Map<V> extends HoloHashB64Map<AnyDhtHashB64, V> {}

/**
 * @public
 */
export class ExternalHashB64Map<V> extends HoloHashB64Map<ExternalHashB64, V> {}

/**
 * @public
 */
export class DhtOpHashB64Map<V> extends HoloHashB64Map<DhtOpHashB64, V> {}

/**
 * @public
 */
export class WarrantHashB64Map<V> extends HoloHashB64Map<WarrantHashB64, V> {}

/**
 * A Map of HoloHash to a value.
 *
 * @param initialEntries - Optional array of [key, value] pairs to insert into the map.
 *
 * @public
 */
export class HoloHashMap<K extends HoloHash, V> implements Map<K, V> {
  private _map: HoloHashB64Map<HoloHashB64, V>;

  constructor(initialEntries?: Array<[K, V]>) {
    const encodedEntries = initialEntries?.map(
      ([k, v]) => [this._encodeKey(k), v] as [HoloHashB64, V],
    );
    this._map = new HoloHashB64Map<HoloHashB64, V>(encodedEntries);
  }

  /**
   * Removes all entries from the map.
   */
  clear() {
    this._map.clear();
  }

  /**
   * Returns an iterator of values in the map.
   *
   * @returns An iterator of all values
   */
  values() {
    return this._map.values();
  }

  /**
   * Checks if a key exists in the map.
   *
   * @param key - The HoloHash key to check
   * @returns True if the key exists, false otherwise
   */
  has(key: K): boolean {
    const k = this._encodeKey(key);
    return this._map.has(k);
  }

  /**
   * Gets the value associated with a key.
   *
   * @param key - The HoloHash key
   * @returns The value if found, undefined otherwise
   */
  get(key: K): V | undefined {
    const k = this._encodeKey(key);
    return this._map.get(k);
  }

  /**
   * Sets a key-value pair in the map.
   *
   * @param key - The HoloHash key
   * @param value - The value to store
   * @returns This map instance for chaining
   */
  set(key: K, value: V): this {
    const k = this._encodeKey(key);
    this._map.set(k, value);
    return this;
  }

  /**
   * Deletes an entry from the map.
   *
   * @param key - The HoloHash key to delete
   * @returns True if the entry was deleted, false if it didn't exist
   */
  delete(key: K): boolean {
    const k = this._encodeKey(key);
    return this._map.delete(k);
  }

  /**
   * Returns an iterator of keys in the map.
   *
   * @returns An iterator of all HoloHash keys
   */
  keys(): MapIterator<K> {
    return Array.from(this._map.keys())
      .map((key) => this._decodeKey(key))
      [Symbol.iterator]();
  }

  /**
   * Returns an iterator of [key, value] pairs.
   *
   * @returns An iterator of all entries
   */
  entries(): MapIterator<[K, V]> {
    return Array.from(this._map.entries())
      .map(([key, v]) => [this._decodeKey(key), v] as [K, V])
      [Symbol.iterator]();
  }

  /**
   * Executes a callback function for each entry in the map.
   *
   * @param callbackfn - Function to execute for each entry
   * @param thisArg - Optional value to use as 'this' when executing the callback
   */
  forEach(
    callbackfn: (value: V, key: K, map: Map<K, V>) => void,
    // This 'any' is inherited from the Map interface.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thisArg?: any,
  ): void {
    this._map.forEach((v, k) => {
      callbackfn(v, this._decodeKey(k) as K, this);
    }, thisArg);
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }

  get [Symbol.toStringTag](): string {
    return this._map[Symbol.toStringTag];
  }

  /**
   * The number of entries in the map.
   *
   * @returns The size of the map
   */
  get size() {
    return this._map.size;
  }

  private _encodeKey(key: K): HoloHashB64 {
    return encodeHashToBase64(key);
  }

  private _decodeKey(encoded: HoloHashB64): K {
    return decodeHashFromBase64(encoded) as K;
  }
}

/**
 * @public
 */
export class AgentPubKeyMap<V> extends HoloHashMap<AgentPubKey, V> {}

/**
 * @public
 */
export class DnaHashMap<V> extends HoloHashMap<DnaHash, V> {}

/**
 * @public
 */
export class WasmHashMap<V> extends HoloHashMap<WasmHash, V> {}

/**
 * @public
 */
export class EntryHashMap<V> extends HoloHashMap<EntryHash, V> {}

/**
 * @public
 */
export class ActionHashMap<V> extends HoloHashMap<ActionHash, V> {}

/**
 * @public
 */
export class AnyDhtHashMap<V> extends HoloHashMap<AnyDhtHash, V> {}

/**
 * @public
 */
export class ExternalHashMap<V> extends HoloHashMap<ExternalHash, V> {}

/**
 * @public
 */
export class DhtOpHashMap<V> extends HoloHashMap<DhtOpHash, V> {}

/**
 * @public
 */
export class WarrantHashMap<V> extends HoloHashMap<WarrantHash, V> {}

/**
 * A HoloHashMap that will fetch and store a value if it is not found in a 'get' call.
 *
 * @param fetchValue - A function that takes a key and fetches its value.
 * @param initialEntries - Optional array of [key, value] pairs to insert into the map.
 *
 * @public
 */
export class LazyHoloHashMap<K extends HoloHash, V> extends HoloHashMap<K, V> {
  constructor(
    protected fetchValue: (key: K) => V | undefined,
    initialEntries?: Array<[K, V]>,
  ) {
    super(initialEntries);
  }

  /**
   *
   * Get a value for a key.
   *
   * If no value for a key is found, it is fetched, inserted into the Map, then returned.
   *
   * @param key - HoloHash key
   * @returns value if found
   */
  get(key: K): V | undefined {
    const currentVal = super.get(key);

    if (currentVal !== undefined) {
      return currentVal;
    } else {
      const val = this.fetchValue(key);
      if (val !== undefined) {
        super.set(key, val);
      }

      return val;
    }
  }
}

/**
 * @public
 */
export class LazyAgentPubKeyMap<V> extends LazyHoloHashMap<AgentPubKey, V> {}

/**
 * @public
 */
export class LazyDnaHashMap<V> extends LazyHoloHashMap<DnaHash, V> {}

/**
 * @public
 */
export class LazyWasmHashMap<V> extends LazyHoloHashMap<WasmHash, V> {}

/**
 * @public
 */
export class LazyEntryHashMap<V> extends LazyHoloHashMap<EntryHash, V> {}

/**
 * @public
 */
export class LazyActionHashMap<V> extends LazyHoloHashMap<ActionHash, V> {}

/**
 * @public
 */
export class LazyAnyDhtHashMap<V> extends LazyHoloHashMap<AnyDhtHash, V> {}

/**
 * @public
 */
export class LazyExternalHashMap<V> extends LazyHoloHashMap<ExternalHash, V> {}

/**
 * @public
 */
export class LazyDhtOpHashMap<V> extends LazyHoloHashMap<DhtOpHash, V> {}

/**
 * @public
 */
export class LazyWarrantHashMap<V> extends LazyHoloHashMap<WarrantHash, V> {}
