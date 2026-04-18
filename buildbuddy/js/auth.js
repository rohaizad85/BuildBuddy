import supabase from './supabase-client.js';

// Tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update tabs
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update forms
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(`${tabName}Form`).classList.add('active');
        
        // Update header and footer
        const header = document.querySelector('.auth-header');
        const footerText = document.getElementById('footerText');
        const switchLink = document.getElementById('switchToRegister');
        
        if (tabName === 'login') {
            header.innerHTML = `
                <i class="fas fa-microchip"></i>
                <h2>Welcome Back</h2>
                <p>Sign in to access your account</p>
            `;
            footerText.textContent = "Don't have an account?";
            switchLink.textContent = 'Sign Up';
            switchLink.onclick = () => switchTab('register');
        } else {
            header.innerHTML = `
                <i class="fas fa-user-plus"></i>
                <h2>Create Account</h2>
                <p>Join BuildBuddy today</p>
            `;
            footerText.textContent = "Already have an account?";
            switchLink.textContent = 'Sign In';
            switchLink.onclick = () => switchTab('login');
        }
        
        // Clear messages
        clearMessages();
    });
});

// Switch tab function
window.switchTab = function(tabName) {
    document.querySelector(`.auth-tab[data-tab="${tabName}"]`).click();
};

// Toggle password visibility
window.togglePassword = function(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

// Clear messages
function clearMessages() {
    document.querySelectorAll('.error-message, .success-message').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
    });
}

// Show error
function showError(formType, message) {
    const errorEl = document.getElementById(`${formType}Error`);
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => errorEl.style.display = 'none', 5000);
}

// Show success
function showSuccess(formType, message) {
    const successEl = document.getElementById(`${formType}Success`);
    successEl.textContent = message;
    successEl.style.display = 'block';
    setTimeout(() => successEl.style.display = 'none', 3000);
}

// Simple hash function (for demo purposes)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Handle Login
window.handleLogin = async function(event) {
    event.preventDefault();
    clearMessages();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const btn = document.getElementById('loginBtn');
    
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner-small"></span> Signing in...';
    
    try {
        const passwordHash = await hashPassword(password);
        
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password_hash', passwordHash)
            .single();
        
        if (error || !data) {
            throw new Error('Invalid email or password');
        }
        
        // Update last login
        await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('user_id', data.user_id);
        
        // Store user info
        const userData = {
            id: data.user_id,
            name: data.full_name,
            email: data.email
        };
        
        if (rememberMe) {
            localStorage.setItem('buildbuddy_user', JSON.stringify(userData));
        } else {
            sessionStorage.setItem('buildbuddy_user', JSON.stringify(userData));
        }
        
        showSuccess('login', 'Login successful! Redirecting...');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        
    } catch (error) {
        showError('login', error.message);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
};

// Handle Register
window.handleRegister = async function(event) {
    event.preventDefault();
    clearMessages();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    const btn = document.getElementById('registerBtn');
    
    // Validation
    if (password !== confirmPassword) {
        showError('register', 'Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        showError('register', 'Password must be at least 6 characters');
        return;
    }
    
    if (!agreeTerms) {
        showError('register', 'Please agree to the Terms & Conditions');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner-small"></span> Creating account...';
    
    try {
        // Check if email exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('email')
            .eq('email', email)
            .single();
        
        if (existingUser) {
            throw new Error('Email already registered');
        }
        
        const passwordHash = await hashPassword(password);
        
        const { data, error } = await supabase
            .from('users')
            .insert({
                full_name: name,
                email: email,
                phone: phone || null,
                password_hash: passwordHash
            })
            .select()
            .single();
        
        if (error) throw error;
        
        showSuccess('register', 'Account created successfully! You can now login.');
        
        // Clear form
        document.getElementById('registerName').value = '';
        document.getElementById('registerEmail').value = '';
        document.getElementById('registerPhone').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerConfirmPassword').value = '';
        document.getElementById('agreeTerms').checked = false;
        
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        
        // Switch to login after 2 seconds
        setTimeout(() => {
            switchTab('login');
            document.getElementById('loginEmail').value = email;
        }, 2000);
        
    } catch (error) {
        showError('register', error.message);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
    }
};

// Social login (placeholder)
window.socialLogin = function(provider) {
    showError('login', `${provider} login coming soon!`);
};

// Check if user is logged in
function checkAuth() {
    const user = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
    if (user) {
        const userData = JSON.parse(user);
        const loginBtn = document.querySelector('.login-btn');
        if (loginBtn) {
            loginBtn.innerHTML = `<i class="fas fa-user"></i> ${userData.name.split(' ')[0]}`;
            loginBtn.onclick = () => window.location.href = 'profile.html';
        }
    }
}

// Update cart count
function updateCartCount() {
    const cartCount = document.querySelector('.cart-count');
    if (cartCount) {
        const savedCart = localStorage.getItem('buildbuddy_cart');
        const count = savedCart ? JSON.parse(savedCart).length : 0;
        cartCount.textContent = count;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    updateCartCount();
    
    // Set up switch link
    document.getElementById('switchToRegister').onclick = (e) => {
        e.preventDefault();
        switchTab('register');
    };
});

// Export for use in other files
export { checkAuth, updateCartCount };