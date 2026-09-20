import { SkillDiscoveryEngine } from '@december/shared'
import { Type, type Static } from '@december/tools'

import { executeSkillInSubagent } from './skill-subagent'

import type { Tool, ToolExecuteContext, DiscoveredSkill } from '@december/shared'

const runSkillSchema = Type.Object({
    skillName: Type.String({
        description: 'The exact name of the skill to execute from the available skills catalog.',
    }),
    args: Type.Optional(
        Type.Array(Type.String(), {
            description: 'Positional arguments to pass to the skill.',
        })
    ),
    task: Type.Optional(
        Type.String({
            description:
                'Specific focus, instruction, or task description for the subagent to accomplish.',
        })
    ),
})

export type RunSkillInput = Static<typeof runSkillSchema>

export function createRunSkillTool(skillResolver?: () => DiscoveredSkill[]): Tool<RunSkillInput> {
    return {
        name: 'run_skill',
        description:
            'Delegate a procedural or specialized task to an isolated child subagent that executes the skill procedures in a fresh context, returning only the final summary to prevent context bloat.',
        inputSchema: runSkillSchema,
        execute: async ({ skillName, args = [], task }, context: ToolExecuteContext) => {
            const parentAgent = context.agent
            if (!parentAgent) {
                return 'Error: Cannot invoke skill subagent without active agent context.'
            }

            const skills: DiscoveredSkill[] = skillResolver
                ? skillResolver()
                : new SkillDiscoveryEngine({
                      workspaceDir: parentAgent.workspaceDir || process.cwd(),
                  }).discoverAllSkills()

            const matchedSkill = skills.find(
                (s) => s.name.toLowerCase() === skillName.toLowerCase()
            )

            if (!matchedSkill) {
                const available = skills.map((s) => s.name).join(', ')
                return `Skill '${skillName}' not found. Available skills: ${available || 'none'}.`
            }

            const result = await executeSkillInSubagent({
                skill: matchedSkill,
                args,
                task,
                parentAgent,
                signal: context.signal,
                onEvent: (event) => {
                    if (event.type === 'ThinkingChunk') {
                        context.onStream?.(
                            `[Subagent: ${matchedSkill.name}] ${event.content.slice(0, 120)}...\n`
                        )
                    } else if (event.type === 'ToolCallStart') {
                        context.onStream?.(
                            `[Subagent: ${matchedSkill.name}] Tool: ${event.toolCall.name}\n`
                        )
                    }
                },
            })

            if (!result.success) {
                return `Subagent execution of skill '${skillName}' failed: ${result.error || result.summary}`
            }

            return `[Subagent: ${matchedSkill.name} completed]\n\n${result.summary}`
        },
    }
}

export const RunSkillTool = createRunSkillTool()
