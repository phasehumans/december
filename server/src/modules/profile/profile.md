### profile

- user profile + preferences
- protected (auth middleware)
- github connect + session control
- soft delete

routes

- GET /github/connect
- GET /info
- GET /card
- GET /
- PATCH /name
- PATCH /username
- PATCH /password
- PATCH /notifications
- POST /signout
- POST /signout/all
- DELETE /
- POST /suggestions
- POST /sound

flow

- auth -> get userId
- validate -> service → db
- github -> code -> token -> user -> store
- signout -> revoke session
- delete -> revoke sessions + soft delete

notes

- user must exist + not deleted
- username unique + different
- partial updates supported
- session revocation (not delete)
