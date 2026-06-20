// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\staff\staff-dashboard.js

import supabase from '../supabase-client.js';

let assignedOrders = [];
let currentUserId = null;
let currentUserRole = null;
let currentSort = 'due-date';

// ============================================
// IMAGE VIEWER STATE
// ============================================

let viewerState = {
    orderId: null,
    images: [],
    index: 0,
    overlay: null,
    keyHandler: null
};

// ============================================
// HELPERS
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-MY', { 
        year: 'numeric', month: 'short', day: 'numeric' 
    });
}

function showToast(message, type = 'info') {
    const existing = document.querySelector('.staff-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `staff-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ============================================
// IMAGE VIEWER
// ============================================

window.viewImages = function(orderId, startIndex = 0) {
    const order = assignedOrders.find(o => o.order_id === orderId);
    if (!order || !order.images || order.images.length === 0) {
        showToast('No images found', 'warning');
        return;
    }

    if (viewerState.overlay) {
        viewerState.overlay.remove();
        if (viewerState.keyHandler) {
            document.removeEventListener('keydown', viewerState.keyHandler);
        }
    }

    const images = order.images;
    viewerState.orderId = orderId;
    viewerState.images = images;
    viewerState.index = startIndex || 0;

    const overlay = document.createElement('div');
    overlay.className = 'staff-image-viewer';
    overlay.dataset.orderId = orderId;
    viewerState.overlay = overlay;

    function render(idx) {
        const img = images[idx];
        const total = images.length;
        viewerState.index = idx;

        overlay.innerHTML = `
            <div style="position:relative;max-width:95vw;max-height:95vh;display:flex;flex-direction:column;align-items:center;">
                <button onclick="this.closest('.staff-image-viewer').remove()" style="position:absolute;top:-50px;right:0;background:none;border:none;color:white;font-size:30px;cursor:pointer;padding:10px;z-index:10;">
                    <i class="fas fa-times"></i>
                </button>
                <div style="color:#aaa;font-size:14px;margin-bottom:10px;background:rgba(0,0,0,0.5);padding:6px 16px;border-radius:20px;">
                    ${idx + 1} / ${total}
                </div>
                <div style="position:relative;display:flex;align-items:center;justify-content:center;max-width:90vw;max-height:75vh;width:100%;">
                    ${idx > 0 ? `
                        <button class="nav-btn" data-dir="prev" style="position:absolute;left:-60px;background:rgba(255,255,255,0.15);border:none;color:white;font-size:28px;cursor:pointer;padding:16px 20px;border-radius:50%;z-index:5;transition:all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                    ` : ''}
                    <img src="${img.image_url}" alt="Image ${idx + 1}" style="max-width:85vw;max-height:70vh;object-fit:contain;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.5);">
                    ${idx < total - 1 ? `
                        <button class="nav-btn" data-dir="next" style="position:absolute;right:-60px;background:rgba(255,255,255,0.15);border:none;color:white;font-size:28px;cursor:pointer;padding:16px 20px;border-radius:50%;z-index:5;transition:all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    ` : ''}
                </div>
                ${img.description ? `
                    <div style="color:#ccc;font-size:13px;margin-top:12px;background:rgba(0,0,0,0.5);padding:6px 18px;border-radius:8px;max-width:80vw;text-align:center;">
                        📝 ${escapeHtml(img.description)}
                    </div>
                ` : ''}
                <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;justify-content:center;max-width:90vw;">
                    ${images.map((im, i) => `
                        <div class="thumb" data-index="${i}" style="width:44px;height:44px;border-radius:6px;overflow:hidden;cursor:pointer;border:${i === idx ? '3px solid #00d4ff' : '2px solid rgba(255,255,255,0.2)'};opacity:${i === idx ? '1' : '0.5'};transition:all 0.2s;flex-shrink:0;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='${i === idx ? '1' : '0.5'}'">
                            <img src="${im.image_url}" alt="Thumb" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Navigation
        overlay.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const dir = this.dataset.dir;
                const newIdx = dir === 'prev' ? idx - 1 : idx + 1;
                if (newIdx >= 0 && newIdx < images.length) render(newIdx);
            });
        });

        // Thumbnails
        overlay.querySelectorAll('.thumb').forEach(el => {
            el.addEventListener('click', function() {
                const i = parseInt(this.dataset.index);
                if (!isNaN(i) && i >= 0 && i < images.length) render(i);
            });
        });

        // Click outside to close
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.remove();
                if (viewerState.keyHandler) {
                    document.removeEventListener('keydown', viewerState.keyHandler);
                }
            }
        });
    }

    // Keyboard
    const keyHandler = function(e) {
        if (e.key === 'ArrowLeft' && viewerState.index > 0) {
            render(viewerState.index - 1);
            e.preventDefault();
        } else if (e.key === 'ArrowRight' && viewerState.index < images.length - 1) {
            render(viewerState.index + 1);
            e.preventDefault();
        } else if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', keyHandler);
        }
    };
    viewerState.keyHandler = keyHandler;
    document.addEventListener('keydown', keyHandler);

    render(startIndex || 0);
    document.body.appendChild(overlay);
};

// ============================================
// LOAD ORDER IMAGES
// ============================================

async function loadOrderImages(orderId) {
    try {
        const { data, error } = await supabase
            .from('service_order_images')
            .select('*')
            .eq('order_id', orderId)
            .order('image_id', 'asc');
        if (error) return [];
        return data || [];
    } catch {
        return [];
    }
}

// ============================================
// CHECK ACCESS
// ============================================

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

        const { data: dbUser, error } = await supabase
            .from('users')
            .select('role')
            .eq('user_id', userData.user_id)
            .single();

        if (error || !dbUser || (dbUser.role !== 'STAFF' && dbUser.role !== 'ADMIN')) {
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
    } catch {
        showAccessDenied('An error occurred. Please try again.');
        return false;
    }
}

function showAccessDenied(message) {
    document.getElementById('staffLoadingContent').style.display = 'none';
    document.getElementById('staffAccessDeniedContent').style.display = 'block';
    document.getElementById('staffAccessDeniedMessage').textContent = message;
}

function showDashboard() {
    document.getElementById('staffLoadingContent').style.display = 'none';
    document.getElementById('staffAccessDeniedContent').style.display = 'none';
    document.getElementById('staffMainContent').style.display = 'block';
}

// ============================================
// LOAD ASSIGNED ORDERS
// ============================================

async function loadAssignedOrders() {
    try {
        const { data: orders, error } = await supabase
            .from('service_orders')
            .select(`
                *,
                service:service_id (service_name, service_price),
                users:user_id (user_id, full_name, email, phone)
            `)
            .eq('assigned_staff_id', currentUserId)
            .in('order_status', ['PENDING', 'IN_PROGRESS', 'COMPLETED'])
            .order('created_at', 'desc');

        if (error) throw error;

        const withImages = await Promise.all((orders || []).map(async (order) => ({
            ...order,
            images: await loadOrderImages(order.order_id)
        })));

        assignedOrders = withImages || [];
        renderTasks();
        updateStats();
    } catch {
        document.getElementById('staffTaskList').innerHTML = `
            <div class="staff-empty-state">
                <i class="fas fa-exclamation-circle" style="color:#f44336;"></i>
                <p>Failed to load tasks. Please refresh.</p>
            </div>
        `;
    }
}

// ============================================
// RENDER TASKS
// ============================================

function renderTasks() {
    const container = document.getElementById('staffTaskList');
    if (!container) return;

    const sorted = sortTasks(assignedOrders);

    if (sorted.length === 0) {
        container.innerHTML = `
            <div class="staff-empty-state">
                <i class="fas fa-check-circle"></i>
                <p>No tasks assigned to you</p>
                <div class="sub">All caught up! 🎉</div>
            </div>
        `;
        return;
    }

    const today = new Date();

    container.innerHTML = `
        <div>
            ${sorted.map((order, index) => {
                const isLast = index === sorted.length - 1;
                const statusClass = order.order_status === 'PENDING' ? 'pending' :
                                   order.order_status === 'IN_PROGRESS' ? 'progress' : 'completed';
                
                let dueText = 'No due date';
                let dueClass = '';
                let isOverdue = false;

                if (order.preferred_date && order.order_status !== 'COMPLETED') {
                    const dueDate = new Date(order.preferred_date);
                    const days = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                    if (days < 0) {
                        dueText = Math.abs(days) + ' days overdue';
                        dueClass = 'urgent';
                        isOverdue = true;
                    } else if (days === 0) {
                        dueText = 'Today!';
                        dueClass = 'urgent';
                    } else if (days <= 2) {
                        dueText = days + ' days left';
                        dueClass = 'warning';
                    } else {
                        dueText = days + ' days left';
                        dueClass = 'safe';
                    }
                } else if (order.order_status === 'COMPLETED') {
                    dueText = '✅ Completed';
                    dueClass = 'completed';
                }

                const overdueClass = isOverdue ? 'overdue' : '';
                const dotClass = isOverdue ? 'overdue-dot' : '';

                const customerName = order.users?.full_name || 'Guest';
                const deviceInfo = order.device_model || 'N/A';
                const issueInfo = order.device_issue || '';

                let imagesHtml = '';
                if (order.images && order.images.length > 0) {
                    const shown = order.images.slice(0, 3);
                    imagesHtml = `
                        <div class="staff-task-images">
                            ${shown.map((img, i) => `
                                <div class="staff-task-img" onclick="event.stopPropagation(); window.viewImages(${order.order_id}, ${i})" title="View image">
                                    <img src="${img.image_url}" alt="Image" onerror="this.style.display='none'">
                                </div>
                            `).join('')}
                            ${order.images.length > 3 ? `
                                <div class="staff-task-img" onclick="event.stopPropagation(); window.viewImages(${order.order_id}, 0)">
                                    <div class="more">+${order.images.length - 3}</div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }

                return `
                    <div class="staff-task-item ${overdueClass}" onclick="window.openOrderModal(${order.order_id})">
                        <div class="staff-task-dot-wrap">
                            <div class="staff-task-dot ${statusClass} ${dotClass}"></div>
                            ${!isLast ? '<div class="staff-task-line"></div>' : ''}
                        </div>
                        <div class="staff-task-body">
                            <div class="staff-task-top">
                                <div class="left">
                                    <span class="staff-task-id">#${order.order_id}</span>
                                    <span class="staff-task-badge ${statusClass}">${order.order_status.replace('_', ' ')}</span>
                                    ${isOverdue ? '<span class="staff-task-badge overdue-tag">⚠️ OVERDUE</span>' : ''}
                                    <span class="staff-task-service">${order.service?.service_name || 'Service'}</span>
                                </div>
                                <span class="staff-task-due ${dueClass}"><i class="fas fa-clock"></i> ${dueText}</span>
                            </div>
                            <div class="staff-task-info">
                                <span><i class="fas fa-user"></i> ${escapeHtml(customerName)}</span>
                                <span><i class="fas fa-phone"></i> ${escapeHtml(order.contact_phone || 'N/A')}</span>
                                <span><i class="fas fa-laptop"></i> ${escapeHtml(deviceInfo)}</span>
                            </div>
                            ${issueInfo ? `<div class="staff-task-issue"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(issueInfo.substring(0, 60))}${issueInfo.length > 60 ? '...' : ''}</div>` : ''}
                            ${imagesHtml}
                            <div class="staff-task-footer">
                                <i class="fas fa-calendar-alt"></i> ${formatDate(order.created_at)}
                                ${order.preferred_date ? `| Due: ${formatDate(order.preferred_date)}` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ============================================
// SORT TASKS
// ============================================

function sortTasks(orders) {
    const sorted = [...orders];
    switch (currentSort) {
        case 'due-date':
            return sorted.sort((a, b) => {
                if (!a.preferred_date && !b.preferred_date) return 0;
                if (!a.preferred_date) return 1;
                if (!b.preferred_date) return -1;
                return new Date(a.preferred_date) - new Date(b.preferred_date);
            });
        case 'newest':
            return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        case 'oldest':
            return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        case 'status':
            const order = { 'PENDING': 0, 'IN_PROGRESS': 1, 'COMPLETED': 2 };
            return sorted.sort((a, b) => (order[a.order_status] ?? 3) - (order[b.order_status] ?? 3));
        case 'id-asc':
            return sorted.sort((a, b) => a.order_id - b.order_id);
        case 'id-desc':
            return sorted.sort((a, b) => b.order_id - a.order_id);
        default:
            return sorted;
    }
}

// ============================================
// UPDATE STATS
// ============================================

function updateStats() {
    const today = new Date();
    const total = assignedOrders.length;
    const pending = assignedOrders.filter(o => o.order_status === 'PENDING').length;
    const progress = assignedOrders.filter(o => o.order_status === 'IN_PROGRESS').length;
    const overdue = assignedOrders.filter(o => {
        if (!o.preferred_date || o.order_status === 'COMPLETED') return false;
        return new Date(o.preferred_date) < today;
    }).length;

    document.getElementById('staffStatTotal').textContent = total;
    document.getElementById('staffStatPending').textContent = pending;
    document.getElementById('staffStatProgress').textContent = progress;
    document.getElementById('staffStatOverdue').textContent = overdue;

    const box = document.getElementById('staffOverdueBox');
    if (overdue > 0) {
        box.classList.add('overdue-pulse');
    } else {
        box.classList.remove('overdue-pulse');
    }
}

// ============================================
// ORDER MODAL
// ============================================

window.openOrderModal = function(orderId) {
    const order = assignedOrders.find(o => o.order_id === orderId);
    if (!order) return;

    const modal = document.getElementById('staffOrderModal');
    const body = document.getElementById('staffModalBody');
    document.getElementById('staffModalTitle').textContent = `Order #${order.order_id}`;

    let imagesHtml = '';
    if (order.images && order.images.length > 0) {
        imagesHtml = `
            <div class="modal-images">
                ${order.images.map((img, i) => `
                    <div class="modal-img" onclick="window.viewImages(${order.order_id}, ${i})" title="View image">
                        <img src="${img.image_url}" alt="Image" onerror="this.style.display='none'">
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        imagesHtml = `<div class="no-images"><i class="fas fa-camera"></i> No images uploaded</div>`;
    }

    const statusOpts = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s =>
        `<option value="${s}" ${s === order.order_status ? 'selected' : ''}>${s.replace('_', ' ')}</option>`
    ).join('');

    body.innerHTML = `
        <div class="detail-row"><span class="label">Customer</span><span class="value">${escapeHtml(order.users?.full_name || 'Guest')}</span></div>
        <div class="detail-row"><span class="label">Phone</span><span class="value">${escapeHtml(order.contact_phone || 'N/A')}</span></div>
        <div class="detail-row"><span class="label">Service</span><span class="value">${escapeHtml(order.service?.service_name || 'N/A')}</span></div>
        <div class="detail-row"><span class="label">Device</span><span class="value">${escapeHtml(order.device_model || 'N/A')}</span></div>
        ${order.device_issue ? `<div class="detail-row"><span class="label">Issue</span><span class="value">${escapeHtml(order.device_issue)}</span></div>` : ''}
        <div class="detail-row"><span class="label">Address</span><span class="value">${escapeHtml(order.address || 'N/A')}</span></div>
        <div class="detail-row"><span class="label">Due Date</span><span class="value">${order.preferred_date || 'Not specified'}</span></div>
        <div class="detail-row"><span class="label">Status</span><span class="value"><span class="staff-task-badge ${order.order_status === 'PENDING' ? 'pending' : order.order_status === 'IN_PROGRESS' ? 'progress' : 'completed'}">${order.order_status.replace('_', ' ')}</span></span></div>
        <hr>
        <div style="font-weight:600;font-size:14px;margin-bottom:6px;"><i class="fas fa-images"></i> Images</div>
        ${imagesHtml}
        <hr>
        <div class="status-update">
            <label>Update Status</label>
            <select id="staffStatusSelect">${statusOpts}</select>
            <button class="btn-update" onclick="window.updateOrderStatus(${order.order_id})"><i class="fas fa-save"></i> Update</button>
        </div>
        <button class="btn-close-modal" onclick="window.closeOrderModal()"><i class="fas fa-times"></i> Close</button>
    `;

    modal.style.display = 'flex';
};

window.closeOrderModal = function() {
    document.getElementById('staffOrderModal').style.display = 'none';
};

// ============================================
// UPDATE ORDER STATUS
// ============================================

window.updateOrderStatus = async function(orderId) {
    const status = document.getElementById('staffStatusSelect').value;
    if (!status) return;

    const btn = document.querySelector('#staffOrderModal .btn-update');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

    try {
        const { error } = await supabase
            .from('service_orders')
            .update({ order_status: status, updated_at: new Date().toISOString() })
            .eq('order_id', orderId);

        if (error) throw error;

        closeOrderModal();
        await loadAssignedOrders();
        showToast('✅ Status updated!', 'success');
    } catch {
        showToast('❌ Update failed', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Update';
    }
};

// ============================================
// SETUP
// ============================================

function setupEventListeners() {
    document.getElementById('staffRefreshBtn').addEventListener('click', async () => {
        await loadAssignedOrders();
        showToast('🔄 Refreshed', 'info');
    });

    document.getElementById('staffSortSelect').addEventListener('change', function() {
        currentSort = this.value;
        renderTasks();
    });

    document.getElementById('staffModalCloseBtn').addEventListener('click', closeOrderModal);
    document.getElementById('staffOrderModal').addEventListener('click', function(e) {
        if (e.target === this) closeOrderModal();
    });
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    const hasAccess = await checkStaffAccess();
    if (!hasAccess) return;

    showDashboard();
    await loadAssignedOrders();
    setupEventListeners();
});