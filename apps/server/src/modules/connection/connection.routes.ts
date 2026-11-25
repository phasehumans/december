import { Router } from 'express'

import { authMiddleware } from '../../middleware/auth.middleware'

import { connectionController } from './connection.controller'

// skills and remote mcp servers saved on the account (#632 section 2)
const connectionRouter = Router()

connectionRouter.use(authMiddleware)

connectionRouter.get('/prompt-box', connectionController.getPromptBoxLists)
connectionRouter.get('/skills', connectionController.listSkills)
connectionRouter.put('/skills/:name', connectionController.saveSkill)
connectionRouter.patch('/skills/:name', connectionController.setSkillEnabled)
connectionRouter.delete('/skills/:name', connectionController.deleteSkill)
connectionRouter.get('/mcps', connectionController.listMcpServers)
connectionRouter.put('/mcps/:name', connectionController.saveMcpServer)
connectionRouter.patch('/mcps/:name', connectionController.updateMcpServer)
connectionRouter.delete('/mcps/:name', connectionController.deleteMcpServer)
// import setup from a repository (#637 section 6)
connectionRouter.post('/import/preview', connectionController.previewImport)
connectionRouter.post('/import', connectionController.importSetup)

export default connectionRouter
