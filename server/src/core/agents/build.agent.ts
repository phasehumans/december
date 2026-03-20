import { openai } from '../../config/oai'
import { parseModelJson } from '../../utils/parseModelJson'
import { BUILD_AGENT_PROMPT } from '../prompts/build.prompt'

type GenerateProjectFile = {
    success: boolean
    message: string

    data: {
        projectName: string

        layoutType: 'single-page' | 'multi-page'
        needsRouting: boolean

        installCommands: {
            web: string[]
            server: string[]
        }

        dependencies: {
            web: string[]
            server: string[]
        }

        devDependencies: {
            web: string[]
            server: string[]
        }

        frontend: {
            pages: {
                name: string
                route: string
                purpose: string
            }[]

            components: {
                name: string
                type: 'layout' | 'section' | 'shared' | 'feature'
                purpose: string
            }[]
        }

        backend: {
            enabled: boolean

            modules: {
                name: string
                purpose: string
            }[]

            apiResources: {
                name: string
                basePath: string
                purpose: string
            }[]
        }

        databasePlan: {
            enabled: boolean
            orm: 'prisma' | 'none'
            validation: 'zod' | 'none'

            tables: {
                name: string
                purpose: string
                columns: string[]
            }[]
        }

        files: {
            path: string
            purpose: string
            generate: boolean
            generator:
                | 'static'
                | 'app-shell'
                | 'page'
                | 'component'
                | 'layout'
                | 'route'
                | 'api'
                | 'model'
                | 'schema'
                | 'config'
                | 'lib'
        }[]

        generationOrder: string[]
        constraints: string[]
    }

    errors: string[]
}

export const generateProjectFile = async (data: GenerateProjectFile) => {
    const completion = await openai.chat.completions.create({
        model: 'openai/gpt-oss-20b:free',
        temperature: 0,
        messages: [
            {
                role: 'system',
                content: BUILD_AGENT_PROMPT,
            },
            {
                role: 'user',
                content: JSON.stringify(data),
            },
        ],
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
        throw new Error('no response from build agent')
    }

    try {
        return parseModelJson(content, 'build agent')
    } catch (error) {
        console.error('RAW BUILD AGENT OUTPUT:\n', content)
        throw error
    }
}
