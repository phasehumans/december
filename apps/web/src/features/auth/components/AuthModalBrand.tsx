import React from 'react'

import { Icons } from '@/shared/components/ui/Icons'

export const AuthModalBrand: React.FC = () => (
    <div className="flex items-center gap-2 select-none">
        <Icons.DecemberLogo className="w-[24px] h-[24px] text-white" strokeWidth={1} />
        <h2 className="text-[23px] font-sans font-normal tracking-[-0.025em] text-white leading-none">
            December
        </h2>
    </div>
)
