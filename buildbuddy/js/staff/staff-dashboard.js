import supabase from '../supabase-client.js';
import { getUser } from '../cart-utils.js';

let allOrders = [];
let currentFilter = 'ALL';

document.addEventListener('DOMContentLoaded', async () => {
    await checkStaffAccess();
    await loadOrders();
    await loadStats();
});

async function checkStaffAccess() {
    const user = getUser();
    
    if (!user) {
        window.location.href = '../auth.html';
        return;
    }
    
    try {
        const userData = await supabase
            .from('users')
            .select('role')
            .eq('user_id', user.id)
            .single();
        
        if (!userData || (userData.role !== 'STAFF' && userData.role !== 'ADMIN')) {
            window.location.href = '../index.html';
            return;
        }
        
        document.getElementById('loginBtnText').textContent = user.name.split(' ')[0];
    } catch (error) {
        console.error('Error checking access:', error);
        window.location.href = '../index.html';
    }
}

async function loadOrders() {
    try {
        const orders = await supabase
            .from('service_orders')
            .select(`
                *,
                service:service_id (service_name, service_price),
                user:user_id (full_name, email, phone)
            `)
            .order('created_at', 'desc');
        
        allOrders = orders || [];
        renderOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function renderOrders() {
    const tbody = document.getElementById('ordersTableBody');
    
    const filteredOrders = currentFilter === 'ALL' 
        ? allOrders 
        : allOrders.filter(o => o.order_status === currentFilter);
    
    if (filteredOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px;">No services scheduled</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredOrders.map(order => `
        <tr>
            <td><strong>#${order.order_id}</strong></td>
            <td>
                ${order.user?.full_name || 'Guest'}<br>
                <small style="color: #666;">${order.contact_phone}</small>
            </td>
            <td>${order.service?.service_name || 'N/A'}</td>
            <td>${order.device_model}</td>
            <td>${formatDate(order.created_at)}</td>
            <td>
                <span class="status-badge status-${order.order_status}">${order.order_status}</span>
            </td>
            <td>
                <button class="action-btn btn-update" onclick="showUpdateModal(${order.order_id})">
                    <i class="fas fa-edit"></i> Update
                </button>
                <button class="action-btn" onclick="viewOrderDetails(${order.order_id})" style="background: #f0f0f5;">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function loadStats() {
    try {
        const pending = allOrders.filter(o => o.order_status === 'PENDING').length;
        const inProgress = allOrders.filter(o => o.order_status === 'IN_PROGRESS').length;
        const completed = allOrders.filter(o => o.order_status === 'COMPLETED').length;
        const total = allOrders.length;
        
        document.getElementById('statsGrid').innerHTML = `
            <div class="stat-card">
                <i class="fas fa-clock"></i>
                <div class="stat-value">${pending}</div>
                <div class="stat-label">Pending</div>
            </div>
            <div class="stat-card">
                <i class="fas fa-spinner"></i>
                <div class="stat-value">${inProgress}</div>
                <div class="stat-label">In Progress</div>
            </div>
            <div class="stat-card">
                <i class="fas fa-check-circle"></i>
                <div class="stat-value">${completed}</div>
                <div class="stat-label">Completed</div>
            </div>
            <div class="stat-card">
                <i class="fas fa-chart-bar"></i>
                <div class="stat-value">${total}</div>
                <div class="stat-label">Total Orders</div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

window.filterOrders = function() {
    currentFilter = document.getElementById('statusFilter').value;
    renderOrders();
};

window.showUpdateModal = function(orderId) {
    const order = allOrders.find(o => o.order_id === orderId);
    if (!order) return;
    
    const modal = document.getElementById('updateModal');
    const body = document.getElementById('updateModalBody');
    
    body.innerHTML = `
        <div style="margin-bottom: 20px;">
            <p><strong>Order #${order.order_id}</strong></p>
            <p>Customer: ${order.user?.full_name || 'Guest'}</p>
            <p>Current Status: <span class="status-badge status-${order.order_status}">${order.order_status}</span></p>
        </div>
        
        <div class="form-group">
            <label>Update Status:</label>
            <select id="newStatus" class="filter-select" style="width: 100%;">
                <option value="PENDING" ${order.order_status === 'PENDING' ? 'selected' : ''}>Pending</option>
                <option value="CONFIRMED" ${order.order_status === 'CONFIRMED' ? 'selected' : ''}>Confirmed</option>
                <option value="IN_PROGRESS" ${order.order_status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
                <option value="COMPLETED" ${order.order_status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
                <option value="CANCELLED" ${order.order_status === 'CANCELLED' ? 'selected' : ''}>Cancelled</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>Notes (Optional):</label>
            <textarea id="updateNotes" rows="3" placeholder="Add notes about this update..."></textarea>
        </div>
        
        <button class="btn-primary" onclick="updateOrderStatus(${order.order_id})" style="width: 100%;">
            Update Order
        </button>
    `;
    
    modal.style.display = 'flex';
};

window.updateOrderStatus = async function(orderId) {
    const newStatus = document.getElementById('newStatus').value;
    const notes = document.getElementById('updateNotes').value;
    
    try {
        await supabase
            .from('service_orders')
            .update({ 
                order_status: newStatus,
                notes: notes || null,
                updated_at: new Date().toISOString()
            })
            .eq('order_id', orderId);
        
        document.getElementById('updateModal').style.display = 'none';
        await loadOrders();
        await loadStats();
        
        alert('Order updated successfully!');
    } catch (error) {
        console.error('Error updating order:', error);
        alert('Failed to update order');
    }
};

window.viewOrderDetails = function(orderId) {
    const order = allOrders.find(o => o.order_id === orderId);
    if (!order) return;
    
    const modal = document.getElementById('updateModal');
    const body = document.getElementById('updateModalBody');
    
    body.innerHTML = `
        <h4>Order Details #${order.order_id}</h4>
        <hr style="margin: 15px 0;">
        <p><strong>Customer:</strong> ${order.user?.full_name || 'Guest'}</p>
        <p><strong>Email:</strong> ${order.user?.email || 'N/A'}</p>
        <p><strong>Phone:</strong> ${order.contact_phone}</p>
        <p><strong>Service:</strong> ${order.service?.service_name}</p>
        <p><strong>Device:</strong> ${order.device_model}</p>
        <p><strong>Issue:</strong> ${order.device_issue}</p>
        <p><strong>Address:</strong> ${order.address}</p>
        <p><strong>Preferred Date:</strong> ${order.preferred_date || 'Not specified'}</p>
        <p><strong>Preferred Time:</strong> ${order.preferred_time || 'Not specified'}</p>
        <p><strong>Notes:</strong> ${order.notes || 'None'}</p>
        <p><strong>Status:</strong> <span class="status-badge status-${order.order_status}">${order.order_status}</span></p>
        <hr style="margin: 15px 0;">
        <button class="btn-primary" onclick="document.getElementById('updateModal').style.display='none'" style="width: 100%;">
            Close
        </button>
    `;
    
    modal.style.display = 'flex';
};

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Close modal
document.querySelector('.close-modal')?.addEventListener('click', () => {
    document.getElementById('updateModal').style.display = 'none';
});