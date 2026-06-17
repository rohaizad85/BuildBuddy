import supabase from './supabase-client.js';

let currentBundle = null;
let bundleComponents = [];
let currentImageIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bundleId = urlParams.get('id');
    
    if (!bundleId) {
        window.location.href = 'prebuilt.html';
        return;
    }
    
    await loadBundleDetails(bundleId);
    updateCartCount();
});

async function loadBundleDetails(bundleId) {
    try {
        const { data: bundleData, error: bundleError } = await supabase
            .from('bundles')
            .select('*')
            .eq('bundle_id', bundleId)
            .single();
        
        if (bundleError || !bundleData) {
            showError('Pre-built PC not found');
            return;
        }
        
        currentBundle = bundleData;
        
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
            console.error('Error loading bundle items:', itemsError);
        }
        
        bundleComponents = itemsData || [];
        
        renderBundleDetails();
    } catch (error) {
        console.error('Error loading bundle details:', error);
        showError('Failed to load PC details');
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
    document.title = currentBundle.bundle_name + ' - BuildBuddy';
    
    const container = document.getElementById('bundleDetailContainer');
    
    const stockStatus = getStockStatus(currentBundle.bundle_stock);
    const categoryBadge = currentBundle.bundle_category;
    const badgeClass = 'badge-' + categoryBadge;
    
    // Get main image
    let mainImagePath = null;
    for (let i = 0; i < bundleComponents.length; i++) {
        const item = bundleComponents[i];
        if (item.inventory.i_image_path && !item.inventory.i_image_path.startsWith('http')) {
            mainImagePath = item.inventory.i_image_path;
            break;
        }
    }
    
    const mainImageUrl = mainImagePath ? getImageUrl(mainImagePath) : null;
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
    
    container.innerHTML = 
        '<div class="pc-detail-container">' +
            '<div class="pc-image-section">' +
                '<div class="pc-main-image" id="mainImage" onclick="window.zoomImage()">' +
                    imageHtml +
                    '<span class="zoom-hint" id="zoomHint"><i class="fas fa-search-plus"></i> Click to zoom</span>' +
                '</div>' +
                '<div class="pc-thumbnails" id="thumbnails">' +
                    renderThumbnails() +
                '</div>' +
            '</div>' +
            
            '<div class="pc-info-section">' +
                '<span class="pc-category-badge ' + badgeClass + '">' + categoryBadge + '</span>' +
                '<h1 class="pc-title">' + bundleName + '</h1>' +
                '<div class="pc-price-large">RM ' + bundlePrice + '</div>' +
                '<p class="pc-description">' + bundleDescription + '</p>' +
                
                '<div class="pc-stock-info">' +
                    '<span class="stock-badge ' + stockStatus.class + '">' + stockStatus.text + '</span>' +
                    '<span><i class="fas fa-truck"></i> Free Shipping</span>' +
                    '<span><i class="fas fa-shield-alt"></i> 3 Year Warranty</span>' +
                '</div>' +
                
                '<button class="btn-primary btn-large" onclick="window.addBundleToCart(' + bundleId + ')" ' + isDisabled + '>' +
                    '<i class="fas fa-shopping-cart"></i> ' + buttonText +
                '</button>' +
                '<button class="btn-outline" onclick="window.location.href=\'prebuilt.html\'">' +
                    '<i class="fas fa-arrow-left"></i> Back to Pre-Built PCs' +
                '</button>' +
            '</div>' +
        '</div>' +
        
        '<div class="components-section">' +
            '<h2 class="components-title">Included Components</h2>' +
            '<div class="components-grid" id="componentsGrid">' +
                renderComponents() +
            '</div>' +
        '</div>' +
        
        '<div class="warranty-section">' +
            '<h2 class="components-title">What\'s Included</h2>' +
            '<div class="warranty-grid">' +
                '<div class="warranty-item">' +
                    '<i class="fas fa-check-circle"></i>' +
                    '<h4>Fully Assembled</h4>' +
                    '<p>Professionally built and cable managed</p>' +
                '</div>' +
                '<div class="warranty-item">' +
                    '<i class="fas fa-shield-alt"></i>' +
                    '<h4>3 Year Warranty</h4>' +
                    '<p>Parts and labor covered</p>' +
                '</div>' +
                '<div class="warranty-item">' +
                    '<i class="fas fa-headset"></i>' +
                    '<h4>Lifetime Support</h4>' +
                    '<p>Free technical support forever</p>' +
                '</div>' +
            '</div>' +
        '</div>';
    
    injectToastStyles();
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

// ===== GLOBAL ZOOM FUNCTIONS =====
window.zoomImage = function() {
    var img = document.getElementById('mainImageImg');
    var hint = document.getElementById('zoomHint');
    
    if (!img) {
        console.log('Image not found!');
        return;
    }
    
    // Toggle zoom class
    if (img.classList.contains('zoomed')) {
        img.classList.remove('zoomed');
        if (hint) {
            hint.innerHTML = '<i class="fas fa-search-plus"></i> Click to zoom';
        }
        console.log('Zoom out');
    } else {
        img.classList.add('zoomed');
        if (hint) {
            hint.innerHTML = '<i class="fas fa-search-minus"></i> Click to zoom out';
        }
        console.log('Zoom in');
    }
};

window.changeMainImage = function(index) {
    const imagePaths = [];
    for (let i = 0; i < bundleComponents.length; i++) {
        const path = bundleComponents[i].inventory.i_image_path;
        if (path && !path.startsWith('http')) {
            imagePaths.push(path);
        }
    }
    
    if (index >= imagePaths.length) return;
    
    const path = imagePaths[index];
    const url = getImageUrl(path);
    
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
};

window.showComponentDetail = function(componentId) {
    let component = null;
    for (let i = 0; i < bundleComponents.length; i++) {
        if (bundleComponents[i].inventory.i_id === componentId) {
            component = bundleComponents[i];
            break;
        }
    }
    if (!component) return;
    
    const inv = component.inventory;
    const imageUrl = getImageUrl(inv.i_image_path);
    
    const modal = document.createElement('div');
    modal.className = 'component-modal';
    
    let imageHtml = '';
    if (imageUrl) {
        imageHtml = '<img src="' + imageUrl + '" alt="' + inv.i_name + '" onerror="this.style.display=\'none\'; this.parentElement.querySelector(\'.modal-placeholder\').style.display=\'flex\';">';
    }
    
    const placeholderStyle = imageUrl ? 'display:none' : 'display:flex;flex-direction:column;align-items:center;color:#ccc';
    
    modal.innerHTML = 
        '<div class="component-modal-content">' +
            '<button class="close-modal" onclick="this.closest(\'.component-modal\').remove()">&times;</button>' +
            
            '<div class="modal-image">' +
                imageHtml +
                '<div class="modal-placeholder" style="' + placeholderStyle + '">' +
                    '<i class="fas fa-' + getIconForCategory(inv.i_category) + '"></i>' +
                    '<span style="font-size:12px;margin-top:5px;">' + inv.i_category + '</span>' +
                '</div>' +
            '</div>' +
            
            '<h2 style="margin: 0 0 5px 0; color: #1a1a2e;">' + inv.i_name + '</h2>' +
            '<p style="color: #666; margin-bottom: 15px;">' + (inv.i_brand || 'Generic') + ' • ' + inv.i_category.toUpperCase() + '</p>' +
            
            '<div class="spec-grid">' +
                renderSpecDetails(inv) +
            '</div>' +
            
            '<div style="display: flex; gap: 10px; margin-top: 15px;">' +
                '<button onclick="this.closest(\'.component-modal\').remove()" class="btn-primary" style="flex: 1; padding: 12px;">' +
                    'Close' +
                '</button>' +
            '</div>' +
        '</div>';
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.remove();
    });
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
    const container = document.getElementById('bundleDetailContainer');
    container.innerHTML = 
        '<div class="loading-container">' +
            '<i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>' +
            '<p>' + message + '</p>' +
            '<button class="btn-primary" onclick="window.location.href=\'prebuilt.html\'" style="margin-top: 20px;">' +
                'Back to Pre-Built PCs' +
            '</button>' +
        '</div>';
}

function showToast(message, type) {
    type = type || 'success';
    const existingToast = document.querySelector('.custom-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'custom-toast toast-' + type;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
    const title = type === 'success' ? 'Added to Cart!' : 'Notice';
    
    toast.innerHTML = 
        '<div class="toast-content">' +
            '<i class="fas ' + icon + ' toast-icon"></i>' +
            '<div class="toast-message">' +
                '<div class="toast-title">' + title + '</div>' +
                '<div class="toast-text">' + message + '</div>' +
            '</div>' +
            '<button class="toast-close" onclick="this.parentElement.parentElement.remove()">' +
                '<i class="fas fa-times"></i>' +
            '</button>' +
        '</div>' +
        '<div class="toast-progress"></div>';
    
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
    styles.textContent = 
        '.custom-toast {' +
            'position: fixed; top: 20px; right: 20px; min-width: 320px;' +
            'background: white; border-radius: 12px;' +
            'box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15); overflow: hidden;' +
            'z-index: 10000; opacity: 0; transform: translateX(400px);' +
            'transition: all 0.3s ease; border-left: 4px solid #00d4ff;' +
        '}' +
        '.custom-toast.show { opacity: 1; transform: translateX(0); }' +
        '.custom-toast.toast-success { border-left-color: #4CAF50; }' +
        '.custom-toast.toast-error { border-left-color: #f44336; }' +
        '.toast-content { display: flex; align-items: flex-start; padding: 16px 20px; gap: 15px; }' +
        '.toast-icon { font-size: 24px; color: #4CAF50; }' +
        '.toast-success .toast-icon { color: #4CAF50; }' +
        '.toast-error .toast-icon { color: #f44336; }' +
        '.toast-message { flex: 1; }' +
        '.toast-title { font-weight: 600; color: #1a1a2e; margin-bottom: 4px; font-size: 15px; }' +
        '.toast-text { color: #666; font-size: 13px; }' +
        '.toast-close { background: none; border: none; color: #999; cursor: pointer; padding: 4px; font-size: 14px; }' +
        '.toast-close:hover { color: #333; }' +
        '.toast-progress { height: 3px; background: linear-gradient(90deg, #00d4ff, #4CAF50);' +
            'width: 100%; animation: toastProgress 3s linear forwards; }' +
        '.toast-success .toast-progress { background: #4CAF50; }' +
        '@keyframes toastProgress { 0% { width: 100%; } 100% { width: 0%; } }' +
        '@media (max-width: 480px) { .custom-toast { min-width: auto; left: 20px; right: 20px; } }';
    
    document.head.appendChild(styles);
}

window.addBundleToCart = function(bundleId) {
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
        showToast(currentBundle.bundle_name + ' quantity updated in cart!', 'success');
    } else {
        cart.push({
            type: 'bundle',
            id: bundleId,
            name: currentBundle.bundle_name,
            price: currentBundle.bundle_price,
            quantity: 1
        });
        showToast(currentBundle.bundle_name + ' added to cart!', 'success');
    }
    
    localStorage.setItem('buildbuddy_cart', JSON.stringify(cart));
    updateCartCount();
};

function updateCartCount() {
    const cartCount = document.querySelector('.cart-count');
    if (cartCount) {
        const savedCart = localStorage.getItem('buildbuddy_cart');
        const count = savedCart ? JSON.parse(savedCart).length : 0;
        cartCount.textContent = count;
    }
}

console.log('✅ prebuilt-detail.js loaded');