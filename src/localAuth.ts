const CREDENTIALS_KEY = 'escape-room-online-local-credentials-v1'
const ITERATIONS = 310_000

type Credential = {
  salt: string
  hash: string
}

type Credentials = Record<string, Credential>

function isCredential(value: unknown): value is Credential {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const credential = value as Record<string, unknown>
  return typeof credential.salt === 'string' &&
    /^[a-f0-9]{32}$/i.test(credential.salt) &&
    typeof credential.hash === 'string' &&
    /^[a-f0-9]{64}$/i.test(credential.hash)
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256,
  )
  return toHex(bits)
}

function readCredentials(): Credentials {
  const stored = window.localStorage.getItem(CREDENTIALS_KEY)
  if (!stored) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    throw new Error('Saved local sign-in data is invalid. Clear this site’s storage to start again.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Saved local sign-in data is invalid. Clear this site’s storage to start again.')
  }

  const credentials = parsed as Record<string, unknown>
  if (Object.values(credentials).some((credential) => !isCredential(credential))) {
    throw new Error('Saved local sign-in data is invalid. Clear this site’s storage to start again.')
  }

  return parsed as Credentials
}

export async function authenticateLocalPlayer(username: string, password: string): Promise<void> {
  const identity = username.trim().toLocaleLowerCase()
  if (!identity || !password) {
    throw new Error('Enter your username and password to continue.')
  }
  if (!window.crypto?.subtle) {
    throw new Error('Secure local sign-in is unavailable in this browser. Use HTTPS or localhost.')
  }

  const credentials = readCredentials()
  const existing = credentials[identity]
  if (existing) {
    const salt = new Uint8Array(new ArrayBuffer(16))
    for (let index = 0; index < salt.length; index += 1) {
      salt[index] = Number.parseInt(existing.salt.slice(index * 2, index * 2 + 2), 16)
    }
    const candidate = await hashPassword(password, salt)
    if (candidate !== existing.hash) throw new Error('Incorrect password for this email or username.')
    return
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)))
  credentials[identity] = { salt: toHex(salt.buffer), hash: await hashPassword(password, salt) }
  window.localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials))
}
