// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\cart.js

import supabase from './supabase-client.js';
import dataService from './data-service.js';
import {
    getUser,
    getLocalCart,
    saveLocalCart,
    clearLocalCart,
    getCartCount,
    updateCartCountDisplay,
    syncLocalCartToDatabase,
    addToCart,
    addBundleToCart,
    initCart,
    setupLoginButton
} from './cart-utils.js';

let currentCartItems = [];
let isLoading = false;

const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Setup login button first
        setupLoginButton();

        await initCart();
        await loadCart();
    } catch (error) {
        console.error('Error loading cart:', error);
        showError('Failed to load cart. Please refresh the page.');
    }
});

function getImageUrl(imagePath) {
    if (!imagePath) return null;

    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }

    return `${SUPABASE_URL}/storage/v1/object/public/images/${encodeURIComponent(imagePath)}`;
}

async function loadCart() {
    if (isLoading) return;

    isLoading = true;
    const container = document.getElementById('cartContainer');

    if (!container) {
        isLoading = false;
        return;
    }

    try {
        const user = getUser();
        let cartItems = [];
        let cartServices = [];
        let localItems = [];

        // ============================================
        // CLEAN UP NULL SERVICES
        // ============================================
        if (user) {
            try {
                await dataService.ensureInitialized();
                const cartId = dataService.currentCartId;
                
                if (cartId) {
                    // Delete cart_service entries with null service_id
                    const { data: nullServices, error: fetchError } = await supabase
                        .from('cart_service')
                        .select('cs_id')
                        .eq('cart_id', cartId)
                        .is('service_id', null);
                    
                    if (fetchError) {
                        console.error('Error fetching null services:', fetchError);
                    } else if (nullServices && nullServices.length > 0) {
                        
                        const ids = nullServices.map(item => item.cs_id);
                        const { error: deleteError } = await supabase
                            .from('cart_service')
                            .delete()
                            .in('cs_id', ids);
                        
                        if (deleteError) {
                            console.error('Error deleting null services:', deleteError);
                        }
                    }
                }
            } catch (cleanupError) {
                console.error('Error during cleanup:', cleanupError);
            }
        }

        if (user) {
            try {
                await dataService.ensureInitialized();
                const cartId = dataService.currentCartId;

                if (!cartId) {
                    localItems = getLocalCart();
                    
                    const normalizedLocal = localItems.map(item => {
                        let itemType = item.type;
                        if (typeof itemType === 'object' && itemType !== null) {
                            itemType = itemType.type || itemType.name || 'product';
                        }
                        if (typeof itemType !== 'string') {
                            itemType = 'product';
                        }
                        return { 
                            ...item, 
                            type: itemType, 
                            source: 'local' 
                        };
                    });
                    
                    currentCartItems = normalizedLocal;
                    await enrichItems(currentCartItems);
                    renderCart(container, currentCartItems);
                    isLoading = false;
                    return;
                }


                // Get cart items (products)
                const dbItems = await dataService.getCartItems();
                cartItems = Array.isArray(dbItems) ? dbItems : [];

                // ============================================
                // LOAD SERVICES - Method 1: With Join
                // ============================================
                const { data: servicesWithJoin, error: serviceJoinError } = await supabase
                    .from('cart_service')
                    .select(`
                        cs_id,
                        cart_id,
                        service_id,
                        service:service_id (
                            service_id,
                            service_name,
                            service_price,
                            service_duration,
                            service_category
                        )
                    `)
                    .eq('cart_id', cartId)
                    .not('service_id', 'is', null); // Exclude null service_ids

                if (serviceJoinError) {
                    console.error('Error loading services with join:', serviceJoinError);
                    cartServices = [];
                } else if (servicesWithJoin && servicesWithJoin.length > 0) {
                    // Check if the join worked (service data is populated)
                    const hasValidServiceData = servicesWithJoin.some(item => item.service && typeof item.service === 'object');
                    
                    if (hasValidServiceData) {
                        cartServices = servicesWithJoin;
                    } else {
                        // Join didn't work, try Method 2

                        
                        // ============================================
                        // LOAD SERVICES - Method 2: Separate Fetch
                        // ============================================
                        const { data: cartServiceData, error: cartServiceError } = await supabase
                            .from('cart_service')
                            .select('cs_id, cart_id, service_id')
                            .eq('cart_id', cartId)
                            .not('service_id', 'is', null);

                        if (cartServiceError) {
                            console.error('Error loading cart services:', cartServiceError);
                            cartServices = [];
                        } else if (cartServiceData && cartServiceData.length > 0) {
                            const serviceIds = cartServiceData
                                .map(item => item.service_id)
                                .filter(id => id !== null && id !== undefined);
                            
                            if (serviceIds.length > 0) {
                                const { data: serviceDetails, error: serviceDetailsError } = await supabase
                                    .from('service')
                                    .select('*')
                                    .in('service_id', serviceIds);
                                
                                if (serviceDetailsError) {
                                    console.error('Error fetching service details:', serviceDetailsError);
                                    cartServices = cartServiceData.map(item => ({
                                        ...item,
                                        service: null
                                    }));
                                } else {
                                    
                                    const serviceMap = {};
                                    serviceDetails.forEach(s => {
                                        serviceMap[s.service_id] = s;
                                    });
                                    
                                    cartServices = cartServiceData.map(item => ({
                                        ...item,
                                        service: serviceMap[item.service_id] || null
                                    }));
                                }
                            } else {
                                cartServices = cartServiceData.map(item => ({
                                    ...item,
                                    service: null
                                }));
                            }
                        } else {
                            cartServices = [];
                        }
                    }
                } else {
                    cartServices = [];
                }
                

            } catch (dbError) {
                console.error('Error loading from database:', dbError);
                cartItems = [];
                cartServices = [];
            }
        }

        // Load localStorage items (includes bundles and local products)
        localItems = getLocalCart();

        // Normalize local items
        const mappedLocal = localItems.map(item => {
            let itemType = item.type;
            if (typeof itemType === 'object' && itemType !== null) {
                itemType = itemType.type || itemType.name || 'product';
                console.warn('⚠️ Fixed malformed type in cart:', item.type, '->', itemType);
            }
            if (typeof itemType !== 'string') {
                itemType = 'product';
            }
            return {
                ...item,
                type: itemType,
                source: 'local'
            };
        });

        // Convert cart items (products) to display format
        const mappedCartItems = cartItems.map(item => ({
            type: 'product',
            id: item.i_id,
            name: 'Loading...',
            price: item.total_price ? item.total_price / (item.quantity || 1) : 0,
            quantity: item.quantity || 1,
            total_price: item.total_price || 0,
            ci_id: item.ci_id,
            source: 'database',
            image_path: null
        }));

        // Convert cart services to display format - Filter out null service_ids
        const mappedServices = cartServices
            .filter(item => item.service_id !== null && item.service_id !== undefined)
            .map(item => {
                // Check if service data exists
                const serviceData = item.service;
                
                // If service data is missing or null, use fallback
                if (!serviceData || typeof serviceData !== 'object') {
                    console.warn('⚠️ Service data missing for item:', item);
                    return {
                        type: 'service',
                        id: item.service_id,
                        name: 'Service #' + (item.service_id || 'unknown'),
                        price: 0,
                        quantity: 1,
                        total_price: 0,
                        cs_id: item.cs_id,
                        source: 'database',
                        image_path: null,
                        duration: null,
                        category: null,
                        isMissing: true
                    };
                }
                
                return {
                    type: 'service',
                    id: serviceData.service_id || item.service_id,
                    name: serviceData.service_name || 'Service #' + (item.service_id || 'unknown'),
                    price: serviceData.service_price || 0,
                    quantity: 1,
                    total_price: serviceData.service_price || 0,
                    cs_id: item.cs_id,
                    source: 'database',
                    image_path: null,
                    duration: serviceData.service_duration,
                    category: serviceData.service_category,
                    isMissing: false
                };
            });

        // Combine all items - prioritize database items over local items
        const uniqueItems = new Map();

        // Add database items first (they have priority)
        [...mappedCartItems, ...mappedServices].forEach(item => {
            const key = `${item.type}_${item.id}`;
            if (!uniqueItems.has(key)) {
                uniqueItems.set(key, item);
            }
        });

        // Add local items (bundles and others) - skip if already in database
        mappedLocal.forEach(item => {
            const key = `${item.type}_${item.id}`;
            if (!uniqueItems.has(key)) {
                uniqueItems.set(key, item);
            }
        });

        currentCartItems = Array.from(uniqueItems.values());

        // Enrich product names and images
        await enrichItems(currentCartItems);

        renderCart(container, currentCartItems);

    } catch (error) {
        console.error('Error loading cart:', error);
        showError('Failed to load cart. Please refresh the page.');
    } finally {
        isLoading = false;
    }
}

// ============================================
// ENRICH ITEMS - Handles products, bundles, and services
// ============================================

async function enrichItems(items) {
    // Separate items by type
    const productItems = items.filter(item => item.type === 'product' && (!item.name || item.name === 'Loading...'));
    const bundleItems = items.filter(item => item.type === 'bundle');

    // Enrich products
    if (productItems.length > 0) {
        await enrichProducts(productItems);
    }

    // Enrich bundles
    if (bundleItems.length > 0) {
        await enrichBundles(bundleItems);
    }
}

async function enrichProducts(items) {
    const productIds = items.map(item => item.id).filter(id => id !== null && id !== undefined);

    if (productIds.length === 0) return;

    try {
        const { data, error } = await supabase
            .from('inventory')
            .select('i_id, i_name, i_image_path, i_category')
            .in('i_id', productIds);

        if (error) {
            console.error('Error fetching product data:', error);
            return;
        }

        const productMap = {};
        data.forEach(p => {
            productMap[p.i_id] = {
                name: p.i_name,
                image_path: p.i_image_path,
                category: p.i_category
            };
        });

        items.forEach(item => {
            if (productMap[item.id]) {
                item.name = productMap[item.id].name;
                item.image_path = productMap[item.id].image_path;
                if (!item.category) {
                    item.category = productMap[item.id].category || 'product';
                }
            }
        });
    } catch (error) {
        console.error('Error enriching products:', error);
    }
}

async function enrichBundles(items) {
    const bundleIds = items.map(item => item.id).filter(id => id !== null && id !== undefined);

    if (bundleIds.length === 0) return;

    try {
        const { data, error } = await supabase
            .from('bundles')
            .select('bundle_id, bundle_name, bundle_image_url, bundle_category, bundle_price')
            .in('bundle_id', bundleIds);

        if (error) {
            console.error('Error fetching bundle data:', error);
            return;
        }

        const bundleMap = {};
        data.forEach(b => {
            bundleMap[b.bundle_id] = {
                name: b.bundle_name,
                image_path: b.bundle_image_url,
                category: b.bundle_category || 'bundle',
                price: b.bundle_price
            };
        });

        items.forEach(item => {
            if (bundleMap[item.id]) {
                item.name = bundleMap[item.id].name;
                item.image_path = bundleMap[item.id].image_path;
                item.category = bundleMap[item.id].category;
                if (!item.price || item.price === 0) {
                    item.price = bundleMap[item.id].price;
                    item.total_price = item.price * (item.quantity || 1);
                }
            }
        });
    } catch (error) {
        console.error('Error enriching bundles:', error);
    }
}

// ============================================
// RENDER CART
// ============================================

function renderCart(container, items) {
    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart"></i>
                <h3>Your cart is empty</h3>
                <p>Looks like you haven't added anything to your cart yet.</p>
                <button class="continue-shopping-btn" onclick="window.location.href='index.html'">
                    <i class="fas fa-arrow-left"></i> Continue Shopping
                </button>
            </div>
        `;
        return;
    }

    let total = 0;
    let html = `
        <div class="cart-container">
            <div class="cart-items">
                <h2><i class="fas fa-shopping-bag"></i> Your Items (${items.length})</h2>
    `;

    items.forEach((item, index) => {
        // ============================================
        // FIX: Normalize item.type - handle case where it might be an object
        // ============================================
        let category = item.type || 'product';
        if (typeof category === 'object' && category !== null) {
            category = category.type || category.name || 'product';
            console.warn('⚠️ Fixed malformed type in renderCart:', item.type, '->', category);
        }
        // Ensure category is a string
        if (typeof category !== 'string') {
            category = 'product';
        }

        let name = item.name || 'Item';
        let price = parseFloat(item.price || item.total_price || 0);
        let quantity = parseInt(item.quantity || 1);
        let itemTotal = price * quantity;
        total += itemTotal;

        let icon = 'fa-box';
        let iconColor = '#888';
        if (category === 'service') {
            icon = 'fa-tools';
            iconColor = '#00b4db';
        } else if (category === 'bundle') {
            icon = 'fa-desktop';
            iconColor = '#667eea';
        } else {
            icon = 'fa-microchip';
            iconColor = '#00d4ff';
        }

        // Get image URL
        let imageUrl = null;
        if (item.image_path) {
            imageUrl = getImageUrl(item.image_path);
        }

        const isService = category === 'service';
        const isBundle = category === 'bundle';

        html += `
            <div class="cart-item" data-index="${index}">
                <div class="cart-item-image">
                    ${imageUrl ?
                `<img src="${imageUrl}" alt="${escapeHtml(name)}" style="width:80px;height:80px;object-fit:contain;border-radius:8px;padding:4px;background:#f8f9fc;" 
                              onerror="this.style.display='none'; this.parentElement.querySelector('.fallback-icon').style.display='flex';">` :
                ''
            }
                    <i class="fas ${icon} fallback-icon" style="${imageUrl ? 'display:none;' : 'display:flex;'} font-size:32px; color:${iconColor}; align-items:center; justify-content:center; width:80px; height:80px; background:#f8f9fc; border-radius:8px;"></i>
                </div>
                <div class="cart-item-details">
                    <h4>${escapeHtml(name)}</h4>
                    <div class="item-category">${escapeHtml(category)}</div>
                    ${isService ? '<span style="font-size:10px;color:#00b4db;">Service</span>' : ''}
                    ${isBundle ? '<span style="font-size:10px;color:#667eea;">Bundle</span>' : ''}
                </div>
                <div class="cart-item-quantity">
                    ${isService ? `
                        <span style="font-size:13px;color:#888;padding:0 10px;">1</span>
                    ` : `
                        <button class="quantity-btn" onclick="window.updateQuantity(${index}, -1)" ${quantity <= 1 ? 'disabled' : ''}>
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" class="quantity-input" value="${quantity}" min="1" 
                               onchange="window.updateQuantity(${index}, 0, this.value)">
                        <button class="quantity-btn" onclick="window.updateQuantity(${index}, 1)">
                            <i class="fas fa-plus"></i>
                        </button>
                    `}
                </div>
                <div class="cart-item-price">RM ${itemTotal.toFixed(2)}</div>
                <button class="cart-item-remove" onclick="window.removeItem(${index})">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
    });

    const user = getUser();
    const memberDiscount = user ? total * 0.1 : 0;
    const finalTotal = total - memberDiscount;

    html += `
            </div>
            <div class="cart-summary">
                <h3>Order Summary</h3>
                <div class="summary-row">
                    <span>Subtotal</span>
                    <span>RM ${total.toFixed(2)}</span>
                </div>
                ${memberDiscount > 0 ? `
                    <div class="summary-row" style="color: #4CAF50;">
                        <span>Member Discount (10%)</span>
                        <span>-RM ${memberDiscount.toFixed(2)}</span>
                    </div>
                ` : ''}
                <div class="summary-row">
                    <span>Shipping</span>
                    <span style="color: #4CAF50;">Free</span>
                </div>
                <div class="summary-row total">
                    <span>Total</span>
                    <span>RM ${finalTotal.toFixed(2)}</span>
                </div>
                ${user ? `
                    <div class="discount-badge">
                        <i class="fas fa-tag"></i> Member Discount Applied
                    </div>
                ` : `
                    <div style="font-size: 13px; color: #888; margin: 10px 0; text-align: center;">
                        <a href="auth.html" style="color: #00d4ff; text-decoration: none;">Login</a> to get 10% member discount
                    </div>
                `}
                <button class="checkout-btn" onclick="window.checkout()" ${items.length === 0 ? 'disabled' : ''}>
                    <i class="fas fa-lock"></i> Proceed to Checkout
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================
// CART FUNCTIONS
// ============================================

window.updateQuantity = async function (index, change, newValue) {
    const item = currentCartItems[index];
    if (!item) return;

    // Services have fixed quantity of 1
    if (item.type === 'service') {
        showToast('Services have fixed quantity.', 'warning');
        return;
    }

    let newQuantity;
    if (newValue !== undefined) {
        newQuantity = parseInt(newValue) || 1;
    } else {
        newQuantity = (item.quantity || 1) + change;
    }

    if (newQuantity < 1) {
        await window.removeItem(index);
        return;
    }

    item.quantity = newQuantity;
    item.total_price = item.price * newQuantity;

    await saveCartItem(item);
    await loadCart();
};

window.removeItem = async function (index) {
    const item = currentCartItems[index];
    if (!item) return;

    if (!confirm(`Remove "${item.name || 'item'}" from your cart?`)) return;

    try {
        const user = getUser();

        if (user) {
            if (item.type === 'product' && item.ci_id) {
                await dataService.removeCartItem(item.ci_id);
            } else if (item.type === 'service' && item.cs_id) {
                await supabase
                    .from('cart_service')
                    .delete()
                    .eq('cs_id', item.cs_id);
            } else if (item.type === 'bundle' && item.source === 'local') {
                // Bundle is only in localStorage, remove it from there
            }
        }

        // Remove from localStorage
        const localCart = getLocalCart();
        const filtered = localCart.filter(i => !(i.type === item.type && i.id === item.id));
        saveLocalCart(filtered);

        currentCartItems.splice(index, 1);
        await updateCartCountDisplay();
        await loadCart();

    } catch (error) {
        console.error('Error removing item:', error);
        showError('Failed to remove item. Please try again.');
    }
};

window.checkout = function () {
    if (!currentCartItems || currentCartItems.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    window.location.href = 'payment.html';
};

async function saveCartItem(item) {
    const user = getUser();

    if (user && item.source === 'database') {
        try {
            if (item.type === 'product' && item.ci_id) {
                await dataService.updateCartItemQuantity(item.ci_id, item.quantity);
            } else if (item.type === 'service' && item.cs_id) {
                // Services don't have quantity updates
            }
        } catch (error) {
            console.error('Error updating database cart item:', error);
        }
    }

    // Update localStorage
    const localCart = getLocalCart();
    const existingIndex = localCart.findIndex(i => i.type === item.type && i.id === item.id);
    if (existingIndex >= 0) {
        localCart[existingIndex].quantity = item.quantity;
    } else {
        localCart.push({
            type: item.type,
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        });
    }
    saveLocalCart(localCart);

    await updateCartCountDisplay();
}

// ============================================
// ADD BUNDLE TO CART
// ============================================

window.addBundleToCart = async function (bundleId) {
    try {
        const success = await addBundleToCart(bundleId);
        if (success) {
            showToast('Bundle added to cart!', 'success');
            setTimeout(() => {
                window.location.href = 'cart.html';
            }, 1000);
        }
    } catch (error) {
        console.error('Error adding bundle:', error);
        showToast('Failed to add bundle to cart', 'error');
    }
};

function showToast(message, type = 'success') {
    const existing = document.querySelector('.custom-toast');
    if (existing) existing.remove();

    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#00d4ff'
    };

    const toast = document.createElement('div');
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
    }, 3500);
}

function showError(message) {
    const container = document.getElementById('cartContainer');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
                <h3 style="color: #1a1a2e; margin-bottom: 10px;">Something went wrong</h3>
                <p style="color: #666; margin-bottom: 25px;">${message}</p>
                <button onclick="location.reload()" class="continue-shopping-btn">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function cleanupNullServices() {
    try {
        const user = getUser();
        if (!user) return;
        
        await dataService.ensureInitialized();
        const cartId = dataService.currentCartId;
        
        if (!cartId) return;
        
        // Delete cart_service entries with null service_id
        const { data: nullServices, error: fetchError } = await supabase
            .from('cart_service')
            .select('cs_id')
            .eq('cart_id', cartId)
            .is('service_id', null);
        
        if (fetchError) {
            console.error('Error fetching null services:', fetchError);
            return;
        }
        
        if (nullServices && nullServices.length > 0) {
            
            const ids = nullServices.map(item => item.cs_id);
            const { error: deleteError } = await supabase
                .from('cart_service')
                .delete()
                .in('cs_id', ids);
            
            if (deleteError) {
                console.error('Error deleting null services:', deleteError);
            } else {

            }
        }
    } catch (error) {
        console.error('Error cleaning up null services:', error);
    }
}

console.log('✅ cart.js loaded');