import { BUILT_IN_MARKETPLACE as SHARED_MARKETPLACE } from '@december/shared'

import type { MarketplaceManifest } from './types'

export { BUILT_IN_MARKETPLACE_NAME } from '@december/shared'

/** the built-in marketplace; it lives in @december/shared so the web lists the same plugins */
export const BUILT_IN_MARKETPLACE: MarketplaceManifest = SHARED_MARKETPLACE
