// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\service.js

import supabase from './supabase-client.js';
import { 
    getUser, 
    getCartCount, 
    updateCartCountDisplay, 
    initCart,
    setupLoginButton 
} from './cart-utils.js';

const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
let servicesData = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // ✅ Setup login button first
        setupLoginButton();
        
        // ✅ Initialize cart
        await initCart();
        
        // ✅ Update cart count
        await updateCartCountDisplay();
        
        // ✅ Load services
        await loadServices();
        
        // ✅ Setup filter buttons
        setupFilterButtons();
        
        // ✅ Setup modal
        setupModal();
        
    } catch (error) {
        console.error('Error loading services:', error);
        showError('Failed to load services. Please refresh the page.');
    }
});

async function loadServices() {
    const grid = document.getElementById('servicesGrid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Loading services...</p>
        </div>
    `;

    try {
        const { data, error } = await supabase
            .from('service')
            .select('*')
            .order('service_name');

        if (error) {
            console.error('Error fetching services:', error);
            showError('Failed to load services');
            return;
        }

        servicesData = data || [];
        renderServices(currentFilter);

    } catch (error) {
        console.error('Error loading services:', error);
        showError('Failed to load services');
    }
}

function renderServices(category = 'all') {
    const grid = document.getElementById('servicesGrid');
    if (!grid) return;

    const filtered = category === 'all' 
        ? servicesData 
        : servicesData.filter(s => s.service_category === category);

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="text-align:center;padding:60px;grid-column:1/-1;">
                <i class="fas fa-tools" style="font-size:48px;color:#ccc;margin-bottom:20px;"></i>
                <h3>No services found</h3>
                <p style="color:#666;">Try selecting a different category.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(service => {
        const imageUrl = getServiceImageUrl(service);
        const icon = getServiceIcon(service.service_category);
        const categoryClass = getCategoryClass(service.service_category);
        
        return `
            <div class="service-card">
                <div class="service-image">
                    ${imageUrl ? `
                        <img src="${imageUrl}" alt="${service.service_name}" 
                             onerror="this.style.display='none'; this.parentElement.querySelector('.fallback-icon').style.display='flex';">
                    ` : ''}
                    <div class="fallback-icon" style="${imageUrl ? 'display:none;' : 'display:flex;'}">
                        <i class="fas ${icon}"></i>
                        <span>${service.service_category}</span>
                    </div>
                </div>
                <div class="service-category ${categoryClass}">${service.service_category || 'General'}</div>
                <h3>${service.service_name}</h3>
                <div class="service-duration"><i class="fas fa-clock"></i> ${service.service_duration || 'Contact for duration'}</div>
                <div class="service-price">RM ${parseFloat(service.service_price).toFixed(2)} <small>per service</small></div>
                <button class="btn-book" onclick="window.bookService(${service.service_id})">
                    <i class="fas fa-calendar-check"></i> Book Now
                </button>
            </div>
        `;
    }).join('');
}

function getServiceImageUrl(service) {
    if (!service) return null;

    let imagePath = service.service_image_path;

    if (!imagePath) {
        const fallbackImages = {
            'Data Recovery': 'Services/Data_Recovery.jpg',
            'OS Installation': 'Services/OS_Install.jpeg',
            'OS Install': 'Services/OS_Install.jpeg',
            'PC Maintenance': 'Services/PC_Maintenance.jpg',
            'Component Upgrade': 'Services/PC_Upgrade.jpg',
            'PC Upgrade': 'Services/PC_Upgrade.jpg',
            'Cable Management': 'Services/Cable_management.jpg'
        };

        if (fallbackImages[service.service_name]) {
            imagePath = fallbackImages[service.service_name];
        } else {
            for (const [key, value] of Object.entries(fallbackImages)) {
                if (service.service_name && service.service_name.toLowerCase().includes(key.toLowerCase())) {
                    imagePath = value;
                    break;
                }
            }
        }

        if (!imagePath) {
            const categoryImages = {
                'repair': 'Services/repair.jpg',
                'recovery': 'Services/Data_Recovery.jpg',
                'software': 'Services/OS_Install.jpeg',
                'maintenance': 'Services/PC_Maintenance.jpg',
                'upgrade': 'Services/PC_Upgrade.jpg',
                'assembly': 'Services/Cable_management.jpg'
            };
            imagePath = categoryImages[service.service_category];
        }

        if (!imagePath) return null;
    }

    return `${SUPABASE_URL}/storage/v1/object/public/images/${imagePath}`;
}

function getServiceIcon(category) {
    const icons = {
        'repair': 'fa-tools',
        'assembly': 'fa-computer',
        'upgrade': 'fa-arrow-up',
        'software': 'fa-windows',
        'recovery': 'fa-database',
        'maintenance': 'fa-broom'
    };
    return icons[category] || 'fa-wrench';
}

function getCategoryClass(category) {
    const classes = {
        'repair': 'category-repair',
        'assembly': 'category-assembly',
        'upgrade': 'category-upgrade',
        'software': 'category-software',
        'recovery': 'category-recovery',
        'maintenance': 'category-maintenance'
    };
    return classes[category] || 'category-repair';
}

function setupFilterButtons() {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            buttons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderServices(currentFilter);
        });
    });
}

function setupModal() {
    const modal = document.getElementById('serviceModal');
    const closeBtn = modal?.querySelector('.close-modal');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

window.bookService = function(serviceId) {
    const service = servicesData.find(s => s.service_id === serviceId);
    if (!service) {
        showToast('Service not found.', 'error');
        return;
    }

    const modal = document.getElementById('serviceModal');
    const modalMessage = document.getElementById('modalMessage');
    
    if (!modal || !modalMessage) return;

    const imageUrl = getServiceImageUrl(service);
    const icon = getServiceIcon(service.service_category);
    const categoryClass = getCategoryClass(service.service_category);

    modalMessage.innerHTML = `
        <div style="text-align:center;">
            <div style="width:120px;height:120px;margin:0 auto 15px;border-radius:12px;overflow:hidden;background:#f8f9fc;display:flex;align-items:center;justify-content:center;">
                ${imageUrl ? `
                    <img src="${imageUrl}" alt="${service.service_name}" style="width:100%;height:100%;object-fit:cover;">
                ` : `
                    <i class="fas ${icon}" style="font-size:48px;color:#00d4ff;"></i>
                `}
            </div>
            <div class="service-category ${categoryClass}" style="display:inline-block;margin-bottom:10px;">${service.service_category}</div>
            <h3 style="margin:0 0 5px 0;">${service.service_name}</h3>
            <p style="color:#666;margin-bottom:10px;"><i class="fas fa-clock"></i> ${service.service_duration || 'Contact for duration'}</p>
            <div style="font-size:28px;font-weight:700;color:#1a1a2e;margin-bottom:20px;">RM ${parseFloat(service.service_price).toFixed(2)}</div>
            <p style="color:#666;margin-bottom:20px;">${service.service_description || 'Professional service with 90-day warranty.'}</p>
            <button onclick="window.confirmBooking(${service.service_id})" class="btn-book" style="max-width:300px;margin:0 auto;">
                <i class="fas fa-calendar-check"></i> Confirm Booking
            </button>
        </div>
    `;

    modal.style.display = 'flex';
};

window.confirmBooking = function(serviceId) {
    window.location.href = `service-booking.html?service_id=${serviceId}`;
};

function showToast(message, type = 'info') {
    // Use the existing toast or create one
    const existingToast = document.querySelector('.custom-toast');
    if (existingToast) existingToast.remove();

    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#00d4ff'
    };

    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        padding: 14px 24px;
        border-radius: 12px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        z-index: 99999;
        box-shadow: 0 8px 30px rgba(0,0,0,0.25);
        animation: toastSlideUp 0.4s ease;
        max-width: 400px;
        background: ${colors[type] || colors.info};
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showError(message) {
    const grid = document.getElementById('servicesGrid');
    if (grid) {
        grid.innerHTML = `
            <div style="text-align:center;padding:60px;grid-column:1/-1;">
                <i class="fas fa-exclamation-circle" style="font-size:48px;color:#f44336;margin-bottom:20px;"></i>
                <h3>Error Loading Services</h3>
                <p style="color:#666;">${message}</p>
                <button onclick="location.reload()" style="margin-top:20px;padding:12px 30px;background:#00d4ff;color:#1a1a2e;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
}

console.log('✅ service.js loaded');