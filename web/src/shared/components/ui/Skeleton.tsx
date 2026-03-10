import React from 'react'
import { cn } from '@/shared/lib/utils'

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
    return <div className={cn('animate-pulse rounded-md bg-white/[0.08]', className)} {...props} />
}


