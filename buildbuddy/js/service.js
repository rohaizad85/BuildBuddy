// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\service.js
console.log('🔥🔥🔥 service.js is loaded! 🔥🔥🔥');

import supabase from './supabase-client.js';
import { initCart, addToCart, getCartCount } from './cart-utils.js';

let servicesData = [];
let currentFilter = 'all';
let isLoading = false;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('✅ DOM loaded, initializing...');
    
    try {
        // Initialize cart
        await initCart();
        console.log('✅ Cart initialized');
        
        // Load services
        await loadServices();
        
        // Setup filters
        setupFilterListeners();
        setupModalListeners();
        
        console.log('✅ All initialization complete');
    } catch (error) {
        console.error('❌ Initialization error:', error);
    }
});

async function loadServices() {
    const grid = document.getElementById('servicesGrid');
    
    if (isLoading) return;
    isLoading = true;
    
    console.log('🔍 loadServices() called');
    
    if (!supabase) {
        console.error('❌ Supabase is not defined!');
        grid.innerHTML = `
            <div class="loading-container">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
                <p>Supabase client not loaded.</p>
            </div>
        `;
        isLoading = false;
        return;
    }
    
    try {
        console.log('🔍 Fetching services from Supabase...');
        
        const result = await supabase
            .from('service')
            .select('*')
            .order('service_category')
            .order('service_price');
        
        console.log('📊 Result type:', Array.isArray(result) ? 'Array' : typeof result);
        console.log('📊 Result:', result);
        
        let data = null;
        let error = null;
        
        // Handle different response formats
        if (Array.isArray(result)) {
            // Result is directly the data array
            console.log('✅ Result is an array directly');
            data = result;
        } else if (result && typeof result === 'object') {
            // Result is an object - check for data property
            if (result.data !== undefined) {
                console.log('✅ Result has data property');
                data = result.data;
                error = result.error || null;
            } else if (result.length !== undefined) {
                // It's an array-like object
                console.log('✅ Result is array-like');
                data = Array.from(result);
            } else {
                // Unknown format - try to use it as is
                console.warn('⚠️ Unknown result format, trying to use as data');
                data = result;
            }
        }
        
        // Check for errors
        if (error) {
            console.error('❌ Supabase error:', error);
            throw new Error(error.message || 'Failed to fetch services');
        }
        
        // Validate data
        if (!data) {
            console.error('❌ No data extracted from result');
            throw new Error('No data received from Supabase');
        }
        
        // Ensure data is an array
        if (!Array.isArray(data)) {
            console.warn('⚠️ Data is not an array, converting...');
            data = data.data || data;
        }
        
        if (!data || data.length === 0) {
            console.warn('⚠️ No data returned from Supabase');
            grid.innerHTML = `
                <div class="loading-container">
                    <i class="fas fa-box-open" style="font-size: 48px; color: #ff9800; margin-bottom: 20px;"></i>
                    <p>No services available at the moment.</p>
                </div>
            `;
            isLoading = false;
            return;
        }
        
        servicesData = data;
        console.log('✅ Services loaded successfully:', servicesData.length, 'items');
        console.log('📊 First service:', servicesData[0]);
        renderServices();
        
    } catch (error) {
        console.error('❌ Error loading services:', error);
        grid.innerHTML = `
            <div class="loading-container">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
                <p>Failed to load services.</p>
                <p style="font-size: 12px; color: #999; margin-top: 10px;">Error: ${error.message || 'Unknown error'}</p>
                <button onclick="location.reload()" style="margin-top: 15px; padding: 8px 20px; background: #00d4ff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-sync"></i> Retry
                </button>
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

function renderServices() {
    const grid = document.getElementById('servicesGrid');
    console.log('🎨 renderServices() called, servicesData length:', servicesData.length);
    
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
    
    console.log('📊 Filtered services:', filteredServices.length);
    
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
        
        return `
            <div class="service-card">
                <div class="service-icon">
                    <i class="fas ${icon}"></i>
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
    
    console.log('✅ Services rendered successfully');
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

function setupFilterListeners() {
    console.log('🔧 Setting up filter listeners');
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            console.log('🔍 Filter changed to:', currentFilter);
            renderServices();
        });
    });
}

window.bookService = function(serviceId) {
    console.log('📖 Booking service:', serviceId);
    window.location.href = `service-booking.html?service_id=${serviceId}`;
};

function setupModalListeners() {
    const modal = document.getElementById('serviceModal');
    if (!modal) {
        console.log('ℹ️ Service modal not found, skipping');
        return;
    }
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

// Export for debugging
window.debug = {
    servicesData: () => servicesData,
    currentFilter: () => currentFilter,
    reloadServices: loadServices
};

console.log('✅ service.js initialization complete');