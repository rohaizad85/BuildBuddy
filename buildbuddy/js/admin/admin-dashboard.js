import supabase from '../supabase-client.js';
import { showEditModal, showConfirmSave, showConfirmDelete, showToast, formatDate, performSave, performDelete } from './admin-utils.js';
import { downloadReceipt } from '../receipt.js';

let currentPage = 'orders';
let currentSort = { field: 'id', dir: 'desc' };
let searchQuery = '';
let allOrders = [];
let allUsers = [];
let allPayments = [];
let allServices = [];
let allInventory = [];

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    
    const hasAccess = await checkAdminAccess();
    if (!hasAccess) return;
    
    await loadDashboardData();
    renderSidebar();
    document.getElementById('adminContent').innerHTML = renderOrdersTab();
    setupNavigation();
});

async function checkAdminAccess() {
    const user = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
    if (!user) { window.location.href = '../auth.html'; return false; }
    try {
        const userData = JSON.parse(user);
        if (userData.role === 'ADMIN') return true;
        const dbUser = await supabase.from('users').select('role').eq('user_id', userData.user_id || userData.id).single();
        if (dbUser?.role === 'ADMIN') { userData.role = 'ADMIN'; localStorage.setItem('buildbuddy_user', JSON.stringify(userData)); return true; }
        window.location.href = dbUser?.role === 'STAFF' ? '../staff/staff-dashboard.html' : '../index.html';
        return false;
    } catch (e) { window.location.href = '../auth.html'; return false; }
}

async function loadDashboardData() {
    const [orders, users, payments, services, inventory] = await Promise.all([
        supabase.from('service_orders').select('*').order('created_at', 'desc'),
        supabase.from('users').select('*').order('created_at', 'desc'),
        supabase.from('payment').select('*').order('payment_date', 'desc'),
        supabase.from('service').select('*').order('service_name'),
        supabase.from('inventory').select('*').order('i_category')
    ]);
    allOrders = orders || []; 
    allUsers = users || []; 
    allPayments = payments || [];
    allServices = services || []; 
    allInventory = inventory || [];
    
    // Pre-load items for payments
    for (const payment of allPayments) {
        if (payment.cart_id) {
            try {
                const cartItems = await supabase.from('cart_items').select('*').eq('cart_id', payment.cart_id);
                const cartServices = await supabase.from('cart_service').select('*').eq('cart_id', payment.cart_id);
                
                const items = [];
                if (cartItems && Array.isArray(cartItems)) {
                    for (const ci of cartItems) {
                        const inv = allInventory.find(i => i.i_id === ci.i_id);
                        items.push({
                            name: inv?.i_name || 'Product #' + ci.i_id,
                            type: 'product',
                            quantity: ci.quantity || 1,
                            price: parseFloat(inv?.i_price || 0),
                            total: parseFloat(ci.total_price || 0)
                        });
                    }
                }
                if (cartServices && Array.isArray(cartServices)) {
                    for (const cs of cartServices) {
                        const svc = allServices.find(s => s.service_id === cs.service_id);
                        items.push({
                            name: svc?.service_name || 'Service #' + cs.service_id,
                            type: 'service',
                            quantity: 1,
                            price: parseFloat(svc?.service_price || 0),
                            total: parseFloat(svc?.service_price || 0)
                        });
                    }
                }
                payment.items = items;
            } catch (e) {
                payment.items = [];
            }
        } else {
            payment.items = [];
        }
    }
    
    console.log('Data loaded - Users:', allUsers.length, 'Inventory:', allInventory.length, 'Payments:', allPayments.length);
}

function renderSidebar() {
    document.getElementById('adminDashboard').innerHTML = `
        <div class="admin-layout">
            <nav class="admin-sidebar">
                <div class="admin-logo"><i class="fas fa-shield-alt"></i><h3>Admin Panel</h3></div>
                <ul class="admin-nav">
                    <li class="admin-nav-item active" data-page="orders"><i class="fas fa-shopping-bag"></i> Orders <span class="nav-badge">${allOrders.length + allPayments.length}</span></li>
                    <li class="admin-nav-item" data-page="users"><i class="fas fa-users"></i> Users <span class="nav-badge">${allUsers.length}</span></li>
                    <li class="admin-nav-item" data-page="inventory"><i class="fas fa-boxes"></i> Stock <span class="nav-badge">${allInventory.length}</span></li>
                    <li class="admin-nav-item" data-page="services"><i class="fas fa-tools"></i> Services <span class="nav-badge">${allServices.length}</span></li>
                    <li class="admin-nav-item" data-page="payments"><i class="fas fa-credit-card"></i> Payments <span class="nav-badge">${allPayments.length}</span></li>
                </ul>
                <div class="admin-nav-footer">
                    <a href="../index.html"><i class="fas fa-home"></i> Back to Site</a>
                    <a href="#" onclick="window.handleLogout()"><i class="fas fa-sign-out-alt"></i> Logout</a>
                </div>
            </nav>
            <main class="admin-content" id="adminContent"></main>
        </div>`;
}

function sortableHeader(label, field) {
    const icon = currentSort.field === field ? (currentSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    const active = currentSort.field === field ? ' style="color:#00d4ff;"' : '';
    return `<th${active} class="sortable-th" onclick="window.sortBy('${field}')">${label}${icon}</th>`;
}

window.sortBy = function(field) {
    if (currentSort.field === field) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.dir = 'asc';
    }
    refreshTab();
};

window.searchTable = function(query) {
    searchQuery = query.toLowerCase();
    refreshTab();
};

function renderToolbar(title, icon, showAdd, addFn, placeholder = 'Search...') {
    return `
        <div class="admin-toolbar">
            <h2><i class="fas fa-${icon}"></i> ${title}</h2>
            <div class="toolbar-actions">
                <div class="search-box">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="${placeholder}" oninput="window.searchTable(this.value)" value="${searchQuery}">
                </div>
                ${showAdd ? `<button class="btn-primary" onclick="${addFn}"><i class="fas fa-plus"></i> Add New</button>` : ''}
            </div>
        </div>`;
}

function sortAndFilter(data, fields) {
    let result = [...data];
    
    if (searchQuery) {
        result = result.filter(item => {
            return fields.some(f => {
                const val = (item[f] || '').toString().toLowerCase();
                return val.includes(searchQuery);
            });
        });
    }
    
    result.sort((a, b) => {
        let valA = a[currentSort.field] || '';
        let valB = b[currentSort.field] || '';
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });
    
    return result;
}

function renderOrdersTab() {
    const combined = [
        ...allOrders.map(o => ({ ...o, type: 'service', date: o.created_at, id: o.order_id, status: o.order_status, customer: o.contact_phone || 'N/A', amount: 0 })),
        ...allPayments.map(p => ({ ...p, type: 'payment', date: p.payment_date, id: p.payment_id, status: p.payment_status, customer: 'User #' + (p.user_id || 'Guest'), amount: parseFloat(p.total_amount || 0) }))
    ];
    
    const filtered = sortAndFilter(combined, ['id', 'customer', 'status', 'type']);
    
    return `<div class="admin-page">
        ${renderToolbar('All Orders', 'shopping-bag', false, '', 'Search orders...')}
        <div class="admin-stats-row">
            <div class="admin-stat"><span class="stat-num">${combined.length}</span><span class="stat-lbl">Total</span></div>
            <div class="admin-stat pending"><span class="stat-num">${combined.filter(o=>o.status==='PENDING').length}</span><span class="stat-lbl">Pending</span></div>
            <div class="admin-stat completed"><span class="stat-num">${combined.filter(o=>o.status==='COMPLETED'||o.status==='PAID').length}</span><span class="stat-lbl">Completed</span></div>
            <div class="admin-stat revenue"><span class="stat-num">RM ${allPayments.reduce((s,p)=>s+parseFloat(p.total_amount||0),0).toFixed(0)}</span><span class="stat-lbl">Revenue</span></div>
        </div>
        <div class="admin-table-wrapper"><table class="admin-table"><thead><tr>
            ${sortableHeader('ID', 'id')}${sortableHeader('Type', 'type')}${sortableHeader('Customer', 'customer')}<th>Amount</th>${sortableHeader('Status', 'status')}${sortableHeader('Date', 'date')}
        </tr></thead><tbody>
        ${filtered.map(o => `<tr class="clickable-row" onclick="window.editOrder('${o.type}',${o.id})">
            <td><strong>#${o.id}</strong></td>
            <td><span class="type-badge ${o.type}">${o.type==='service'?'🛠️ Service':'💳 Shop'}</span></td>
            <td>${o.customer}</td>
            <td>${o.amount ? 'RM ' + o.amount.toFixed(2) : '-'}</td>
            <td><span class="status-badge status-${o.status||'PENDING'}">${(o.status||'PENDING').replace(/_/g,' ')}</span></td>
            <td>${formatDate(o.date)}</td></tr>`).join('')}
        </tbody></table></div>
        ${filtered.length === 0 ? '<p style="text-align:center;padding:40px;color:#888;">No results found</p>' : ''}
    </div>`;
}

function renderUsersTab() {
    const filtered = sortAndFilter(allUsers, ['user_id', 'full_name', 'email', 'role']);
    
    return `<div class="admin-page">
        ${renderToolbar('Users', 'users', false, '', 'Search users...')}
        <div class="admin-stats-row">
            <div class="admin-stat"><span class="stat-num">${allUsers.length}</span><span class="stat-lbl">Total</span></div>
            <div class="admin-stat admin"><span class="stat-num">${allUsers.filter(u=>u.role==='ADMIN').length}</span><span class="stat-lbl">Admins</span></div>
            <div class="admin-stat staff"><span class="stat-num">${allUsers.filter(u=>u.role==='STAFF').length}</span><span class="stat-lbl">Staff</span></div>
            <div class="admin-stat user"><span class="stat-num">${allUsers.filter(u=>u.role==='USER').length}</span><span class="stat-lbl">Users</span></div>
        </div>
        <div class="admin-table-wrapper"><table class="admin-table"><thead><tr>
            ${sortableHeader('ID', 'user_id')}${sortableHeader('Name', 'full_name')}${sortableHeader('Email', 'email')}<th>Phone</th>${sortableHeader('Role', 'role')}${sortableHeader('Joined', 'created_at')}
        </tr></thead><tbody>
        ${filtered.map(u => `<tr class="clickable-row" onclick="window.editUser(${u.user_id})">
            <td><strong>#${u.user_id}</strong></td><td>${u.full_name||'N/A'}</td><td>${u.email||'N/A'}</td><td>${u.phone||'N/A'}</td>
            <td><span class="role-badge role-${u.role||'USER'}">${u.role||'USER'}</span></td><td>${formatDate(u.created_at)}</td></tr>`).join('')}
        </tbody></table></div>
        ${filtered.length === 0 ? '<p style="text-align:center;padding:40px;color:#888;">No results found</p>' : ''}
    </div>`;
}

function renderInventoryTab() {
    const filtered = sortAndFilter(allInventory, ['i_id', 'i_name', 'i_category', 'i_brand', 'i_quantity']);
    
    return `<div class="admin-page">
        ${renderToolbar('Stock Management', 'boxes', true, 'window.addInventoryItem()', 'Search stock...')}
        <div class="admin-table-wrapper"><table class="admin-table"><thead><tr>
            ${sortableHeader('ID', 'i_id')}${sortableHeader('Name', 'i_name')}${sortableHeader('Category', 'i_category')}<th>Brand</th>${sortableHeader('Price', 'i_price')}${sortableHeader('Stock', 'i_quantity')}
        </tr></thead><tbody>
        ${filtered.map(i => `<tr class="clickable-row" onclick="window.editInventory(${i.i_id})">
            <td><strong>#${i.i_id}</strong></td><td>${i.i_name}</td><td><span class="category-tag">${i.i_category}</span></td><td>${i.i_brand||'N/A'}</td>
            <td>RM ${parseFloat(i.i_price).toFixed(2)}</td>
            <td><span class="stock-badge ${i.i_quantity<5?'low':'high'}">${i.i_quantity} in stock</span></td></tr>`).join('')}
        </tbody></table></div>
        ${filtered.length === 0 ? '<p style="text-align:center;padding:40px;color:#888;">No results found</p>' : ''}
    </div>`;
}

function renderServicesTab() {
    const filtered = sortAndFilter(allServices, ['service_id', 'service_name', 'service_category', 'service_price']);
    
    return `<div class="admin-page">
        ${renderToolbar('Services', 'tools', true, 'window.addServiceItem()', 'Search services...')}
        <div class="admin-table-wrapper"><table class="admin-table"><thead><tr>
            ${sortableHeader('ID', 'service_id')}${sortableHeader('Name', 'service_name')}${sortableHeader('Category', 'service_category')}<th>Duration</th>${sortableHeader('Price', 'service_price')}
        </tr></thead><tbody>
        ${filtered.map(s => `<tr class="clickable-row" onclick="window.editService(${s.service_id})">
            <td><strong>#${s.service_id}</strong></td><td>${s.service_name}</td><td><span class="category-tag">${s.service_category}</span></td>
            <td>${s.service_duration||'N/A'}</td><td>RM ${parseFloat(s.service_price).toFixed(2)}</td></tr>`).join('')}
        </tbody></table></div>
        ${filtered.length === 0 ? '<p style="text-align:center;padding:40px;color:#888;">No results found</p>' : ''}
    </div>`;
}

function renderPaymentsTab() {
    const filtered = sortAndFilter(allPayments, ['payment_id', 'total_amount', 'payment_method', 'payment_status']);
    
    return `<div class="admin-page">
        ${renderToolbar('Payments', 'credit-card', false, '', 'Search payments...')}
        <div class="admin-stats-row">
            <div class="admin-stat revenue"><span class="stat-num">RM ${allPayments.reduce((s,p)=>s+parseFloat(p.total_amount||0),0).toFixed(0)}</span><span class="stat-lbl">Revenue</span></div>
            <div class="admin-stat"><span class="stat-num">${allPayments.filter(p=>p.payment_status==='PAID').length}</span><span class="stat-lbl">Paid</span></div>
            <div class="admin-stat pending"><span class="stat-num">${allPayments.filter(p=>p.payment_status==='PENDING').length}</span><span class="stat-lbl">Pending</span></div>
        </div>
        <div class="admin-table-wrapper"><table class="admin-table"><thead><tr>
            ${sortableHeader('ID', 'payment_id')}<th>User</th>${sortableHeader('Amount', 'total_amount')}${sortableHeader('Method', 'payment_method')}${sortableHeader('Status', 'payment_status')}${sortableHeader('Date', 'payment_date')}
        </tr></thead><tbody>
        ${filtered.map(p => `<tr class="clickable-row" onclick="window.editOrder('payment',${p.payment_id})">
            <td><strong>#${p.payment_id}</strong></td><td>${p.user_id?'User #'+p.user_id:'Guest'}</td>
            <td>RM ${parseFloat(p.total_amount).toFixed(2)}</td>
            <td><span class="method-badge ${p.payment_method}">${p.payment_method==='cash'?'💰 COD':'💳 Online'}</span></td>
            <td><span class="status-badge status-${p.payment_status}">${p.payment_status}</span></td>
            <td>${formatDate(p.payment_date)}</td></tr>`).join('')}
        </tbody></table></div>
        ${filtered.length === 0 ? '<p style="text-align:center;padding:40px;color:#888;">No results found</p>' : ''}
    </div>`;
}

// ===== DOWNLOAD RECEIPT =====
window.downloadPaymentReceipt = function(paymentId) {
    const payment = allPayments.find(p => p.payment_id === paymentId);
    if (!payment) {
        showToast('Payment not found', 'error');
        return;
    }
    
    let userData = {
        full_name: 'Guest',
        name: 'Guest',
        email: '',
        phone: '',
        address: ''
    };
    
    if (payment.user_id) {
        const user = allUsers.find(u => u.user_id === payment.user_id);
        if (user) {
            userData = {
                full_name: user.full_name || '',
                name: user.full_name || '',
                email: user.email || '',
                phone: user.phone || '',
                address: user.address || ''
            };
        }
    }
    
    const orderData = {
        payment_id: payment.payment_id,
        payment_method: payment.payment_method || 'card',
        payment_status: payment.payment_status || 'PAID',
        payment_date: payment.payment_date || new Date().toISOString(),
        total_amount: parseFloat(payment.total_amount || 0),
        items: payment.items || []
    };
    
    downloadReceipt(orderData, userData);
};

// ===== CRUD HANDLERS =====
window.editOrder = (type, id) => {
    const item = type === 'service' ? allOrders.find(o => o.order_id === id) : allPayments.find(p => p.payment_id === id);
    if (!item) return;
    
    if (type === 'service') {
        showEditModal('Service Order #' + id, item, 'service_order', 'edit', {
            onSave: (overlay) => showConfirmSave(async () => { 
                await performSave('service_order', 'edit', item, supabase); 
                overlay.remove(); 
                await refreshTab(); 
            }),
            onDelete: (overlay) => showConfirmDelete(async () => { 
                await performDelete('service_order', item, supabase); 
                overlay.remove(); 
                await refreshTab(); 
            })
        });
    } else {
        showEditModal('Payment #' + id, item, 'payment_order', 'edit', {
            onSave: (overlay) => showConfirmSave(async () => { 
                await performSave('payment_order', 'edit', item, supabase); 
                overlay.remove(); 
                await refreshTab(); 
            }),
            onDelete: (overlay) => showConfirmDelete(async () => { 
                await performDelete('payment_order', item, supabase); 
                overlay.remove(); 
                await refreshTab(); 
            })
        });
    }
};

window.editUser = (userId) => {
    const user = allUsers.find(u => u.user_id === userId);
    if (!user) return;
    showEditModal('Edit User #' + userId, user, 'users', 'edit', {
        onSave: (overlay) => showConfirmSave(async () => { 
            await performSave('users', 'edit', user, supabase); 
            overlay.remove(); 
            await refreshTab(); 
        }),
        onDelete: (overlay) => showConfirmDelete(async () => { 
            await performDelete('users', user, supabase); 
            overlay.remove(); 
            await refreshTab(); 
        })
    });
};

window.editInventory = (itemId) => {
    const item = allInventory.find(i => i.i_id === itemId);
    if (!item) return;
    showEditModal('Edit Stock #' + itemId, item, 'inventory', 'edit', {
        onSave: (overlay) => showConfirmSave(async () => { 
            await performSave('inventory', 'edit', item, supabase); 
            overlay.remove(); 
            await refreshTab(); 
        }),
        onDelete: (overlay) => showConfirmDelete(async () => { 
            await performDelete('inventory', item, supabase); 
            overlay.remove(); 
            await refreshTab(); 
        })
    });
};

window.addInventoryItem = () => {
    showEditModal('New Stock Item', { i_name: '', i_category: 'cpu', i_brand: '', i_price: 0, i_quantity: 0 }, 'inventory', 'new', {
        onSave: (overlay) => showConfirmSave(async () => { 
            await performSave('inventory', 'new', {}, supabase); 
            overlay.remove(); 
            await refreshTab(); 
        })
    });
};

window.editService = (serviceId) => {
    const item = allServices.find(s => s.service_id === serviceId);
    if (!item) return;
    showEditModal('Edit Service #' + serviceId, item, 'services', 'edit', {
        onSave: (overlay) => showConfirmSave(async () => { 
            await performSave('services', 'edit', item, supabase); 
            overlay.remove(); 
            await refreshTab(); 
        }),
        onDelete: (overlay) => showConfirmDelete(async () => { 
            await performDelete('services', item, supabase); 
            overlay.remove(); 
            await refreshTab(); 
        })
    });
};

window.addServiceItem = () => {
    showEditModal('New Service', { service_name: '', service_category: 'repair', service_duration: '', service_price: 0 }, 'services', 'new', {
        onSave: (overlay) => showConfirmSave(async () => { 
            await performSave('services', 'new', {}, supabase); 
            overlay.remove(); 
            await refreshTab(); 
        })
    });
};

async function refreshTab() {
    await loadDashboardData();
    document.getElementById('adminContent').innerHTML = getTabContent(currentPage);
}

function getTabContent(page) {
    switch (page) { 
        case 'orders': return renderOrdersTab(); 
        case 'users': return renderUsersTab(); 
        case 'inventory': return renderInventoryTab(); 
        case 'services': return renderServicesTab(); 
        case 'payments': return renderPaymentsTab(); 
        default: return renderOrdersTab(); 
    }
}

function setupNavigation() {
    document.querySelectorAll('.admin-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentPage = item.dataset.page;
            searchQuery = '';
            document.getElementById('adminContent').innerHTML = getTabContent(currentPage);
        });
    });
}

window.handleLogout = () => {
    localStorage.removeItem('buildbuddy_user');
    sessionStorage.removeItem('buildbuddy_user');
    window.location.href = '../index.html';
};