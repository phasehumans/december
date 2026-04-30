import type { TokenPayload } from '../modules/auth/auth.token'

declare global {
    namespace Express {
        interface Request {
            user?: Pick<TokenPayload, 'userId' | 'sessionId'>
        }
    }
}

export {}
