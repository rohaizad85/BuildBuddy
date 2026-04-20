import supabase from './supabase-client.js';
import { initCart, addToCart } from './cart-utils.js';

let servicesData = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    await initCart();
    await loadServices();
    setupFilterListeners();
    setupModalListeners();
});

async function loadServices() {
    const grid = document.getElementById('servicesGrid');
    
    try {
        const data = await supabase
            .from('service')
            .select('*')
            .order('service_category')
            .order('service_price');
        
        servicesData = data || [];
        renderServices();
    } catch (error) {
        console.error('Error loading services:', error);
        grid.innerHTML = `
            <div class="loading-container">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
                <p>Failed to load services. Please refresh the page.</p>
            </div>
        `;
    }
}

function renderServices() {
    const grid = document.getElementById('servicesGrid');
    
    const filteredServices = currentFilter === 'all' 
        ? servicesData 
        : servicesData.filter(s => s.service_category === currentFilter);
    
    if (filteredServices.length === 0) {
        grid.innerHTML = `
            <div class="loading-container">
                <i class="fas fa-box-open" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
                <p>No services found in this category.</p>
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
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderServices();
        });
    });
}

window.bookService = async function(serviceId) {
    const service = servicesData.find(s => s.service_id === serviceId);
    if (!service) return;
    
    try {
        await addToCart({
            type: 'service',
            id: serviceId,
            name: service.service_name,
            price: service.service_price
        });
        
        showSuccessModal(service);
    } catch (error) {
        console.error('Error booking service:', error);
        showErrorModal('Failed to book service. Please try again.');
    }
};

function showSuccessModal(service) {
    const modal = document.getElementById('serviceModal');
    const modalMessage = document.getElementById('modalMessage');
    
    modalMessage.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-check-circle" style="font-size: 48px; color: #4CAF50; margin-bottom: 20px;"></i>
            <p style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">Service Added to Cart!</p>
            <p style="margin-bottom: 15px;"><strong>${service.service_name}</strong> has been added to your cart.</p>
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
                <i class="fas fa-clock"></i> Estimated duration: ${service.service_duration || 'Contact us'}
            </p>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button class="btn-outline" onclick="document.getElementById('serviceModal').style.display='none'">
                    Continue Shopping
                </button>
                <button class="btn-primary" onclick="window.location.href='cart.html'">
                    View Cart <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function showErrorModal(message) {
    const modal = document.getElementById('serviceModal');
    const modalMessage = document.getElementById('modalMessage');
    
    modalMessage.innerHTML = `
        <div style="text-align: center;">
            <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
            <p style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">Error</p>
            <p style="margin-bottom: 20px;">${message}</p>
            <button class="btn-primary" onclick="document.getElementById('serviceModal').style.display='none'">
                Close
            </button>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function setupModalListeners() {
    const modal = document.getElementById('serviceModal');
    const closeBtn = modal.querySelector('.close-modal');
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}