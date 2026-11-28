import React from 'react'

import { ListArt, type ListArtKind } from '@/features/sessions/components/ListParts'

/**
 * the drawing, one title, an optional grey line, then buttons. Used by the not found pages
 * and the error boundaries, in the same look as the empty lists.
 * size: page (160 px drawing), panel (120 px, a part of a page), small (72 px, the inbox)
 */
export const ErrorScreen: React.FC<{
    art: ListArtKind
    title: string
    line?: string
    size?: 'page' | 'panel' | 'small'
    className?: string
    children?: React.ReactNode
}> = ({ art, title, line, size = 'page', className = '', children }) => {
    const artClass =
        size === 'page'
            ? 'mb-5 h-[140px] w-40'
            : size === 'panel'
              ? 'mb-4 h-[105px] w-[120px]'
              : 'mb-2 h-[63px] w-[72px]'
    const titleClass = size === 'small' ? 'text-[12px]' : 'text-[17px]'
    return (
        <div
            role="alert"
            className={`flex h-full w-full flex-col items-center justify-center px-6 py-10 text-center ${className}`}
        >
            <div className={`${artClass} max-w-full text-[#8A8987]`}>
                {size === 'small' ? (
                    <ListArt kind={art} strokePx={1.6} widthPx={72} />
                ) : (
                    <ListArt kind={art} />
                )}
            </div>
            <h2 className={`${titleClass} font-medium text-[#D6D5C9]`}>{title}</h2>
            {line && <p className="mt-1.5 text-[13px] text-[#8A8987]">{line}</p>}
            {children && (
                <div
                    className={`${size === 'small' ? 'mt-3' : 'mt-4'} flex flex-wrap items-center justify-center gap-2`}
                >
                    {children}
                </div>
            )}
        </div>
    )
}

/** the quiet text button beside the outline buttons, for Copy error */
export const errorGhostButtonClass =
    'rounded-lg px-3 py-1 text-[12.5px] font-medium text-[#8A8987] transition-colors hover:text-[#D6D5C9] hover:bg-[#242323] cursor-pointer'
