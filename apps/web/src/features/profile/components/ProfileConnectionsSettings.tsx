import React from 'react'

export interface ProfileConnectionsSettingsProps {
    isGithubConnected: boolean
    isVercelConnected: boolean
    isSupabaseConnected: boolean
    isNotionConnected: boolean
    onConnectGithub: () => void
    onConnectVercel: () => void
    onConnectSupabase: () => void
    onConnectNotion: () => void
}

// Icons
const GithubIcon = () => (
    <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
)

const VercelIcon = () => (
    <svg viewBox="0 0 76 65" fill="white" className="w-5 h-5">
        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
)

const NotionIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M4.46 4.21c.75.6 1.03.56 2.43.46L20.1 3.88c.28 0 .05-.28-.04-.33L17.86 1.97c-.42-.33-.98-.7-2.05-.61L3.01 2.3c-.47.04-.56.28-.37.47zm.79 3.08v13.9c0 .75.37 1.03 1.21.98l14.53-.84c.84-.04.93-.56.93-1.17V6.35c0-.6-.23-.93-.75-.89l-15.17.89c-.56.04-.75.33-.75.93zm14.34.74c.09.42 0 .84-.42.89l-.7.14v10.26c-.61.33-1.17.52-1.64.52-.75 0-.93-.23-1.5-.93l-4.57-7.19v6.95l1.45-.19s0 .84-1.17.84l-3.22.19c-.09-.19 0-.66.33-.75l.84-.23V9.85l-1.45-.1c-.09-.42.14-1.03.79-1.07l3.46-.23 4.76 7.28v-6.44l-1.21-.14c-.1-.51.27-.89.74-.93zM1.94 1.04l13.3-.98c1.64-.14 2.06-.05 3.08.7l4.25 2.99c.7.51.94.65.94 1.21v16.38c0 1.03-.37 1.63-1.68 1.73l-15.46.93c-.98.05-1.45-.09-1.96-.75L1.28 17.5c-.56-.75-.79-1.3-.79-1.96V2.67c0-.84.37-1.54 1.45-1.63z" />
    </svg>
)

const SupabaseIcon = () => (
    <svg viewBox="0 0 24 24" fill="#3ECF8E" className="w-5 h-5">
        <path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z" />
    </svg>
)

const FigmaIcon = () => (
    <svg viewBox="0 0 38 57" fill="none" className="w-5 h-5">
        <path
            d="M19 28.5C19 33.7467 14.7467 38 9.5 38C4.25329 38 0 33.7467 0 28.5C0 23.2533 4.25329 19 9.5 19H19V28.5Z"
            fill="#A259FF"
        />
        <path
            d="M9.5 0H19V19H9.5C4.25329 19 0 14.7467 0 9.5C0 4.2533 4.25329 0 9.5 0Z"
            fill="#F24E1E"
        />
        <path
            d="M28.5 0H19V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.2533 33.7467 0 28.5 0Z"
            fill="#FF7262"
        />
        <path
            d="M38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5Z"
            fill="#1ABCFE"
        />
        <path
            d="M9.5 57C14.7467 57 19 52.7467 19 47.5V38H9.5C4.25329 38 0 42.2533 0 47.5C0 52.7467 4.25329 57 9.5 57Z"
            fill="#0ACF83"
        />
    </svg>
)

const SlackIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <path
            d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
            fill="#E01E5A"
        />
        <path
            d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
            fill="#36C5F0"
        />
        <path
            d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"
            fill="#2EB67D"
        />
        <path
            d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
            fill="#ECB22E"
        />
    </svg>
)

const LinearIcon = () => (
    <svg viewBox="0 0 24 24" fill="#5E6AD2" className="w-5 h-5">
        <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
)

const SentryIcon = () => (
    <svg viewBox="0 0 24 24" fill="#FF4088" className="w-5 h-5">
        <path d="M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z" />
    </svg>
)

const NeonIcon = () => (
    <svg viewBox="0 0 24 24" fill="#00E599" className="w-5 h-5">
        <path d="M24 0V24l-9.365-8.045V24H0V0ZM2.942 21.087h8.751V9.563l9.365 8.204V2.919L2.942 2.914Z" />
    </svg>
)

const CloudflareIcon = () => (
    <svg viewBox="0 0 24 24" fill="#F38020" className="w-5 h-5">
        <path d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727" />
    </svg>
)

const UpstashIcon = () => (
    <svg viewBox="0 0 24 24" fill="#00E9A3" className="w-5 h-5">
        <path d="M13.8027 0C11.193 0 8.583.9952 6.5918 2.9863c-3.9823 3.9823-3.9823 10.4396 0 14.4219 1.9911 1.9911 5.2198 1.9911 7.211 0 1.991-1.9911 1.991-5.2198 0-7.211L12 12c.9956.9956.9956 2.6098 0 3.6055-.9956.9955-2.6099.9955-3.6055 0-2.9866-2.9868-2.9866-7.8297 0-10.8164 2.9868-2.9868 7.8297-2.9868 10.8164 0l1.8028-1.8028C19.0225.9952 16.4125 0 13.8027 0zM12 12c-.9956-.9956-.9956-2.6098 0-3.6055.9956-.9955 2.6098-.9955 3.6055 0 2.9867 2.9868 2.9867 7.8297 0 10.8164-2.9867 2.9868-7.8297 2.9868-10.8164 0l-1.8028 1.8028c3.9823 3.9822 10.4396 3.9822 14.4219 0 3.9823-3.9824 3.9823-10.4396 0-14.4219-.9956-.9956-2.3006-1.4922-3.6055-1.4922-1.3048 0-2.6099.4966-3.6054 1.4922-1.9912 1.9912-1.9912 5.2198 0 7.211z" />
    </svg>
)

const RailwayIcon = () => (
    <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M.113 10.27A13.026 13.026 0 000 11.48h18.23c-.064-.125-.15-.237-.235-.347-3.117-4.027-4.793-3.677-7.19-3.78-.8-.034-1.34-.048-4.524-.048-1.704 0-3.555.005-5.358.01-.234.63-.459 1.24-.567 1.737h9.342v1.216H.113v.002zm18.26 2.426H.009c.02.326.05.645.094.961h16.955c.754 0 1.179-.429 1.315-.96zm-17.318 4.28s2.81 6.902 10.93 7.024c4.855 0 9.027-2.883 10.92-7.024H1.056zM11.988 0C7.5 0 3.593 2.466 1.531 6.108l4.75-.005v-.002c3.71 0 3.849.016 4.573.047l.448.016c1.563.052 3.485.22 4.996 1.364.82.621 2.007 1.99 2.712 2.965.654.902.842 1.94.396 2.934-.408.914-1.289 1.458-2.353 1.458H.391s.099.42.249.886h22.748A12.026 12.026 0 0024 12.005C24 5.377 18.621 0 11.988 0z" />
    </svg>
)

const PostHogIcon = () => (
    <svg viewBox="0 0 24 24" fill="#F54E00" className="w-5 h-5">
        <path d="M9.854 14.5 5 9.647.854 5.5A.5.5 0 0 0 0 5.854V8.44a.5.5 0 0 0 .146.353L5 13.647l.147.146L9.854 18.5l.146.147v-.049c.065.03.134.049.207.049h2.586a.5.5 0 0 0 .353-.854L9.854 14.5zm0-5-4-4a.487.487 0 0 0-.409-.144.515.515 0 0 0-.356.21.493.493 0 0 0-.089.288V8.44a.5.5 0 0 0 .147.353l9 9a.5.5 0 0 0 .853-.354v-2.585a.5.5 0 0 0-.146-.354l-5-5zm1-4a.5.5 0 0 0-.854.354V8.44a.5.5 0 0 0 .147.353l4 4a.5.5 0 0 0 .853-.354V9.854a.5.5 0 0 0-.146-.354l-4-4zm12.647 11.515a3.863 3.863 0 0 1-2.232-1.1l-4.708-4.707a.5.5 0 0 0-.854.354v6.585a.5.5 0 0 0 .5.5H23.5a.5.5 0 0 0 .5-.5v-.6c0-.276-.225-.497-.499-.532zm-5.394.032a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zM.854 15.5a.5.5 0 0 0-.854.354v2.293a.5.5 0 0 0 .5.5h2.293c.222 0 .39-.135.462-.309a.493.493 0 0 0-.109-.545L.854 15.501zM5 14.647.854 10.5a.5.5 0 0 0-.854.353v2.586a.5.5 0 0 0 .146.353L4.854 18.5l.146.147h2.793a.5.5 0 0 0 .353-.854L5 14.647z" />
    </svg>
)

const DiscordIcon = () => (
    <svg viewBox="0 0 24 24" fill="#5865F2" className="w-5 h-5">
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
)

export const ProfileConnectionsSettings: React.FC<ProfileConnectionsSettingsProps> = ({
    isGithubConnected,
    onConnectGithub,
    isVercelConnected,
    isSupabaseConnected,
    isNotionConnected,
    onConnectVercel,
    onConnectSupabase,
    onConnectNotion,
}) => {
    const connectionsList = [
        {
            id: 'github' as const,
            name: 'GitHub',
            description:
                'Connect your GitHub account to import repositories and track code changes.',
            Icon: GithubIcon,
            iconColor: '#D6D5C9',
            isConnected: isGithubConnected,
            onConnect: onConnectGithub,
        },
        {
            id: 'vercel' as const,
            name: 'Vercel',
            description: 'Deploy and manage your projects directly from december.',
            Icon: VercelIcon,
            iconColor: '#D6D5C9',
            isConnected: isVercelConnected,
            onConnect: onConnectVercel,
        },
        {
            id: 'supabase' as const,
            name: 'Supabase',
            description:
                'Connect your Supabase project to introspect schemas, inspect RLS policies, and generate migrations.',
            Icon: SupabaseIcon,
            iconColor: '#D6D5C9',
            isConnected: isSupabaseConnected,
            onConnect: onConnectSupabase,
        },
        {
            id: 'notion' as const,
            name: 'Notion',
            description: 'Pull in pages and databases from Notion as project context.',
            Icon: NotionIcon,
            iconColor: '#D6D5C9',
            isConnected: isNotionConnected,
            onConnect: onConnectNotion,
        },
        {
            id: 'linear' as const,
            name: 'Linear',
            description:
                'Import issues and specs directly into agent sessions and auto-sync resolution status.',
            Icon: LinearIcon,
            iconColor: '#D6D5C9',
            isConnected: false,
            onConnect: undefined,
        },
        {
            id: 'figma' as const,
            name: 'Figma',
            description:
                'Import styles, components, and design tokens directly from your Figma files.',
            Icon: FigmaIcon,
            iconColor: '#D6D5C9',
            isConnected: false,
            onConnect: undefined,
        },
        {
            id: 'sentry' as const,
            name: 'Sentry',
            description:
                'Pull production stack traces and error logs to automatically reproduce and fix bugs.',
            Icon: SentryIcon,
            iconColor: '#D6D5C9',
            isConnected: false,
            onConnect: undefined,
        },
        {
            id: 'neon' as const,
            name: 'Neon',
            description:
                'Connect serverless Postgres to inspect schemas and create instant database branches.',
            Icon: NeonIcon,
            iconColor: '#D6D5C9',
            isConnected: false,
            onConnect: undefined,
        },
        {
            id: 'cloudflare' as const,
            name: 'Cloudflare',
            description:
                'Deploy Workers and Pages, manage environment bindings, and inspect D1 databases.',
            Icon: CloudflareIcon,
            iconColor: '#D6D5C9',
            isConnected: false,
            onConnect: undefined,
        },
        {
            id: 'upstash' as const,
            name: 'Upstash',
            description:
                'Connect serverless Redis, rate limiters, and QStash background messaging.',
            Icon: UpstashIcon,
            iconColor: '#D6D5C9',
            isConnected: false,
            onConnect: undefined,
        },
        {
            id: 'railway' as const,
            name: 'Railway',
            description:
                'Deploy backend services, manage Docker containers, and provision cloud infrastructure.',
            Icon: RailwayIcon,
            iconColor: '#D6D5C9',
            isConnected: false,
            onConnect: undefined,
        },
        {
            id: 'posthog' as const,
            name: 'PostHog',
            description:
                'Manage feature flags, track event schemas, and inspect analytics definitions.',
            Icon: PostHogIcon,
            iconColor: '#D6D5C9',
            isConnected: false,
            onConnect: undefined,
        },
        {
            id: 'slack' as const,
            name: 'Slack',
            description:
                'Send agent activity alerts, PR status updates, and build summaries to your Slack channels.',
            Icon: SlackIcon,
            iconColor: '#D6D5C9',
            isConnected: false,
            onConnect: undefined,
        },
        {
            id: 'discord' as const,
            name: 'Discord',
            description:
                'Broadcast session progress, test runs, and deployment alerts to Discord channels.',
            Icon: DiscordIcon,
            iconColor: '#D6D5C9',
            isConnected: false,
            onConnect: undefined,
        },
    ]

    return (
        <div className="flex flex-col w-full max-w-[800px] text-[#D6D5C9]">
            {/* Connections Section */}
            <div className="flex flex-col mb-0">
                <h1 className="text-[16px] font-medium mb-3">Connections</h1>
                <div className="flex flex-col border-t border-[#242323] pt-4 gap-4">
                    <p className="text-[13px] text-[#7B7A79]">
                        Connect third-party accounts and services to deploy apps, manage databases,
                        and automate workflows.
                    </p>
                    <div className="flex flex-col sm:gap-5 pt-1">
                        {connectionsList.map(
                            ({
                                id,
                                name,
                                description,
                                Icon,
                                iconColor,
                                isConnected,
                                onConnect,
                            }) => {
                                const isUnavailable = !onConnect
                                return (
                                    <div
                                        key={id}
                                        className="flex items-center justify-between gap-3 sm:gap-4 py-3.5 sm:py-0 border-b border-[#242323]/50 sm:border-none last:border-b-0"
                                    >
                                        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                                            <div
                                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#191919] border border-[#383736] flex items-center justify-center shrink-0"
                                                style={{ color: iconColor }}
                                            >
                                                <Icon />
                                            </div>
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <span className="text-[14px] font-medium text-[#D6D5C9] truncate">
                                                    {name}
                                                </span>
                                                <span className="text-[12px] sm:text-[12.5px] text-[#7B7A79] sm:max-w-[380px] leading-relaxed line-clamp-1 sm:line-clamp-none">
                                                    {description}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={onConnect}
                                            disabled={isConnected || isUnavailable}
                                            className={`px-3 sm:px-4 py-1.5 rounded-lg border text-[12px] sm:text-[13px] font-medium transition-all shrink-0 text-center cursor-pointer ${
                                                isConnected
                                                    ? 'border-[#383736] bg-[#191919] text-[#6A6968] cursor-default'
                                                    : isUnavailable
                                                      ? 'border-[#2B2A29] text-[#4A4948] cursor-not-allowed'
                                                      : 'border-[#383736] text-[#D6D5C9] hover:bg-[#191919] active:bg-[#202020]'
                                            }`}
                                        >
                                            {isConnected
                                                ? 'Connected'
                                                : isUnavailable
                                                  ? 'Soon'
                                                  : 'Connect'}
                                        </button>
                                    </div>
                                )
                            }
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
