## [unreleased]

### Bug Fixes

- Followup edits and add user onboarding #85

### Miscellaneous Tasks

- Configure .devcontainer and project workspace settings
- Add ai skills and prompts to .december workspace
- Add more ai skills and prompts to .december
- Rename and refine ai skills and prompts

## [0.1.1] - 2026-06-07

### Miscellaneous Tasks

- Add release automation
- _(release)_ V0.1.1

## [0.1.0] - 2026-06-07

### Features

- _(auth)_ Add user authentication(#8)
- Auth middleware
- GetProfile endpoint
- Add profile
- _(profile)_ Add getprofile and update profile(#9)
- Add update name and change pass
- Auth
- Profile
- _(ui)_ Init react project/bun
- Projects crud endpoints
- _(project)_ Add projects crud endpoints(#11)
- Ui and canvas
- _(ui)_ Redesign components and canvas context
- Login w/ google route
- Oauth
- Opt verification
- Resend OTP email
- _(oauth)_ Add google login and otp verification
- _(auth)_ Add oauth login and otp verification (#17)
- _(tanstack)_ Connect ui w/ server and implemented optimistic ui updates (#19)
- _(profile)_ Github connect
- _(profile)_ Github integration
- _(profile)_ Implemented github integration and repo sync #21
- Webclipper and playwright
- _(canvas)_ Implemented web clipper
- _(canvas)_ Implemented web clipper #22
- Notification pref
- _(profile)_ Add notification email toggle
- _(profile)_ Implemented email notification and updates #23
- _(project)_ Add duplicate project
- Add sub agents
- Code mirror editor
- _(agent/editor)_ Implemented subagents and config code mirror editor #24
- Prompt validation
- Intent agent to get stritct json intent
- _(agent)_ Implemented intent agent that parse prompt into struct json object with deterministic values#25
- _(agent)_ Implemented planner and dependency agent #26
- _(project)_ Implemented option to duplicate project
- _(project)_ Duplicate opt and projects skeleton ui
- _(project)_ Implemented duplicate project opt and refine skeleton ui #27
- Build agent output struct parse
- Db implemnetd query
- Implemented build agent and db connection verify modal #30
- _(agent)_ Add stream to chat of prompt and plan agent #33
- _(agent)_ Implemented build agent and file streams
- _(agent)_ Implement build agent and code streaming to file exp #34
- Implemented obj storage and tested
- Setup and tested object storage (/minio) #35
- Implemented save code and chat in obj storage/s3 and db #36
- _(agent)_ Implemented fix and edit agent
- _(agent)_ Implemented fix and edit agent #37
- Implement runtime service, obj store -> runtime
- Preview generated web
- _(runtime)_ Add preview and runtime
- _(runtime)_ Add runtime and preview and refactor gen service into more modular files #39
- Add cliper and canvas state persist
- Implemented clipper and canvas state mutation on ui
- _(canvas)_ Implement state persist canvas and add web clipper mutation
- _(canvas)_ Add state persist canvas and web clipper to ui/canvas #44
- _(community)_ Add v0 version of community page
- _(templates)_ Add community templates page
- _(templates)_ Add community templates page frontend and struct the remix option over each templates ref v0/templates #45
- _(import)_ Add import github and codebase opt
- _(setup)_ Add eslint and husky setup #47
- _(project)_ Project sharing as template and restructure remix #53
- _(upload)_ Impl listgithub repos and download zip from url #61
- _(upload)_ Minio code upload of zip and repo #64
- _(templates)_ Add CRUD and like/dislike routes for templates page #65
- _(auth/profile)_ Access and refresh token and sessions, add delete acc and signout all sessions routes #67
- _(template)_ Impl remix template w/ direct copy #72
- Notifications
- _(billing)_ Add razorpay integration and fix billing and usage ui #77
- _(outputscreen)_ Add COT (chain of thoughts) and runtime logs #80
- _(usage)_ Token usage extraction and add model selector in chatbar promptbxo

### Bug Fixes

- Profile endpoints
- _(ui)_ Ui #15 from phasehumans/chaitanya/ui-redesign
- Auth module and err handling
- Types and messages
- _(module)_ Fix modules and setup code-gen(#16)
- Google service
- Update project route
- _(projects)_ Projects isStarred and add project status (#18)
- Plugins
- Pen tool, added tool select feat
- Pen smoothing and kbd shortcuts
- Shapes container and point eraser
- _(canvas)_ Enable tools and implment fn like excalidrw #20
- Screen redirect from github
- Clipper bun, spawn node worker
- _(project)_ Layout change and hover fix
- _(ide)_ Folder added and collpase fn
- File exp collapse and active tab
- _(ide)_ Implemented active files and better file explorer with collapse folders and files #28
- Chat bar and implemented capusle w/ chat and preview tab
- Preview screen err and tab switch
- _(output screen)_ Implemented new layout and fix prev. err in output screen in mobile view mode #29
- Updated layout of settings page
- Err message and err state
- Prompt and plan agent res struct
- Updated video card theme and preview
- Animation laoder and bg
- Build agent content parser and input struct
- Add strict types for agent response
- Stream output of agents
- Updated layout of chatbar and change stream flow
- Json parser w/ custom parser
- Custome parser
- Build agent max token
- Auto tab switch betn agent calls
- Rust linker'
- Project version and project page schema err
- _(generation)_ Refactor agent scope just for frontend
- _(generation)_ Refactor agent scope just for frontend #38
- Normalize msg err handler for token-limit
- Prompt agent system calls
- Prompt agent chat msg, use reactive/self approach
- _(agent/chat)_ Improved prompt agent chat message stream #40
- Plan agent stream plan
- Plan agent stream chat and add coT to think agent
- _(agent)_ Add coT / chain of thought to prompt agent and explcit plan struct stream from plan agent #41
- Prompt and plan agent contracts mismatch
- \*\* bullet render from plan agent chat stream
- _(agent)_ Align the agents contract and schema validation #42
- Node worker process web clipper
- Agents contract
- Payload size err
- Clipper blank space load err
- Categoires cards and community page section
- Tsconfig baseurl upadte
- Hero section and o-screen project name
- Home section header
- _(ui)_ Add github and upload project section and improved icons consistency #46
- Improve ui sidebar
- _(sidebar)_ Imporve the ui of sidebar #50
- _(hero/canvas)_ Improved the hero section and canvas position, add slider #51
- _(auth)_ Improved auth modal and CTA pill #52
- Updated project version and canvas state #54
- Runtime and docker sandbox issue
- Blocking paths
- Docker container pull err
- _(runtime)_ Blocking path err and setup exec image #55
- _(home)_ Improved sidebar recent project section and add github repo and code upload form #56
- Github and upload proj forms
- Canvas cards and shadows
- _(hero/canvas)_ Updated canvas ui and fix github forms #58
- _(agents)_ Impl 3 agents arch. #59
- Wsl and postman binding err
- Outputscreen headers and chatsection
- _(outputscreen)_ Fix output screen headers and code editor issues #62
- File parser and extract zip
- _(outputscreen)_ Fix container and add options forms #63
- Error handler and add test script
- Auth middleware; bearer and cookie fallback
- Settings sidebar
- _(profile/settings)_ Ui updation and add integration, billing and usage section #69
- _(projects)_ Add tests and ui for project and routes handlers #70
- CRUD template routes
- _(template)_ Improve template ui and refactor template routes #71
- Replace jwt based to session bases, add guards
- _(auth)_ Replace jwt based auth frontend with session based, remove project mocks #73
- _(sidebar/main)_ Impl modal selector and fix logos and items #74
- Projects route api contracts
- Remove mock template and fix api contacts
- _(project/template)_ Remove mock data and impl api contacts for projects and template #75
- _(agent)_ Update agent config #76
- Outputscreen rollback and error logs #78
- _(outputscreen)_ Add settings modal and fix code editor #79
- _(ui)_ Split into sub components and minor ui fix
- _(plan agent)_ Plan agent cot and plan of action, update cot and poa display in chatbar #83

### Other

- Portfolio
- Quiz app
- Dairy website
- Countdown timer
- Color picker
- Form validation
- Sidebar and prompt input
- Sidebar collpase state

### Refactor

- _(ui)_ Components(#12)
- Docker setup
- Split into modular sub components:
- _(server)_ Modules generation and deploy
- _(web)_ Split into subcomponents
- Runtime
- _(runtime)_ Rust runtime
- Split generation service file
- Err handler states and proxy
- _(setup)_ Add dev files
- Integration test and removed route tests
- _(agents)_ Generation flow and agent contracts #60
- Split into sub components

### Documentation

- Del contribution
- Update changelog for v0.1.0

### Testing

- _(agent)_ Test and fix agent based on fs stream #31
- Minio object storage and fix
- Add auth schema test for signin and login
- _(auth/profile)_ Add unit and integration test for auth and profile module w/ bun test #48
- _(project/canvas)_ Add unit and integration test for project and canvas #49
- _(auth)_ Service and route integration test #66
- _(auth/profile)_ Add soft delete and tested auth and profile module; unit & integration tests #68

### Miscellaneous Tasks

- Initialize changesets
- Add initial changeset
- Remove changesets
- Configure git-cliff
- Add changeset
