export const PREVIEW_HTML = `
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); }
        
        /* Visual Edit Mode Styles */
        .visual-mode { cursor: default; }
        .hover-highlight { 
            outline: 2px solid rgba(255, 255, 255, 0.2) !important; 
            background-color: rgba(255, 255, 255, 0.05) !important;
            cursor: pointer !important;
            transition: all 0.2s ease;
        }
        .selected-highlight { 
            outline: 2px solid #ffffff !important; 
            box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.1);
            z-index: 50; 
            position: relative;
        }
    </style>
    <script>
        let isEditMode = false;
        let selectedEl = null;

        window.addEventListener('message', (event) => {
            if (event.data.type === 'toggle-visual-mode') {
                isEditMode = event.data.isActive;
                if (isEditMode) {
                    document.body.classList.add('visual-mode');
                } else {
                    document.body.classList.remove('visual-mode');
                    if (selectedEl) {
                        selectedEl.classList.remove('selected-highlight');
                        selectedEl = null;
                    }
                    window.parent.postMessage({ type: 'selection-cleared' }, '*');
                }
            }
            if (event.data.type === 'apply-changes') {
                 if (selectedEl) {
                     // Simple visual feedback of update
                     selectedEl.style.transition = 'filter 0.3s';
                     selectedEl.style.filter = 'brightness(1.5)';
                     setTimeout(() => selectedEl.style.filter = '', 300);
                 }
            }
        });

        document.addEventListener('mouseover', (e) => {
            if (!isEditMode) return;
            e.stopPropagation();
            e.target.classList.add('hover-highlight');
        });

        document.addEventListener('mouseout', (e) => {
            if (!isEditMode) return;
            e.stopPropagation();
            e.target.classList.remove('hover-highlight');
        });

        document.addEventListener('click', (e) => {
            if (!isEditMode) return;
            e.preventDefault();
            e.stopPropagation();

            if (selectedEl) selectedEl.classList.remove('selected-highlight');
            selectedEl = e.target;
            selectedEl.classList.add('selected-highlight');

            window.parent.postMessage({
                type: 'element-selected',
                tagName: selectedEl.tagName.toLowerCase(),
                textContent: selectedEl.innerText.substring(0, 50)
            }, '*');
        });
    </script>
</head>
<body class="bg-black text-white antialiased selection:bg-purple-500/30">
    <div class="min-h-screen flex flex-col relative overflow-hidden">
        
        <!-- Background Gradients -->
        <div class="absolute top-0 left-0 w-full h-[500px] bg-purple-900/20 blur-[100px] pointer-events-none"></div>
        <div class="absolute bottom-0 right-0 w-full h-[500px] bg-blue-900/10 blur-[100px] pointer-events-none"></div>

        <!-- Navbar -->
        <nav class="relative z-50 border-b border-white/10">
            <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                <div class="text-xl font-bold tracking-tight">Acme<span class="text-purple-400">.ai</span></div>
                <div class="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                    <a href="#" class="hover:text-white transition-colors">Product</a>
                    <a href="#" class="hover:text-white transition-colors">Solutions</a>
                    <a href="#" class="hover:text-white transition-colors">Pricing</a>
                    <a href="#" class="hover:text-white transition-colors">Docs</a>
                </div>
                <div class="flex items-center gap-4">
                    <a href="#" class="text-sm font-medium text-white hover:text-gray-300">Login</a>
                    <a href="#" class="text-sm font-medium bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">Start Free</a>
                </div>
            </div>
        </nav>

        <!-- Hero -->
        <main class="flex-1 relative z-10 flex flex-col items-center justify-center pt-20 pb-32 px-6 text-center">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-purple-300 mb-8 hover:bg-white/10 transition-colors cursor-pointer">
                <span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                v2.0 is now live
            </div>
            
            <h1 class="text-5xl md:text-7xl font-bold tracking-tight mb-8 max-w-4xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                Scale your infrastructure <br/> without the headache.
            </h1>
            
            <p class="text-lg md:text-xl text-gray-400 max-w-2xl mb-12 leading-relaxed">
                Deploy, manage, and scale your applications with a single command. 
                Built for developers who want to ship faster.
            </p>
            
            <div class="flex flex-col sm:flex-row items-center gap-4">
                <button class="w-full sm:w-auto px-8 py-4 bg-white text-black rounded-xl font-semibold hover:bg-gray-200 transition-transform hover:scale-105 active:scale-95 duration-200">
                    Start Building
                </button>
                <button class="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl font-semibold hover:bg-white/10 transition-all flex items-center justify-center gap-2 group">
                    <span>Read Documentation</span>
                    <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
            </div>

            <!-- Metric Grid -->
            <div class="mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-12 w-full max-w-5xl border-t border-white/10 pt-12">
                <div class="text-center">
                    <div class="text-3xl font-bold text-white mb-1">99.9%</div>
                    <div class="text-sm text-gray-500">Uptime</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-white mb-1">50ms</div>
                    <div class="text-sm text-gray-500">Latency</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-white mb-1">10k+</div>
                    <div class="text-sm text-gray-500">Developers</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-white mb-1">24/7</div>
                    <div class="text-sm text-gray-500">Support</div>
                </div>
            </div>
        </main>
    </div>
</body>
</html>
`
