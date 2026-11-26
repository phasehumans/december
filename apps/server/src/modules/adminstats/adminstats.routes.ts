import { Router } from 'express'

import { adminstatsController } from './adminstats.controller'

// mounted inside the admin router, after requireAdmin and requireAdminCode: read only
const adminstatsRouter = Router()

adminstatsRouter.get('/overview', adminstatsController.getOverview)
// O1: the history behind the Overview tiles, one chart
adminstatsRouter.get('/analytics/trend', adminstatsController.getTrend)
// one page: signups, funnel, active users and cohorts, money, pull requests
adminstatsRouter.get('/analytics', adminstatsController.getAnalytics)
adminstatsRouter.get('/system/health', adminstatsController.getHealth)
// S1: the public status page (Better Stack), read by the server and cached for a minute
adminstatsRouter.get('/system/public-status', adminstatsController.getPublicStatus)
adminstatsRouter.get('/system/failed-jobs', adminstatsController.getFailedJobs)

export default adminstatsRouter
