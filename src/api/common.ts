import { RoleName } from "../types.js";

const ERROR_TYPE = "error";
export const DEFAULT_TIMEOUT = 15000;

export type Transformer<ReqI, ReqO, ResI, ResO> = {
  input: (req: ReqI) => ReqO;
  output: (res: ResI) => ResO;
};

export type Requester<Req, Res> = (req: Req, timeout?: number) => Promise<Res>;
export type RequesterUnit<Res> = () => Promise<Res>;
export type Tagged<T> = { type: string; data: T };

/**
 * Take a Requester function which deals with tagged requests and responses,
 * and return a Requester which deals only with the inner data types, also
 * with the optional Transformer applied to further modify the input and output.
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

export const catchError = (res: any) => {
  return res.type === ERROR_TYPE ? Promise.reject(res) : Promise.resolve(res);
};

export const promiseTimeout = (
  promise: Promise<unknown>,
  tag: string,
  ms: number
) => {
  let id: NodeJS.Timeout;

  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`Timed out in ${ms}ms: ${tag}`));
    }, ms);
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

export const isCloneId = (roleName: RoleName) =>
  roleName.includes(CLONE_ID_DELIMITER);

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
   * @param roleName Role id to parse.
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
