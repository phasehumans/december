import {
    Calendar,
    ChevronDown,
    Download,
    ArrowUpRight,
    Info,
    ChevronLeft,
    ChevronRight,
    UserCircle,
} from 'lucide-react'
import React, { useState } from 'react'

const usageData = [
    {
        id: 1,
        date: 'Mar 31, 10:22 PM',
        user: 'phasehuman-so...',
        event: 'Message',
        kind: 'Monthly Credits',
        model: 'v0-mini',
        cost: '$0.03',
    },
    {
        id: 2,
        date: 'Mar 31, 09:17 PM',
        user: 'phasehuman-so...',
        event: 'Message',
        kind: 'Monthly Credits',
        model: 'v0-mini',
        cost: '$0.03',
    },
    {
        id: 3,
        date: 'Mar 20, 06:03 PM',
        user: 'phasehuman-so...',
        event: 'Image Generation',
        kind: 'Monthly Credits',
        model: 'v0-image-gen',
        cost: '$0.05',
    },
    {
        id: 4,
        date: 'Mar 20, 06:03 PM',
        user: 'phasehuman-so...',
        event: 'Image Generation',
        kind: 'Monthly Credits',
        model: 'v0-image-gen',
        cost: '$0.05',
    },
    {
        id: 5,
        date: 'Feb 7, 11:21 PM',
        user: 'phasehuman-so...',
        event: 'Message',
        kind: 'Monthly Credits',
        model: 'v0-mini',
        cost: '$0.04',
    },
    {
        id: 6,
        date: 'Feb 2, 01:47 PM',
        user: 'phasehuman-so...',
        event: 'Message',
        kind: 'Monthly Credits',
        model: 'v0-mini',
        cost: '$0.03',
    },
]

export const ProfileUsageSettings: React.FC = () => {
    const [timeRange, setTimeRange] = useState('90d')

    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9]">
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Usage</h1>
                <div className="flex flex-col border-t border-[#242323] pt-6">
                    {/* Controls Row */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#383736] hover:bg-[#1E1D1B] transition-colors text-[13px]">
                                <Calendar className="w-4 h-4 text-[#7B7A79]" />
                                <span>Feb 1 - May 2</span>
                                <ChevronDown className="w-4 h-4 text-[#7B7A79]" />
                            </button>
                            <div className="flex items-center gap-1">
                                {['1d', '7d', '30d', '90d'].map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range)}
                                        className={`px-2 py-1 rounded-md text-[13px] font-medium transition-colors ${
                                            range === timeRange
                                                ? 'bg-[#2B2A29] text-[#D6D5C9]'
                                                : 'text-[#7B7A79] hover:text-[#D6D5C9] hover:bg-[#1E1D1B]'
                                        }`}
                                    >
                                        {range}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#383736] hover:bg-[#1E1D1B] transition-colors text-[13px]">
                            <Download className="w-4 h-4 text-[#7B7A79]" />
                            <span>Download</span>
                        </button>
                    </div>

                    {/* Table */}
                    <div className="flex flex-col border border-[#242323] rounded-xl overflow-hidden bg-[#100E12] shadow-sm">
                        {/* Header */}
                        <div className="flex items-center py-3 px-5 border-b border-[#242323] bg-[#171615] text-[12px] text-[#7B7A79] font-medium">
                            <div className="w-[130px]">Date</div>
                            <div className="w-[140px]">User</div>
                            <div className="w-[120px]">Event</div>
                            <div className="w-[120px]">Kind</div>
                            <div className="flex-1">Model</div>
                            <div className="w-[60px] text-right">Cost</div>
                        </div>

                        {/* Rows */}
                        <div className="flex flex-col">
                            {usageData.map((row) => (
                                <div
                                    key={row.id}
                                    className="flex items-center py-3 px-5 text-[13px] border-b border-[#242323] last:border-b-0 hover:bg-[#171615] transition-colors"
                                >
                                    <div className="w-[130px] text-[#D6D5C9]">{row.date}</div>
                                    <div className="w-[140px] flex items-center gap-2 text-[#D6D5C9]">
                                        <UserCircle
                                            className="w-4 h-4 text-[#7B7A79]"
                                            strokeWidth={1.5}
                                        />
                                        <span className="truncate w-[90px]">{row.user}</span>
                                    </div>
                                    <div className="w-[120px] flex items-center gap-1.5 text-[#D6D5C9]">
                                        <span>{row.event}</span>
                                        {row.event === 'Message' && (
                                            <ArrowUpRight className="w-3.5 h-3.5 text-[#7B7A79]" />
                                        )}
                                    </div>
                                    <div className="w-[120px] text-[#7B7A79]">{row.kind}</div>
                                    <div className="flex-1 text-[#7B7A79]">{row.model}</div>
                                    <div className="w-[60px] text-right flex items-center justify-end gap-1.5">
                                        <span className="text-[#D6D5C9]">{row.cost}</span>
                                        <Info className="w-3.5 h-3.5 text-[#7B7A79]" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer Controls */}
                    <div className="flex items-center justify-between mt-5">
                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#383736] hover:bg-[#1E1D1B] transition-colors text-[13px]">
                            <span>Show 25</span>
                            <ChevronDown className="w-4 h-4 text-[#7B7A79]" />
                        </button>
                        <div className="flex items-center gap-4 text-[13px] text-[#7B7A79]">
                            <span>1 of 1</span>
                            <div className="flex items-center gap-1.5">
                                <button className="p-1 rounded-md border border-[#383736] opacity-50 cursor-not-allowed">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button className="p-1 rounded-md border border-[#383736] opacity-50 cursor-not-allowed">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
