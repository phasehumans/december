import React from 'react'
import { SuggestionButton } from './SuggestionButton'

interface SuggestionsListProps {
    onSuggestionClick: (prompt: string) => void
    isAuthenticated: boolean
    onOpenAuth: () => void
}

const SUGGESTIONS = [
    {
        label: 'SaaS Landing',
        prompt: 'Create a modern SaaS landing page with a hero section, features grid, and pricing table.',
    },
    {
        label: 'Admin Dashboard',
        prompt: 'Build a responsive admin dashboard with a sidebar, data tables, and chart widgets.',
    },
    {
        label: 'Portfolio',
        prompt: 'Design a personal portfolio site with a bio, project gallery, and contact form.',
    },
    {
        label: 'Login Page',
        prompt: 'Create a secure login page with email/password fields, social auth buttons, and a forgot password link.',
    },
]

export const SuggestionsList: React.FC<SuggestionsListProps> = ({
    onSuggestionClick,
    isAuthenticated,
    onOpenAuth,
}) => {
    const handleClick = (prompt: string) => {
        if (!isAuthenticated) {
            onOpenAuth()
            return
        }
        onSuggestionClick(prompt)
    }

    return (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 px-4">
            {SUGGESTIONS.map((suggestion, index) => (
                <div key={suggestion.label} className={index > 1 ? 'hidden md:block' : ''}>
                    <SuggestionButton
                        label={suggestion.label}
                        onClick={() => handleClick(suggestion.prompt)}
                    />
                </div>
            ))}
        </div>
    )
}
