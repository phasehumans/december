import React from 'react'
import { Icons } from '../ui/Icons'
import { cn } from '../../lib/utils'

interface SidebarFooterProps {
    isAuthenticated: boolean
    isCollapsed: boolean
    onProfile: () => void
    onOpenAuth: () => void
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
    isAuthenticated,
    isCollapsed,
    onProfile,
    onOpenAuth,
}) => {
    return (
        <div className="px-3 mt-auto mb-2">
            {isAuthenticated ? (
                <button
                    onClick={onProfile}
                    className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg transition-all group w-full hover:bg-surface/50 outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                        isCollapsed ? 'justify-center' : ''
                    )}
                >
                    <div className="flex items-center justify-center w-5 h-5 text-[#91908F] group-hover:text-[#E8E8E6] transition-colors">
                        <Icons.UserCircle className="w-5 h-5" />
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-col items-start overflow-hidden font-['Segoe_UI']">
                            <span className="font-medium text-sm text-[#91908F] group-hover:text-[#E8E8E6] truncate w-full text-left transition-colors">
                                Account & Settings
                            </span>
                        </div>
                    )}
                </button>
            ) : (
                !isCollapsed && (
                    <button
                        onClick={onOpenAuth}
                        className="w-full py-2 px-4 bg-[#D6D5D4] text-[#171615] text-[13px] font-medium font-roboto rounded-lg shadow-sm transition-all active:scale-[0.98] flex items-center justify-center hover:bg-white"
                    >
                        Sign In
                    </button>
                )
            )}

            {/* Show simple icon if collapsed and not authenticated */}
            {!isAuthenticated && isCollapsed && (
                <button
                    onClick={onOpenAuth}
                    className="flex items-center justify-center w-full p-2.5 rounded-xl hover:bg-[#E8E8E6]/10 text-[#E8E8E6] hover:text-white transition-all"
                    title="Sign In"
                >
                    <Icons.LogOut className="w-5 h-5" />
                </button>
            )}
        </div>
    )
}
