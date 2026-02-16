import "express"

declare global {
  namespace Express {
    interface Request {
      userId?: {
        userId: string
      }
    }
  }
}