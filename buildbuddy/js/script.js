import dataService from './data-service.js';

let selectedParts = {
    cpu: null,
    motherboard: null,
    ram: null,
    gpu: null
};

let inventoryData = [];
let servicesData = [];
let compatibilityMode = true;
let cart = [];

const isBuilderPage = window.location.pathname.includes('builder.html');

document.addEventListener('DOMContentLoaded', async () => {
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
        
        if (dataService.currentCartId) {
            await updateCartDisplay();
        }
        
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
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
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
            <div class="product-card ${isSelected ? 'selected' : ''}">
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
                    <button class="btn-add" onclick="window.addToCart(${product.i_id})">
                        <i class="fas fa-cart-plus"></i> Add
                    </button>
                    <button class="btn-select" onclick="window.selectForBuild(${product.i_id})">
                        ${isSelected ? 'Selected' : 'Select'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getIconForCategory(category) {
    const icons = {
        cpu: 'microchip',
        motherboard: 'square',
        ram: 'memory',
        gpu: 'tv',
        storage: 'hdd',
        psu: 'plug',
        cooler: 'fan'
    };
    return icons[category] || 'box';
}

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
        repair: 'fa-tools',
        assembly: 'fa-computer',
        upgrade: 'fa-arrow-up',
        software: 'fa-windows',
        recovery: 'fa-database',
        maintenance: 'fa-broom'
    };
    return icons[category] || 'fa-wrench';
}

async function selectForBuild(productId) {
    const product = inventoryData.find(p => p.i_id === productId);
    
    if (compatibilityMode && !await checkCompatibility(product)) {
        return;
    }
    
    selectedParts[product.i_category] = productId;
    updateSelectedPartsDisplay();
    updateBuildSummary();
    renderProducts(getCurrentCategory());
    
    if (compatibilityMode) {
        showSuccessMessage(`${product.i_name} added to build!`);
    }
}

async function checkCompatibility(newPart) {
    let isCompatible = true;
    let message = '';
    let suggestion = '';
    
    if (newPart.i_category === 'cpu' && selectedParts.motherboard) {
        const mb = inventoryData.find(p => p.i_id === selectedParts.motherboard);
        if (!isCompatibleCPU(newPart, mb)) {
            isCompatible = false;
            message = `CPU may not be compatible with selected motherboard.`;
            suggestion = `Check socket compatibility before purchasing.`;
        }
    }
    
    if (newPart.i_category === 'motherboard' && selectedParts.cpu) {
        const cpu = inventoryData.find(p => p.i_id === selectedParts.cpu);
        if (!isCompatibleCPU(cpu, newPart)) {
            isCompatible = false;
            message = `Motherboard may not be compatible with selected CPU.`;
            suggestion = `Check socket compatibility before purchasing.`;
        }
    }
    
    if (!isCompatible) {
        showModal('Compatibility Warning', message, suggestion);
        return false;
    }
    
    return true;
}

function isCompatibleCPU(cpu, motherboard) {
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
    
    modalMessage.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-${isWarning ? 'exclamation-triangle' : 'check-circle'}" 
               style="font-size: 48px; color: ${isWarning ? '#ff9800' : '#4CAF50'}; margin-bottom: 20px;"></i>
            <p style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">${title}</p>
            <p style="margin-bottom: 15px;">${message}</p>
            ${suggestion ? `<p style="color: #00d4ff; background: #f0f0f5; padding: 12px; border-radius: 8px;">
                <i class="fas fa-lightbulb"></i> AI Suggestion: ${suggestion}
            </p>` : ''}
        </div>
    `;
    modal.style.display = 'flex';
}

function showSuccessMessage(message) {
    const modal = document.getElementById('compatibilityModal') || document.getElementById('serviceModal');
    const modalMessage = document.getElementById('modalMessage');
    if (!modal || !modalMessage) return;
    
    modalMessage.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-check-circle" style="font-size: 48px; color: #4CAF50; margin-bottom: 20px;"></i>
            <p style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">Success!</p>
            <p>${message}</p>
        </div>
    `;
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.display = 'none';
    }, 2500);
}

function updateSelectedPartsDisplay() {
    const display = document.getElementById('selectedPartsDisplay');
    if (!display) return;
    
    const parts = [];
    for (const category in selectedParts) {
        if (selectedParts[category]) {
            const part = inventoryData.find(p => p.i_id === selectedParts[category]);
            if (part) {
                parts.push(`${category.toUpperCase()}: ${part.i_name}`);
            }
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
                    </div>
                `;
            }
        }
    }
    
    if (!html) {
        html = '<p class="empty-build">No components selected</p>';
    }
    
    summaryList.innerHTML = html;
    buildTotal.textContent = `RM ${total}`;
}

async function addToCart(productId) {
    try {
        await dataService.addToCart(productId, 1);
        await updateCartDisplay();
        
        const product = inventoryData.find(p => p.i_id === productId);
        showSuccessMessage(`${product.i_name} added to cart!`);
    } catch (error) {
        console.error('Error adding to cart:', error);
        showError('Failed to add item to cart');
    }
}

async function bookService(serviceId) {
    try {
        await dataService.addServiceToCart(serviceId);
        await updateCartDisplay();
        
        const service = servicesData.find(s => s.service_id === serviceId);
        showModal('Service Booked!', 
            `Your ${service.service_name} service has been added to cart.`,
            'Proceed to checkout to confirm your booking.');
    } catch (error) {
        console.error('Error booking service:', error);
        showError('Failed to book service');
    }
}

async function updateCartDisplay() {
    try {
        const cartItems = await dataService.getCartItems();
        const cartServices = await dataService.getCartServices();
        
        cart = [...cartItems, ...cartServices];
        
        const totalItems = cartItems.length + cartServices.length;
        const cartCounts = document.querySelectorAll('.cart-count');
        cartCounts.forEach(count => count.textContent = totalItems);
    } catch (error) {
        console.error('Error updating cart:', error);
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
            } else {
                for (const category in selectedParts) {
                    if (selectedParts[category]) {
                        await addToCart(selectedParts[category]);
                    }
                }
                showSuccessMessage('Build completed! All parts added to cart.');
            }
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

window.addToCart = addToCart;
window.selectForBuild = selectForBuild;
window.bookService = bookService;