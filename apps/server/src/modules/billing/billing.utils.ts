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

    return generatedSignature === signature
}
