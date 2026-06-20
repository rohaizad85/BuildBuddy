// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\service.js

import supabase from './supabase-client.js';
import { initCart } from './cart-utils.js';

let servicesData = [];
let currentFilter = 'all';
let isLoading = false;

// ============================================
// DOM CONTENT LOADED
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initCart();
        await loadServices();
        setupFilterListeners();
        setupModalListeners();
    } catch (error) {
        console.error('Error initializing services:', error);
    }
});

// ============================================
// GET SERVICE IMAGE URL
// ============================================

function getServiceImageUrl(service) {
    if (!service) return null;
    
    let imagePath = service.service_image_path;
    
    if (!imagePath) {
        // Fallback mapping
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
    
    const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
    return `${SUPABASE_URL}/storage/v1/object/public/images/${imagePath}`;
}

// ============================================
// LOAD SERVICES
// ============================================

async function loadServices() {
    const grid = document.getElementById('servicesGrid');
    
    if (isLoading) return;
    isLoading = true;
    
    if (!supabase) {
        grid.innerHTML = `
            <div class="loading-container">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
                <p>Unable to load services. Please refresh the page.</p>
            </div>
        `;
        isLoading = false;
        return;
    }
    
    try {
        const result = await supabase
            .from('service')
            .select('*')
            .order('service_category')
            .order('service_price');
        
        let data = null;
        let error = null;
        
        if (Array.isArray(result)) {
            data = result;
        } else if (result && typeof result === 'object') {
            if (result.data !== undefined) {
                data = result.data;
                error = result.error || null;
            } else if (result.length !== undefined) {
                data = Array.from(result);
            } else {
                data = result;
            }
        }
        
        if (error) {
            throw new Error(error.message || 'Failed to fetch services');
        }
        
        if (!data) {
            throw new Error('No data received');
        }
        
        if (!Array.isArray(data)) {
            data = data.data || data;
        }
        
        if (!data || data.length === 0) {
            grid.innerHTML = `
                <div class="loading-container">
                    <i class="fas fa-box-open" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
                    <p>No services available at the moment.</p>
                </div>
            `;
            isLoading = false;
            return;
        }
        
        servicesData = data;
        renderServices();
        
    } catch (error) {
        console.error('Error loading services:', error);
        grid.innerHTML = `
            <div class="loading-container">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
                <p>Failed to load services.</p>
                <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 20px; background: #00d4ff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-sync"></i> Retry
                </button>
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

// ============================================
// RENDER SERVICES
// ============================================

function renderServices() {
    const grid = document.getElementById('servicesGrid');
    
    if (!servicesData || servicesData.length === 0) {
        grid.innerHTML = `
            <div class="loading-container">
                <i class="fas fa-box-open" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
                <p>No services available.</p>
            </div>
        `;
        return;
    }
    
    const filteredServices = currentFilter === 'all' 
        ? servicesData 
        : servicesData.filter(s => s.service_category === currentFilter);
    
    if (filteredServices.length === 0) {
        grid.innerHTML = `
            <div class="loading-container">
                <i class="fas fa-box-open" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
                <p>No services found in "${currentFilter}" category.</p>
                <button onclick="document.querySelector('.filter-btn[data-filter=\\'all\\']').click()" 
                        style="margin-top: 15px; padding: 8px 20px; background: #00d4ff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Show All Services
                </button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredServices.map(service => {
        const categoryClass = getCategoryClass(service.service_category);
        const icon = getServiceIcon(service.service_category);
        const imageUrl = getServiceImageUrl(service);
        
        return `
            <div class="service-card">
                <div class="service-image">
                    ${imageUrl ? `
                        <img src="${imageUrl}" 
                             alt="${service.service_name}"
                             loading="lazy"
                             onerror="this.style.display='none'; this.parentElement.querySelector('.fallback-icon').style.display='flex';"
                        >
                        <div class="fallback-icon" style="display: none; flex-direction: column; align-items: center; color: #ccc;">
                            <i class="fas ${icon}" style="font-size: 48px; color: #00d4ff;"></i>
                            <span style="font-size: 12px; margin-top: 5px; color: #999;">${service.service_category || 'Service'}</span>
                        </div>
                    ` : `
                        <div class="fallback-icon" style="display: flex; flex-direction: column; align-items: center; color: #ccc;">
                            <i class="fas ${icon}" style="font-size: 48px; color: #00d4ff;"></i>
                            <span style="font-size: 12px; margin-top: 5px; color: #999;">${service.service_category || 'Service'}</span>
                        </div>
                    `}
                </div>
                <span class="service-category ${categoryClass}">${service.service_category || 'General'}</span>
                <h3>${service.service_name}</h3>
                <div class="service-duration">
                    <i class="fas fa-clock"></i> ${service.service_duration || 'Contact for duration'}
                </div>
                <div class="service-price">
                    RM ${parseFloat(service.service_price).toFixed(2)}
                    <small>one-time</small>
                </div>
                <button class="btn-book" onclick="window.bookService(${service.service_id})">
                    <i class="fas fa-calendar-plus"></i> Book Now
                </button>
            </div>
        `;
    }).join('');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

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

// ============================================
// SETUP LISTENERS
// ============================================

function setupFilterListeners() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderServices();
        });
    });
}

window.bookService = function(serviceId) {
    window.location.href = `service-booking.html?service_id=${serviceId}`;
};

function setupModalListeners() {
    const modal = document.getElementById('serviceModal');
    if (!modal) return;
    
    const closeBtn = modal.querySelector('.close-modal');
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