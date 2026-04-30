import crypto from 'crypto'

const hashRefreshToken = (refreshToken: string) => {
    return crypto.createHash('sha256').update(refreshToken).digest('hex')
}

const getRefreshTokenExpiryDate = () => {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // matches 7d refresh token expiry
    return expiresAt
}

export const authSession = {
    hashRefreshToken,
    getRefreshTokenExpiryDate,
}
