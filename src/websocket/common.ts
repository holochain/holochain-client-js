const ERROR_TYPE = 'error'

export const catchError = (res: any) => {
  return res.type === ERROR_TYPE
    ? Promise.reject(res)
    : Promise.resolve(res)
}

export const promiseTimeout = (ms: number, promise: Promise<any>) => {
  let id
  let timeout = new Promise((resolve, reject) => {
    id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error('Timed out in '+ ms + 'ms.'))
    }, ms)
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
      return rej(new Error(e))
    });
  })
}
