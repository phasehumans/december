export const PREVIEW_HTML = `
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        body { font-family: 'Inter', sans-serif; }
        /* Hide Scrollbar */
        ::-webkit-scrollbar { display: none; }
        body { -ms-overflow-style: none; scrollbar-width: none; }
        
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
<body class="bg-white text-neutral-900 antialiased selection:bg-emerald-500/30 h-screen flex items-center justify-center">
    
    <div class="w-full max-w-md p-6">
        <div class="mb-8">
            <h1 class="text-3xl font-bold tracking-tight mb-2 text-black">Tasks</h1>
            <p class="text-neutral-500">Stay organized and focused.</p>
        </div>

        <!-- Input -->
        <div class="relative mb-8 group">
            <input type="text" placeholder="Add a new task..." class="w-full bg-white border border-neutral-200 rounded-2xl py-4 pl-5 pr-12 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-neutral-400 shadow-sm hover:border-neutral-300">
            <button class="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black text-white rounded-xl hover:bg-neutral-800 transition-colors shadow-sm">
                <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
        </div>

        <!-- Filters -->
        <div class="flex gap-2 mb-6">
            <button class="px-4 py-1.5 rounded-full bg-black text-white text-xs font-medium shadow-sm">All</button>
            <button class="px-4 py-1.5 rounded-full bg-white text-neutral-500 hover:text-black border border-neutral-200 hover:border-neutral-300 transition-all text-xs font-medium">Active</button>
            <button class="px-4 py-1.5 rounded-full bg-white text-neutral-500 hover:text-black border border-neutral-200 hover:border-neutral-300 transition-all text-xs font-medium">Completed</button>
        </div>

        <!-- Task List -->
        <div class="space-y-3">
            <!-- Task 1 -->
            <div class="group flex items-center gap-3 p-4 bg-white border border-neutral-200 rounded-2xl hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer">
                <div class="w-5 h-5 rounded-full border-2 border-neutral-300 group-hover:border-emerald-500 transition-colors flex items-center justify-center"></div>
                <span class="text-sm font-medium text-neutral-700 group-hover:text-black transition-colors">Review design system updates</span>
            </div>

            <!-- Task 2 -->
            <div class="group flex items-center gap-3 p-4 bg-neutral-50 border border-neutral-100 rounded-2xl transition-all cursor-pointer">
                <div class="w-5 h-5 rounded-full border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center">
                    <i data-lucide="check" class="w-3 h-3 text-white"></i>
                </div>
                <span class="text-sm font-medium text-neutral-400 line-through">Deploy v2.0 to production</span>
            </div>

            <!-- Task 3 -->
            <div class="group flex items-center gap-3 p-4 bg-white border border-neutral-200 rounded-2xl hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer">
                <div class="w-5 h-5 rounded-full border-2 border-neutral-300 group-hover:border-emerald-500 transition-colors flex items-center justify-center"></div>
                <span class="text-sm font-medium text-neutral-700 group-hover:text-black transition-colors">Draft technical documentation</span>
            </div>
             <!-- Task 4 -->
            <div class="group flex items-center gap-3 p-4 bg-white border border-neutral-200 rounded-2xl hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer">
                <div class="w-5 h-5 rounded-full border-2 border-neutral-300 group-hover:border-emerald-500 transition-colors flex items-center justify-center"></div>
                <span class="text-sm font-medium text-neutral-700 group-hover:text-black transition-colors">Sync with product team</span>
            </div>
        </div>
    </div>

    <script>
        lucide.createIcons();
    </script>
</body>
</html>
`
