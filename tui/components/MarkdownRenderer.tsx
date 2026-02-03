import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="markdown-body text-zinc-300 leading-relaxed text-sm font-mono">
      <ReactMarkdown
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';
            const isInline = !match && !String(children).includes('\n');
            
            if (isInline) {
              return (
                <code className="bg-zinc-800 text-[#ce9178] px-1.5 py-0.5 rounded text-xs font-mono border border-zinc-700/30" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <div className="my-6 rounded overflow-hidden border border-zinc-700/50 bg-[#1e1e1e]">
                {/* Minimal Header */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#2d2d2d] border-b border-[#1e1e1e]">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">{language}</span>
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                  </div>
                </div>

                {/* Code Editor Area */}
                <div className="relative">
                    <SyntaxHighlighter
                        {...props}
                        style={vscDarkPlus}
                        language={language}
                        PreTag="div"
                        showLineNumbers={true}
                        lineNumberStyle={{
                            minWidth: '2.5em',
                            paddingRight: '1em',
                            color: '#4b5263',
                            textAlign: 'right',
                            userSelect: 'none',
                            fontSize: '11px'
                        }}
                        customStyle={{
                            margin: 0,
                            padding: '1rem',
                            fontSize: '12px',
                            lineHeight: '1.5',
                            backgroundColor: '#1e1e1e', // VS Code dark bg
                            fontFamily: '"JetBrains Mono", monospace'
                        }}
                    >
                        {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                </div>
              </div>
            );
          },
          h1: ({ children }) => <h1 className="text-lg font-bold text-white mt-8 mb-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold text-zinc-100 mt-6 mb-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-zinc-200 mt-5 mb-2">{children}</h3>,
          p: ({ children }) => <p className="mb-4 last:mb-0 text-zinc-300 leading-6">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-4 space-y-1 text-zinc-300">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-4 space-y-1 text-zinc-300">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-zinc-600 pl-4 text-zinc-500 my-4 italic">{children}</blockquote>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline decoration-blue-400/30 hover:decoration-blue-400">{children}</a>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;