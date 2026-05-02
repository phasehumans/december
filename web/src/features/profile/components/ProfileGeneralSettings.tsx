import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export const ProfileGeneralSettings: React.FC = () => {
    const [theme, setTheme] = useState<'Light' | 'Dark' | 'System'>('System')
    const [autosuggest, setAutosuggest] = useState(true)
    const [aiDataRetention, setAiDataRetention] = useState(true)
    const [emailDeepResearch, setEmailDeepResearch] = useState(true)
    const [emailComputerTasks, setEmailComputerTasks] = useState(true)
    const [emailScheduledTasks, setEmailScheduledTasks] = useState(true)
    const [emailSharedThreads, setEmailSharedThreads] = useState(true)
    const [emailSharedFiles, setEmailSharedFiles] = useState(true)

    return (
        <div className="flex flex-col w-full max-w-[680px] text-[#D6D5C9]">
            {/* Appearance */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Appearance</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    {/* Theme */}
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Theme</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                How phasehumans looks on your device
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Light Card */}
                            <button
                                onClick={() => setTheme('Light')}
                                className="flex flex-col items-center gap-2 group"
                            >
                                <div
                                    className={`w-[84px] h-[58px] rounded-lg border overflow-hidden flex items-center justify-center transition-colors ${theme === 'Light' ? 'border-[#D6D5C9]' : 'border-[#242323] group-hover:border-[#4A4948]'}`}
                                >
                                    <div className="w-full h-full flex bg-[#F9F9F9]">
                                        <div className="w-[18px] h-full border-r border-[#E5E5E5] flex flex-col gap-1 p-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#E5E5E5]"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#E5E5E5]"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#E5E5E5]"></div>
                                        </div>
                                        <div className="flex-1 p-2.5 flex flex-col justify-center gap-2">
                                            <div className="w-10 h-[3px] bg-[#A3A3A3] rounded-full"></div>
                                            <div className="flex justify-between items-center w-full">
                                                <div className="w-6 h-[2px] bg-[#E5E5E5] rounded-full"></div>
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#3FA69C]"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <span
                                    className={`text-[12px] ${theme === 'Light' ? 'text-[#D6D5C9]' : 'text-[#7B7A79]'}`}
                                >
                                    Light
                                </span>
                            </button>

                            {/* Dark Card */}
                            <button
                                onClick={() => setTheme('Dark')}
                                className="flex flex-col items-center gap-2 group"
                            >
                                <div
                                    className={`w-[84px] h-[58px] rounded-lg border overflow-hidden flex items-center justify-center transition-colors ${theme === 'Dark' ? 'border-[#D6D5C9]' : 'border-[#242323] group-hover:border-[#4A4948]'}`}
                                >
                                    <div className="w-full h-full flex bg-[#171615]">
                                        <div className="w-[18px] h-full border-r border-[#242323] flex flex-col gap-1 p-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#242323]"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#242323]"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#242323]"></div>
                                        </div>
                                        <div className="flex-1 p-2.5 flex flex-col justify-center gap-2">
                                            <div className="w-10 h-[3px] bg-[#4A4948] rounded-full"></div>
                                            <div className="flex justify-between items-center w-full">
                                                <div className="w-6 h-[2px] bg-[#242323] rounded-full"></div>
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#3FA69C]"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <span
                                    className={`text-[12px] ${theme === 'Dark' ? 'text-[#D6D5C9]' : 'text-[#7B7A79]'}`}
                                >
                                    Dark
                                </span>
                            </button>

                            {/* System Card */}
                            <button
                                onClick={() => setTheme('System')}
                                className="flex flex-col items-center gap-2 group"
                            >
                                <div
                                    className={`w-[84px] h-[58px] rounded-lg border overflow-hidden flex items-center justify-center transition-colors ${theme === 'System' ? 'border-[#D6D5C9]' : 'border-[#242323] group-hover:border-[#4A4948]'}`}
                                >
                                    <div className="w-full h-full flex">
                                        <div className="w-1/2 h-full bg-[#F9F9F9] flex border-r border-[#242323]">
                                            <div className="w-full h-full border-r border-[#E5E5E5] flex flex-col gap-1 p-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#E5E5E5]"></div>
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#E5E5E5]"></div>
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#E5E5E5]"></div>
                                            </div>
                                        </div>
                                        <div className="w-1/2 h-full bg-[#171615] flex">
                                            <div className="flex-1 p-2.5 flex flex-col justify-end items-end pb-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#3FA69C]"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <span
                                    className={`text-[12px] ${theme === 'System' ? 'text-[#D6D5C9]' : 'text-[#7B7A79]'}`}
                                >
                                    System
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Answer font */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Answer font</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Font style for AI response text
                            </span>
                        </div>
                        <button className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg border border-[#383736] hover:bg-[#1E1D1B] transition-colors">
                            <span className="text-[13px] text-[#D6D5C9]">Serif</span>
                            <ChevronDown className="w-4 h-4 text-[#7B7A79]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Preferences */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Preferences</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    {/* Language */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Language</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                The language used in the user interface
                            </span>
                        </div>
                        <button className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg border border-[#383736] hover:bg-[#1E1D1B] transition-colors">
                            <span className="text-[13px] text-[#D6D5C9]">Default</span>
                            <ChevronDown className="w-4 h-4 text-[#7B7A79]" />
                        </button>
                    </div>

                    {/* Preferred response language */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">
                                Preferred response language
                            </span>
                            <span className="text-[13px] text-[#7B7A79]">
                                The language used for AI responses
                            </span>
                        </div>
                        <button className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg border border-[#383736] hover:bg-[#1E1D1B] transition-colors">
                            <span className="text-[13px] text-[#D6D5C9]">
                                Automatic (detect input)
                            </span>
                            <ChevronDown className="w-4 h-4 text-[#7B7A79]" />
                        </button>
                    </div>

                    {/* Autosuggest */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Autosuggest</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Enable dropdown and tab-complete suggestions while typing a query
                            </span>
                        </div>
                        <button
                            onClick={() => setAutosuggest(!autosuggest)}
                            className={`relative w-[36px] h-[20px] rounded-full transition-colors ${autosuggest ? 'bg-[#3FA69C]' : 'bg-[#383736]'}`}
                        >
                            <span
                                className={`absolute top-[2px] left-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform ${autosuggest ? 'translate-x-[16px]' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>

                    {/* Keyboard shortcut hints */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">
                                Keyboard shortcut hints
                            </span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Display keyboard shortcuts as symbols (⌘↑) or full key names
                                (Cmd+Shift)
                            </span>
                        </div>
                        <button className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg border border-[#383736] hover:bg-[#1E1D1B] transition-colors">
                            <span className="text-[13px] text-[#D6D5C9]">Text</span>
                            <ChevronDown className="w-4 h-4 text-[#7B7A79]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Artificial Intelligence */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Artificial Intelligence</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    {/* Image generation model */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">
                                Image generation model
                            </span>
                        </div>
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors">
                            Upgrade to select
                        </button>
                    </div>

                    {/* Video generation model */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">
                                Video generation model
                            </span>
                        </div>
                        <button className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] text-[#D6D5C9] hover:bg-[#1E1D1B] transition-colors">
                            Upgrade to Max
                        </button>
                    </div>

                    {/* AI data retention */}
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-0.5 max-w-[85%]">
                            <span className="text-[14px] text-[#D6D5C9]">AI data retention</span>
                            <span className="text-[13px] text-[#7B7A79] leading-relaxed">
                                AI Data Retention allows phasehumans to use your searches to improve
                                AI models. Turn this setting off if you wish to exclude your data
                                from this process.
                            </span>
                        </div>
                        <button
                            onClick={() => setAiDataRetention(!aiDataRetention)}
                            className={`relative w-[36px] h-[20px] rounded-full transition-colors mt-1 ${aiDataRetention ? 'bg-[#3FA69C]' : 'bg-[#383736]'}`}
                        >
                            <span
                                className={`absolute top-[2px] left-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform ${aiDataRetention ? 'translate-x-[16px]' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Email settings */}
            <div className="flex flex-col mb-8">
                <h1 className="text-[16px] font-medium mb-4">Email settings</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    {/* Deep research and file creation */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">
                                Deep research and file creation
                            </span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Get email updates when your research is ready
                            </span>
                        </div>
                        <button
                            onClick={() => setEmailDeepResearch(!emailDeepResearch)}
                            className={`relative w-[36px] h-[20px] rounded-full transition-colors ${emailDeepResearch ? 'bg-[#3FA69C]' : 'bg-[#383736]'}`}
                        >
                            <span
                                className={`absolute top-[2px] left-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform ${emailDeepResearch ? 'translate-x-[16px]' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>

                    {/* Computer Tasks */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Computer Tasks</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Get email updates when your computer task is ready
                            </span>
                        </div>
                        <button
                            onClick={() => setEmailComputerTasks(!emailComputerTasks)}
                            className={`relative w-[36px] h-[20px] rounded-full transition-colors ${emailComputerTasks ? 'bg-[#3FA69C]' : 'bg-[#383736]'}`}
                        >
                            <span
                                className={`absolute top-[2px] left-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform ${emailComputerTasks ? 'translate-x-[16px]' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>

                    {/* Scheduled Tasks */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Scheduled Tasks</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Get email updates when your scheduled tasks complete
                            </span>
                        </div>
                        <button
                            onClick={() => setEmailScheduledTasks(!emailScheduledTasks)}
                            className={`relative w-[36px] h-[20px] rounded-full transition-colors ${emailScheduledTasks ? 'bg-[#3FA69C]' : 'bg-[#383736]'}`}
                        >
                            <span
                                className={`absolute top-[2px] left-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform ${emailScheduledTasks ? 'translate-x-[16px]' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>

                    {/* Shared threads */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Shared threads</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Get email updates when someone shares a thread with you
                            </span>
                        </div>
                        <button
                            onClick={() => setEmailSharedThreads(!emailSharedThreads)}
                            className={`relative w-[36px] h-[20px] rounded-full transition-colors ${emailSharedThreads ? 'bg-[#3FA69C]' : 'bg-[#383736]'}`}
                        >
                            <span
                                className={`absolute top-[2px] left-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform ${emailSharedThreads ? 'translate-x-[16px]' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>

                    {/* Shared files */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Shared files</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Get email updates when someone shares a file with you
                            </span>
                        </div>
                        <button
                            onClick={() => setEmailSharedFiles(!emailSharedFiles)}
                            className={`relative w-[36px] h-[20px] rounded-full transition-colors ${emailSharedFiles ? 'bg-[#3FA69C]' : 'bg-[#383736]'}`}
                        >
                            <span
                                className={`absolute top-[2px] left-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform ${emailSharedFiles ? 'translate-x-[16px]' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
