import React, { useState } from 'react'
import { ChevronDown, Volume1, Volume2, VolumeX, FilePlus, Trash2 } from 'lucide-react'

interface ProfileGeneralSettingsProps {
    chatSuggestions: boolean
    generationSound: 'FIRST_GENERATION' | 'ALWAYS' | 'NEVER'
    onChatSuggestionsToggle: (value: boolean) => void
    onGenerationSoundChange: (value: 'FIRST_GENERATION' | 'ALWAYS' | 'NEVER') => void
}

export const ProfileGeneralSettings: React.FC<ProfileGeneralSettingsProps> = ({
    chatSuggestions,
    generationSound,
    onChatSuggestionsToggle,
    onGenerationSoundChange,
}) => {
    const [activeMemory, setActiveMemory] = useState(false)
    const [activeSkill, setActiveSkill] = useState(false)

    return (
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
            {/* Preferences */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-4">Preferences</h1>
                <div className="flex flex-col gap-7 border-t border-[#242323] pt-6">
                    {/* Chat suggestions */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[14px] text-[#D6D5C9]">Chat suggestions</span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Show helpful suggestions in the chat interface to enhance your
                                experience.
                            </span>
                        </div>
                        <button
                            role="switch"
                            onClick={() => onChatSuggestionsToggle(!chatSuggestions)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                chatSuggestions ? 'bg-[#242323]' : 'bg-[#100E12] border-[#383736]'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                                    chatSuggestions
                                        ? 'translate-x-4 bg-[#D6D5C9]'
                                        : 'translate-x-0 bg-[#383736]'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Generation complete sound */}
                    <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-0.5 max-w-[60%]">
                            <span className="text-[14px] text-[#D6D5C9]">
                                Generation complete sound
                            </span>
                            <span className="text-[13px] text-[#7B7A79]">
                                Plays a satisfying sound notification when a generation is finished.
                            </span>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => onGenerationSoundChange('FIRST_GENERATION')}
                                className="flex items-center gap-3 text-[13px] font-medium transition-colors hover:text-[#D6D5C9] group"
                            >
                                <div
                                    className={`flex items-center justify-center w-4 h-4 rounded-full border ${generationSound === 'FIRST_GENERATION' ? 'border-[#D6D5C9]' : 'border-[#383736] group-hover:border-[#7B7A79]'}`}
                                >
                                    {generationSound === 'FIRST_GENERATION' && (
                                        <div className="w-2 h-2 rounded-full bg-[#D6D5C9]" />
                                    )}
                                </div>
                                <Volume1 className="w-4 h-4 text-[#7B7A79]" />
                                <span
                                    className={
                                        generationSound === 'FIRST_GENERATION'
                                            ? 'text-[#D6D5C9]'
                                            : 'text-[#7B7A79]'
                                    }
                                >
                                    First generation
                                </span>
                            </button>
                            <button
                                onClick={() => onGenerationSoundChange('ALWAYS')}
                                className="flex items-center gap-3 text-[13px] font-medium transition-colors hover:text-[#D6D5C9] group"
                            >
                                <div
                                    className={`flex items-center justify-center w-4 h-4 rounded-full border ${generationSound === 'ALWAYS' ? 'border-[#D6D5C9]' : 'border-[#383736] group-hover:border-[#7B7A79]'}`}
                                >
                                    {generationSound === 'ALWAYS' && (
                                        <div className="w-2 h-2 rounded-full bg-[#D6D5C9]" />
                                    )}
                                </div>
                                <Volume2 className="w-4 h-4 text-[#7B7A79]" />
                                <span
                                    className={
                                        generationSound === 'ALWAYS'
                                            ? 'text-[#D6D5C9]'
                                            : 'text-[#7B7A79]'
                                    }
                                >
                                    Always
                                </span>
                            </button>
                            <button
                                onClick={() => onGenerationSoundChange('NEVER')}
                                className="flex items-center gap-3 text-[13px] font-medium transition-colors hover:text-[#D6D5C9] group"
                            >
                                <div
                                    className={`flex items-center justify-center w-4 h-4 rounded-full border ${generationSound === 'NEVER' ? 'border-[#D6D5C9]' : 'border-[#383736] group-hover:border-[#7B7A79]'}`}
                                >
                                    {generationSound === 'NEVER' && (
                                        <div className="w-2 h-2 rounded-full bg-[#D6D5C9]" />
                                    )}
                                </div>
                                <VolumeX className="w-4 h-4 text-[#7B7A79]" />
                                <span
                                    className={
                                        generationSound === 'NEVER'
                                            ? 'text-[#D6D5C9]'
                                            : 'text-[#7B7A79]'
                                    }
                                >
                                    Never
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Memories */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-4">Memories</h1>
                <div className="flex flex-col gap-4 border border-[#242323] rounded-xl p-5 bg-[#171615]">
                    <p className="text-[13px] text-[#7B7A79] mb-4 leading-relaxed">
                        Teach december your preferences and conventions. MEMORY.md is always read at
                        the start of every chat; other files are loaded on demand.
                    </p>

                    {!activeMemory ? (
                        <div>
                            <button
                                onClick={() => setActiveMemory(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-[#383736] rounded-lg text-[14px] font-medium text-[#D6D5C9] hover:bg-[#242323] transition-colors w-fit shadow-sm"
                            >
                                <FilePlus className="w-4 h-4" />
                                Create MEMORY.md
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col border border-[#242323] rounded-xl overflow-hidden bg-[#100E12]">
                            <div className="flex items-center justify-between px-4 py-3 bg-[#100E12]">
                                <span className="text-[13px] font-medium text-[#D6D5C9]">
                                    MEMORY.md
                                </span>
                                <span className="text-[12px] text-[#4A4948]">0 chars</span>
                            </div>
                            <div className="w-full h-[1px] bg-[#242323]" />
                            <div className="p-4 bg-[#100E12]">
                                <textarea
                                    className="w-full h-[200px] bg-[#100E12] border border-[#242323] rounded-xl p-4 text-[13.5px] text-[#808080] font-mono leading-[1.6] resize-none focus:outline-none focus:border-[#4A4948] transition-colors caret-[#D6D5C9]"
                                    placeholder='Keep this short — summarize key preferences and link to reference files for details (e.g. "See patterns.md for React conventions").'
                                    spellCheck={false}
                                ></textarea>
                                <div className="flex items-center gap-4 mt-4">
                                    <button className="px-5 py-1.5 border border-[#D6D5C9] text-[#D6D5C9] rounded-lg text-[14px] font-medium hover:bg-[#D6D5C9] hover:text-[#100E12] transition-colors">
                                        Save
                                    </button>
                                    <button
                                        onClick={() => setActiveMemory(false)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-[#7B7A79] hover:text-[#D6D5C9] transition-colors text-[14px] font-medium rounded-lg"
                                    >
                                        <Trash2 className="w-[18px] h-[18px]" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Skills */}
            <div className="flex flex-col mb-10">
                <h1 className="text-[16px] font-medium mb-4">Custom Skills</h1>
                <div className="flex flex-col gap-4 border border-[#242323] rounded-xl p-5 bg-[#171615]">
                    <p className="text-[13px] text-[#7B7A79] mb-4 leading-relaxed">
                        Create reusable skills that december can apply during conversations. Each
                        skill has a SKILL.md that defines when it triggers and what instructions to
                        follow.
                    </p>

                    {!activeSkill ? (
                        <div>
                            <button
                                onClick={() => setActiveSkill(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-[#383736] rounded-lg text-[14px] font-medium text-[#D6D5C9] hover:bg-[#242323] transition-colors w-fit shadow-sm"
                            >
                                <FilePlus className="w-4 h-4" />
                                Create a skill
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col border border-[#242323] rounded-xl overflow-hidden bg-[#100E12]">
                            <div className="flex items-center justify-between px-4 py-3 bg-[#100E12]">
                                <span className="text-[13px] font-medium text-[#D6D5C9]">
                                    skill / <span className="text-white">SKILL.md</span>
                                </span>
                                <span className="text-[12px] text-[#4A4948]">345 chars</span>
                            </div>
                            <div className="w-full h-[1px] bg-[#242323]" />
                            <div className="p-4 bg-[#100E12]">
                                <textarea
                                    className="w-full h-[320px] bg-[#100E12] border border-[#242323] rounded-xl p-4 text-[13.5px] text-[#D6D5C9] font-mono leading-[1.6] resize-none focus:outline-none focus:border-[#4A4948] transition-colors caret-[#D6D5C9]"
                                    defaultValue={`---
name: skill
description: Describe what this skill does and when december should use it. Be specific - this is how december decides to trigger the skill.
---

# skill

## Instructions

Write the steps december should follow when this skill is triggered.
Focus on what december wouldn't already know - domain-specific details, preferred patterns, or exact sequences.`}
                                    spellCheck={false}
                                ></textarea>
                                <div className="flex items-center gap-4 mt-4">
                                    <button className="px-5 py-1.5 border border-[#D6D5C9] text-[#D6D5C9] rounded-lg text-[14px] font-medium hover:bg-[#D6D5C9] hover:text-[#100E12] transition-colors">
                                        Save
                                    </button>
                                    <button
                                        onClick={() => setActiveSkill(false)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-[#7B7A79] hover:text-[#D6D5C9] transition-colors text-[14px] font-medium rounded-lg"
                                    >
                                        <Trash2 className="w-[18px] h-[18px]" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
