import supabase from './supabase-client.js';

let currentUser = null;
let userOrders = [];
let userStats = {
    totalOrders: 0,
    totalSpent: 0,
    memberSince: null
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadProfile();
    updateCartCount();
});

function getUser() {
    const user = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
    return user ? JSON.parse(user) : null;
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
        const userData = await supabase
            .from('users')
            .select('*')
            .eq('user_id', currentUser.user_id || currentUser.id)
            .single();
        
        if (userData) currentUser = { ...currentUser, ...userData };
        
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
        const payments = await supabase
            .from('payment')
            .select('*')
            .eq('user_id', currentUser.user_id || currentUser.id)
            .order('payment_date', 'desc');
        
        userOrders = payments || [];
        
        // For each payment, get cart items
        for (const order of userOrders) {
            if (order.cart_id) {
                // Get cart items
                const cartItems = await supabase
                    .from('cart_items')
                    .select('*')
                    .eq('cart_id', order.cart_id);
                
                // Get services
                const cartServices = await supabase
                    .from('cart_service')
                    .select('*')
                    .eq('cart_id', order.cart_id);
                
                const items = [];
                
                // Fetch inventory names for each cart item
                if (cartItems && Array.isArray(cartItems)) {
                    for (const ci of cartItems) {
                        const inv = await supabase
                            .from('inventory')
                            .select('i_name, i_category, i_price')
                            .eq('i_id', ci.i_id)
                            .single();
                        
                        items.push({
                            name: inv?.i_name || 'Product #' + ci.i_id,
                            category: inv?.i_category || '',
                            price: inv?.i_price || ci.total_price,
                            quantity: ci.quantity || 1,
                            total: ci.total_price
                        });
                    }
                }
                
                // Fetch service names
                if (cartServices && Array.isArray(cartServices)) {
                    for (const cs of cartServices) {
                        const svc = await supabase
                            .from('service')
                            .select('service_name, service_price')
                            .eq('service_id', cs.service_id)
                            .single();
                        
                        items.push({
                            name: svc?.service_name || 'Service #' + cs.service_id,
                            price: svc?.service_price || 0,
                            quantity: 1,
                            total: svc?.service_price || 0
                        });
                    }
                }
                
                order.items = items;
            } else {
                order.items = [];
            }
        }
        
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

function renderProfile() {
    const container = document.getElementById('profileContent');
    const memberSince = userStats.memberSince;
    const fullName = currentUser.full_name || currentUser.name || 'Not set';
    const email = currentUser.email || 'Not set';
    const phone = currentUser.phone || 'Not set';
    const role = currentUser.role || 'USER';
    const roleBadge = getRoleBadge(role);
    const roleColor = getRoleColor(role);
    
    container.innerHTML = `
        <div class="profile-card">
            <div class="profile-cover" style="background: ${roleColor};"></div>
            <div class="profile-avatar">
                <div class="avatar-circle" style="background: ${getAvatarGradient(role)};">
                    <i class="fas ${getRoleIcon(role)}"></i>
                </div>
            </div>
            <div class="profile-info">
                <h2 class="profile-name">${fullName} <span style="display:inline-block;vertical-align:middle;margin-left:10px;">${roleBadge}</span></h2>
                <p class="profile-email">${email}</p>
                <div class="profile-stats">
                    <div class="stat-item"><div class="stat-value">${userStats.totalOrders}</div><div class="stat-label">Orders</div></div>
                    <div class="stat-item"><div class="stat-value">RM ${userStats.totalSpent.toFixed(0)}</div><div class="stat-label">Total Spent</div></div>
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
                <div class="info-item"><span class="info-label">Full Name</span><span class="info-value">${fullName}</span></div>
                <div class="info-item"><span class="info-label">Email Address</span><span class="info-value">${email}</span></div>
                <div class="info-item"><span class="info-label">Phone Number</span><span class="info-value">${phone}</span></div>
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

// ===== RENDER ORDERS FROM PAYMENT TABLE =====
function renderOrders() {
    if (userOrders.length === 0) {
        return `<div class="empty-state"><i class="fas fa-box-open"></i><p>No orders yet</p><button class="edit-btn" onclick="window.location.href='index.html'" style="margin-top:15px;">Start Shopping</button></div>`;
    }
    
    return userOrders.map(order => {
        const statusInfo = getPaymentStatusInfo(order.payment_status, order.payment_method);
        const date = formatDate(order.payment_date);
        
        return `
            <div class="order-item" onclick="window.showOrderDetail(${order.payment_id})" style="cursor:pointer;">
                <div class="order-info">
                    <h4>Order #${order.payment_id}</h4>
                    <p>${date} • ${order.payment_method === 'cash' ? 'COD' : 'Online'}</p>
                </div>
                <span class="order-status ${statusInfo.class}">${statusInfo.label}</span>
                <span class="order-price">RM ${parseFloat(order.total_amount).toFixed(2)}</span>
            </div>`;
    }).join('');
}

function getPaymentStatusInfo(status, method) {
    if (method === 'cash') {
        if (status === 'PENDING') return { label: '🚚 Delivering', class: 'status-processing' };
        if (status === 'PAID') return { label: '✅ Completed', class: 'status-completed' };
    }
    if (status === 'PAID') return { label: '✅ Paid', class: 'status-completed' };
    if (status === 'PENDING') return { label: '⏳ Processing', class: 'status-pending' };
    return { label: status || 'PENDING', class: 'status-pending' };
}

// ===== SHOW ORDER DETAIL POPUP =====
window.showOrderDetail = function(paymentId) {
    const order = userOrders.find(o => o.payment_id === paymentId);
    if (!order) return;
    
    const statusInfo = getPaymentStatusInfo(order.payment_status, order.payment_method);
    
    let itemsHTML = '';
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            itemsHTML += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f5;">
                <span>${item.name} ${item.quantity > 1 ? 'x' + item.quantity : ''}</span>
                <span>RM ${parseFloat(item.total || item.price * item.quantity).toFixed(2)}</span>
            </div>`;
        });
    } else {
        itemsHTML = '<p style="color:#666;">Loading items...</p>';
    }
    
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
    
    const popup = document.createElement('div');
    popup.style.cssText = 'background:white;border-radius:16px;padding:30px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
    
    popup.innerHTML = `
        <h3 style="color:#1a1a2e;margin-bottom:5px;">📦 Order #${order.payment_id}</h3>
        <span class="order-status ${statusInfo.class}" style="display:inline-block;margin-bottom:15px;">${statusInfo.label}</span>
        <hr style="border-color:#e0e0e0;margin:15px 0;">
        <div style="display:grid;gap:5px;margin-bottom:15px;">
            <p><strong>Date:</strong> ${formatDate(order.payment_date)}</p>
            <p><strong>Payment:</strong> ${order.payment_method === 'cash' ? 'Cash on Delivery' : 'Online Payment'}</p>
            <p><strong>Status:</strong> ${statusInfo.label}</p>
        </div>
        <h4 style="color:#1a1a2e;margin-bottom:10px;">Items Purchased:</h4>
        ${itemsHTML}
        <hr style="border-color:#e0e0e0;margin:15px 0;">
        <div style="text-align:right;font-size:18px;font-weight:700;color:#1a1a2e;">Total: RM ${parseFloat(order.total_amount).toFixed(2)}</div>
        ${order.payment_method === 'cash' && order.payment_status === 'PENDING' ? 
            `<div style="margin-top:10px;padding:12px;background:#fff3e0;border-radius:8px;color:#e65100;font-size:13px;">💰 Please prepare <strong>RM ${parseFloat(order.total_amount).toFixed(2)}</strong> upon delivery.</div>` : ''}
        <button onclick="this.closest('div').parentElement.remove()" style="width:100%;margin-top:15px;padding:12px;background:#00d4ff;color:#1a1a2e;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Close</button>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
};

// ===== EDIT PROFILE (unchanged) =====
window.showEditProfile = function() {
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
    ['nameError','emailError','phoneError','passwordError'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    
    const name = document.getElementById('editName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const address = document.getElementById('editAddress')?.value?.trim() || null;
    const password = document.getElementById('editPassword').value;
    let hasError = false;
    
    if (!name) { showFieldError('nameError','Name required'); hasError = true; }
    if (!email) { showFieldError('emailError','Email required'); hasError = true; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldError('emailError','Invalid email'); hasError = true; }
    if (password && password.length < 6) { showFieldError('passwordError','Min 6 characters'); hasError = true; }
    if (hasError) return;
    
    const updates = { full_name: name, phone: phone || null, address, updated_at: new Date().toISOString() };
    if (email !== currentUser.email) updates.email = email;
    if (password) updates.password_hash = await simpleHash(password);
    
    const saveBtn = document.getElementById('saveEditBtn');
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    saveBtn.disabled = true;
    
    try {
        await supabase.from('users').update(updates).eq('user_id', currentUser.user_id || currentUser.id);
        currentUser.full_name = name; currentUser.name = name; currentUser.email = email; currentUser.phone = phone; currentUser.address = address;
        if (localStorage.getItem('buildbuddy_user')) localStorage.setItem('buildbuddy_user', JSON.stringify(currentUser));
        else sessionStorage.setItem('buildbuddy_user', JSON.stringify(currentUser));
        document.getElementById('editSuccess').style.display = 'block';
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save'; saveBtn.disabled = false;
        setTimeout(() => { overlay.remove(); renderProfile(); updateLoginButton(); }, 1500);
    } catch (error) {
        if (error.message?.includes('duplicate')) showFieldError('emailError','Email already in use');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save'; saveBtn.disabled = false;
    }
}

function showFieldError(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = 'block'; } }

async function simpleHash(str) { const d = new TextEncoder().encode(str); const h = await crypto.subtle.digest('SHA-256', d); return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join(''); }

function getRoleBadge(role) {
    const b = { 'ADMIN': '<span style="background:#f44336;color:white;padding:3px 12px;border-radius:20px;font-size:12px;">🔧 ADMIN</span>', 'STAFF': '<span style="background:#ff9800;color:white;padding:3px 12px;border-radius:20px;font-size:12px;">🛠️ STAFF</span>', 'USER': '<span style="background:#00d4ff;color:#1a1a2e;padding:3px 12px;border-radius:20px;font-size:12px;">👤 Member</span>' };
    return b[role] || b['USER'];
}
function getRoleColor(role) { const c = { 'ADMIN': 'linear-gradient(135deg, #c62828, #d32f2f)', 'STAFF': 'linear-gradient(135deg, #e65100, #ff9800)', 'USER': 'linear-gradient(135deg, #667eea, #764ba2)' }; return c[role] || c['USER']; }
function getAvatarGradient(role) { const g = { 'ADMIN': 'linear-gradient(135deg, #d32f2f, #f44336)', 'STAFF': 'linear-gradient(135deg, #ff9800, #ffb74d)', 'USER': 'linear-gradient(135deg, #00d4ff, #0099cc)' }; return g[role] || g['USER']; }
function getRoleIcon(role) { const i = { 'ADMIN': 'fa-crown', 'STAFF': 'fa-shield-alt', 'USER': 'fa-user' }; return i[role] || 'fa-user'; }
function getRankIcon(role) { const i = { 'ADMIN': 'fa-crown', 'STAFF': 'fa-star', 'USER': 'fa-user' }; return i[role] || 'fa-user'; }
function getRankColor(role) { const c = { 'ADMIN': '#FFD700', 'STAFF': '#ff9800', 'USER': '#00d4ff' }; return c[role] || '#00d4ff'; }
function getRankLabel(role) { const l = { 'ADMIN': 'Administrator', 'STAFF': 'Staff', 'USER': 'Member' }; return l[role] || 'Member'; }
function getStatusClass(status) { const m = { 'COMPLETED': 'status-completed', 'PENDING': 'status-pending', 'CONFIRMED': 'status-processing', 'IN_PROGRESS': 'status-processing' }; return m[status] || 'status-pending'; }
function formatDate(d) { if (!d) return 'N/A'; return new Date(d).toLocaleDateString('en-MY', { year:'numeric', month:'short', day:'numeric' }); }
function escapeAttr(s) { if (!s) return ''; return s.replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

window.handleLogout = function() {
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
    if (user && btn) btn.textContent = (user.full_name || user.name || 'User').split(' ')[0];
}

updateLoginButton();