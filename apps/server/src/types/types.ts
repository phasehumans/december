import type { TokenPayload } from '../modules/auth/auth.utils'

declare global {
    namespace Express {
        interface Request {
            user?: Pick<TokenPayload, 'userId' | 'sessionId'>
        }
    }
}

export {}
