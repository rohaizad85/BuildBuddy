import supabase from './supabase-client.js';
import dataService from './data-service.js';

let cartItems = [];
let cartServices = [];
let inventoryCache = {};
let servicesCache = {};
let bundlesCache = {};

document.addEventListener('DOMContentLoaded', async () => {
    await loadCart();
    updateCartCount();
    checkLoginStatus();
});

async function loadCart() {
    const container = document.getElementById('cartContainer');
    
    try {
        const user = getUser();
        
        if (user) {
            await loadDatabaseCart();
        } else {
            loadLocalCart();
        }
        
        await fetchItemDetails();
        renderCart();
        
    } catch (error) {
        console.error('Error loading cart:', error);
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Failed to load cart</h3>
                <p>Please refresh the page or try again later.</p>
                <button class="continue-shopping-btn" onclick="window.location.href='index.html'">
                    Continue Shopping
                </button>
            </div>
        `;
    }
}

function getUser() {
    const user = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
    return user ? JSON.parse(user) : null;
}

async function loadDatabaseCart() {
    try {
        const dbCartItems = await dataService.getCartItems();
        const dbCartServices = await dataService.getCartServices();
        
        cartItems = dbCartItems.map(item => ({
            id: item.ci_id,
            type: 'product',
            productId: item.i_id,
            quantity: item.quantity,
            price: item.total_price / item.quantity
        }));
        
        cartServices = dbCartServices.map(cs => ({
            id: cs.cs_id,
            type: 'service',
            serviceId: cs.service_id,
            quantity: 1
        }));
        
        // Merge localStorage items
        const localCart = JSON.parse(localStorage.getItem('buildbuddy_cart')) || [];
        for (const localItem of localCart) {
            if (localItem.type === 'bundle') {
                cartItems.push({
                    id: `local_${Date.now()}_${Math.random()}`,
                    type: 'bundle',
                    bundleId: localItem.id,
                    quantity: localItem.quantity,
                    price: localItem.price,
                    name: localItem.name
                });
            }
        }
        
    } catch (error) {
        console.error('Error loading database cart:', error);
        loadLocalCart();
    }
}

function loadLocalCart() {
    const localCart = JSON.parse(localStorage.getItem('buildbuddy_cart')) || [];
    
    cartItems = [];
    cartServices = [];
    
    localCart.forEach(item => {
        if (item.type === 'bundle') {
            cartItems.push({
                id: `local_${Date.now()}_${Math.random()}`,
                type: 'bundle',
                bundleId: item.id,
                quantity: item.quantity || 1,
                price: item.price,
                name: item.name
            });
        } else if (item.type === 'product') {
            cartItems.push({
                id: `local_${Date.now()}_${Math.random()}`,
                type: 'product',
                productId: item.id,
                quantity: item.quantity || 1,
                price: item.price
            });
        } else if (item.type === 'service') {
            cartServices.push({
                id: `local_${Date.now()}_${Math.random()}`,
                type: 'service',
                serviceId: item.id,
                quantity: 1
            });
        }
    });
}

async function fetchItemDetails() {
    // Fetch inventory items
    for (const item of cartItems) {
        if (item.type === 'product' && item.productId) {
            if (!inventoryCache[item.productId]) {
                try {
                    const data = await supabase
                        .from('inventory')
                        .select('*')
                        .eq('i_id', item.productId)
                        .single();
                    
                    if (data) {
                        inventoryCache[item.productId] = data;
                        item.price = data.i_price;
                        item.name = data.i_name;
                    }
                } catch (error) {
                    console.error('Error fetching inventory:', error);
                }
            } else {
                const cached = inventoryCache[item.productId];
                item.price = cached.i_price;
                item.name = cached.i_name;
            }
        }
        
        if (item.type === 'bundle' && item.bundleId) {
            if (!bundlesCache[item.bundleId]) {
                try {
                    const data = await supabase
                        .from('bundles')
                        .select('*')
                        .eq('bundle_id', item.bundleId)
                        .single();
                    
                    if (data) {
                        bundlesCache[item.bundleId] = data;
                        item.price = data.bundle_price;
                        item.name = data.bundle_name;
                    }
                } catch (error) {
                    console.error('Error fetching bundle:', error);
                }
            } else {
                const cached = bundlesCache[item.bundleId];
                item.price = cached.bundle_price;
                item.name = cached.bundle_name;
            }
        }
    }
    
    // Fetch services
    for (const service of cartServices) {
        if (!servicesCache[service.serviceId]) {
            try {
                const data = await supabase
                    .from('service')
                    .select('*')
                    .eq('service_id', service.serviceId)
                    .single();
                
                if (data) {
                    servicesCache[service.serviceId] = data;
                }
            } catch (error) {
                console.error('Error fetching service:', error);
            }
        }
    }
}

function renderCart() {
    const container = document.getElementById('cartContainer');
    
    const allItems = [...cartItems, ...cartServices];
    
    if (allItems.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart"></i>
                <h3>Your cart is empty</h3>
                <p>Browse our products and add items to your cart!</p>
                <button class="continue-shopping-btn" onclick="window.location.href='index.html'">
                    Continue Shopping
                </button>
            </div>
        `;
        return;
    }
    
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    const total = subtotal - discount;
    
    container.innerHTML = `
        <div class="cart-container">
            <div class="cart-items">
                <h2>Cart Items (${allItems.length})</h2>
                <div id="cartItemsList">
                    ${renderCartItems()}
                </div>
            </div>
            
            <div class="cart-summary">
                <h3>Order Summary</h3>
                
                ${discount > 0 ? `
                    <div class="discount-badge">
                        <i class="fas fa-tag"></i>
                        Loyalty Discount Applied (10%)
                    </div>
                ` : ''}
                
                <div class="summary-row">
                    <span>Subtotal</span>
                    <span>RM ${subtotal.toFixed(2)}</span>
                </div>
                
                ${discount > 0 ? `
                    <div class="summary-row" style="color: #4CAF50;">
                        <span>Discount</span>
                        <span>-RM ${discount.toFixed(2)}</span>
                    </div>
                ` : ''}
                
                <div class="summary-row">
                    <span>Shipping</span>
                    <span style="color: #4CAF50;">Free</span>
                </div>
                
                <div class="summary-row total">
                    <span>Total</span>
                    <span>RM ${total.toFixed(2)}</span>
                </div>
                
                <button class="checkout-btn" onclick="window.proceedToCheckout()">
                    <i class="fas fa-lock"></i> Proceed to Checkout
                </button>
            </div>
        </div>
    `;
}

function renderCartItems() {
    let html = '';
    
    // Render product items
    for (const item of cartItems) {
        if (item.type === 'product' && inventoryCache[item.productId]) {
            const product = inventoryCache[item.productId];
            html += renderCartItem(item, {
                name: product.i_name,
                category: product.i_category,
                type: 'Component',
                image: getIconForCategory(product.i_category)
            });
        } else if (item.type === 'bundle') {
            const bundle = bundlesCache[item.bundleId];
            const name = bundle ? bundle.bundle_name : (item.name || 'Pre-Built PC');
            const category = bundle ? bundle.bundle_category : 'Pre-Built';
            
            html += renderCartItem(item, {
                name: name,
                category: category,
                type: 'Pre-Built PC',
                image: 'fa-desktop'
            });
        }
    }
    
    // Render service items
    for (const service of cartServices) {
        const serviceData = servicesCache[service.serviceId];
        if (serviceData) {
            html += renderCartItem(service, {
                name: serviceData.service_name,
                category: serviceData.service_category,
                type: 'Service',
                image: getServiceIcon(serviceData.service_category)
            });
        }
    }
    
    return html;
}

function renderCartItem(item, details) {
    const price = item.price || 0;
    
    return `
        <div class="cart-item" data-item-id="${item.id}" data-type="${item.type}">
            <div class="cart-item-image">
                <i class="fas ${details.image}"></i>
            </div>
            <div class="cart-item-details">
                <span class="item-category">${details.category || ''}</span>
                <h4>${details.name}</h4>
                <span class="item-type">${details.type}</span>
            </div>
            <div class="cart-item-quantity">
                <button class="quantity-btn" onclick="window.updateQuantity('${item.id}', -1)" ${item.quantity <= 1 ? 'disabled' : ''}>
                    <i class="fas fa-minus"></i>
                </button>
                <span class="quantity-input">${item.quantity}</span>
                <button class="quantity-btn" onclick="window.updateQuantity('${item.id}', 1)">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div class="cart-item-price">
                RM ${(price * item.quantity).toFixed(2)}
            </div>
            <button class="cart-item-remove" onclick="window.removeItem('${item.id}')">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;
}

function calculateSubtotal() {
    let total = 0;
    
    for (const item of cartItems) {
        total += (item.price || 0) * (item.quantity || 1);
    }
    
    for (const service of cartServices) {
        const serviceData = servicesCache[service.serviceId];
        if (serviceData) {
            total += parseFloat(serviceData.service_price) || 0;
        }
    }
    
    return total;
}

function calculateDiscount() {
    const user = getUser();
    if (user) {
        return calculateSubtotal() * 0.1;
    }
    return 0;
}

function getIconForCategory(category) {
    const icons = {
        cpu: 'fa-microchip',
        motherboard: 'fa-square',
        ram: 'fa-memory',
        gpu: 'fa-tv',
        storage: 'fa-hdd',
        psu: 'fa-plug',
        cooler: 'fa-fan'
    };
    return icons[category] || 'fa-box';
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

window.updateQuantity = function(itemId, change) {
    const item = [...cartItems, ...cartServices].find(i => i.id === itemId);
    if (!item) return;
    
    const newQuantity = item.quantity + change;
    if (newQuantity < 1) return;
    
    item.quantity = newQuantity;
    syncToLocalStorage();
    
    const user = getUser();
    if (user && !item.id.toString().startsWith('local_')) {
        updateDatabaseQuantity(itemId, newQuantity);
    }
    
    renderCart();
    updateCartCount();
};

async function updateDatabaseQuantity(itemId, quantity) {
    try {
        const cartItem = await supabase
            .from('cart_items')
            .select('i_id')
            .eq('ci_id', itemId)
            .single();
        
        if (cartItem) {
            const product = await supabase
                .from('inventory')
                .select('i_price')
                .eq('i_id', cartItem.i_id)
                .single();
            
            if (product) {
                await supabase
                    .from('cart_items')
                    .eq('ci_id', itemId)
                    .update({
                        quantity: quantity,
                        total_price: product.i_price * quantity
                    });
            }
        }
    } catch (error) {
        console.error('Error updating quantity:', error);
    }
}

window.removeItem = async function(itemId) {
    const user = getUser();
    
    cartItems = cartItems.filter(i => i.id !== itemId);
    cartServices = cartServices.filter(s => s.id !== itemId);
    
    syncToLocalStorage();
    
    if (user && !itemId.toString().startsWith('local_')) {
        try {
            await supabase
                .from('cart_items')
                .eq('ci_id', itemId)
                .delete();
        } catch (error) {
            // Try deleting from cart_service
            try {
                await supabase
                    .from('cart_service')
                    .eq('cs_id', itemId)
                    .delete();
            } catch (e) {
                console.error('Error removing item:', e);
            }
        }
    }
    
    renderCart();
    updateCartCount();
    showToast('Item removed from cart', 'success');
};

function syncToLocalStorage() {
    const localCart = [
        ...cartItems.filter(i => i.id.toString().startsWith('local_')).map(i => ({
            type: i.type,
            id: i.bundleId || i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity
        })),
        ...cartServices.filter(s => s.id.toString().startsWith('local_')).map(s => ({
            type: 'service',
            id: s.serviceId,
            quantity: 1
        }))
    ];
    
    localStorage.setItem('buildbuddy_cart', JSON.stringify(localCart));
}

window.proceedToCheckout = function() {
    const user = getUser();
    if (!user) {
        if (confirm('Please login to proceed with checkout. Go to login page?')) {
            window.location.href = 'auth.html';
        }
        return;
    }
    
    showToast('Proceeding to checkout...', 'success');
    // window.location.href = 'checkout.html';
};

function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.custom-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'} toast-icon"></i>
            <div class="toast-message">
                <div class="toast-title">${type === 'success' ? 'Success' : 'Notice'}</div>
                <div class="toast-text">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
    
    if (!document.getElementById('toast-styles')) {
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
                box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                overflow: hidden;
                z-index: 10000;
                opacity: 0;
                transform: translateX(400px);
                transition: all 0.3s ease;
                border-left: 4px solid #4CAF50;
            }
            .custom-toast.show { opacity: 1; transform: translateX(0); }
            .toast-content { display: flex; align-items: flex-start; padding: 16px 20px; gap: 15px; }
            .toast-icon { font-size: 24px; color: #4CAF50; }
            .toast-message { flex: 1; }
            .toast-title { font-weight: 600; color: #1a1a2e; margin-bottom: 4px; }
            .toast-text { color: #666; font-size: 13px; }
            .toast-close { background: none; border: none; color: #999; cursor: pointer; padding: 4px; }
            .toast-close:hover { color: #333; }
        `;
        document.head.appendChild(styles);
    }
}

function updateCartCount() {
    const cartCounts = document.querySelectorAll('.cart-count');
    const totalItems = cartItems.length + cartServices.length;
    cartCounts.forEach(count => count.textContent = totalItems);
}

function checkLoginStatus() {
    const user = getUser();
    const loginBtnText = document.getElementById('loginBtnText');
    
    if (user && loginBtnText) {
        loginBtnText.textContent = user.name.split(' ')[0];
    }
}