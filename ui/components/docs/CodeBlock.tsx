import React from 'react';

export const CodeBlock = ({ code, language = "bash" }: { code: string, language?: string }) => (
    <div className="my-4 rounded-lg overflow-hidden border border-white/10 bg-[#0A0A0A]">
        <div className="flex items-center px-3 py-1.5 bg-white/5 border-b border-white/5 gap-2">
            <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
            </div>
            <span className="text-[10px] text-neutral-500 font-mono uppercase ml-2">{language}</span>
        </div>
        <div className="p-4 overflow-x-auto">
            <code className="text-xs font-mono text-neutral-300 whitespace-pre">
                {code}
            </code>
        </div>
    </div>
);