import dataService from './data-service.js';
import { getCartCount, updateCartCountDisplay, addToCart as addToCartUtil } from './cart-utils.js';
import geminiCompat from './services/gemini-compat.js';

let selectedParts = {
    cpu: null,
    motherboard: null,
    ram: null,
    gpu: null
};

let inventoryData = [];
let servicesData = [];
let compatibilityMode = true;
let buildCompleted = false; // Track if build was already completed

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
    
    const filteredProducts = category === 'all' 
        ? inventoryData 
        : inventoryData.filter(p => p.i_category === category);
    
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

// NEW: Show product detail modal
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
                ${product.i_specs ? `<p><strong>Specs:</strong> ${product.i_specs}</p>` : ''}
                ${product.i_description ? `<p><strong>Description:</strong> ${product.i_description}</p>` : ''}
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn-select ${isSelected ? 'selected-btn' : ''}" onclick="window.selectForBuild(${product.i_id})" style="flex: 1;">
                    <i class="fas fa-${isSelected ? 'check-circle' : 'plus-circle'}"></i> 
                    ${isSelected ? 'Selected for Build' : 'Select for Build'}
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
            <button class="btn-book" onclick="window.bookService(${service.service_id})">
                Book Now
            </button>
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
    
    // If already selected, deselect it
    if (selectedParts[product.i_category] === productId) {
        selectedParts[product.i_category] = null;
        buildCompleted = false; // Reset
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
    buildCompleted = false; // Reset when build changes
    resetCompleteButton();
    updateSelectedPartsDisplay();
    updateBuildSummary();
    renderProducts(getCurrentCategory());
}

// Reset the complete build button
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
            
            // Add all selected build parts to cart
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

// Expose functions globally
window.addToCart = addToCart;
window.selectForBuild = selectForBuild;
window.bookService = bookService;
window.showProductDetail = window.showProductDetail;

// ===== AI COMPATIBILITY CHECK =====
const _originalSelectForBuild = selectForBuild;
selectForBuild = async function(productId) {
    await _originalSelectForBuild(productId);
    // Small delay to ensure selectedParts is updated
    setTimeout(() => runAI(), 100);
};
window.selectForBuild = selectForBuild;

const _originalRemoveFromBuild = window.removeFromBuild;
window.removeFromBuild = function(category) {
    _originalRemoveFromBuild(category);
    setTimeout(() => runAI(), 100);
};

async function runAI() {
    const parts = [];
    for (const cat in selectedParts) {
        if (selectedParts[cat]) {
            const p = inventoryData.find(i => i.i_id === selectedParts[cat]);
            if (p) parts.push({ category: cat, name: p.i_name, brand: p.i_brand || '' });
        }
    }
    console.log('AI check - selectedParts:', JSON.stringify(selectedParts));
    console.log('AI check - parts found:', parts.length, parts);
    if (parts.length >= 2) {
        await geminiCompat.checkCompatibility(parts);
    }
}