import crypto from 'crypto'

export const getRazorpayKeyId = () => {
    const keyId = process.env.RAZORPAY_KEY_ID

    if (!keyId) {
        throw new Error('RAZORPAY_KEY_ID is not configured')
    }

    return keyId
}

export const getRazorpayKeySecret = () => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keySecret) {
        throw new Error('RAZORPAY_KEY_SECRET is not configured')
    }

    return keySecret
}

export const getCoinbaseWebhookSecret = () => {
    const secret = process.env.COINBASE_WEBHOOK_SECRET

    if (!secret) {
        throw new Error('COINBASE_WEBHOOK_SECRET is not configured')
    }

    return secret
}

export const getCoinbaseApiKey = () => {
    const apiKey = process.env.COINBASE_API_KEY

    if (!apiKey) {
        throw new Error('COINBASE_API_KEY is not configured')
    }

    return apiKey
}

export const verifyRazorpayOrderPayment = (data: {
    orderId: string
    paymentId: string
    signature: string
}) => {
    const { orderId, paymentId, signature } = data
    const secret = getRazorpayKeySecret()
    const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex')

    console.log('[Razorpay Signature Debug]:', {
        orderId,
        paymentId,
        secretLength: secret?.length,
        receivedSignature: signature,
        generatedSignature,
        matches: generatedSignature === signature,
    })

    return generatedSignature === signature
}

export const verifyCoinbaseWebhookSignature = (data: {
    rawBody: Buffer | string
    signature?: string
}) => {
    const { rawBody, signature } = data
    const secret = getCoinbaseWebhookSecret()

    if (!signature) {
        return false
    }

    const generatedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

    return generatedSignature === signature
}
