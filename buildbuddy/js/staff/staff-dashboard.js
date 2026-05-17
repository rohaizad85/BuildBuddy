import supabase from '../supabase-client.js';

let allOrders = [];
let allStaff = [];
let currentFilter = 'ALL';
let currentSort = 'newest';
let currentUserRole = null;
let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const hasAccess = await checkStaffAccess();
    if (!hasAccess) return;
    
    showDashboard();
    await loadStaff();
    await loadOrders();
    setupEventListeners();
});

async function checkStaffAccess() {
    const user = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
    
    if (!user) {
        showAccessDenied('Please log in to access the dashboard.');
        return false;
    }
    
    try {
        const userData = JSON.parse(user);
        
        currentUserId = userData.user_id || userData.id;
        currentUserRole = userData.role;
        
        if (userData.role === 'STAFF' || userData.role === 'ADMIN') {
            return true;
        }
        
        const dbUser = await supabase
            .from('users')
            .select('role')
            .eq('user_id', userData.user_id)
            .single();
        
        if (!dbUser || (dbUser.role !== 'STAFF' && dbUser.role !== 'ADMIN')) {
            showAccessDenied('This area is restricted to staff members only.');
            return false;
        }
        
        userData.role = dbUser.role;
        currentUserRole = dbUser.role;
        if (localStorage.getItem('buildbuddy_user')) {
            localStorage.setItem('buildbuddy_user', JSON.stringify(userData));
        } else {
            sessionStorage.setItem('buildbuddy_user', JSON.stringify(userData));
        }
        
        return true;
    } catch (e) {
        console.error('Access check failed:', e);
        showAccessDenied('An error occurred. Please try again.');
        return false;
    }
}

function showAccessDenied(message) {
    document.getElementById('loadingContent').style.display = 'none';
    document.getElementById('accessDeniedContent').style.display = 'block';
    document.getElementById('accessDeniedMessage').textContent = message;
}

function showDashboard() {
    document.getElementById('loadingContent').style.display = 'none';
    document.getElementById('accessDeniedContent').style.display = 'none';
    document.getElementById('mainDashboardContent').style.display = 'block';
}

async function loadStaff() {
    try {
        const users = await supabase
            .from('users')
            .select('user_id, full_name, email, role');
        
        allStaff = Array.isArray(users) 
            ? users.filter(u => u.role === 'STAFF' || u.role === 'ADMIN')
            : [];
    } catch (error) {
        console.error('Error loading staff:', error);
        allStaff = [];
    }
}

async function loadOrders() {
    const tbody = document.getElementById('ordersTableBody');
    
    try {
        let orders;
        
        if (currentUserRole === 'ADMIN') {
            orders = await supabase
                .from('service_orders')
                .select('*')
                .order('created_at', 'desc');
        } else {
            orders = await supabase
                .from('service_orders')
                .select('*')
                .eq('assigned_staff_id', currentUserId)
                .order('created_at', 'desc');
        }
        
        allOrders = Array.isArray(orders) ? orders : [];
        
        // Get users
        const users = await supabase.from('users').select('user_id, full_name, email, phone');
        const usersMap = {};
        if (Array.isArray(users)) {
            users.forEach(u => usersMap[u.user_id] = u);
        }
        
        // Get services
        const services = await supabase.from('service').select('*');
        const servicesMap = {};
        if (Array.isArray(services)) {
            services.forEach(s => servicesMap[s.service_id] = s);
        }
        
        // Enrich orders
        allOrders = allOrders.map(order => ({
            ...order,
            users: usersMap[order.user_id] || null,
            service: servicesMap[order.service_id] || null,
            assigned_staff: usersMap[order.assigned_staff_id] || null
        }));
        
        renderOrders();
        updateStats();
        
    } catch (error) {
        console.error('Error loading orders:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
                    <p>Failed to load orders. Please refresh the page.</p>
                </td>
            </tr>
        `;
    }
}

function sortOrders(orders) {
    const sorted = [...orders];
    
    switch (currentSort) {
        case 'newest':
            return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        case 'oldest':
            return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        case 'name-az':
            return sorted.sort((a, b) => {
                const nameA = (a.users?.full_name || 'Guest').toLowerCase();
                const nameB = (b.users?.full_name || 'Guest').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        case 'name-za':
            return sorted.sort((a, b) => {
                const nameA = (a.users?.full_name || 'Guest').toLowerCase();
                const nameB = (b.users?.full_name || 'Guest').toLowerCase();
                return nameB.localeCompare(nameA);
            });
        case 'id-asc':
            return sorted.sort((a, b) => a.order_id - b.order_id);
        case 'id-desc':
            return sorted.sort((a, b) => b.order_id - a.order_id);
        case 'due-date':
            return sorted.sort((a, b) => {
                if (!a.preferred_date) return 1;
                if (!b.preferred_date) return -1;
                return new Date(a.preferred_date) - new Date(b.preferred_date);
            });
        default:
            return sorted;
    }
}

function renderOrders() {
    const tbody = document.getElementById('ordersTableBody');
    
    let filteredOrders = currentFilter === 'ALL' 
        ? allOrders 
        : allOrders.filter(o => o.order_status === currentFilter);
    
    // Apply sorting
    filteredOrders = sortOrders(filteredOrders);
    
    if (filteredOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <i class="fas fa-box-open" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
                    <p>${currentUserRole === 'STAFF' ? 'No orders assigned to you.' : 'No orders found.'}</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredOrders.map(order => {
        const customerName = order.users?.full_name || 'Guest';
        const serviceName = order.service?.service_name || 'N/A';
        const staffName = order.assigned_staff?.full_name || 'Unassigned';
        const staffClass = order.assigned_staff_id ? 'assigned' : 'unassigned';
        
        return `
            <tr class="clickable-row" onclick="window.viewOrderDetails(${order.order_id})" style="cursor:pointer;">
                <td><strong>#${order.order_id}</strong></td>
                <td>
                    ${escapeHtml(customerName)}<br>
                    <small style="color: #666;">${escapeHtml(order.contact_phone || '')}</small>
                </td>
                <td>${escapeHtml(serviceName)}</td>
                <td>${escapeHtml(order.device_model || '')}</td>
                <td>
                    <span class="staff-badge ${staffClass}">
                        ${escapeHtml(staffName)}
                    </span>
                </td>
                <td>${formatDate(order.created_at)}</td>
                <td>
                    <span class="status-badge status-${order.order_status}">${(order.order_status || '').replace(/_/g, ' ')}</span>
                </td>
                <td onclick="event.stopPropagation()">
                    ${currentUserRole === 'ADMIN' ? `
                        <button class="action-btn btn-assign" onclick="window.assignStaff(${order.order_id})">
                            <i class="fas fa-user-plus"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn btn-update" onclick="window.updateOrderStatus(${order.order_id}, '${order.order_status}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateStats() {
    document.getElementById('pendingCount').textContent = allOrders.filter(o => o.order_status === 'PENDING').length;
    document.getElementById('confirmedCount').textContent = allOrders.filter(o => o.order_status === 'CONFIRMED').length;
    document.getElementById('inProgressCount').textContent = allOrders.filter(o => o.order_status === 'IN_PROGRESS').length;
    document.getElementById('completedCount').textContent = allOrders.filter(o => o.order_status === 'COMPLETED').length;
}

window.filterOrders = function() {
    currentFilter = document.getElementById('statusFilter').value;
    renderOrders();
};

window.sortOrdersBy = function(sortType) {
    currentSort = sortType;
    // Update active button
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.sort-btn[data-sort="${sortType}"]`)?.classList.add('active');
    renderOrders();
};

window.assignStaff = function(orderId) {
    const order = allOrders.find(o => o.order_id === orderId);
    if (!order) return;
    
    const modal = document.getElementById('updateModal');
    const body = document.getElementById('updateModalBody');
    
    body.innerHTML = `
        <h4 style="color: #1a1a2e; margin-bottom: 15px;">
            <i class="fas fa-user-plus"></i> Assign Staff - Order #${order.order_id}
        </h4>
        <hr style="margin: 15px 0;">
        <p><strong>Customer:</strong> ${escapeHtml(order.users?.full_name || 'Guest')}</p>
        <p><strong>Current Staff:</strong> ${escapeHtml(order.assigned_staff?.full_name || 'Unassigned')}</p>
        
        <select id="staffSelect" style="width:100%;padding:10px;margin:15px 0;border:1px solid #e0e0e0;border-radius:8px;">
            <option value="">-- Remove Assignment --</option>
            ${allStaff.map(s => `
                <option value="${s.user_id}" ${order.assigned_staff_id === s.user_id ? 'selected' : ''}>
                    ${escapeHtml(s.full_name)} (${escapeHtml(s.email)})
                </option>
            `).join('')}
        </select>
        
        <button class="btn-primary" onclick="window.confirmStaffAssignment(${order.order_id})" style="width:100%;">
            <i class="fas fa-check"></i> Confirm Assignment
        </button>
    `;
    
    modal.style.display = 'flex';
};

window.confirmStaffAssignment = async function(orderId) {
    const staffId = document.getElementById('staffSelect').value || null;
    
    await supabase
        .from('service_orders')
        .update({ 
            assigned_staff_id: staffId ? parseInt(staffId) : null,
            updated_at: new Date().toISOString()
        })
        .eq('order_id', orderId);
    
    closeUpdateModal();
    await loadOrders();
    alert('Staff assigned successfully!');
};

window.updateOrderStatus = function(orderId, currentStatus) {
    const order = allOrders.find(o => o.order_id === orderId);
    if (!order) return;
    
    const modal = document.getElementById('updateModal');
    const body = document.getElementById('updateModalBody');
    
    const flows = {
        'PENDING': ['CONFIRMED', 'CANCELLED'],
        'CONFIRMED': ['IN_PROGRESS', 'CANCELLED'],
        'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
        'COMPLETED': [],
        'CANCELLED': []
    };
    const statusFlow = flows[currentStatus] || [];
    
    body.innerHTML = `
        <h4 style="color: #1a1a2e; margin-bottom: 15px;">
            <i class="fas fa-edit"></i> Update Status - Order #${order.order_id}
        </h4>
        <hr style="margin: 15px 0;">
        <p><strong>Current Status:</strong> 
            <span class="status-badge status-${order.order_status}">${(order.order_status || '').replace(/_/g, ' ')}</span>
        </p>
        
        ${statusFlow.length > 0 ? `
            <select id="newStatus" style="width:100%;padding:10px;margin:15px 0;border:1px solid #e0e0e0;border-radius:8px;">
                ${statusFlow.map(s => `<option value="${s}">${s.replace(/_/g, ' ')}</option>`).join('')}
            </select>
            <button class="btn-primary" onclick="window.confirmStatusUpdate(${order.order_id})" style="width:100%;">
                <i class="fas fa-check"></i> Confirm Update
            </button>
        ` : `
            <p style="color: #e65100;">No further status updates available.</p>
        `}
    `;
    
    modal.style.display = 'flex';
};

window.confirmStatusUpdate = async function(orderId) {
    const newStatus = document.getElementById('newStatus').value;
    if (!newStatus) return;
    
    await supabase
        .from('service_orders')
        .update({ 
            order_status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq('order_id', orderId);
    
    closeUpdateModal();
    await loadOrders();
    alert('Status updated successfully!');
};

window.viewOrderDetails = function(orderId) {
    const order = allOrders.find(o => o.order_id === orderId);
    if (!order) return;
    
    const modal = document.getElementById('updateModal');
    const body = document.getElementById('updateModalBody');
    
    body.innerHTML = `
        <h4 style="color: #1a1a2e; margin-bottom: 15px;">
            <i class="fas fa-clipboard"></i> Order Details #${order.order_id}
        </h4>
        <hr style="margin: 15px 0;">
        <div style="display: grid; gap: 8px;">
            <p><strong>Customer:</strong> ${escapeHtml(order.users?.full_name || 'Guest')}</p>
            <p><strong>Email:</strong> ${escapeHtml(order.users?.email || 'N/A')}</p>
            <p><strong>Phone:</strong> ${escapeHtml(order.contact_phone || 'N/A')}</p>
            <p><strong>Service:</strong> ${escapeHtml(order.service?.service_name || 'N/A')}</p>
            <p><strong>Device:</strong> ${escapeHtml(order.device_model || 'N/A')}</p>
            <p><strong>Issue:</strong> ${escapeHtml(order.device_issue || 'None')}</p>
            <p><strong>Address:</strong> ${escapeHtml(order.address || 'N/A')}</p>
            <p><strong>Date:</strong> ${order.preferred_date || 'Not specified'}</p>
            <p><strong>Time:</strong> ${order.preferred_time || 'Not specified'}</p>
            <p><strong>Assigned Staff:</strong> ${escapeHtml(order.assigned_staff?.full_name || 'Unassigned')}</p>
            <p><strong>Status:</strong> 
                <span class="status-badge status-${order.order_status}">${(order.order_status || '').replace(/_/g, ' ')}</span>
            </p>
            <p><strong>Created:</strong> ${formatDate(order.created_at)}</p>
        </div>
        <hr style="margin: 15px 0;">
        <button class="btn-primary" onclick="window.closeUpdateModal()" style="width:100%;">
            <i class="fas fa-times"></i> Close
        </button>
    `;
    
    modal.style.display = 'flex';
};

window.closeUpdateModal = function() {
    document.getElementById('updateModal').style.display = 'none';
};

function setupEventListeners() {
    document.getElementById('statusFilter').addEventListener('change', window.filterOrders);
    
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        await loadOrders();
    });
    
    document.querySelector('.close-modal').addEventListener('click', window.closeUpdateModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('updateModal')) {
            window.closeUpdateModal();
        }
    });
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-MY', { 
        year: 'numeric', month: 'short', day: 'numeric' 
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}