import rateLimit from 'express-rate-limit'

export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 500, // Limit each IP or User to 500 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
        // Use userId if available (set by authMiddleware), otherwise fallback to IP
        if (req.user && req.user.id) {
            return req.user.id
        }
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress
        return String(clientIp || 'unknown')
    },
    message: {
        status: 'error',
        message: 'Too many requests from this IP or User, please try again after 15 minutes',
        metadata: {
            upgradeUrl: 'http://localhost:3000/settings/billing', // Provide upgrade URLs for 429
        },
    },
})

export const deviceCodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5, // Limit each IP to 5 requests per windowMs for device code generation
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
