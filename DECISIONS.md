## Engineering Decisions @phasehumans

### 21-03-2026

- worked on build agent, code generation is working good, need to add retry logic. build agent is currently not persist anything in db, will add code storage, but where should i store the code, probably in code storage and store snapshot and metadata in postgres
- will be work on storage and retrieval and should create a starter kit to for each project type to reduce the token cost

### 20-03-2026

- done with the stream message of prompt and plan agent, prompt agent message is just a 2-3 line verdict of what user wants to build and plan agent sents the 4-5 bullets of work to be done, this are stream to chat in chatgpt style stream
- orginal work on this agents is diffrent; prompt agent send a struct json object to plan agent and plan agent sends {} to build agent about file and dependencies in background,
- this stream messages are just visual satisfaction to user, i need to ensure the non blocking when build agent generate each file, i think i should display the file that is getting genreated like ai studio does, it would be great ux elmt
- i need more strict json parser and swap a reasoning model in plan agent because this agent will define the quality of work produce by build agent

### 19-03-2026

- current status of phasehumans is that web/frontend is completed just need minor ui tweaks and real data integrations from backend, currently the work needed is for server/backend.
- basic setup and crud are done, prompt and plan agents are also done, next things i should focus on is build agent and stream its response of each file to frontend in code mirror editor.
- later that same files in batch will go to runtime; not firecracker and rust sperate runtime service in this phase, later add it, for now keep it simple and get the phasehumans working in real data, let it do it basic fn to generate code, later add the addons
- next target is just to build agent and stream its generation content to files in frontend and chatbar logs/activity

### 14-03-2026

- fixed the ide/ code edito; proceding with code mirror insted of monacco
- no very luctractive fn this is, phasehumans avg user will spend more time on canvas and prompt box rather than ide
- so keep the ide very simple and minimal, with code mirror
- kept the theme very close to prime theme with very minimal icons
- just this fn; file exprorer, active file tabs and code state

### 13-03-2026

- added prompt and planner agent in the system, deefine to have 5 agents
- prompt | plan | build | fix | edit -> these are 5 agents
- till now implemented this 2 prompt and plan agent
- prompt agent main goal is to take user vague input and turn it into structure intent
- later this struture intent is passed to plan agent and it turns that into a struct of file and dependency plan
- file {} of path, access, summary; no code write till now; same for dependency {}

### 06-03-2026

- worked on web-clipper feature
- facing err of playwright and bun load browser
- so spawn a node worker for this playwright, because playwright was working fine with node
- web-clipper feature is still supporting direct links, in future i will create util to support nested links
- user gives lovable.com, this util will create arr of all nested links lovable.com/profile , lovable.com/settings ..
- but nested links should have limits, what if user give amazon.com

### 03-03-2026

- auth with google is done, let integrate the github
- github integration is not used for auth, but to bring users repo ==
- so that user can push his vibecoded webapp to his github account
- i am not sure how am i gonna do this, but let see
- one thing is sure that github integration is for push code to users repo and not for auth
- i think for github intergation, i need some kind of verification from them at first place

### 01-03-2026

- reducing ui just in two screens; home screen and output screen
- home screen will consist of a sidebar, a heading for CTA (what are we building today?), prompt box, 4 capsule suggestions and context canvas
- output screen will conssit chatbar, preview, code and header that contains options such has publish, github, download etc
- sidebar will contain two pages redirect: all projects and Account settings
- no navbar and footer; and landing page is removed as discuss earlier last week

### 19-02-2026

- opt for bun rt over node for frontend react
- sever runtime is bun, so it makes more sense to go for for same for ui
- choosing node for ui, is good. but it will create overhead of 2 runtime
- bun is fairly new, i am to0 optimistic for bun right now, lets see

### 17-02-2026

- removed the landing page, the user visit directly to the webiste
- having landing page creates more overhead at this moment, if needed then add later
- restrict users actions on @context canvas, when user is not authenticated

### 16-02-2026

- adopt module based appraoch instead of sepearate controller, routes approach
- phasehumans can be divided into modules like auth, user, project, usage/ billing etc
- each module contains routes, controller, schema and service files to seperate each layer
- routes -> controller - [schema validation] -> service
