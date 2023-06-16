import { RoleName } from "../types.js";

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
export type RequesterUnit<Res> = () => Promise<Res>;
/**
 * @public
 */
export type Tagged<T> = { type: string; data: T };

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
    transform: Transformer<ReqI, ReqO, ResI, ResO> = identityTransformer
  ) =>
  async (req: ReqI, timeout?: number) => {
    const transformedInput = await transform.input(req);
    const input = { type: tag, data: transformedInput };
    const response = await requester(input, timeout);
    const output = transform.output(response.data);
    return output;
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
export const catchError = (res: any) => {
  if (res.type === ERROR_TYPE) {
    const error = new HolochainError(res.data.type, res.data.data);
    return Promise.reject(error);
  } else {
    return Promise.resolve(res);
  }
};

export const promiseTimeout = (
  promise: Promise<unknown>,
  tag: string,
  ms: number
) => {
  let id: NodeJS.Timeout;

  const timeout = new Promise((_, reject) => {
    id = setTimeout(
      () => reject(new Error(`Timed out in ${ms}ms: ${tag}`)),
      ms
    );
  });

  return new Promise((res, rej) => {
    Promise.race([promise, timeout])
      .then((a) => {
        clearTimeout(id);
        return res(a);
      })
      .catch((e) => {
        return rej(e);
      });
  });
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
    throw new Error(
      "invalid clone id: no clone id delimiter found in role name"
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
export class CloneId {
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
      throw new Error(
        "Malformed clone id: must consist of {role id.clone index}"
      );
    }
    return new CloneId(parts[0], parseInt(parts[1]));
  }

  toString() {
    return `${this.roleName}${CLONE_ID_DELIMITER}${this.index}`;
  }

  getBaseRoleName() {
    return this.roleName;
  }
}
