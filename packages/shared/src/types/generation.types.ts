export type ProjectIntent = {
    prompt: string
    summary: string
    projectName: string
    appType: 'landing-page' | 'dashboard' | 'portfolio & blog' | 'saas-app' | 'ecommerce'
    audience: string
    primaryGoal: string
    visualDirection: string
    keyScreens: string[]
    keyCapabilities: string[]
    canvasSignals: string[]
}

export type PlannedProjectFile = {
    path: string
    purpose: string
    generate: boolean
    generator: 'static' | 'app-shell' | 'page' | 'component' | 'layout' | 'route' | 'config' | 'lib'
}

export type ProjectPlan = {
    success: boolean
    message: string
    data: {
        projectName: string
        goal: string
        routes: Array<{
            name: string
            path: string
            purpose: string
        }>
        architecture: {
            appShape: string
            routing: string
            state: string
            styling: string
        }
        dependencies: string[]
        devDependencies: string[]
        files: PlannedProjectFile[]
        buildOrder: string[]
        builderNotes: string[]
    } | null
    errors: string[]
}

export type ProjectPatchOperation = {
    path: string
    action: 'create' | 'update' | 'delete'
    purpose: string
    instructions: string
}

export type GenerateWebsiteInput = {
    prompt: string
    userId: string
    projectId?: string
    canvasState?: any
    model?: string
    onEvent?: (event: any) => Promise<void> | void
}
