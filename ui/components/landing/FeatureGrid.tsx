import React from 'react';
import { FeatureCard } from './features/FeatureCard';
import { ContextCanvasVisual } from './features/ContextCanvasVisual';
import { RepoSyncVisual } from './features/RepoSyncVisual';
import { IntegrationsVisual } from './features/IntegrationsVisual';
import { DeployVisual } from './features/DeployVisual';

export const FeatureGrid = () => {
    return (
        <section className="w-full max-w-[1400px] mx-auto px-6 py-24">
            <div className="mb-20">
                 <h2 className="text-4xl md:text-6xl font-display font-bold text-white tracking-tighter leading-[0.9]">
                    Prompt.<br />
                    <span className="text-neutral-600">Build. Publish.</span>
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-[minmax(200px,auto)]">
                
                {/* 1. Context Canvas (Large) */}
                <FeatureCard 
                    title="Context Canvas"
                    description="A real-time, spatial playground for organizing thoughts, screenshots, and requirements."
                    className="md:col-span-2 lg:col-span-2 row-span-2 min-h-[500px]"
                >
                     <ContextCanvasVisual />
                </FeatureCard>

                {/* 2. Sync with Repo - Terminal Style */}
                <FeatureCard 
                    title="Sync with Repo"
                    description="Push changes directly to your branch."
                    className="md:col-span-1 lg:col-span-2 min-h-[300px]"
                >
                    <RepoSyncVisual />
                </FeatureCard>

                {/* 3. Integration */}
                <FeatureCard 
                    title="Integrations"
                    description="Connect your favorite tools."
                    className="md:col-span-1 min-h-[280px]"
                >
                    <IntegrationsVisual />
                </FeatureCard>

                {/* 4. Deploy */}
                <FeatureCard 
                    title="Deploy"
                    description="Instant edge deployment."
                    className="md:col-span-1 min-h-[280px]"
                >
                     <DeployVisual />
                </FeatureCard>

            </div>
        </section>
    );
};