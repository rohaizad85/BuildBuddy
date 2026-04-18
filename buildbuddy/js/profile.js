import supabase from './supabase-client.js';

let currentUser = null;
let userOrders = [];
let userStats = {
    totalOrders: 0,
    totalSpent: 0,
    memberSince: null
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadProfile();
    updateCartCount();
});

function getUser() {
    const user = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
    return user ? JSON.parse(user) : null;
}

async function loadProfile() {
    const container = document.getElementById('profileContent');
    currentUser = getUser();
    
    if (!currentUser) {
        container.innerHTML = `
            <div class="profile-card">
                <div class="profile-info">
                    <div class="empty-state">
                        <i class="fas fa-user-lock"></i>
                        <h3>Not Logged In</h3>
                        <p>Please login to view your profile</p>
                        <div class="action-buttons">
                            <button class="edit-btn" onclick="window.location.href='auth.html'">
                                <i class="fas fa-sign-in-alt"></i> Login
                            </button>
                            <button class="edit-btn" onclick="window.location.href='auth.html#register'">
                                <i class="fas fa-user-plus"></i> Register
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    try {
        // Fetch full user data from database
        const userData = await supabase
            .from('users')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
        
        if (userData) {
            currentUser = {
                ...currentUser,
                ...userData
            };
        }
        
        // Fetch user orders
        await loadUserOrders();
        
        // Calculate stats
        calculateStats();
        
        // Render profile
        renderProfile();
        
    } catch (error) {
        console.error('Error loading profile:', error);
        container.innerHTML = `
            <div class="profile-card">
                <div class="profile-info">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-circle"></i>
                        <h3>Failed to load profile</h3>
                        <p>Please refresh the page or try again later.</p>
                    </div>
                </div>
            </div>
        `;
    }
}

async function loadUserOrders() {
    try {
        const orders = await supabase
            .from('payment')
            .select(`
                payment_id,
                total_amount,
                payment_method,
                payment_status,
                payment_date,
                cart_id
            `)
            .eq('session_id', currentUser.id)
            .order('payment_date', { ascending: false });
        
        userOrders = orders || [];
    } catch (error) {
        console.error('Error loading orders:', error);
        userOrders = [];
    }
}

function calculateStats() {
    userStats.totalOrders = userOrders.length;
    
    userStats.totalSpent = userOrders.reduce((sum, order) => {
        return sum + parseFloat(order.total_amount || 0);
    }, 0);
    
    userStats.memberSince = currentUser.created_at 
        ? new Date(currentUser.created_at).toLocaleDateString('en-MY', { 
            year: 'numeric', 
            month: 'long' 
        })
        : 'Recently';
}

function renderProfile() {
    const container = document.getElementById('profileContent');
    
    const memberSince = userStats.memberSince;
    const firstName = currentUser.name ? currentUser.name.split(' ')[0] : 'User';
    const fullName = currentUser.full_name || currentUser.name || 'Not set';
    const email = currentUser.email || 'Not set';
    const phone = currentUser.phone || 'Not set';
    
    container.innerHTML = `
        <div class="profile-card">
            <div class="profile-cover"></div>
            <div class="profile-avatar">
                <div class="avatar-circle">
                    <i class="fas fa-user"></i>
                </div>
            </div>
            <div class="profile-info">
                <h2 class="profile-name">${fullName}</h2>
                <p class="profile-email">${email}</p>
                
                <div class="profile-stats">
                    <div class="stat-item">
                        <div class="stat-value">${userStats.totalOrders}</div>
                        <div class="stat-label">Orders</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">RM ${userStats.totalSpent.toFixed(0)}</div>
                        <div class="stat-label">Total Spent</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value"><i class="fas fa-crown" style="color: #FFD700;"></i></div>
                        <div class="stat-label">Member</div>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="edit-btn" onclick="window.location.href='#'">
                        <i class="fas fa-edit"></i> Edit Profile
                    </button>
                    <button class="logout-btn" onclick="window.handleLogout()">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            </div>
        </div>
        
        <div class="profile-section">
            <div class="section-title">
                <i class="fas fa-user-circle"></i>
                Account Information
            </div>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Full Name</span>
                    <span class="info-value">${fullName}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email Address</span>
                    <span class="info-value">${email}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Phone Number</span>
                    <span class="info-value">${phone}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Member Since</span>
                    <span class="info-value">${memberSince}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Last Login</span>
                    <span class="info-value">${formatDate(currentUser.last_login)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Account Status</span>
                    <span class="info-value" style="color: #4CAF50;">
                        <i class="fas fa-check-circle"></i> Active
                    </span>
                </div>
            </div>
        </div>
        
        <div class="profile-section">
            <div class="section-title">
                <i class="fas fa-shopping-bag"></i>
                Recent Orders
            </div>
            ${renderOrders()}
        </div>
        
        <div class="profile-section">
            <div class="section-title">
                <i class="fas fa-tag"></i>
                Loyalty Benefits
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
                <div>
                    <i class="fas fa-percent" style="font-size: 32px; color: #00d4ff; margin-bottom: 10px;"></i>
                    <h4 style="color: #1a1a2e; margin-bottom: 5px;">10% Discount</h4>
                    <p style="color: #666; font-size: 13px;">On all services</p>
                </div>
                <div>
                    <i class="fas fa-truck-fast" style="font-size: 32px; color: #00d4ff; margin-bottom: 10px;"></i>
                    <h4 style="color: #1a1a2e; margin-bottom: 5px;">Free Shipping</h4>
                    <p style="color: #666; font-size: 13px;">On orders above RM 500</p>
                </div>
                <div>
                    <i class="fas fa-headset" style="font-size: 32px; color: #00d4ff; margin-bottom: 10px;"></i>
                    <h4 style="color: #1a1a2e; margin-bottom: 5px;">Priority Support</h4>
                    <p style="color: #666; font-size: 13px;">24/7 dedicated support</p>
                </div>
            </div>
        </div>
    `;
}

function renderOrders() {
    if (userOrders.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <p>No orders yet</p>
                <button class="edit-btn" onclick="window.location.href='index.html'" style="margin-top: 15px;">
                    Start Shopping
                </button>
            </div>
        `;
    }
    
    return userOrders.slice(0, 5).map(order => {
        const statusClass = getStatusClass(order.payment_status);
        const date = formatDate(order.payment_date);
        
        return `
            <div class="order-item">
                <div class="order-info">
                    <h4>Order #${order.payment_id}</h4>
                    <p>${date} • ${order.payment_method || 'N/A'}</p>
                </div>
                <span class="order-status ${statusClass}">${order.payment_status || 'PENDING'}</span>
                <span class="order-price">RM ${parseFloat(order.total_amount).toFixed(2)}</span>
            </div>
        `;
    }).join('');
}

function getStatusClass(status) {
    const statusMap = {
        'COMPLETED': 'status-completed',
        'PENDING': 'status-pending',
        'PROCESSING': 'status-processing',
        'PAID': 'status-completed'
    };
    return statusMap[status] || 'status-pending';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-MY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

window.handleLogout = function() {
    localStorage.removeItem('buildbuddy_user');
    sessionStorage.removeItem('buildbuddy_user');
    window.location.href = 'index.html';
};

function updateCartCount() {
    const cartCount = document.querySelector('.cart-count');
    if (cartCount) {
        const savedCart = localStorage.getItem('buildbuddy_cart');
        const count = savedCart ? JSON.parse(savedCart).length : 0;
        cartCount.textContent = count;
    }
}

// Update header login button
function updateLoginButton() {
    const user = getUser();
    const loginBtnText = document.getElementById('loginBtnText');
    
    if (user && loginBtnText) {
        loginBtnText.textContent = user.name.split(' ')[0];
    }
}

updateLoginButton();