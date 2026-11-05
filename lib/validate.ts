export const emailOk = (e: string) => e.length <= 254 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(e) && !/\.\./.test(e)
export const pwErr = (p: string) =>
  p.length < 8 ? 'Password needs at least 8 characters.' :
  !/[a-z]/.test(p) || !/[A-Z]/.test(p) ? 'Password needs upper and lower case letters.' :
  !/\d/.test(p) ? 'Password needs a number.' :
  !/[^A-Za-z0-9]/.test(p) ? 'Password needs a symbol such as ! or #.' : ''

/** Random password that always passes the password rules. */
export function genPassword(len = 12) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%*?']
  const all = sets.join('')
  const rnd = (n: number) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n }
  const out = sets.map((x) => x[rnd(x.length)])
  while (out.length < len) out.push(all[rnd(all.length)])
  for (let i = out.length - 1; i > 0; i--) { const j = rnd(i + 1); [out[i], out[j]] = [out[j], out[i]] }
  return out.join('')
}
