import supabase from './supabase-client.js';

let currentBundle = null;
let bundleComponents = [];

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
        const bundles = await supabase
            .from('bundles')
            .select('*')
            .eq('bundle_id', bundleId);
        
        if (!bundles || bundles.length === 0) {
            showError('Pre-built PC not found');
            return;
        }
        
        currentBundle = bundles[0];
        
        const items = await supabase
            .from('bundle_items')
            .select(`
                quantity,
                inventory:i_id (
                    i_id,
                    i_name,
                    i_category,
                    i_brand,
                    i_price
                )
            `)
            .eq('bundle_id', bundleId);
        
        bundleComponents = items || [];
        
        renderBundleDetails();
    } catch (error) {
        console.error('Error loading bundle details:', error);
        showError('Failed to load PC details');
    }
}

function renderBundleDetails() {
    document.title = `${currentBundle.bundle_name} - BuildBuddy`;
    
    const container = document.getElementById('bundleDetailContainer');
    
    const stockStatus = getStockStatus(currentBundle.bundle_stock);
    const categoryBadge = currentBundle.bundle_category;
    const badgeClass = `badge-${categoryBadge}`;
    
    container.innerHTML = `
        <div class="pc-detail-container">
            <div class="pc-image-section">
                <div class="pc-main-image">
                    <i class="fas fa-desktop"></i>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f0f0f5, #e0e0e0); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-microchip" style="font-size: 30px; color: #666;"></i>
                    </div>
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f0f0f5, #e0e0e0); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-tv" style="font-size: 30px; color: #666;"></i>
                    </div>
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f0f0f5, #e0e0e0); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-fan" style="font-size: 30px; color: #666;"></i>
                    </div>
                </div>
            </div>
            
            <div class="pc-info-section">
                <span class="pc-category-badge ${badgeClass}">${categoryBadge}</span>
                <h1 class="pc-title">${currentBundle.bundle_name}</h1>
                <div class="pc-price-large">RM ${currentBundle.bundle_price}</div>
                <p class="pc-description">${currentBundle.bundle_description || 'Professionally built and tested gaming PC.'}</p>
                
                <div class="pc-stock-info">
                    <span class="stock-badge ${stockStatus.class}">${stockStatus.text}</span>
                    <span><i class="fas fa-truck"></i> Free Shipping</span>
                    <span><i class="fas fa-shield-alt"></i> 3 Year Warranty</span>
                </div>
                
                <button class="btn-primary btn-large" onclick="window.addBundleToCart(${currentBundle.bundle_id})" ${currentBundle.bundle_stock === 0 ? 'disabled' : ''}>
                    <i class="fas fa-shopping-cart"></i> 
                    ${currentBundle.bundle_stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
                <button class="btn-outline btn-large" onclick="window.location.href='prebuilt.html'">
                    <i class="fas fa-arrow-left"></i> Back to Pre-Built PCs
                </button>
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
    
    // Inject toast styles
    injectToastStyles();
}

function renderComponents() {
    if (bundleComponents.length === 0) {
        return '<p style="color: #666;">Component details coming soon.</p>';
    }
    
    const categoryOrder = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'cooler'];
    const sortedComponents = [...bundleComponents].sort((a, b) => {
        return categoryOrder.indexOf(a.inventory.i_category) - categoryOrder.indexOf(b.inventory.i_category);
    });
    
    return sortedComponents.map(item => `
        <div class="component-card">
            <div class="component-category">${item.inventory.i_category}</div>
            <div class="component-name">${item.inventory.i_name}</div>
            <div class="component-brand">${item.inventory.i_brand || ''} ${item.quantity > 1 ? `(x${item.quantity})` : ''}</div>
        </div>
    `).join('');
}

function getStockStatus(stock) {
    if (stock > 5) {
        return { text: 'In Stock', class: 'in-stock' };
    } else if (stock > 0) {
        return { text: `Only ${stock} left`, class: 'low-stock' };
    } else {
        return { text: 'Out of Stock', class: 'out-of-stock' };
    }
}

function showError(message) {
    const container = document.getElementById('bundleDetailContainer');
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

// Custom Toast Notification
function showToast(message, type = 'success') {
    // Remove existing toast if any
    const existingToast = document.querySelector('.custom-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${icon} toast-icon"></i>
            <div class="toast-message">
                <div class="toast-title">${type === 'success' ? 'Added to Cart!' : 'Notice'}</div>
                <div class="toast-text">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="toast-progress"></div>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function injectToastStyles() {
    if (document.getElementById('toast-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'toast-styles';
    styles.textContent = `
        .custom-toast {
            position: fixed;
            top: 20px;
            right: 20px;
            min-width: 320px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
            overflow: hidden;
            z-index: 10000;
            opacity: 0;
            transform: translateX(400px);
            transition: all 0.3s ease;
            border-left: 4px solid #00d4ff;
        }
        
        .custom-toast.show {
            opacity: 1;
            transform: translateX(0);
        }
        
        .custom-toast.toast-success {
            border-left-color: #4CAF50;
        }
        
        .custom-toast.toast-error {
            border-left-color: #f44336;
        }
        
        .toast-content {
            display: flex;
            align-items: flex-start;
            padding: 16px 20px;
            gap: 15px;
        }
        
        .toast-icon {
            font-size: 24px;
            color: #4CAF50;
        }
        
        .toast-success .toast-icon {
            color: #4CAF50;
        }
        
        .toast-error .toast-icon {
            color: #f44336;
        }
        
        .toast-message {
            flex: 1;
        }
        
        .toast-title {
            font-weight: 600;
            color: #1a1a2e;
            margin-bottom: 4px;
            font-size: 15px;
        }
        
        .toast-text {
            color: #666;
            font-size: 13px;
        }
        
        .toast-close {
            background: none;
            border: none;
            color: #999;
            cursor: pointer;
            padding: 4px;
            font-size: 14px;
            transition: color 0.2s;
        }
        
        .toast-close:hover {
            color: #333;
        }
        
        .toast-progress {
            height: 3px;
            background: linear-gradient(90deg, #00d4ff, #4CAF50);
            width: 100%;
            animation: toastProgress 3s linear forwards;
        }
        
        .toast-success .toast-progress {
            background: #4CAF50;
        }
        
        @keyframes toastProgress {
            0% { width: 100%; }
            100% { width: 0%; }
        }
        
        @media (max-width: 480px) {
            .custom-toast {
                min-width: auto;
                left: 20px;
                right: 20px;
            }
        }
    `;
    
    document.head.appendChild(styles);
}

window.addBundleToCart = function(bundleId) {
    const cart = JSON.parse(localStorage.getItem('buildbuddy_cart')) || [];
    const existingItem = cart.find(item => item.type === 'bundle' && item.id === bundleId);
    
    if (existingItem) {
        existingItem.quantity += 1;
        showToast(`${currentBundle.bundle_name} quantity updated in cart!`, 'success');
    } else {
        cart.push({
            type: 'bundle',
            id: bundleId,
            name: currentBundle.bundle_name,
            price: currentBundle.bundle_price,
            quantity: 1
        });
        showToast(`${currentBundle.bundle_name} added to cart!`, 'success');
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