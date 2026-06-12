import supabase from './supabase-client.js';
import dataService from './data-service.js';
import { openMapSelector } from './services/maps.js';
import { downloadReceipt, getCurrentUser } from './receipt.js';

let cartItems = [];
let cartServices = [];
let cartTotal = 0;
let selectedPayment = null;
let voucherDiscount = 0;
let userData = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCheckout();
});

function getUser() {
    return getCurrentUser();
}

async function loadCheckout() {
    const container = document.getElementById('checkoutContainer');
    
    try {
        const user = getUser();
        if (user) {
            await dataService.initSession();
            await dataService.getOrCreateCart();
            const items = await dataService.getCartItems();
            const services = await dataService.getCartServices();
            
            cartItems = (items || []).map(i => ({
                id: i.ci_id, type: 'product', productId: i.i_id,
                quantity: i.quantity || 1, price: i.total_price ? i.total_price / (i.quantity || 1) : 0
            }));
            cartServices = (services || []).map(s => ({
                id: s.cs_id, type: 'service', serviceId: s.service_id, quantity: 1
            }));
            
            // ALSO load localStorage items (bundles + any items not in DB)
            const local = JSON.parse(localStorage.getItem('buildbuddy_cart') || '[]');
            local.forEach((item, i) => {
                if (item.type === 'product') {
                    const exists = cartItems.find(ci => ci.productId === item.id && !String(ci.id).startsWith('local_'));
                    if (!exists) {
                        cartItems.push({ id: 'local_prod_' + i, type: 'product', productId: item.id, quantity: item.quantity || 1, price: item.price, name: item.name });
                    }
                } else if (item.type === 'bundle') {
                    const exists = cartItems.find(ci => ci.type === 'bundle' && ci.bundleId === item.id);
                    if (!exists) {
                        cartItems.push({ id: 'local_bundle_' + i, type: 'bundle', bundleId: item.id, quantity: item.quantity || 1, price: item.price, name: item.name });
                    }
                } else if (item.type === 'service') {
                    const exists = cartServices.find(cs => cs.serviceId === item.id);
                    if (!exists) {
                        cartServices.push({ id: 'local_svc_' + i, type: 'service', serviceId: item.id, quantity: 1 });
                    }
                }
            });
            
            // Load user details for autofill
            const dbUser = await supabase.from('users')
                .select('full_name, email, phone, address')
                .eq('user_id', user.user_id || user.id)
                .single();
            if (dbUser) userData = dbUser;
        } else {
            const local = JSON.parse(localStorage.getItem('buildbuddy_cart') || '[]');
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
        
        // Fetch details
        await fetchDetails();
        
        // Calculate total
        calculateTotal();
        
        if (cartItems.length === 0 && cartServices.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:60px;"><i class="fas fa-shopping-cart" style="font-size:64px;color:#ccc;margin-bottom:20px;"></i><h2>Your cart is empty</h2><button class="place-order-btn" onclick="window.location.href='index.html'" style="max-width:300px;">Continue Shopping</button></div>`;
            return;
        }
        
        renderCheckout();
        
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<p style="text-align:center;padding:60px;">Failed to load checkout. Please try again.</p>';
    }
}

async function fetchDetails() {
    for (const item of cartItems) {
        if (item.productId) {
            const data = await supabase.from('inventory').select('*').eq('i_id', item.productId).single();
            if (data) { item.price = data.i_price; item.name = data.i_name; item.stock = data.i_quantity; }
        } else if (item.bundleId) {
            const data = await supabase.from('bundles').select('*').eq('bundle_id', item.bundleId).single();
            if (data) { item.price = data.bundle_price; item.name = data.bundle_name; item.stock = data.bundle_stock; }
        }
    }
    for (const s of cartServices) {
        const data = await supabase.from('service').select('*').eq('service_id', s.serviceId).single();
        if (data) { s.name = data.service_name; s.price = data.service_price; }
    }
}

function calculateTotal() {
    cartTotal = 0;
    cartItems.forEach(i => cartTotal += (i.price || 0) * (i.quantity || 1));
    cartServices.forEach(s => cartTotal += parseFloat(s.price || 0) * (s.quantity || 1));
}

function renderCheckout() {
    const container = document.getElementById('checkoutContainer');
    
    container.innerHTML = `
        <div class="checkout-container">
            <div class="checkout-form">
                <!-- Shipping Information -->
                <div class="form-section">
                    <div class="section-title"><i class="fas fa-truck"></i> Shipping Information</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Full Name *</label>
                            <input type="text" id="shipName" value="${escapeAttr(userData?.full_name || '')}" placeholder="Enter your full name">
                            <span class="error-msg" id="nameError"></span>
                        </div>
                        <div class="form-group">
                            <label>Phone Number *</label>
                            <input type="tel" id="shipPhone" value="${escapeAttr(userData?.phone || '')}" placeholder="+60 12-345 6789">
                            <span class="error-msg" id="phoneError"></span>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:15px;">
                        <label>Email *</label>
                        <input type="email" id="shipEmail" value="${escapeAttr(userData?.email || '')}" placeholder="your@email.com">
                        <span class="error-msg" id="emailError"></span>
                    </div>
                    <div class="form-group">
                        <label>Shipping Address *</label>
                        <div style="display:flex;gap:8px;">
                            <textarea id="shipAddress" rows="3" placeholder="Street, City, State, Postcode" style="flex:1;">${escapeAttr(userData?.address || '')}</textarea>
                            <button type="button" id="mapBtn" title="Pick address from map" style="padding:10px 14px;background:#f0f0f5;border:1px solid #e0e0e0;border-radius:8px;cursor:pointer;transition:all 0.3s;align-self:flex-start;white-space:nowrap;">
                                <i class="fas fa-map-marker-alt" style="color:#f44336;"></i> <span style="font-size:12px;">Map</span>
                            </button>
                        </div>
                        <span class="error-msg" id="addressError"></span>
                    </div>
                </div>
                
                <!-- Payment Method -->
                <div class="form-section">
                    <div class="section-title"><i class="fas fa-credit-card"></i> Payment Method</div>
                    <div class="payment-methods">
                        <div class="payment-method" data-method="cash" onclick="window.selectPayment('cash', this)">
                            <i class="fas fa-money-bill-wave"></i>
                            <h4>Cash on Delivery</h4>
                            <p>Pay when you receive</p>
                        </div>
                        <div class="payment-method" data-method="card" onclick="window.selectPayment('card', this)">
                            <i class="fas fa-credit-card"></i>
                            <h4>Online Payment</h4>
                            <p>Card / Bank Transfer</p>
                        </div>
                    </div>
                    <span class="error-msg" id="paymentError" style="display:block;"></span>
                </div>
                
                <!-- Voucher -->
                <div class="form-section">
                    <div class="section-title"><i class="fas fa-ticket-alt"></i> Voucher / Promo Code</div>
                    <div class="voucher-section">
                        <input type="text" id="voucherCode" placeholder="Enter voucher code (optional)">
                        <button onclick="window.applyVoucher()">Apply</button>
                    </div>
                    <div class="voucher-msg" id="voucherMsg"></div>
                </div>
            </div>
            
            <!-- Order Summary -->
            <div class="order-summary">
                <h3><i class="fas fa-receipt"></i> Order Summary</h3>
                ${renderSummaryItems()}
                <div class="summary-item"><span>Subtotal</span><span>RM ${cartTotal.toFixed(2)}</span></div>
                <div class="summary-item discount" id="voucherDiscountRow" style="display:none;"><span>Voucher Discount</span><span>-RM 0.00</span></div>
                <div class="summary-item discount"><span>Member Discount (10%)</span><span>-RM ${getUser() ? (cartTotal * 0.1).toFixed(2) : '0.00'}</span></div>
                <div class="summary-item"><span>Shipping</span><span style="color:#4CAF50;">Free</span></div>
                <div class="summary-item total"><span>Total</span><span id="finalTotal">RM ${getFinalTotal().toFixed(2)}</span></div>
                <button class="place-order-btn" id="placeOrderBtn" onclick="window.placeOrder()">
                    <i class="fas fa-lock"></i> Place Order
                </button>
            </div>
        </div>
    `;

    const mapBtn = document.getElementById('mapBtn');
    if (mapBtn) {
        mapBtn.addEventListener('click', openMapSelector);
    }
}

function renderSummaryItems() {
    let html = '';
    cartItems.forEach(item => {
        html += `<div class="summary-item"><span>${item.name || 'Item'} x${item.quantity || 1}</span><span>RM ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span></div>`;
    });
    cartServices.forEach(s => {
        html += `<div class="summary-item"><span>${s.name || 'Service'}</span><span>RM ${parseFloat(s.price || 0).toFixed(2)}</span></div>`;
    });
    return html;
}

function getFinalTotal() {
    const memberDiscount = getUser() ? cartTotal * 0.1 : 0;
    return cartTotal - memberDiscount - voucherDiscount;
}

// ===== GLOBAL FUNCTIONS =====
window.selectPayment = function(method, element) {
    document.querySelectorAll('.payment-method').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedPayment = method;
    document.getElementById('paymentError').style.display = 'none';
};

window.applyVoucher = function() {
    const code = document.getElementById('voucherCode').value.trim();
    const msgEl = document.getElementById('voucherMsg');
    
    if (!code) {
        msgEl.className = 'voucher-msg error';
        msgEl.textContent = 'Please enter a voucher code';
        return;
    }
    
    if (code.toUpperCase() === 'BUILD10') {
        voucherDiscount = cartTotal * 0.1;
        msgEl.className = 'voucher-msg success';
        msgEl.textContent = '✅ Voucher applied! 10% off';
    } else if (code.toUpperCase() === 'WELCOME5') {
        voucherDiscount = 5;
        msgEl.className = 'voucher-msg success';
        msgEl.textContent = '✅ RM5 off applied!';
    } else if (code.toUpperCase() === 'FREESHIP') {
        voucherDiscount = 0;
        msgEl.className = 'voucher-msg success';
        msgEl.textContent = '✅ Free shipping applied (already free!)';
    } else {
        voucherDiscount = 0;
        msgEl.className = 'voucher-msg error';
        msgEl.textContent = '❌ Invalid voucher code';
    }
    
    updateTotalDisplay();
};

function updateTotalDisplay() {
    document.getElementById('voucherDiscountRow').style.display = voucherDiscount > 0 ? 'flex' : 'none';
    document.getElementById('voucherDiscountRow').querySelector('span:last-child').textContent = `-RM ${voucherDiscount.toFixed(2)}`;
    document.getElementById('finalTotal').textContent = `RM ${getFinalTotal().toFixed(2)}`;
}

window.placeOrder = async function() {
    const name = document.getElementById('shipName').value.trim();
    const phone = document.getElementById('shipPhone').value.trim();
    const email = document.getElementById('shipEmail').value.trim();
    const address = document.getElementById('shipAddress').value.trim();
    
    let hasError = false;
    
    if (!name) { showError('nameError', 'Name is required'); hasError = true; }
    if (!phone) { showError('phoneError', 'Phone is required'); hasError = true; }
    else if (!/^\+?[\d\s-]{8,15}$/.test(phone)) { showError('phoneError', 'Invalid phone number'); hasError = true; }
    if (!email) { showError('emailError', 'Email is required'); hasError = true; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('emailError', 'Invalid email'); hasError = true; }
    if (!address) { showError('addressError', 'Address is required'); hasError = true; }
    if (!selectedPayment) { showError('paymentError', 'Please select a payment method'); hasError = true; }
    
    if (hasError) return;
    
    const btn = document.getElementById('placeOrderBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;
    
    try {
        const total = getFinalTotal();
        const user = getUser();
        let sessionId = localStorage.getItem('buildbuddy_session_id');
        
        if (!sessionId) {
            sessionId = 'sess_guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('buildbuddy_session_id', sessionId);
        }
        
        if (!user) {
            const existingSession = await supabase.from('usersession')
                .select('session_id')
                .eq('session_id', sessionId);
            
            if (!existingSession || existingSession.length === 0) {
                await supabase.from('usersession').insert({
                    session_id: sessionId,
                    session_start: new Date().toISOString()
                });
            }
        }
        
        const cartId = user ? dataService.currentCartId : null;
        
        // Create payment record
        const paymentResult = await supabase.from('payment').insert({
            session_id: sessionId,
            cart_id: cartId,
            user_id: user ? (user.user_id || user.id) : null,
            total_amount: total,
            payment_method: selectedPayment,
            payment_status: selectedPayment === 'cash' ? 'PENDING' : 'PAID',
            payment_date: new Date().toISOString()
        }).select().single();
        
        // Decrease stock for inventory items
        for (const item of cartItems) {
            if (item.productId && item.stock !== undefined) {
                const newStock = item.stock - (item.quantity || 1);
                await supabase.from('inventory')
                    .update({ i_quantity: Math.max(0, newStock) })
                    .eq('i_id', item.productId);
            }
            if (item.bundleId && item.stock !== undefined) {
                const newStock = item.stock - (item.quantity || 1);
                await supabase.from('bundles')
                    .update({ bundle_stock: Math.max(0, newStock) })
                    .eq('bundle_id', item.bundleId);
            }
        }
        
        // Show success with receipt download
        showSuccess(total, paymentResult?.payment_id);

        if (user) {
            await dataService.createNewCart();
        }
        
        localStorage.removeItem('buildbuddy_cart');
        
    } catch (error) {
        console.error('Order failed:', error);
        alert('Failed to place order. Please try again.');
        btn.innerHTML = '<i class="fas fa-lock"></i> Place Order';
        btn.disabled = false;
    }
};

function showSuccess(total, paymentId) {
    const overlay = document.createElement('div');
    overlay.className = 'success-overlay';
    
    const isCash = selectedPayment === 'cash';
    const orderRef = paymentId ? 'BB-' + String(paymentId).padStart(6, '0') : 'BB' + Date.now().toString(36).toUpperCase();
    
    overlay.innerHTML = `
        <div class="success-modal">
            <div class="icon ${isCash ? 'cash' : 'online'}">
                <i class="fas fa-${isCash ? 'money-bill-wave' : 'check-circle'}"></i>
            </div>
            <h2>Thank You for Your Purchase! 🎉</h2>
            <div class="amount">RM ${total.toFixed(2)}</div>
            ${isCash ? `
                <p>📦 Your order has been placed successfully.<br>
                <strong>Please prepare RM ${total.toFixed(2)} upon delivery.</strong><br>
                Our team will contact you at <strong>${document.getElementById('shipPhone').value}</strong> before delivery.<br>
                Expected delivery: <strong>3-5 business days</strong></p>
            ` : `
                <p>✅ Your payment has been processed successfully.<br>
                Expected delivery: <strong>3-5 business days</strong></p>
            `}
            <p style="color:#888;font-size:13px;">Order reference: #${orderRef}</p>
            <button class="place-order-btn download-receipt-btn" style="margin-top: 10px; background: #1a1a2e; color: white;">
                <i class="fas fa-download"></i> Download Receipt (PDF)
            </button>
            <button class="place-order-btn" onclick="window.location.href='index.html'">
                <i class="fas fa-home"></i> Back to Home
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = '0');
    
    // Download receipt button click handler
    const downloadBtn = overlay.querySelector('.download-receipt-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const user = getUser();
            const orderData = {
                payment_id: paymentId || orderRef.replace('BB-', ''),
                payment_method: selectedPayment,
                payment_status: selectedPayment === 'cash' ? 'PENDING' : 'PAID',
                payment_date: new Date().toISOString(),
                total_amount: total,
                items: [
                    ...cartItems.map(i => ({
                        name: i.name || 'Product',
                        type: i.type || 'product',
                        quantity: i.quantity || 1,
                        price: i.price || 0,
                        total: (i.price || 0) * (i.quantity || 1)
                    })),
                    ...cartServices.map(s => ({
                        name: s.name || 'Service',
                        type: 'service',
                        quantity: 1,
                        price: parseFloat(s.price || 0),
                        total: parseFloat(s.price || 0)
                    }))
                ]
            };
            downloadReceipt(orderData, user || {
                full_name: document.getElementById('shipName').value,
                email: document.getElementById('shipEmail').value,
                phone: document.getElementById('shipPhone').value,
                address: document.getElementById('shipAddress').value
            });
        });
    }
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) { el.textContent = message; el.style.display = 'block'; }
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}