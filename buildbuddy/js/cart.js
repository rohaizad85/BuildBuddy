import supabase from './supabase-client.js';
import dataService from './data-service.js';

let cartItems = [];
let cartServices = [];
let inventoryCache = {};
let servicesCache = {};

document.addEventListener('DOMContentLoaded', async () => {
    await loadCart();
});

function getUser() {
    const user = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
    return user ? JSON.parse(user) : null;
}

async function loadDatabaseCart() {
    const items = await dataService.getCartItems();
    const services = await dataService.getCartServices();
    cartItems = (items || []).map(i => ({
        id: i.ci_id, type: 'product', productId: i.i_id,
        quantity: i.quantity || 1, price: i.total_price ? i.total_price / (i.quantity || 1) : 0
    }));
    cartServices = (services || []).map(s => ({
        id: s.cs_id, type: 'service', serviceId: s.service_id, quantity: 1
    }));
}

async function loadCart() {
    const container = document.getElementById('cartContainer');
    try {
        const user = getUser();
        if (user) {
            await dataService.initSession();
            await dataService.getOrCreateCart();
            await loadDatabaseCart();
            // ALSO load local cart for bundles that aren't in DB
            loadLocalCartBundles();
        } else {
            loadLocalCart();
        }
        await fetchItemDetails();
        renderCart();
        updateCartCount();
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<p>Error loading cart</p>';
    }
}

function loadLocalCart() {
    const local = JSON.parse(localStorage.getItem('buildbuddy_cart')) || [];
    cartItems = []; 
    cartServices = [];
    local.forEach((item, i) => {
        if (item.type === 'service') {
            cartServices.push({ id: 'local_' + i, type: 'service', serviceId: item.id, quantity: 1 });
        } else {
            cartItems.push({ id: 'local_' + i, type: item.type || 'product', productId: item.id, bundleId: item.id, quantity: item.quantity || 1, price: item.price, name: item.name });
        }
    });
}


function loadLocalCartBundles() {
    const local = JSON.parse(localStorage.getItem('buildbuddy_cart')) || [];
    local.forEach((item, i) => {
        if (item.type === 'bundle') {
            // Check if bundle already exists in cartItems
            const exists = cartItems.find(ci => ci.type === 'bundle' && ci.bundleId === item.id);
            if (!exists) {
                cartItems.push({
                    id: 'local_bundle_' + i,
                    type: 'bundle',
                    bundleId: item.id,
                    quantity: item.quantity || 1,
                    price: item.price,
                    name: item.name
                });
            }
        }
    });
}

async function fetchItemDetails() {
    for (const item of cartItems) {
        if (item.type === 'bundle' && item.bundleId) {
            if (!inventoryCache['bundle_' + item.bundleId]) {
                const data = await supabase.from('bundles').select('*').eq('bundle_id', item.bundleId).single();
                if (data) {
                    inventoryCache['bundle_' + item.bundleId] = data;
                    item.price = data.bundle_price;
                    item.name = data.bundle_name;
                }
            }
        } else if (item.productId && !inventoryCache[item.productId]) {
            const data = await supabase.from('inventory').select('*').eq('i_id', item.productId).single();
            if (data) { inventoryCache[item.productId] = data; item.price = data.i_price; item.name = data.i_name; }
        }
    }
    for (const s of cartServices) {
        if (!servicesCache[s.serviceId]) {
            const data = await supabase.from('service').select('*').eq('service_id', s.serviceId).single();
            if (data) servicesCache[s.serviceId] = data;
        }
    }
}

function renderCart() {
    const container = document.getElementById('cartContainer');
    const all = [...cartItems, ...cartServices];
    
    if (all.length === 0) {
        container.innerHTML = `<div class="empty-cart"><i class="fas fa-shopping-cart"></i><h3>Your cart is empty</h3><button class="continue-shopping-btn" onclick="window.location.href='index.html'">Continue Shopping</button></div>`;
        return;
    }
    
    let subtotal = 0, html = '';
    
    for (const item of cartItems) {
    const isBundle = item.type === 'bundle';
    const prod = inventoryCache[isBundle ? ('bundle_' + item.bundleId) : item.productId] || {};
    const name = isBundle ? (prod.bundle_name || item.name || 'Pre-Built PC') : (prod.i_name || item.name || 'Product');
    const price = item.price || (isBundle ? prod.bundle_price : prod.i_price) || 0;
    const qty = item.quantity || 1;
    subtotal += price * qty;
    html += `
        <div class="cart-item">
            <div class="cart-item-image"><i class="fas fa-${isBundle ? 'desktop' : 'box'}"></i></div>
            <div class="cart-item-details"><h4>${name}</h4><span class="item-type">${isBundle ? 'Pre-Built PC' : 'Component'}</span></div>
            <div class="cart-item-quantity">
                <button class="quantity-btn qty-btn" data-id="${item.id}" data-change="-1">-</button>
                <input type="text" class="quantity-input qty-input" data-id="${item.id}" value="${qty}">
                <button class="quantity-btn qty-btn" data-id="${item.id}" data-change="1">+</button>
            </div>
            <div class="cart-item-price">RM ${(price * qty).toFixed(2)}</div>
            <button class="cart-item-remove" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
        </div>`;
}
    
    for (const s of cartServices) {
        const svc = servicesCache[s.serviceId] || {};
        const name = svc.service_name || 'Service';
        const price = svc.service_price || 0;
        const qty = s.quantity || 1;
        subtotal += parseFloat(price) * qty;
        html += `
            <div class="cart-item">
                <div class="cart-item-image"><i class="fas fa-tools"></i></div>
                <div class="cart-item-details"><h4>${name}</h4><span class="item-type">Service</span></div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn qty-btn" data-id="${s.id}" data-change="-1">-</button>
                    <input type="text" class="quantity-input qty-input" data-id="${s.id}" value="${qty}">
                    <button class="quantity-btn qty-btn" data-id="${s.id}" data-change="1">+</button>
                </div>
                <div class="cart-item-price">RM ${(parseFloat(price) * qty).toFixed(2)}</div>
                <button class="cart-item-remove" data-id="${s.id}"><i class="fas fa-trash-alt"></i></button>
            </div>`;
    }
    
    const discount = getUser() ? subtotal * 0.1 : 0;
    const total = subtotal - discount;
    
    container.innerHTML = `
        <div class="cart-container">
            <div class="cart-items"><h2>Cart Items (${all.length})</h2>${html}</div>
            <div class="cart-summary">
                <h3>Order Summary</h3>
                <div class="summary-row"><span>Subtotal</span><span>RM ${subtotal.toFixed(2)}</span></div>
                ${discount > 0 ? `<div class="summary-row" style="color:#4CAF50;"><span>Discount</span><span>-RM ${discount.toFixed(2)}</span></div>` : ''}
                <div class="summary-row"><span>Shipping</span><span style="color:#4CAF50;">Free</span></div>
                <div class="summary-row total"><span>Total</span><span>RM ${total.toFixed(2)}</span></div>
                <button class="checkout-btn" id="checkoutBtn"><i class="fas fa-lock"></i> Proceed to Checkout</button>
            </div>
        </div>`;
    
    attachEvents();
}

function attachEvents() {
    // +/- buttons
    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const change = parseInt(btn.dataset.change);
            const item = [...cartItems, ...cartServices].find(i => i.id == id);
            if (!item) return;
            const newQty = (item.quantity || 1) + change;
            if (newQty < 1) { await handleRemove(id); return; }
            item.quantity = newQty;
            await saveQuantity(id, newQty);
            renderCart(); updateCartCount();
            syncToLocalStorage();
        });
    });
    
    // Editable inputs
    document.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('input', () => { input.value = input.value.replace(/[^0-9]/g, ''); });
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') { e.preventDefault(); await processQtyInput(input); input.blur(); }
        });
        input.addEventListener('blur', async () => { await processQtyInput(input); });
    });
    
    // Remove buttons
    document.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', async () => { await handleRemove(btn.dataset.id); });
    });
    
    document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    window.location.href = 'payment.html';
    });

}

async function processQtyInput(input) {
    const id = input.dataset.id;
    const item = [...cartItems, ...cartServices].find(i => i.id == id);
    if (!item) return;
    const val = parseInt(input.value);
    if (isNaN(val) || val < 0) { renderCart(); return; }
    if (val === 0) { await handleRemove(id); return; }
    if (val > 99) { renderCart(); return; }
    item.quantity = val;
    await saveQuantity(id, val);
    renderCart(); updateCartCount();
    syncToLocalStorage();
}

async function saveQuantity(id, qty) {
    const user = getUser();
    if (user && !String(id).startsWith('local_')) {
        try { await dataService.updateCartItemQuantity(id, qty); } catch (e) {}
    }
}

async function handleRemove(itemId) {
    const item = [...cartItems, ...cartServices].find(i => i.id == itemId);
    if (!item) return;
    let itemName = 'this item';
    if (item.type === 'service') { 
        const svc = servicesCache[item.serviceId]; 
        itemName = svc?.service_name || 'this service'; 
    } else if (item.type === 'bundle') {
        itemName = item.name || 'Pre-Built PC';
    } else { 
        const prod = inventoryCache[item.productId]; 
        itemName = prod?.i_name || item.name || 'this product'; 
    }
    
    const confirmed = await confirmPopup(itemName);
    if (!confirmed) return;
    
    // Remove from arrays
    cartItems = cartItems.filter(i => i.id != itemId);
    cartServices = cartServices.filter(s => s.id != itemId);
    
    // Update localStorage for ALL items (including bundles)
    syncToLocalStorage();
    
    // Remove from database if applicable
    const user = getUser();
    if (user && !String(itemId).startsWith('local_') && item.type !== 'bundle') {
        try {
            if (item.type === 'service') {
                await supabase.from('cart_service').delete().eq('cs_id', itemId);
            } else {
                await supabase.from('cart_items').delete().eq('ci_id', itemId);
            }
        } catch (e) { console.error('Remove error:', e); }
    }
    
    renderCart(); 
    updateCartCount();
}

// Add this function to sync cart items back to localStorage
function syncToLocalStorage() {
    const localCart = cartItems.map(item => ({
        type: item.type || 'product',
        id: item.bundleId || item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1
    }));
    
    // Also add services
    cartServices.forEach(s => {
        localCart.push({
            type: 'service',
            id: s.serviceId,
            quantity: 1
        });
    });
    
    localStorage.setItem('buildbuddy_cart', JSON.stringify(localCart));
}

function confirmPopup(itemName) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
        const popup = document.createElement('div');
        popup.style.cssText = 'background:white;border-radius:16px;padding:30px;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
        popup.innerHTML = `
            <i class="fas fa-trash-alt" style="font-size:48px;color:#f44336;margin-bottom:15px;"></i>
            <h3 style="margin-bottom:10px;">Remove Item?</h3>
            <p style="color:#666;margin-bottom:25px;">Remove <strong>"${itemName}"</strong>?</p>
            <div style="display:flex;gap:12px;">
                <button id="popCancel" style="flex:1;padding:12px;border:1px solid #e0e0e0;background:white;border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
                <button id="popConfirm" style="flex:1;padding:12px;border:none;background:#f44336;color:white;border-radius:8px;cursor:pointer;font-weight:600;">Remove</button>
            </div>`;
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
        document.getElementById('popCancel').onclick = () => { overlay.remove(); resolve(false); };
        document.getElementById('popConfirm').onclick = () => { overlay.remove(); resolve(true); };
        overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
}

function updateCartCount() {
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = cartItems.length + cartServices.length);
}