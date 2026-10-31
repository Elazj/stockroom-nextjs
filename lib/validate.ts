export const emailOk = (e: string) => e.length <= 254 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(e) && !/\.\./.test(e)
export const pwErr = (p: string) =>
  p.length < 8 ? 'Password needs at least 8 characters.' :
  !/[a-z]/.test(p) || !/[A-Z]/.test(p) ? 'Password needs upper and lower case letters.' :
  !/\d/.test(p) ? 'Password needs a number.' :
  !/[^A-Za-z0-9]/.test(p) ? 'Password needs a symbol such as ! or #.' : ''
