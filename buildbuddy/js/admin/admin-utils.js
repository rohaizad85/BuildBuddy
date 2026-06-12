import supabase from '../supabase-client.js';

// Country codes list
const countryCodes = [
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

// ===== MODALS =====
export function showEditModal(title, data, type, mode, callbacks) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    let fieldsHTML = '';
    if (type === 'users') {
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
        
        const codeOptions = countryCodes.map(c => 
            `<option value="${c.code}" ${c.code === existingCode ? 'selected' : ''}>${c.code} (${c.name})</option>`
        ).join('');
        
        fieldsHTML = `
            <div class="input-group"><label>Full Name</label><input id="edit_full_name" value="${escapeHtml(data.full_name||'')}" placeholder="Enter full name"></div>
            <div class="input-group"><label>Email</label><input type="email" id="edit_email" value="${escapeHtml(data.email||'')}" placeholder="Enter email address"></div>
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
            <div class="input-group"><label>Role</label><select id="edit_role"><option value="USER" ${data.role==='USER'?'selected':''}>USER</option><option value="STAFF" ${data.role==='STAFF'?'selected':''}>STAFF</option><option value="ADMIN" ${data.role==='ADMIN'?'selected':''}>ADMIN</option></select></div>
            <div class="input-group"><label>Address</label><textarea id="edit_address" placeholder="Enter shipping address">${escapeHtml(data.address||'')}</textarea></div>`;
            
    } else if (type === 'inventory') {
        fieldsHTML = `
            <div class="input-group"><label>Name</label><input id="edit_i_name" value="${escapeHtml(data.i_name||'')}" placeholder="Enter product name"></div>
            <div class="input-row">
                <div class="input-group"><label>Category</label><select id="edit_i_category">
                    <option value="cpu" ${data.i_category==='cpu'?'selected':''}>CPU</option>
                    <option value="motherboard" ${data.i_category==='motherboard'?'selected':''}>Motherboard</option>
                    <option value="ram" ${data.i_category==='ram'?'selected':''}>RAM</option>
                    <option value="gpu" ${data.i_category==='gpu'?'selected':''}>GPU</option>
                    <option value="storage" ${data.i_category==='storage'?'selected':''}>Storage</option>
                    <option value="psu" ${data.i_category==='psu'?'selected':''}>PSU</option>
                    <option value="cooler" ${data.i_category==='cooler'?'selected':''}>Cooler</option>
                </select></div>
                <div class="input-group"><label>Brand</label><input id="edit_i_brand" value="${escapeHtml(data.i_brand||'')}" placeholder="Enter brand name"></div>
            </div>
            <div class="input-row">
                <div class="input-group"><label>Price (RM)</label><input type="number" id="edit_i_price" value="${data.i_price||0}" step="0.01" min="0"></div>
                <div class="input-group"><label>Stock</label><input type="number" id="edit_i_quantity" value="${data.i_quantity||0}" min="0"></div>
            </div>`;
    } else if (type === 'services') {
        fieldsHTML = `
            <div class="input-group"><label>Name</label><input id="edit_service_name" value="${escapeHtml(data.service_name||'')}" placeholder="Enter service name"></div>
            <div class="input-row">
                <div class="input-group"><label>Category</label><select id="edit_service_category"><option value="repair" ${data.service_category==='repair'?'selected':''}>Repair</option><option value="assembly" ${data.service_category==='assembly'?'selected':''}>Assembly</option><option value="upgrade" ${data.service_category==='upgrade'?'selected':''}>Upgrade</option><option value="software" ${data.service_category==='software'?'selected':''}>Software</option><option value="recovery" ${data.service_category==='recovery'?'selected':''}>Recovery</option><option value="maintenance" ${data.service_category==='maintenance'?'selected':''}>Maintenance</option></select></div>
                <div class="input-group"><label>Duration</label><input id="edit_service_duration" value="${escapeHtml(data.service_duration||'')}" placeholder="e.g. 2-3 hours"></div>
            </div>
            <div class="input-group"><label>Price (RM)</label><input type="number" id="edit_service_price" value="${data.service_price||0}" step="0.01" min="0"></div>`;
    } else if (type === 'service_order') {
        const order = data;
        fieldsHTML = `
            <div class="input-group"><label>Order ID</label><input value="#${order.order_id}" disabled style="background:#f5f5f5;"></div>
            <div class="input-row">
                <div class="input-group"><label>Customer Phone</label><input id="edit_contact_phone" value="${escapeHtml(order.contact_phone||'')}"></div>
                <div class="input-group"><label>Device Model</label><input id="edit_device_model" value="${escapeHtml(order.device_model||'')}"></div>
            </div>
            <div class="input-group"><label>Device Issue</label><textarea id="edit_device_issue">${escapeHtml(order.device_issue||'')}</textarea></div>
            <div class="input-group"><label>Address</label><textarea id="edit_address">${escapeHtml(order.address||'')}</textarea></div>
            <div class="input-row">
                <div class="input-group"><label>Preferred Date</label><input type="date" id="edit_preferred_date" value="${order.preferred_date||''}"></div>
                <div class="input-group"><label>Preferred Time</label><input id="edit_preferred_time" value="${escapeHtml(order.preferred_time||'')}"></div>
            </div>
            <div class="input-row">
                <div class="input-group"><label>Status</label><select id="edit_order_status">
                    <option value="PENDING" ${order.order_status==='PENDING'?'selected':''}>PENDING</option>
                    <option value="CONFIRMED" ${order.order_status==='CONFIRMED'?'selected':''}>CONFIRMED</option>
                    <option value="IN_PROGRESS" ${order.order_status==='IN_PROGRESS'?'selected':''}>IN PROGRESS</option>
                    <option value="COMPLETED" ${order.order_status==='COMPLETED'?'selected':''}>COMPLETED</option>
                    <option value="CANCELLED" ${order.order_status==='CANCELLED'?'selected':''}>CANCELLED</option>
                </select></div>
                <div class="input-group"><label>Assigned Staff</label><select id="edit_assigned_staff_id"><option value="">Unassigned</option></select></div>
            </div>
            <div class="input-group"><label>Notes</label><textarea id="edit_notes">${escapeHtml(order.notes||'')}</textarea></div>`;
            
        setTimeout(async () => {
            const select = document.getElementById('edit_assigned_staff_id');
            if (select) {
                try {
                    const users = await supabase.from('users').select('user_id, full_name, email, role');
                    if (users && Array.isArray(users)) {
                        users.forEach(u => {
                            if (u.role === 'STAFF' || u.role === 'ADMIN') {
                                const opt = document.createElement('option');
                                opt.value = u.user_id;
                                opt.textContent = `#${u.user_id} - ${u.full_name || u.email}`;
                                if (u.user_id === order.assigned_staff_id) opt.selected = true;
                                select.appendChild(opt);
                            }
                        });
                    }
                } catch (e) { console.error('Failed to load staff:', e); }
            }
        }, 100);
    } else if (type === 'payment_order') {
        const payment = data;
        fieldsHTML = `
            <div class="input-group"><label>Payment ID</label><input value="#${payment.payment_id}" disabled style="background:#f5f5f5;"></div>
            <div class="input-row">
                <div class="input-group"><label>User</label><select id="edit_user_id"><option value="">Guest</option></select></div>
                <div class="input-group"><label>Total Amount (RM)</label><input type="number" id="edit_total_amount" value="${payment.total_amount||0}" step="0.01" min="0"></div>
            </div>
            <div class="input-row">
                <div class="input-group"><label>Payment Method</label><select id="edit_payment_method">
                    <option value="cash" ${payment.payment_method==='cash'?'selected':''}>Cash on Delivery</option>
                    <option value="card" ${payment.payment_method==='card'?'selected':''}>Online Payment</option>
                </select></div>
                <div class="input-group"><label>Status</label><select id="edit_payment_status">
                    <option value="PENDING" ${payment.payment_status==='PENDING'?'selected':''}>PENDING</option>
                    <option value="PAID" ${payment.payment_status==='PAID'?'selected':''}>PAID</option>
                </select></div>
            </div>
            <div style="margin-top:15px;">
                <button type="button" id="downloadReceiptBtn" style="width:100%;padding:12px;background:#1a1a2e;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;">
                    <i class="fas fa-download"></i> Download Receipt (PDF)
                </button>
            </div>`;
            
        setTimeout(async () => {
            const select = document.getElementById('edit_user_id');
            if (select) {
                try {
                    const users = await supabase.from('users').select('user_id, full_name, email').order('user_id');
                    if (users && Array.isArray(users)) {
                        users.forEach(u => {
                            const opt = document.createElement('option');
                            opt.value = u.user_id;
                            opt.textContent = `#${u.user_id} - ${u.full_name || u.email || 'Unknown'}`;
                            if (u.user_id === payment.user_id) opt.selected = true;
                            select.appendChild(opt);
                        });
                    }
                } catch (e) { console.error('Failed to load users:', e); }
            }
        }, 100);
    } else {
        fieldsHTML = `<p style="color:#666;padding:20px 0;">Viewing details.</p>`;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modern-modal';
    modal.innerHTML = `
        <div class="modal-header-bar">
            <i class="fas fa-${mode==='new'?'plus-circle':'edit'}"></i>
            <h3>${title}</h3>
        </div>
        <div class="modal-body">${fieldsHTML}</div>
        <div class="modal-footer">
            ${mode!=='new'?`<button class="btn-delete" id="deleteBtn"><i class="fas fa-trash-alt"></i> Delete</button>`:''}
            <button class="btn-cancel" id="cancelBtn">Cancel</button>
            <button class="btn-save" id="saveBtn"><i class="fas fa-save"></i> Save</button>
        </div>`;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    document.getElementById('cancelBtn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    
    // Download receipt button for payment orders
    if (type === 'payment_order') {
        setTimeout(() => {
            const downloadBtn = document.getElementById('downloadReceiptBtn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', () => {
                    if (window.downloadPaymentReceipt) {
                        window.downloadPaymentReceipt(data.payment_id);
                    }
                });
            }
        }, 300);
    }
    
    document.getElementById('saveBtn').addEventListener('click', async () => {
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
        
        document.getElementById('saveBtn').disabled = true;
        document.getElementById('saveBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        if (callbacks.onSave) await callbacks.onSave(overlay);
    });
    
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            document.getElementById('deleteBtn').disabled = true;
            document.getElementById('deleteBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            if (callbacks.onDelete) await callbacks.onDelete(overlay);
        });
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function showConfirmSave(callback) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10001;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `<div style="background:white;border-radius:16px;padding:30px;max-width:420px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <i class="fas fa-exclamation-triangle" style="font-size:48px;color:#ff9800;margin-bottom:15px;"></i>
            <h3 style="color:#1a1a2e;margin-bottom:10px;">⚠️ Confirm Changes</h3>
            <p style="color:#666;margin-bottom:10px;">You are about to <strong>modify</strong> data in the database.</p>
            <p style="color:#f44336;font-size:13px;margin-bottom:20px;">This action can affect the entire system. Are you sure?</p>
            <div style="display:flex;gap:10px;">
                <button id="confirmCancelBtn" style="flex:1;padding:12px;border:1px solid #e0e0e0;background:white;border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
                <button id="confirmSaveBtn" style="flex:1;padding:12px;border:none;background:#ff9800;color:white;border-radius:8px;cursor:pointer;font-weight:600;">Yes, Save</button>
            </div></div>`;
        document.body.appendChild(overlay);
        
        document.getElementById('confirmSaveBtn').onclick = () => { 
            overlay.remove(); 
            callback(); 
            resolve(true); 
        };
        document.getElementById('confirmCancelBtn').onclick = () => { 
            overlay.remove(); 
            resolve(false); 
        };
    });
}

export function showConfirmDelete(callback) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10001;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `<div style="background:white;border-radius:16px;padding:30px;max-width:420px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <i class="fas fa-trash-alt" style="font-size:48px;color:#f44336;margin-bottom:15px;"></i>
            <h3 style="color:#1a1a2e;margin-bottom:10px;">🗑️ Delete Record</h3>
            <p style="color:#666;margin-bottom:10px;">You are about to <strong style="color:#f44336;">permanently delete</strong> this record.</p>
            <p style="color:#f44336;font-size:13px;margin-bottom:20px;">This action CANNOT be undone!</p>
            <div style="display:flex;gap:10px;">
                <button id="confirmCancelBtn" style="flex:1;padding:12px;border:1px solid #e0e0e0;background:white;border-radius:8px;cursor:pointer;font-weight:600;">Cancel</button>
                <button id="confirmDeleteBtn" style="flex:1;padding:12px;border:none;background:#f44336;color:white;border-radius:8px;cursor:pointer;font-weight:600;">Yes, Delete</button>
            </div></div>`;
        document.body.appendChild(overlay);
        
        document.getElementById('confirmDeleteBtn').onclick = () => { 
            overlay.remove(); 
            callback(); 
            resolve(true); 
        };
        document.getElementById('confirmCancelBtn').onclick = () => { 
            overlay.remove(); 
            resolve(false); 
        };
    });
}

export function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;top:20px;right:20px;padding:14px 24px;border-radius:10px;color:white;font-weight:600;z-index:99999;animation:slideIn 0.3s ease;background:${type==='success'?'#4CAF50':'#f44336'};`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
}

export function formatDate(d) {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
}

export async function performSave(type, mode, data, supabase) {
    console.log('performSave:', type, mode);
    console.log('Original data:', JSON.parse(JSON.stringify(data)));
    
    try {
        if (type === 'users') {
            const fullNameEl = document.getElementById('edit_full_name');
            const emailEl = document.getElementById('edit_email');
            const phoneCodeEl = document.getElementById('edit_phone_code');
            const phoneNumberEl = document.getElementById('edit_phone_number');
            const roleEl = document.getElementById('edit_role');
            const addressEl = document.getElementById('edit_address');
            
            console.log('DOM check - fullName:', fullNameEl?.value, 'email:', emailEl?.value);
            
            let phone = null;
            if (phoneNumberEl && phoneNumberEl.value.trim()) {
                const code = phoneCodeEl ? phoneCodeEl.value : '+60';
                const number = phoneNumberEl.value.trim().replace(/[\s\-\.]/g, '');
                if (number.length >= 7) {
                    phone = `${code}${number}`;
                } else {
                    phone = data.phone || null;
                }
            } else {
                phone = null;
            }
            
            const updates = {
                full_name: fullNameEl ? (fullNameEl.value.trim() || '') : (data.full_name || ''),
                email: emailEl ? (emailEl.value.trim() || '') : (data.email || ''),
                phone: phone,
                role: roleEl ? (roleEl.value || 'USER') : (data.role || 'USER'),
                address: addressEl ? (addressEl.value.trim() || null) : (data.address || null)
            };
            
            console.log('Final user updates:', updates);
            await supabase.from('users').update(updates).eq('user_id', data.user_id);
            
        } else if (type === 'inventory') {
            const nameEl = document.getElementById('edit_i_name');
            const categoryEl = document.getElementById('edit_i_category');
            const brandEl = document.getElementById('edit_i_brand');
            const priceEl = document.getElementById('edit_i_price');
            const quantityEl = document.getElementById('edit_i_quantity');
            
            console.log('DOM check - name:', nameEl?.value, 'category:', categoryEl?.value, 'brand:', brandEl?.value, 'price:', priceEl?.value, 'qty:', quantityEl?.value);
            
            if (!nameEl || !categoryEl) {
                console.error('Form elements not found for inventory!');
                showToast('Error: Form fields not found', 'error');
                return false;
            }
            
            const item = {
                i_name: nameEl.value.trim() || data.i_name || '',
                i_category: categoryEl.value || data.i_category || 'cpu',
                i_brand: brandEl ? (brandEl.value.trim() || null) : (data.i_brand || null),
                i_price: priceEl ? (parseFloat(priceEl.value) || 0) : (data.i_price || 0),
                i_quantity: quantityEl ? (parseInt(quantityEl.value) || 0) : (data.i_quantity || 0)
            };
            
            console.log('Final inventory item:', item);
            
            if (mode === 'new') {
                await supabase.from('inventory').insert(item);
            } else {
                await supabase.from('inventory').update(item).eq('i_id', data.i_id);
            }
            
        } else if (type === 'service_order') {
            const staffId = document.getElementById('edit_assigned_staff_id')?.value;
            const updates = {
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
            console.log('Service order updates:', updates);
            await supabase.from('service_orders').update(updates).eq('order_id', data.order_id);
            
        } else if (type === 'payment_order') {
            const userId = document.getElementById('edit_user_id')?.value;
            const amount = document.getElementById('edit_total_amount')?.value;
            const updates = {
                user_id: (userId && userId !== '') ? parseInt(userId) : null,
                total_amount: (amount && amount !== '') ? parseFloat(amount) : 0,
                payment_method: document.getElementById('edit_payment_method')?.value || 'cash',
                payment_status: document.getElementById('edit_payment_status')?.value || 'PENDING'
            };
            console.log('Payment updates:', updates);
            await supabase.from('payment').update(updates).eq('payment_id', data.payment_id);
            
        } else if (type === 'services') {
            const nameEl = document.getElementById('edit_service_name');
            const categoryEl = document.getElementById('edit_service_category');
            const durationEl = document.getElementById('edit_service_duration');
            const priceEl = document.getElementById('edit_service_price');
            
            const item = {
                service_name: nameEl ? (nameEl.value.trim() || '') : (data.service_name || ''),
                service_category: categoryEl ? (categoryEl.value || 'repair') : (data.service_category || 'repair'),
                service_duration: durationEl ? (durationEl.value.trim() || null) : (data.service_duration || null),
                service_price: priceEl ? (parseFloat(priceEl.value) || 0) : (data.service_price || 0)
            };
            
            console.log('Service item:', item, 'mode:', mode);
            
            if (mode === 'new') {
                await supabase.from('service').insert(item);
            } else {
                await supabase.from('service').update(item).eq('service_id', data.service_id);
            }
        }
        
        showToast('Saved successfully!', 'success');
        return true;
    } catch (e) {
        console.error('Save failed:', e);
        showToast('Failed to save! ' + (e.message || 'Unknown error'), 'error');
        return false;
    }
}

export async function performDelete(type, data, supabase) {
    console.log('performDelete:', type, 'data:', data);
    try {
        if (type === 'users') await supabase.from('users').delete().eq('user_id', data.user_id);
        else if (type === 'service_order') await supabase.from('service_orders').delete().eq('order_id', data.order_id);
        else if (type === 'payment_order') await supabase.from('payment').delete().eq('payment_id', data.payment_id);
        else if (type === 'inventory') await supabase.from('inventory').delete().eq('i_id', data.i_id);
        else if (type === 'services') await supabase.from('service').delete().eq('service_id', data.service_id);
        showToast('Deleted successfully!', 'success');
        return true;
    } catch (e) {
        console.error('Delete failed:', e);
        showToast('Failed to delete! ' + (e.message || 'Unknown error'), 'error');
        return false;
    }
}