// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\prebuilt-detail.js

import supabase from './supabase-client.js';
import Pc3DViewer from './services/buildcores.js';

let currentBundle = null;
let bundleComponents = [];
let currentImageIndex = 0;
let pc3dViewer = null;
let debugLogs = [];

// Debug helper
function debugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, message, data };
    debugLogs.push(logEntry);
    console.log(`[DEBUG ${timestamp}] ${message}`, data || '');
    
    // Show debug in UI if element exists
    const debugElement = document.getElementById('debugOutput');
    if (debugElement) {
        const entry = document.createElement('div');
        entry.style.cssText = 'padding: 2px 0; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05);';
        entry.textContent = `${timestamp.substring(11, 19)}: ${message}`;
        debugElement.appendChild(entry);
        if (debugElement.children.length > 50) {
            debugElement.removeChild(debugElement.firstChild);
        }
        debugElement.scrollTop = debugElement.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    debugLog('🚀 Page loaded, initializing...');
    
    const urlParams = new URLSearchParams(window.location.search);
    const bundleId = urlParams.get('id');
    debugLog(`📋 Bundle ID from URL: ${bundleId}`);
    
    if (!bundleId) {
        debugLog('❌ No bundle ID found, redirecting to prebuilt.html');
        window.location.href = 'prebuilt.html';
        return;
    }
    
    // Initialize 3D viewer
    await init3DViewer();
    await loadBundleDetails(bundleId);
    updateCartCount();
    
    debugLog('✅ Initialization complete');
});

async function init3DViewer() {
    debugLog('🎬 Initializing 3D viewer...');
    try {
        // Check if container exists
        const container = document.getElementById('sidebarPc3dViewer');
        debugLog(`📦 Container found: ${!!container}`, container);
        
        if (!container) {
            debugLog('❌ Container #sidebarPc3dViewer not found!');
            return false;
        }
        
        debugLog('🔄 Creating Pc3DViewer instance...');
        pc3dViewer = new Pc3DViewer();
        debugLog('✅ Pc3DViewer instance created');
        
        debugLog('🔄 Calling pc3dViewer.init()...');
        const initialized = await pc3dViewer.init('sidebarPc3dViewer');
        debugLog(`📊 init() result: ${initialized}`);
        
        if (!initialized) {
            debugLog('⚠️ 3D viewer not initialized, will retry after components load');
        } else {
            debugLog('✅ 3D viewer initialized successfully');
        }
        return initialized;
    } catch (error) {
        debugLog(`❌ Failed to init 3D viewer: ${error.message}`, error);
        console.error('3D viewer init error:', error);
        return false;
    }
}

async function loadBundleDetails(bundleId) {
    debugLog(`📊 Loading bundle details for ID: ${bundleId}`);
    
    try {
        debugLog('🔄 Fetching bundle data from Supabase...');
        const { data: bundleData, error: bundleError } = await supabase
            .from('bundles')
            .select('*')
            .eq('bundle_id', bundleId)
            .single();
        
        if (bundleError || !bundleData) {
            debugLog(`❌ Bundle error: ${bundleError?.message || 'No data found'}`, bundleError);
            showError('Pre-built PC not found');
            return;
        }
        
        debugLog('✅ Bundle data loaded', bundleData);
        currentBundle = bundleData;
        
        debugLog('🔄 Fetching bundle items...');
        const { data: itemsData, error: itemsError } = await supabase
            .from('bundle_items')
            .select(`
                quantity,
                inventory:i_id (
                    i_id,
                    i_name,
                    i_category,
                    i_brand,
                    i_price,
                    i_quantity,
                    i_image_path,
                    i_cpu_cores,
                    i_cpu_clock_speed,
                    i_ram_speed,
                    i_ram_type,
                    i_gpu_memory,
                    i_storage_type,
                    i_storage_speed,
                    i_motherboard_socket,
                    i_motherboard_chipset,
                    i_psu_wattage,
                    i_psu_certification
                )
            `)
            .eq('bundle_id', bundleId);
        
        if (itemsError) {
            debugLog(`⚠️ Items error: ${itemsError.message}`, itemsError);
            console.error('Error loading bundle items:', itemsError);
        }
        
        bundleComponents = itemsData || [];
        debugLog(`📊 Loaded ${bundleComponents.length} components`, bundleComponents);
        
        // Debug: Log each component
        bundleComponents.forEach((item, index) => {
            debugLog(`  Component ${index + 1}: ${item.inventory?.i_name} (${item.inventory?.i_category})`);
        });
        
        // Render the page
        debugLog('🔄 Rendering bundle details...');
        renderBundleDetails();
        debugLog('✅ Bundle details rendered');
        
        // Display components in 3D viewer
        debugLog('🔄 Attempting to display 3D components...');
        await display3DComponents();
        
    } catch (error) {
        debugLog(`❌ Error loading bundle details: ${error.message}`, error);
        console.error('Error loading bundle details:', error);
        showError('Failed to load PC details');
    }
}

async function display3DComponents() {
    debugLog('🎮 display3DComponents() called');
    debugLog(`📊 Components count: ${bundleComponents.length}`);
    
    try {
        // Convert bundle components to format expected by 3D viewer
        const components = bundleComponents.map((item, index) => {
            const inv = item.inventory;
            debugLog(`  Mapping component ${index + 1}: ${inv?.i_name} (${inv?.i_category})`);
            return {
                id: inv.i_id,
                name: inv.i_name,
                category: inv.i_category,
                brand: inv.i_brand,
                price: inv.i_price,
                quantity: item.quantity || 1,
                image_path: inv.i_image_path,
                // Include specs for 3D rendering
                cpu_cores: inv.i_cpu_cores,
                cpu_clock_speed: inv.i_cpu_clock_speed,
                ram_speed: inv.i_ram_speed,
                ram_type: inv.i_ram_type,
                gpu_memory: inv.i_gpu_memory,
                storage_type: inv.i_storage_type,
                storage_speed: inv.i_storage_speed,
                motherboard_socket: inv.i_motherboard_socket,
                motherboard_chipset: inv.i_motherboard_chipset,
                psu_wattage: inv.i_psu_wattage,
                psu_certification: inv.i_psu_certification
            };
        });

        debugLog(`🎮 Rendering 3D with ${components.length} components`, components);

        // Check if viewer exists, if not re-initialize
        if (!pc3dViewer) {
            debugLog('⚠️ pc3dViewer is null, re-initializing...');
            await init3DViewer();
        }

        if (!pc3dViewer) {
            debugLog('❌ pc3dViewer is still null after re-initialization!');
            show3DFallback('3D viewer failed to initialize');
            return;
        }

        debugLog(`✅ pc3dViewer exists, isLoaded: ${pc3dViewer.isLoaded}, isInitialized: ${pc3dViewer.isInitialized}`);

        if (components.length === 0) {
            debugLog('⚠️ No components to display in 3D');
            show3DFallback('No components to display');
            return;
        }

        debugLog('🔄 Calling pc3dViewer.displayComponents()...');
        const result = await pc3dViewer.displayComponents(components);
        debugLog(`📊 displayComponents() result: ${result}`);
        
        if (!result) {
            debugLog('⚠️ displayComponents() returned false, showing fallback');
            show3DFallback('Failed to render 3D preview');
        } else {
            debugLog('✅ 3D components displayed successfully!');
        }
        
    } catch (error) {
        debugLog(`❌ Error displaying 3D components: ${error.message}`, error);
        console.error('Error displaying 3D components:', error);
        show3DFallback(`Error: ${error.message}`);
    }
}

function show3DFallback(message) {
    debugLog(`🔄 Showing 3D fallback: ${message}`);
    const sidebar = document.getElementById('sidebarPc3dViewer');
    if (sidebar) {
        sidebar.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 12px;
                color: rgba(255,255,255,0.3);
                font-size: 14px;
                flex-direction: column;
                gap: 10px;
                padding: 20px;
                text-align: center;
            ">
                <i class="fas fa-cube" style="font-size: 48px; opacity: 0.3;"></i>
                <p style="margin: 0;">${message || '3D preview unavailable'}</p>
                <p style="margin: 0; font-size: 10px; opacity: 0.5;">Check console for details</p>
            </div>
        `;
    }
}

function getImageUrl(imagePath) {
    if (!imagePath) {
        return null;
    }
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    
    const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
    const bucket = 'images';
    return SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + encodeURIComponent(imagePath);
}

function renderBundleDetails() {
    debugLog('📄 renderBundleDetails() called');
    
    document.title = currentBundle.bundle_name + ' - BuildBuddy';
    
    const container = document.getElementById('bundleDetailContainer');
    debugLog(`📦 Container found: ${!!container}`);
    
    if (!container) {
        debugLog('❌ Container #bundleDetailContainer not found!');
        return;
    }
    
    const stockStatus = getStockStatus(currentBundle.bundle_stock);
    const categoryBadge = currentBundle.bundle_category || 'general';
    const badgeClass = 'badge-' + categoryBadge;
    
    // Get main image
    let mainImagePath = null;
    for (let i = 0; i < bundleComponents.length; i++) {
        const item = bundleComponents[i];
        if (item.inventory.i_image_path && !item.inventory.i_image_path.startsWith('http')) {
            mainImagePath = item.inventory.i_image_path;
            debugLog(`🖼️ Found main image at index ${i}: ${mainImagePath}`);
            break;
        }
    }
    
    const mainImageUrl = mainImagePath ? getImageUrl(mainImagePath) : null;
    debugLog(`🖼️ Main image URL: ${mainImageUrl || 'none'}`);
    
    const bundleId = currentBundle.bundle_id;
    const bundleName = currentBundle.bundle_name;
    const bundlePrice = currentBundle.bundle_price;
    const bundleDescription = currentBundle.bundle_description || 'Professionally built and tested gaming PC.';
    const isDisabled = currentBundle.bundle_stock === 0 ? 'disabled' : '';
    const buttonText = currentBundle.bundle_stock === 0 ? 'Out of Stock' : 'Add to Cart';
    
    // Build image HTML with direct onclick
    let imageHtml = '';
    if (mainImageUrl) {
        imageHtml = '<img src="' + mainImageUrl + '" alt="' + bundleName + '" id="mainImageImg">';
    } else {
        imageHtml = '<i class="fas fa-desktop placeholder-icon"></i>';
    }
    
    debugLog('🔄 Rendering HTML...');
    
    container.innerHTML = `
        <!-- Debug Panel -->
        <div style="background: #1a1a2e; border-radius: 8px; padding: 10px; margin-bottom: 20px; border: 1px solid #00d4ff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #00d4ff; font-weight: bold; font-size: 12px;">🐛 Debug Console</span>
                <button onclick="document.getElementById('debugOutput').innerHTML = ''" style="background: none; border: none; color: #666; cursor: pointer; font-size: 10px;">Clear</button>
            </div>
            <div id="debugOutput" style="max-height: 100px; overflow-y: auto; font-family: monospace; color: #00ff41; font-size: 10px; background: #0a0a0f; padding: 8px; border-radius: 4px;"></div>
        </div>

        <div class="pc-detail-container">
            <!-- Main Content -->
            <div class="pc-main-content">
                <div class="pc-image-section">
                    <div class="pc-main-image" id="mainImage" onclick="window.zoomImage()">
                        ${imageHtml}
                        <span class="zoom-hint" id="zoomHint"><i class="fas fa-search-plus"></i> Click to zoom</span>
                    </div>
                    <div class="pc-thumbnails" id="thumbnails">
                        ${renderThumbnails()}
                    </div>
                </div>
                
                <div class="pc-info-section">
                    <span class="pc-category-badge ${badgeClass}">${categoryBadge}</span>
                    <h1 class="pc-title">${bundleName}</h1>
                    <div class="pc-price-large">RM ${bundlePrice}</div>
                    <p class="pc-description">${bundleDescription}</p>
                    
                    <div class="pc-stock-info">
                        <span class="stock-badge ${stockStatus.class}">${stockStatus.text}</span>
                        <span><i class="fas fa-truck"></i> Free Shipping</span>
                        <span><i class="fas fa-shield-alt"></i> 3 Year Warranty</span>
                    </div>
                    
                    <button class="btn-primary btn-large" onclick="window.addBundleToCart(${bundleId})" ${isDisabled}>
                        <i class="fas fa-shopping-cart"></i> ${buttonText}
                    </button>
                    <button class="btn-outline" onclick="window.location.href='prebuilt.html'">
                        <i class="fas fa-arrow-left"></i> Back to Pre-Built PCs
                    </button>
                </div>
            </div>
            
            <!-- 3D Viewer Sidebar -->
            <div class="pc-3d-sidebar">
                <h3 class="sidebar-title"><i class="fas fa-cube"></i> 3D Preview</h3>
                <div id="sidebarPc3dViewer" class="pc-3d-viewer">
                    <div style="
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        border-radius: 12px;
                        color: rgba(255,255,255,0.3);
                        font-size: 14px;
                        flex-direction: column;
                        gap: 10px;
                    ">
                        <i class="fas fa-spinner fa-spin" style="font-size: 32px;"></i>
                        <p>Loading 3D preview...</p>
                    </div>
                </div>
                <div class="sidebar-controls">
                    <button onclick="window.toggle3DRotation()" class="btn-3d-control">
                        <i class="fas fa-sync-alt"></i> Toggle Rotation
                    </button>
                    <button onclick="window.reset3DView()" class="btn-3d-control">
                        <i class="fas fa-home"></i> Reset View
                    </button>
                    <button onclick="window.reload3DView()" class="btn-3d-control" style="background: rgba(0,212,255,0.1);">
                        <i class="fas fa-redo"></i> Reload
                    </button>
                </div>
                <div class="sidebar-components-list">
                    <h4>Components (${bundleComponents.length})</h4>
                    ${renderSidebarComponents()}
                </div>
            </div>
        </div>
        
        <div class="components-section">
            <h2 class="components-title">Included Components</h2>
            <div class="components-grid" id="componentsGrid">
                ${renderComponents()}
            </div>
        </div>
        
        <div class="warranty-section">
            <h2 class="components-title">What's Included</h2>
            <div class="warranty-grid">
                <div class="warranty-item">
                    <i class="fas fa-check-circle"></i>
                    <h4>Fully Assembled</h4>
                    <p>Professionally built and cable managed</p>
                </div>
                <div class="warranty-item">
                    <i class="fas fa-shield-alt"></i>
                    <h4>3 Year Warranty</h4>
                    <p>Parts and labor covered</p>
                </div>
                <div class="warranty-item">
                    <i class="fas fa-headset"></i>
                    <h4>Lifetime Support</h4>
                    <p>Free technical support forever</p>
                </div>
            </div>
        </div>
    `;
    
    debugLog('✅ HTML rendered');
    injectToastStyles();
}

function renderSidebarComponents() {
    if (bundleComponents.length === 0) {
        return '<p style="color: #666; font-size: 12px;">No components listed</p>';
    }
    
    const categoryOrder = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'cooler'];
    const sorted = [...bundleComponents].sort((a, b) => {
        return categoryOrder.indexOf(a.inventory.i_category) - categoryOrder.indexOf(b.inventory.i_category);
    });
    
    let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
    for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];
        const icon = getComponentIcon(item.inventory.i_category);
        html += `
            <li style="display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <i class="fas ${icon}" style="width: 16px; color: #00d4ff;"></i>
                <span style="flex: 1;">${item.inventory.i_name}</span>
                <span style="color: #666; font-size: 10px;">${item.inventory.i_category}</span>
            </li>
        `;
    }
    html += '</ul>';
    return html;
}

function getComponentIcon(category) {
    const icons = {
        cpu: 'fa-microchip',
        motherboard: 'fa-server',
        ram: 'fa-memory',
        gpu: 'fa-tv',
        storage: 'fa-hdd',
        psu: 'fa-plug',
        cooler: 'fa-fan'
    };
    return icons[category] || 'fa-box';
}

function renderThumbnails() {
    const imagePaths = [];
    for (let i = 0; i < bundleComponents.length; i++) {
        const path = bundleComponents[i].inventory.i_image_path;
        if (path && !path.startsWith('http')) {
            imagePaths.push(path);
        }
    }
    
    if (imagePaths.length === 0) {
        return '';
    }
    
    let html = '';
    for (let j = 0; j < imagePaths.length; j++) {
        const url = getImageUrl(imagePaths[j]);
        const activeClass = j === 0 ? 'active' : '';
        html += '<div class="thumb ' + activeClass + '" onclick="window.changeMainImage(' + j + ')">';
        html += '<img src="' + url + '" alt="Component ' + (j + 1) + '" loading="lazy">';
        html += '</div>';
    }
    
    return html;
}

function renderComponents() {
    if (bundleComponents.length === 0) {
        return '<p style="color: #666;">Component details coming soon.</p>';
    }
    
    const categoryOrder = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'cooler'];
    const sortedComponents = bundleComponents.slice().sort(function(a, b) {
        return categoryOrder.indexOf(a.inventory.i_category) - categoryOrder.indexOf(b.inventory.i_category);
    });
    
    let html = '';
    for (let i = 0; i < sortedComponents.length; i++) {
        const item = sortedComponents[i];
        const specs = getSpecsForComponent(item.inventory);
        const componentId = item.inventory.i_id;
        
        html += '<div class="component-card" onclick="window.showComponentDetail(' + componentId + ')">';
        html += '<div class="component-category">' + item.inventory.i_category + '</div>';
        html += '<div class="component-name">' + item.inventory.i_name + '</div>';
        html += '<div class="component-brand">' + (item.inventory.i_brand || '') + (item.quantity > 1 ? ' (x' + item.quantity + ')' : '') + '</div>';
        if (specs) {
            html += '<div class="component-specs">' + specs + '</div>';
        }
        html += '</div>';
    }
    
    return html;
}

function getSpecsForComponent(inventory) {
    const specs = [];
    
    if (inventory.i_category === 'cpu') {
        if (inventory.i_cpu_cores) specs.push(inventory.i_cpu_cores + ' Cores');
        if (inventory.i_cpu_clock_speed) specs.push(inventory.i_cpu_clock_speed);
    }
    
    if (inventory.i_category === 'ram') {
        if (inventory.i_ram_speed) specs.push(inventory.i_ram_speed);
        if (inventory.i_ram_type) specs.push(inventory.i_ram_type);
    }
    
    if (inventory.i_category === 'gpu') {
        if (inventory.i_gpu_memory) specs.push(inventory.i_gpu_memory);
    }
    
    if (inventory.i_category === 'storage') {
        if (inventory.i_storage_type) specs.push(inventory.i_storage_type);
        if (inventory.i_storage_speed) specs.push(inventory.i_storage_speed);
    }
    
    if (inventory.i_category === 'motherboard') {
        if (inventory.i_motherboard_socket) specs.push(inventory.i_motherboard_socket);
        if (inventory.i_motherboard_chipset) specs.push(inventory.i_motherboard_chipset);
    }
    
    if (inventory.i_category === 'psu') {
        if (inventory.i_psu_wattage) specs.push(inventory.i_psu_wattage + 'W');
        if (inventory.i_psu_certification) specs.push(inventory.i_psu_certification);
    }
    
    return specs.length > 0 ? specs.join(' • ') : '';
}

// ===== 3D Viewer Control Functions =====
window.toggle3DRotation = function() {
    debugLog('🔄 Toggle rotation clicked');
    if (pc3dViewer && pc3dViewer.controls) {
        pc3dViewer.autoRotate = !pc3dViewer.autoRotate;
        pc3dViewer.controls.autoRotate = pc3dViewer.autoRotate;
        const btn = document.querySelector('.btn-3d-control i');
        if (btn) {
            btn.className = pc3dViewer.autoRotate ? 'fas fa-pause' : 'fas fa-sync-alt';
        }
        debugLog(`Rotation ${pc3dViewer.autoRotate ? 'enabled' : 'disabled'}`);
    } else {
        debugLog('⚠️ Cannot toggle rotation - viewer not ready');
    }
};

window.reset3DView = function() {
    debugLog('🏠 Reset view clicked');
    if (pc3dViewer && pc3dViewer.camera && pc3dViewer.controls) {
        pc3dViewer.camera.position.set(4, 2.5, 4);
        pc3dViewer.controls.target.set(0, 0, 0);
        pc3dViewer.controls.update();
        debugLog('✅ View reset');
    } else {
        debugLog('⚠️ Cannot reset view - viewer not ready');
    }
};

window.reload3DView = function() {
    debugLog('🔄 Reload 3D view clicked');
    display3DComponents();
};

// ===== IMAGE ZOOM FUNCTIONS =====
window.zoomImage = function() {
    var img = document.getElementById('mainImageImg');
    var hint = document.getElementById('zoomHint');
    
    if (!img) {
        debugLog('⚠️ Zoom: Image not found');
        return;
    }
    
    // Toggle zoom class
    if (img.classList.contains('zoomed')) {
        img.classList.remove('zoomed');
        if (hint) {
            hint.innerHTML = '<i class="fas fa-search-plus"></i> Click to zoom';
        }
        debugLog('🔍 Zoom out');
    } else {
        img.classList.add('zoomed');
        if (hint) {
            hint.innerHTML = '<i class="fas fa-search-minus"></i> Click to zoom out';
        }
        debugLog('🔍 Zoom in');
    }
};

window.changeMainImage = function(index) {
    debugLog(`🖼️ Changing main image to index ${index}`);
    const imagePaths = [];
    for (let i = 0; i < bundleComponents.length; i++) {
        const path = bundleComponents[i].inventory.i_image_path;
        if (path && !path.startsWith('http')) {
            imagePaths.push(path);
        }
    }
    
    if (index >= imagePaths.length) {
        debugLog(`⚠️ Index ${index} out of range (${imagePaths.length} images)`);
        return;
    }
    
    const path = imagePaths[index];
    const url = getImageUrl(path);
    debugLog(`🖼️ New image URL: ${url}`);
    
    const mainImg = document.getElementById('mainImageImg');
    if (mainImg) {
        mainImg.src = url;
        mainImg.classList.remove('zoomed');
        const hint = document.getElementById('zoomHint');
        if (hint) {
            hint.innerHTML = '<i class="fas fa-search-plus"></i> Click to zoom';
        }
    }
    
    // Update active thumbnail
    const thumbs = document.querySelectorAll('.thumb');
    for (let j = 0; j < thumbs.length; j++) {
        if (j === index) {
            thumbs[j].classList.add('active');
        } else {
            thumbs[j].classList.remove('active');
        }
    }
    
    currentImageIndex = index;
    debugLog('✅ Image changed');
};

window.showComponentDetail = function(componentId) {
    debugLog(`🔍 Showing component detail for ID: ${componentId}`);
    let component = null;
    for (let i = 0; i < bundleComponents.length; i++) {
        if (bundleComponents[i].inventory.i_id === componentId) {
            component = bundleComponents[i];
            break;
        }
    }
    if (!component) {
        debugLog(`⚠️ Component ${componentId} not found`);
        return;
    }
    
    const inv = component.inventory;
    const imageUrl = getImageUrl(inv.i_image_path);
    debugLog(`📦 Component: ${inv.i_name} (${inv.i_category})`);
    
    const modal = document.createElement('div');
    modal.className = 'component-modal';
    
    let imageHtml = '';
    if (imageUrl) {
        imageHtml = '<img src="' + imageUrl + '" alt="' + inv.i_name + '" onerror="this.style.display=\'none\'; this.parentElement.querySelector(\'.modal-placeholder\').style.display=\'flex\';">';
    }
    
    const placeholderStyle = imageUrl ? 'display:none' : 'display:flex;flex-direction:column;align-items:center;color:#ccc';
    
    modal.innerHTML = `
        <div class="component-modal-content">
            <button class="close-modal" onclick="this.closest('.component-modal').remove()">&times;</button>
            
            <div class="modal-image">
                ${imageHtml}
                <div class="modal-placeholder" style="${placeholderStyle}">
                    <i class="fas fa-${getIconForCategory(inv.i_category)}"></i>
                    <span style="font-size:12px;margin-top:5px;">${inv.i_category}</span>
                </div>
            </div>
            
            <h2 style="margin: 0 0 5px 0; color: #1a1a2e;">${inv.i_name}</h2>
            <p style="color: #666; margin-bottom: 15px;">${inv.i_brand || 'Generic'} • ${inv.i_category.toUpperCase()}</p>
            
            <div class="spec-grid">
                ${renderSpecDetails(inv)}
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button onclick="this.closest('.component-modal').remove()" class="btn-primary" style="flex: 1; padding: 12px;">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });
    debugLog('✅ Component modal opened');
};

function getIconForCategory(category) {
    const icons = {
        cpu: 'microchip', motherboard: 'square', ram: 'memory',
        gpu: 'tv', storage: 'hdd', psu: 'plug', cooler: 'fan'
    };
    return icons[category] || 'box';
}

function renderSpecDetails(inv) {
    const specs = [];
    
    specs.push({ label: 'Category', value: inv.i_category.toUpperCase() });
    specs.push({ label: 'Brand', value: inv.i_brand || 'N/A' });
    specs.push({ label: 'Price', value: 'RM ' + inv.i_price });
    specs.push({ label: 'Stock', value: inv.i_quantity || 0 });
    
    if (inv.i_category === 'cpu') {
        if (inv.i_cpu_cores) specs.push({ label: 'Cores', value: inv.i_cpu_cores });
        if (inv.i_cpu_clock_speed) specs.push({ label: 'Clock Speed', value: inv.i_cpu_clock_speed });
    }
    
    if (inv.i_category === 'ram') {
        if (inv.i_ram_speed) specs.push({ label: 'Speed', value: inv.i_ram_speed });
        if (inv.i_ram_type) specs.push({ label: 'Type', value: inv.i_ram_type });
    }
    
    if (inv.i_category === 'gpu') {
        if (inv.i_gpu_memory) specs.push({ label: 'Memory', value: inv.i_gpu_memory });
    }
    
    if (inv.i_category === 'storage') {
        if (inv.i_storage_type) specs.push({ label: 'Type', value: inv.i_storage_type });
        if (inv.i_storage_speed) specs.push({ label: 'Speed', value: inv.i_storage_speed });
    }
    
    if (inv.i_category === 'motherboard') {
        if (inv.i_motherboard_socket) specs.push({ label: 'Socket', value: inv.i_motherboard_socket });
        if (inv.i_motherboard_chipset) specs.push({ label: 'Chipset', value: inv.i_motherboard_chipset });
    }
    
    if (inv.i_category === 'psu') {
        if (inv.i_psu_wattage) specs.push({ label: 'Wattage', value: inv.i_psu_wattage + 'W' });
        if (inv.i_psu_certification) specs.push({ label: 'Certification', value: inv.i_psu_certification });
    }
    
    let html = '';
    for (let i = 0; i < specs.length; i++) {
        html += '<div class="spec-item">';
        html += '<div class="spec-label">' + specs[i].label + '</div>';
        html += '<div class="spec-value">' + specs[i].value + '</div>';
        html += '</div>';
    }
    
    return html;
}

function getStockStatus(stock) {
    if (stock > 5) {
        return { text: 'In Stock', class: 'in-stock' };
    } else if (stock > 0) {
        return { text: 'Only ' + stock + ' left', class: 'low-stock' };
    } else {
        return { text: 'Out of Stock', class: 'out-of-stock' };
    }
}

function showError(message) {
    debugLog(`❌ Showing error: ${message}`);
    const container = document.getElementById('bundleDetailContainer');
    if (container) {
        container.innerHTML = `
            <div class="loading-container">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
                <p>${message}</p>
                <button class="btn-primary" onclick="window.location.href='prebuilt.html'" style="margin-top: 20px;">
                    Back to Pre-Built PCs
                </button>
            </div>
        `;
    }
}

function showToast(message, type) {
    type = type || 'success';
    debugLog(`🍞 Toast: ${message} (${type})`);
    const existingToast = document.querySelector('.custom-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'custom-toast toast-' + type;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
    const title = type === 'success' ? 'Added to Cart!' : 'Notice';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${icon} toast-icon"></i>
            <div class="toast-message">
                <div class="toast-title">${title}</div>
                <div class="toast-text">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="toast-progress"></div>
    `;
    
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

function injectToastStyles() {
    if (document.getElementById('toast-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'toast-styles';
    styles.textContent = `
        .custom-toast {
            position: fixed; top: 20px; right: 20px; min-width: 320px;
            background: white; border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15); overflow: hidden;
            z-index: 10000; opacity: 0; transform: translateX(400px);
            transition: all 0.3s ease; border-left: 4px solid #00d4ff;
        }
        .custom-toast.show { opacity: 1; transform: translateX(0); }
        .custom-toast.toast-success { border-left-color: #4CAF50; }
        .custom-toast.toast-error { border-left-color: #f44336; }
        .toast-content { display: flex; align-items: flex-start; padding: 16px 20px; gap: 15px; }
        .toast-icon { font-size: 24px; color: #4CAF50; }
        .toast-success .toast-icon { color: #4CAF50; }
        .toast-error .toast-icon { color: #f44336; }
        .toast-message { flex: 1; }
        .toast-title { font-weight: 600; color: #1a1a2e; margin-bottom: 4px; font-size: 15px; }
        .toast-text { color: #666; font-size: 13px; }
        .toast-close { background: none; border: none; color: #999; cursor: pointer; padding: 4px; font-size: 14px; }
        .toast-close:hover { color: #333; }
        .toast-progress { height: 3px; background: linear-gradient(90deg, #00d4ff, #4CAF50);
            width: 100%; animation: toastProgress 3s linear forwards; }
        .toast-success .toast-progress { background: #4CAF50; }
        @keyframes toastProgress { 0% { width: 100%; } 100% { width: 0%; } }
        @media (max-width: 480px) { .custom-toast { min-width: auto; left: 20px; right: 20px; } }
        
        /* 3D Viewer Styles */
        .pc-3d-sidebar {
            background: #1a1a2e;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(0,212,255,0.1);
        }
        .sidebar-title {
            color: #fff;
            font-size: 16px;
            margin: 0 0 15px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .sidebar-title i {
            color: #00d4ff;
        }
        .pc-3d-viewer {
            width: 100%;
            height: 250px;
            border-radius: 12px;
            overflow: hidden;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        }
        .sidebar-controls {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        .btn-3d-control {
            padding: 6px 12px;
            border: 1px solid rgba(0,212,255,0.2);
            background: rgba(0,0,0,0.3);
            color: #00d4ff;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.3s ease;
            flex: 1;
        }
        .btn-3d-control:hover {
            background: rgba(0,212,255,0.1);
            border-color: rgba(0,212,255,0.4);
        }
        .sidebar-components-list {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid rgba(255,255,255,0.05);
        }
        .sidebar-components-list h4 {
            color: rgba(255,255,255,0.6);
            font-size: 12px;
            margin: 0 0 8px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* PC Detail Layout */
        .pc-detail-container {
            display: flex;
            flex-direction: column;
            gap: 30px;
        }
        .pc-main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }
        @media (max-width: 768px) {
            .pc-main-content {
                grid-template-columns: 1fr;
            }
        }
        .pc-image-section {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .pc-main-image {
            position: relative;
            background: #f8f9fc;
            border-radius: 12px;
            overflow: hidden;
            aspect-ratio: 4/3;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: zoom-in;
            border: 1px solid #e0e0e0;
        }
        .pc-main-image img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            transition: transform 0.3s ease;
        }
        .pc-main-image img.zoomed {
            transform: scale(1.5);
            cursor: zoom-out;
        }
        .zoom-hint {
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: rgba(0,0,0,0.6);
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            pointer-events: none;
        }
        .pc-thumbnails {
            display: flex;
            gap: 10px;
            overflow-x: auto;
            padding: 5px 0;
        }
        .thumb {
            width: 60px;
            height: 60px;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            border: 2px solid transparent;
            flex-shrink: 0;
        }
        .thumb.active {
            border-color: #00d4ff;
        }
        .thumb img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .pc-info-section {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .pc-category-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            width: fit-content;
        }
        .badge-gaming { background: #6c5ce7; color: white; }
        .badge-workstation { background: #0984e3; color: white; }
        .badge-budget { background: #00b894; color: white; }
        .badge-premium { background: #fdcb6e; color: #1a1a2e; }
        .pc-title { font-size: 28px; margin: 0; color: #1a1a2e; }
        .pc-price-large { font-size: 32px; font-weight: 700; color: #1a1a2e; }
        .pc-description { color: #666; line-height: 1.6; }
        .pc-stock-info {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            font-size: 14px;
            color: #666;
        }
        .stock-badge {
            padding: 4px 12px;
            border-radius: 4px;
            font-weight: 500;
        }
        .stock-badge.in-stock { background: #d4edda; color: #155724; }
        .stock-badge.low-stock { background: #fff3cd; color: #856404; }
        .stock-badge.out-of-stock { background: #f8d7da; color: #721c24; }
        .btn-large { padding: 14px 40px; font-size: 16px; }
        .btn-outline {
            padding: 12px 30px;
            border: 2px solid #00d4ff;
            border-radius: 8px;
            background: transparent;
            color: #1a1a2e;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .btn-outline:hover {
            background: #00d4ff;
            color: white;
        }
        .components-section {
            padding: 30px 0;
            border-top: 1px solid #e0e0e0;
        }
        .components-title {
            font-size: 24px;
            margin-bottom: 20px;
            color: #1a1a2e;
        }
        .components-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
        }
        .component-card {
            padding: 15px;
            background: #f8f9fc;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .component-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .component-category {
            font-size: 10px;
            text-transform: uppercase;
            color: #666;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .component-name {
            font-weight: 600;
            margin: 4px 0;
            color: #1a1a2e;
        }
        .component-brand {
            font-size: 13px;
            color: #666;
        }
        .component-specs {
            font-size: 12px;
            color: #888;
            margin-top: 4px;
        }
        .warranty-section {
            padding: 30px 0;
            border-top: 1px solid #e0e0e0;
        }
        .warranty-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
        }
        .warranty-item {
            text-align: center;
            padding: 20px;
            background: #f8f9fc;
            border-radius: 8px;
        }
        .warranty-item i {
            font-size: 32px;
            color: #00d4ff;
        }
        .warranty-item h4 {
            margin: 10px 0 4px;
            color: #1a1a2e;
        }
        .warranty-item p {
            margin: 0;
            font-size: 13px;
            color: #666;
        }
        
        /* Component Modal */
        .component-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .component-modal-content {
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 500px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
        }
        .component-modal .close-modal {
            position: absolute;
            top: 10px;
            right: 15px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #999;
        }
        .component-modal .close-modal:hover { color: #333; }
        .modal-image {
            text-align: center;
            margin-bottom: 15px;
            background: #f8f9fc;
            border-radius: 8px;
            padding: 10px;
            min-height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .modal-image img {
            max-width: 100%;
            max-height: 200px;
            object-fit: contain;
        }
        .modal-placeholder {
            font-size: 48px;
            display: flex;
            flex-direction: column;
            align-items: center;
            color: #ccc;
        }
        .spec-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        .spec-item {
            padding: 6px 10px;
            background: #f8f9fc;
            border-radius: 4px;
        }
        .spec-label {
            font-size: 10px;
            text-transform: uppercase;
            color: #666;
            font-weight: 600;
        }
        .spec-value {
            font-size: 14px;
            color: #1a1a2e;
            font-weight: 500;
        }
    `;
    
    document.head.appendChild(styles);
    debugLog('🎨 Styles injected');
}

window.addBundleToCart = function(bundleId) {
    debugLog(`🛒 Adding bundle ${bundleId} to cart`);
    const cart = JSON.parse(localStorage.getItem('buildbuddy_cart')) || [];
    let existingItem = null;
    for (let i = 0; i < cart.length; i++) {
        if (cart[i].type === 'bundle' && cart[i].id === bundleId) {
            existingItem = cart[i];
            break;
        }
    }
    
    if (existingItem) {
        existingItem.quantity += 1;
        debugLog(`📦 Updated existing item quantity to ${existingItem.quantity}`);
        showToast(currentBundle.bundle_name + ' quantity updated in cart!', 'success');
    } else {
        cart.push({
            type: 'bundle',
            id: bundleId,
            name: currentBundle.bundle_name,
            price: currentBundle.bundle_price,
            quantity: 1
        });
        debugLog(`📦 New item added to cart`);
        showToast(currentBundle.bundle_name + ' added to cart!', 'success');
    }
    
    localStorage.setItem('buildbuddy_cart', JSON.stringify(cart));
    updateCartCount();
    debugLog(`✅ Cart updated, total items: ${cart.length}`);
};

function updateCartCount() {
    const cartCount = document.querySelector('.cart-count');
    if (cartCount) {
        const savedCart = localStorage.getItem('buildbuddy_cart');
        const count = savedCart ? JSON.parse(savedCart).length : 0;
        cartCount.textContent = count;
        debugLog(`🛒 Cart count updated: ${count}`);
    }
}

// Expose debug functions to window
window.debugLogs = debugLogs;
window.showDebug = function() {
    console.table(debugLogs);
};

debugLog('✅ prebuilt-detail.js loaded');
console.log('✅ prebuilt-detail.js loaded');