import rateLimit from 'express-rate-limit'

export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 500, // limit each ip or user to 500 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // return rate limit info in the `ratelimit-*` headers
    legacyHeaders: false, // disable the `x-ratelimit-*` headers
    keyGenerator: (req) => {
        // use userid if available (set by authmiddleware), otherwise fallback to ip
        if (req.user && req.user.userId) {
            return req.user.userId
        }
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress
        return String(clientIp || 'unknown')
    },
    message: {
        status: 'error',
        message: 'Too many requests from this IP or User, please try again after 15 minutes',
        metadata: {
            upgradeUrl: 'http://localhost:3000/settings/billing', // provide upgrade urls for 429
        },
    },
})

export const deviceCodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5, // limit each ip to 5 requests per windowms for device code generation
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress
        return String(clientIp || 'unknown')
    },
    message: {
        status: 'error',
        message:
            'Too many device code generation requests from this IP, please try again after 15 minutes',
    },
})
