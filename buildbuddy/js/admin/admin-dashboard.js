// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\admin\admin-dashboard.js

import supabase from '../supabase-client.js';
import SUPABASE_CONFIG from '../../config/config.js';
import { showEditModal, showConfirmSave, showConfirmDelete, showToast, formatDate, performSave, performDelete, validateInventoryForm, showValidationDialog } from './admin-utils.js';
import { downloadReceipt } from '../receipt.js';
import { detectProductInfo, getCategoryDescription } from './detectfallback.js';

// ============================================
// STATE VARIABLES
// ============================================

let currentPage = 'orders';
let currentSort = { field: 'id', dir: 'desc' };
let searchQuery = '';
let allOrders = [];
let allUsers = [];
let allPayments = [];
let allServices = [];
let allInventory = [];
let selectedImageFile = null;
let selectedImagePreview = null;

// Staff assignment variables
let allStaff = [];
let unassignedOrders = [];
let assignedOrders = [];

// ============================================
// AI PRODUCT AUTO-DETECTION
// ============================================

const API_URL = 'http://localhost:3000/api';
let detectionTimeout = null;
let lastDetectedName = '';

async function detectProductWithAI(productName) {
    if (!productName || productName.trim().length < 3) {
        return null;
    }

    try {
        const response = await fetch(`${API_URL}/detect-product`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productName: productName.trim() })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.warn('⚠️ AI API error:', errorData);
            return null;
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.warn('⚠️ AI detection failed:', error.message);
        return null;
    }
}

async function autoFillProductForm() {
    const nameInput = document.getElementById('edit_i_name');
    if (!nameInput) return;

    const name = nameInput.value.trim();
    if (!name || name.length < 3) return;

    const categorySelect = document.getElementById('edit_i_category');
    const brandInput = document.getElementById('edit_i_brand');

    if (!categorySelect || !brandInput) return;
    if (brandInput.value.trim()) return;

    const originalPlaceholder = brandInput.placeholder;
    brandInput.placeholder = '🔍 Detecting...';
    brandInput.style.opacity = '0.7';

    try {
        let result = await detectProductWithAI(name);
        let usedAI = true;

        if (!result || result.error) {
            usedAI = false;
            const fallback = detectProductInfo(name);

            result = {
                brand: fallback.brand || '',
                category: fallback.category || 'other',
                confidence: fallback.confidence || 'medium',
                suggestedName: name,
                fullName: name,
                possibleSpecs: {},
                commonAlternatives: [],
                typicalPrice: '',
                description: getCategoryDescription(fallback.category)
            };
        }

        if (result.brand && brandInput) {
            brandInput.value = result.brand;
            brandInput.style.borderColor = '#4CAF50';
            brandInput.style.background = '#f0fff4';
            brandInput.style.opacity = '1';

            const icon = usedAI ? '🤖' : '🔍';
            showToast(`${icon} Brand detected: ${result.brand}${usedAI ? '' : ' (local)'}`, 'success');
            showDetectionInfo(result, usedAI);
        }

        if (result.category && categorySelect) {
            const optionExists = Array.from(categorySelect.options)
                .some(opt => opt.value === result.category);
            if (optionExists) {
                categorySelect.value = result.category;
                categorySelect.style.borderColor = '#4CAF50';
                categorySelect.style.background = '#f0fff4';
                setTimeout(() => {
                    categorySelect.style.borderColor = '';
                    categorySelect.style.background = '';
                }, 2000);
            }
        }

        setTimeout(() => {
            brandInput.style.borderColor = '';
            brandInput.style.background = '';
        }, 3000);

    } catch (error) {
        console.error('Auto-fill error:', error);
        brandInput.placeholder = 'Enter brand name';
        brandInput.style.opacity = '1';
    } finally {
        brandInput.placeholder = originalPlaceholder || 'Enter brand name';
        brandInput.style.opacity = '1';
    }
}

function showDetectionInfo(result, usedAI = true) {
    const existing = document.querySelector('.detection-popup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'detection-popup';
    overlay.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: white;
        border-radius: 16px;
        padding: 20px 25px;
        max-width: 380px;
        box-shadow: 0 15px 50px rgba(0,0,0,0.25);
        z-index: 100000;
        animation: slideUp 0.4s ease;
        border-left: 5px solid ${usedAI ? '#00d4ff' : '#ff9800'};
        transition: all 0.3s ease;
    `;

    const specsHtml = result.possibleSpecs ? Object.entries(result.possibleSpecs)
        .filter(([key, val]) => val && val !== 'null' && val !== null)
        .map(([key, val]) => {
            const labels = {
                model: '📌 Model',
                generation: '📅 Generation',
                capacity: '💾 Capacity',
                additional: '📋 Details'
            };
            return `<div style="font-size:12px;color:#888;margin:2px 0;"><strong>${labels[key] || key}:</strong> ${val}</div>`;
        }).join('') : '';

    overlay.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <span style="font-size:24px;">${usedAI ? '🤖' : '🔍'}</span>
            <div>
                <strong style="color:#1a1a2e;font-size:16px;">${usedAI ? 'AI Detection Complete' : 'Local Detection'}</strong>
                <div style="font-size:12px;color:#888;">${usedAI ? 'Product information auto-detected' : 'Detected using local pattern matching'}</div>
            </div>
            <span onclick="this.closest('.detection-popup').remove()" style="
                margin-left:auto;
                cursor:pointer;
                color:#999;
                font-size:18px;
                padding:0 5px;
                transition:color 0.2s;
            " onmouseover="this.style.color='#f44336'" onmouseout="this.style.color='#999'">✕</span>
        </div>
        <div style="font-size:13px;color:#555;padding:5px 0;border-top:1px solid #f0f0f5;">
            <div style="display:flex;gap:15px;flex-wrap:wrap;margin:8px 0;">
                <span><strong>Brand:</strong> <span style="color:#00d4ff;">${result.brand || 'Unknown'}</span></span>
                <span><strong>Category:</strong> <span style="color:#ff9800;">${result.category || 'Unknown'}</span></span>
            </div>
            ${result.description ? `<div style="color:#666;font-size:12px;margin:5px 0;">📝 ${result.description}</div>` : ''}
            ${specsHtml}
            ${result.typicalPrice ? `<div style="color:#4CAF50;font-size:13px;margin:5px 0;font-weight:600;">💰 ${result.typicalPrice}</div>` : ''}
            <div style="margin-top:8px;font-size:10px;color:#999;text-align:right;">
                ${usedAI ? `AI Confidence: ${result.confidence || 'medium'}` : `Local detection (${result.confidence || 'medium'} confidence)`}
                ${result.confidence === 'high' ? ' ✅' : result.confidence === 'medium' ? ' ✓' : ''}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.style.opacity = '0';
            overlay.style.transform = 'translateY(20px)';
            setTimeout(() => overlay.remove(), 300);
        }
    }, 10000);
}

function setupProductAutoDetection() {
    const nameInput = document.getElementById('edit_i_name');
    if (!nameInput) {
        setTimeout(setupProductAutoDetection, 500);
        return;
    }

    const newInput = nameInput.cloneNode(true);
    nameInput.parentNode.replaceChild(newInput, nameInput);

    newInput.addEventListener('input', function () {
        const name = this.value.trim();
        if (name.length < 3 || name === lastDetectedName) return;
        if (detectionTimeout) clearTimeout(detectionTimeout);
        detectionTimeout = setTimeout(() => {
            lastDetectedName = name;
            autoFillProductForm();
        }, 800);
    });

    newInput.addEventListener('blur', function () {
        const name = this.value.trim();
        if (name.length >= 3 && name !== lastDetectedName) {
            lastDetectedName = name;
            autoFillProductForm();
        }
    });

    const label = newInput.closest('.input-group')?.querySelector('label');
    if (label) {
        label.innerHTML = 'Product Name <span style="color:#f44336;">*</span> <span style="font-size:10px;color:#888;font-weight:400;">(auto-detects brand)</span>';
    }
}

// ============================================
// STAFF ASSIGNMENT
// ============================================

async function loadStaffData() {
    try {
        const { data: staff, error } = await supabase
            .from('users')
            .select('user_id, full_name, email, role')
            .in('role', ['STAFF', 'ADMIN'])
            .order('full_name');

        if (error) {
            console.error('Error loading staff:', error);
            return [];
        }

        allStaff = staff || [];
        return allStaff;
    } catch (error) {
        console.error('Error loading staff:', error);
        return [];
    }
}

async function loadUnassignedOrders() {
    try {
        const { data: orders, error } = await supabase
            .from('service_orders')
            .select(`
                *,
                service:service_id (service_name, service_price)
            `)
            .is('assigned_staff_id', null)
            .not('order_status', 'eq', 'COMPLETED')
            .not('order_status', 'eq', 'CANCELLED')
            .order('created_at', 'asc');

        if (error) {
            console.error('Error loading unassigned orders:', error);
            return [];
        }

        unassignedOrders = orders || [];
        return unassignedOrders;
    } catch (error) {
        console.error('Error loading unassigned orders:', error);
        return [];
    }
}

async function loadAssignedOrders() {
    try {
        const { data: orders, error } = await supabase
            .from('service_orders')
            .select(`
                *,
                service:service_id (service_name, service_price)
            `)
            .not('assigned_staff_id', 'is', null)
            .in('order_status', ['PENDING', 'IN_PROGRESS'])
            .order('created_at', 'desc');

        if (error) {
            console.error('Error loading assigned orders:', error);
            return [];
        }

        if (!orders || orders.length === 0) {
            assignedOrders = [];
            return [];
        }

        const staffIds = [...new Set(orders.map(o => o.assigned_staff_id).filter(id => id !== null))];
        let staffMap = {};
        if (staffIds.length > 0) {
            const { data: staffData, error: staffError } = await supabase
                .from('users')
                .select('user_id, full_name, email, role')
                .in('user_id', staffIds);

            if (!staffError && staffData) {
                staffMap = staffData.reduce((acc, staff) => {
                    acc[staff.user_id] = staff;
                    return acc;
                }, {});
            }
        }

        assignedOrders = orders.map(order => ({
            ...order,
            staff: staffMap[order.assigned_staff_id] || null
        }));

        return assignedOrders;
    } catch (error) {
        console.error('Error loading assigned orders:', error);
        return [];
    }
}

async function assignStaffToOrder(orderId, staffId) {
    try {
        const { data, error } = await supabase
            .from('service_orders')
            .update({
                assigned_staff_id: staffId,
                updated_at: new Date().toISOString()
            })
            .eq('order_id', orderId)
            .select();

        if (error) {
            console.error('Error assigning staff:', error);
            showToast('Failed to assign staff: ' + error.message, 'error');
            return false;
        }

        showToast('✅ Staff assigned successfully!', 'success');
        return true;
    } catch (error) {
        console.error('Error assigning staff:', error);
        showToast('Failed to assign staff', 'error');
        return false;
    }
}

async function unassignStaffFromOrder(orderId) {
    try {
        const { data, error } = await supabase
            .from('service_orders')
            .update({
                assigned_staff_id: null,
                updated_at: new Date().toISOString()
            })
            .eq('order_id', orderId)
            .select();

        if (error) {
            console.error('Error unassigning staff:', error);
            showToast('Failed to unassign staff: ' + error.message, 'error');
            return false;
        }

        showToast('✅ Staff unassigned successfully!', 'success');
        return true;
    } catch (error) {
        console.error('Error unassigning staff:', error);
        showToast('Failed to unassign staff', 'error');
        return false;
    }
}

// ============================================
// AUTHENTICATION
// ============================================

async function checkAdminAccess() {
    try {
        const user = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');

        if (!user) {
            window.location.href = '../auth.html';
            return false;
        }

        let userData;
        try {
            userData = JSON.parse(user);
        } catch (e) {
            window.location.href = '../auth.html';
            return false;
        }

        if (userData.role === 'ADMIN') {
            return true;
        }

        const userId = userData.user_id || userData.id;
        if (!userId) {
            window.location.href = '../auth.html';
            return false;
        }

        const { data: dbUser, error: dbError } = await supabase
            .from('users')
            .select('role')
            .eq('user_id', userId)
            .single();

        if (dbError) {
            if (userData.role === 'ADMIN') return true;
            window.location.href = '../auth.html';
            return false;
        }

        if (dbUser?.role === 'ADMIN') {
            userData.role = 'ADMIN';
            localStorage.setItem('buildbuddy_user', JSON.stringify(userData));
            return true;
        }

        if (dbUser?.role === 'STAFF') {
            window.location.href = '../staff/staff-dashboard.html';
        } else {
            window.location.href = '../index.html';
        }
        return false;

    } catch (error) {
        console.error('Error in checkAdminAccess:', error);
        window.location.href = '../auth.html';
        return false;
    }
}

// ============================================
// DATA LOADING
// ============================================

async function loadDashboardData() {
    try {
        const [ordersResult, usersResult, paymentsResult, servicesResult, inventoryResult] = await Promise.all([
            supabase.from('service_orders').select('*').order('created_at', 'desc'),
            supabase.from('users').select('*').order('created_at', 'desc'),
            supabase.from('payment').select('*').order('payment_date', 'desc'),
            supabase.from('service').select('*').order('service_name'),
            supabase.from('inventory').select('*').order('i_category')
        ]);

        allOrders = ordersResult?.data || ordersResult || [];
        allUsers = usersResult?.data || usersResult || [];
        allPayments = paymentsResult?.data || paymentsResult || [];
        allServices = servicesResult?.data || servicesResult || [];
        allInventory = inventoryResult?.data || inventoryResult || [];

        await loadStaffData();
        await loadUnassignedOrders();
        await loadAssignedOrders();

        for (const payment of allPayments) {
            if (payment.cart_id) {
                try {
                    const cartItems = await supabase.from('cart_items').select('*').eq('cart_id', payment.cart_id);
                    const cartServices = await supabase.from('cart_service').select('*').eq('cart_id', payment.cart_id);

                    const items = [];
                    if (cartItems?.data && Array.isArray(cartItems.data)) {
                        for (const ci of cartItems.data) {
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
                    if (cartServices?.data && Array.isArray(cartServices.data)) {
                        for (const cs of cartServices.data) {
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

        return true;
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        throw error;
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderSidebar() {
    const dashboard = document.getElementById('adminDashboard');
    if (!dashboard) return;

    dashboard.innerHTML = `
        <div class="admin-layout">
            <nav class="admin-sidebar">
                <div class="admin-logo"><i class="fas fa-shield-alt"></i><h3>Admin Panel</h3></div>
                <ul class="admin-nav">
                    <li class="admin-nav-item active" data-page="orders"><i class="fas fa-shopping-bag"></i> Orders <span class="nav-badge">${(allOrders?.length || 0) + (allPayments?.length || 0)}</span></li>
                    <li class="admin-nav-item" data-page="users"><i class="fas fa-users"></i> Users <span class="nav-badge">${allUsers?.length || 0}</span></li>
                    <li class="admin-nav-item" data-page="inventory"><i class="fas fa-boxes"></i> Stock <span class="nav-badge">${allInventory?.length || 0}</span></li>
                    <li class="admin-nav-item" data-page="services"><i class="fas fa-tools"></i> Services <span class="nav-badge">${allServices?.length || 0}</span></li>
                    <li class="admin-nav-item" data-page="payments"><i class="fas fa-credit-card"></i> Payments <span class="nav-badge">${allPayments?.length || 0}</span></li>
                    <li class="admin-nav-item" data-page="staff"><i class="fas fa-user-tie"></i> Staff Assign <span class="nav-badge staff-badge" id="staffBadge">${unassignedOrders?.length || 0}</span></li>
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
    const isActive = currentSort.field === field;
    const icon = isActive ? (currentSort.dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';
    const active = isActive ? ' style="color:#00d4ff;"' : '';
    return `<th${active} class="sortable-th" onclick="window.sortBy('${field}')" data-field="${field}">${label}${icon}</th>`;
}

window.sortBy = function (field) {
    if (currentSort.field === field) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.dir = 'asc';
    }
    refreshTab();
};

window.searchTable = function (query) {
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
    let result = [...(data || [])];

    if (searchQuery) {
        result = result.filter(item => {
            return fields.some(f => {
                const val = (item[f] || '').toString().toLowerCase();
                return val.includes(searchQuery);
            });
        });
    }

    result.sort((a, b) => {
        let valA = a[currentSort.field];
        let valB = b[currentSort.field];

        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        const isNumeric = !isNaN(valA) && !isNaN(valB) && valA !== '' && valB !== '';

        if (isNumeric) {
            valA = parseFloat(valA);
            valB = parseFloat(valB);
            return currentSort.dir === 'asc' ? valA - valB : valB - valA;
        }

        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();

        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    return result;
}

function renderOrdersTab() {
    const combined = [
        ...(allOrders || []).map(o => ({ ...o, type: 'service', date: o.created_at, id: o.order_id, status: o.order_status, customer: o.contact_phone || 'N/A', amount: 0 })),
        ...(allPayments || []).map(p => ({ ...p, type: 'payment', date: p.payment_date, id: p.payment_id, status: p.payment_status, customer: 'User #' + (p.user_id || 'Guest'), amount: parseFloat(p.total_amount || 0) }))
    ];

    const filtered = sortAndFilter(combined, ['id', 'customer', 'status', 'type']);
    const totalRevenue = (allPayments || []).reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);
    const pendingCount = combined.filter(o => o.status === 'PENDING').length;
    const completedCount = combined.filter(o => o.status === 'COMPLETED' || o.status === 'PAID').length;

    return `<div class="admin-page">
        ${renderToolbar('All Orders', 'shopping-bag', false, '', 'Search orders...')}
        <div class="admin-stats-row">
            <div class="admin-stat"><span class="stat-num">${combined.length}</span><span class="stat-lbl">Total</span></div>
            <div class="admin-stat pending"><span class="stat-num">${pendingCount}</span><span class="stat-lbl">Pending</span></div>
            <div class="admin-stat completed"><span class="stat-num">${completedCount}</span><span class="stat-lbl">Completed</span></div>
            <div class="admin-stat revenue"><span class="stat-num">RM ${totalRevenue.toFixed(0)}</span><span class="stat-lbl">Revenue</span></div>
        </div>
        <div class="admin-table-wrapper"><table class="admin-table"><thead><tr>
            ${sortableHeader('ID', 'id')}${sortableHeader('Type', 'type')}${sortableHeader('Customer', 'customer')}<th>Amount</th>${sortableHeader('Status', 'status')}${sortableHeader('Date', 'date')}
        </tr></thead><tbody>
        ${filtered.map(o => `<tr class="clickable-row" onclick="window.editOrder('${o.type}',${o.id})">
            <td><strong>#${o.id}</strong></td>
            <td><span class="type-badge ${o.type}">${o.type === 'service' ? '🛠️ Service' : '💳 Shop'}</span></td>
            <td>${o.customer}</td>
            <td>${o.amount ? 'RM ' + o.amount.toFixed(2) : '-'}</td>
            <td><span class="status-badge status-${o.status || 'PENDING'}">${(o.status || 'PENDING').replace(/_/g, ' ')}</span></td>
            <td>${formatDate(o.date)}</td></tr>`).join('')}
        </tbody></table></div>
        ${filtered.length === 0 ? '<p style="text-align:center;padding:40px;color:#888;">No results found</p>' : ''}
    </div>`;
}

function renderUsersTab() {
    const filtered = sortAndFilter(allUsers, ['user_id', 'full_name', 'email', 'role']);
    const adminCount = (allUsers || []).filter(u => u.role === 'ADMIN').length;
    const staffCount = (allUsers || []).filter(u => u.role === 'STAFF').length;
    const userCount = (allUsers || []).filter(u => u.role === 'USER').length;

    return `<div class="admin-page">
        ${renderToolbar('Users', 'users', false, '', 'Search users...')}
        <div class="admin-stats-row">
            <div class="admin-stat"><span class="stat-num">${allUsers?.length || 0}</span><span class="stat-lbl">Total</span></div>
            <div class="admin-stat admin"><span class="stat-num">${adminCount}</span><span class="stat-lbl">Admins</span></div>
            <div class="admin-stat staff"><span class="stat-num">${staffCount}</span><span class="stat-lbl">Staff</span></div>
            <div class="admin-stat user"><span class="stat-num">${userCount}</span><span class="stat-lbl">Users</span></div>
        </div>
        <div class="admin-table-wrapper"><table class="admin-table"><thead><tr>
            ${sortableHeader('ID', 'user_id')}${sortableHeader('Name', 'full_name')}${sortableHeader('Email', 'email')}<th>Phone</th>${sortableHeader('Role', 'role')}${sortableHeader('Joined', 'created_at')}
        </tr></thead><tbody>
        ${filtered.map(u => `<tr class="clickable-row" onclick="window.editUser(${u.user_id})">
            <td><strong>#${u.user_id}</strong></td><td>${u.full_name || 'N/A'}</td><td>${u.email || 'N/A'}</td><td>${u.phone || 'N/A'}</td>
            <td><span class="role-badge role-${u.role || 'USER'}">${u.role || 'USER'}</span></td><td>${formatDate(u.created_at)}</td></tr>`).join('')}
        </tbody></table></div>
        ${filtered.length === 0 ? '<p style="text-align:center;padding:40px;color:#888;">No results found</p>' : ''}
    </div>`;
}

function getImageUrl(imagePath) {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
    return `${SUPABASE_URL}/storage/v1/object/public/images/${encodeURIComponent(imagePath)}`;
}

function renderInventoryTab() {
    const filtered = sortAndFilter(allInventory, ['i_id', 'i_name', 'i_category', 'i_brand', 'i_quantity']);

    return `<div class="admin-page">
        ${renderToolbar('Stock Management', 'boxes', true, 'window.addInventoryItem()', 'Search stock...')}
        <div class="admin-table-wrapper"><table class="admin-table"><thead><tr>
            ${sortableHeader('ID', 'i_id')}${sortableHeader('Image', 'i_image_path')}${sortableHeader('Name', 'i_name')}${sortableHeader('Category', 'i_category')}<th>Brand</th>${sortableHeader('Price', 'i_price')}${sortableHeader('Stock', 'i_quantity')}
        </tr></thead><tbody>
        ${filtered.map(i => {
        const imageUrl = getImageUrl(i.i_image_path);
        return `<tr class="clickable-row" onclick="window.editInventory(${i.i_id})">
                <td><strong>#${i.i_id}</strong></td>
                <td>
                    <div style="width:50px;height:50px;border-radius:8px;overflow:hidden;background:#f8f9fc;display:flex;align-items:center;justify-content:center;">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${i.i_name}" style="width:100%;height:100%;object-fit:contain;padding:4px;" onerror="this.style.display='none';">` : '<i class="fas fa-box" style="color:#ccc;font-size:20px;"></i>'}
                    </div>
                </td>
                <td>${i.i_name}</td>
                <td><span class="category-tag">${i.i_category}</span></td>
                <td>${i.i_brand || 'N/A'}</td>
                <td>RM ${parseFloat(i.i_price).toFixed(2)}</td>
                <td><span class="stock-badge ${i.i_quantity < 5 ? 'low' : 'high'}">${i.i_quantity} in stock</span></td></tr>`;
    }).join('')}
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
            <td>${s.service_duration || 'N/A'}</td><td>RM ${parseFloat(s.service_price).toFixed(2)}</td></tr>`).join('')}
        </tbody></table></div>
        ${filtered.length === 0 ? '<p style="text-align:center;padding:40px;color:#888;">No results found</p>' : ''}
    </div>`;
}

function renderPaymentsTab() {
    const filtered = sortAndFilter(allPayments, ['payment_id', 'total_amount', 'payment_method', 'payment_status']);
    const totalRevenue = (allPayments || []).reduce((s, p) => s + parseFloat(p.total_amount || 0), 0);
    const paidCount = (allPayments || []).filter(p => p.payment_status === 'PAID').length;
    const pendingCount = (allPayments || []).filter(p => p.payment_status === 'PENDING').length;

    return `<div class="admin-page">
        ${renderToolbar('Payments', 'credit-card', false, '', 'Search payments...')}
        <div class="admin-stats-row">
            <div class="admin-stat revenue"><span class="stat-num">RM ${totalRevenue.toFixed(0)}</span><span class="stat-lbl">Revenue</span></div>
            <div class="admin-stat"><span class="stat-num">${paidCount}</span><span class="stat-lbl">Paid</span></div>
            <div class="admin-stat pending"><span class="stat-num">${pendingCount}</span><span class="stat-lbl">Pending</span></div>
        </div>
        <div class="admin-table-wrapper"><table class="admin-table"><thead><tr>
            ${sortableHeader('ID', 'payment_id')}<th>User</th>${sortableHeader('Amount', 'total_amount')}${sortableHeader('Method', 'payment_method')}${sortableHeader('Status', 'payment_status')}${sortableHeader('Date', 'payment_date')}
        </tr></thead><tbody>
        ${filtered.map(p => `<tr class="clickable-row" onclick="window.editOrder('payment',${p.payment_id})">
            <td><strong>#${p.payment_id}</strong></td><td>${p.user_id ? 'User #' + p.user_id : 'Guest'}</td>
            <td>RM ${parseFloat(p.total_amount).toFixed(2)}</td>
            <td><span class="method-badge ${p.payment_method}">${p.payment_method === 'cash' ? '💰 COD' : '💳 Online'}</span></td>
            <td><span class="status-badge status-${p.payment_status}">${p.payment_status}</span></td>
            <td>${formatDate(p.payment_date)}</td></tr>`).join('')}
        </tbody></table></div>
        ${filtered.length === 0 ? '<p style="text-align:center;padding:40px;color:#888;">No results found</p>' : ''}
    </div>`;
}

// ============================================
// STAFF ASSIGNMENT TAB
// ============================================

function renderStaffTab() {
    return `
        <div class="admin-page">
            <div class="admin-toolbar">
                <h2><i class="fas fa-user-tie"></i> Staff Assignment</h2>
                <div class="toolbar-actions">
                    <button class="btn-primary" onclick="window.refreshStaffAssignments()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div class="admin-stats-row">
                <div class="admin-stat pending"><span class="stat-num" id="totalUnassigned">0</span><span class="stat-lbl">Unassigned</span></div>
                <div class="admin-stat staff"><span class="stat-num" id="totalStaff">0</span><span class="stat-lbl">Available Staff</span></div>
                <div class="admin-stat"><span class="stat-num" id="totalAssigned">0</span><span class="stat-lbl">Assigned</span></div>
            </div>
            
            <div id="unassignedSection" style="margin-bottom: 30px;">
                <h3 style="color: #1a1a2e; margin-bottom: 15px; font-size: 16px;">
                    <i class="fas fa-clock" style="color:#ff9800;"></i> Unassigned Orders
                </h3>
                <div id="staffAssignmentContent">
                    <div style="text-align:center; padding:40px; color:#888;">
                        <i class="fas fa-spinner fa-spin" style="font-size:30px;"></i>
                        <p style="margin-top:15px;">Loading assignments...</p>
                    </div>
                </div>
            </div>
            
            <div class="assigned-timeline-section">
                <div class="assigned-timeline-header">
                    <div>
                        <h3><i class="fas fa-history"></i> Assigned Orders Timeline</h3>
                        <p class="subtitle">Click on any order to view or update details</p>
                    </div>
                </div>
                <div id="assignedTimelineContent">
                    <div style="text-align:center; padding:40px; color:#888;">
                        <i class="fas fa-spinner fa-spin" style="font-size:30px;"></i>
                        <p style="margin-top:15px;">Loading timeline...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// STAFF ASSIGNMENT RENDER FUNCTIONS
// ============================================

function renderStaffAssignmentList() {
    const container = document.getElementById('staffAssignmentContent');
    if (!container) return;

    const badge = document.getElementById('staffBadge');
    if (badge) {
        badge.textContent = unassignedOrders.length;
    }

    const totalUnassigned = document.getElementById('totalUnassigned');
    const totalStaff = document.getElementById('totalStaff');
    const pendingOrders = document.getElementById('pendingOrders');

    if (totalUnassigned) totalUnassigned.textContent = unassignedOrders.length;
    if (totalStaff) totalStaff.textContent = allStaff.length;
    if (pendingOrders) pendingOrders.textContent = allOrders.filter(o => o.order_status === 'PENDING').length;

    if (unassignedOrders.length === 0) {
        container.innerHTML = `
            <div class="staff-assignment-empty">
                <i class="fas fa-check-circle"></i>
                <h4>All Orders Assigned!</h4>
                <p>There are no pending orders without assigned staff.</p>
            </div>
        `;
        return;
    }

    let tableHtml = `
        <div class="staff-table-wrapper" style="overflow:visible !important;">
            <table class="staff-table" style="overflow:visible !important;">
                <thead>
                    <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Device</th>
                        <th>Service</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th style="min-width:200px;">Assign To</th>
                        <th style="text-align:center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (const order of unassignedOrders) {
        const orderId = order.order_id;

        const staffOptionsHtml = allStaff.map(s => {
            const staffName = (s.full_name || s.email || '');
            return `
                <div class="staff-dropdown-item" 
                     data-value="${s.user_id}"
                     data-name="${staffName.toLowerCase()}"
                     onclick="window.selectStaff(${orderId}, '${s.user_id}', '${staffName.replace(/"/g, '&quot;').replace(/'/g, "\\'")}')"
                     style="padding:8px 12px; cursor:pointer; font-size:13px; color:#333; border-bottom:1px solid #f0f0f5; transition:background 0.15s; display:flex; align-items:center; gap:8px;"
                     onmouseover="this.style.background='#f0f8ff'"
                     onmouseout="this.style.background=''">
                    <span class="staff-id" style="color:#888; font-size:11px;">#${s.user_id}</span>
                    <span class="staff-name" style="font-weight:500;">${staffName}</span>
                    <span class="staff-role" style="font-size:10px; padding:1px 8px; border-radius:10px; background:#f0f0f5; color:#888; margin-left:auto;">${s.role || 'STAFF'}</span>
                </div>
            `;
        }).join('');

        tableHtml += `
            <tr>
                <td><strong>#${order.order_id}</strong></td>
                <td>
                    <div style="font-weight:500; color:#1a1a2e;">${order.contact_phone || 'N/A'}</div>
                    <div style="font-size:12px; color:#888;">${order.address ? order.address.substring(0, 30) + '...' : ''}</div>
                </td>
                <td>
                    <div style="font-weight:500;">${order.device_model || 'N/A'}</div>
                    <div style="font-size:12px; color:#888;">${order.device_issue ? order.device_issue.substring(0, 30) + '...' : ''}</div>
                </td>
                <td>
                    <span style="background:#e3f2fd; color:#1565c0; padding:4px 10px; border-radius:12px; font-size:12px; display:inline-block;">
                        ${order.service?.service_name || 'Service #' + order.service_id}
                    </span>
                </td>
                <td style="font-size:13px; color:#666;">
                    ${formatDate(order.preferred_date) || formatDate(order.created_at)}
                </td>
                <td>
                    <span class="status-badge status-${order.order_status || 'PENDING'}">
                        ${(order.order_status || 'PENDING').replace(/_/g, ' ')}
                    </span>
                </td>
                <td>
                    <div class="staff-dropdown" style="position:relative; min-width:180px; z-index:1000;">
                        <input type="text" 
                               class="staff-search-input" 
                               id="staffSearch_${order.order_id}"
                               placeholder="Type to search staff..."
                               autocomplete="off"
                               style="
                                   width:100%;
                                   padding:8px 10px;
                                   border:1.5px solid #e0e0e0;
                                   border-radius:8px;
                                   font-size:13px;
                                   background:white;
                                   transition:border-color 0.2s;
                                   box-sizing:border-box;
                               "
                               onfocus="this.style.borderColor='#00d4ff'; document.getElementById('staffDropdownList_${order.order_id}').style.display='block';"
                               oninput="window.filterStaffDropdown(${order.order_id}, this.value)"
                               onkeydown="if(event.key === 'Escape'){ document.getElementById('staffDropdownList_${order.order_id}').style.display='none'; this.blur(); }"
                               data-orderid="${order.order_id}"
                        >
                        <div class="staff-dropdown-list" 
                             id="staffDropdownList_${order.order_id}"
                             style="
                                 display:none;
                                 position:absolute;
                                 top:calc(100% + 2px);
                                 left:0;
                                 right:0;
                                 background:white;
                                 border:1.5px solid #e0e0e0;
                                 border-radius:8px;
                                 max-height:220px;
                                 overflow-y:auto;
                                 z-index:9999;
                                 box-shadow:0 4px 16px rgba(0,0,0,0.15);
                                 min-width:200px;
                             "
                        >
                            <div class="staff-dropdown-item" 
                                 data-value="" 
                                 data-name=""
                                 onclick="window.selectStaff(${order.order_id}, '', '-- Select Staff --')"
                                 style="padding:8px 12px; cursor:pointer; font-size:13px; color:#888; border-bottom:1px solid #f0f0f5; transition:background 0.15s;"
                                 onmouseover="this.style.background='#f0f0f5'"
                                 onmouseout="this.style.background=''"
                            >
                                -- Select Staff --
                            </div>
                            ${staffOptionsHtml}
                        </div>
                        <input type="hidden" id="staffSelect_${order.order_id}" value="">
                    </div>
                </td>
                <td style="text-align:center;">
                    <button class="btn-assign" onclick="window.assignStaff(${order.order_id})">
                        <i class="fas fa-check"></i> Assign
                    </button>
                </td>
            </tr>
        `;
    }

    tableHtml += `
                </tbody>
            </table>
        </div>
        <div class="staff-footer">
            <span>${unassignedOrders.length} order(s) waiting for assignment</span>
            <span><i class="fas fa-info-circle"></i> Type to search staff by name</span>
        </div>
    `;

    container.innerHTML = tableHtml;
}

function renderAssignedTimeline() {
    const container = document.getElementById('assignedTimelineContent');
    if (!container) return;

    const totalAssigned = document.getElementById('totalAssigned');
    if (totalAssigned) totalAssigned.textContent = assignedOrders.length;

    if (assignedOrders.length === 0) {
        container.innerHTML = `
            <div class="timeline-empty">
                <i class="fas fa-check-circle" style="color:#4CAF50;"></i>
                <p>No assigned orders in PENDING or IN_PROGRESS status.</p>
            </div>
        `;
        return;
    }

    const today = new Date();

    container.innerHTML = `
        <div class="timeline-container">
            ${assignedOrders.map(order => {
        const statusClass = order.order_status === 'PENDING' ? 'pending' : 'in-progress';
        const statusIcon = order.order_status === 'PENDING' ? 'fa-clock' : 'fa-spinner';

        let staffName = 'Unknown Staff';
        if (order.staff) {
            staffName = order.staff.full_name || order.staff.email || 'Staff #' + order.staff.user_id;
        } else if (order.assigned_staff_id) {
            staffName = 'Staff #' + order.assigned_staff_id;
        }

        const assignedDate = new Date(order.created_at);
        const daysDiff = Math.ceil((today - assignedDate) / (1000 * 60 * 60 * 24));

        let daysUntilDue = 'No due date';
        let dueClass = '';
        let dueIcon = 'fa-hourglass-half';
        if (order.preferred_date) {
            const dueDate = new Date(order.preferred_date);
            const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            if (daysUntil < 0) {
                daysUntilDue = Math.abs(daysUntil) + ' days overdue';
                dueClass = 'urgent';
                dueIcon = 'fa-exclamation-triangle';
            } else if (daysUntil === 0) {
                daysUntilDue = 'Today!';
                dueClass = 'urgent';
                dueIcon = 'fa-bell';
            } else if (daysUntil <= 2) {
                daysUntilDue = daysUntil + ' day' + (daysUntil > 1 ? 's' : '') + ' left';
                dueClass = 'warning';
                dueIcon = 'fa-hourglass-end';
            } else {
                daysUntilDue = daysUntil + ' days left';
                dueClass = 'safe';
                dueIcon = 'fa-hourglass-start';
            }
        }

        const deviceInfo = order.device_model || 'N/A';
        const issueInfo = order.device_issue ? order.device_issue.substring(0, 40) + (order.device_issue.length > 40 ? '...' : '') : '';

        return `
                    <div class="timeline-item clickable" onclick="window.editServiceOrder(${order.order_id})" style="cursor:pointer;">
                        <div class="timeline-line">
                            <div class="timeline-dot ${statusClass}"></div>
                            <div class="timeline-connector"></div>
                        </div>
                        <div class="timeline-content">
                            <div class="timeline-header">
                                <span class="order-id">#${order.order_id}</span>
                                <span class="status-badge status-${order.order_status}">${order.order_status.replace('_', ' ')}</span>
                                <span class="service-name">${order.service?.service_name || 'Service'}</span>
                            </div>
                            <div class="timeline-details">
                                <div class="customer-info">
                                    <i class="fas fa-phone"></i> ${order.contact_phone || 'N/A'}
                                    ${deviceInfo ? ' | <i class="fas fa-laptop"></i> ' + deviceInfo : ''}
                                </div>
                                ${issueInfo ? `<div class="issue-info"><i class="fas fa-exclamation-circle"></i> ${issueInfo}</div>` : ''}
                                <div class="staff-info">
                                    <i class="fas fa-user-tie"></i> Assigned to: <strong>${staffName}</strong>
                                </div>
                            </div>
                        </div>
                        <div class="timeline-meta">
                            <div class="assigned-date">
                                <i class="fas fa-calendar-alt"></i> ${formatDate(order.created_at)}
                                <span class="days-ago">(${daysDiff} day${daysDiff > 1 ? 's' : ''} ago)</span>
                            </div>
                            ${order.preferred_date ? `
                                <div class="days-until ${dueClass}">
                                    <i class="fas ${dueIcon}"></i> ${daysUntilDue}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

// ============================================
// STAFF DROPDOWN FUNCTIONS
// ============================================

window.filterStaffDropdown = function (orderId, searchTerm) {
    let dropdownList = document.getElementById('staffDropdownList_' + orderId);

    if (!dropdownList) {
        const searchInput = document.getElementById('staffSearch_' + orderId);
        if (searchInput) {
            dropdownList = searchInput.nextElementSibling;
        }
    }

    if (!dropdownList) {
        const allDropdowns = document.querySelectorAll('.staff-dropdown-list');
        if (allDropdowns.length > 0) {
            dropdownList = allDropdowns[0];
        } else {
            return;
        }
    }

    dropdownList.style.display = 'block';

    const items = dropdownList.querySelectorAll('.staff-dropdown-item');
    const search = searchTerm.toLowerCase().trim();
    let hasVisible = false;

    items.forEach(function (item) {
        const staffName = item.dataset.name || item.textContent || '';
        const searchText = staffName.toLowerCase();
        const shouldShow = !search || searchText.includes(search);

        if (shouldShow) {
            item.style.display = 'flex';
            hasVisible = true;
        } else {
            item.style.display = 'none';
        }
    });

    let emptyMsg = dropdownList.querySelector('.staff-dropdown-empty');
    if (!hasVisible && search) {
        if (!emptyMsg) {
            emptyMsg = document.createElement('div');
            emptyMsg.className = 'staff-dropdown-empty';
            emptyMsg.style.cssText = 'padding:12px; text-align:center; color:#999; font-size:13px;';
            dropdownList.appendChild(emptyMsg);
        }
        emptyMsg.textContent = 'No staff found matching "' + search + '"';
        emptyMsg.style.display = 'block';
    } else if (emptyMsg) {
        emptyMsg.style.display = 'none';
    }
};

window.selectStaff = function (orderId, staffId, staffName) {
    const searchInput = document.getElementById('staffSearch_' + orderId);
    const hiddenInput = document.getElementById('staffSelect_' + orderId);
    const dropdownList = document.getElementById('staffDropdownList_' + orderId);

    if (searchInput) {
        searchInput.value = staffName || (staffId ? 'Staff #' + staffId : '-- Select Staff --');
        searchInput.style.borderColor = staffId ? '#4CAF50' : '#e0e0e0';
        searchInput.style.background = staffId ? '#f0fff4' : 'white';
    }

    if (hiddenInput) {
        hiddenInput.value = staffId || '';
    }

    if (dropdownList) {
        dropdownList.style.display = 'none';
        const items = dropdownList.querySelectorAll('.staff-dropdown-item');
        items.forEach(function (item) {
            if (item.dataset.value == staffId) {
                item.style.background = '#e3f2fd';
                item.style.fontWeight = '600';
            } else {
                item.style.background = '';
                item.style.fontWeight = '';
            }
        });
    }
};

window.assignStaff = async function (orderId) {
    const hiddenInput = document.getElementById('staffSelect_' + orderId);
    if (!hiddenInput) {
        showToast('Error: Staff selection not found', 'error');
        return;
    }

    const staffId = parseInt(hiddenInput.value);
    if (!staffId) {
        showToast('Please select a staff member', 'warning');
        const searchInput = document.getElementById('staffSearch_' + orderId);
        if (searchInput) {
            searchInput.style.borderColor = '#f44336';
            searchInput.style.background = '#fff5f5';
            setTimeout(function () {
                searchInput.style.borderColor = '#e0e0e0';
                searchInput.style.background = 'white';
            }, 2000);
        }
        return;
    }

    const staff = allStaff.find(function (s) { return s.user_id === staffId; });
    const staffName = staff?.full_name || staff?.email || 'Staff';

    if (!confirm('Assign order #' + orderId + ' to ' + staffName + '?')) return;

    const success = await assignStaffToOrder(orderId, staffId);
    if (success) {
        await window.refreshStaffAssignments();
        await refreshTab();
    }
};

// ============================================
// EDIT SERVICE ORDER (CRUD)
// ============================================

window.editServiceOrder = function (orderId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
    `;

    overlay.innerHTML = `
        <div class="modern-modal" style="max-width:550px; width:90%; max-height:90vh;">
            <div class="modal-header-bar">
                <i class="fas fa-spinner fa-spin"></i>
                <h3>Loading Order #${orderId}...</h3>
            </div>
            <div class="modal-body" style="text-align:center;padding:40px;">
                <i class="fas fa-spinner fa-spin" style="font-size:40px;color:#00d4ff;"></i>
                <p style="margin-top:20px;color:#888;">Fetching latest data...</p>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    fetchLatestOrderData(orderId, overlay);
};

async function fetchLatestOrderData(orderId, overlay) {
    try {
        const { data: order, error } = await supabase
            .from('service_orders')
            .select(`
                *,
                service:service_id (service_name, service_price)
            `)
            .eq('order_id', orderId)
            .single();

        if (error || !order) {
            overlay.innerHTML = `
                <div class="modern-modal" style="max-width:550px; width:90%; max-height:90vh;">
                    <div class="modal-header-bar">
                        <i class="fas fa-exclamation-circle"></i>
                        <h3>Error Loading Order</h3>
                    </div>
                    <div class="modal-body" style="text-align:center;padding:40px;">
                        <i class="fas fa-exclamation-triangle" style="font-size:40px;color:#f44336;"></i>
                        <p style="margin-top:20px;color:#888;">Failed to load order data.</p>
                        <button onclick="this.closest('.modal-overlay').remove()" class="btn-primary" style="margin-top:15px;">Close</button>
                    </div>
                </div>
            `;
            return;
        }

        let staffData = null;
        if (order.assigned_staff_id) {
            const { data: staff } = await supabase
                .from('users')
                .select('user_id, full_name, email, role')
                .eq('user_id', order.assigned_staff_id)
                .single();
            staffData = staff;
        }

        buildOrderModal(overlay, order, staffData);

    } catch (error) {
        overlay.innerHTML = `
            <div class="modern-modal" style="max-width:550px; width:90%; max-height:90vh;">
                <div class="modal-header-bar">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Error Loading Order</h3>
                </div>
                <div class="modal-body" style="text-align:center;padding:40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:40px;color:#f44336;"></i>
                    <p style="margin-top:20px;color:#888;">${error.message || 'Failed to load order data.'}</p>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn-primary" style="margin-top:15px;">Close</button>
                </div>
            </div>
        `;
    }
}

function buildOrderModal(overlay, order, staffData) {
    const staffOptions = allStaff.map(s => {
        const selected = s.user_id === order.assigned_staff_id ? 'selected' : '';
        return `<option value="${s.user_id}" ${selected}>
            #${s.user_id} - ${s.full_name || s.email}
        </option>`;
    }).join('');

    const currentStaffName = staffData?.full_name || staffData?.email || 'Unassigned';

    const statusOptions = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s =>
        `<option value="${s}" ${s === order.order_status ? 'selected' : ''}>${s.replace('_', ' ')}</option>`
    ).join('');

    overlay.innerHTML = `
        <div class="modern-modal" style="max-width:550px; width:90%; max-height:90vh;">
            <div class="modal-header-bar">
                <i class="fas fa-edit"></i>
                <h3>Service Order #${order.order_id}</h3>
                <span style="margin-left:auto;font-size:12px;background:rgba(255,255,255,0.1);padding:4px 12px;border-radius:12px;">
                    ${order.order_status || 'PENDING'}
                </span>
            </div>
            <div class="modal-body">
                <div style="background:#f8f9fc;border-radius:8px;padding:12px;margin-bottom:15px;border-left:4px solid #00d4ff;">
                    <strong>Current Staff:</strong> <span style="color:#00d4ff;">${currentStaffName}</span>
                    ${staffData ? `<span style="font-size:11px;color:#888;margin-left:10px;">(ID: ${staffData.user_id})</span>` : ''}
                    <span style="font-size:11px;color:#888;margin-left:10px;">| Order #${order.order_id}</span>
                </div>
                
                <div class="input-group">
                    <label>Customer Phone</label>
                    <input id="edit_contact_phone" value="${order.contact_phone || ''}" placeholder="Contact phone number">
                </div>
                <div class="input-group">
                    <label>Device Model</label>
                    <input id="edit_device_model" value="${order.device_model || ''}" placeholder="Device model">
                </div>
                <div class="input-group">
                    <label>Device Issue</label>
                    <textarea id="edit_device_issue" rows="2">${order.device_issue || ''}</textarea>
                </div>
                <div class="input-group">
                    <label>Address</label>
                    <textarea id="edit_address" rows="2">${order.address || ''}</textarea>
                </div>
                <div class="input-row">
                    <div class="input-group">
                        <label>Preferred Date</label>
                        <input type="date" id="edit_preferred_date" value="${order.preferred_date || ''}">
                    </div>
                    <div class="input-group">
                        <label>Preferred Time</label>
                        <input id="edit_preferred_time" value="${order.preferred_time || ''}" placeholder="e.g. 10:00 AM">
                    </div>
                </div>
                <div class="input-row">
                    <div class="input-group">
                        <label>Status</label>
                        <select id="edit_order_status">${statusOptions}</select>
                    </div>
                    <div class="input-group">
                        <label>Assign Staff</label>
                        <select id="edit_assigned_staff_id">
                            <option value="">-- Unassigned --</option>
                            ${staffOptions}
                        </select>
                    </div>
                </div>
                <div class="input-group">
                    <label>Notes</label>
                    <textarea id="edit_notes" rows="2">${order.notes || ''}</textarea>
                </div>
                ${order.service ? `
                    <div style="padding:12px;background:#f8f9fc;border-radius:8px;font-size:13px;color:#666;">
                        <strong>Service:</strong> ${order.service.service_name}
                        ${order.service.service_price ? `| <strong>Price:</strong> RM ${order.service.service_price}` : ''}
                    </div>
                ` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn-delete" id="deleteOrderBtn"><i class="fas fa-trash-alt"></i> Delete</button>
                <button class="btn-cancel" id="cancelBtn">Cancel</button>
                <button class="btn-save" id="saveOrderBtn"><i class="fas fa-save"></i> Update</button>
            </div>
        </div>
    `;

    // Event listeners
    document.getElementById('cancelBtn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Save button
    document.getElementById('saveOrderBtn').addEventListener('click', async () => {
        const staffSelect = document.getElementById('edit_assigned_staff_id');
        const assignedStaffId = staffSelect.value ? parseInt(staffSelect.value) : null;

        const updates = {
            contact_phone: document.getElementById('edit_contact_phone').value.trim(),
            device_model: document.getElementById('edit_device_model').value.trim(),
            device_issue: document.getElementById('edit_device_issue').value.trim() || null,
            address: document.getElementById('edit_address').value.trim(),
            preferred_date: document.getElementById('edit_preferred_date').value || null,
            preferred_time: document.getElementById('edit_preferred_time').value.trim() || null,
            order_status: document.getElementById('edit_order_status').value,
            assigned_staff_id: assignedStaffId,
            notes: document.getElementById('edit_notes').value.trim() || null,
            updated_at: new Date().toISOString()
        };

        if (!updates.contact_phone) {
            showToast('Contact phone is required', 'error');
            return;
        }
        if (!updates.address) {
            showToast('Address is required', 'error');
            return;
        }

        const saveBtn = document.getElementById('saveOrderBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
            const SUPABASE_KEY = SUPABASE_CONFIG.anonKey;

            const updateUrl = `${SUPABASE_URL}/rest/v1/service_orders?order_id=eq.${order.order_id}`;

            const response = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(updates)
            });

            const responseText = await response.text();

            if (!response.ok) {
                showToast('❌ Update failed: ' + responseText, 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Update';
                return;
            }

            showToast('✅ Order updated successfully!', 'success');
            overlay.remove();
            await window.refreshStaffAssignments();

            if (currentPage === 'staff') {
                document.getElementById('adminContent').innerHTML = renderStaffTab();
                setTimeout(() => {
                    renderStaffAssignmentList();
                    renderAssignedTimeline();
                }, 200);
            }

        } catch (error) {
            showToast('Failed to update: ' + error.message, 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Update';
        }
    });

    // Delete button
    document.getElementById('deleteOrderBtn').addEventListener('click', async () => {
        if (!confirm(`Delete order #${order.order_id}?`)) return;

        const deleteBtn = document.getElementById('deleteOrderBtn');
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

        try {
            const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
            const SUPABASE_KEY = SUPABASE_CONFIG.anonKey;

            const deleteUrl = `${SUPABASE_URL}/rest/v1/service_orders?order_id=eq.${order.order_id}`;

            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                showToast('Failed to delete: ' + errorText, 'error');
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
                return;
            }

            showToast('🗑️ Order deleted', 'success');
            overlay.remove();
            await window.refreshStaffAssignments();

            if (currentPage === 'staff') {
                document.getElementById('adminContent').innerHTML = renderStaffTab();
                setTimeout(() => {
                    renderStaffAssignmentList();
                    renderAssignedTimeline();
                }, 200);
            }

        } catch (error) {
            showToast('Failed to delete: ' + error.message, 'error');
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
        }
    });
}

// ============================================
// REFRESH FUNCTIONS
// ============================================

window.refreshStaffAssignments = async function () {
    try {
        await loadStaffData();
        await loadUnassignedOrders();
        await loadAssignedOrders();
        renderStaffAssignmentList();
        renderAssignedTimeline();

        const unassignedSection = document.getElementById('unassignedSection');
        if (unassignedSection) {
            unassignedSection.style.display = unassignedOrders.length === 0 ? 'none' : 'block';
        }
    } catch (error) {
        console.error('Error refreshing staff assignments:', error);
    }
};

// ============================================
// DOWNLOAD RECEIPT
// ============================================

window.downloadPaymentReceipt = function (paymentId) {
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

// ============================================
// CRUD HANDLERS
// ============================================

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

// ============================================
// IMAGE HANDLING
// ============================================

window.handleImageSelect = function (event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be less than 5MB', 'error');
        return;
    }

    selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = function (e) {
        selectedImagePreview = e.target.result;

        const previewImg = document.getElementById('imagePreviewImg');
        const placeholder = document.getElementById('imagePlaceholder');
        const previewContainer = document.getElementById('imagePreview');
        const removeBtn = document.getElementById('removeImageBtn');

        if (previewImg) {
            previewImg.src = e.target.result;
            previewImg.style.display = 'block';
        }
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        if (previewContainer) {
            previewContainer.classList.add('has-image');
        }
        if (removeBtn) {
            removeBtn.style.display = 'flex';
        }

        const nameParts = file.name.split('.');
        const extension = nameParts.pop() || 'jpg';
        const baseName = nameParts.join('.');
        const filenamePreview = document.getElementById('imageFilenamePreview');
        if (filenamePreview) {
            const cleanName = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            filenamePreview.textContent = `Will be saved as: ${cleanName}.${extension}`;
        }
    };
    reader.onerror = function () {
        showToast('Failed to read image file', 'error');
    };
    reader.readAsDataURL(file);
};

window.clearImage = function () {
    selectedImageFile = null;
    selectedImagePreview = null;

    const previewImg = document.getElementById('imagePreviewImg');
    const placeholder = document.getElementById('imagePlaceholder');
    const previewContainer = document.getElementById('imagePreview');
    const filenamePreview = document.getElementById('imageFilenamePreview');
    const removeBtn = document.getElementById('removeImageBtn');
    const fileInput = document.getElementById('imageInput');

    if (previewImg) {
        previewImg.style.display = 'none';
        previewImg.src = '';
    }
    if (placeholder) {
        placeholder.style.display = 'block';
    }
    if (previewContainer) {
        previewContainer.classList.remove('has-image');
    }
    if (removeBtn) {
        removeBtn.style.display = 'none';
    }
    if (filenamePreview) {
        filenamePreview.textContent = '(no image selected)';
    }
    if (fileInput) {
        fileInput.value = '';
    }
};

// ============================================
// IMAGE CONFLICT DIALOG
// ============================================

function showImageConflictDialog(existingFilename, newFilename, productName, newImageData) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'image-conflict-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(4px);
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
        `;

        const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
        const existingImageUrl = `${SUPABASE_URL}/storage/v1/object/public/images/${encodeURIComponent(existingFilename)}`;

        overlay.innerHTML = `
            <div class="image-conflict-dialog" style="
                background: white;
                border-radius: 20px;
                padding: 35px;
                max-width: 600px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 25px 80px rgba(0,0,0,0.3);
                animation: slideUp 0.3s ease;
            ">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="
                        width: 70px;
                        height: 70px;
                        border-radius: 50%;
                        background: #fff3e0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 15px;
                    ">
                        <i class="fas fa-exclamation-triangle" style="font-size: 32px; color: #ff9800;"></i>
                    </div>
                    <h3 style="color: #1a1a2e; margin-bottom: 5px;">⚠️ Duplicate Image Found</h3>
                    <p style="color: #666; font-size: 14px; margin: 5px 0;">
                        An image with the name <strong>"${existingFilename}"</strong> already exists.
                    </p>
                    <p style="color: #888; font-size: 13px; margin: 5px 0 15px;">
                        Product: <strong>${productName}</strong>
                    </p>
                </div>
                
                <div style="
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 20px;
                    background: #f8f9fc;
                    border-radius: 12px;
                    padding: 15px;
                ">
                    <div style="text-align: center;">
                        <div style="
                            width: 100%;
                            height: 120px;
                            background: white;
                            border-radius: 8px;
                            overflow: hidden;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border: 2px solid #ff9800;
                            padding: 5px;
                        ">
                            <img src="${existingImageUrl}" 
                                 alt="Existing image" 
                                 style="max-width: 100%; max-height: 100%; object-fit: contain;"
                                 onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fas fa-image\\' style=\\'font-size:40px;color:#ccc;\\'></i><p style=\\'font-size:11px;color:#999;margin:5px 0;\\'>No image</p>'">
                        </div>
                        <p style="font-size: 11px; color: #888; margin-top: 5px;">
                            <i class="fas fa-file"></i> ${existingFilename}
                        </p>
                        <span style="font-size: 10px; color: #ff9800; background: #fff3e0; padding: 2px 8px; border-radius: 4px;">Existing</span>
                    </div>
                    
                    <div style="text-align: center;">
                        <div style="
                            width: 100%;
                            height: 120px;
                            background: white;
                            border-radius: 8px;
                            overflow: hidden;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border: 2px solid #4CAF50;
                            padding: 5px;
                        ">
                            <img src="${newImageData}" 
                                 alt="New image" 
                                 style="max-width: 100%; max-height: 100%; object-fit: contain;">
                        </div>
                        <p style="font-size: 11px; color: #888; margin-top: 5px;">
                            <i class="fas fa-file"></i> ${newFilename}
                        </p>
                        <span style="font-size: 10px; color: #4CAF50; background: #e8f5e9; padding: 2px 8px; border-radius: 4px;">New</span>
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button id="replaceBtn" style="
                        padding: 14px 20px;
                        background: #ff9800;
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 14px;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        width: 100%;
                    ">
                        <i class="fas fa-exchange-alt"></i> Replace Existing Image
                    </button>
                    
                    <div style="display: flex; gap: 10px;">
                        <input id="renameInput" type="text" 
                            placeholder="Enter new name (without extension)"
                            style="
                                flex: 1;
                                padding: 12px 14px;
                                border: 1.5px solid #e0e0e0;
                                border-radius: 10px;
                                font-size: 14px;
                                outline: none;
                                transition: border-color 0.2s;
                                background: #fafafa;
                            "
                            onfocus="this.style.borderColor='#00d4ff'; this.style.background='white';"
                            onblur="this.style.borderColor='#e0e0e0'; this.style.background='#fafafa';"
                        >
                        <button id="renameBtn" style="
                            padding: 12px 20px;
                            background: #2196F3;
                            color: white;
                            border: none;
                            border-radius: 10px;
                            cursor: pointer;
                            font-weight: 600;
                            font-size: 14px;
                            transition: all 0.2s;
                            white-space: nowrap;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        ">
                            <i class="fas fa-pen"></i> Rename
                        </button>
                    </div>
                    
                    <button id="useExistingBtn" style="
                        padding: 12px 20px;
                        background: #4CAF50;
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 14px;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        width: 100%;
                    ">
                        <i class="fas fa-check"></i> Keep Both (Auto-rename new)
                    </button>
                    
                    <button id="cancelBtn" style="
                        padding: 12px 20px;
                        background: #f5f5f5;
                        color: #666;
                        border: 1.5px solid #e0e0e0;
                        border-radius: 10px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 14px;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        width: 100%;
                    ">
                        <i class="fas fa-times"></i> Cancel Upload
                    </button>
                </div>
                
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #f0f0f5;">
                    <p style="color: #999; font-size: 11px; text-align: center; margin: 0;">
                        <i class="fas fa-info-circle"></i> 
                        <strong>Replace</strong>: Overwrites the existing image • 
                        <strong>Rename</strong>: Saves with a new name • 
                        <strong>Keep Both</strong>: Keeps the old image, saves the new one with a numbered suffix
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('replaceBtn').addEventListener('click', async () => {
            overlay.remove();
            resolve({ action: 'replace' });
        });

        document.getElementById('renameBtn').addEventListener('click', () => {
            const newName = document.getElementById('renameInput').value.trim();
            if (!newName) {
                showToast('Please enter a new name', 'error');
                return;
            }
            overlay.remove();
            const extension = existingFilename.split('.').pop() || 'jpeg';
            const finalName = newName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.' + extension;
            resolve({ action: 'rename', newName: finalName });
        });

        document.getElementById('useExistingBtn').addEventListener('click', () => {
            overlay.remove();
            const baseName = existingFilename.replace(/\.[^.]+$/, '');
            const extension = existingFilename.split('.').pop() || 'jpeg';
            resolve({ action: 'keepBoth', baseName: baseName, extension: extension });
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            overlay.remove();
            resolve({ action: 'cancel' });
        });

        document.getElementById('renameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('renameBtn').click();
            }
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve({ action: 'cancel' });
            }
        });
    });
}

// ============================================
// UPLOAD INVENTORY IMAGE
// ============================================

async function uploadInventoryImage(itemId, name, file) {
    try {
        const baseName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const extension = file.name.split('.').pop() || 'jpg';
        const filename = `${baseName}.${extension}`;

        const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';

        const checkUrl = `${SUPABASE_URL}/storage/v1/object/public/images/${encodeURIComponent(filename)}`;
        let fileExists = false;
        try {
            const checkResponse = await fetch(checkUrl, { method: 'HEAD' });
            fileExists = checkResponse.ok;
        } catch (e) {
            // File doesn't exist
        }

        let finalFilename = filename;

        if (fileExists) {
            const reader = new FileReader();
            const imageData = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });

            const userChoice = await showImageConflictDialog(filename, filename, name, imageData);

            if (userChoice.action === 'cancel') {
                showToast('Upload cancelled', 'warning');
                return null;
            }

            if (userChoice.action === 'replace') {
                finalFilename = filename;
                const { error: deleteError } = await supabase.storage
                    .from('images')
                    .remove([filename]);
                if (deleteError && !deleteError.message.includes('not found')) {
                    showToast('Could not delete existing file: ' + deleteError.message, 'warning');
                }
            }

            if (userChoice.action === 'rename') {
                finalFilename = userChoice.newName;
            }

            if (userChoice.action === 'keepBoth') {
                let counter = 1;
                let newName = `${userChoice.baseName} (${counter}).${userChoice.extension}`;
                let exists = true;

                while (exists) {
                    try {
                        const checkNewUrl = `${SUPABASE_URL}/storage/v1/object/public/images/${encodeURIComponent(newName)}`;
                        const checkResponse = await fetch(checkNewUrl, { method: 'HEAD' });
                        exists = checkResponse.ok;
                        if (exists) {
                            counter++;
                            newName = `${userChoice.baseName} (${counter}).${userChoice.extension}`;
                        }
                    } catch (e) {
                        exists = false;
                    }
                }
                finalFilename = newName;
            }
        }

        const { data: uploadResult, error: uploadError } = await supabase.storage
            .from('images')
            .upload(finalFilename, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) {
            if (uploadError.message && uploadError.message.includes('already exists')) {
                const timestamp = Date.now();
                const nameParts = finalFilename.split('.');
                const ext = nameParts.pop() || 'jpg';
                const base = nameParts.join('.');
                const timedFilename = `${base}-${timestamp}.${ext}`;

                const { data: retryResult, error: retryError } = await supabase.storage
                    .from('images')
                    .upload(timedFilename, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (retryError) {
                    showToast('Image upload failed: ' + retryError.message, 'error');
                    return null;
                }

                finalFilename = timedFilename;
                showToast('Image uploaded with new name!', 'success');
            } else {
                showToast('Image upload failed: ' + uploadError.message, 'error');
                return null;
            }
        } else {
            showToast('Image uploaded successfully!', 'success');
        }

        const { error: updateError } = await supabase
            .from('inventory')
            .update({ i_image_path: finalFilename })
            .eq('i_id', itemId);

        if (updateError) {
            showToast('Failed to update inventory with image: ' + updateError.message, 'error');
            return null;
        }

        return finalFilename;

    } catch (error) {
        console.error('uploadInventoryImage error:', error);
        showToast('Upload error: ' + error.message, 'error');
        return null;
    }
}

// ============================================
// INVENTORY CRUD
// ============================================

window.editInventory = (itemId) => {
    const item = allInventory.find(i => i.i_id === itemId);
    if (!item) return;

    selectedImageFile = null;
    selectedImagePreview = null;

    showEditModal('Edit Stock #' + itemId, item, 'inventory', 'edit', {
        onSave: (overlay) => showConfirmSave(async () => {
            const name = document.getElementById('edit_i_name')?.value?.trim();
            const category = document.getElementById('edit_i_category')?.value;
            const brand = document.getElementById('edit_i_brand')?.value?.trim();
            const price = parseFloat(document.getElementById('edit_i_price')?.value);
            const quantity = parseInt(document.getElementById('edit_i_quantity')?.value);

            if (!name || !category || isNaN(price) || isNaN(quantity)) {
                showToast('Please fill in all required fields', 'error');
                return false;
            }

            const updates = {
                i_name: name,
                i_category: category,
                i_brand: brand || null,
                i_price: price,
                i_quantity: quantity
            };

            const { error: updateError } = await supabase
                .from('inventory')
                .update(updates)
                .eq('i_id', itemId);

            if (updateError) {
                showToast('Failed to update item: ' + updateError.message, 'error');
                return false;
            }

            if (selectedImageFile) {
                if (item.i_image_path) {
                    try {
                        await supabase.storage.from('images').remove([item.i_image_path]);
                    } catch (e) {
                        // Image not found, continue
                    }
                }

                const filename = await uploadInventoryImage(itemId, name, selectedImageFile);
                if (filename) {
                    showToast('Item and image updated successfully!', 'success');
                } else {
                    showToast('Item updated but image upload failed', 'error');
                }
            } else {
                showToast('Item updated successfully!', 'success');
            }

            overlay.remove();
            await refreshTab();
            return true;
        }),
        onDelete: (overlay) => showConfirmDelete(async () => {
            if (item.i_image_path) {
                try {
                    await supabase.storage.from('images').remove([item.i_image_path]);
                } catch (e) {
                    // Image not found, continue
                }
            }
            await performDelete('inventory', item, supabase);
            overlay.remove();
            await refreshTab();
        })
    });

    setTimeout(() => {
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
            const formGroups = modalBody.querySelectorAll('.input-group');
            if (formGroups.length > 0) {
                const lastGroup = formGroups[formGroups.length - 1];

                const imageSection = document.createElement('div');
                imageSection.className = 'input-group';
                imageSection.style.marginTop = '15px';
                imageSection.innerHTML = `
                    <label>Product Image</label>
                    <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
                        <div class="image-upload-preview ${item.i_image_path ? 'has-image' : ''}" id="imagePreview" onclick="document.getElementById('imageInput').click()" style="width:150px;height:150px;border:2px dashed #e0e0e0;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#f8f9fc;cursor:pointer;transition:all 0.3s;">
                            <div class="placeholder" id="imagePlaceholder" style="${item.i_image_path ? 'display:none;' : ''}text-align:center;color:#999;">
                                <i class="fas fa-camera" style="font-size:40px;display:block;margin-bottom:8px;"></i>
                                <span>Click to upload</span>
                                <span style="font-size:11px;color:#ccc;">JPG, PNG, JPEG</span>
                            </div>
                            <img id="imagePreviewImg" style="${item.i_image_path ? 'display:block;' : 'display:none;'}width:100%;height:100%;object-fit:contain;padding:10px;" src="${getImageUrl(item.i_image_path) || ''}" alt="Preview">
                            <button type="button" class="remove-image" id="removeImageBtn" onclick="event.stopPropagation(); window.clearImage()" style="position:absolute;top:5px;right:5px;background:#f44336;color:white;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:14px;display:${item.i_image_path ? 'flex' : 'none'};align-items:center;justify-content:center;z-index:10;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:5px;justify-content:center;">
                            <span style="font-size:13px;color:#666;">Upload a new image to replace the current one</span>
                            <span style="font-size:12px;color:#999;">Current: <strong>${item.i_image_path || 'No image'}</strong></span>
                            <span style="font-size:12px;color:#999;">New filename will be: <strong id="imageFilenamePreview">${item.i_image_path || '(no image selected)'}</strong></span>
                        </div>
                    </div>
                    <input type="file" id="imageInput" accept="image/*" style="display:none;" onchange="window.handleImageSelect(event)">
                `;

                lastGroup.parentNode.insertBefore(imageSection, lastGroup.nextSibling);
            }
        }
    }, 300);
};

window.addInventoryItem = () => {
    selectedImageFile = null;
    selectedImagePreview = null;

    showEditModal('New Stock Item', {
        i_name: '',
        i_category: 'cpu',
        i_brand: '',
        i_price: 0,
        i_quantity: 0
    }, 'inventory', 'new', {
        onSave: async (overlay) => {
            const name = document.getElementById('edit_i_name')?.value?.trim();
            const category = document.getElementById('edit_i_category')?.value;
            const brand = document.getElementById('edit_i_brand')?.value?.trim();
            const price = parseFloat(document.getElementById('edit_i_price')?.value);
            const quantity = parseInt(document.getElementById('edit_i_quantity')?.value);

            const validation = validateInventoryForm();
            if (!validation.valid) {
                showValidationDialog(validation, () => { }, () => { });
                return false;
            }

            if (validation.warnings.length > 0) {
                return new Promise((resolve) => {
                    showValidationDialog(validation, async () => {
                        const result = await saveInventoryItem(validation.values);
                        if (result) {
                            overlay.remove();
                            await refreshTab();
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    }, () => {
                        resolve(false);
                    });
                });
            }

            const result = await saveInventoryItem(validation.values);
            if (result) {
                overlay.remove();
                await refreshTab();
                return true;
            }
            return false;
        }
    });

    setTimeout(() => {
        const modalBody = document.querySelector('.modal-body');
        if (modalBody) {
            const formGroups = modalBody.querySelectorAll('.input-group');
            if (formGroups.length > 0) {
                const lastGroup = formGroups[formGroups.length - 1];

                const imageSection = document.createElement('div');
                imageSection.className = 'input-group';
                imageSection.style.marginTop = '15px';
                imageSection.innerHTML = `
                    <label>Product Image</label>
                    <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
                        <div class="image-upload-preview" id="imagePreview" onclick="document.getElementById('imageInput').click()" style="width:150px;height:150px;border:2px dashed #e0e0e0;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#f8f9fc;cursor:pointer;transition:all 0.3s;">
                            <div class="placeholder" id="imagePlaceholder" style="text-align:center;color:#999;">
                                <i class="fas fa-camera" style="font-size:40px;display:block;margin-bottom:8px;"></i>
                                <span>Click to upload</span>
                                <span style="font-size:11px;color:#ccc;">JPG, PNG, JPEG</span>
                            </div>
                            <img id="imagePreviewImg" style="display:none;width:100%;height:100%;object-fit:contain;padding:10px;" alt="Preview">
                            <button type="button" class="remove-image" id="removeImageBtn" onclick="event.stopPropagation(); window.clearImage()" style="position:absolute;top:5px;right:5px;background:#f44336;color:white;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:14px;display:none;align-items:center;justify-content:center;z-index:10;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:5px;justify-content:center;">
                            <span style="font-size:13px;color:#666;">Upload an image for this product</span>
                            <span style="font-size:12px;color:#999;">The image will be stored in the images bucket</span>
                            <span style="font-size:12px;color:#999;">Filename will be: <strong id="imageFilenamePreview">(no image selected)</strong></span>
                        </div>
                    </div>
                    <input type="file" id="imageInput" accept="image/*" style="display:none;" onchange="window.handleImageSelect(event)">
                `;

                lastGroup.parentNode.insertBefore(imageSection, lastGroup.nextSibling);
            }
        }
    }, 300);

    setTimeout(() => {
        setupProductAutoDetection();
    }, 500);
};

async function saveInventoryItem(values) {
    const { name, category, brand, price, quantity, hasImage } = values;

    try {
        const insertData = {
            i_name: name,
            i_category: category,
            i_brand: brand || null,
            i_price: price,
            i_quantity: quantity
        };

        const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
        const SUPABASE_KEY = SUPABASE_CONFIG.anonKey;

        const insertUrl = `${SUPABASE_URL}/rest/v1/inventory`;

        const insertResponse = await fetch(insertUrl, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(insertData)
        });

        if (!insertResponse.ok) {
            const errorText = await insertResponse.text();
            showToast('Failed to save item: ' + errorText, 'error');
            return false;
        }

        const resultData = await insertResponse.json();

        let insertedItem = null;
        if (Array.isArray(resultData) && resultData.length > 0) {
            insertedItem = resultData[0];
        } else if (resultData && typeof resultData === 'object' && resultData.i_id) {
            insertedItem = resultData;
        }

        if (!insertedItem) {
            const fetchUrl = `${SUPABASE_URL}/rest/v1/inventory?select=*&order=i_id.desc&limit=1`;
            const fetchResponse = await fetch(fetchUrl, {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            if (fetchResponse.ok) {
                const fetchData = await fetchResponse.json();
                if (Array.isArray(fetchData) && fetchData.length > 0) {
                    insertedItem = fetchData[0];
                }
            }
        }

        if (insertedItem) {
            if (selectedImageFile) {
                const filename = await uploadInventoryImage(insertedItem.i_id, name, selectedImageFile);
                if (filename) {
                    showToast('Item and image saved successfully!', 'success');
                } else {
                    showToast('Item saved but image upload failed', 'error');
                }
            } else {
                showToast('Item saved successfully!', 'success');
            }
            return true;
        } else {
            showToast('Item saved but could not retrieve ID. Please refresh.', 'warning');
            return true;
        }

    } catch (err) {
        console.error('Save error:', err);
        showToast('Error: ' + err.message, 'error');
        return false;
    }
}

// ============================================
// SERVICE CRUD
// ============================================

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

// ============================================
// NAVIGATION & REFRESH
// ============================================

async function refreshTab() {
    await loadDashboardData();
    document.getElementById('adminContent').innerHTML = getTabContent(currentPage);

    if (currentPage === 'staff') {
        setTimeout(() => {
            window.refreshStaffAssignments();
        }, 300);
    }
}

function getTabContent(page) {
    switch (page) {
        case 'orders': return renderOrdersTab();
        case 'users': return renderUsersTab();
        case 'inventory': return renderInventoryTab();
        case 'services': return renderServicesTab();
        case 'payments': return renderPaymentsTab();
        case 'staff': return renderStaffTab();
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

            if (currentPage === 'staff') {
                setTimeout(() => {
                    window.refreshStaffAssignments();
                }, 300);
            }
        });
    });
}

window.handleLogout = () => {
    localStorage.removeItem('buildbuddy_user');
    sessionStorage.removeItem('buildbuddy_user');
    window.location.href = '../index.html';
};

// ============================================
// DOM CONTENT LOADED
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loadingOverlay');

    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }

    try {
        const hasAccess = await checkAdminAccess();
        if (!hasAccess) return;

        await loadDashboardData();

        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }

        const dashboard = document.getElementById('adminDashboard');
        if (dashboard) {
            dashboard.style.display = 'block';
        }

        renderSidebar();
        document.getElementById('adminContent').innerHTML = renderOrdersTab();
        setupNavigation();

        setTimeout(() => {
            window.refreshStaffAssignments();
        }, 500);

    } catch (error) {
        console.error('Error initializing admin dashboard:', error);

        if (loadingOverlay) {
            loadingOverlay.innerHTML = `
                <div style="text-align:center;color:white;padding:40px;">
                    <i class="fas fa-exclamation-circle" style="font-size:48px;color:#f44336;margin-bottom:20px;"></i>
                    <h3 style="color:white;">Failed to load dashboard</h3>
                    <p style="color:#ccc;">${error.message || 'Unknown error'}</p>
                    <button onclick="location.reload()" style="margin-top:20px;padding:12px 30px;background:#00d4ff;color:#1a1a2e;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
            loadingOverlay.style.display = 'flex';
        }
    }
});

// ============================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================

window.handleImageSelect = window.handleImageSelect;
window.clearImage = window.clearImage;
window.setupProductAutoDetection = setupProductAutoDetection;
window.addInventoryItem = window.addInventoryItem;
window.editInventory = window.editInventory;
window.editOrder = window.editOrder;
window.editUser = window.editUser;
window.editService = window.editService;
window.addServiceItem = window.addServiceItem;
window.downloadPaymentReceipt = window.downloadPaymentReceipt;
window.handleLogout = window.handleLogout;

// Staff assignment functions
window.assignStaff = window.assignStaff;
window.refreshStaffAssignments = window.refreshStaffAssignments;
window.editServiceOrder = window.editServiceOrder;
window.filterStaffDropdown = window.filterStaffDropdown;
window.selectStaff = window.selectStaff;

console.log('✅ Admin dashboard loaded successfully');