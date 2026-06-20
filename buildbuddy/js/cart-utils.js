import supabase from './supabase-client.js';
import dataService from './data-service.js';

/**
 * Get the current user
 */
export function getUser() {
    const user = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
    return user ? JSON.parse(user) : null;
}

/**
 * Get the current session ID
 */
export function getSessionId() {
    let sessionId = localStorage.getItem('buildbuddy_session_id');
    if (!sessionId) {
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('buildbuddy_session_id', sessionId);
    }
    return sessionId;
}

/**
 * Get cart items from localStorage
 */
export function getLocalCart() {
    const cart = localStorage.getItem('buildbuddy_cart');
    return cart ? JSON.parse(cart) : [];
}

/**
 * Save cart to localStorage
 */
export function saveLocalCart(cart) {
    localStorage.setItem('buildbuddy_cart', JSON.stringify(cart));
}

/**
 * Clear localStorage cart
 */
export function clearLocalCart() {
    localStorage.removeItem('buildbuddy_cart');
}

/**
 * Get the total number of items in cart (syncs between local and database)
 */
export async function getCartCount() {
    const user = getUser();
    
    if (user) {
        try {
            const cartItems = await dataService.getCartItems();
            const cartServices = await dataService.getCartServices();
            return (cartItems?.length || 0) + (cartServices?.length || 0);
        } catch (error) {
            console.error('Error getting database cart count:', error);
            return getLocalCart().length;
        }
    } else {
        return getLocalCart().length;
    }
}

/**
 * Update cart count display across all elements
 */
export async function updateCartCountDisplay() {
    const count = await getCartCount();
    const cartCounts = document.querySelectorAll('.cart-count');
    cartCounts.forEach(el => el.textContent = count);
    return count;
}

/**
 * Sync local cart to database after login
 */
export async function syncLocalCartToDatabase() {
    const user = getUser();
    if (!user) return;
    
    const localCart = getLocalCart();
    if (localCart.length === 0) return;
    
    console.log('Syncing local cart to database:', localCart);
    
    for (const item of localCart) {
        try {
            if (item.type === 'bundle') {
                // For bundles, we need to add as a special item or handle differently
                // For now, keep in localStorage but mark as synced
                console.log('Bundle item, keeping in localStorage');
            } else if (item.type === 'product') {
                await dataService.addToCart(item.id, item.quantity || 1);
            } else if (item.type === 'service') {
                await dataService.addServiceToCart(item.id);
            }
        } catch (error) {
            console.error('Error syncing item to database:', item, error);
        }
    }
    
    // Clear localStorage after successful sync
    clearLocalCart();
    console.log('Local cart cleared after sync');
}

/**
 * Add item to cart (handles both local and database)
 */
export async function addToCart(item) {
    console.log('addToCart called:', item);
    const user = getUser();
    
    if (user) {
        console.log('User logged in, using database cart');
        try {
            if (item.type === 'product') {
                await dataService.addToCart(item.id, item.quantity || 1);
                console.log('Added to DB cart_items');
            } else if (item.type === 'service') {
                await dataService.addServiceToCart(item.id);
                console.log('Added to DB cart_service');
            } else if (item.type === 'bundle') {
                // Bundles still go to localStorage
                const localCart = getLocalCart();
                localCart.push({ ...item, quantity: item.quantity || 1 });
                saveLocalCart(localCart);
            }
        } catch (error) {
            console.error('Database cart failed:', error);
            // Fallback to localStorage
            const localCart = getLocalCart();
            localCart.push({ ...item, quantity: 1 });
            saveLocalCart(localCart);
        }
    } else {
        console.log('No user, using localStorage');
        const localCart = getLocalCart();
        const existing = localCart.find(i => i.type === item.type && i.id === item.id);
        if (existing && item.type !== 'service') {
            existing.quantity = (existing.quantity || 1) + 1;
        } else {
            localCart.push({ ...item, quantity: 1 });
        }
        saveLocalCart(localCart);
    }
    
    await updateCartCountDisplay();
}

/**
 * Initialize cart on page load
 */
export async function initCart() {
    const user = getUser();
    
    if (user) {
        // Sync any local cart items to database
        await syncLocalCartToDatabase();
    }
    
    // Update the display
    await updateCartCountDisplay();
    
    // Set up login button
    setupLoginButton();
}

/**
 * Set up login button behavior
 */
export function setupLoginButton() {
    const user = getUser();
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    
    if (user && loginBtn && loginBtnText) {
        // Fix: Check multiple possible name fields
        const displayName = user.full_name || user.name || user.user_name || user.username || 'User';
        // Safely get first name
        const firstName = displayName ? displayName.split(' ')[0] : 'User';
        loginBtnText.textContent = firstName;
        
        // Set up click handler based on role
        loginBtn.onclick = () => {
            if (user.role === 'ADMIN') {
                window.location.href = 'admin/admin-dashboard.html';
            } else if (user.role === 'STAFF') {
                window.location.href = 'staff/staff-dashboard.html';
            } else {
                window.location.href = 'profile.html';
            }
        };
    } else if (loginBtn) {
        loginBtn.onclick = () => window.location.href = 'auth.html';
        if (loginBtnText) {
            loginBtnText.textContent = 'Login';
        }
    }
}

/**
 * Clear cart on logout
 */
export function clearCartOnLogout() {
    clearLocalCart();
}