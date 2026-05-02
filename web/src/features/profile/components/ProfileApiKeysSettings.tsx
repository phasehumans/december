import React from 'react'
import { ArrowUpRight } from 'lucide-react'

export const ProfileApiKeysSettings: React.FC = () => {
    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9]">
            <div className="flex flex-col mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <h1 className="text-[16px] font-medium">API Keys</h1>
                    <span className="px-2 py-0.5 rounded-md text-[10px] bg-[#242323] text-[#D6D5C9] uppercase font-bold tracking-wider">
                        BETA
                    </span>
                </div>

                <div className="flex flex-col border-t border-[#242323] pt-6">
                    <p className="text-[13px] text-[#7B7A79] leading-relaxed mb-8 max-w-[95%]">
                        Manage your model and platform API keys. While in beta, API calls will
                        consume your phasehumans credits. By using the API, you agree to our{' '}
                        <a
                            href="#"
                            className="text-[#D6D5C9] hover:text-white hover:underline transition-colors"
                        >
                            API Terms
                        </a>
                        . Learn more about the{' '}
                        <a
                            href="#"
                            className="text-[#D6D5C9] hover:text-white hover:underline transition-colors inline-flex items-center gap-1"
                        >
                            phasehumans API <ArrowUpRight className="w-3 h-3" />
                        </a>
                        .
                    </p>

                    <div className="w-full rounded-xl border border-dashed border-[#383736] py-20 flex flex-col items-center justify-center gap-4 transition-colors hover:border-[#4A4948] bg-[#100E12]/30">
                        <span className="text-[14px] text-[#7B7A79]">No API keys added</span>
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors mt-1">
                            New Key
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
