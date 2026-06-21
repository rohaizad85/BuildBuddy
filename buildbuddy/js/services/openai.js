// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\services\openai.js

import CONFIG from '../../config/config.js';

class OpenAIService {
    constructor() {
        this.pollinationsUrl = 'https://text.pollinations.ai/';
        this.pollinationsTimeout = 5000;
        this.lastApiCall = 0;
        this.minApiInterval = 5000;
        this.localBackendUrl = 'http://localhost:3000/api/gemini-chat';
        this.openaiApiKey = CONFIG.openai?.apiKey;
        this.openaiApiUrl = CONFIG.openai?.apiUrl;
        this.useOpenAI = false;
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000;
        this.useLocalPrimary = true;
        this.usedPartIds = new Set();
        this.lastBuildParts = [];
    }

    async getInventory() {
        if (window.inventoryData && window.inventoryData.length > 0) {
            return window.inventoryData;
        }

        try {
            const supabase = window.supabase;
            if (!supabase) return [];

            const { data, error } = await supabase
                .from('inventory')
                .select('*')
                .order('i_name');

            if (error || !data) return [];

            window.inventoryData = data;
            return data;
        } catch (error) {
            return [];
        }
    }

    // ============================================
    // ENHANCED TOAST NOTIFICATION
    // ============================================
    showToast(message, type = 'info', title = null) {
        // Create container if it doesn't exist
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Colors and icons for each type
        const config = {
            success: {
                icon: 'fa-check-circle',
                color: '#4CAF50',
                bgGradient: 'linear-gradient(135deg, #4CAF50, #43A047)',
                title: '✅ Success'
            },
            error: {
                icon: 'fa-times-circle',
                color: '#f44336',
                bgGradient: 'linear-gradient(135deg, #f44336, #d32f2f)',
                title: '❌ Error'
            },
            warning: {
                icon: 'fa-exclamation-triangle',
                color: '#ff9800',
                bgGradient: 'linear-gradient(135deg, #ff9800, #f57c00)',
                title: '⚠️ Warning'
            },
            info: {
                icon: 'fa-info-circle',
                color: '#00d4ff',
                bgGradient: 'linear-gradient(135deg, #00d4ff, #0099cc)',
                title: 'ℹ️ Info'
            }
        };

        const cfg = config[type] || config.info;
        const toastTitle = title || cfg.title;

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            padding: 16px 20px;
            border-radius: 14px;
            color: #1a1a2e;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
            animation: toastSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            display: flex;
            align-items: center;
            gap: 14px;
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            min-width: 280px;
            max-width: 420px;
            width: 100%;
            background: ${cfg.bgGradient};
            color: white;
            margin-bottom: 8px;
            transition: all 0.3s ease;
        `;

        toast.innerHTML = `
            <div class="toast-icon" style="
                font-size: 22px;
                flex-shrink: 0;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255, 255, 255, 0.2);
            ">
                <i class="fas ${cfg.icon}"></i>
            </div>
            <div class="toast-content" style="
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;
            ">
                <div class="toast-title" style="
                    font-weight: 700;
                    font-size: 14px;
                    color: inherit;
                    letter-spacing: 0.3px;
                ">${toastTitle}</div>
                <div class="toast-message" style="
                    font-weight: 400;
                    font-size: 13px;
                    opacity: 0.9;
                    line-height: 1.4;
                    word-wrap: break-word;
                ">${message}</div>
            </div>
            <button class="toast-close" style="
                background: none;
                border: none;
                color: inherit;
                opacity: 0.6;
                cursor: pointer;
                font-size: 16px;
                padding: 4px 8px;
                border-radius: 6px;
                transition: all 0.2s;
                flex-shrink: 0;
            " onclick="this.closest('.toast').remove()">
                <i class="fas fa-times"></i>
            </button>
            <div class="toast-progress" style="
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.4);
                border-radius: 0 0 14px 14px;
                animation: toastProgress 4s linear forwards;
                width: 100%;
            "></div>
        `;

        // Add hover effect
        toast.addEventListener('mouseenter', () => {
            toast.style.transform = 'translateX(-4px)';
            toast.style.boxShadow = '0 12px 48px rgba(0, 0, 0, 0.2)';
        });

        toast.addEventListener('mouseleave', () => {
            toast.style.transform = 'translateX(0)';
            toast.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15)';
        });

        container.appendChild(toast);

        // Auto remove after 4 seconds
        const autoRemove = setTimeout(() => {
            toast.classList.add('removing');
            toast.style.cssText += `
                animation: toastSlideOut 0.3s ease forwards;
            `;
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 4000);

        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                clearTimeout(autoRemove);
                toast.classList.add('removing');
                toast.style.cssText += `
                    animation: toastSlideOut 0.3s ease forwards;
                `;
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.remove();
                    }
                }, 300);
            });
        }
    }

    buildInventoryContext(inventory) {
        const categories = {};
        inventory.forEach(p => {
            if (!categories[p.i_category]) {
                categories[p.i_category] = [];
            }
            categories[p.i_category].push(p);
        });

        let context = `Inventory Summary:\n`;
        for (const [category, parts] of Object.entries(categories)) {
            const count = parts.length;
            const prices = parts.map(p => p.i_price);
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            context += `- ${category.toUpperCase()}: ${count} parts, RM ${min} - RM ${max}\n`;

            const sorted = [...parts].sort((a, b) => a.i_price - b.i_price);
            const top3 = sorted.slice(0, 3);
            context += `  • ${top3.map(p => `${p.i_name} (RM ${p.i_price})`).join('\n  • ')}\n`;
        }
        context += `\nTotal Parts: ${inventory.length}\n`;
        return context;
    }

    async sendMessage(message, context = '', history = []) {
        const cacheKey = `${message}_${context.substring(0, 50)}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.response;
            }
            this.cache.delete(cacheKey);
        }

        const inventory = await this.getInventory();

        if (!inventory || inventory.length === 0) {
            return '📦 No inventory data available. Please refresh the page to load parts.';
        }

        const inventoryContext = this.buildInventoryContext(inventory);
        const fullContext = `You are a PC building assistant. ${context}\n\n${inventoryContext}\n\nUser message: ${message}`;

        try {
            const now = Date.now();
            if (now - this.lastApiCall >= this.minApiInterval) {
                const response = await this.callPollinations(message, fullContext, history);
                if (response && response.length > 10) {
                    this.lastApiCall = Date.now();
                    this.cache.set(cacheKey, { response, timestamp: Date.now() });
                    return response;
                }
            }
        } catch (error) { }

        try {
            const response = await this.callLocalBackend(message, fullContext, history);
            if (response && response.length > 10) {
                this.cache.set(cacheKey, { response, timestamp: Date.now() });
                return response;
            }
        } catch (error) { }

        const fallback = this.getLocalResponse(message, inventory);
        this.cache.set(cacheKey, { response: fallback, timestamp: Date.now() });
        return fallback;
    }

    getLocalResponse(message, inventory) {
        const msg = message.toLowerCase();
        const budgetMatch = msg.match(/rm\s*(\d{3,5})/i) || msg.match(/(\d{3,5})\s*(?:rm|budget)/i) || msg.match(/(\d{3,5})/);
        const budget = budgetMatch ? parseInt(budgetMatch[1]) : null;

        if (msg.includes('build') || msg.includes('recommend') || msg.includes('suggest')) {
            return this.getBuildRecommendation(budget, inventory);
        }

        if (msg.includes('cpu') || msg.includes('processor')) {
            return this.getCategoryList('cpu', budget, inventory);
        }
        if (msg.includes('gpu') || msg.includes('graphics')) {
            return this.getCategoryList('gpu', budget, inventory);
        }
        if (msg.includes('ram') || msg.includes('memory')) {
            return this.getCategoryList('ram', budget, inventory);
        }
        if (msg.includes('motherboard') || msg.includes('mobo')) {
            return this.getCategoryList('motherboard', budget, inventory);
        }
        if (msg.includes('storage') || msg.includes('ssd')) {
            return this.getCategoryList('storage', budget, inventory);
        }
        if (msg.includes('psu') || msg.includes('power supply')) {
            return this.getCategoryList('psu', budget, inventory);
        }

        return this.getDefaultResponse(inventory);
    }

    getDefaultResponse(inventory) {
        const categories = [...new Set(inventory.map(p => p.i_category))];
        return `I can help you with PC builds!\n\nAvailable categories:\n• ${categories.join('\n• ')}\n\nTotal parts: ${inventory.length}\n\nTry asking:\n• Build a PC under RM 3000\n• Show me CPUs under RM 500\n• What GPU should I get?`;
    }

    getCategoryList(category, budget, inventory) {
        const parts = inventory
            .filter(p => p.i_category === category && p.i_quantity > 0)
            .sort((a, b) => a.i_price - b.i_price);

        if (parts.length === 0) {
            return `No ${category.toUpperCase()} parts available.`;
        }

        let response = `${category.toUpperCase()} Parts (${parts.length} available)\n\n`;

        let filteredParts = parts;
        if (budget) {
            filteredParts = parts.filter(p => p.i_price <= budget);
            if (filteredParts.length === 0) {
                response += `No ${category} under RM ${budget}.\n`;
                response += `Cheapest: ${parts[0].i_name} - RM ${parts[0].i_price}\n`;
                return response;
            }
        }

        const topParts = filteredParts.slice(0, 5);
        topParts.forEach((part) => {
            response += `• ${part.i_name}\n`;
            response += `  Price: RM ${part.i_price} | Stock: ${part.i_quantity}\n`;
            response += `  Brand: ${part.i_brand || 'Generic'}\n\n`;
        });

        return response;
    }

    getBuildRecommendation(budget, inventory) {
        const requestedBudget = budget || 3500;
        const categories = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu'];
        const build = {};
        const partsList = [];
        let totalPrice = 0;

        for (const cat of categories) {
            const parts = inventory
                .filter(p => p.i_category === cat && p.i_quantity > 0)
                .sort((a, b) => a.i_price - b.i_price);

            if (parts.length === 0) continue;

            const factorMap = { 'gpu': 0.40, 'cpu': 0.25, 'motherboard': 0.12, 'ram': 0.10, 'storage': 0.08, 'psu': 0.05 };
            const factor = factorMap[cat] || 0.10;
            let catBudget = Math.min(requestedBudget * factor, 2000);

            const minBudgetMap = { 'cpu': 300, 'motherboard': 200, 'ram': 150, 'psu': 150 };
            catBudget = Math.max(catBudget, minBudgetMap[cat] || 100);

            let selectedPart = null;
            for (const part of parts) {
                if (part.i_price <= catBudget) {
                    selectedPart = part;
                    break;
                }
            }

            if (!selectedPart && parts.length > 0) {
                selectedPart = parts[0];
            }

            if (selectedPart) {
                build[cat] = selectedPart;
                totalPrice += parseFloat(selectedPart.i_price);
                partsList.push({
                    id: selectedPart.i_id,
                    name: selectedPart.i_name,
                    price: selectedPart.i_price,
                    category: cat
                });
            }
        }

        let response = `💻 Recommended Build\n`;
        response += `💰 Budget: RM ${requestedBudget}\n`;
        response += `📦 Total: RM ${totalPrice.toFixed(2)}\n\n`;
        response += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        const categoryOrder = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu'];
        for (const cat of categoryOrder) {
            if (build[cat]) {
                const part = build[cat];
                response += `• ${part.i_name}\n`;
                response += `  ${cat.toUpperCase()} | ${part.i_brand || 'Generic'}\n`;
                response += `  Price: RM ${part.i_price}\n\n`;
            }
        }

        const remaining = requestedBudget - totalPrice;
        if (remaining >= 0) {
            response += `💰 Remaining: RM ${remaining.toFixed(2)}\n`;
        }

        response += `\n💡 Say "different parts" for alternatives.\n\n`;
        response += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        window._pendingBuildParts = partsList;

        window._showAddToCartPopup = () => {
            const parts = window._pendingBuildParts;
            if (!parts || parts.length === 0) {
                this.showToast('No parts to add to cart.', 'warning', '⚠️ Empty Build');
                return;
            }

            let message = 'Add these parts to your build and cart?\n\n';
            parts.forEach((p, i) => {
                message += `• ${p.name} - RM ${p.price}\n`;
            });
            message += `\nTotal: RM ${parts.reduce((sum, p) => sum + p.price, 0).toFixed(2)}`;
            message += `\n(Total ${parts.length} parts)`;

            if (confirm(message)) {
                window._addPartsToBuildAndCart(parts);
            }
        };

        window._addPartsToBuildAndCart = async (parts) => {
            let addedToBuild = 0;
            let addedToCart = 0;
            let failedParts = [];

            // Show loading toast
            const loadingToast = document.createElement('div');
            loadingToast.className = 'toast toast-info';
            loadingToast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-spinner fa-spin"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">⏳ Processing</div>
            <div class="toast-message">Adding ${parts.length} parts to your build...</div>
        </div>
        <div class="toast-progress"></div>
    `;

            let container = document.querySelector('.toast-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'toast-container';
                document.body.appendChild(container);
            }
            container.appendChild(loadingToast);

            for (const part of parts) {
                try {
                    if (typeof window.selectForBuild === 'function') {
                        await window.selectForBuild(part.id);
                        addedToBuild++;
                    }

                    if (typeof window.addToCart === 'function') {
                        await window.addToCart(part.id);
                        addedToCart++;
                    }
                } catch (e) {
                    failedParts.push(part.name);
                }
            }

            // Remove loading toast
            if (loadingToast.parentNode) {
                loadingToast.classList.add('removing');
                setTimeout(() => {
                    if (loadingToast.parentNode) {
                        loadingToast.remove();
                    }
                }, 300);
            }

            // Show result toast
            setTimeout(() => {
                if (addedToBuild > 0 && addedToCart > 0) {
                    const toast = document.createElement('div');
                    toast.className = 'toast toast-success';
                    toast.innerHTML = `
                <div class="toast-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="toast-content">
                    <div class="toast-title">🎉 Build Added!</div>
                    <div class="toast-message">Added ${addedToBuild} parts to build & ${addedToCart} parts to cart!</div>
                </div>
                <button class="toast-close" onclick="this.closest('.toast').remove()">
                    <i class="fas fa-times"></i>
                </button>
                <div class="toast-progress"></div>
            `;
                    container.appendChild(toast);

                    setTimeout(() => {
                        toast.classList.add('removing');
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.remove();
                            }
                        }, 300);
                    }, 4000);
                } else if (addedToBuild > 0) {
                    const toast = document.createElement('div');
                    toast.className = 'toast toast-warning';
                    toast.innerHTML = `
                <div class="toast-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="toast-content">
                    <div class="toast-title">⚠️ Partial Success</div>
                    <div class="toast-message">Added ${addedToBuild} parts to build, but cart failed.</div>
                </div>
                <button class="toast-close" onclick="this.closest('.toast').remove()">
                    <i class="fas fa-times"></i>
                </button>
                <div class="toast-progress"></div>
            `;
                    container.appendChild(toast);

                    setTimeout(() => {
                        toast.classList.add('removing');
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.remove();
                            }
                        }, 300);
                    }, 4000);
                } else if (addedToCart > 0) {
                    const toast = document.createElement('div');
                    toast.className = 'toast toast-warning';
                    toast.innerHTML = `
                <div class="toast-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="toast-content">
                    <div class="toast-title">⚠️ Partial Success</div>
                    <div class="toast-message">Added ${addedToCart} parts to cart, but build failed.</div>
                </div>
                <button class="toast-close" onclick="this.closest('.toast').remove()">
                    <i class="fas fa-times"></i>
                </button>
                <div class="toast-progress"></div>
            `;
                    container.appendChild(toast);

                    setTimeout(() => {
                        toast.classList.add('removing');
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.remove();
                            }
                        }, 300);
                    }, 4000);
                } else {
                    const toast = document.createElement('div');
                    toast.className = 'toast toast-error';
                    toast.innerHTML = `
                <div class="toast-icon">
                    <i class="fas fa-times-circle"></i>
                </div>
                <div class="toast-content">
                    <div class="toast-title">❌ Error</div>
                    <div class="toast-message">Failed to add parts. Please try again.</div>
                </div>
                <button class="toast-close" onclick="this.closest('.toast').remove()">
                    <i class="fas fa-times"></i>
                </button>
                <div class="toast-progress"></div>
            `;
                    container.appendChild(toast);

                    setTimeout(() => {
                        toast.classList.add('removing');
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.remove();
                            }
                        }, 300);
                    }, 4000);
                }

                // Show failed parts if any
                if (failedParts.length > 0) {
                    setTimeout(() => {
                        const toast = document.createElement('div');
                        toast.className = 'toast toast-warning';
                        toast.innerHTML = `
                    <div class="toast-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="toast-content">
                        <div class="toast-title">⚠️ Some Parts Failed</div>
                        <div class="toast-message">Failed: ${failedParts.join(', ')}</div>
                    </div>
                    <button class="toast-close" onclick="this.closest('.toast').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="toast-progress"></div>
                `;
                        container.appendChild(toast);

                        setTimeout(() => {
                            toast.classList.add('removing');
                            setTimeout(() => {
                                if (toast.parentNode) {
                                    toast.remove();
                                }
                            }, 300);
                        }, 4000);
                    }, 1000);
                }
            }, 500);

            // Update UI
            if (typeof window.update3DViewer === 'function') {
                setTimeout(() => window.update3DViewer(), 300);
            }
            if (typeof window.updateCartCountDisplay === 'function') {
                await window.updateCartCountDisplay();
            }
            if (typeof window.renderProducts === 'function') {
                window.renderProducts('all');
            }
        };

        const uniqueId = Date.now();
        const btnId = `addToCartBtn_${uniqueId}`;

        response += `[ Add All Parts to Build & Cart ]`;
        response = response.replace(
            '[ Add All Parts to Build & Cart ]',
            `<button id="${btnId}" style="padding: 12px 24px; background: #00d4ff; color: #1a1a2e; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 10px; transition: all 0.3s ease; font-size: 14px;">
                🛒 Add All Parts to Build & Cart
            </button>`
        );

        setTimeout(() => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (typeof window._showAddToCartPopup === 'function') {
                        window._showAddToCartPopup();
                    }
                });
            }
        }, 100);

        return response;
    }

    async callPollinations(message, context, history) {
        let fullPrompt = `You are a PC building assistant. Give helpful, natural responses about PC parts and builds. Use bullet points with • for lists. Keep formatting clean and readable.\n\n${context}`;

        try {
            const url = `${this.pollinationsUrl}${encodeURIComponent(fullPrompt)}?seed=${Date.now()}&model=openai`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.pollinationsTimeout);

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'text/plain' },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.status === 429 || !response.ok) return null;

            let text = await response.text();
            text = text.trim();
            text = text.replace(/```[\s\S]*?```/g, '').trim();

            return text.length > 10 ? text : null;
        } catch (error) {
            return null;
        }
    }

    async callLocalBackend(message, context, history) {
        try {
            const response = await fetch(this.localBackendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    context: context,
                    history: history.slice(-10)
                })
            });

            if (!response.ok) return null;
            const data = await response.json();
            return data.response || data.message || data.text || null;
        } catch (error) {
            return null;
        }
    }
}

const openaiService = new OpenAIService();

window.addEventListener('inventoryReady', (e) => {
    console.log('📦 Inventory ready, chatbot updated with', e.detail.inventory.length, 'parts');
});

export default openaiService;