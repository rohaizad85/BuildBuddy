// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\profile.js

import supabase from './supabase-client.js';
import { downloadReceipt, getCurrentUser } from './receipt.js';

let currentUser = null;
let userOrders = [];
let userStats = {
    totalOrders: 0,
    totalSpent: 0,
    memberSince: null
};
let showSpent = true;

document.addEventListener('DOMContentLoaded', async () => {
    await loadProfile();
    updateCartCount();
});

function getUser() {
    return getCurrentUser();
}

async function loadProfile() {
    const container = document.getElementById('profileContent');
    currentUser = getUser();

    if (!currentUser) {
        container.innerHTML = `
            <div class="profile-card">
                <div class="profile-info">
                    <div class="empty-state">
                        <i class="fas fa-user-lock"></i>
                        <h3>Not Logged In</h3>
                        <p>Please login to view your profile</p>
                        <div class="action-buttons">
                            <button class="edit-btn" onclick="window.location.href='auth.html'"><i class="fas fa-sign-in-alt"></i> Login</button>
                            <button class="edit-btn" onclick="window.location.href='auth.html#register'"><i class="fas fa-user-plus"></i> Register</button>
                        </div>
                    </div>
                </div>
            </div>`;
        return;
    }

    try {
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('user_id, full_name, email, phone, address, role, created_at')
            .eq('user_id', currentUser.user_id || currentUser.id)
            .single();

        if (userData) {
            currentUser = { ...currentUser, ...userData };
        }

        await loadUserOrders();
        calculateStats();
        renderProfile();

    } catch (error) {
        console.error('Error loading profile:', error);
        container.innerHTML = `<div class="profile-card"><div class="profile-info"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Failed to load profile</h3><p>Please refresh the page.</p></div></div></div>`;
    }
}

async function loadUserOrders() {
    try {
        const userId = currentUser.user_id || currentUser.id;
        userOrders = [];

        // ============================================
        // FETCH RECEIPTS FROM THE RECEIPTS TABLE
        // ============================================
        console.log('🔍 Fetching receipts for user:', userId);
        
        const { data: receipts, error: receiptsError } = await supabase
            .from('receipts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (receiptsError) {
            console.error('Error loading receipts:', receiptsError);
        }

        if (receipts && receipts.length > 0) {
            console.log(`📦 Found ${receipts.length} receipts`);

            for (const receipt of receipts) {
                // Parse items from JSONB
                const items = receipt.items || [];
                
                // Determine if this is a service order
                const isServiceOrder = receipt.payment_method === 'service' || 
                                      (items.length > 0 && items[0]?.type === 'service');
                
                // Check if this receipt is for a service order (has service_order_data)
                const serviceData = items.find(i => i.type === 'service');
                
                // Create order object from receipt data
                const order = {
                    payment_id: receipt.payment_id || parseInt(receipt.receipt_id.replace('BB-', '')) || 0,
                    payment_method: receipt.payment_method,
                    payment_status: receipt.payment_status,
                    payment_date: receipt.payment_date || receipt.created_at,
                    total_amount: parseFloat(receipt.total_amount || 0),
                    subtotal: parseFloat(receipt.subtotal || receipt.total_amount || 0),
                    discount_amount: parseFloat(receipt.discount_amount || 0),
                    discount_label: receipt.discount_label || '',
                    items: items.map(item => ({
                        name: item.name || 'Item',
                        type: item.type || 'product',
                        quantity: parseInt(item.quantity) || 1,
                        price: parseFloat(item.price || 0),
                        total: parseFloat(item.total || 0),
                        // Service specific fields
                        device_model: item.device_model || null,
                        device_issue: item.device_issue || null,
                        address: item.address || null,
                        contact_phone: item.contact_phone || null,
                        preferred_date: item.preferred_date || null,
                        preferred_time: item.preferred_time || null,
                        notes: item.notes || null,
                        service_id: item.service_id || null,
                        order_id: item.order_id || null
                    })),
                    is_service_order: isServiceOrder,
                    order_type: isServiceOrder ? 'service' : 'product',
                    // Shipping info from receipt
                    shipping_name: receipt.shipping_name || '',
                    shipping_email: receipt.shipping_email || '',
                    shipping_phone: receipt.shipping_phone || '',
                    shipping_address: receipt.shipping_address || '',
                    // Store the receipt ID for reference
                    receipt_id: receipt.receipt_id,
                    created_at: receipt.created_at
                };

                userOrders.push(order);
                console.log(`📊 Added order from receipt #${receipt.receipt_id} with ${items.length} items, total: RM ${receipt.total_amount}`);
            }
        } else {
            console.log('⚠️ No receipts found for user, falling back to payment/cart method...');
            
            // ============================================
            // FALLBACK: Get from Payment + Cart Items (if receipts table is empty)
            // ============================================
            
            // 1. GET PRODUCT ORDERS (Payment + Cart Items)
            const { data: payments, error: paymentsError } = await supabase
                .from('payment')
                .select('*')
                .eq('user_id', userId)
                .order('payment_date', { ascending: false });

            if (paymentsError) {
                console.error('Error loading payments:', paymentsError);
            }

            if (payments && payments.length > 0) {
                console.log(`📦 Found ${payments.length} payment records (fallback)`);

                for (const order of payments) {
                    const items = [];
                    
                    if (order.cart_id) {
                        const { data: cartItems, error: cartError } = await supabase
                            .from('cart_items')
                            .select(`
                                ci_id,
                                quantity,
                                total_price,
                                i_id,
                                inventory:i_id (
                                    i_id,
                                    i_name,
                                    i_category,
                                    i_price,
                                    i_image_path
                                )
                            `)
                            .eq('cart_id', order.cart_id);

                        if (cartError) {
                            console.error(`Error loading cart items:`, cartError);
                        }

                        if (cartItems && cartItems.length > 0) {
                            for (const ci of cartItems) {
                                const inv = ci.inventory;
                                const price = parseFloat(inv?.i_price || 0);
                                const quantity = ci.quantity || 1;
                                const total = parseFloat(ci.total_price || price * quantity);
                                
                                items.push({
                                    name: inv?.i_name || 'Product #' + ci.i_id,
                                    category: inv?.i_category || 'product',
                                    price: price,
                                    quantity: quantity,
                                    total: total,
                                    type: 'product',
                                    image_path: inv?.i_image_path || null,
                                    i_id: ci.i_id,
                                    ci_id: ci.ci_id
                                });
                            }
                        }
                    }

                    if (items.length > 0 || parseFloat(order.total_amount || 0) > 0) {
                        userOrders.push({
                            payment_id: order.payment_id,
                            payment_method: order.payment_method,
                            payment_status: order.payment_status,
                            payment_date: order.payment_date,
                            total_amount: parseFloat(order.total_amount || 0),
                            subtotal: parseFloat(order.total_amount || 0),
                            discount_amount: 0,
                            discount_label: '',
                            items: items,
                            is_service_order: false,
                            cart_id: order.cart_id,
                            order_type: 'product',
                            receipt_id: 'BB-' + String(order.payment_id).padStart(6, '0')
                        });
                        
                        console.log(`📊 Added product order #${order.payment_id} with ${items.length} items (fallback)`);
                    }
                }
            }

            // 2. GET SERVICE ORDERS (fallback)
            const { data: serviceOrders, error: serviceOrderError } = await supabase
                .from('service_orders')
                .select(`
                    order_id,
                    service_id,
                    device_model,
                    device_issue,
                    address,
                    contact_phone,
                    preferred_date,
                    preferred_time,
                    notes,
                    created_at,
                    order_status,
                    assigned_staff_id,
                    service:service_id (
                        service_id,
                        service_name,
                        service_price,
                        service_category,
                        service_duration
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (serviceOrderError) {
                console.error('Error loading service orders:', serviceOrderError);
            }

            if (serviceOrders && serviceOrders.length > 0) {
                console.log(`📦 Found ${serviceOrders.length} service orders (fallback)`);

                for (const so of serviceOrders) {
                    const svc = so.service;
                    const servicePrice = parseFloat(svc?.service_price || 0);
                    
                    const serviceItem = {
                        name: svc?.service_name || 'Service #' + so.service_id,
                        category: svc?.service_category || 'service',
                        price: servicePrice,
                        quantity: 1,
                        total: servicePrice,
                        type: 'service',
                        duration: svc?.service_duration || null,
                        service_id: so.service_id,
                        order_id: so.order_id,
                        device_model: so.device_model,
                        device_issue: so.device_issue,
                        order_status: so.order_status,
                        created_at: so.created_at,
                        address: so.address,
                        contact_phone: so.contact_phone,
                        preferred_date: so.preferred_date,
                        preferred_time: so.preferred_time,
                        notes: so.notes
                    };

                    // Check if this service order already exists
                    const existingOrder = userOrders.find(o => o.payment_id === so.order_id);
                    
                    if (existingOrder) {
                        if (!existingOrder.items) existingOrder.items = [];
                        existingOrder.items.push(serviceItem);
                        existingOrder.total_amount = parseFloat(existingOrder.total_amount || 0) + servicePrice;
                    } else {
                        userOrders.push({
                            payment_id: so.order_id,
                            payment_method: 'service',
                            payment_status: so.order_status || 'PENDING',
                            payment_date: so.created_at,
                            total_amount: servicePrice,
                            subtotal: servicePrice,
                            discount_amount: 0,
                            discount_label: '',
                            items: [serviceItem],
                            is_service_order: true,
                            service_order_data: so,
                            order_type: 'service',
                            receipt_id: 'SRV-' + String(so.order_id).padStart(6, '0'),
                            shipping_name: currentUser?.full_name || '',
                            shipping_email: currentUser?.email || '',
                            shipping_phone: currentUser?.phone || '',
                            shipping_address: so.address || currentUser?.address || ''
                        });
                        console.log(`📊 Added service order #${so.order_id} (fallback)`);
                    }
                }
            }
        }

        // Sort orders by date (newest first)
        userOrders.sort((a, b) => {
            const dateA = new Date(a.payment_date || a.created_at || 0);
            const dateB = new Date(b.payment_date || b.created_at || 0);
            return dateB - dateA;
        });

        console.log(`✅ Total orders loaded: ${userOrders.length}`);
        console.log(`📊 Order breakdown:`, userOrders.map(o => ({
            id: o.payment_id,
            type: o.order_type || 'unknown',
            items: o.items?.length || 0,
            total: o.total_amount,
            receipt_id: o.receipt_id
        })));

    } catch (error) {
        console.error('Error loading orders:', error);
        userOrders = [];
    }
}

function calculateStats() {
    userStats.totalOrders = userOrders.length;
    userStats.totalSpent = userOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    userStats.memberSince = currentUser.created_at
        ? new Date(currentUser.created_at).toLocaleDateString('en-MY', { year: 'numeric', month: 'long' })
        : 'Recently';
}

// ===== TOGGLE SPENT PRIVACY =====
window.toggleSpentVisibility = function() {
    showSpent = !showSpent;
    updateSpentDisplay();
};

function updateSpentDisplay() {
    const spentElement = document.getElementById('spentValue');
    const toggleIcon = document.getElementById('spentToggleIcon');
    
    if (spentElement) {
        if (showSpent) {
            spentElement.textContent = `RM ${userStats.totalSpent.toFixed(0)}`;
        } else {
            const amount = userStats.totalSpent.toFixed(0);
            const asteriskCount = Math.min(amount.length, 8);
            spentElement.textContent = '*'.repeat(asteriskCount);
        }
    }
    
    if (toggleIcon) {
        toggleIcon.className = showSpent ? 'fas fa-eye' : 'fas fa-eye-slash';
        toggleIcon.title = showSpent ? 'Hide amount' : 'Show amount';
    }
}

function renderProfile() {
    const container = document.getElementById('profileContent');
    const memberSince = userStats.memberSince;
    const fullName = currentUser.full_name || currentUser.name || 'Not set';
    const email = currentUser.email || 'Not set';
    const phone = currentUser.phone || 'Not set';
    const role = currentUser.role || 'USER';
    const roleBadge = getRoleBadge(role);
    const roleColor = getRoleColor(role);
    
    const spentDisplay = showSpent ? `RM ${userStats.totalSpent.toFixed(0)}` : '*'.repeat(Math.min(userStats.totalSpent.toFixed(0).length, 8));

    container.innerHTML = `
        <div class="profile-card">
            <div class="profile-cover" style="background: ${roleColor};"></div>
            <div class="profile-avatar">
                <div class="avatar-circle" style="background: ${getAvatarGradient(role)};">
                    <i class="fas ${getRoleIcon(role)}"></i>
                </div>
            </div>
            <div class="profile-info">
                <h2 class="profile-name">${escapeHtml(fullName)} <span style="display:inline-block;vertical-align:middle;margin-left:10px;">${roleBadge}</span></h2>
                <p class="profile-email">${escapeHtml(email)}</p>
                <div class="profile-stats">
                    <div class="stat-item"><div class="stat-value">${userStats.totalOrders}</div><div class="stat-label">Orders</div></div>
                    <div class="stat-item">
                        <div class="stat-value" style="display:flex;align-items:center;gap:8px;justify-content:center;">
                            <span id="spentValue">${spentDisplay}</span>
                            <button onclick="window.toggleSpentVisibility()" 
                                    style="background:none;border:none;cursor:pointer;color:#00d4ff;font-size:16px;padding:2px 6px;border-radius:4px;transition:all 0.3s;"
                                    onmouseover="this.style.background='rgba(0,212,255,0.1)'" 
                                    onmouseout="this.style.background='transparent'"
                                    title="${showSpent ? 'Hide amount' : 'Show amount'}">
                                <i id="spentToggleIcon" class="${showSpent ? 'fas fa-eye' : 'fas fa-eye-slash'}"></i>
                            </button>
                        </div>
                        <div class="stat-label">Total Spent</div>
                    </div>
                    <div class="stat-item"><div class="stat-value"><i class="fas ${getRankIcon(role)}" style="color: ${getRankColor(role)};"></i></div><div class="stat-label">${getRankLabel(role)}</div></div>
                </div>
                <div class="action-buttons">
                    ${role === 'STAFF' || role === 'ADMIN' ? `<button class="edit-btn" onclick="window.location.href='staff/staff-dashboard.html'" style="border-color:#ff9800;color:#ff9800;"><i class="fas fa-chart-line"></i> Staff Dashboard</button>` : ''}
                    <button class="edit-btn" onclick="window.showEditProfile()"><i class="fas fa-edit"></i> Edit Profile</button>
                    <button class="logout-btn" onclick="window.handleLogout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
                </div>
            </div>
        </div>
        
        <div class="profile-section">
            <div class="section-title"><i class="fas fa-user-circle"></i> Account Information</div>
            <div class="info-grid">
                <div class="info-item"><span class="info-label">Full Name</span><span class="info-value">${escapeHtml(fullName)}</span></div>
                <div class="info-item"><span class="info-label">Email Address</span><span class="info-value">${escapeHtml(email)}</span></div>
                <div class="info-item"><span class="info-label">Phone Number</span><span class="info-value">${escapeHtml(phone)}</span></div>
                <div class="info-item"><span class="info-label">Member Since</span><span class="info-value">${memberSince}</span></div>
                <div class="info-item"><span class="info-label">Account Role</span><span class="info-value">${roleBadge}</span></div>
                <div class="info-item"><span class="info-label">Account Status</span><span class="info-value" style="color:#4CAF50;"><i class="fas fa-check-circle"></i> Active</span></div>
            </div>
        </div>
        
        ${role === 'STAFF' || role === 'ADMIN' ? `
        <div class="profile-section">
            <div class="section-title"><i class="fas fa-shield-alt"></i> Staff Privileges</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;text-align:center;">
                <div><i class="fas fa-clipboard-list" style="font-size:32px;color:#ff9800;margin-bottom:10px;"></i><h4>Order Management</h4><p style="color:#666;font-size:13px;">Manage service orders</p></div>
                <div><i class="fas fa-user-check" style="font-size:32px;color:#ff9800;margin-bottom:10px;"></i><h4>${role === 'ADMIN' ? 'Full Access' : 'Assigned Orders'}</h4><p style="color:#666;font-size:13px;">${role === 'ADMIN' ? 'View all orders' : 'View assigned orders'}</p></div>
                <div><i class="fas fa-cog" style="font-size:32px;color:#ff9800;margin-bottom:10px;"></i><h4>Staff Tools</h4><p style="color:#666;font-size:13px;">Access dashboard</p></div>
            </div>
        </div>` : ''}
        
        <div class="profile-section">
            <div class="section-title"><i class="fas fa-shopping-bag"></i> Recent Orders</div>
            ${renderOrders()}
        </div>
        
        <div class="profile-section">
            <div class="section-title"><i class="fas fa-tag"></i> Loyalty Benefits</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;text-align:center;">
                <div><i class="fas fa-percent" style="font-size:32px;color:#00d4ff;margin-bottom:10px;"></i><h4>10% Discount</h4><p style="color:#666;font-size:13px;">On all services</p></div>
                <div><i class="fas fa-truck-fast" style="font-size:32px;color:#00d4ff;margin-bottom:10px;"></i><h4>Free Shipping</h4><p style="color:#666;font-size:13px;">On orders above RM 500</p></div>
                <div><i class="fas fa-headset" style="font-size:32px;color:#00d4ff;margin-bottom:10px;"></i><h4>Priority Support</h4><p style="color:#666;font-size:13px;">24/7 dedicated support</p></div>
            </div>
        </div>
    `;
}

function renderOrders() {
    if (!userOrders || userOrders.length === 0) {
        return `<div class="empty-state"><i class="fas fa-box-open"></i><p>No orders yet</p><button class="edit-btn" onclick="window.location.href='index.html'" style="margin-top:15px;">Start Shopping</button></div>`;
    }

    return userOrders.map(order => {
        const isServiceOrder = order.is_service_order;
        const statusInfo = getPaymentStatusInfo(order.payment_status, order.payment_method, isServiceOrder);
        const date = formatDate(order.payment_date || order.created_at);

        return `
            <div class="order-item" onclick="window.showOrderDetail(${order.payment_id})" style="cursor:pointer;">
                <div class="order-info">
                    <h4>${isServiceOrder ? '🔧 Service #' : '📦 Order #'}${order.payment_id}</h4>
                    <p>${date} • ${isServiceOrder ? 'Service Booking' : (order.payment_method === 'cash' ? 'COD' : 'Online')}</p>
                    <span style="font-size:11px;color:#888;">${order.items?.length || 0} item(s)</span>
                </div>
                <span class="order-status ${statusInfo.class}">${statusInfo.label}</span>
                <span class="order-price">RM ${parseFloat(order.total_amount).toFixed(2)}</span>
            </div>`;
    }).join('');
}

function getPaymentStatusInfo(status, method, isServiceOrder) {
    if (isServiceOrder) {
        if (status === 'PENDING') return { label: '⏳ Pending', class: 'status-pending' };
        if (status === 'CONFIRMED') return { label: '✅ Confirmed', class: 'status-processing' };
        if (status === 'IN_PROGRESS') return { label: '🔧 In Progress', class: 'status-processing' };
        if (status === 'COMPLETED') return { label: '✅ Completed', class: 'status-completed' };
        if (status === 'CANCELLED') return { label: '❌ Cancelled', class: 'status-cancelled' };
        return { label: status || 'PENDING', class: 'status-pending' };
    }
    
    if (method === 'cash') {
        if (status === 'PENDING') return { label: '🚚 Delivering', class: 'status-processing' };
        if (status === 'PAID') return { label: '✅ Completed', class: 'status-completed' };
    }
    if (status === 'PAID') return { label: '✅ Paid', class: 'status-completed' };
    if (status === 'PENDING') return { label: '⏳ Processing', class: 'status-pending' };
    return { label: status || 'PENDING', class: 'status-pending' };
}

// ===== SHOW ORDER DETAIL POPUP =====
window.showOrderDetail = function (paymentId) {
    const order = userOrders.find(o => o.payment_id === paymentId);
    if (!order) return;

    const isServiceOrder = order.is_service_order;
    const statusInfo = getPaymentStatusInfo(order.payment_status, order.payment_method, isServiceOrder);
    const receiptId = order.receipt_id || (isServiceOrder ? 'SRV-' : 'BB-') + String(order.payment_id).padStart(6, '0');
    const fullDate = order.payment_date ? new Date(order.payment_date).toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const time = order.payment_date ? new Date(order.payment_date).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : '';

    let itemsHTML = '';
    let productCount = 0;
    let serviceCount = 0;
    
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const itemTotal = parseFloat(item.total || item.price * (item.quantity || 1)).toFixed(2);
            const icon = item.type === 'service' ? '🔧' : '📦';
            const extraInfo = item.device_model ? ` (${item.device_model})` : '';
            
            if (item.type === 'service') serviceCount++;
            else productCount++;
            
            itemsHTML += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f5;">
                <span>${icon} ${escapeHtml(item.name)}${extraInfo} ${item.quantity > 1 ? 'x' + item.quantity : ''}</span>
                <span>RM ${itemTotal}</span>
            </div>`;
        });
    } else {
        itemsHTML = '<p style="color:#666;">No items found.</p>';
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

    const popup = document.createElement('div');
    popup.style.cssText = 'background:white;border-radius:16px;padding:30px;max-width:550px;width:90%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    const serviceData = order.items?.find(i => i.type === 'service');

    popup.innerHTML = `
        <h3 style="color:#1a1a2e;margin-bottom:5px;">${isServiceOrder ? '🔧 Service Order' : '📦 Order'} #${order.payment_id}</h3>
        <p style="color:#888;font-size:12px;margin-bottom:5px;">${isServiceOrder ? 'Service ID' : 'Receipt ID'}: ${receiptId}</p>
        <span class="order-status ${statusInfo.class}" style="display:inline-block;margin-bottom:15px;">${statusInfo.label}</span>
        <hr style="border-color:#e0e0e0;margin:15px 0;">
        <div style="display:grid;gap:5px;margin-bottom:15px;">
            <p><strong>Date:</strong> ${fullDate} at ${time}</p>
            ${isServiceOrder ? `
                ${serviceData ? `
                    <p><strong>Service:</strong> ${escapeHtml(serviceData.name || 'N/A')}</p>
                    <p><strong>Device:</strong> ${escapeHtml(serviceData.device_model || 'N/A')}</p>
                    <p><strong>Issue:</strong> ${escapeHtml(serviceData.device_issue || 'No details')}</p>
                    <p><strong>Address:</strong> ${escapeHtml(serviceData.address || order.shipping_address || 'N/A')}</p>
                    <p><strong>Contact:</strong> ${escapeHtml(serviceData.contact_phone || order.shipping_phone || 'N/A')}</p>
                    ${serviceData.preferred_date ? `<p><strong>Preferred Date:</strong> ${formatDate(serviceData.preferred_date)}</p>` : ''}
                    ${serviceData.preferred_time ? `<p><strong>Preferred Time:</strong> ${escapeHtml(serviceData.preferred_time)}</p>` : ''}
                ` : ''}
            ` : `
                <p><strong>Payment:</strong> ${order.payment_method === 'cash' ? 'Cash on Delivery' : 'Online Payment'}</p>
                <p><strong>Payment Status:</strong> ${statusInfo.label}</p>
                ${order.shipping_address ? `<p><strong>Shipping Address:</strong> ${escapeHtml(order.shipping_address)}</p>` : ''}
                ${order.shipping_phone ? `<p><strong>Contact:</strong> ${escapeHtml(order.shipping_phone)}</p>` : ''}
            `}
            <p><strong>Items:</strong> ${productCount} product(s), ${serviceCount} service(s)</p>
        </div>
        <h4 style="color:#1a1a2e;margin-bottom:10px;">Items Purchased:</h4>
        ${itemsHTML}
        <hr style="border-color:#e0e0e0;margin:15px 0;">
        <div style="text-align:right;font-size:18px;font-weight:700;color:#1a1a2e;">Total: RM ${parseFloat(order.total_amount).toFixed(2)}</div>
        ${order.discount_amount > 0 ? `<div style="text-align:right;font-size:14px;color:#4CAF50;">${order.discount_label}: -RM ${order.discount_amount.toFixed(2)}</div>` : ''}
        ${order.payment_method === 'cash' && order.payment_status === 'PENDING' ?
            `<div style="margin-top:10px;padding:12px;background:#fff3e0;border-radius:8px;color:#e65100;font-size:13px;">💰 Please prepare <strong>RM ${parseFloat(order.total_amount).toFixed(2)}</strong> upon delivery.</div>` : ''}
        <div style="display:flex;gap:10px;margin-top:15px;">
            <button onclick="window.downloadOrderReceipt(${order.payment_id})" style="flex:1;padding:12px;background:#1a1a2e;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                <i class="fas fa-download"></i> Download PDF
            </button>
            <button onclick="this.closest('div').parentElement.remove()" style="flex:1;padding:12px;background:#00d4ff;color:#1a1a2e;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Close</button>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
};

// ===== DOWNLOAD RECEIPT =====
window.downloadOrderReceipt = function (paymentId) {
    const order = userOrders.find(o => o.payment_id === paymentId);
    if (!order) {
        alert('Order not found');
        return;
    }

    const user = getCurrentUser();
    if (!user) {
        alert('User data not found. Please log in again.');
        return;
    }

    if (!order.items || order.items.length === 0) {
        alert('No items found for this order. Please refresh and try again.');
        console.warn('⚠️ Order has no items:', order);
        return;
    }

    console.log(`📦 Downloading receipt for order #${paymentId} with ${order.items.length} items`);

    const orderData = {
        payment_id: order.payment_id,
        payment_method: order.payment_method || 'service',
        payment_status: order.payment_status,
        payment_date: order.payment_date || order.created_at,
        total_amount: parseFloat(order.total_amount || 0),
        subtotal: parseFloat(order.subtotal || order.total_amount || 0),
        discount_amount: parseFloat(order.discount_amount || 0),
        discount_label: order.discount_label || '',
        items: order.items.map(item => ({
            name: item.name || 'Item',
            type: item.type || 'product',
            quantity: parseInt(item.quantity) || 1,
            price: parseFloat(item.price) || 0,
            total: parseFloat(item.total || item.price * (item.quantity || 1)) || 0
        })),
        shipping_name: order.shipping_name || user.full_name || user.name || '',
        shipping_email: order.shipping_email || user.email || '',
        shipping_phone: order.shipping_phone || user.phone || '',
        shipping_address: order.shipping_address || user.address || ''
    };

    const userData = {
        full_name: user.full_name || user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        membership_level: user.membership_level || 'Standard',
        discount_rate: user.discount_rate || 0
    };

    console.log('📋 Order items for receipt:', orderData.items);
    downloadReceipt(orderData, userData);
};

// ===== EDIT PROFILE =====
window.showEditProfile = function () {
    const fullName = currentUser.full_name || currentUser.name || '';
    const email = currentUser.email || '';
    const phone = currentUser.phone || '';

    const overlay = document.createElement('div');
    overlay.id = 'editProfileOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:white;border-radius:16px;padding:30px;max-width:500px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

    modal.innerHTML = `
        <h3 style="margin-bottom:20px;color:#1a1a2e;"><i class="fas fa-edit" style="color:#00d4ff;"></i> Edit Profile</h3>
        <div style="margin-bottom:15px;"><label>Full Name</label><input type="text" id="editName" value="${escapeAttr(fullName)}" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;"><span id="nameError" style="color:#f44336;font-size:12px;display:none;"></span></div>
        <div style="margin-bottom:15px;"><label>Email</label><input type="email" id="editEmail" value="${escapeAttr(email)}" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;"><span id="emailError" style="color:#f44336;font-size:12px;display:none;"></span></div>
        <div style="margin-bottom:15px;"><label>Phone</label><input type="tel" id="editPhone" value="${escapeAttr(phone)}" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;"><span id="phoneError" style="color:#f44336;font-size:12px;display:none;"></span></div>
        <div style="margin-bottom:15px;"><label>Shipping Address</label><textarea id="editAddress" rows="2" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;">${escapeAttr(currentUser.address || '')}</textarea></div>
        <div style="margin-bottom:20px;"><label>New Password (leave blank)</label><input type="password" id="editPassword" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;"><span id="passwordError" style="color:#f44336;font-size:12px;display:none;"></span></div>
        <div style="display:flex;gap:12px;">
            <button id="cancelEditBtn" style="flex:1;padding:12px;border:1px solid #e0e0e0;background:white;border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
            <button id="saveEditBtn" style="flex:1;padding:12px;border:none;background:#00d4ff;color:#1a1a2e;border-radius:8px;cursor:pointer;font-weight:600;"><i class="fas fa-save"></i> Save</button>
        </div>
        <div id="editSuccess" style="margin-top:15px;padding:12px;background:#e8f5e9;color:#2e7d32;border-radius:8px;text-align:center;display:none;"><i class="fas fa-check-circle"></i> Updated!</div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.getElementById('cancelEditBtn').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.getElementById('saveEditBtn').onclick = () => saveProfile(overlay);
};

async function saveProfile(overlay) {
    ['nameError', 'emailError', 'phoneError', 'passwordError'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

    const name = document.getElementById('editName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const address = document.getElementById('editAddress')?.value?.trim() || null;
    const password = document.getElementById('editPassword').value;
    let hasError = false;

    if (!name) { showFieldError('nameError', 'Name required'); hasError = true; }
    if (!email) { showFieldError('emailError', 'Email required'); hasError = true; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldError('emailError', 'Invalid email'); hasError = true; }
    if (password && password.length < 6) { showFieldError('passwordError', 'Min 6 characters'); hasError = true; }
    if (hasError) return;

    const updates = { 
        full_name: name, 
        phone: phone || null, 
        address: address || null
    };
    
    if (email !== currentUser.email) {
        updates.email = email;
    }
    
    if (password) {
        updates.password_hash = await simpleHash(password);
    }

    console.log('📝 Updating user with:', updates);

    const saveBtn = document.getElementById('saveEditBtn');
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;

    try {
        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('user_id', currentUser.user_id || currentUser.id);

        if (error) {
            console.error('Update error:', error);
            if (error.message?.includes('duplicate')) {
                showFieldError('emailError', 'Email already in use');
            } else {
                showFieldError('nameError', 'Update failed: ' + error.message);
            }
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
            saveBtn.disabled = false;
            return;
        }

        currentUser.full_name = name;
        currentUser.name = name;
        currentUser.email = email;
        currentUser.phone = phone;
        currentUser.address = address;

        const storageKey = localStorage.getItem('buildbuddy_user') ? 'buildbuddy_user' : null;
        if (storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(currentUser));
        } else {
            sessionStorage.setItem('buildbuddy_user', JSON.stringify(currentUser));
        }

        document.getElementById('editSuccess').style.display = 'block';
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
        saveBtn.disabled = false;

        setTimeout(() => {
            overlay.remove();
            renderProfile();
            updateLoginButton();
        }, 1500);

    } catch (error) {
        console.error('Save error:', error);
        showFieldError('nameError', 'An error occurred. Please try again.');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
        saveBtn.disabled = false;
    }
}

function showFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = msg;
        el.style.display = 'block';
    }
}

async function simpleHash(str) {
    const d = new TextEncoder().encode(str);
    const h = await crypto.subtle.digest('SHA-256', d);
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getRoleBadge(role) {
    const b = {
        'ADMIN': '<span style="background:#f44336;color:white;padding:3px 12px;border-radius:20px;font-size:12px;">🔧 ADMIN</span>',
        'STAFF': '<span style="background:#ff9800;color:white;padding:3px 12px;border-radius:20px;font-size:12px;">🛠️ STAFF</span>',
        'USER': '<span style="background:#00d4ff;color:#1a1a2e;padding:3px 12px;border-radius:20px;font-size:12px;">👤 Member</span>'
    };
    return b[role] || b['USER'];
}

function getRoleColor(role) {
    const c = {
        'ADMIN': 'linear-gradient(135deg, #c62828, #d32f2f)',
        'STAFF': 'linear-gradient(135deg, #e65100, #ff9800)',
        'USER': 'linear-gradient(135deg, #667eea, #764ba2)'
    };
    return c[role] || c['USER'];
}

function getAvatarGradient(role) {
    const g = {
        'ADMIN': 'linear-gradient(135deg, #d32f2f, #f44336)',
        'STAFF': 'linear-gradient(135deg, #ff9800, #ffb74d)',
        'USER': 'linear-gradient(135deg, #00d4ff, #0099cc)'
    };
    return g[role] || g['USER'];
}

function getRoleIcon(role) {
    const i = {
        'ADMIN': 'fa-crown',
        'STAFF': 'fa-shield-alt',
        'USER': 'fa-user'
    };
    return i[role] || 'fa-user';
}

function getRankIcon(role) {
    const i = {
        'ADMIN': 'fa-crown',
        'STAFF': 'fa-star',
        'USER': 'fa-user'
    };
    return i[role] || 'fa-user';
}

function getRankColor(role) {
    const c = {
        'ADMIN': '#FFD700',
        'STAFF': '#ff9800',
        'USER': '#00d4ff'
    };
    return c[role] || '#00d4ff';
}

function getRankLabel(role) {
    const l = {
        'ADMIN': 'Administrator',
        'STAFF': 'Staff',
        'USER': 'Member'
    };
    return l[role] || 'Member';
}

function formatDate(d) {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-MY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function escapeAttr(s) {
    if (!s) return '';
    return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.handleLogout = function () {
    localStorage.removeItem('buildbuddy_user');
    sessionStorage.removeItem('buildbuddy_user');
    window.location.href = 'index.html';
};

function updateCartCount() {
    const count = JSON.parse(localStorage.getItem('buildbuddy_cart') || '[]').length;
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = count);
}

function updateLoginButton() {
    const user = getUser();
    const btn = document.getElementById('loginBtnText');
    if (user && btn) {
        btn.textContent = (user.full_name || user.name || 'User').split(' ')[0];
    }
}

window.goToStaffDashboard = function () {
    window.location.href = 'staff/staff-dashboard.html';
};

updateLoginButton();