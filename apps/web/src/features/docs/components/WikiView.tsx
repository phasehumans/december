import React, { useState } from 'react'

export const WikiView: React.FC = () => {
    const [isEditing, setIsEditing] = useState(false)
    const [content, setContent] = useState(
        '# Project Wiki\n\nWelcome to the developer documentation.\n\n## Architecture\n- Vite\n- React\n- Tailwind CSS'
    )

    return (
        <div className="flex flex-col h-full bg-white text-gray-900 p-8 max-w-4xl mx-auto w-full">
            <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Project Wiki</h1>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors shadow-sm text-sm"
                >
                    {isEditing ? 'View Mode' : 'Edit Page'}
                </button>
            </div>

            {isEditing ? (
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="flex-1 w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-sm bg-gray-50"
                />
            ) : (
                <div className="prose prose-blue max-w-none">
                    {/* Placeholder for markdown rendering */}
                    <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }} />
                </div>
            )}

            {isEditing && (
                <div className="mt-6 flex justify-end">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors shadow-sm">
                        Save Changes
                    </button>
                </div>
            )}
        </div>
    )
}
