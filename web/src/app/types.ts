export type ViewState = 'chat' | 'all-projects' | 'profile'

export interface GenerationRequirements {
    needsDatabase: boolean
    neonDatabaseUrl: string
}
