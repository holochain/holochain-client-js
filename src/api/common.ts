import { RoleName } from "../types.js";
import { IsoWebSocket } from "./client.js";

const ERROR_TYPE = "error";
export const DEFAULT_TIMEOUT = 60000;

/**
 * @public
 */
export type Transformer<ReqI, ReqO, ResI, ResO> = {
  input: (req: ReqI) => ReqO;
  output: (res: ResI) => ResO;
};

/**
 * @public
 */
export type Requester<Req, Res> = (req: Req, timeout?: number) => Promise<Res>;
/**
 * @public
 */
export type RequesterNoArg<Res> = (timeout?: number) => Promise<Res>;
/**
 * @public
 */
export type Tagged<T> = { type: string; value: T };

/**
 * Take a Requester function which deals with tagged requests and responses,
 * and return a Requester which deals only with the inner data types, also
 * with the optional Transformer applied to further modify the input and output.
 *
 * @public
 */
export const requesterTransformer =
  <ReqI, ReqO, ResI, ResO>(
    requester: Requester<Tagged<ReqO>, Tagged<ResI>>,
    tag: string,
    transform: Transformer<ReqI, ReqO, ResI, ResO> = identityTransformer,
  ) =>
  async (req: ReqI, timeout?: number) => {
    const transformedInput = await transform.input(req);
    const input = { type: tag, value: transformedInput };
    const response = await requester(input, timeout);
    return transform.output(response.value);
  };

const identity = (x: any) => x;
const identityTransformer = {
  input: identity,
  output: identity,
};

/**
 * Error thrown when response from Holochain is an error.
 *
 * @public
 */
export class HolochainError extends Error {
  constructor(name: string, message: string) {
    super();
    this.name = name;
    this.message = message;
  }
}

// this determines the error format of all error responses
export const catchError = (response: any) => {
  if (response.type === ERROR_TYPE) {
    const errorName = response.value.type;
    const error = new HolochainError(errorName, response.value.value);
    return Promise.reject(error);
  } else {
    return Promise.resolve(response);
  }
};

export const promiseTimeout = (
  promise: Promise<unknown>,
  tag: string,
  ms: number,
) => {
  let id: NodeJS.Timeout;

  const timeout = new Promise((_, reject) => {
    id = setTimeout(
      () => reject(new Error(`Request timed out in ${ms} ms: ${tag}`)),
      ms,
    );
  });

  return new Promise((res, rej) =>
    Promise.race([promise, timeout])
      .then((a) => {
        clearTimeout(id);
        return res(a);
      })
      .catch((e) => {
        clearTimeout(id);
        return rej(e);
      }),
  );
};

const CLONE_ID_DELIMITER = ".";

/**
 * Check if a cell's role name is a valid clone id.
 *
 * @param roleName - The role name to check.
 *
 * @public
 */
export const isCloneId = (roleName: RoleName) =>
  roleName.includes(CLONE_ID_DELIMITER);

/**
 * Parse a clone id and get the role name part of it.
 *
 * @param roleName - The role name to parse.
 * @public
 */
export const getBaseRoleNameFromCloneId = (roleName: RoleName) => {
  if (!isCloneId(roleName)) {
    throw new HolochainError(
      "MissingCloneIdDelimiter",
      `invalid clone id - no clone id delimiter found in role name ${roleName}`,
    );
  }
  return roleName.split(CLONE_ID_DELIMITER)[0];
};

/**
 * Identifier of a clone cell, composed of the DNA's role id and the index
 * of the clone, starting at 0.
 *
 * Example: `profiles.0`
 *
 * @public
 */
export class CloneIdHelper {
  private readonly roleName: RoleName;
  private readonly index: number;

  constructor(roleName: RoleName, index: number) {
    this.roleName = roleName;
    this.index = index;
  }

  /**
   * Parse a role id of a clone cell to obtain a clone id instance.
   * @param roleName - Role id to parse.
   * @returns A clone id instance.
   */
  static fromRoleName(roleName: RoleName) {
    const parts = roleName.split(CLONE_ID_DELIMITER);
    if (parts.length !== 2) {
      throw new HolochainError(
        "MalformedCloneId",
        `clone id must consist of 'role_id.clone_index', but got ${roleName}`,
      );
    }
    return new CloneIdHelper(parts[0], parseInt(parts[1]));
  }

  toString() {
    return `${this.roleName}${CLONE_ID_DELIMITER}${this.index}`;
  }

  getBaseRoleName() {
    return this.roleName;
  }
}

/**
 * @public
 */
export type WsClientOptions = Pick<IsoWebSocket.ClientOptions, "origin">;

/**
 * Options for a Websocket connection.
 *
 * @public
 */
export interface WebsocketConnectionOptions {
  /**
   * The `ws://` URL of the Websocket server to connect to. Not required when connecting to App API from a Launcher or Kangaroo environment.
   */
  url?: URL;

  /**
   * Options to pass to the underlying websocket connection.
   */
  wsClientOptions?: WsClientOptions;

  /**
   * Timeout to default to for all operations.
   */
  defaultTimeout?: number;
}
