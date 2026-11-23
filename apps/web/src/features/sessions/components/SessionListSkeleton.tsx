import React from 'react'

import { ListRowsSkeleton } from './ListParts'

/** loading rows for the sessions list, in the same shape as the Pull requests page */
export const SessionListSkeleton: React.FC = () => <ListRowsSkeleton rows={7} />
