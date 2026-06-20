// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\services\openai.js

import CONFIG from '../../config/config.js';

class OpenAIService {
    constructor() {
        // ============================================
        // CONFIGURATION
        // ============================================
        
        // Pollinations (rate-limited, use sparingly)
        this.pollinationsUrl = 'https://text.pollinations.ai/';
        this.pollinationsTimeout = 3000;
        this.lastApiCall = 0;
        this.minApiInterval = 10000; // 10 seconds between API calls
        
        // Local Backend (if running)
        this.localBackendUrl = 'http://localhost:3000/api/gemini-chat';
        
        // OpenAI (optional)
        this.openaiApiKey = CONFIG.openai.apiKey;
        this.openaiApiUrl = CONFIG.openai.apiUrl;
        this.useOpenAI = false;
        
        // Response cache
        this.cache = new Map();
        this.cacheTTL = 10 * 60 * 1000; // 10 minutes
        
        // Inventory data cache
        this.inventoryCache = [];
        this.lastInventoryUpdate = 0;
        this.inventoryTTL = 60 * 1000; // 1 minute
        
        // Use local responses primarily
        this.useLocalPrimary = true;
    }

    /**
     * Get inventory data from global scope or fetch it
     */
    getInventory() {
        // Try to get from global scope first
        if (window.inventoryData && window.inventoryData.length > 0) {
            return window.inventoryData;
        }
        return [];
    }

    /**
     * Get inventory summary for AI context
     */
    getInventorySummary() {
        const inventory = this.getInventory();
        if (inventory.length === 0) {
            return 'No inventory data available.';
        }

        // Group by category
        const categories = {};
        inventory.forEach(p => {
            if (!categories[p.i_category]) {
                categories[p.i_category] = [];
            }
            categories[p.i_category].push(p);
        });

        let summary = `📦 **Available Inventory (${inventory.length} parts):**\n\n`;
        
        const categoryNames = {
            'cpu': '💻 CPUs',
            'motherboard': '🔌 Motherboards', 
            'ram': '🧠 RAM',
            'gpu': '🎮 GPUs',
            'storage': '💾 Storage',
            'psu': '⚡ Power Supplies',
            'cooler': '❄️ Coolers'
        };

        for (const [category, parts] of Object.entries(categories)) {
            const displayName = categoryNames[category] || category.toUpperCase();
            const cheapCount = parts.filter(p => p.i_price < 500).length;
            const midCount = parts.filter(p => p.i_price >= 500 && p.i_price < 1500).length;
            const highCount = parts.filter(p => p.i_price >= 1500).length;
            const avgPrice = parts.reduce((sum, p) => sum + parseFloat(p.i_price), 0) / parts.length;
            
            summary += `${displayName} (${parts.length} items)\n`;
            summary += `   • Price range: RM ${Math.min(...parts.map(p => p.i_price)).toFixed(0)} - RM ${Math.max(...parts.map(p => p.i_price)).toFixed(0)}\n`;
            summary += `   • Average: RM ${avgPrice.toFixed(0)}\n`;
            summary += `   • Stock levels: ${parts.filter(p => p.i_quantity > 5).length} high, ${parts.filter(p => p.i_quantity > 0 && p.i_quantity <= 5).length} low\n\n`;
        }

        // Add top parts summary
        summary += `**Top Parts by Category (Best Value):**\n`;
        for (const [category, parts] of Object.entries(categories)) {
            const sorted = parts.sort((a, b) => a.i_price - b.i_price);
            if (sorted.length > 0) {
                const best = sorted[0];
                summary += `• ${category.toUpperCase()}: ${best.i_name} - RM ${best.i_price}\n`;
            }
        }

        return summary;
    }

    /**
     * Main send message - with inventory awareness
     */
    async sendMessage(message, context = '', history = []) {
        // Check cache first
        const cacheKey = `${message}_${context.substring(0, 50)}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                console.log('📦 Using cached response');
                return cached.response;
            }
            this.cache.delete(cacheKey);
        }

        // Get inventory summary for context
        const inventorySummary = this.getInventorySummary();
        const fullContext = context + '\n\n' + inventorySummary;

        // For PC build questions, use enhanced local responses with inventory
        const isBuildQuestion = message.toLowerCase().includes('build') || 
                               message.toLowerCase().includes('parts') ||
                               message.toLowerCase().includes('compatible') ||
                               message.toLowerCase().includes('cpu') ||
                               message.toLowerCase().includes('gpu') ||
                               message.toLowerCase().includes('ram') ||
                               message.toLowerCase().includes('motherboard') ||
                               message.toLowerCase().includes('recommend') ||
                               message.toLowerCase().includes('suggest') ||
                               message.toLowerCase().includes('pick');

        if (isBuildQuestion) {
            console.log('🔄 Using inventory-aware response...');
            const inventoryResponse = this.getInventoryAwareResponse(message, fullContext);
            if (inventoryResponse) {
                this.cache.set(cacheKey, { response: inventoryResponse, timestamp: Date.now() });
                return inventoryResponse;
            }
        }

        // Try Pollinations with inventory context
        try {
            const now = Date.now();
            if (now - this.lastApiCall >= this.minApiInterval) {
                console.log('🔄 Trying Pollinations with inventory context...');
                const response = await this.callPollinations(message, fullContext, history);
                if (response && response.length > 10) {
                    console.log('✅ Pollinations responded');
                    this.lastApiCall = Date.now();
                    this.cache.set(cacheKey, { response, timestamp: Date.now() });
                    return response;
                }
            }
        } catch (error) {
            console.warn('⚠️ Pollinations failed:', error.message);
        }

        // Try Local Backend
        try {
            console.log('🔄 Trying Local Backend...');
            const response = await this.callLocalBackend(message, fullContext, history);
            if (response && response.length > 10) {
                console.log('✅ Local Backend responded');
                this.cache.set(cacheKey, { response, timestamp: Date.now() });
                return response;
            }
        } catch (error) {
            console.warn('⚠️ Local Backend failed:', error.message);
        }

        // Final fallback
        console.log('🔄 Using enhanced local fallback with inventory...');
        const fallback = this.getInventoryAwareResponse(message, fullContext);
        this.cache.set(cacheKey, { response: fallback, timestamp: Date.now() });
        return fallback;
    }

    // ============================================
    // INVENTORY-AWARE RESPONSES
    // ============================================
    
    getInventoryAwareResponse(message, context) {
        const msg = message.toLowerCase();
        const inventory = this.getInventory();
        
        if (inventory.length === 0) {
            return '📦 No inventory data available. Please refresh the page to load parts.';
        }

        // Extract budget from message
        const budgetMatch = msg.match(/rm\s*(\d{3,5})/i) || msg.match(/(\d{3,5})\s*(?:rm|budget)/i) || msg.match(/(\d{3,5})/);
        const budget = budgetMatch ? parseInt(budgetMatch[1]) : null;

        // Build request
        if (msg.includes('build') || msg.includes('recommend') || msg.includes('suggest') || msg.includes('pick')) {
            return this.getInventoryBuildRecommendation(budget, inventory);
        }
        
        // Category-specific requests
        if (msg.includes('cpu') || msg.includes('processor')) {
            return this.getInventoryCategoryRecommendation('cpu', budget, inventory, message);
        }
        if (msg.includes('gpu') || msg.includes('graphics')) {
            return this.getInventoryCategoryRecommendation('gpu', budget, inventory, message);
        }
        if (msg.includes('ram') || msg.includes('memory')) {
            return this.getInventoryCategoryRecommendation('ram', budget, inventory, message);
        }
        if (msg.includes('motherboard')) {
            return this.getInventoryCategoryRecommendation('motherboard', budget, inventory, message);
        }
        if (msg.includes('storage') || msg.includes('ssd') || msg.includes('hard drive')) {
            return this.getInventoryCategoryRecommendation('storage', budget, inventory, message);
        }
        if (msg.includes('psu') || msg.includes('power supply')) {
            return this.getInventoryCategoryRecommendation('psu', budget, inventory, message);
        }
        if (msg.includes('cooler')) {
            return this.getInventoryCategoryRecommendation('cooler', budget, inventory, message);
        }
        
        if (msg.includes('compatible') || msg.includes('check my build')) {
            return this.getCompatibilityCheck(message, context);
        }

        // Default response with inventory info
        return this.getDefaultInventoryResponse(message, inventory);
    }

    getInventoryCategoryRecommendation(category, budget, inventory, message) {
        const parts = inventory
            .filter(p => p.i_category === category && p.i_quantity > 0)
            .sort((a, b) => a.i_price - b.i_price);
        
        if (parts.length === 0) {
            return `❌ Sorry, no ${category.toUpperCase()} parts currently available in our inventory.`;
        }
        
        const emojis = {
            'cpu': '💻', 'motherboard': '🔌', 'ram': '🧠',
            'gpu': '🎮', 'storage': '💾', 'psu': '⚡', 'cooler': '❄️'
        };
        const emoji = emojis[category] || '📦';
        
        let response = `${emoji} **${category.toUpperCase()} Parts Available (${parts.length} items)**\n\n`;
        
        // Filter by budget if provided
        let filteredParts = parts;
        if (budget) {
            filteredParts = parts.filter(p => p.i_price <= budget);
            if (filteredParts.length === 0) {
                const cheapest = parts[0];
                response += `⚠️ No ${category} under RM ${budget}. The cheapest is:\n`;
                response += `• **${cheapest.i_name}** - RM ${cheapest.i_price} (${cheapest.i_brand || 'Generic'})\n`;
                response += `\n💡 *Would you like me to add this to your build?*`;
                return response;
            }
        }
        
        // Show top recommendations (max 4)
        const topParts = filteredParts.slice(0, 4);
        let totalPrice = 0;
        topParts.forEach((part, index) => {
            response += `${index + 1}. **${part.i_name}**\n`;
            response += `   💰 RM ${part.i_price} | 📦 ${part.i_quantity} in stock\n`;
            response += `   🏷️ ${part.i_brand || 'Generic'}\n`;
            
            // Add specs if available
            if (part.i_category === 'cpu' && part.i_cpu_cores) {
                response += `   🔧 ${part.i_cpu_cores} Cores`;
                if (part.i_cpu_clock_speed) response += `, ${part.i_cpu_clock_speed}`;
                response += '\n';
            }
            if (part.i_category === 'ram') {
                if (part.i_ram_speed) response += `   🔧 Speed: ${part.i_ram_speed}`;
                if (part.i_ram_type) response += `, Type: ${part.i_ram_type}`;
                if (part.i_ram_speed || part.i_ram_type) response += '\n';
            }
            if (part.i_category === 'gpu' && part.i_gpu_memory) {
                response += `   🔧 Memory: ${part.i_gpu_memory}\n`;
            }
            response += '\n';
            totalPrice += parseFloat(part.i_price);
        });
        
        if (budget) {
            response += `💰 **Total for these ${topParts.length} parts:** RM ${totalPrice.toFixed(2)} (within RM ${budget} budget)\n\n`;
        }
        
        response += `💡 *Would you like me to add any of these to your build?*`;
        return response;
    }

    getInventoryBuildRecommendation(budget, inventory) {
        if (!budget) budget = 3500;
        
        const categories = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu'];
        let remainingBudget = budget;
        const build = {};
        const selected = [];
        
        // Allocate budget to each category
        for (const cat of categories) {
            const parts = inventory
                .filter(p => p.i_category === cat && p.i_quantity > 0)
                .sort((a, b) => a.i_price - b.i_price);
            
            if (parts.length === 0) continue;
            
            // Budget allocation based on category importance
            let budgetForCategory = Math.min(remainingBudget * 0.35, 2000);
            if (cat === 'gpu') budgetForCategory = Math.min(remainingBudget * 0.45, 2500);
            if (cat === 'cpu') budgetForCategory = Math.min(remainingBudget * 0.30, 1800);
            
            // Find best part within budget
            let selectedPart = null;
            for (const part of parts) {
                if (part.i_price <= budgetForCategory) {
                    selectedPart = part;
                    break;
                }
            }
            
            // If no part fits, take the cheapest
            if (!selectedPart && parts.length > 0) {
                selectedPart = parts[0];
            }
            
            if (selectedPart) {
                build[cat] = selectedPart;
                remainingBudget -= parseFloat(selectedPart.i_price);
                selected.push(selectedPart);
            }
        }
        
        // Build the response
        const emojis = {
            'cpu': '💻', 'motherboard': '🔌', 'ram': '🧠',
            'gpu': '🎮', 'storage': '💾', 'psu': '⚡'
        };
        
        let totalPrice = 0;
        let response = `💻 **Recommended Build Under RM ${budget}**\n\n`;
        response += `📦 *Based on our current inventory (${inventory.length} parts)*\n\n`;
        
        const categoryOrder = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu'];
        let allPartsFound = true;
        
        for (const cat of categoryOrder) {
            if (build[cat]) {
                const part = build[cat];
                const emoji = emojis[cat] || '📦';
                response += `${emoji} **${part.i_name}**\n`;
                response += `   📂 ${cat.toUpperCase()} | 🏷️ ${part.i_brand || 'Generic'} | 💰 RM ${part.i_price}\n`;
                
                // Add specs
                if (cat === 'cpu' && part.i_cpu_cores) {
                    response += `   🔧 ${part.i_cpu_cores} Cores`;
                    if (part.i_cpu_clock_speed) response += `, ${part.i_cpu_clock_speed}`;
                    response += '\n';
                }
                if (cat === 'ram') {
                    if (part.i_ram_speed) response += `   🔧 ${part.i_ram_speed}`;
                    if (part.i_ram_type) response += `, ${part.i_ram_type}`;
                    if (part.i_ram_speed || part.i_ram_type) response += '\n';
                }
                if (cat === 'gpu' && part.i_gpu_memory) {
                    response += `   🔧 ${part.i_gpu_memory}\n`;
                }
                response += '\n';
                totalPrice += parseFloat(part.i_price);
            } else {
                allPartsFound = false;
            }
        }
        
        response += `**💰 Total Price:** RM ${totalPrice.toFixed(2)}\n`;
        response += `**💵 Remaining Budget:** RM ${(budget - totalPrice).toFixed(2)}\n\n`;
        
        // Check if build is complete
        const missing = categoryOrder.filter(cat => !build[cat]);
        if (missing.length > 0) {
            response += `⚠️ **Missing Parts:** ${missing.join(', ')}\n`;
            response += `💡 Consider increasing your budget or selecting these parts manually.\n\n`;
        } else {
            response += `✅ **Complete Build!** All essential parts selected.\n\n`;
        }
        
        response += `💡 *Would you like me to add these parts to your build?*`;
        return response;
    }

    getCompatibilityCheck(message, context) {
        let response = '🔍 **Compatibility Checklist**\n\n';
        response += `**Key Things to Check:**\n`;
        response += `• ✅ **CPU + Motherboard:** Match socket (LGA1700 for Intel, AM5 for AMD)\n`;
        response += `• ✅ **RAM + Motherboard:** Match type (DDR4 vs DDR5)\n`;
        response += `• ✅ **PSU Wattage:** Ensure enough for all components\n`;
        response += `• ✅ **Case Size:** Match motherboard form factor (ATX, Micro-ATX, ITX)\n`;
        response += `• ✅ **CPU Cooler:** Check height clearance\n`;
        response += `• ✅ **GPU:** Check length clearance and PCIe version\n\n`;
        
        if (context && !context.includes('No parts selected')) {
            response += `**Your Current Build:**\n${context}\n\n`;
            response += `💡 Click the **"AI Check"** button for a detailed compatibility report!`;
        } else {
            response += `💡 Select some parts first, then click **"AI Check"** for a detailed compatibility report!`;
        }
        
        return response;
    }

    getDefaultInventoryResponse(message, inventory) {
        const msg = message.toLowerCase();
        
        if (msg.includes('hi') || msg.includes('hello') || msg.includes('hey')) {
            return `👋 Hello! I'm your PC building assistant with access to our **${inventory.length}** inventory parts.\n\nI can help you:\n• 🖥️ **Find compatible parts** from our inventory\n• 💰 **Build a PC within your budget** (e.g., "Build under RM 3500")\n• 🔍 **Check compatibility** of your selected parts\n• 📊 **Calculate total price** of your build\n\nWhat would you like to build?`;
        }
        
        const count = inventory.length;
        const categories = new Set(inventory.map(p => p.i_category));
        const avgPrice = inventory.reduce((sum, p) => sum + parseFloat(p.i_price), 0) / count;
        const minPrice = Math.min(...inventory.map(p => p.i_price));
        const maxPrice = Math.max(...inventory.map(p => p.i_price));
        
        return `💡 **Inventory Summary**\n\n` +
               `📦 **${count}** parts available\n` +
               `📂 **${categories.size}** categories: ${Array.from(categories).join(', ')}\n` +
               `💰 Price range: RM ${minPrice} - RM ${maxPrice}\n` +
               `📊 Average price: RM ${avgPrice.toFixed(0)}\n\n` +
               `I can help you:\n` +
               `• Find parts in a specific category\n` +
               `• Build a PC within your budget\n` +
               `• Check compatibility\n\n` +
               `What would you like to know?`;
    }

    // ============================================
    // API CALLS (Pollinations & Local Backend)
    // ============================================
    
    async callPollinations(message, context, history) {
        let fullPrompt = message;
        if (context && !context.includes('No parts selected')) {
            fullPrompt = `Context: ${context}\n\nUser: ${message}`;
        }

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
            
            if (response.status === 429) {
                console.log('⏳ Rate limited');
                return null;
            }
            
            if (!response.ok) return null;
            
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
export default openaiService;