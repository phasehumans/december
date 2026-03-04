## Engineering Decisions @phasehumans

### 03-03-2026

- auth with google is done, let integrate the github
- github integration is not used for auth, but to bring users repo ==
- so that user can push his vibecoded webapp to his github account
- i am not sure how am i gonna do this, but let see
- one thing is sure that github integration is for push code to users repo and not for auth
- i think for github intergation, i need some kind of verification from them at first place

#### 01-03-2026

- reducing ui just in two screens; home screen and output screen
- home screen will consist of a sidebar, a heading for CTA (what are we building today?), prompt box, 4 capsule suggestions and context canvas
- output screen will conssit chatbar, preview, code and header that contains options such has publish, github, download etc
- sidebar will contain two pages redirect: all projects and Account settings
- no navbar and footer; and landing page is removed as discuss earlier last week

#### 19-02-2026

- opt for bun rt over node for frontend react
- sever runtime is bun, so it makes more sense to go for for same for ui
- choosing node for ui, is good. but it will create overhead of 2 runtime
- bun is fairly new, i am to0 optimistic for bun right now, lets see

#### 17-02-2026

- removed the landing page, the user visit directly to the webiste
- having landing page creates more overhead at this moment, if needed then add later
- restrict users actions on @context canvas, when user is not authenticated

#### 16-02-2026

- adopt module based appraoch instead of sepearate controller, routes approach
- phasehumans can be divided into modules like auth, user, project, usage/ billing etc
- each module contains routes, controller, schema and service files to seperate each layer
- routes -> controller - [schema validation] -> service
