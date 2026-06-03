import { isFrontendWorkspacePath } from './generation.utils'

const REQUIRED_GENERATED_PROJECT_PATHS = [
    'package.json',
    'index.html',
    'src/frontend.tsx',
    'src/index.css',
    'src/App.tsx',
] as const

const REQUIRED_RUNTIME_DEPENDENCIES = ['react', 'react-dom', 'bun-plugin-tailwind', 'tailwindcss']
const REQUIRED_RUNTIME_DEV_DEPENDENCIES = ['@types/react', '@types/react-dom', '@types/bun']

const VALID_GENERATORS = new Set([
    'static',
    'app-shell',
    'page',
    'component',
    'layout',
    'route',
    'config',
    'lib',
])

const VALID_APP_TYPES = new Set([
    'landing-page',
    'dashboard',
    'portfolio & blog',
    'saas-app',
    'ecommerce',
])

const normalizeGenerator = (val: any): string => {
    if (typeof val !== 'string') return 'component'
    const trimmed = val.trim().toLowerCase()
    if (VALID_GENERATORS.has(trimmed)) return trimmed
    if (trimmed === 'style' || trimmed === 'css' || trimmed === 'stylesheet') return 'static'
    if (trimmed === 'typescript' || trimmed === 'tsx' || trimmed === 'ts') return 'component'
    if (trimmed === 'routing' || trimmed === 'router') return 'route'
    if (trimmed === 'configuration' || trimmed === 'json') return 'config'
    return 'component'
}

const normalizeAppType = (val: any): string => {
    if (typeof val !== 'string') return 'landing-page'
    const trimmed = val.trim().toLowerCase()
    if (VALID_APP_TYPES.has(trimmed)) return trimmed
    if (trimmed.includes('landing')) return 'landing-page'
    if (trimmed.includes('dash')) return 'dashboard'
    if (trimmed.includes('blog') || trimmed.includes('portfolio')) return 'portfolio & blog'
    if (trimmed.includes('saas')) return 'saas-app'
    if (trimmed.includes('shop') || trimmed.includes('ecommerce') || trimmed.includes('store'))
        return 'ecommerce'
    return 'landing-page'
}

const ensureArrayOfNonEmptyStrings = (val: any, fallback: string[]): string[] => {
    if (!val) return fallback
    if (typeof val === 'string') {
        return val
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
    }
    if (Array.isArray(val)) {
        const cleaned = val.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
        return cleaned.length > 0 ? cleaned : fallback
    }
    return fallback
}

export const autoHealPlanAgentResponse = (payload: any): any => {
    if (!payload || typeof payload !== 'object') {
        return payload
    }

    const copy = { ...payload }

    if (copy.thinking !== undefined) {
        if (copy.thoughts === undefined) copy.thoughts = copy.thinking
        delete copy.thinking
    }
    if (copy.summary !== undefined) {
        if (copy.plan_of_action === undefined) copy.plan_of_action = copy.summary
        delete copy.summary
    }

    // 1. thoughts & plan_of_action
    copy.thoughts = ensureArrayOfNonEmptyStrings(copy.thoughts, ['Analyzing prompt requirements'])
    copy.plan_of_action = ensureArrayOfNonEmptyStrings(copy.plan_of_action, [
        'Drafting initial project architecture',
    ])

    // 2. intent
    if (!copy.intent || typeof copy.intent !== 'object') {
        copy.intent = {}
    }
    const intent = { ...copy.intent }
    intent.prompt = typeof intent.prompt === 'string' ? intent.prompt : 'Create a web application'
    intent.summary =
        typeof intent.summary === 'string' ? intent.summary : 'A beautiful modern web application'
    intent.projectName = typeof intent.projectName === 'string' ? intent.projectName : 'New Project'
    intent.appType = normalizeAppType(intent.appType)
    intent.audience = typeof intent.audience === 'string' ? intent.audience : 'general public'
    intent.primaryGoal =
        typeof intent.primaryGoal === 'string' ? intent.primaryGoal : 'deliver a clean interface'
    intent.visualDirection =
        typeof intent.visualDirection === 'string'
            ? intent.visualDirection
            : 'modern, elegant HSL themes'
    intent.keyScreens = Array.isArray(intent.keyScreens)
        ? intent.keyScreens.filter((s: any) => typeof s === 'string')
        : ['Home']
    intent.keyCapabilities = Array.isArray(intent.keyCapabilities)
        ? intent.keyCapabilities.filter((c: any) => typeof c === 'string')
        : ['View details']
    intent.canvasSignals = Array.isArray(intent.canvasSignals)
        ? intent.canvasSignals.filter((s: any) => typeof s === 'string')
        : []
    copy.intent = intent

    // 3. plan
    if (!copy.plan || typeof copy.plan !== 'object') {
        copy.plan = {}
    }
    const plan = { ...copy.plan }
    plan.success = typeof plan.success === 'boolean' ? plan.success : true
    plan.message = typeof plan.message === 'string' ? plan.message : 'Project plan generated'
    plan.errors = Array.isArray(plan.errors)
        ? plan.errors.filter((e: any) => typeof e === 'string')
        : []

    if (plan.success) {
        if (!plan.data || typeof plan.data !== 'object') {
            plan.data = {}
        }
        const data = { ...plan.data }
        data.projectName =
            typeof data.projectName === 'string' ? data.projectName : intent.projectName
        data.goal = typeof data.goal === 'string' ? data.goal : intent.primaryGoal

        // routes
        data.routes = Array.isArray(data.routes)
            ? data.routes.map((r: any) => {
                  if (!r || typeof r !== 'object')
                      return { name: 'Home', path: '/', purpose: 'Main screen' }
                  return {
                      name: typeof r.name === 'string' ? r.name : 'Home',
                      path: typeof r.path === 'string' ? r.path : '/',
                      purpose: typeof r.purpose === 'string' ? r.purpose : 'View screen',
                  }
              })
            : [{ name: 'Home', path: '/', purpose: 'Main screen' }]

        // architecture
        if (!data.architecture || typeof data.architecture !== 'object') {
            data.architecture = {}
        }
        const arch = { ...data.architecture }
        arch.appShape = typeof arch.appShape === 'string' ? arch.appShape : 'React SPA'
        arch.routing = typeof arch.routing === 'string' ? arch.routing : 'Client routes'
        arch.state = typeof arch.state === 'string' ? arch.state : 'React local state'
        arch.styling = typeof arch.styling === 'string' ? arch.styling : 'Tailwind CSS styling'
        data.architecture = arch

        // dependencies
        const deps = new Set(
            Array.isArray(data.dependencies)
                ? data.dependencies.filter((d: any) => typeof d === 'string')
                : []
        )
        for (const dep of REQUIRED_RUNTIME_DEPENDENCIES) {
            deps.add(dep)
        }
        data.dependencies = Array.from(deps)

        // devDependencies
        const devDeps = new Set(
            Array.isArray(data.devDependencies)
                ? data.devDependencies.filter((d: any) => typeof d === 'string')
                : []
        )
        for (const dep of REQUIRED_RUNTIME_DEV_DEPENDENCIES) {
            devDeps.add(dep)
        }
        data.devDependencies = Array.from(devDeps)

        // files
        const fileList = Array.isArray(data.files) ? data.files : []
        const filesMap = new Map<string, any>()
        for (const file of fileList) {
            if (!file || typeof file !== 'object' || typeof file.path !== 'string') continue
            const path = file.path.trim()
            if (!isFrontendWorkspacePath(path)) continue
            filesMap.set(path, {
                path,
                purpose: typeof file.purpose === 'string' ? file.purpose : 'Project source file',
                generate: typeof file.generate === 'boolean' ? file.generate : true,
                generator: normalizeGenerator(file.generator),
            })
        }

        // Inject required skeleton files
        const requiredInjections = [
            {
                path: 'package.json',
                purpose: 'Declare scripts and dependencies for the Bun React app',
                generator: 'config',
            },
            {
                path: 'index.html',
                purpose: 'Mount the React app in the browser',
                generator: 'static',
            },
            {
                path: 'src/frontend.tsx',
                purpose: 'Mount React into the root element',
                generator: 'app-shell',
            },
            {
                path: 'src/index.css',
                purpose: 'Provide global Tailwind and base styles',
                generator: 'static',
            },
            {
                path: 'src/App.tsx',
                purpose: 'Compose the primary UI and local state',
                generator: 'app-shell',
            },
        ]

        for (const inj of requiredInjections) {
            const existing = filesMap.get(inj.path)
            if (!existing) {
                filesMap.set(inj.path, {
                    path: inj.path,
                    purpose: inj.purpose,
                    generate: true,
                    generator: inj.generator,
                })
            } else {
                existing.generate = true // MUST be generated
            }
        }
        data.files = Array.from(filesMap.values())

        // buildOrder
        const generatedPaths = new Set<string>(
            data.files.filter((f: any) => f.generate).map((f: any) => f.path as string)
        )
        const orderList = Array.isArray(data.buildOrder)
            ? data.buildOrder.filter((o: any) => typeof o === 'string')
            : []
        const finalOrder: string[] = []
        const addedToOrder = new Set<string>()

        for (const path of orderList) {
            const trimmed = path.trim()
            if (generatedPaths.has(trimmed) && !addedToOrder.has(trimmed)) {
                finalOrder.push(trimmed)
                addedToOrder.add(trimmed)
            }
        }

        // Add any missing generated paths in dependency-safe fallback order
        const fallbackOrder = [
            'package.json',
            'index.html',
            'src/index.css',
            'src/frontend.tsx',
            'src/App.tsx',
        ]
        for (const path of fallbackOrder) {
            if (generatedPaths.has(path) && !addedToOrder.has(path)) {
                finalOrder.push(path)
                addedToOrder.add(path)
            }
        }
        for (const path of generatedPaths) {
            if (!addedToOrder.has(path)) {
                finalOrder.push(path)
                addedToOrder.add(path)
            }
        }

        data.buildOrder = finalOrder
        data.builderNotes = ensureArrayOfNonEmptyStrings(data.builderNotes, [
            'Keep UI simple and responsive.',
        ])

        plan.data = data
    } else {
        plan.data = null
    }

    copy.plan = plan
    return copy
}

export const autoHealChangePlanResponse = (payload: any): any => {
    if (!payload || typeof payload !== 'object') {
        return payload
    }

    const copy = { ...payload }

    if (copy.thinking !== undefined) {
        if (copy.thoughts === undefined) copy.thoughts = copy.thinking
        delete copy.thinking
    }
    if (copy.summary !== undefined) {
        if (copy.plan_of_action === undefined) copy.plan_of_action = copy.summary
        delete copy.summary
    }

    copy.thoughts = ensureArrayOfNonEmptyStrings(copy.thoughts, ['Analyzing follow-up request'])
    copy.plan_of_action = ensureArrayOfNonEmptyStrings(copy.plan_of_action, [
        'Applying targeted updates',
    ])

    if (!copy.plan || typeof copy.plan !== 'object') {
        copy.plan = {}
    }
    const plan = { ...copy.plan }
    plan.success = typeof plan.success === 'boolean' ? plan.success : true
    plan.message =
        typeof plan.message === 'string' ? plan.message : 'Patch plan generated successfully'
    plan.errors = Array.isArray(plan.errors)
        ? plan.errors.filter((e: any) => typeof e === 'string')
        : []

    if (plan.success) {
        if (!plan.data || typeof plan.data !== 'object') {
            plan.data = {}
        }
        const data = { ...plan.data }
        data.summary = typeof data.summary === 'string' ? data.summary : 'Applying patch operations'

        const opsList = Array.isArray(data.operations) ? data.operations : []
        const opsMap = new Map<string, any>()

        for (const op of opsList) {
            if (!op || typeof op !== 'object' || typeof op.path !== 'string') continue
            const path = op.path.trim()
            if (!isFrontendWorkspacePath(path)) continue

            const action = typeof op.action === 'string' ? op.action.trim().toLowerCase() : 'update'
            const validActions = ['create', 'update', 'delete']
            const finalAction = validActions.includes(action) ? action : 'update'

            opsMap.set(path, {
                path,
                action: finalAction,
                purpose: typeof op.purpose === 'string' ? op.purpose : 'Modify source file',
                instructions:
                    typeof op.instructions === 'string'
                        ? op.instructions
                        : 'Update according to requirements',
            })
        }

        data.operations = Array.from(opsMap.values())
        if (data.operations.length === 0) {
            // Guarantee at least one operation so validation doesn't fail
            data.operations = [
                {
                    path: 'src/App.tsx',
                    action: 'update',
                    purpose: 'Update application UI',
                    instructions: 'Apply requested changes to the main application view',
                },
            ]
        }
        plan.data = data
    } else {
        plan.data = null
    }

    copy.plan = plan
    return copy
}
