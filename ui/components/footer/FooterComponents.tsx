import React, { PropsWithChildren } from 'react';

// X (Twitter) Icon SVG
export const XIcon = ({ size = 18, className }: { size?: number, className?: string }) => (
  <svg 
    role="img" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    xmlns="http://www.w3.org/2000/svg" 
    width={size}
    height={size}
    className={className}
  >
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
  </svg>
);

export const FooterLink = ({ href, children }: PropsWithChildren<{ href: string }>) => (
    <li>
        <a 
            href={href} 
            className="text-sm text-neutral-500 hover:text-white transition-colors duration-200 block py-1.5 font-medium"
        >
            {children}
        </a>
    </li>
);

export const FooterColumn = ({ title, children }: PropsWithChildren<{ title: string }>) => (
    <div className="flex flex-col gap-4">
        <h4 className="text-sm font-semibold text-white tracking-wide">{title}</h4>
        <ul className="flex flex-col gap-1">
            {children}
        </ul>
    </div>
);

export const SocialLink = ({ icon: Icon, href }: { icon: any, href: string }) => (
    <a 
        href={href} 
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white transition-all border border-transparent hover:border-white/5"
    >
        <Icon size={16} />
    </a>
);