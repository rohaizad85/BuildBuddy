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
            type: type,  // This should be a string: 'product', 'service', or 'bundle'
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
                type: 'bundle',  // String, not object
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
                    // If type is an object, try to extract the actual type
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
// LOGIN BUTTON SETUP
// ============================================

export function setupLoginButton() {
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    
    if (loginBtn && loginBtnText) {
        const user = getUser();
        if (user) {
            loginBtnText.textContent = (user.full_name || user.name || 'User').split(' ')[0];
            loginBtn.onclick = () => {
                if (user.role === 'ADMIN') {
                    window.location.href = 'admin/admin-dashboard.html';
                } else if (user.role === 'STAFF') {
                    window.location.href = 'staff/staff-dashboard.html';
                } else {
                    window.location.href = 'profile.html';
                }
            };
        } else {
            loginBtnText.textContent = 'Login';
            loginBtn.onclick = () => window.location.href = 'auth.html';
        }
    }
}

export function clearCartOnLogout() {
    clearLocalCart();
    updateCartCountDisplay();
}

console.log('✅ cart-utils.js loaded');