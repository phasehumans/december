import { Router } from 'express'

import { admincloudflareController } from './admincloudflare.controller'

// mounted inside the admin router, after requireAdmin and requireAdminCode: read only.
// The server calls Cloudflare with a read-only token; the browser never does
const admincloudflareRouter = Router()

// C1, C2: landing page and web app visitors, and signups against landing visits
admincloudflareRouter.get('/analytics/visitors', admincloudflareController.getVisitors)
// C3: the last Pages deploys of each project
admincloudflareRouter.get('/system/deploys', admincloudflareController.getDeploys)
// C4: traffic at the edge, the last 24 hours and the last 7 days
admincloudflareRouter.get('/system/edge', admincloudflareController.getEdge)
// C5: page speed for real users (Core Web Vitals)
admincloudflareRouter.get('/system/page-speed', admincloudflareController.getPageSpeed)

export default admincloudflareRouter
