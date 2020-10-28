const ERROR_TYPE = 'error'

export const catchError = (res: any) => {
  return res.type === ERROR_TYPE
    ? Promise.reject(res)
    : Promise.resolve(res)
}
