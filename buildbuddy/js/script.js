import dataService from './data-service.js';
import { getCartCount, updateCartCountDisplay, addToCart as addToCartUtil } from './cart-utils.js';

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
        inventoryData = await dataService.getInventory();
        servicesData = await dataService.getServices();
        console.log('Data loaded successfully');
    } catch (error) {
        console.error('Error loading data:', error);
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

function renderProducts(category = 'all') {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;
    
    let filteredProducts = category === 'all' 
        ? inventoryData 
        : inventoryData.filter(p => p.i_category === category);

    filteredProducts = sortProducts(filteredProducts);
    
    productsGrid.innerHTML = filteredProducts.map(product => {
        const isSelected = selectedParts[product.i_category] === product.i_id;
        
        return `
            <div class="product-card ${isSelected ? 'selected' : ''}" onclick="window.showProductDetail(${product.i_id})">
                <span class="product-badge">${product.i_category.toUpperCase()}</span>
                <div class="product-image">
                    <i class="fas fa-${getIconForCategory(product.i_category)}"></i>
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

window.showProductDetail = function(productId) {
    const product = inventoryData.find(p => p.i_id === productId);
    if (!product) return;
    
    const modal = document.getElementById('compatibilityModal');
    const modalMessage = document.getElementById('modalMessage');
    if (!modal || !modalMessage) return;
    
    const isSelected = selectedParts[product.i_category] === product.i_id;
    
    modalMessage.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-${getIconForCategory(product.i_category)}" style="font-size: 64px; color: #00d4ff; margin-bottom: 15px;"></i>
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

async function selectForBuild(productId) {
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
}

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

async function addToCart(productId) {
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
}

async function bookService(serviceId) {
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
}

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

// ===== AI COMPATIBILITY CHECK (BUTTON TRIGGERED) =====
window.runAICompatibility = async function() {
    const parts = [];
    for (const cat in selectedParts) {
        if (selectedParts[cat]) {
            const p = inventoryData.find(i => i.i_id === selectedParts[cat]);
            if (p) parts.push({ category: cat, name: p.i_name, brand: p.i_brand || '' });
        }
    }
    
    // Error handling with sleek popups
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

// Expose functions globally
window.addToCart = addToCart;
window.selectForBuild = selectForBuild;
window.bookService = bookService;
window.showProductDetail = window.showProductDetail;