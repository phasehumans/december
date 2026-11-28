import { MEMORIES_PER_USER_MAX } from '@december/shared/agent-context'

import { AppError } from '../../shared/appError'

import { memoryRepository } from './memory.repository'
import { toPublicMemory } from './memory.utils'

import type { AddMemory, MemoryRef, SetMemoryEnabled, UpdateMemory, UserRef } from './memory.types'

/** the memories, newest first, and whether the agent reads and saves them */
const listMemories = async (data: UserRef) => {
    const { userId } = data
    const [enabled, memories] = await Promise.all([
        memoryRepository.findMemoryEnabled(userId),
        memoryRepository.findMemories(userId),
    ])
    return { enabled, memories: memories.map(toPublicMemory) }
}

const setMemoryEnabled = async (data: SetMemoryEnabled) => {
    const { userId, enabled } = data
    const user = await memoryRepository.setMemoryEnabled(userId, enabled)
    return { enabled: user.memoryEnabled }
}

const addMemory = async (data: AddMemory) => {
    const { userId, content } = data
    if ((await memoryRepository.countMemories(userId)) >= MEMORIES_PER_USER_MAX) {
        throw new AppError(
            `You can keep up to ${MEMORIES_PER_USER_MAX} memories. Delete one first.`,
            409
        )
    }
    const memory = await memoryRepository.createMemory({ userId, content })
    return { memory: toPublicMemory(memory) }
}

const updateMemory = async (data: UpdateMemory) => {
    const { userId, id, content } = data
    const existing = await memoryRepository.findMemory(userId, id)
    if (!existing) throw new AppError('Memory not found', 404)
    const memory = await memoryRepository.updateMemory(existing.id, content)
    return { memory: toPublicMemory(memory) }
}

const deleteMemory = async (data: MemoryRef) => {
    const { userId, id } = data
    const result = await memoryRepository.deleteMemory(userId, id)
    if (result.count === 0) throw new AppError('Memory not found', 404)
    return { deleted: true }
}

const deleteAllMemories = async (data: UserRef) => {
    const { userId } = data
    const result = await memoryRepository.deleteAllMemories(userId)
    return { deleted: result.count }
}

export const memoryService = {
    listMemories,
    setMemoryEnabled,
    addMemory,
    updateMemory,
    deleteMemory,
    deleteAllMemories,
}
