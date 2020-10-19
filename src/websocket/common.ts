const REJECT_TYPES = ['Error', 'ZomeCallUnauthorized']

export const catchError = (res: any) => {
  return REJECT_TYPES.includes(res.type)
    ? Promise.reject(res)
    : Promise.resolve(res)
}
