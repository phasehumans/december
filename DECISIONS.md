### Engineering Decisions @phasehumans

#### 19-02-2026 - bun runtime for ui over node
- opt for bun rt over node for frontend react
- sever runtime is bun, so it makes more sense to go for for same for ui
- choosing node for ui, is good. but it will create overhead of 2 runtime
- bun is fairly new, i am to0 optimistic for bun right now, lets see

#### 17-02-2026 - removed the landing page
- removed the landing page, the user visit directly to the webiste
- having landing page creates more overhead at this moment, if needed then add later
- restrict users actions on @context canvas, when user is not authenticated

#### 16-02-2026 - opt for module based approach
- adopt module based appraoch instead of sepearate controller, routes approach
- phasehumans can be divided into modules like auth, user, project, usage/ billing etc
- each module contains routes, controller, schema and service files to seperate each layer
- routes -> controller - [schema validation] -> service
