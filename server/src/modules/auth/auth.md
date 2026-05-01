### auth

- email (otp) + google auth
- jwt (access ~15m, refresh ~7–30d)
- httpOnly cookies
- db sessions (source of truth)

routes

- POST /signup
- POST /verify
- POST /login
- POST /google
- POST /refresh

flow

- signup -> otp
- verify/login/google -> create session + set tokens
- refresh -> validate session + rotate tokens

tokens

- access -> { userId, sessionId }
- refresh -> hashed in db, rotated

session

- id, userId
- refreshTokenHash
- userAgent, ipAddress
- expiresAt

notes

- hash + compare refresh token
- check session (exist, match, expiry)
- invalid -> delete session
- cookie-based auth
- refresh rotation enabled
