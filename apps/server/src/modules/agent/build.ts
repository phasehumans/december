import {
    generateProjectFile as generateProjectFileAgent,
    generateProjectPatchFile as generateProjectPatchFileAgent,
} from './build.agent'

import type { GenerateProjectFile, GenerateProjectPatchFile } from '@december/shared'

export const generateProjectFile = (data: GenerateProjectFile) => generateProjectFileAgent(data)

export const generateProjectPatchFile = (data: GenerateProjectPatchFile) =>
    generateProjectPatchFileAgent(data)

export { generateWorkDoneSummary } from './build.agent'
