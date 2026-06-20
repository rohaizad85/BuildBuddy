// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\admin\admin-utils.js

import supabase from '../supabase-client.js';

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const COUNTRY_CODES = [
    { code: '+60', name: 'Malaysia' },
    { code: '+65', name: 'Singapore' },
    { code: '+62', name: 'Indonesia' },
    { code: '+66', name: 'Thailand' },
    { code: '+63', name: 'Philippines' },
    { code: '+84', name: 'Vietnam' },
    { code: '+95', name: 'Myanmar' },
    { code: '+855', name: 'Cambodia' },
    { code: '+856', name: 'Laos' },
    { code: '+673', name: 'Brunei' },
    { code: '+1', name: 'USA/Canada' },
    { code: '+44', name: 'UK' },
    { code: '+61', name: 'Australia' },
    { code: '+64', name: 'New Zealand' },
    { code: '+81', name: 'Japan' },
    { code: '+82', name: 'South Korea' },
    { code: '+86', name: 'China' },
    { code: '+91', name: 'India' },
    { code: '+886', name: 'Taiwan' },
    { code: '+852', name: 'Hong Kong' }
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function formatDate(d) {
    if (!d) return 'N/A';
    try {
        return new Date(d).toLocaleDateString('en-MY', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    } catch {
        return 'N/A';
    }
}

export function showToast(msg, type) {
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 14px 24px;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        font-size: 14px;
        z-index: 99999;
        animation: slideIn 0.3s ease;
        background: ${colors[type] || colors.success};
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    toast.innerHTML = `${icons[type] || '📢'} ${msg}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, 3000);
}

// ============================================
// FORM VALIDATION
// ============================================

export function validateInventoryForm() {
    const errors = [];
    const warnings = [];
    
    // Get form values safely
    const nameInput = document.getElementById('edit_i_name');
    const categorySelect = document.getElementById('edit_i_category');
    const brandInput = document.getElementById('edit_i_brand');
    const priceInput = document.getElementById('edit_i_price');
    const quantityInput = document.getElementById('edit_i_quantity');
    const imagePreview = document.getElementById('imagePreviewImg');
    
    const name = nameInput ? nameInput.value?.trim() : '';
    const category = categorySelect ? categorySelect.value : '';
    const brand = brandInput ? brandInput.value?.trim() : '';
    const price = priceInput ? parseFloat(priceInput.value) : NaN;
    const quantity = quantityInput ? parseInt(quantityInput.value) : NaN;
    const hasImage = imagePreview && imagePreview.src && imagePreview.src !== '';
    
    // Validate Name
    if (!name) {
        errors.push('Product name is required');
        if (nameInput) nameInput.style.borderColor = '#f44336';
    } else if (name.length < 2) {
        errors.push('Product name must be at least 2 characters');
        if (nameInput) nameInput.style.borderColor = '#f44336';
    } else {
        if (nameInput) nameInput.style.borderColor = '#4CAF50';
    }
    
    // Validate Category
    if (!category) {
        errors.push('Category is required');
        if (categorySelect) categorySelect.style.borderColor = '#f44336';
    } else {
        if (categorySelect) categorySelect.style.borderColor = '#4CAF50';
    }
    
    // Validate Price
    if (isNaN(price)) {
        errors.push('Price is required');
        if (priceInput) priceInput.style.borderColor = '#f44336';
    } else if (price < 0) {
        errors.push('Price cannot be negative');
        if (priceInput) priceInput.style.borderColor = '#f44336';
    } else if (price === 0) {
        warnings.push('Price is set to RM 0.00 - is this correct?');
        if (priceInput) priceInput.style.borderColor = '#ff9800';
    } else {
        if (priceInput) priceInput.style.borderColor = '#4CAF50';
    }
    
    // Validate Quantity
    if (isNaN(quantity)) {
        errors.push('Stock quantity is required');
        if (quantityInput) quantityInput.style.borderColor = '#f44336';
    } else if (quantity < 0) {
        errors.push('Stock quantity cannot be negative');
        if (quantityInput) quantityInput.style.borderColor = '#f44336';
    } else {
        if (quantityInput) quantityInput.style.borderColor = '#4CAF50';
    }
    
    // Check image (warning only)
    if (!hasImage) {
        warnings.push('No image selected - a placeholder image will be used');
    }
    
    // Check brand (warning only)
    if (!brand) {
        warnings.push('Brand is not specified - this may affect product discoverability');
    }
    
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        values: { 
            name: name, 
            category: category, 
            brand: brand, 
            price: isNaN(price) ? 0 : price, 
            quantity: isNaN(quantity) ? 0 : quantity, 
            hasImage: hasImage 
        }
    };
}

// ============================================
// VALIDATION DIALOGS
// ============================================

export function showValidationDialog(validationResult, onConfirm, onCancel) {
    const { valid, errors, warnings } = validationResult;
    
    if (!valid) {
        showErrorDialog(errors);
        return false;
    }
    
    if (warnings.length > 0) {
        showWarningDialog(warnings, onConfirm, onCancel);
        return false;
    }
    
    // No errors or warnings, proceed
    if (typeof onConfirm === 'function') {
        onConfirm();
    }
    return true;
}

function showErrorDialog(errors) {
    const overlay = createOverlay();
    overlay.innerHTML = `
        <div class="validation-dialog error-dialog">
            <div class="dialog-icon error-icon">
                <i class="fas fa-exclamation-circle"></i>
            </div>
            <h3>Please Fix Errors</h3>
            <p>Please correct the following issues before saving:</p>
            <div class="error-list">
                ${errors.map(function(err) {
                    return `
                        <div class="error-item">
                            <i class="fas fa-times-circle"></i>
                            ${err}
                        </div>
                    `;
                }).join('')}
            </div>
            <button class="dialog-btn primary-btn" onclick="this.closest('.validation-dialog').parentElement.remove()">
                <i class="fas fa-check"></i> Got it, I'll fix it
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { 
        if (e.target === overlay) overlay.remove(); 
    });
}

function showWarningDialog(warnings, onConfirm, onCancel) {
    const overlay = createOverlay();
    overlay.innerHTML = `
        <div class="validation-dialog warning-dialog">
            <div class="dialog-icon warning-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3>Confirm Details</h3>
            <p>Please review the following warnings before continuing:</p>
            <div class="warning-list">
                ${warnings.map(function(w) {
                    return `
                        <div class="warning-item">
                            <i class="fas fa-info-circle"></i>
                            ${w}
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="dialog-actions">
                <button class="dialog-btn cancel-btn" id="warningCancelBtn">
                    <i class="fas fa-times"></i> Go Back
                </button>
                <button class="dialog-btn confirm-btn" id="warningConfirmBtn">
                    <i class="fas fa-check"></i> Continue Anyway
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const cancelBtn = document.getElementById('warningCancelBtn');
    const confirmBtn = document.getElementById('warningConfirmBtn');
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            overlay.remove();
            if (typeof onCancel === 'function') onCancel();
        });
    }
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            overlay.remove();
            if (typeof onConfirm === 'function') onConfirm();
        });
    }
    
    overlay.addEventListener('click', function(e) { 
        if (e.target === overlay) overlay.remove(); 
    });
}

function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'validation-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(4px);
        z-index: 100001;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
    `;
    
    // Add styles if not already present
    if (!document.getElementById('validationStyles')) {
        const style = document.createElement('style');
        style.id = 'validationStyles';
        style.textContent = `
            .validation-dialog {
                background: white;
                border-radius: 20px;
                padding: 35px;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 25px 80px rgba(0,0,0,0.3);
                animation: slideUp 0.3s ease;
            }
            .validation-dialog .dialog-icon {
                width: 70px;
                height: 70px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 15px;
            }
            .validation-dialog .dialog-icon i { font-size: 32px; }
            .validation-dialog .error-icon { background: #ffebee; }
            .validation-dialog .error-icon i { color: #f44336; }
            .validation-dialog .warning-icon { background: #fff3e0; }
            .validation-dialog .warning-icon i { color: #ff9800; }
            .validation-dialog h3 {
                color: #1a1a2e;
                margin-bottom: 5px;
                text-align: center;
                font-size: 20px;
            }
            .validation-dialog > p {
                color: #666;
                font-size: 14px;
                text-align: center;
                margin-bottom: 15px;
            }
            .validation-dialog .error-list,
            .validation-dialog .warning-list {
                text-align: left;
                margin-bottom: 20px;
            }
            .validation-dialog .error-item,
            .validation-dialog .warning-item {
                padding: 10px 14px;
                margin-bottom: 8px;
                border-radius: 8px;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .validation-dialog .error-item {
                background: #ffebee;
                border-left: 4px solid #f44336;
                color: #c62828;
            }
            .validation-dialog .error-item i { color: #f44336; }
            .validation-dialog .warning-item {
                background: #fff3e0;
                border-left: 4px solid #ff9800;
                color: #e65100;
            }
            .validation-dialog .warning-item i { color: #ff9800; }
            .validation-dialog .dialog-actions {
                display: flex;
                gap: 10px;
            }
            .validation-dialog .dialog-btn {
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 10px;
                cursor: pointer;
                font-weight: 600;
                font-size: 14px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .validation-dialog .primary-btn {
                width: 100%;
                background: #00d4ff;
                color: #1a1a2e;
            }
            .validation-dialog .primary-btn:hover { background: #00b8e6; }
            .validation-dialog .cancel-btn {
                border: 1.5px solid #e0e0e0;
                background: white;
                color: #666;
            }
            .validation-dialog .cancel-btn:hover { background: #f5f5f5; }
            .validation-dialog .confirm-btn {
                background: #ff9800;
                color: white;
            }
            .validation-dialog .confirm-btn:hover { background: #f57c00; }
            
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    return overlay;
}

// ============================================
// MODAL FUNCTIONS
// ============================================

export function showEditModal(title, data, type, mode, callbacks) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const fieldsHTML = generateFieldsHTML(type, data);
    
    const modal = document.createElement('div');
    modal.className = 'modern-modal';
    modal.innerHTML = `
        <div class="modal-header-bar">
            <i class="fas fa-${mode === 'new' ? 'plus-circle' : 'edit'}"></i>
            <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="modal-body">${fieldsHTML}</div>
        <div class="modal-footer">
            ${mode !== 'new' ? `<button class="btn-delete" id="deleteBtn"><i class="fas fa-trash-alt"></i> Delete</button>` : ''}
            <button class="btn-cancel" id="cancelBtn">Cancel</button>
            <button class="btn-save" id="saveBtn"><i class="fas fa-save"></i> Save</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Event Listeners
    setupModalEventListeners(overlay, mode, type, data, callbacks);
}

// ============================================
// FIELD GENERATORS
// ============================================

function generateFieldsHTML(type, data) {
    switch (type) {
        case 'users': return generateUserFields(data);
        case 'inventory': return generateInventoryFields(data);
        case 'services': return generateServiceFields(data);
        case 'service_order': return generateServiceOrderFields(data);
        case 'payment_order': return generatePaymentOrderFields(data);
        default: return '<p style="color:#666;padding:20px 0;">Viewing details.</p>';
    }
}

function generateUserFields(data) {
    let existingCode = '+60';
    let existingNumber = '';
    if (data.phone) {
        const match = data.phone.match(/^(\+\d{1,4})[-.\s]?(.*)$/);
        if (match) {
            existingCode = match[1];
            existingNumber = match[2].replace(/[-.\s]/g, '');
        } else {
            existingNumber = data.phone.replace(/[-.\s]/g, '');
        }
    }

    const codeOptions = COUNTRY_CODES.map(function(c) {
        return `<option value="${c.code}" ${c.code === existingCode ? 'selected' : ''}>${c.code} (${c.name})</option>`;
    }).join('');

    return `
        <div class="input-group">
            <label>Full Name</label>
            <input id="edit_full_name" value="${escapeHtml(data.full_name || '')}" placeholder="Enter full name">
        </div>
        <div class="input-group">
            <label>Email</label>
            <input type="email" id="edit_email" value="${escapeHtml(data.email || '')}" placeholder="Enter email address">
        </div>
        <div class="input-group">
            <label>Phone Number</label>
            <div style="display:flex;gap:8px;">
                <select id="edit_phone_code" style="width:160px;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;font-family:inherit;">
                    ${codeOptions}
                </select>
                <input id="edit_phone_number" value="${escapeHtml(existingNumber)}" placeholder="Phone number" style="flex:1;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;font-family:inherit;">
            </div>
            <span id="phoneError" style="color:#f44336;font-size:11px;margin-top:4px;display:none;"></span>
        </div>
        <div class="input-group">
            <label>Role</label>
            <select id="edit_role">
                <option value="USER" ${data.role === 'USER' ? 'selected' : ''}>USER</option>
                <option value="STAFF" ${data.role === 'STAFF' ? 'selected' : ''}>STAFF</option>
                <option value="ADMIN" ${data.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
            </select>
        </div>
        <div class="input-group">
            <label>Address</label>
            <textarea id="edit_address" placeholder="Enter shipping address">${escapeHtml(data.address || '')}</textarea>
        </div>
    `;
}

function generateInventoryFields(data) {
    return `
        <div class="input-group">
            <label>Product Name <span style="color:#f44336;">*</span></label>
            <input id="edit_i_name" value="${escapeHtml(data.i_name || '')}" placeholder="Enter product name">
        </div>
        <div class="input-row">
            <div class="input-group">
                <label>Category <span style="color:#f44336;">*</span></label>
                <select id="edit_i_category">
                    <option value="cpu" ${data.i_category === 'cpu' ? 'selected' : ''}>CPU</option>
                    <option value="motherboard" ${data.i_category === 'motherboard' ? 'selected' : ''}>Motherboard</option>
                    <option value="ram" ${data.i_category === 'ram' ? 'selected' : ''}>RAM</option>
                    <option value="gpu" ${data.i_category === 'gpu' ? 'selected' : ''}>GPU</option>
                    <option value="storage" ${data.i_category === 'storage' ? 'selected' : ''}>Storage</option>
                    <option value="psu" ${data.i_category === 'psu' ? 'selected' : ''}>PSU</option>
                    <option value="cooler" ${data.i_category === 'cooler' ? 'selected' : ''}>Cooler</option>
                    <option value="case" ${data.i_category === 'case' ? 'selected' : ''}>Case</option>
                    <option value="monitor" ${data.i_category === 'monitor' ? 'selected' : ''}>Monitor</option>
                    <option value="other" ${data.i_category === 'other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
            <div class="input-group">
                <label>Brand</label>
                <input id="edit_i_brand" value="${escapeHtml(data.i_brand || '')}" placeholder="Enter brand name">
            </div>
        </div>
        <div class="input-row">
            <div class="input-group">
                <label>Price (RM) <span style="color:#f44336;">*</span></label>
                <input type="number" id="edit_i_price" value="${data.i_price || 0}" step="0.01" min="0">
            </div>
            <div class="input-group">
                <label>Stock Quantity <span style="color:#f44336;">*</span></label>
                <input type="number" id="edit_i_quantity" value="${data.i_quantity || 0}" min="0">
            </div>
        </div>
    `;
}

function generateServiceFields(data) {
    return `
        <div class="input-group">
            <label>Name</label>
            <input id="edit_service_name" value="${escapeHtml(data.service_name || '')}" placeholder="Enter service name">
        </div>
        <div class="input-row">
            <div class="input-group">
                <label>Category</label>
                <select id="edit_service_category">
                    <option value="repair" ${data.service_category === 'repair' ? 'selected' : ''}>Repair</option>
                    <option value="assembly" ${data.service_category === 'assembly' ? 'selected' : ''}>Assembly</option>
                    <option value="upgrade" ${data.service_category === 'upgrade' ? 'selected' : ''}>Upgrade</option>
                    <option value="software" ${data.service_category === 'software' ? 'selected' : ''}>Software</option>
                    <option value="recovery" ${data.service_category === 'recovery' ? 'selected' : ''}>Recovery</option>
                    <option value="maintenance" ${data.service_category === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                </select>
            </div>
            <div class="input-group">
                <label>Duration</label>
                <input id="edit_service_duration" value="${escapeHtml(data.service_duration || '')}" placeholder="e.g. 2-3 hours">
            </div>
        </div>
        <div class="input-group">
            <label>Price (RM)</label>
            <input type="number" id="edit_service_price" value="${data.service_price || 0}" step="0.01" min="0">
        </div>
    `;
}

function generateServiceOrderFields(data) {
    const order = data;
    return `
        <div class="input-group">
            <label>Order ID</label>
            <input value="#${order.order_id}" disabled style="background:#f5f5f5;">
        </div>
        <div class="input-row">
            <div class="input-group">
                <label>Customer Phone</label>
                <input id="edit_contact_phone" value="${escapeHtml(order.contact_phone || '')}">
            </div>
            <div class="input-group">
                <label>Device Model</label>
                <input id="edit_device_model" value="${escapeHtml(order.device_model || '')}">
            </div>
        </div>
        <div class="input-group">
            <label>Device Issue</label>
            <textarea id="edit_device_issue">${escapeHtml(order.device_issue || '')}</textarea>
        </div>
        <div class="input-group">
            <label>Address</label>
            <textarea id="edit_address">${escapeHtml(order.address || '')}</textarea>
        </div>
        <div class="input-row">
            <div class="input-group">
                <label>Preferred Date</label>
                <input type="date" id="edit_preferred_date" value="${order.preferred_date || ''}">
            </div>
            <div class="input-group">
                <label>Preferred Time</label>
                <input id="edit_preferred_time" value="${escapeHtml(order.preferred_time || '')}">
            </div>
        </div>
        <div class="input-row">
            <div class="input-group">
                <label>Status</label>
                <select id="edit_order_status">
                    <option value="PENDING" ${order.order_status === 'PENDING' ? 'selected' : ''}>PENDING</option>
                    <option value="CONFIRMED" ${order.order_status === 'CONFIRMED' ? 'selected' : ''}>CONFIRMED</option>
                    <option value="IN_PROGRESS" ${order.order_status === 'IN_PROGRESS' ? 'selected' : ''}>IN PROGRESS</option>
                    <option value="COMPLETED" ${order.order_status === 'COMPLETED' ? 'selected' : ''}>COMPLETED</option>
                    <option value="CANCELLED" ${order.order_status === 'CANCELLED' ? 'selected' : ''}>CANCELLED</option>
                </select>
            </div>
            <div class="input-group">
                <label>Assigned Staff</label>
                <select id="edit_assigned_staff_id"><option value="">Unassigned</option></select>
            </div>
        </div>
        <div class="input-group">
            <label>Notes</label>
            <textarea id="edit_notes">${escapeHtml(order.notes || '')}</textarea>
        </div>
    `;
}

function generatePaymentOrderFields(data) {
    const payment = data;
    return `
        <div class="input-group">
            <label>Payment ID</label>
            <input value="#${payment.payment_id}" disabled style="background:#f5f5f5;">
        </div>
        <div class="input-row">
            <div class="input-group">
                <label>User</label>
                <select id="edit_user_id"><option value="">Guest</option></select>
            </div>
            <div class="input-group">
                <label>Total Amount (RM)</label>
                <input type="number" id="edit_total_amount" value="${payment.total_amount || 0}" step="0.01" min="0">
            </div>
        </div>
        <div class="input-row">
            <div class="input-group">
                <label>Payment Method</label>
                <select id="edit_payment_method">
                    <option value="cash" ${payment.payment_method === 'cash' ? 'selected' : ''}>Cash on Delivery</option>
                    <option value="card" ${payment.payment_method === 'card' ? 'selected' : ''}>Online Payment</option>
                </select>
            </div>
            <div class="input-group">
                <label>Status</label>
                <select id="edit_payment_status">
                    <option value="PENDING" ${payment.payment_status === 'PENDING' ? 'selected' : ''}>PENDING</option>
                    <option value="PAID" ${payment.payment_status === 'PAID' ? 'selected' : ''}>PAID</option>
                </select>
            </div>
        </div>
        <div style="margin-top:15px;">
            <button type="button" id="downloadReceiptBtn" style="width:100%;padding:12px;background:#1a1a2e;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;">
                <i class="fas fa-download"></i> Download Receipt (PDF)
            </button>
        </div>
    `;
}

// ============================================
// MODAL EVENT LISTENERS
// ============================================

function setupModalEventListeners(overlay, mode, type, data, callbacks) {
    // Cancel button
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() { overlay.remove(); });
    }
    
    // Click outside to close
    overlay.addEventListener('click', function(e) { 
        if (e.target === overlay) overlay.remove(); 
    });

    // Payment order download receipt
    if (type === 'payment_order') {
        setTimeout(function() {
            const downloadBtn = document.getElementById('downloadReceiptBtn');
            if (downloadBtn && window.downloadPaymentReceipt) {
                downloadBtn.addEventListener('click', function() {
                    window.downloadPaymentReceipt(data.payment_id);
                });
            }
        }, 300);
    }

    // Service order - load staff
    if (type === 'service_order') {
        setTimeout(async function() {
            const select = document.getElementById('edit_assigned_staff_id');
            if (select) {
                try {
                    const users = await supabase.from('users').select('user_id, full_name, email, role');
                    if (users && Array.isArray(users)) {
                        users.forEach(function(u) {
                            if (u.role === 'STAFF' || u.role === 'ADMIN') {
                                const opt = document.createElement('option');
                                opt.value = u.user_id;
                                opt.textContent = '#${u.user_id} - ${u.full_name || u.email}';
                                if (u.user_id === data.assigned_staff_id) opt.selected = true;
                                select.appendChild(opt);
                            }
                        });
                    }
                } catch (e) { 
                    console.error('Failed to load staff:', e); 
                }
            }
        }, 100);
    }

    // Payment order - load users
    if (type === 'payment_order') {
        setTimeout(async function() {
            const select = document.getElementById('edit_user_id');
            if (select) {
                try {
                    const users = await supabase.from('users').select('user_id, full_name, email').order('user_id');
                    if (users && Array.isArray(users)) {
                        users.forEach(function(u) {
                            const opt = document.createElement('option');
                            opt.value = u.user_id;
                            opt.textContent = `#${u.user_id} - ${u.full_name || u.email || 'Unknown'}`;
                            if (u.user_id === data.user_id) opt.selected = true;
                            select.appendChild(opt);
                        });
                    }
                } catch (e) { 
                    console.error('Failed to load users:', e); 
                }
            }
        }, 100);
    }

    // Save button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async function() {
            // Validate users phone
            if (type === 'users') {
                const phoneNumber = document.getElementById('edit_phone_number')?.value?.trim();
                if (phoneNumber) {
                    const cleanNumber = phoneNumber.replace(/[\s\-\.]/g, '');
                    if (cleanNumber.length < 7) {
                        const errorEl = document.getElementById('phoneError');
                        if (errorEl) {
                            errorEl.textContent = 'Phone number too short (minimum 7 digits)';
                            errorEl.style.display = 'block';
                        }
                        return;
                    }
                    if (cleanNumber.length > 15) {
                        const errorEl = document.getElementById('phoneError');
                        if (errorEl) {
                            errorEl.textContent = 'Phone number too long (maximum 15 digits)';
                            errorEl.style.display = 'block';
                        }
                        return;
                    }
                }
            }

            // For inventory, validate the form
            if (type === 'inventory') {
                const validation = validateInventoryForm();
                if (!validation.valid) {
                    showValidationDialog(validation, null, null);
                    return;
                }
                
                if (validation.warnings.length > 0) {
                    if (saveBtn) {
                        saveBtn.disabled = true;
                        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating...';
                    }
                    
                    showValidationDialog(validation, async function() {
                        if (saveBtn) {
                            saveBtn.disabled = false;
                            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
                        }
                        if (typeof callbacks.onSave === 'function') {
                            await callbacks.onSave(overlay);
                        }
                    }, function() {
                        if (saveBtn) {
                            saveBtn.disabled = false;
                            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
                        }
                    });
                    return;
                }
            }

            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            }

            if (typeof callbacks.onSave === 'function') {
                await callbacks.onSave(overlay);
            }
        });
    }

    // Delete button
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            if (deleteBtn) {
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            }
            if (typeof callbacks.onDelete === 'function') {
                await callbacks.onDelete(overlay);
            }
        });
    }
}

// ============================================
// CONFIRMATION DIALOGS
// ============================================

export function showConfirmSave(callback) {
    return showConfirmDialog('save', callback);
}

export function showConfirmDelete(callback) {
    return showConfirmDialog('delete', callback);
}

function showConfirmDialog(type, callback) {
    return new Promise(function(resolve) {
        var isDelete = type === 'delete';
        var icon = isDelete ? 'trash-alt' : 'exclamation-triangle';
        var iconColor = isDelete ? '#f44336' : '#ff9800';
        var bgColor = isDelete ? '#ffebee' : '#fff3e0';
        var btnClass = isDelete ? 'danger-btn' : 'warn-btn';
        var btnText = isDelete ? 'Yes, Delete' : 'Yes, Save';
        var title = isDelete ? 'Delete Record' : 'Confirm Changes';
        var message = isDelete ? 
            'You are about to <strong style="color:#f44336;">permanently delete</strong> this record. This action CANNOT be undone!' :
            'You are about to <strong>modify</strong> data in the database. This action can affect the entire system. Are you sure?';
        
        var overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
        `;
        
        overlay.innerHTML = `
            <div class="confirm-popup">
                <div class="icon-circle ${isDelete ? 'danger' : 'warning'}">
                    <i class="fas fa-${icon}"></i>
                </div>
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="confirm-buttons">
                    <button id="confirmCancelBtn" class="btn-confirm-cancel">Cancel</button>
                    <button id="confirmActionBtn" class="btn-${isDelete ? 'confirm-danger' : 'confirm-warn'}">${btnText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        document.getElementById('confirmCancelBtn').onclick = function() {
            overlay.remove();
            resolve(false);
        };
        
        document.getElementById('confirmActionBtn').onclick = function() {
            overlay.remove();
            if (typeof callback === 'function') callback();
            resolve(true);
        };
        
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
    });
}

// ============================================
// DATABASE OPERATIONS
// ============================================

export async function performSave(type, mode, data, supabase) {
    console.log('🔄 performSave called:', { type, mode, data });

    try {
        var result = null;

        if (type === 'users') {
            result = await saveUser(mode, data, supabase);
        } else if (type === 'inventory') {
            result = await saveInventory(mode, data, supabase);
        } else if (type === 'service_order') {
            result = await saveServiceOrder(mode, data, supabase);
        } else if (type === 'payment_order') {
            result = await savePaymentOrder(mode, data, supabase);
        } else if (type === 'services') {
            result = await saveService(mode, data, supabase);
        }

        if (result && result.error) {
            console.error('❌ Database error:', result.error);
            showToast('Failed to save! ' + (result.error.message || 'Unknown error'), 'error');
            return false;
        }

        console.log('✅ Save successful!', result);
        showToast('Saved successfully!', 'success');
        return result?.data || true;

    } catch (e) {
        console.error('❌ Save failed with exception:', e);
        showToast('Failed to save! ' + (e.message || 'Unknown error'), 'error');
        return false;
    }
}

async function saveUser(mode, data, supabase) {
    var fullNameEl = document.getElementById('edit_full_name');
    var emailEl = document.getElementById('edit_email');
    var phoneCodeEl = document.getElementById('edit_phone_code');
    var phoneNumberEl = document.getElementById('edit_phone_number');
    var roleEl = document.getElementById('edit_role');
    var addressEl = document.getElementById('edit_address');

    var phone = null;
    if (phoneNumberEl && phoneNumberEl.value.trim()) {
        var code = phoneCodeEl ? phoneCodeEl.value : '+60';
        var number = phoneNumberEl.value.trim().replace(/[\s\-\.]/g, '');
        if (number.length >= 7) {
            phone = code + number;
        } else {
            phone = data.phone || null;
        }
    }

    var updates = {
        full_name: fullNameEl ? (fullNameEl.value.trim() || '') : (data.full_name || ''),
        email: emailEl ? (emailEl.value.trim() || '') : (data.email || ''),
        phone: phone,
        role: roleEl ? (roleEl.value || 'USER') : (data.role || 'USER'),
        address: addressEl ? (addressEl.value.trim() || null) : (data.address || null)
    };

    if (mode === 'new') {
        return await supabase.from('users').insert(updates).select();
    } else {
        return await supabase.from('users').update(updates).eq('user_id', data.user_id);
    }
}

async function saveInventory(mode, data, supabase) {
    var nameEl = document.getElementById('edit_i_name');
    var categoryEl = document.getElementById('edit_i_category');
    var brandEl = document.getElementById('edit_i_brand');
    var priceEl = document.getElementById('edit_i_price');
    var quantityEl = document.getElementById('edit_i_quantity');

    if (!nameEl || !categoryEl) {
        console.error('❌ Form elements not found for inventory!');
        showToast('Error: Form fields not found', 'error');
        return { error: new Error('Form fields not found') };
    }

    var item = {
        i_name: nameEl.value.trim() || data.i_name || '',
        i_category: categoryEl.value || data.i_category || 'cpu',
        i_brand: brandEl ? (brandEl.value.trim() || null) : (data.i_brand || null),
        i_price: priceEl ? (parseFloat(priceEl.value) || 0) : (data.i_price || 0),
        i_quantity: quantityEl ? (parseInt(quantityEl.value) || 0) : (data.i_quantity || 0)
    };

    console.log('📦 Inventory item to save:', item);

    if (mode === 'new') {
        console.log('🆕 Inserting new inventory item...');
        return await supabase.from('inventory').insert(item).select('*');
    } else {
        console.log('✏️ Updating inventory item:', data.i_id);
        return await supabase.from('inventory').update(item).eq('i_id', data.i_id).select('*');
    }
}

async function saveServiceOrder(mode, data, supabase) {
    var staffId = document.getElementById('edit_assigned_staff_id')?.value;
    var updates = {
        contact_phone: document.getElementById('edit_contact_phone')?.value || '',
        device_model: document.getElementById('edit_device_model')?.value || '',
        device_issue: document.getElementById('edit_device_issue')?.value || null,
        address: document.getElementById('edit_address')?.value || '',
        preferred_date: document.getElementById('edit_preferred_date')?.value || null,
        preferred_time: document.getElementById('edit_preferred_time')?.value || null,
        order_status: document.getElementById('edit_order_status')?.value || 'PENDING',
        assigned_staff_id: (staffId && staffId !== '') ? parseInt(staffId) : null,
        notes: document.getElementById('edit_notes')?.value || null,
        updated_at: new Date().toISOString()
    };

    if (mode === 'new') {
        return await supabase.from('service_orders').insert(updates).select();
    } else {
        return await supabase.from('service_orders').update(updates).eq('order_id', data.order_id);
    }
}

async function savePaymentOrder(mode, data, supabase) {
    var userId = document.getElementById('edit_user_id')?.value;
    var amount = document.getElementById('edit_total_amount')?.value;
    var updates = {
        user_id: (userId && userId !== '') ? parseInt(userId) : null,
        total_amount: (amount && amount !== '') ? parseFloat(amount) : 0,
        payment_method: document.getElementById('edit_payment_method')?.value || 'cash',
        payment_status: document.getElementById('edit_payment_status')?.value || 'PENDING'
    };

    if (mode === 'new') {
        return await supabase.from('payment').insert(updates).select();
    } else {
        return await supabase.from('payment').update(updates).eq('payment_id', data.payment_id);
    }
}

async function saveService(mode, data, supabase) {
    var nameEl = document.getElementById('edit_service_name');
    var categoryEl = document.getElementById('edit_service_category');
    var durationEl = document.getElementById('edit_service_duration');
    var priceEl = document.getElementById('edit_service_price');

    var item = {
        service_name: nameEl ? (nameEl.value.trim() || '') : (data.service_name || ''),
        service_category: categoryEl ? (categoryEl.value || 'repair') : (data.service_category || 'repair'),
        service_duration: durationEl ? (durationEl.value.trim() || null) : (data.service_duration || null),
        service_price: priceEl ? (parseFloat(priceEl.value) || 0) : (data.service_price || 0)
    };

    if (mode === 'new') {
        return await supabase.from('service').insert(item).select();
    } else {
        return await supabase.from('service').update(item).eq('service_id', data.service_id);
    }
}

export async function performDelete(type, data, supabase) {
    console.log('🗑️ performDelete:', type, 'data:', data);
    try {
        var result = null;
        var tableMap = {
            'users': 'users',
            'service_order': 'service_orders',
            'payment_order': 'payment',
            'inventory': 'inventory',
            'services': 'service'
        };
        
        var idMap = {
            'users': 'user_id',
            'service_order': 'order_id',
            'payment_order': 'payment_id',
            'inventory': 'i_id',
            'services': 'service_id'
        };
        
        if (tableMap[type] && idMap[type]) {
            result = await supabase.from(tableMap[type]).delete().eq(idMap[type], data[idMap[type]]);
        }

        if (result && result.error) {
            console.error('❌ Delete error:', result.error);
            showToast('Failed to delete! ' + (result.error.message || 'Unknown error'), 'error');
            return false;
        }

        showToast('Deleted successfully!', 'success');
        return true;
    } catch (e) {
        console.error('❌ Delete failed:', e);
        showToast('Failed to delete! ' + (e.message || 'Unknown error'), 'error');
        return false;
    }
}