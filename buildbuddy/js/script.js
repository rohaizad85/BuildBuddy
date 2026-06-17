// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\script.js
import dataService from './data-service.js';
import { getCartCount, updateCartCountDisplay, addToCart as addToCartUtil } from './cart-utils.js';
import supabase from './supabase-client.js';

let selectedParts = {
    cpu: null,
    motherboard: null,
    ram: null,
    gpu: null,
    psu: null,
    storage: null,
    cooler: null
};

let inventoryData = [];
let servicesData = [];
let compatibilityMode = true;
let buildCompleted = false;

const isBuilderPage = window.location.pathname.includes('builder.html');

document.addEventListener('DOMContentLoaded', async () => {
    await updateCartCountDisplay();
    await loadInitialData();
    
    if (isBuilderPage) {
        initializeBuilderPage();
    } else {
        initializeHomePage();
    }
});

async function loadInitialData() {
    try {
        showLoading(true);
        
        // Load both inventory and services
        const [inventory, services] = await Promise.all([
            dataService.getInventory(),
            dataService.getServices()
        ]);
        
        // Store the data
        inventoryData = inventory || [];
        servicesData = services || [];
        
        console.log('✅ Data loaded successfully');
        console.log('📦 Inventory items:', inventoryData.length);
        console.log('🔧 Services:', servicesData.length);
        
        // Log the Corsair item to verify
        const corsair = inventoryData.find(p => p.i_name && p.i_name.includes('Corsair Vengeance 16GB'));
        if (corsair) {
            console.log('✅ Corsair Vengeance 16GB loaded:', corsair.i_image_path);
        }
        
        // After data is loaded, initialize the page
        if (isBuilderPage) {
            initializeBuilderPage();
        } else {
            initializeHomePage();
        }
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showError('Failed to load data. Please refresh the page.');
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    const loader = document.getElementById('loadingOverlay');
    if (show) {
        if (!loader) {
            const div = document.createElement('div');
            div.id = 'loadingOverlay';
            div.innerHTML = '<div class="loader"></div>';
            div.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); display: flex; align-items: center;
                justify-content: center; z-index: 9999;
            `;
            document.body.appendChild(div);
        }
    } else {
        if (loader) loader.remove();
    }
}

function showError(message) {
    const modal = document.getElementById('compatibilityModal') || document.getElementById('serviceModal');
    if (modal) {
        const modalMessage = document.getElementById('modalMessage');
        modalMessage.innerHTML = `
            <div style="text-align: center;">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
                <p>${message}</p>
            </div>
        `;
        modal.style.display = 'flex';
    }
}

function initializeHomePage() {
    renderServices();
    setupHomePageListeners();
}

function initializeBuilderPage() {
    renderProducts('all');
    updateSelectedPartsDisplay();
    setupBuilderListeners();
    updateBuildSummary();
}

function getProductImageUrl(imagePath) {
    if (!imagePath) {
        return null;
    }
    
    // If it's already a full URL (placeholder), return it directly
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    
    // Construct the public URL directly
    const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
    const bucket = 'images';
    
    // Encode the filename for URL
    const encodedPath = encodeURIComponent(imagePath);
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

// ===== RENDER PRODUCTS =====
function renderProducts(category = 'all') {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;
    
    let filteredProducts = category === 'all' 
        ? inventoryData 
        : inventoryData.filter(p => p.i_category === category);

    filteredProducts = sortProducts(filteredProducts);
    
    productsGrid.innerHTML = filteredProducts.map(product => {
        const isSelected = selectedParts[product.i_category] === product.i_id;
        const imageUrl = getProductImageUrl(product.i_image_path);
        
        // Only try to load image if it's a valid URL (not a placeholder that might fail)
        const shouldLoadImage = imageUrl && !imageUrl.includes('via.placeholder.com');
        
        return `
            <div class="product-card ${isSelected ? 'selected' : ''}" onclick="window.showProductDetail(${product.i_id})">
                <span class="product-badge">${product.i_category.toUpperCase()}</span>
                <div class="product-image">
                    ${shouldLoadImage ? `
                        <img src="${imageUrl}" 
                             alt="${product.i_name}"
                             loading="lazy"
                             onerror="this.style.display='none'; this.parentElement.querySelector('.placeholder-icon').style.display='flex';">
                    ` : ''}
                    <div class="placeholder-icon" style="${shouldLoadImage ? 'display: none;' : 'display: flex;'}">
                        <i class="fas fa-${getIconForCategory(product.i_category)}"></i>
                        <span>${product.i_category}</span>
                    </div>
                </div>
                <h4>${product.i_name}</h4>
                <div class="product-specs">${product.i_brand || ''}</div>
                <div class="product-price">RM ${product.i_price}</div>
                <div class="product-stock ${product.i_quantity < 5 ? 'low-stock' : ''}">
                    <i class="fas fa-box"></i> ${product.i_quantity} in stock
                </div>
                <div class="product-actions">
                    <button class="btn-select ${isSelected ? 'selected-btn' : ''}" onclick="event.stopPropagation(); window.selectForBuild(${product.i_id})">
                        <i class="fas fa-${isSelected ? 'check-circle' : 'plus-circle'}"></i> 
                        ${isSelected ? 'Selected' : 'Select for Build'}
                    </button>
                    <button class="btn-add" onclick="event.stopPropagation(); window.addToCart(${product.i_id})">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getIconForCategory(category) {
    const icons = {
        cpu: 'microchip', motherboard: 'square', ram: 'memory',
        gpu: 'tv', storage: 'hdd', psu: 'plug', cooler: 'fan'
    };
    return icons[category] || 'box';
}

// ===== PRODUCT DETAIL MODAL =====
window.showProductDetail = function(productId) {
    const product = inventoryData.find(p => p.i_id === productId);
    if (!product) return;
    
    const modal = document.getElementById('compatibilityModal');
    const modalMessage = document.getElementById('modalMessage');
    if (!modal || !modalMessage) return;
    
    const isSelected = selectedParts[product.i_category] === product.i_id;
    const imageUrl = getProductImageUrl(product.i_image_path);
    const shouldLoadImage = imageUrl && !imageUrl.includes('via.placeholder.com');
    
    modalMessage.innerHTML = `
        <div style="text-align: center;">
            <div style="width: 150px; height: 150px; margin: 0 auto 15px; background: #f8f9fc; border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
                ${shouldLoadImage ? `
                    <img src="${imageUrl}" alt="${product.i_name}" style="width: 100%; height: 100%; object-fit: contain; padding: 15px;" onerror="this.style.display='none'; this.parentElement.querySelector('.modal-placeholder').style.display='flex';">
                ` : ''}
                <div class="modal-placeholder" style="${shouldLoadImage ? 'display: none;' : 'display: flex;'} flex-direction: column; align-items: center; color: #ccc;">
                    <i class="fas fa-${getIconForCategory(product.i_category)}" style="font-size: 48px; color: #00d4ff;"></i>
                    <span style="font-size: 12px; margin-top: 5px; color: #999;">${product.i_category}</span>
                </div>
            </div>
            <h3 style="margin-bottom: 5px;">${product.i_name}</h3>
            <span class="product-badge">${product.i_category.toUpperCase()}</span>
            <hr style="margin: 15px 0;">
            <div style="text-align: left; display: grid; gap: 8px;">
                <p><strong>Brand:</strong> ${product.i_brand || 'N/A'}</p>
                <p><strong>Price:</strong> RM ${product.i_price}</p>
                <p><strong>Stock:</strong> ${product.i_quantity} units</p>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn-select ${isSelected ? 'selected-btn' : ''}" onclick="window.selectForBuild(${product.i_id})" style="flex: 1;">
                    <i class="fas fa-${isSelected ? 'check-circle' : 'plus-circle'}"></i> 
                    ${isSelected ? 'Selected' : 'Select for Build'}
                </button>
                <button class="btn-add" onclick="window.addToCart(${product.i_id})" style="flex: 1;">
                    <i class="fas fa-cart-plus"></i> Add to Cart
                </button>
            </div>
        </div>
    `;
    
    modal.querySelector('.modal-header h3').textContent = 'Product Details';
    modal.style.display = 'flex';
};

function renderServices() {
    const servicesGrid = document.getElementById('servicesGrid');
    if (!servicesGrid) return;
    
    servicesGrid.innerHTML = servicesData.map(service => `
        <div class="service-card">
            <i class="fas ${getServiceIcon(service.service_category)}"></i>
            <h4>${service.service_name}</h4>
            <p>${service.service_duration || 'Contact for duration'}</p>
            <div class="service-price">RM ${service.service_price}</div>
            <button class="btn-book" onclick="window.bookService(${service.service_id})">Book Now</button>
        </div>
    `).join('');
}

function getServiceIcon(category) {
    const icons = {
        repair: 'fa-tools', assembly: 'fa-computer', upgrade: 'fa-arrow-up',
        software: 'fa-windows', recovery: 'fa-database', maintenance: 'fa-broom'
    };
    return icons[category] || 'fa-wrench';
}

// ===== SELECT FOR BUILD =====
window.selectForBuild = async function(productId) {
    const product = inventoryData.find(p => p.i_id === productId);
    if (!product) return;
    
    if (selectedParts[product.i_category] === productId) {
        selectedParts[product.i_category] = null;
        buildCompleted = false;
        resetCompleteButton();
        updateSelectedPartsDisplay();
        updateBuildSummary();
        renderProducts(getCurrentCategory());
        return;
    }
    
    if (compatibilityMode && !await checkCompatibility(product)) {
        return;
    }
    
    selectedParts[product.i_category] = productId;
    buildCompleted = false;
    resetCompleteButton();
    updateSelectedPartsDisplay();
    updateBuildSummary();
    renderProducts(getCurrentCategory());
};

function resetCompleteButton() {
    const btn = document.getElementById('completeBuildBtn');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-check"></i> Complete Build';
        btn.style.background = '#00d4ff';
    }
}

async function checkCompatibility(newPart) {
    let isCompatible = true;
    let message = '';
    
    if (newPart.i_category === 'cpu' && selectedParts.motherboard) {
        const mb = inventoryData.find(p => p.i_id === selectedParts.motherboard);
        if (mb && !isCompatibleCPU(newPart, mb)) {
            isCompatible = false;
            message = 'CPU may not be compatible with selected motherboard.';
        }
    }
    
    if (newPart.i_category === 'motherboard' && selectedParts.cpu) {
        const cpu = inventoryData.find(p => p.i_id === selectedParts.cpu);
        if (cpu && !isCompatibleCPU(cpu, newPart)) {
            isCompatible = false;
            message = 'Motherboard may not be compatible with selected CPU.';
        }
    }
    
    if (!isCompatible) {
        showModal('Compatibility Warning', message, 'Check socket compatibility before purchasing.');
        return false;
    }
    
    return true;
}

function isCompatibleCPU(cpu, motherboard) {
    if (!cpu || !motherboard) return true;
    const cpuBrand = cpu.i_brand?.toLowerCase() || '';
    const mbBrand = motherboard.i_brand?.toLowerCase() || '';
    if (cpuBrand.includes('intel') && mbBrand.includes('amd')) return false;
    if (cpuBrand.includes('amd') && mbBrand.includes('intel')) return false;
    return true;
}

function showModal(title, message, suggestion = '') {
    const modal = document.getElementById('compatibilityModal') || document.getElementById('serviceModal');
    const modalMessage = document.getElementById('modalMessage');
    if (!modal || !modalMessage) return;
    
    const isWarning = title.includes('Warning');
    
    modal.querySelector('.modal-header h3').textContent = title;
    modalMessage.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-${isWarning ? 'exclamation-triangle' : 'check-circle'}" 
               style="font-size: 48px; color: ${isWarning ? '#ff9800' : '#4CAF50'}; margin-bottom: 20px;"></i>
            <p style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">${title}</p>
            <p style="margin-bottom: 15px;">${message}</p>
            ${suggestion ? `<p style="color: #00d4ff; background: #f0f0f5; padding: 12px; border-radius: 8px;">
                <i class="fas fa-lightbulb"></i> Suggestion: ${suggestion}
            </p>` : ''}
        </div>
    `;
    modal.style.display = 'flex';
}

function updateSelectedPartsDisplay() {
    const display = document.getElementById('selectedPartsDisplay');
    if (!display) return;
    
    const parts = [];
    for (const category in selectedParts) {
        if (selectedParts[category]) {
            const part = inventoryData.find(p => p.i_id === selectedParts[category]);
            if (part) parts.push(`${category.toUpperCase()}: ${part.i_name}`);
        }
    }
    display.textContent = parts.length ? parts.join(' | ') : 'Start by selecting a CPU or Motherboard';
}

function updateBuildSummary() {
    const summaryList = document.getElementById('buildSummaryList');
    const buildTotal = document.getElementById('buildTotal');
    if (!summaryList || !buildTotal) return;
    
    let total = 0;
    let html = '';
    
    for (const category in selectedParts) {
        if (selectedParts[category]) {
            const part = inventoryData.find(p => p.i_id === selectedParts[category]);
            if (part) {
                total += parseFloat(part.i_price);
                html += `
                    <div class="build-item">
                        <div>
                            <div class="build-item-category">${category}</div>
                            <div class="build-item-name">${part.i_name}</div>
                        </div>
                        <div class="build-item-price">RM ${part.i_price}</div>
                        <button onclick="window.removeFromBuild('${category}')" style="background:none;border:none;color:#f44336;cursor:pointer;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            }
        }
    }
    
    if (!html) html = '<p class="empty-build">No components selected</p>';
    summaryList.innerHTML = html;
    buildTotal.textContent = `RM ${total}`;
}

window.removeFromBuild = function(category) {
    selectedParts[category] = null;
    buildCompleted = false;
    resetCompleteButton();
    updateSelectedPartsDisplay();
    updateBuildSummary();
    renderProducts(getCurrentCategory());
};

// ===== ADD TO CART =====
window.addToCart = async function(productId) {
    try {
        const product = inventoryData.find(p => p.i_id === productId);
        if (!product) return;
        
        await addToCartUtil({
            type: 'product',
            id: productId,
            name: product.i_name,
            price: product.i_price
        });
        
        await updateCartCountDisplay();
        showModal('Added to Cart!', `${product.i_name} has been added to your cart.`);
    } catch (error) {
        console.error('Error adding to cart:', error);
        showError('Failed to add item to cart');
    }
};

window.bookService = async function(serviceId) {
    try {
        const service = servicesData.find(s => s.service_id === serviceId);
        if (!service) return;
        
        await addToCartUtil({
            type: 'service',
            id: serviceId,
            name: service.service_name,
            price: service.service_price
        });
        
        await updateCartCountDisplay();
        showModal('Service Booked!', `${service.service_name} has been added to cart.`);
    } catch (error) {
        console.error('Error booking service:', error);
        showError('Failed to book service');
    }
};

function getCurrentCategory() {
    const activeCategory = document.querySelector('.category-item.active');
    return activeCategory ? activeCategory.dataset.category : 'all';
}

function setupBuilderListeners() {
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            renderProducts(item.dataset.category);
        });
    });
    
    const compatibilityToggle = document.getElementById('compatibilityMode');
    if (compatibilityToggle) {
        compatibilityToggle.addEventListener('change', (e) => {
            compatibilityMode = e.target.checked;
        });
    }
    
    const completeBtn = document.getElementById('completeBuildBtn');
    if (completeBtn) {
        completeBtn.addEventListener('click', async () => {
            const partCount = Object.values(selectedParts).filter(v => v).length;
            
            if (partCount < 3) {
                showModal('Build Incomplete', 'Please select at least CPU, Motherboard, and RAM.');
                return;
            }
            
            if (buildCompleted) {
                showModal('Already Added', 'Build parts are already in cart. Make changes to add again.');
                return;
            }
            
            for (const category in selectedParts) {
                if (selectedParts[category]) {
                    await addToCart(selectedParts[category]);
                }
            }
            
            buildCompleted = true;
            document.getElementById('completeBuildBtn').innerHTML = '<i class="fas fa-check"></i> Added to Cart';
            document.getElementById('completeBuildBtn').style.background = '#4CAF50';
            
            showModal('Build Complete!', 'All selected parts added to cart.', 'Review your cart to checkout.');
        });
    }
    
    setupModalListeners();
}

function setupHomePageListeners() {
    setupModalListeners();
}

function setupModalListeners() {
    const modal = document.getElementById('compatibilityModal') || document.getElementById('serviceModal');
    if (!modal) return;
    
    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function showPopup(title, message, icon = 'exclamation-triangle', color = '#ff9800') {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;';
    
    const popup = document.createElement('div');
    popup.style.cssText = 'background:white;border-radius:16px;padding:30px;max-width:400px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:slideUp 0.3s ease;';
    
    popup.innerHTML = `
        <i class="fas fa-${icon}" style="font-size:48px;color:${color};margin-bottom:15px;display:block;"></i>
        <h3 style="color:#1a1a2e;margin-bottom:8px;">${title}</h3>
        <p style="color:#666;margin-bottom:20px;line-height:1.5;">${message}</p>
        <button id="popupCloseBtn" style="padding:12px 40px;background:${color};color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;transition:all 0.2s;">
            Got it
        </button>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    const close = () => overlay.remove();
    document.getElementById('popupCloseBtn').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    
    // Add animations if not already present
    if (!document.getElementById('popupStyles')) {
        const style = document.createElement('style');
        style.id = 'popupStyles';
        style.textContent = `
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        `;
        document.head.appendChild(style);
    }
}

// ===== SORTING =====
let currentSort = 'default';

function sortProducts(products) {
    const sorted = [...products];
    switch (currentSort) {
        case 'name-az': return sorted.sort((a, b) => (a.i_name || '').localeCompare(b.i_name || ''));
        case 'name-za': return sorted.sort((a, b) => (b.i_name || '').localeCompare(a.i_name || ''));
        case 'price-low': return sorted.sort((a, b) => parseFloat(a.i_price) - parseFloat(b.i_price));
        case 'price-high': return sorted.sort((a, b) => parseFloat(b.i_price) - parseFloat(a.i_price));
        case 'stock-high': return sorted.sort((a, b) => (b.i_quantity || 0) - (a.i_quantity || 0));
        case 'stock-low': return sorted.sort((a, b) => (a.i_quantity || 0) - (b.i_quantity || 0));
        case 'brand-az': return sorted.sort((a, b) => (a.i_brand || '').localeCompare(b.i_brand || ''));
        default: return sorted;
    }
}

window.setSort = function(sortType) {
    currentSort = sortType;
    document.querySelectorAll('.sort-option').forEach(o => o.classList.remove('active'));
    document.querySelector(`.sort-option[data-sort="${sortType}"]`)?.classList.add('active');
    renderProducts(getCurrentCategory());
};

window.selectBuilderCategory = function(category) {
    renderProducts(category);
};

// ===== AI COMPATIBILITY CHECK =====
window.runAICompatibility = async function() {
    const parts = [];
    for (const cat in selectedParts) {
        if (selectedParts[cat]) {
            const p = inventoryData.find(i => i.i_id === selectedParts[cat]);
            if (p) parts.push({ category: cat, name: p.i_name, brand: p.i_brand || '' });
        }
    }
    
    if (parts.length === 0) {
        showPopup(
            'No Components Selected',
            'Please select at least a <strong>CPU</strong> and <strong>Motherboard</strong> to run the compatibility check.',
            'robot',
            '#2196F3'
        );
        return;
    }
    
    if (parts.length === 1) {
        const selected = parts[0];
        showPopup(
            'Need More Components',
            `You've only selected <strong>${selected.name}</strong>. Please pick at least a <strong>CPU</strong> and <strong>Motherboard</strong> for a meaningful compatibility check.`,
            'puzzle-piece',
            '#ff9800'
        );
        return;
    }
    
    const hasCPU = parts.find(p => p.category === 'cpu');
    const hasMobo = parts.find(p => p.category === 'motherboard');
    
    if (!hasCPU || !hasMobo) {
        const missing = [];
        if (!hasCPU) missing.push('<strong>CPU</strong>');
        if (!hasMobo) missing.push('<strong>Motherboard</strong>');
        showPopup(
            'Missing Essential Parts',
            `For a proper compatibility check, please also select: ${missing.join(' and ')}.`,
            'exclamation-circle',
            '#f44336'
        );
        return;
    }
    
    // Show panel
    const panel = document.getElementById('aiResultPanel');
    const statusEl = document.getElementById('compatibilityStatus');
    const detailsEl = document.getElementById('aiDetails');
    
    panel.style.display = 'block';
    statusEl.className = 'ai-status checking';
    statusEl.innerHTML = '<i class="fas fa-robot fa-spin"></i> AI analyzing your build...';
    detailsEl.innerHTML = '';
    panel.scrollIntoView({ behavior: 'smooth' });
    
    const btn = document.getElementById('aiCheckBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    
    try {
        const response = await fetch('http://localhost:3000/api/gemini-compat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: buildAIPrompt(parts) })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        displayAIResults(result);
        
    } catch (error) {
        console.error('AI check failed:', error);
        const result = localCompatCheck(parts);
        displayAIResults(result);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-robot"></i> Check AI Compatibility';
    }
};

function buildAIPrompt(parts) {
    return `PC compatibility check:\n${parts.map(p => `- ${p.category.toUpperCase()}: ${p.name} (${p.brand})`).join('\n')}\n\nReturn JSON: {"compatible":bool,"summary":"","compatibility":[{"parts":"","status":"compatible/warning/incompatible","detail":""}],"partDetails":[{"name":"","category":"","role":"","note":""}],"suggestions":[],"estimatedWattage":500}`;
}

function displayAIResults(result) {
    const statusEl = document.getElementById('compatibilityStatus');
    const detailsEl = document.getElementById('aiDetails');
    
    if (result.compatible) {
        statusEl.className = 'ai-status compatible';
        statusEl.innerHTML = `<i class="fas fa-check-circle" style="color:#4CAF50;font-size:20px;"></i> <strong>${result.summary || 'Build Compatible'}</strong> ✅`;
    } else {
        statusEl.className = 'ai-status incompatible';
        statusEl.innerHTML = `<i class="fas fa-times-circle" style="color:#f44336;font-size:20px;"></i> <strong>${result.summary || 'Issues Found'}</strong> ❌`;
    }
    
    let html = '';
    
    if (result.partDetails?.length) {
        result.partDetails.forEach(p => {
            html += `<div style="margin:6px 0;padding:10px;background:#f8f9fc;border-radius:6px;border-left:3px solid #00d4ff;">
                <strong>${p.name}</strong> <span style="color:#888;font-size:11px;">(${p.category})</span>
                <div style="font-size:12px;color:#555;">${p.role || ''}</div></div>`;
        });
    }
    
    if (result.compatibility?.length) {
        result.compatibility.forEach(c => {
            const icon = c.status === 'compatible' ? '✅' : c.status === 'warning' ? '⚠️' : '❌';
            const bg = c.status === 'compatible' ? '#e8f5e9' : c.status === 'warning' ? '#fff3e0' : '#ffebee';
            html += `<div style="margin:4px 0;padding:6px;background:${bg};border-radius:4px;font-size:12px;">${icon} <strong>${c.parts}:</strong> ${c.detail}</div>`;
        });
    }
    
    if (result.suggestions?.length) {
        html += `<div style="margin-top:8px;padding:8px;background:#e3f2fd;border-radius:6px;font-size:12px;"><strong>💡</strong> ${result.suggestions.join(' | ')}</div>`;
    }
    
    if (result.estimatedWattage) {
        html += `<div style="margin-top:6px;text-align:center;font-size:12px;color:#666;">⚡ ~${result.estimatedWattage}W</div>`;
    }
    
    detailsEl.innerHTML = html || '<p style="color:#666;font-size:13px;">No details available.</p>';
}

function localCompatCheck(parts) {
    const cpu = parts.find(p => p.category === 'cpu' || p.category === 'CPU');
    const mobo = parts.find(p => p.category === 'motherboard' || p.category === 'MOTHERBOARD');
    const ram = parts.find(p => p.category === 'ram' || p.category === 'RAM');
    const gpu = parts.find(p => p.category === 'gpu' || p.category === 'GPU');
    
    const cpuBrand = (cpu?.brand || '').toLowerCase();
    const moboBrand = (mobo?.brand || '').toLowerCase();
    const compatibility = [];
    const issues = [];
    
    const partDetails = parts.map(p => ({
        name: p.name, category: (p.category || '').toUpperCase(),
        role: getPartRole(p.category), note: ''
    }));
    
    if (cpu && mobo) {
        if (cpuBrand.includes('intel') && moboBrand.includes('amd')) {
            compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'incompatible', detail: 'Intel CPU needs Intel motherboard' });
            issues.push({ part: cpu.name, problem: 'CPU/Mobo mismatch', severity: 'critical' });
        } else if (cpuBrand.includes('amd') && moboBrand.includes('intel')) {
            compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'incompatible', detail: 'AMD CPU needs AMD motherboard' });
            issues.push({ part: cpu.name, problem: 'CPU/Mobo mismatch', severity: 'critical' });
        } else {
            compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'compatible', detail: 'Brands match' });
        }
    }
    if (ram) compatibility.push({ parts: ram.name, status: 'compatible', detail: 'Check RAM type matches board' });
    if (gpu) compatibility.push({ parts: gpu.name, status: 'compatible', detail: 'PCIe x16 compatible' });
    
    return {
        compatible: issues.length === 0,
        confidence: 'medium',
        summary: issues.length ? 'Issues found' : 'Looks compatible',
        compatibility, partDetails, issues,
        suggestions: parts.length < 4 ? ['Add more components'] : [],
        estimatedWattage: 500
    };
}

function getPartRole(cat) {
    const roles = { cpu: 'Brain of PC', motherboard: 'Connects all parts', ram: 'Active memory', gpu: 'Graphics processing', storage: 'Permanent storage', psu: 'Power supply', cooler: 'CPU cooling' };
    return roles[(cat || '').toLowerCase()] || 'PC component';
}

console.log('✅ script.js loaded successfully');

// ===== EXPOSE FUNCTIONS GLOBALLY =====
window.getProductImageUrl = getProductImageUrl;
window.inventoryData = inventoryData;

// ===== DEBUG FUNCTIONS =====

// Debug function for checking images
window.debugImages = async function() {
    try {
        // Check if supabase is available
        if (typeof supabase === 'undefined') {
            console.error('❌ Supabase is not defined! Make sure it\'s imported.');
            return;
        }
        
        console.log('🔍 Checking images in bucket...');
        
        // Use the correct storage syntax
        const { data, error } = await supabase
            .storage
            .from('images')
            .list('');
        
        if (error) {
            console.error('❌ Error listing bucket:', error);
            console.log('💡 Make sure the "images" bucket exists and is public.');
            return;
        }
        
        if (!data || data.length === 0) {
            console.log('📁 No files found in "images" bucket.');
            return;
        }
        
        console.log(`📁 Found ${data.length} files in "images" bucket:`);
        data.forEach(file => {
            console.log(`   📷 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        });
        
        // Check if inventoryData is available
        if (!inventoryData || inventoryData.length === 0) {
            console.warn('⚠️ No inventory data loaded. Run loadInitialData() first.');
            return data;
        }
        
        // Check each inventory item against the bucket
        console.log('\n🔍 Checking inventory items:');
        const itemsWithImages = inventoryData.filter(p => p.i_image_path && !p.i_image_path.startsWith('http'));
        
        if (itemsWithImages.length === 0) {
            console.log('ℹ️ No items with image paths found.');
            return data;
        }
        
        const bucketFiles = data.map(f => f.name);
        let foundCount = 0;
        let missingItems = [];
        
        for (const item of itemsWithImages) {
            const filename = item.i_image_path;
            const exists = bucketFiles.includes(filename);
            
            if (exists) {
                foundCount++;
                console.log(`   ✅ ${item.i_name}: ${filename}`);
            } else {
                missingItems.push(item);
                console.log(`   ❌ ${item.i_name}: ${filename} (NOT FOUND)`);
                
                // Suggest possible matches
                const searchTerm = item.i_name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const suggestions = data.filter(f => {
                    const fName = f.name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/g, '');
                    return fName.includes(searchTerm) || searchTerm.includes(fName);
                });
                
                if (suggestions.length > 0) {
                    console.log(`      💡 Did you mean: ${suggestions.map(s => s.name).join(', ')}`);
                }
            }
        }
        
        console.log(`\n📊 Summary: ${foundCount}/${itemsWithImages.length} images found`);
        
        if (missingItems.length > 0) {
            console.log('\n🔧 To fix missing images, run this SQL:');
            console.log('-- Update each missing image with the correct filename');
            missingItems.forEach(item => {
                console.log(`UPDATE public.inventory SET i_image_path = 'correct-filename.jpg' WHERE i_id = ${item.i_id};`);
            });
        }
        
        return data;
        
    } catch (error) {
        console.error('❌ Error in debugImages:', error);
        console.log('💡 Make sure you\'re on the builder page with inventory loaded.');
    }
};

// Quick image check function
window.checkImage = async function(filename) {
    try {
        if (typeof supabase === 'undefined') {
            console.error('❌ Supabase is not defined!');
            return false;
        }
        
        // Use the correct storage syntax
        const { data } = supabase
            .storage
            .from('images')
            .getPublicUrl(filename);
        
        const url = data.publicUrl;
        
        console.log(`📷 Checking: ${filename}`);
        console.log(`🔗 URL: ${url}`);
        
        const response = await fetch(url, { method: 'HEAD' });
        console.log(`   ${response.ok ? '✅ EXISTS' : '❌ NOT FOUND'} (Status: ${response.status})`);
        
        return response.ok;
    } catch (error) {
        console.error(`❌ Error checking ${filename}:`, error);
        return false;
    }
};

// List all images in bucket
window.listImages = async function() {
    try {
        if (typeof supabase === 'undefined') {
            console.error('❌ Supabase is not defined!');
            return;
        }
        
        // Use the correct storage syntax
        const { data, error } = await supabase
            .storage
            .from('images')
            .list('');
        
        if (error) {
            console.error('❌ Error listing bucket:', error);
            return;
        }
        
        if (!data || data.length === 0) {
            console.log('📁 No images found in bucket.');
            return [];
        }
        
        console.log(`📁 ${data.length} images in bucket:`);
        data.forEach(f => console.log(`   📷 ${f.name}`));
        return data;
    } catch (error) {
        console.error('❌ Error:', error);
    }
};

// Check all images for a specific category
window.checkCategoryImages = async function(category) {
    try {
        if (typeof supabase === 'undefined') {
            console.error('❌ Supabase is not defined!');
            return;
        }
        
        if (!inventoryData || inventoryData.length === 0) {
            console.warn('⚠️ No inventory data loaded.');
            return;
        }
        
        const items = inventoryData.filter(p => 
            p.i_category === category && 
            p.i_image_path && 
            !p.i_image_path.startsWith('http')
        );
        
        if (items.length === 0) {
            console.log(`ℹ️ No items with images found in category: ${category}`);
            return;
        }
        
        console.log(`🔍 Checking ${items.length} items in category "${category}":`);
        
        for (const item of items) {
            await window.checkImage(item.i_image_path);
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
};

// Fix image path for a specific item
window.fixImagePath = async function(itemId, correctFilename) {
    try {
        // Check if the image exists first
        const exists = await window.checkImage(correctFilename);
        
        if (!exists) {
            console.warn(`⚠️ Warning: ${correctFilename} does not exist in the bucket.`);
            const confirm = window.confirm(`"${correctFilename}" doesn't exist. Do you want to update anyway?`);
            if (!confirm) return;
        }
        
        // Update the database
        const { data, error } = await supabase
            .from('inventory')
            .update({ i_image_path: correctFilename })
            .eq('i_id', itemId)
            .select();
        
        if (error) {
            console.error('❌ Error updating database:', error);
            return;
        }
        
        console.log(`✅ Updated item ${itemId} to use: ${correctFilename}`);
        
        // Refresh inventory data
        inventoryData = await dataService.getInventory();
        renderProducts(getCurrentCategory());
        
        return data;
    } catch (error) {
        console.error('❌ Error:', error);
    }
};

// Upload a file to the bucket (for debugging)
window.uploadTestImage = async function(file, filename) {
    try {
        if (typeof supabase === 'undefined') {
            console.error('❌ Supabase is not defined!');
            return;
        }
        
        const { data, error } = await supabase
            .storage
            .from('images')
            .upload(filename, file, {
                cacheControl: '3600',
                upsert: true
            });
        
        if (error) {
            console.error('❌ Error uploading:', error);
            return;
        }
        
        console.log(`✅ Uploaded: ${filename}`);
        return data;
    } catch (error) {
        console.error('❌ Error:', error);
    }
};

console.log('✅ Debug functions loaded. Run:');
console.log('   await window.listImages() - List all images in bucket');
console.log('   await window.debugImages() - Check all inventory items against bucket');
console.log('   await window.checkImage("filename.jpg") - Check a specific image');
console.log('   await window.checkCategoryImages("cpu") - Check images for a category');
console.log('   await window.fixImagePath(itemId, "correct-filename.jpg") - Fix a specific item');