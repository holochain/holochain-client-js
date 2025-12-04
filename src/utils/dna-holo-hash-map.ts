import flatMap from "lodash-es/flatMap.js";
import {
  HoloHash,
  DnaHash,
  ActionHash,
  AgentPubKey,
  AnyDhtHash,
  DhtOpHash,
  EntryHash,
  ExternalHash,
  WarrantHash,
  WasmHash,
} from "../types.js";
import { HoloHashMap } from "./holo-hash-map.js";

/**
 * A Map of DnaHash to HoloHashMap.
 *
 * i.e. A Map of DnaHash to a Map of HoloHash to a value.
 *
 * @param initialEntries - Optional array of `[[DnaHash, HoloHash], value]` to insert into the map.
 *
 * @public
 */
export class DnaHoloHashMap<K extends HoloHash, T> {
  private _dnaMap: HoloHashMap<DnaHash, HoloHashMap<K, T>> = new HoloHashMap();

  constructor(initialEntries?: Array<[[DnaHash, K], T]>) {
    if (initialEntries) {
      for (const [[dnaHash, key], value] of initialEntries) {
        this.set([dnaHash, key], value);
      }
    }
  }

  /**
   * Gets the value associated with a [DnaHash, HoloHash] key pair.
   *
   * @param key - Array of [DnaHash, HoloHash]
   * @returns The value if found, undefined otherwise
   */
  get([dnaHash, key]: [DnaHash, K]): T | undefined {
    return this._dnaMap.get(dnaHash)
      ? this._dnaMap.get(dnaHash)?.get(key)
      : undefined;
  }

  /**
   * Checks if a [DnaHash, HoloHash] key pair exists in the map.
   *
   * @param cellKey - Array of [DnaHash, HoloHash] to check
   * @returns True if the key exists, false otherwise
   */
  has([dnaHash, key]: [DnaHash, K]): boolean {
    const map = this._dnaMap.get(dnaHash);
    return map ? map.has(key) : false;
  }

  /**
   * Sets a value for a [DnaHash, HoloHash] key pair.
   *
   * @param key - Tuple of [DnaHash, HoloHash]
   * @param value - The value to store
   * @returns This map instance for chaining
   */
  set([dnaHash, key]: [DnaHash, K], value: T): this {
    const map = this._dnaMap.get(dnaHash);

    if (map === undefined) {
      this._dnaMap.set(dnaHash, new HoloHashMap([[key, value]]));
    } else {
      map.set(key, value);
    }

    return this;
  }

  /**
   * Removes all entries from the map.
   */
  clear() {
    this._dnaMap.clear();
  }

  /**
   * Deletes an entry from the map. If this was the last entry for a DNA, the DNA entry is also removed.
   *
   * @param key - Array of [DnaHash, HoloHash] to delete
   * @returns True if the DNA entry was deleted (last entry for that DNA), false otherwise
   */
  delete([dnaHash, key]: [DnaHash, K]): boolean {
    const map = this._dnaMap.get(dnaHash);
    if (map) {
      const wasDeleted = map.delete(key);

      if (wasDeleted && Array.from(map.keys()).length === 0) {
        this._dnaMap.delete(dnaHash);
      }

      return wasDeleted;
    } else {
      return false;
    }
  }

  /**
   * Returns all [DnaHash, HoloHash] key pairs in the map.
   *
   * @returns Array of all key tuples
   */
  keys(): Array<[DnaHash, K]> {
    const dnaHashes = Array.from(this._dnaMap.keys());

    return flatMap(dnaHashes, (dnaHash) => {
      const cell = this._dnaMap.get(dnaHash as HoloHash);
      const keys = cell ? Array.from(cell.keys()) : [];

      return keys.map((key) => [dnaHash, key] as [DnaHash, K]);
    });
  }

  /**
   * Returns all values in the map.
   *
   * @returns Array of all values
   */
  values(): Array<T> {
    return this.keys().map((dnaKey) => this.get(dnaKey) as T);
  }

  /**
   * Returns all entries as [[DnaHash, HoloHash], value] Arrays.
   *
   * @returns Array of all entries
   */
  entries(): Array<[[DnaHash, K], T]> {
    return this.keys().map(
      (dnaKey) => [dnaKey, this.get(dnaKey)] as [[DnaHash, K], T],
    );
  }

  /**
   * Creates a new DnaHoloHashMap containing only entries that match the filter predicate.
   *
   * @param fn - Predicate function to test each value
   * @returns A new filtered map
   */
  filter(fn: (value: T) => boolean): DnaHoloHashMap<K, T> {
    const entries = this.entries();
    const mappedValues = entries.filter(([, v]) => fn(v));

    return new DnaHoloHashMap(mappedValues);
  }

  /**
   * Creates a new DnaHoloHashMap with values transformed by the mapping function.
   *
   * @param fn - Function to transform each value
   * @returns A new mapped map
   */
  map<R>(fn: (value: T) => R): DnaHoloHashMap<K, R> {
    const entries = this.entries();
    const mappedValues = entries.map(
      ([id, v]) => [id, fn(v)] as [[DnaHash, K], R],
    );

    return new DnaHoloHashMap(mappedValues);
  }

  /**
   * Returns all HoloHash keys for a specific DNA.
   *
   * @param dnaHash - The DNA hash to query
   * @returns Array of HoloHash keys for this DNA
   */
  keysForDna(dnaHash: DnaHash): Array<K> {
    const map = this._dnaMap.get(dnaHash);
    return map ? Array.from(map.keys()) : [];
  }

  /**
   * Returns all values for a specific DNA.
   *
   * @param dnaHash - The DNA hash to query
   * @returns Array of values for this DNA
   */
  valuesForDna(dnaHash: DnaHash): Array<T> {
    const map = this._dnaMap.get(dnaHash);
    return map ? Array.from(map.values()) : [];
  }

  /**
   * Returns all [HoloHash, value] entries for a specific DNA.
   *
   * @param dnaHash - The DNA hash to query
   * @returns Array of entries for this DNA
   */
  entriesForDna(dnaHash: DnaHash): Array<[K, T]> {
    const map = this._dnaMap.get(dnaHash);
    return map ? Array.from(map.entries()) : [];
  }

  /**
   * Removes all entries for a specific DNA.
   *
   * @param dnaHash - The DNA hash to clear
   */
  clearForDna(dnaHash: DnaHash) {
    const map = this._dnaMap.get(dnaHash);
    if (map !== undefined) {
      map.clear();
      this._dnaMap.set(dnaHash, map);
    }
  }

  /**
   * The number of DNA entries in the map.
   *
   * @returns The number of unique DNAs
   */
  get size() {
    return this._dnaMap.size;
  }
}

/**
 * @public
 */
export class DnaAgentPubKeyMap<V> extends DnaHoloHashMap<AgentPubKey, V> {}

/**
 * @public
 */
export class DnaDnaHashMap<V> extends DnaHoloHashMap<DnaHash, V> {}

/**
 * @public
 */
export class DnaWasmHashMap<V> extends DnaHoloHashMap<WasmHash, V> {}

/**
 * @public
 */
export class DnaEntryHashMap<V> extends DnaHoloHashMap<EntryHash, V> {}

/**
 * @public
 */
export class DnaActionHashMap<V> extends DnaHoloHashMap<ActionHash, V> {}

/**
 * @public
 */
export class DnaAnyDhtHashMap<V> extends DnaHoloHashMap<AnyDhtHash, V> {}

/**
 * @public
 */
export class DnaExternalHashMap<V> extends DnaHoloHashMap<ExternalHash, V> {}

/**
 * @public
 */
export class DnaDhtOpHashMap<V> extends DnaHoloHashMap<DhtOpHash, V> {}

/**
 * @public
 */
export class DnaWarrantHashMap<V> extends DnaHoloHashMap<WarrantHash, V> {}

/**
 * @public
 */
export class CellMap<V> extends DnaAgentPubKeyMap<V> {}
