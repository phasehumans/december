import crypto from 'crypto'

/**
 * Web push without a library: the payload is encrypted for the browser (RFC 8291,
 * aes128gcm) and the request is signed with the server's VAPID key (RFC 8292).
 */

export type PushTarget = {
    endpoint: string
    /** the browser's P-256 public key, base64url (PushSubscription.getKey('p256dh')) */
    p256dh: string
    /** the browser's 16-byte auth secret, base64url */
    auth: string
}

export type VapidKeys = {
    publicKey: string
    privateKey: string
    /** "mailto:..." or an https url, so push services can reach the sender */
    subject: string
}

export type PushResult = {
    ok: boolean
    status: number
    /** the browser removed this subscription: delete it */
    gone: boolean
}

const RECORD_SIZE = 4096

const b64url = (value: Buffer) => value.toString('base64url')
const fromB64url = (value: string) => Buffer.from(value, 'base64url')

const hmac = (key: Buffer, data: Buffer) => crypto.createHmac('sha256', key).update(data).digest()

// HKDF with one block of output, which is all the key and nonce need
const hkdf = (salt: Buffer, ikm: Buffer, info: Buffer, length: number) =>
    hmac(hmac(salt, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, length)

/** a new VAPID key pair, for the server env */
export const generateVapidKeys = () => {
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.generateKeys()
    return {
        publicKey: b64url(ecdh.getPublicKey()),
        privateKey: b64url(ecdh.getPrivateKey()),
    }
}

/** encrypts one push message for one browser (RFC 8291) */
export const encryptPushPayload = (
    target: Pick<PushTarget, 'p256dh' | 'auth'>,
    payload: Buffer,
    // fixed values for tests only
    options?: { salt?: Buffer; senderKeys?: crypto.ECDH }
) => {
    const browserPublicKey = fromB64url(target.p256dh)
    const authSecret = fromB64url(target.auth)

    const sender = options?.senderKeys ?? crypto.createECDH('prime256v1')
    if (!options?.senderKeys) sender.generateKeys()
    const senderPublicKey = sender.getPublicKey()
    const sharedSecret = sender.computeSecret(browserPublicKey)

    const keyInfo = Buffer.concat([
        Buffer.from('WebPush: info\0'),
        browserPublicKey,
        senderPublicKey,
    ])
    const ikm = hkdf(authSecret, sharedSecret, keyInfo, 32)

    const salt = options?.salt ?? crypto.randomBytes(16)
    const contentKey = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
    const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12)

    // one record: the payload, then the 0x02 delimiter that marks the last record
    const cipher = crypto.createCipheriv('aes-128-gcm', contentKey, nonce)
    const encrypted = Buffer.concat([
        cipher.update(Buffer.concat([payload, Buffer.from([2])])),
        cipher.final(),
        cipher.getAuthTag(),
    ])

    const header = Buffer.alloc(21)
    salt.copy(header, 0)
    header.writeUInt32BE(RECORD_SIZE, 16)
    header.writeUInt8(senderPublicKey.length, 20)

    return Buffer.concat([header, senderPublicKey, encrypted])
}

/** the Authorization header value for one push service (RFC 8292) */
export const vapidAuthorization = (endpoint: string, keys: VapidKeys, now = Date.now()) => {
    const publicKey = fromB64url(keys.publicKey)
    const privateKey = crypto.createPrivateKey({
        format: 'jwk',
        key: {
            kty: 'EC',
            crv: 'P-256',
            d: keys.privateKey,
            x: b64url(publicKey.subarray(1, 33)),
            y: b64url(publicKey.subarray(33, 65)),
        },
    })

    const header = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
    const claims = b64url(
        Buffer.from(
            JSON.stringify({
                aud: new URL(endpoint).origin,
                exp: Math.floor(now / 1000) + 12 * 60 * 60,
                sub: keys.subject,
            })
        )
    )
    const signature = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), {
        key: privateKey,
        dsaEncoding: 'ieee-p1363',
    })

    return `vapid t=${header}.${claims}.${b64url(signature)}, k=${keys.publicKey}`
}

/** sends one push message. a 404 or 410 answer means the subscription is gone */
export const sendWebPush = async (data: {
    target: PushTarget
    payload: object
    keys: VapidKeys
    urgency?: 'normal' | 'high'
    /** a newer message with the same topic replaces an undelivered older one */
    topic?: string
}): Promise<PushResult> => {
    const { target, payload, keys, urgency = 'normal', topic } = data

    const body = encryptPushPayload(target, Buffer.from(JSON.stringify(payload)))
    const response = await fetch(target.endpoint, {
        method: 'POST',
        headers: {
            Authorization: vapidAuthorization(target.endpoint, keys),
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            TTL: String(24 * 60 * 60),
            Urgency: urgency,
            ...(topic ? { Topic: topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {}),
        },
        body,
    })

    return {
        ok: response.ok,
        status: response.status,
        gone: response.status === 404 || response.status === 410,
    }
}
