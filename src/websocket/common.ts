const ERROR_TYPE = 'error'
const DEFAULT_TIMEOUT = 15000

export const catchError = (res: any) => {
  return res.type === ERROR_TYPE
    ? Promise.reject(res)
    : Promise.resolve(res)
}

export const promiseTimeout = (promise: Promise<any>, ms?: number) => {
  let id
  let time = ms === undefined ? DEFAULT_TIMEOUT : ms

  let timeout = new Promise((resolve, reject) => {
    id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`Timed out in ${time}ms: ${tag}'))
    }, time)
  })

  return new Promise((res, rej) => {
    Promise.race([
      promise,
      timeout
    ]).then((a) => {
      clearTimeout(id);
      return res(a)
    })
    .catch(e => {
      return rej(e)
    });
  })
}
