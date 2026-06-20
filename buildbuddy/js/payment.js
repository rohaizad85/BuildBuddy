// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\payment.js

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

const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';

console.log('🔍 Current sessionStorage:', {
    pending_order: sessionStorage.getItem('buildbuddy_pending_service_order'),
    last_order: localStorage.getItem('buildbuddy_last_service_order'),
    session_id: localStorage.getItem('buildbuddy_session_id')
});

document.addEventListener('DOMContentLoaded', async () => {
    await loadCheckout();
});

function getUser() {
    return getCurrentUser();
}

function getImageUrl(imagePath) {
    if (!imagePath) return null;

    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }

    return `${SUPABASE_URL}/storage/v1/object/public/images/${encodeURIComponent(imagePath)}`;
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
                id: i.ci_id,
                type: 'product',
                productId: i.i_id,
                quantity: i.quantity || 1,
                price: i.total_price ? i.total_price / (i.quantity || 1) : 0
            }));
            cartServices = (services || []).map(s => ({
                id: s.cs_id,
                type: 'service',
                serviceId: s.service_id,
                quantity: 1,
                price: 0,
                name: ''
            }));

            const local = JSON.parse(localStorage.getItem('buildbuddy_cart') || '[]');
            local.forEach((item, i) => {
                if (item.type === 'product') {
                    const exists = cartItems.find(ci => ci.productId === item.id && !String(ci.id).startsWith('local_'));
                    if (!exists) {
                        cartItems.push({
                            id: 'local_prod_' + i,
                            type: 'product',
                            productId: item.id,
                            quantity: item.quantity || 1,
                            price: item.price,
                            name: item.name,
                            stock: item.stock || 0
                        });
                    }
                } else if (item.type === 'bundle') {
                    const exists = cartItems.find(ci => ci.type === 'bundle' && ci.bundleId === item.id);
                    if (!exists) {
                        cartItems.push({
                            id: 'local_bundle_' + i,
                            type: 'bundle',
                            bundleId: item.id,
                            quantity: item.quantity || 1,
                            price: item.price,
                            name: item.name,
                            stock: item.stock || 0
                        });
                    }
                } else if (item.type === 'service') {
                    const exists = cartServices.find(cs => cs.serviceId === item.id);
                    if (!exists) {
                        cartServices.push({
                            id: 'local_svc_' + i,
                            type: 'service',
                            serviceId: item.id,
                            quantity: 1,
                            price: item.price || 0,
                            name: item.name || ''
                        });
                    }
                }
            });

            const { data: dbUser, error: userError } = await supabase
                .from('users')
                .select('full_name, email, phone, address')
                .eq('user_id', user.user_id || user.id)
                .single();

            if (dbUser && !userError) {
                userData = {
                    ...user,
                    ...dbUser
                };
                console.log('✅ User data loaded:', userData);
            } else {
                console.warn('⚠️ No user data found in DB, using stored user data');
                userData = user;
            }
        } else {
            const local = JSON.parse(localStorage.getItem('buildbuddy_cart') || '[]');
            cartItems = [];
            cartServices = [];
            local.forEach((item, i) => {
                if (item.type === 'service') {
                    cartServices.push({
                        id: 'local_' + i,
                        type: 'service',
                        serviceId: item.id,
                        quantity: 1,
                        price: item.price || 0,
                        name: item.name || ''
                    });
                } else {
                    const isBundle = item.type === 'bundle';
                    cartItems.push({
                        id: 'local_' + i,
                        type: item.type || 'product',
                        productId: isBundle ? undefined : item.id,
                        bundleId: isBundle ? item.id : undefined,
                        quantity: item.quantity || 1,
                        price: item.price,
                        name: item.name,
                        stock: item.stock || 0
                    });
                }
            });
        }

        // ✅ Check for pending service order AFTER cartServices is populated
        const pendingOrderStr = sessionStorage.getItem('buildbuddy_pending_service_order');
        if (pendingOrderStr) {
            try {
                const pendingOrder = JSON.parse(pendingOrderStr);
                console.log('📋 Found pending service order:', pendingOrder);

                const exists = cartServices.find(s => s.serviceId === pendingOrder.service_id);
                if (!exists) {
                    const { data: serviceData } = await supabase
                        .from('service')
                        .select('service_id, service_name, service_price')
                        .eq('service_id', pendingOrder.service_id)
                        .single();

                    if (serviceData) {
                        cartServices.push({
                            id: 'pending_' + pendingOrder.order_id,
                            type: 'service',
                            serviceId: pendingOrder.service_id,
                            quantity: 1,
                            price: serviceData.service_price || 0,
                            name: serviceData.service_name || 'Service'
                        });
                        console.log('✅ Added pending service to cart');
                    }
                } else {
                    console.log('ℹ️ Service already in cart:', pendingOrder.service_id);
                }
            } catch (e) {
                console.warn('Error loading pending service order:', e);
            }
        }

        await fetchDetails();
        calculateTotal();

        if (cartItems.length === 0 && cartServices.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:60px;">
                    <i class="fas fa-shopping-cart" style="font-size:64px;color:#ccc;margin-bottom:20px;"></i>
                    <h2>Your cart is empty</h2>
                    <button class="place-order-btn" onclick="window.location.href='index.html'" style="max-width:300px;">Continue Shopping</button>
                </div>
            `;
            return;
        }

        renderCheckout();

    } catch (error) {
        console.error('Error loading checkout:', error);
        container.innerHTML = `
            <div style="text-align:center;padding:60px;">
                <p style="color:#f44336;">Failed to load checkout. Please try again.</p>
                <button class="place-order-btn" onclick="location.reload()" style="max-width:300px;margin-top:20px;">Retry</button>
            </div>
        `;
    }
}

async function fetchDetails() {
    const productIds = [];
    const bundleIds = [];

    for (const item of cartItems) {
        if (item.productId) {
            productIds.push(item.productId);
        } else if (item.bundleId) {
            bundleIds.push(item.bundleId);
        }
    }

    if (productIds.length > 0) {
        try {
            const { data } = await supabase
                .from('inventory')
                .select('i_id, i_name, i_price, i_quantity, i_image_path')
                .in('i_id', productIds);

            if (data) {
                const productMap = {};
                data.forEach(p => {
                    productMap[p.i_id] = {
                        name: p.i_name,
                        price: parseFloat(p.i_price) || 0,
                        stock: p.i_quantity || 0,
                        image_path: p.i_image_path
                    };
                });

                cartItems.forEach(item => {
                    if (item.productId && productMap[item.productId]) {
                        item.price = productMap[item.productId].price;
                        item.name = productMap[item.productId].name;
                        item.stock = productMap[item.productId].stock;
                        item.image_path = productMap[item.productId].image_path;
                    }
                });
            }
        } catch (e) {
            console.warn('Error fetching product details:', e);
        }
    }

    if (bundleIds.length > 0) {
        try {
            const { data } = await supabase
                .from('bundles')
                .select('bundle_id, bundle_name, bundle_price, bundle_stock, bundle_image_url')
                .in('bundle_id', bundleIds);

            if (data) {
                const bundleMap = {};
                data.forEach(b => {
                    bundleMap[b.bundle_id] = {
                        name: b.bundle_name,
                        price: parseFloat(b.bundle_price) || 0,
                        stock: b.bundle_stock || 0,
                        image_path: b.bundle_image_url
                    };
                });

                cartItems.forEach(item => {
                    if (item.bundleId && bundleMap[item.bundleId]) {
                        item.price = bundleMap[item.bundleId].price;
                        item.name = bundleMap[item.bundleId].name;
                        item.stock = bundleMap[item.bundleId].stock;
                        item.image_path = bundleMap[item.bundleId].image_path;
                    }
                });
            }
        } catch (e) {
            console.warn('Error fetching bundle details:', e);
        }
    }

    const serviceIds = cartServices.map(s => s.serviceId).filter(id => id);
    if (serviceIds.length > 0) {
        try {
            const { data } = await supabase
                .from('service')
                .select('service_id, service_name, service_price')
                .in('service_id', serviceIds);

            if (data) {
                const serviceMap = {};
                data.forEach(s => {
                    serviceMap[s.service_id] = {
                        name: s.service_name,
                        price: parseFloat(s.service_price) || 0
                    };
                });

                cartServices.forEach(s => {
                    if (serviceMap[s.serviceId]) {
                        s.name = serviceMap[s.serviceId].name;
                        s.price = serviceMap[s.serviceId].price;
                    }
                });
            }
        } catch (e) {
            console.warn('Error fetching service details:', e);
        }
    }
}

function calculateTotal() {
    cartTotal = 0;
    cartItems.forEach(i => {
        cartTotal += (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1);
    });
    cartServices.forEach(s => {
        cartTotal += parseFloat(s.price) || 0;
    });
}

function renderCheckout() {
    const container = document.getElementById('checkoutContainer');

    const userName = userData?.full_name || userData?.name || '';
    const userPhone = userData?.phone || '';
    const userEmail = userData?.email || '';
    const userAddress = userData?.address || '';

    container.innerHTML = `
        <div class="checkout-container">
            <div class="checkout-form">
                <div class="form-section">
                    <div class="section-title"><i class="fas fa-truck"></i> Shipping Information</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Full Name *</label>
                            <input type="text" id="shipName" value="${escapeHtml(userName)}" placeholder="Enter your full name">
                            <span class="error-msg" id="nameError"></span>
                        </div>
                        <div class="form-group">
                            <label>Phone Number *</label>
                            <input type="tel" id="shipPhone" value="${escapeHtml(userPhone)}" placeholder="+60 12-345 6789">
                            <span class="error-msg" id="phoneError"></span>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:15px;">
                        <label>Email *</label>
                        <input type="email" id="shipEmail" value="${escapeHtml(userEmail)}" placeholder="your@email.com">
                        <span class="error-msg" id="emailError"></span>
                    </div>
                    <div class="form-group">
                        <label>Shipping Address *</label>
                        <div style="display:flex;gap:8px;">
                            <textarea id="shipAddress" rows="3" placeholder="Street, City, State, Postcode" style="flex:1;">${escapeHtml(userAddress)}</textarea>
                            <button type="button" id="mapBtn" title="Pick address from map" style="padding:10px 14px;background:#f0f0f5;border:1px solid #e0e0e0;border-radius:8px;cursor:pointer;transition:all 0.3s;align-self:flex-start;white-space:nowrap;">
                                <i class="fas fa-map-marker-alt" style="color:#f44336;"></i> <span style="font-size:12px;">Map</span>
                            </button>
                        </div>
                        <span class="error-msg" id="addressError"></span>
                    </div>
                </div>
                
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
                
                <div class="form-section">
                    <div class="section-title"><i class="fas fa-ticket-alt"></i> Voucher / Promo Code</div>
                    <div class="voucher-section">
                        <input type="text" id="voucherCode" placeholder="Enter voucher code (optional)">
                        <button onclick="window.applyVoucher()">Apply</button>
                    </div>
                    <div class="voucher-msg" id="voucherMsg"></div>
                </div>
            </div>
            
            <div class="order-summary">
                <h3><i class="fas fa-receipt"></i> Order Summary</h3>
                ${renderSummaryItems()}
                <div class="summary-item"><span>Subtotal</span><span>RM ${cartTotal.toFixed(2)}</span></div>
                <div class="summary-item discount" id="voucherDiscountRow" style="display:none;"><span>Voucher Discount</span><span>-RM 0.00</span></div>
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

    if (cartItems.length === 0 && cartServices.length === 0) {
        return '<p style="color:#888;text-align:center;padding:20px;">No items in cart</p>';
    }

    cartItems.forEach(item => {
        const itemTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
        const icon = item.type === 'bundle' ? 'fa-desktop' : 'fa-microchip';

        let imageUrl = null;
        if (item.image_path) {
            imageUrl = getImageUrl(item.image_path);
        }

        const stockWarning = (item.stock !== undefined && item.stock < (item.quantity || 1))
            ? ` <span style="color:#f44336;font-size:11px;">(Only ${item.stock} left)</span>`
            : '';

        html += `
            <div class="summary-item" style="align-items:center; gap:10px; padding: 10px 0;">
                <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                    <div style="width:44px; height:44px; border-radius:8px; overflow:hidden; flex-shrink:0; background:#f8f9fc; display:flex; align-items:center; justify-content:center; border:1px solid #e8e8e8;">
                        ${imageUrl ?
                `<img src="${imageUrl}" alt="${item.name || 'Item'}" style="width:100%;height:100%;object-fit:contain;padding:4px;" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fas ${icon}\\' style=\\'font-size:20px;color:#ccc;\\'></i>';">` :
                `<i class="fas ${icon}" style="font-size:20px;color:#ccc;"></i>`
            }
                    </div>
                    <span style="font-size:13px; color:#333; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${item.name || 'Item'} 
                        <span style="color:#888;">x${item.quantity || 1}</span>
                        ${stockWarning}
                    </span>
                </div>
                <span style="flex-shrink:0;">RM ${itemTotal.toFixed(2)}</span>
            </div>`;
    });

    cartServices.forEach(s => {
        html += `
            <div class="summary-item" style="align-items:center; gap:10px; padding: 10px 0;">
                <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                    <div style="width:44px; height:44px; border-radius:8px; background: linear-gradient(135deg, #00b4db 0%, #0083b0 100%); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i class="fas fa-tools" style="color:rgba(255,255,255,0.9); font-size:18px;"></i>
                    </div>
                    <span style="font-size:13px; color:#333; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${s.name || 'Service'}
                    </span>
                </div>
                <span style="flex-shrink:0;">RM ${parseFloat(s.price || 0).toFixed(2)}</span>
            </div>`;
    });

    return html;
}

function getFinalTotal() {
    return Math.max(0, cartTotal - voucherDiscount);
}

window.selectPayment = function (method, element) {
    document.querySelectorAll('.payment-method').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedPayment = method;
    document.getElementById('paymentError').style.display = 'none';
};

window.applyVoucher = function () {
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

// ============================================
// SAVE RECEIPT TO DATABASE
// ============================================
async function saveReceiptToDatabase(paymentId, orderData, userData) {
    try {
        const receiptId = 'BB-' + String(paymentId).padStart(6, '0');

        const receiptData = {
            payment_id: paymentId,
            receipt_id: receiptId,
            user_id: userData?.user_id || null,
            session_id: localStorage.getItem('buildbuddy_session_id'),
            total_amount: orderData.total_amount,
            payment_method: orderData.payment_method,
            payment_status: orderData.payment_status,
            payment_date: orderData.payment_date || new Date().toISOString(),
            shipping_name: orderData.shipping_name || userData?.full_name || '',
            shipping_email: orderData.shipping_email || userData?.email || '',
            shipping_phone: orderData.shipping_phone || userData?.phone || '',
            shipping_address: orderData.shipping_address || userData?.address || '',
            items: orderData.items || [],
            subtotal: orderData.subtotal || orderData.total_amount || 0,
            discount_amount: orderData.discount_amount || 0,
            discount_label: orderData.discount_label || '',
            created_at: new Date().toISOString()
        };

        console.log('📝 Saving receipt to database:', receiptData);

        const { error } = await supabase
            .from('receipts')
            .insert([receiptData]);

        if (error) {
            console.error('❌ Error saving receipt:', error);
            if (error.code === 'PGRST204') {
                console.warn('⚠️ Receipts table not found. Please create it.');
            }
        } else {
            console.log('✅ Receipt saved to database successfully!');
        }

        return true;
    } catch (error) {
        console.error('Error saving receipt:', error);
        return false;
    }
}

window.placeOrder = async function () {
    // Validate form
    const name = document.getElementById('shipName').value.trim();
    const phone = document.getElementById('shipPhone').value.trim();
    const email = document.getElementById('shipEmail').value.trim();
    const address = document.getElementById('shipAddress').value.trim();

    let hasError = false;

    if (!name) { showError('nameError', 'Name is required'); hasError = true; }
    else { hideError('nameError'); }

    if (!phone) { showError('phoneError', 'Phone is required'); hasError = true; }
    else if (!/^\+?[\d\s-]{8,15}$/.test(phone)) { showError('phoneError', 'Invalid phone number'); hasError = true; }
    else { hideError('phoneError'); }

    if (!email) { showError('emailError', 'Email is required'); hasError = true; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('emailError', 'Invalid email'); hasError = true; }
    else { hideError('emailError'); }

    if (!address) { showError('addressError', 'Address is required'); hasError = true; }
    else { hideError('addressError'); }

    if (!selectedPayment) { showError('paymentError', 'Please select a payment method'); hasError = true; }
    else { hideError('paymentError'); }

    if (hasError) return;

    const btn = document.getElementById('placeOrderBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    try {
        const user = getUser();
        const userId = user ? (user.user_id || user.id) : null;
        let sessionId = localStorage.getItem('buildbuddy_session_id');

        if (!sessionId) {
            sessionId = 'sess_guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('buildbuddy_session_id', sessionId);
        }

        // Ensure session exists
        const { data: existingSession } = await supabase
            .from('usersession')
            .select('session_id')
            .eq('session_id', sessionId)
            .maybeSingle();

        if (!existingSession) {
            await supabase
                .from('usersession')
                .insert({
                    session_id: sessionId,
                    session_start: new Date().toISOString()
                });
        }

        // Get the current cart from dataService
        const currentCartId = await dataService.currentCartId;

        if (!currentCartId) {
            await dataService.getOrCreateCart();
        }

        const cartId = dataService.currentCartId;

        if (!cartId) {
            throw new Error('Failed to get or create cart');
        }

        console.log('✅ Using cart:', cartId);

        // Verify cart items exist
        const { data: cartItemsCheck } = await supabase
            .from('cart_items')
            .select('count')
            .eq('cart_id', cartId)
            .single();

        // If cart is empty in DB but we have items in memory, add them
        if ((!cartItemsCheck || cartItemsCheck.count === 0) && (cartItems.length > 0 || cartServices.length > 0)) {
            console.log('🔄 Cart is empty in DB, adding items...');

            for (const item of cartItems) {
                if (item.productId) {
                    const { data: existingItem } = await supabase
                        .from('cart_items')
                        .select('ci_id')
                        .eq('cart_id', cartId)
                        .eq('i_id', item.productId)
                        .maybeSingle();

                    if (!existingItem) {
                        const quantity = parseInt(item.quantity) || 1;
                        const totalPrice = (parseFloat(item.price) || 0) * quantity;

                        await supabase
                            .from('cart_items')
                            .insert({
                                cart_id: cartId,
                                i_id: item.productId,
                                quantity: quantity,
                                total_price: totalPrice
                            });
                    } else {
                        console.log('ℹ️ Product already in cart:', item.productId);
                    }
                } else if (item.bundleId) {
                    const { data: bundle } = await supabase
                        .from('bundles')
                        .select(`
                            *,
                            bundle_items (
                                quantity,
                                inventory:i_id (
                                    i_id,
                                    i_price
                                )
                            )
                        `)
                        .eq('bundle_id', item.bundleId)
                        .single();

                    if (bundle && bundle.bundle_items) {
                        for (const component of bundle.bundle_items) {
                            const inv = component.inventory;
                            if (!inv) continue;

                            const { data: existingComp } = await supabase
                                .from('cart_items')
                                .select('ci_id')
                                .eq('cart_id', cartId)
                                .eq('i_id', inv.i_id)
                                .maybeSingle();

                            if (!existingComp) {
                                const quantity = (component.quantity || 1) * (parseInt(item.quantity) || 1);
                                const totalPrice = inv.i_price * quantity;

                                await supabase
                                    .from('cart_items')
                                    .insert({
                                        cart_id: cartId,
                                        i_id: inv.i_id,
                                        quantity: quantity,
                                        total_price: totalPrice
                                    });
                            }
                        }
                    }
                }
            }

            for (const service of cartServices) {
                if (service.serviceId) {
                    const { data: existingService } = await supabase
                        .from('cart_service')
                        .select('cs_id')
                        .eq('cart_id', cartId)
                        .eq('service_id', service.serviceId)
                        .maybeSingle();

                    if (!existingService) {
                        await supabase
                            .from('cart_service')
                            .insert({
                                cart_id: cartId,
                                service_id: service.serviceId
                            });
                    } else {
                        console.log('ℹ️ Service already in cart:', service.serviceId);
                    }
                }
            }
        }

        // Stock reduction
        const stockReductions = [];

        for (const item of cartItems) {
            const quantity = parseInt(item.quantity) || 1;

            if (item.productId && !item._dbNotFound) {
                const { data: currentStock } = await supabase
                    .from('inventory')
                    .select('i_quantity')
                    .eq('i_id', item.productId)
                    .single();

                const availableStock = currentStock?.i_quantity || 0;

                if (availableStock < quantity) {
                    alert(`Not enough stock for "${item.name}". Available: ${availableStock}, Requested: ${quantity}`);
                    btn.innerHTML = '<i class="fas fa-lock"></i> Place Order';
                    btn.disabled = false;
                    return;
                }

                stockReductions.push({
                    type: 'inventory',
                    id: item.productId,
                    newStock: availableStock - quantity
                });

            } else if (item.bundleId && !item._dbNotFound) {
                const { data: currentStock } = await supabase
                    .from('bundles')
                    .select('bundle_stock')
                    .eq('bundle_id', item.bundleId)
                    .single();

                const availableStock = currentStock?.bundle_stock || 0;

                if (availableStock < quantity) {
                    alert(`Not enough stock for bundle "${item.name}". Available: ${availableStock}, Requested: ${quantity}`);
                    btn.innerHTML = '<i class="fas fa-lock"></i> Place Order';
                    btn.disabled = false;
                    return;
                }

                stockReductions.push({
                    type: 'bundle',
                    id: item.bundleId,
                    newStock: availableStock - quantity
                });
            }
        }

        // Calculate final total with discounts
        const total = Math.max(0, cartTotal - voucherDiscount);

        // ============================================
        // CREATE PAYMENT RECORD
        // ============================================
        const paymentData = {
            session_id: sessionId,
            cart_id: cartId,
            user_id: userId,
            total_amount: total,
            payment_method: selectedPayment,
            payment_status: selectedPayment === 'cash' ? 'PENDING' : 'PAID',
            payment_date: new Date().toISOString()
        };

        console.log('📝 Creating payment:', paymentData);

        const { error: insertError } = await supabase
            .from('payment')
            .insert(paymentData);

        if (insertError) {
            throw new Error(`Failed to create payment: ${insertError.message}`);
        }

        // Fetch the latest payment
        const { data: latestPayment, error: fetchError } = await supabase
            .from('payment')
            .select('*')
            .eq('session_id', sessionId)
            .order('payment_id', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchError) {
            throw new Error(`Failed to fetch payment: ${fetchError.message}`);
        }

        if (!latestPayment) {
            throw new Error('Failed to find payment after insert');
        }

        const finalPaymentId = latestPayment.payment_id;

        // ============================================
        // APPLY STOCK REDUCTIONS
        // ============================================
        for (const reduction of stockReductions) {
            if (reduction.type === 'inventory') {
                await supabase
                    .from('inventory')
                    .update({ i_quantity: reduction.newStock })
                    .eq('i_id', reduction.id);
            } else if (reduction.type === 'bundle') {
                await supabase
                    .from('bundles')
                    .update({ bundle_stock: reduction.newStock })
                    .eq('bundle_id', reduction.id);
            }
        }

        // ============================================
        // CREATE ORDER DATA FOR RECEIPT
        // ============================================
        const orderData = {
            payment_id: finalPaymentId,
            payment_method: selectedPayment,
            payment_status: selectedPayment === 'cash' ? 'PENDING' : 'PAID',
            payment_date: new Date().toISOString(),
            total_amount: total,
            subtotal: cartTotal,
            discount_amount: voucherDiscount,
            discount_label: voucherDiscount > 0 ? 'Voucher Discount' : '',
            items: [
                ...cartItems.map(i => ({
                    name: i.name || 'Product',
                    type: i.type || 'product',
                    quantity: parseInt(i.quantity) || 1,
                    price: parseFloat(i.price) || 0,
                    total: (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1)
                })),
                ...cartServices.map(s => ({
                    name: s.name || 'Service',
                    type: 'service',
                    quantity: 1,
                    price: parseFloat(s.price || 0),
                    total: parseFloat(s.price || 0)
                }))
            ],
            shipping_name: name,
            shipping_phone: phone,
            shipping_email: email,
            shipping_address: address
        };

        // Store user data for receipt
        const receiptUserData = {
            user_id: userId,
            full_name: name,
            email: email,
            phone: phone,
            address: address
        };

        // ============================================
        // SAVE RECEIPT TO DATABASE
        // ============================================
        await saveReceiptToDatabase(finalPaymentId, orderData, receiptUserData);

        // ============================================
        // CREATE/UPDATE SERVICE ORDERS (FIXED)
        // ============================================
        if (cartServices.length > 0) {
            const userId = user ? (user.user_id || user.id) : null;

            // ✅ FIRST: Get the pending order from storage
            let pendingOrderStr = localStorage.getItem('buildbuddy_pending_service_order');
            if (!pendingOrderStr) {
                pendingOrderStr = sessionStorage.getItem('buildbuddy_pending_service_order');
            }

            console.log('🔍 Pending order from storage:', pendingOrderStr);

            let pendingOrder = null;
            if (pendingOrderStr) {
                try {
                    pendingOrder = JSON.parse(pendingOrderStr);
                    console.log('✅ Found pending order:', pendingOrder);
                } catch (e) {
                    console.warn('Error parsing pending order:', e);
                }
            }

            for (const service of cartServices) {
                if (!service.serviceId) continue;

                let serviceOrderData = null;

                // ✅ If there's a pending order, USE IT directly
                if (pendingOrder && pendingOrder.service_id === service.serviceId) {
                    console.log('✅ Using pending order:', pendingOrder);

                    // Check if the order exists
                    const { data: existingOrder, error: checkError } = await supabase
                        .from('service_orders')
                        .select('*')
                        .eq('order_id', pendingOrder.order_id)
                        .single();

                    if (checkError) {
                        console.error('❌ Pending order not found:', checkError);
                    } else if (existingOrder) {
                        console.log('✅ Found existing order:', existingOrder);

                        // ✅ UPDATE the existing order with payment details
                        const { error: updateError } = await supabase
                            .from('service_orders')
                            .update({
                                address: address,
                                contact_phone: phone,
                                order_status: 'PENDING',
                                updated_at: new Date().toISOString()
                            })
                            .eq('order_id', pendingOrder.order_id);

                        if (updateError) {
                            console.error('❌ Failed to update:', updateError);
                        } else {
                            console.log('✅ Updated order:', pendingOrder.order_id);
                            serviceOrderData = existingOrder;

                            // Clear the pending order
                            localStorage.removeItem('buildbuddy_pending_service_order');
                            sessionStorage.removeItem('buildbuddy_pending_service_order');
                            console.log('🧹 Cleared pending order');
                        }
                    }
                }

                // ✅ If no pending order found, try by session_id
                if (!serviceOrderData) {
                    console.log('🔍 Looking for order by session_id:', sessionId);

                    const { data: sessionOrders, error: findError } = await supabase
                        .from('service_orders')
                        .select('*')
                        .eq('session_id', sessionId)
                        .eq('service_id', service.serviceId)
                        .eq('order_status', 'PENDING')
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (findError) {
                        console.error('❌ Error finding session orders:', findError);
                    }

                    if (sessionOrders && sessionOrders.length > 0) {
                        const existingOrder = sessionOrders[0];
                        console.log('✅ Found order by session:', existingOrder);

                        const { error: updateError } = await supabase
                            .from('service_orders')
                            .update({
                                address: address,
                                contact_phone: phone,
                                updated_at: new Date().toISOString()
                            })
                            .eq('order_id', existingOrder.order_id);

                        if (!updateError) {
                            serviceOrderData = existingOrder;
                            console.log('✅ Updated session order:', existingOrder.order_id);
                        }
                    }
                }

                // ✅ If still no order, check if order_id 19 exists and use it
                if (!serviceOrderData) {
                    console.log('🔍 Checking if order 19 exists...');

                    const { data: order19, error: check19 } = await supabase
                        .from('service_orders')
                        .select('*')
                        .eq('order_id', 19)
                        .single();

                    if (!check19 && order19) {
                        console.log('✅ Found order 19, updating it:', order19);

                        const { error: update19 } = await supabase
                            .from('service_orders')
                            .update({
                                user_id: userId || null,
                                session_id: sessionId,
                                service_id: service.serviceId,
                                device_model: 'From Payment',
                                address: address,
                                contact_phone: phone,
                                order_status: 'PENDING',
                                updated_at: new Date().toISOString()
                            })
                            .eq('order_id', 19);

                        if (!update19) {
                            serviceOrderData = order19;
                            console.log('✅ Updated order 19');
                        }
                    }
                }

                // ✅ If still no order, create a new one
                if (!serviceOrderData) {
                    console.log('⚠️ Creating new order');

                    const newOrderData = {
                        user_id: userId || null,
                        session_id: sessionId,
                        service_id: service.serviceId,
                        device_model: 'New Order',
                        address: address,
                        contact_phone: phone,
                        order_status: 'PENDING',
                        assigned_staff_id: null
                    };

                    const { data: newOrder, error: createError } = await supabase
                        .from('service_orders')
                        .insert(newOrderData)
                        .select()
                        .single();

                    if (createError) {
                        console.error('❌ Failed to create:', createError);
                        continue;
                    }

                    serviceOrderData = newOrder;
                    console.log('✅ Created new order:', newOrder.order_id);
                }

                // Store the order reference
                if (serviceOrderData) {
                    const serviceOrderRef = {
                        order_id: serviceOrderData.order_id,
                        service_id: service.serviceId,
                        device_model: serviceOrderData.device_model || 'N/A',
                        preferred_date: serviceOrderData.preferred_date,
                        preferred_time: serviceOrderData.preferred_time
                    };
                    localStorage.setItem('buildbuddy_last_service_order', JSON.stringify(serviceOrderRef));
                    console.log('✅ Stored order reference:', serviceOrderRef);
                }
            }
        }

        showSuccess(total, finalPaymentId, receiptUserData, orderData);

    } catch (error) {
        console.error('Order failed:', error);
        alert(error.message || 'Failed to place order. Please try again.');
        btn.innerHTML = '<i class="fas fa-lock"></i> Place Order';
        btn.disabled = false;
    }
};

function showSuccess(total, paymentId, userData, orderData) {
    const overlay = document.createElement('div');
    overlay.className = 'success-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    const isCash = selectedPayment === 'cash';
    const orderRef = paymentId ? 'BB-' + String(paymentId).padStart(6, '0') : 'BB-' + Date.now().toString(36).toUpperCase();
    const phone = document.getElementById('shipPhone')?.value || '';

    overlay.innerHTML = `
        <div style="
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 90%;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        ">
            <div style="font-size:72px;margin-bottom:20px;color:${isCash ? '#4CAF50' : '#2196F3'};">
                <i class="fas fa-${isCash ? 'money-bill-wave' : 'check-circle'}"></i>
            </div>
            <h2 style="color:#1a1a2e;margin-bottom:10px;">Thank You for Your Purchase! 🎉</h2>
            <div style="font-size:28px;font-weight:700;color:#1a1a2e;margin:10px 0;">RM ${total.toFixed(2)}</div>
            ${isCash ? `
                <p style="color:#666;margin-bottom:20px;line-height:1.6;">
                    📦 Your order has been placed successfully.<br>
                    <strong>Please prepare RM ${total.toFixed(2)} upon delivery.</strong><br>
                    Our team will contact you at <strong>${phone}</strong> before delivery.<br>
                    Expected delivery: <strong>3-5 business days</strong>
                </p>
            ` : `
                <p style="color:#666;margin-bottom:20px;line-height:1.6;">
                    ✅ Your payment has been processed successfully.<br>
                    Expected delivery: <strong>3-5 business days</strong>
                </p>
            `}
            <p style="color:#888;font-size:13px;">Order reference: #${orderRef}</p>
            <div style="display:flex; gap:12px; margin-top:10px; flex-wrap:wrap;">
                <button onclick="window.location.href='index.html'" style="
                    flex:1;
                    padding:16px;
                    background:#00d4ff;
                    color:#1a1a2e;
                    border:none;
                    border-radius:8px;
                    font-size:16px;
                    font-weight:600;
                    cursor:pointer;
                    transition:all 0.3s;
                    min-width:120px;
                ">
                    <i class="fas fa-check"></i> OK
                </button>
                <button id="downloadReceiptBtn" style="
                    flex:1;
                    padding:16px;
                    background:#1a1a2e;
                    color:white;
                    border:none;
                    border-radius:8px;
                    font-size:16px;
                    font-weight:600;
                    cursor:pointer;
                    transition:all 0.3s;
                    min-width:120px;
                ">
                    <i class="fas fa-download"></i> Download PDF
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const downloadBtn = overlay.querySelector('#downloadReceiptBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            downloadReceipt(orderData, userData);
        });
    }
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
    }
}

function hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) { el.style.display = 'none'; }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/'/g, '&#39;');
}