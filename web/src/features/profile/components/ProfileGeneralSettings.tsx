import React, { useState, useEffect } from 'react'
import { ChevronDown, Volume1, Volume2, VolumeX, FilePlus, Trash2, Loader2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { profileAPI } from '@/features/profile/api/profile'

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
    const queryClient = useQueryClient()

    // --- Memories ---
    const memoriesQuery = useQuery({
        queryKey: ['profile', 'memories'],
        queryFn: profileAPI.getMemories,
    })

    const [memoriesText, setMemoriesText] = useState('')
    const [memoriesActive, setMemoriesActive] = useState(false)
    const [memoriesDirty, setMemoriesDirty] = useState(false)

    useEffect(() => {
        if (memoriesQuery.data?.memories) {
            setMemoriesText(memoriesQuery.data.memories)
            setMemoriesActive(true)
        }
    }, [memoriesQuery.data])

    const updateMemoriesMutation = useMutation({
        mutationFn: profileAPI.updateMemories,
        onSuccess: () => {
            setMemoriesDirty(false)
            queryClient.invalidateQueries({ queryKey: ['profile', 'memories'] })
            queryClient.invalidateQueries({ queryKey: ['profile'] })
        },
    })

    const deleteMemoriesMutation = useMutation({
        mutationFn: profileAPI.deleteMemories,
        onSuccess: () => {
            setMemoriesText('')
            setMemoriesActive(false)
            setMemoriesDirty(false)
            queryClient.invalidateQueries({ queryKey: ['profile', 'memories'] })
            queryClient.invalidateQueries({ queryKey: ['profile'] })
        },
    })

    // --- Skills ---
    const skillsQuery = useQuery({
        queryKey: ['profile', 'skills'],
        queryFn: profileAPI.getSkills,
    })

    const [skillsText, setSkillsText] = useState('')
    const [skillsActive, setSkillsActive] = useState(false)
    const [skillsDirty, setSkillsDirty] = useState(false)

    useEffect(() => {
        if (skillsQuery.data?.skills) {
            setSkillsText(skillsQuery.data.skills)
            setSkillsActive(true)
        }
    }, [skillsQuery.data])

    const updateSkillsMutation = useMutation({
        mutationFn: profileAPI.updateSkills,
        onSuccess: () => {
            setSkillsDirty(false)
            queryClient.invalidateQueries({ queryKey: ['profile', 'skills'] })
            queryClient.invalidateQueries({ queryKey: ['profile'] })
        },
    })

    const deleteSkillsMutation = useMutation({
        mutationFn: profileAPI.deleteSkills,
        onSuccess: () => {
            setSkillsText('')
            setSkillsActive(false)
            setSkillsDirty(false)
            queryClient.invalidateQueries({ queryKey: ['profile', 'skills'] })
            queryClient.invalidateQueries({ queryKey: ['profile'] })
        },
    })

    const defaultSkillContent = `---
name: skill
description: Describe what this skill does and when december should use it. Be specific - this is how december decides to trigger the skill.
---

# skill

## Instructions

Write the steps december should follow when this skill is triggered.
Focus on what december wouldn't already know - domain-specific details, preferred patterns, or exact sequences.`

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

                    {!memoriesActive ? (
                        <div>
                            <button
                                onClick={() => setMemoriesActive(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-[#383736] rounded-lg text-[14px] font-medium text-[#D6D5C9] hover:bg-[#242323] transition-colors w-fit shadow-sm"
                            >
                                <FilePlus className="w-4 h-4" />
                                Create MEMORY.md
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col border border-[#2B2A29] rounded-xl overflow-hidden bg-[#131211]">
                            <div className="flex items-center justify-between px-4 py-3 bg-[#131211] border-b border-[#2B2A29]">
                                <span className="text-[13px] font-medium text-[#D6D5C9]">
                                    MEMORY.md
                                </span>
                                <span className="text-[12px] text-[#4A4948]">
                                    {memoriesText.length} chars
                                </span>
                            </div>
                            <div className="p-4 bg-[#131211]">
                                <textarea
                                    className="w-full h-[200px] bg-[#0E0D0C] border border-[#2B2A29] rounded-lg p-4 text-[13.5px] text-[#D6D5C9] placeholder:text-[#4A4948] font-mono leading-[1.6] resize-none focus:outline-none focus:border-[#383736] transition-colors caret-[#D6D5C9]"
                                    placeholder='Keep this short — summarize key preferences and link to reference files for details (e.g. "See patterns.md for React conventions").'
                                    spellCheck={false}
                                    value={memoriesText}
                                    onChange={(e) => {
                                        setMemoriesText(e.target.value)
                                        setMemoriesDirty(true)
                                    }}
                                ></textarea>
                                <div className="flex items-center gap-3 mt-4">
                                    <button
                                        onClick={() => {
                                            if (memoriesText.trim()) {
                                                updateMemoriesMutation.mutate({
                                                    memories: memoriesText,
                                                })
                                            }
                                        }}
                                        disabled={
                                            !memoriesDirty || updateMemoriesMutation.isPending
                                        }
                                        className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#242323] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {updateMemoriesMutation.isPending && (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        )}
                                        Save
                                    </button>
                                    <button
                                        onClick={() => deleteMemoriesMutation.mutate()}
                                        disabled={deleteMemoriesMutation.isPending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#7B7A79] hover:text-red-400 transition-colors rounded-lg disabled:opacity-30"
                                    >
                                        {deleteMemoriesMutation.isPending ? (
                                            <Loader2 className="w-[15px] h-[15px] animate-spin" />
                                        ) : (
                                            <Trash2 className="w-[15px] h-[15px]" />
                                        )}
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

                    {!skillsActive ? (
                        <div>
                            <button
                                onClick={() => {
                                    setSkillsActive(true)
                                    if (!skillsText) {
                                        setSkillsText(defaultSkillContent)
                                        setSkillsDirty(true)
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2 border border-[#383736] rounded-lg text-[14px] font-medium text-[#D6D5C9] hover:bg-[#242323] transition-colors w-fit shadow-sm"
                            >
                                <FilePlus className="w-4 h-4" />
                                Create a skill
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col border border-[#2B2A29] rounded-xl overflow-hidden bg-[#131211]">
                            <div className="flex items-center justify-between px-4 py-3 bg-[#131211] border-b border-[#2B2A29]">
                                <span className="text-[13px] font-medium text-[#D6D5C9]">
                                    skill / <span className="text-white">SKILL.md</span>
                                </span>
                                <span className="text-[12px] text-[#4A4948]">
                                    {skillsText.length} chars
                                </span>
                            </div>
                            <div className="p-4 bg-[#131211]">
                                <textarea
                                    className="w-full h-[320px] bg-[#0E0D0C] border border-[#2B2A29] rounded-lg p-4 text-[13.5px] text-[#D6D5C9] placeholder:text-[#4A4948] font-mono leading-[1.6] resize-none focus:outline-none focus:border-[#383736] transition-colors caret-[#D6D5C9]"
                                    spellCheck={false}
                                    value={skillsText}
                                    onChange={(e) => {
                                        setSkillsText(e.target.value)
                                        setSkillsDirty(true)
                                    }}
                                ></textarea>
                                <div className="flex items-center gap-3 mt-4">
                                    <button
                                        onClick={() => {
                                            if (skillsText.trim()) {
                                                updateSkillsMutation.mutate({
                                                    skills: skillsText,
                                                })
                                            }
                                        }}
                                        disabled={!skillsDirty || updateSkillsMutation.isPending}
                                        className="px-4 py-1.5 rounded-lg border border-[#383736] text-[13px] font-medium text-[#D6D5C9] hover:bg-[#242323] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {updateSkillsMutation.isPending && (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        )}
                                        Save
                                    </button>
                                    <button
                                        onClick={() => deleteSkillsMutation.mutate()}
                                        disabled={deleteSkillsMutation.isPending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#7B7A79] hover:text-red-400 transition-colors rounded-lg disabled:opacity-30"
                                    >
                                        {deleteSkillsMutation.isPending ? (
                                            <Loader2 className="w-[15px] h-[15px] animate-spin" />
                                        ) : (
                                            <Trash2 className="w-[15px] h-[15px]" />
                                        )}
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
