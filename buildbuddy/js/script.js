// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\script.js
import dataService from './data-service.js';
import { 
    getUser,
    getLocalCart,
    saveLocalCart,
    clearLocalCart,
    getCartCount,
    updateCartCountDisplay,
    addToCart as addToCartUtil,
    addBundleToCart,
    syncLocalCartToDatabase,
    initCart,
    setupLoginButton,
    clearCartOnLogout
} from './cart-utils.js';
import supabase from './supabase-client.js';
import Pc3DViewer from './services/buildcores.js';

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
let productQuantities = {};
let pcViewer = null;
let viewerInitialized = false;
let viewerReady = false;
let modalViewer = null;
let modalViewerInitialized = false;

const isBuilderPage = window.location.pathname.includes('builder.html');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM Content Loaded');
    await updateCartCountDisplay();
    await loadInitialData();
    
    if (isBuilderPage) {
        console.log('📄 Builder page detected');
        initializeBuilderPage();
        // Initialize 3D viewer after a slight delay
        setTimeout(() => {
            initialize3DViewer();
        }, 500);
    } else {
        console.log('📄 Home page detected');
        initializeHomePage();
    }
});

async function loadInitialData() {
    try {
        console.log('📦 Loading initial data...');
        showLoading(true);
        
        const [inventory, services] = await Promise.all([
            dataService.getInventory(),
            dataService.getServices()
        ]);
        
        inventoryData = inventory || [];
        servicesData = services || [];
        console.log(`✅ Data loaded: ${inventoryData.length} inventory items, ${servicesData.length} services`);
        
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
    console.log('🏗️ Initializing builder page...');
    renderProducts('all');
    updateSelectedPartsDisplay();
    setupBuilderListeners();
    updateBuildSummary();
    setup3DViewerEvents();
}

// ============================================
// GET SPECS FOR COMPONENT
// ============================================

function getSpecsForComponent(part) {
    const specs = [];
    if (part.i_category === 'cpu') {
        if (part.i_cpu_cores) specs.push(`${part.i_cpu_cores} Cores`);
        if (part.i_cpu_clock_speed) specs.push(part.i_cpu_clock_speed);
    }
    if (part.i_category === 'ram') {
        if (part.i_ram_speed) specs.push(part.i_ram_speed);
        if (part.i_ram_type) specs.push(part.i_ram_type);
    }
    if (part.i_category === 'gpu') {
        if (part.i_gpu_memory) specs.push(part.i_gpu_memory);
    }
    if (part.i_category === 'storage') {
        if (part.i_storage_type) specs.push(part.i_storage_type);
        if (part.i_storage_speed) specs.push(part.i_storage_speed);
    }
    if (part.i_category === 'motherboard') {
        if (part.i_motherboard_socket) specs.push(part.i_motherboard_socket);
        if (part.i_motherboard_chipset) specs.push(part.i_motherboard_chipset);
    }
    if (part.i_category === 'psu') {
        if (part.i_psu_wattage) specs.push(`${part.i_psu_wattage}W`);
        if (part.i_psu_certification) specs.push(part.i_psu_certification);
    }
    return specs.join(' • ');
}

// ============================================
// GET PRODUCT IMAGE URL
// ============================================

function getProductImageUrl(imagePath) {
    if (!imagePath) return null;
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    
    const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
    const bucket = 'images';
    const encodedPath = encodeURIComponent(imagePath);
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

// ============================================
// GET AI SPECS
// ============================================

function getAISpecs(product) {
    const specs = {
        cpu: {
            label: 'CPU',
            specs: [
                { key: 'Cores', value: product.i_cpu_cores || 'N/A' },
                { key: 'Clock Speed', value: product.i_cpu_clock_speed || 'N/A' },
                { key: 'Socket', value: product.i_motherboard_socket || 'N/A' },
                { key: 'TDP', value: product.i_psu_wattage ? `${product.i_psu_wattage}W` : 'N/A' }
            ]
        },
        ram: {
            label: 'RAM',
            specs: [
                { key: 'Speed', value: product.i_ram_speed || 'N/A' },
                { key: 'Type', value: product.i_ram_type || 'N/A' },
                { key: 'Capacity', value: product.i_name ? product.i_name.match(/\d+GB/)?.[0] || 'N/A' : 'N/A' }
            ]
        },
        gpu: {
            label: 'GPU',
            specs: [
                { key: 'Memory', value: product.i_gpu_memory || 'N/A' },
                { key: 'Interface', value: 'PCIe x16' },
                { key: 'VRAM', value: product.i_gpu_memory || 'N/A' }
            ]
        },
        storage: {
            label: 'Storage',
            specs: [
                { key: 'Type', value: product.i_storage_type || 'N/A' },
                { key: 'Speed', value: product.i_storage_speed || 'N/A' },
                { key: 'Capacity', value: product.i_name ? product.i_name.match(/\d+TB|\d+GB/)?.[0] || 'N/A' : 'N/A' }
            ]
        },
        motherboard: {
            label: 'Motherboard',
            specs: [
                { key: 'Socket', value: product.i_motherboard_socket || 'N/A' },
                { key: 'Chipset', value: product.i_motherboard_chipset || 'N/A' },
                { key: 'RAM Slots', value: product.i_ram_type || 'N/A' }
            ]
        },
        psu: {
            label: 'PSU',
            specs: [
                { key: 'Wattage', value: product.i_psu_wattage ? `${product.i_psu_wattage}W` : 'N/A' },
                { key: 'Certification', value: product.i_psu_certification || 'N/A' },
                { key: 'Efficiency', value: product.i_psu_certification || 'N/A' }
            ]
        },
        cooler: {
            label: 'Cooler',
            specs: [
                { key: 'Type', value: 'Air/Liquid' },
                { key: 'Compatibility', value: product.i_motherboard_socket || 'N/A' },
                { key: 'Noise Level', value: 'N/A' }
            ]
        }
    };
    
    return specs[product.i_category] || { label: product.i_category, specs: [{ key: 'Type', value: product.i_category }] };
}

// ============================================
// RENDER PRODUCTS
// ============================================

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
        const shouldLoadImage = imageUrl && !imageUrl.includes('via.placeholder.com');
        const quantity = productQuantities[product.i_id] || 0;
        const inCart = quantity > 0;
        const aiSpecs = getAISpecs(product);
        
        return `
            <div class="product-card ${isSelected ? 'selected' : ''}" data-product-id="${product.i_id}">
                <div class="product-image" onclick="window.showProductDetail(${product.i_id})">
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
                    <span class="product-badge">${product.i_category.toUpperCase()}</span>
                </div>
                <h4>${product.i_name}</h4>
                
                <div class="product-ai-specs">
                    ${aiSpecs.specs.filter(s => s.value && s.value !== 'N/A').map(s => `
                        <span class="spec-tag">
                            <i class="fas fa-microchip"></i> ${s.key}: ${s.value}
                        </span>
                    `).join('')}
                </div>
                
                <div class="product-price">RM ${product.i_price}</div>
                <div class="product-stock ${product.i_quantity < 5 ? 'low-stock' : ''}">
                    <i class="fas fa-box"></i> ${product.i_quantity} in stock
                </div>
                
                <div class="product-quantity-control">
                    ${inCart ? `
                        <div class="qty-control">
                            <button class="qty-btn" onclick="window.updateProductQuantity(${product.i_id}, -1, ${product.i_quantity})">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" class="qty-input" value="${quantity}" min="0" max="${product.i_quantity}" 
                                   onchange="window.updateProductQuantity(${product.i_id}, 0, ${product.i_quantity}, this.value)"
                                   onfocus="this.select()">
                            <button class="qty-btn" onclick="window.updateProductQuantity(${product.i_id}, 1, ${product.i_quantity})">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <button class="btn-remove" onclick="window.removeFromCart(${product.i_id})">
                            <i class="fas fa-trash-alt"></i> Remove
                        </button>
                    ` : `
                        <button class="btn-buy" onclick="window.addToCartWithQuantity(${product.i_id})">
                            <i class="fas fa-shopping-cart"></i> Buy
                        </button>
                    `}
                </div>
                
                <div class="product-actions">
                    <button class="btn-select ${isSelected ? 'selected-btn' : ''}" onclick="event.stopPropagation(); window.selectForBuild(${product.i_id})">
                        <i class="fas fa-${isSelected ? 'check-circle' : 'plus-circle'}"></i> 
                        ${isSelected ? 'Selected' : 'Select for Build'}
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

// ============================================
// QUANTITY CONTROL FUNCTIONS
// ============================================

window.updateProductQuantity = function(productId, change, maxStock, newValue) {
    const product = inventoryData.find(p => p.i_id === productId);
    if (!product) return;
    
    let currentQty = productQuantities[productId] || 0;
    let newQty;
    
    if (newValue !== undefined) {
        newQty = parseInt(newValue) || 0;
    } else {
        newQty = currentQty + change;
    }
    
    if (newQty < 0) newQty = 0;
    if (newQty > maxStock) {
        showToast(`Only ${maxStock} units available in stock.`, 'warning');
        newQty = maxStock;
    }
    
    if (newQty === 0 && currentQty > 0) {
        window.removeFromCart(productId);
        return;
    }
    
    if (newQty === 0) {
        delete productQuantities[productId];
    } else {
        productQuantities[productId] = newQty;
    }
    
    renderProducts(getCurrentCategory());
    updateCartCountDisplay();
};

window.addToCartWithQuantity = function(productId) {
    const product = inventoryData.find(p => p.i_id === productId);
    if (!product) return;
    
    if (product.i_quantity <= 0) {
        showToast('This product is out of stock.', 'error');
        return;
    }
    
    // Start with quantity 1 in local state
    productQuantities[productId] = 1;
    renderProducts(getCurrentCategory());
    
    // Add to actual cart
    window.addToCart(productId);
    
    if (!selectedParts[product.i_category]) {
        window.selectForBuild(productId);
    }
    
    updateCartCountDisplay();
};

window.removeFromCart = async function(productId) {
    const product = inventoryData.find(p => p.i_id === productId);
    if (!product) return;
    
    if (!confirm(`Remove "${product.i_name}" from your cart?`)) return;
    
    try {
        // Remove from database
        const user = getUser();
        if (user) {
            await dataService.ensureInitialized();
            const cartId = dataService.currentCartId;
            
            if (cartId) {
                await supabase
                    .from('cart_items')
                    .delete()
                    .eq('cart_id', cartId)
                    .eq('i_id', productId);
            }
        }
        
        // Remove from local state
        delete productQuantities[productId];
        
        // Remove from local cart storage
        const localCart = getLocalCart();
        const filtered = localCart.filter(i => !(i.type === 'product' && i.id === productId));
        saveLocalCart(filtered);
        
        renderProducts(getCurrentCategory());
        await updateCartCountDisplay();
        showToast(`Removed ${product.i_name} from cart.`, 'info');
        
    } catch (error) {
        console.error('Error removing from cart:', error);
        showToast('Failed to remove item.', 'error');
    }
};

// ============================================
// PRODUCT DETAIL MODAL
// ============================================

window.showProductDetail = function(productId) {
    const product = inventoryData.find(p => p.i_id === productId);
    if (!product) return;
    
    const modal = document.getElementById('compatibilityModal');
    const modalMessage = document.getElementById('modalMessage');
    if (!modal || !modalMessage) return;
    
    const isSelected = selectedParts[product.i_category] === product.i_id;
    const imageUrl = getProductImageUrl(product.i_image_path);
    const shouldLoadImage = imageUrl && !imageUrl.includes('via.placeholder.com');
    const aiSpecs = getAISpecs(product);
    
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
            
            <div style="text-align: left; display: grid; gap: 8px; margin-bottom: 15px;">
                <p><strong>Brand:</strong> ${product.i_brand || 'N/A'}</p>
                <p><strong>Price:</strong> RM ${product.i_price}</p>
                <p><strong>Stock:</strong> ${product.i_quantity} units</p>
                ${aiSpecs.specs.filter(s => s.value && s.value !== 'N/A').map(s => `
                    <p><strong>${s.key}:</strong> ${s.value}</p>
                `).join('')}
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
                <button class="btn-select ${isSelected ? 'selected-btn' : ''}" onclick="window.selectForBuild(${product.i_id})" style="flex: 1;">
                    <i class="fas fa-${isSelected ? 'check-circle' : 'plus-circle'}"></i> 
                    ${isSelected ? 'Selected' : 'Select for Build'}
                </button>
                <button class="btn-add" onclick="window.addToCartWithQuantity(${product.i_id})" style="flex: 1;">
                    <i class="fas fa-cart-plus"></i> Add to Cart
                </button>
            </div>
        </div>
    `;
    
    modal.querySelector('.modal-header h3').textContent = 'Product Details';
    modal.style.display = 'flex';
};

// ============================================
// 3D VIEWER FUNCTIONS
// ============================================

function initialize3DViewer() {
    console.log('🎮 Initializing 3D Viewer...');
    
    const viewerContainer = document.getElementById('sidebarPc3dViewer');
    
    if (!viewerContainer) {
        console.warn('⚠️ 3D viewer container not found: #sidebarPc3dViewer');
        return;
    }
    
    console.log('📦 3D viewer container found:', viewerContainer.id);

    try {
        pcViewer = new Pc3DViewer();
        console.log('✅ Pc3DViewer instance created');
        
        pcViewer.init('sidebarPc3dViewer').then(() => {
            console.log('✅ 3D Viewer initialized successfully');
            viewerInitialized = true;
            viewerReady = true;
            update3DViewer();
        }).catch(err => {
            console.error('❌ Failed to initialize 3D viewer:', err);
            viewerInitialized = false;
            viewerReady = false;
        });
    } catch (error) {
        console.error('❌ Error creating 3D viewer:', error);
        viewerInitialized = false;
        viewerReady = false;
    }
}

function update3DViewer() {
    console.log('🔄 update3DViewer called');
    
    if (!pcViewer || !viewerReady) {
        console.warn('⚠️ 3D viewer not ready, skipping update');
        return;
    }

    const components = [];
    for (const category in selectedParts) {
        if (selectedParts[category]) {
            const part = inventoryData.find(p => p.i_id === selectedParts[category]);
            if (part) {
                components.push({
                    name: part.i_name,
                    category: part.i_category,
                    brand: part.i_brand || '',
                    price: part.i_price,
                    quantity: 1,
                    specs: getSpecsForComponent(part),
                    image_path: part.i_image_path || null
                });
            }
        }
    }

    if (components.length > 0) {
        try {
            pcViewer.displayComponents(components);
            // Also update modal viewer if initialized
            if (modalViewerInitialized && modalViewer) {
                setTimeout(() => syncModalViewer(), 100);
            }
        } catch (error) {
            console.error('❌ Error displaying components:', error);
        }
    } else {
        try {
            pcViewer.showEmptyState();
            if (modalViewerInitialized && modalViewer) {
                modalViewer.showEmptyState();
            }
        } catch (error) {
            console.error('❌ Error showing empty state:', error);
        }
    }
}

// ============================================
// MODAL 3D VIEWER
// ============================================

function initializeModalViewer() {
    console.log('🎬 Initializing Modal 3D Viewer...');
    
    const container = document.getElementById('pc3dModalViewer');
    if (!container) {
        console.warn('⚠️ Modal viewer container not found');
        return;
    }

    try {
        modalViewer = new Pc3DViewer();
        modalViewer.containerId = 'pc3dModalViewer';
        modalViewer.container = container;
        
        modalViewer.init('pc3dModalViewer').then(() => {
            console.log('✅ Modal 3D Viewer initialized');
            modalViewerInitialized = true;
            syncModalViewer();
        }).catch(err => {
            console.error('❌ Failed to initialize modal viewer:', err);
            modalViewerInitialized = false;
        });
    } catch (error) {
        console.error('❌ Error creating modal viewer:', error);
        modalViewerInitialized = false;
    }
}

function syncModalViewer() {
    if (!modalViewerInitialized || !modalViewer) return;

    const components = [];
    for (const category in selectedParts) {
        if (selectedParts[category]) {
            const part = inventoryData.find(p => p.i_id === selectedParts[category]);
            if (part) {
                components.push({
                    name: part.i_name,
                    category: part.i_category,
                    brand: part.i_brand || '',
                    price: part.i_price,
                    quantity: 1,
                    specs: getSpecsForComponent(part),
                    image_path: part.i_image_path || null
                });
            }
        }
    }

    if (components.length > 0) {
        modalViewer.displayComponents(components);
    } else {
        modalViewer.showEmptyState();
    }
}

function expand3DViewer() {
    console.log('🔍 Expanding 3D viewer...');
    
    const modal = document.getElementById('pc3dModal');
    if (!modal) return;

    if (!modalViewerInitialized) {
        initializeModalViewer();
    } else {
        syncModalViewer();
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    const status = document.getElementById('modalRotateStatus');
    if (status && modalViewer) {
        const isRotating = modalViewer.autoRotate !== false;
        status.innerHTML = isRotating ? 
            '<i class="fas fa-sync-alt fa-spin"></i> Auto-rotate' : 
            '<i class="fas fa-pause"></i> Paused';
    }
}

function close3DModal() {
    const modal = document.getElementById('pc3dModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function setup3DViewerEvents() {
    const expandBtn = document.getElementById('expand3dBtn');
    if (expandBtn) {
        expandBtn.addEventListener('click', expand3DViewer);
    }

    const closeBtn = document.getElementById('pc3dModalClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', close3DModal);
    }

    const modal = document.getElementById('pc3dModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                close3DModal();
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modalEl = document.getElementById('pc3dModal');
            if (modalEl && modalEl.style.display === 'flex') {
                close3DModal();
            }
        }
        if (e.key === ' ' && document.getElementById('pc3dModal')?.style.display === 'flex') {
            e.preventDefault();
            if (modalViewer) {
                modalViewer.autoRotate = !modalViewer.autoRotate;
                if (modalViewer.controls) {
                    modalViewer.controls.autoRotate = modalViewer.autoRotate;
                }
                const status = document.getElementById('modalRotateStatus');
                if (status) {
                    status.innerHTML = modalViewer.autoRotate ? 
                        '<i class="fas fa-sync-alt fa-spin"></i> Auto-rotate' : 
                        '<i class="fas fa-pause"></i> Paused';
                }
            }
        }
    });
}

// ============================================
// SELECT FOR BUILD
// ============================================

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
        setTimeout(() => update3DViewer(), 100);
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
    
    setTimeout(() => {
        update3DViewer();
    }, 200);
};

// ============================================
// BUILD SUMMARY FUNCTIONS
// ============================================

function resetCompleteButton() {
    const btn = document.getElementById('completeBuildBtn');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-check"></i> Complete Build';
        btn.style.background = '#00d4ff';
    }
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
    let partCount = 0;
    
    for (const category in selectedParts) {
        if (selectedParts[category]) {
            const part = inventoryData.find(p => p.i_id === selectedParts[category]);
            if (part) {
                total += parseFloat(part.i_price);
                partCount++;
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
    
    if (!html) {
        html = '<p class="empty-build">No components selected</p>';
    } else {
        html = `<div style="font-size:12px;color:#888;padding:4px 0 8px 0;">${partCount} parts selected</div>` + html;
    }
    summaryList.innerHTML = html;
    buildTotal.textContent = `RM ${total.toFixed(2)}`;
}

window.removeFromBuild = function(category) {
    selectedParts[category] = null;
    buildCompleted = false;
    resetCompleteButton();
    updateSelectedPartsDisplay();
    updateBuildSummary();
    renderProducts(getCurrentCategory());
    setTimeout(() => update3DViewer(), 100);
};

// ============================================
// COMPATIBILITY FUNCTIONS
// ============================================

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

// ============================================
// SERVICES
// ============================================

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

window.bookService = async function(serviceId) {
    try {
        console.log('📚 Booking service:', serviceId);
        
        const service = servicesData.find(s => s.service_id === serviceId);
        if (!service) {
            showToast('Service not found.', 'error');
            return;
        }
        
        console.log('📦 Service found:', service);
        
        // Ensure we have a cart
        await dataService.ensureInitialized();
        let cartId = dataService.currentCartId;
        
        if (!cartId) {
            cartId = await dataService.createNewCart();
        }
        
        if (!cartId) {
            showToast('Failed to create cart.', 'error');
            return;
        }
        
        console.log('🛒 Cart ID:', cartId);
        
        // Check if service already exists in cart
        const { data: existing, error: checkError } = await supabase
            .from('cart_service')
            .select('cs_id')
            .eq('cart_id', cartId)
            .eq('service_id', serviceId)
            .maybeSingle();
        
        if (checkError) {
            console.error('Error checking existing service:', checkError);
        }
        
        if (existing) {
            showToast(`${service.service_name} is already in your cart.`, 'warning');
            return;
        }
        
        // ============================================
        // FIX: Insert with correct service_id
        // ============================================
        const { data: insertData, error: insertError } = await supabase
            .from('cart_service')
            .insert({
                cart_id: cartId,
                service_id: serviceId  // Make sure this is the actual service_id, not null
            })
            .select();
        
        if (insertError) {
            console.error('Error inserting service:', insertError);
            showToast('Failed to book service: ' + insertError.message, 'error');
            return;
        }
        
        console.log('✅ Service inserted:', insertData);
        
        // Also add to local cart for display
        const localCart = getLocalCart();
        const existingLocal = localCart.find(item => item.type === 'service' && item.id === serviceId);
        if (!existingLocal) {
            localCart.push({
                type: 'service',
                id: serviceId,
                name: service.service_name,
                price: service.service_price,
                quantity: 1
            });
            saveLocalCart(localCart);
        }
        
        await updateCartCountDisplay();
        showModal('Service Booked!', `${service.service_name} has been added to your cart.`);
        
    } catch (error) {
        console.error('Error booking service:', error);
        showToast('Failed to book service: ' + error.message, 'error');
    }
};

window.addToCart = async function(productId) {
    try {
        const product = inventoryData.find(p => p.i_id === productId);
        if (!product) {
            showToast('Product not found.', 'error');
            return;
        }
        
        // Ensure we have a cart
        await dataService.ensureInitialized();
        let cartId = dataService.currentCartId;
        
        if (!cartId) {
            cartId = await dataService.createNewCart();
        }
        
        if (!cartId) {
            showToast('Failed to create cart.', 'error');
            return;
        }
        
        const quantity = 1;
        const price = parseFloat(product.i_price);
        const totalPrice = price * quantity;
        
        // Check if item already exists in cart
        const { data: existing } = await supabase
            .from('cart_items')
            .select('ci_id, quantity')
            .eq('cart_id', cartId)
            .eq('i_id', productId)
            .maybeSingle();
        
        if (existing) {
            // Update existing
            await supabase
                .from('cart_items')
                .update({
                    quantity: existing.quantity + quantity,
                    total_price: (existing.quantity + quantity) * price
                })
                .eq('ci_id', existing.ci_id);
            showToast(`Updated ${product.i_name} quantity in cart!`, 'success');
        } else {
            // Insert new
            await supabase
                .from('cart_items')
                .insert({
                    cart_id: cartId,
                    i_id: productId,
                    quantity: quantity,
                    total_price: totalPrice
                });
            showToast(`${product.i_name} added to cart!`, 'success');
        }
        
        // Also add to local cart for display
        const localCart = getLocalCart();
        const existingLocal = localCart.find(item => item.type === 'product' && item.id === productId);
        if (existingLocal) {
            existingLocal.quantity += quantity;
        } else {
            localCart.push({
                type: 'product',
                id: productId,
                name: product.i_name,
                price: price,
                quantity: quantity
            });
        }
        saveLocalCart(localCart);
        
        await updateCartCountDisplay();
        
    } catch (error) {
        console.error('Error adding to cart:', error);
        showToast('Failed to add item to cart: ' + error.message, 'error');
    }
};

// ============================================
// TOAST NOTIFICATION
// ============================================

function showToast(message, type = 'info') {
    const existing = document.querySelector('.custom-toast');
    if (existing) existing.remove();
    
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#00d4ff'
    };
    
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: ${colors[type] || '#1a1a2e'};
        color: white;
        padding: 14px 24px;
        border-radius: 12px;
        z-index: 99999;
        box-shadow: 0 8px 30px rgba(0,0,0,0.25);
        animation: slideUp 0.4s ease;
        max-width: 400px;
        font-size: 14px;
        font-weight: 500;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// SORTING
// ============================================

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

function getCurrentCategory() {
    const activeCategory = document.querySelector('.category-item.active');
    return activeCategory ? activeCategory.dataset.category : 'all';
}

window.selectBuilderCategory = function(category) {
    renderProducts(category);
};

// ============================================
// SETUP LISTENERS
// ============================================

function setupBuilderListeners() {
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            renderProducts(item.dataset.category);
        });
    });
    
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
            
            try {
                // Get current user/session
                const user = getUser();
                
                // Ensure we have a cart
                await dataService.ensureInitialized();
                let cartId = dataService.currentCartId;
                
                if (!cartId) {
                    cartId = await dataService.createNewCart();
                }
                
                if (!cartId) {
                    showModal('Error', 'Failed to create cart. Please try again.');
                    return;
                }
                
                let addedCount = 0;
                let totalPrice = 0;
                const addedParts = [];
                
                // Add each selected part to cart_items
                for (const category in selectedParts) {
                    if (selectedParts[category]) {
                        const part = inventoryData.find(p => p.i_id === selectedParts[category]);
                        if (part) {
                            const quantity = 1;
                            const price = parseFloat(part.i_price);
                            const itemTotal = price * quantity;
                            totalPrice += itemTotal;
                            
                            // Check if item already exists in cart
                            const { data: existing } = await supabase
                                .from('cart_items')
                                .select('ci_id, quantity')
                                .eq('cart_id', cartId)
                                .eq('i_id', part.i_id)
                                .maybeSingle();
                            
                            if (existing) {
                                // Update existing
                                await supabase
                                    .from('cart_items')
                                    .update({
                                        quantity: existing.quantity + quantity,
                                        total_price: (existing.quantity + quantity) * price
                                    })
                                    .eq('ci_id', existing.ci_id);
                            } else {
                                // Insert new
                                await supabase
                                    .from('cart_items')
                                    .insert({
                                        cart_id: cartId,
                                        i_id: part.i_id,
                                        quantity: quantity,
                                        total_price: itemTotal
                                    });
                            }
                            
                            addedCount++;
                            addedParts.push(part.i_name);
                        }
                    }
                }
                
                if (addedCount > 0) {
                    buildCompleted = true;
                    document.getElementById('completeBuildBtn').innerHTML = 
                        `<i class="fas fa-check"></i> Added (${addedCount} parts, RM ${totalPrice.toFixed(2)})`;
                    document.getElementById('completeBuildBtn').style.background = '#4CAF50';
                    
                    // Update cart count
                    await updateCartCountDisplay();
                    
                    showModal(
                        'Build Complete! 🎉', 
                        `Added ${addedCount} parts to your cart.\nTotal: RM ${totalPrice.toFixed(2)}\n\nParts: ${addedParts.join(', ')}`,
                        'Review your cart to checkout.'
                    );
                } else {
                    showModal('Error', 'No parts were added to the cart.');
                }
                
            } catch (error) {
                console.error('Error adding build to cart:', error);
                showModal('Error', 'Failed to add parts to cart: ' + error.message);
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

// ============================================
// AI COMPATIBILITY CHECK
// ============================================

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

// ============================================
// EXPOSE GLOBALLY
// ============================================

window.getProductImageUrl = getProductImageUrl;
window.inventoryData = inventoryData;
window.update3DViewer = update3DViewer;
window.initialize3DViewer = initialize3DViewer;
window.expand3DViewer = expand3DViewer;
window.close3DModal = close3DModal;
window.selectedParts = selectedParts;

console.log('✅ script.js loaded with 3D viewer debug');