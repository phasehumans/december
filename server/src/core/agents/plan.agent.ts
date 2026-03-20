import { openai } from '../../config/oai'
import { parseModelJson } from '../../utils/parseModelJson'
import { PLAN_AGENT_PROMPT } from '../prompts/plan.prompt'

type ExtractProjectPlan = {
    prompt: string
    summary: string

    appType:
        | 'landing-page'
        | 'dashboard'
        | 'portfolio'
        | 'saas-app'
        | 'blog'
        | 'ecommerce'
        | 'marketplace'
        | 'booking-platform'
        | 'crm'
        | 'social-app'
        | 'admin-panel'

    experienceType: 'marketing' | 'app' | 'hybrid'

    frontendFramework: 'vite-react'
    backendFramework: 'express'
    runTime: 'bun'

    databaseProvider: 'neon-postgres'
    databaseConnection: 'neon-url'

    database: 'postgres' | 'none'

    authStrategy: 'jwt-email-password'
    auth: 'required' | 'optional' | 'none'

    pages: string[]
    sections: string[]
    coreEntities: string[]
    coreFeatures: string[]

    needsBackend: boolean
    needsDatabase: boolean
    needsAuthentication: boolean
    needsFileStorage: boolean
    needsPayments: boolean
}

export const extractProjectPlan = async (data: ExtractProjectPlan) => {
    const completion = await openai.chat.completions.create({
        model: 'openai/gpt-oss-20b:free',
        temperature: 0,
        messages: [
            {
                role: 'system',
                content: PLAN_AGENT_PROMPT,
            },
            {
                role: 'user',
                content: JSON.stringify(data),
            },
        ],
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
        throw new Error('no response from planner agent')
    }

    return parseModelJson(content, 'plan agent')
}
