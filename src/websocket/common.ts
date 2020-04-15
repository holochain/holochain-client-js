
export const catchError = (res: any) => res.type == 'Error' ? Promise.reject(res) : Promise.resolve(res)
