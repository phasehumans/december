import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { memoryController } from './memory.controller'

// agent memory (connections, memory tab), under /connections/memory
const memoryRouter = Router()

memoryRouter.use(authMiddleware)

memoryRouter.get('/', memoryController.listMemories)
memoryRouter.put('/settings', memoryController.setMemoryEnabled)
memoryRouter.post('/', memoryController.addMemory)
memoryRouter.delete('/', memoryController.deleteAllMemories)
memoryRouter.patch('/:id', memoryController.updateMemory)
memoryRouter.delete('/:id', memoryController.deleteMemory)

export default memoryRouter
