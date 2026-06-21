// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\cart-utils.js

import supabase from './supabase-client.js';
import dataService from './data-service.js';

// ============================================
// USER FUNCTIONS
// ============================================

export function getUser() {
    const user = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
    if (!user) return null;
    try {
        return JSON.parse(user);
    } catch {
        return null;
    }
}

// ============================================
// LOCAL CART FUNCTIONS
// ============================================

export function getLocalCart() {
    try {
        return JSON.parse(localStorage.getItem('buildbuddy_cart')) || [];
    } catch {
        return [];
    }
}

export function saveLocalCart(cart) {
    localStorage.setItem('buildbuddy_cart', JSON.stringify(cart || []));
}

export function clearLocalCart() {
    localStorage.removeItem('buildbuddy_cart');
}

export function getCartCount() {
    const cart = getLocalCart();
    return cart.reduce((total, item) => total + (item.quantity || 1), 0);
}

export function updateCartCountDisplay() {
    const count = getCartCount();
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = count;
    });
    return count;
}

// ============================================
// ADD TO CART FUNCTIONS
// ============================================

export async function addToCart(type, id, name, price, quantity = 1) {
    console.log('🔄 Adding to cart:', { type, id, name, price, quantity });

    const localCart = getLocalCart();
    const existingIndex = localCart.findIndex(item => item.type === type && item.id === id);

    if (existingIndex >= 0) {
        localCart[existingIndex].quantity = (localCart[existingIndex].quantity || 1) + quantity;
    } else {
        localCart.push({
            type: type,
            id: id,
            name: name,
            price: price,
            quantity: quantity
        });
    }
    saveLocalCart(localCart);

    updateCartCountDisplay();

    const user = getUser();
    if (user) {
        try {
            await syncLocalCartToDatabase();
        } catch (error) {
            console.error('Sync error:', error);
        }
    }

    return localCart;
}

export async function addBundleToCart(bundleId, quantity = 1) {
    try {
        const { data: bundle, error } = await supabase
            .from('bundles')
            .select('*')
            .eq('bundle_id', bundleId)
            .single();

        if (error || !bundle) {
            console.error('Error fetching bundle:', error);
            return false;
        }

        const localCart = getLocalCart();
        const existingIndex = localCart.findIndex(item => item.type === 'bundle' && item.id === bundleId);

        if (existingIndex >= 0) {
            localCart[existingIndex].quantity = (localCart[existingIndex].quantity || 1) + quantity;
        } else {
            localCart.push({
                type: 'bundle',
                id: bundleId,
                name: bundle.bundle_name,
                price: bundle.bundle_price,
                quantity: quantity
            });
        }
        saveLocalCart(localCart);

        updateCartCountDisplay();

        const user = getUser();
        if (user) {
            await syncLocalCartToDatabase();
        }

        return true;
    } catch (error) {
        console.error('Error adding bundle to cart:', error);
        return false;
    }
}

// ============================================
// SYNC FUNCTIONS
// ============================================

export async function syncLocalCartToDatabase() {
    const user = getUser();
    if (!user) {
        return;
    }

    try {
        await dataService.ensureInitialized();

        const localCart = getLocalCart();
        if (localCart.length === 0) {
            return;
        }

        let cartId = dataService.currentCartId;
        if (!cartId) {
            cartId = await dataService.createNewCart();
            if (!cartId) {
                return;
            }
        }

        let syncedCount = 0;

        for (const item of localCart) {
            try {
                // Handle case where type might be an object
                let itemType = item.type;
                if (typeof itemType === 'object' && itemType !== null) {
                    itemType = itemType.type || itemType.name || 'product';
                    console.warn('⚠️ Fixed malformed type:', item.type, '->', itemType);
                }

                if (itemType === 'bundle') {
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
                        .eq('bundle_id', item.id)
                        .single();

                    if (bundle) {
                        for (const component of bundle.bundle_items || []) {
                            const inv = component.inventory;
                            if (!inv) continue;

                            const quantity = (component.quantity || 1) * (item.quantity || 1);
                            const totalPrice = inv.i_price * quantity;

                            const { data: existing } = await supabase
                                .from('cart_items')
                                .select('ci_id')
                                .eq('cart_id', cartId)
                                .eq('i_id', inv.i_id)
                                .maybeSingle();

                            if (existing) {
                                await supabase
                                    .from('cart_items')
                                    .update({ quantity, total_price: totalPrice })
                                    .eq('ci_id', existing.ci_id);
                            } else {
                                await supabase
                                    .from('cart_items')
                                    .insert({
                                        cart_id: cartId,
                                        i_id: inv.i_id,
                                        quantity: quantity,
                                        total_price: totalPrice
                                    });
                            }
                            syncedCount++;
                        }
                    }
                } else if (itemType === 'product') {
                    const quantity = item.quantity || 1;
                    const totalPrice = item.price * quantity;

                    const { data: existing } = await supabase
                        .from('cart_items')
                        .select('ci_id')
                        .eq('cart_id', cartId)
                        .eq('i_id', item.id)
                        .maybeSingle();

                    if (existing) {
                        await supabase
                            .from('cart_items')
                            .update({ quantity, total_price: totalPrice })
                            .eq('ci_id', existing.ci_id);
                    } else {
                        await supabase
                            .from('cart_items')
                            .insert({
                                cart_id: cartId,
                                i_id: item.id,
                                quantity: quantity,
                                total_price: totalPrice
                            });
                    }
                    syncedCount++;
                } else if (itemType === 'service') {
                    // Check if service already exists in cart
                    const { data: existing } = await supabase
                        .from('cart_service')
                        .select('cs_id')
                        .eq('cart_id', cartId)
                        .eq('service_id', item.id)
                        .maybeSingle();

                    if (!existing) {
                        await supabase
                            .from('cart_service')
                            .insert({
                                cart_id: cartId,
                                service_id: item.id
                            });
                        syncedCount++;
                    } else {
                        console.log(`ℹ️ Service ${item.id} already in cart`);
                    }
                }
            } catch (itemError) {
                console.error('Error syncing item:', itemError);
            }
        }

        if (syncedCount > 0) {
            clearLocalCart();
        }

        updateCartCountDisplay();

    } catch (error) {
        console.error('Error syncing local cart to database:', error);
    }
}

// ============================================
// INIT CART
// ============================================

export async function initCart() {
    try {
        const user = getUser();
        if (user) {
            await syncLocalCartToDatabase();
        }

        updateCartCountDisplay();
        return true;
    } catch (error) {
        console.error('Error initializing cart:', error);
        return false;
    }
}

// ============================================
// LOGIN BUTTON SETUP - FIXED
// ============================================

export function setupLoginButton() {
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');

    if (!loginBtn) return;

    const user = getUser();

    // Remove any existing event listeners (cleanup)
    loginBtn.onclick = null;

    if (user && user.full_name) {
        // User is logged in
        const displayName = user.full_name || user.email || 'User';
        const shortName = displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName;

        if (loginBtnText) {
            loginBtnText.textContent = shortName;
            loginBtnText.style.fontWeight = '600';
        }

        // Change icon to user circle
        const icon = loginBtn.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-user-circle';
        }

        // Store user role for dropdown
        const userRole = user.role || 'USER';

        // ✅ Both Staff and Regular users go to profile page with dropdown
        loginBtn.onclick = function (e) {
            e.stopPropagation();
            e.preventDefault();

            // Remove any existing dropdown
            const existingDropdown = document.querySelector('.user-dropdown-menu');
            if (existingDropdown) {
                existingDropdown.remove();
                return;
            }

            // Create dropdown menu
            const dropdown = document.createElement('div');
            dropdown.className = 'user-dropdown-menu';
            dropdown.style.cssText = `
                position: fixed;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                min-width: 200px;
                padding: 8px 0;
                z-index: 10000;
                animation: slideDown 0.2s ease;
                border: 1px solid rgba(0,0,0,0.05);
            `;

            // Position the dropdown
            const rect = loginBtn.getBoundingClientRect();
            dropdown.style.top = (rect.bottom + 8) + 'px';
            dropdown.style.right = (window.innerWidth - rect.right) + 'px';

            let menuItems = `
                <div style="padding: 12px 16px; border-bottom: 1px solid #f0f0f5;">
                    <div style="font-weight: 600; color: #1a1a2e; font-size: 14px;">${escapeHtml(user.full_name || 'User')}</div>
                    <div style="font-size: 12px; color: #888;">${escapeHtml(user.email || '')}</div>
                    ${user.role ? `<div style="font-size: 10px; color: #00d4ff; margin-top: 2px; font-weight: 500;">${user.role}</div>` : ''}
                </div>
                <div onclick="window.location.href='profile.html'" style="padding: 10px 16px; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; gap: 12px; color: #333;" onmouseover="this.style.background='#f0f8ff'" onmouseout="this.style.background=''">
                    <i class="fas fa-user" style="color: #00d4ff; width: 20px; text-align: center;"></i>
                    <span>My Profile</span>
                </div>
                <div onclick="window.location.href='cart.html'" style="padding: 10px 16px; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; gap: 12px; color: #333;" onmouseover="this.style.background='#f0f8ff'" onmouseout="this.style.background=''">
                    <i class="fas fa-shopping-cart" style="color: #00d4ff; width: 20px; text-align: center;"></i>
                    <span>My Cart</span>
                </div>
                ${userRole === 'STAFF' ? `
                    <div onclick="window.location.href='staff/staff-dashboard.html'" style="padding: 10px 16px; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; gap: 12px; color: #333;" onmouseover="this.style.background='#f0f8ff'" onmouseout="this.style.background=''">
                        <i class="fas fa-tools" style="color: #ff9800; width: 20px; text-align: center;"></i>
                        <span>Staff Dashboard</span>
                    </div>
                ` : ''}
                ${userRole === 'ADMIN' ? `
                    <div onclick="window.location.href='admin/admin-dashboard.html'" style="padding: 10px 16px; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; gap: 12px; color: #333;" onmouseover="this.style.background='#f0f8ff'" onmouseout="this.style.background=''">
                        <i class="fas fa-shield-alt" style="color: #f44336; width: 20px; text-align: center;"></i>
                        <span>Admin Dashboard</span>
                    </div>
                ` : ''}
                <div style="border-top: 1px solid #f0f0f5; margin-top: 4px; padding-top: 4px;">
                    <div onclick="window.handleLogout()" style="padding: 10px 16px; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; gap: 12px; color: #f44336;" onmouseover="this.style.background='#ffebee'" onmouseout="this.style.background=''">
                        <i class="fas fa-sign-out-alt" style="width: 20px; text-align: center;"></i>
                        <span>Logout</span>
                    </div>
                </div>
            `;

            dropdown.innerHTML = menuItems;
            document.body.appendChild(dropdown);

            // Close dropdown on click outside
            const closeDropdown = function (event) {
                if (!dropdown.contains(event.target) && event.target !== loginBtn) {
                    dropdown.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            };

            // Close after a small delay to prevent immediate close
            setTimeout(() => {
                document.addEventListener('click', closeDropdown);
            }, 50);
        };

    } else {
        // User is not logged in
        if (loginBtnText) {
            loginBtnText.textContent = 'Login';
            loginBtnText.style.fontWeight = '400';
        }

        const icon = loginBtn.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-user';
        }

        loginBtn.onclick = function (e) {
            e.preventDefault();
            window.location.href = 'auth.html';
        };
    }
}

// Add escapeHtml helper if not already defined
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add logout function globally
window.handleLogout = function () {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('buildbuddy_user');
        sessionStorage.removeItem('buildbuddy_user');
        clearLocalCart();
        updateCartCountDisplay();
        window.location.href = 'index.html';
    }
};

// Add logout function globally
window.handleLogout = function () {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('buildbuddy_user');
        sessionStorage.removeItem('buildbuddy_user');
        clearLocalCart();
        updateCartCountDisplay();
        window.location.href = 'index.html';
    }
};

export function clearCartOnLogout() {
    clearLocalCart();
    updateCartCountDisplay();
}

console.log('✅ cart-utils.js loaded');