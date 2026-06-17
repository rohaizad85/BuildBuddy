// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\service-booking.js
import supabase from './supabase-client.js';
import { initCart, addToCart } from './cart-utils.js';

let serviceData = null;
let serviceId = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('📋 Service booking page loaded');
    
    try {
        await initCart();
        console.log('✅ Cart initialized');
        
        // Get service ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        serviceId = urlParams.get('service_id');
        
        console.log('📋 Service ID from URL:', serviceId);
        
        if (!serviceId) {
            showError('No service selected. Please go back and choose a service.');
            return;
        }
        
        await loadService(serviceId);
        setupForm();
        setMinDate();
        prefillUserData();
        
        console.log('✅ Booking page setup complete');
    } catch (error) {
        console.error('❌ Error initializing booking page:', error);
        showError('Failed to load booking page. Please refresh and try again.');
    }
});

async function loadService(id) {
    try {
        console.log('🔍 Loading service:', id);
        
        const result = await supabase
            .from('service')
            .select('*')
            .eq('service_id', id)
            .single();
        
        console.log('📊 Service result:', result);
        
        // Handle different response formats (same as service.js)
        let data = null;
        let error = null;
        
        if (Array.isArray(result)) {
            data = result[0] || null;
        } else if (result && typeof result === 'object') {
            if (result.data !== undefined) {
                data = result.data;
                error = result.error || null;
            } else if (result.service_id !== undefined) {
                data = result;
            } else {
                data = result.data || result;
            }
        }
        
        if (error) {
            console.error('❌ Supabase error:', error);
            throw new Error(error.message || 'Failed to load service');
        }
        
        if (!data || data.length === 0) {
            console.error('❌ Service not found');
            throw new Error('Service not found. Please go back and try again.');
        }
        
        // If data is an array with one item, get the first item
        if (Array.isArray(data) && data.length > 0) {
            data = data[0];
        }
        
        serviceData = data;
        console.log('✅ Service loaded:', serviceData);
        displayServiceSummary(serviceData);
        
    } catch (error) {
        console.error('❌ Error loading service:', error);
        showError(error.message || 'Failed to load service details. Please refresh the page.');
    }
}

function displayServiceSummary(service) {
    const summary = document.getElementById('serviceSummary');
    if (!summary) return;
    
    const icon = getServiceIcon(service.service_category);
    const categoryClass = getCategoryClass(service.service_category);
    
    summary.innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #00d4ff20, #00d4ff40); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas ${icon}" style="font-size: 24px; color: #00d4ff;"></i>
                </div>
                <div>
                    <span class="service-category ${categoryClass}" style="display: inline-block; margin-bottom: 4px;">${service.service_category || 'General'}</span>
                    <h3 style="margin: 0; color: #1a1a2e;">${service.service_name}</h3>
                </div>
            </div>
            <div style="margin-left: auto; text-align: right;">
                <div style="font-size: 28px; font-weight: 700; color: #1a1a2e;">RM ${parseFloat(service.service_price).toFixed(2)}</div>
                <div style="font-size: 14px; color: #666;"><i class="fas fa-clock"></i> ${service.service_duration || 'Contact for duration'}</div>
            </div>
        </div>
    `;
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

function setupForm() {
    const form = document.getElementById('bookingForm');
    if (form) {
        form.addEventListener('submit', handleBooking);
        console.log('✅ Form submit handler attached');
    } else {
        console.warn('⚠️ Booking form not found');
    }
}

function setMinDate() {
    const dateInput = document.getElementById('preferredDate');
    if (dateInput) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.min = `${year}-${month}-${day}`;
        console.log('📅 Min date set to:', dateInput.min);
    }
}

function prefillUserData() {
    try {
        const userData = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
        if (userData) {
            const user = JSON.parse(userData);
            const nameInput = document.getElementById('customerName');
            const phoneInput = document.getElementById('contactPhone');
            
            if (nameInput && user.full_name) {
                nameInput.value = user.full_name;
                console.log('✅ Prefilled name:', user.full_name);
            }
            if (phoneInput && user.phone) {
                phoneInput.value = user.phone;
                console.log('✅ Prefilled phone:', user.phone);
            }
        }
    } catch (e) {
        console.warn('⚠️ Could not prefill user data:', e);
    }
}

async function handleBooking(e) {
    e.preventDefault();
    console.log('📝 Form submitted');
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    try {
        // Get form values
        const customerName = document.getElementById('customerName').value.trim();
        const contactPhone = document.getElementById('contactPhone').value.trim();
        const deviceModel = document.getElementById('deviceModel').value.trim();
        const deviceIssue = document.getElementById('deviceIssue').value.trim();
        const address = document.getElementById('address').value.trim();
        const preferredDate = document.getElementById('preferredDate').value;
        const preferredTime = document.getElementById('preferredTime').value;
        const notes = document.getElementById('notes').value.trim();
        
        console.log('📋 Form values:', { customerName, contactPhone, deviceModel, address });
        
        // Validate required fields
        if (!customerName || !contactPhone || !deviceModel || !address) {
            throw new Error('Please fill in all required fields.');
        }
        
        // Get user/session info
        let userId = null;
        let sessionId = null;
        
        try {
            const userData = localStorage.getItem('buildbuddy_user') || sessionStorage.getItem('buildbuddy_user');
            if (userData) {
                const user = JSON.parse(userData);
                userId = user.user_id || user.id || null;
            }
        } catch (e) {
            console.warn('⚠️ Could not get user data:', e);
        }
        
        if (!userId) {
            sessionId = localStorage.getItem('buildbuddy_session_id');
            if (!sessionId) {
                sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('buildbuddy_session_id', sessionId);
                console.log('🆕 Created new session ID:', sessionId);
            }
        }
        
        // 1. Create service order
        const orderData = {
            user_id: userId,
            session_id: sessionId,
            service_id: parseInt(serviceId),
            device_model: deviceModel,
            device_issue: deviceIssue || null,
            address: address,
            contact_phone: contactPhone,
            preferred_date: preferredDate || null,
            preferred_time: preferredTime || null,
            notes: notes || null,
            order_status: 'PENDING'
        };
        
        console.log('📝 Creating order:', orderData);
        
        const result = await supabase
            .from('service_orders')
            .insert([orderData])
            .select()
            .single();
        
        console.log('📊 Order result:', result);
        
        // Handle different response formats
        let orderResult = null;
        let orderError = null;
        
        if (Array.isArray(result)) {
            orderResult = result[0] || null;
        } else if (result && typeof result === 'object') {
            if (result.data !== undefined) {
                orderResult = result.data;
                orderError = result.error || null;
            } else if (result.order_id !== undefined) {
                orderResult = result;
            } else {
                orderResult = result.data || result;
            }
        }
        
        if (orderError) {
            console.error('❌ Order insert error:', orderError);
            throw new Error('Failed to create service booking: ' + (orderError.message || 'Unknown error'));
        }
        
        if (!orderResult) {
            console.error('❌ No order result returned');
            throw new Error('Failed to create service booking. No response from server.');
        }
        
        console.log('✅ Service order created:', orderResult);
        
        // 2. Add the service to the cart
        if (serviceData) {
            await addToCart({
                type: 'service',
                id: parseInt(serviceId),
                name: serviceData.service_name,
                price: parseFloat(serviceData.service_price),
                service_order_id: orderResult.order_id
            });
            console.log('✅ Service added to cart');
        } else {
            console.warn('⚠️ Service data not available, adding to cart with limited info');
            await addToCart({
                type: 'service',
                id: parseInt(serviceId),
                name: 'Service #' + serviceId,
                price: 0,
                service_order_id: orderResult.order_id
            });
        }
        
        // 3. Show success
        showSuccessAndRedirect(orderResult);
        
    } catch (error) {
        console.error('❌ Booking error:', error);
        showErrorMessage(error.message || 'Failed to book service. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Confirm Booking';
    }
}

function showSuccessAndRedirect(order) {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Booking Confirmed!';
    submitBtn.style.background = '#4CAF50';
    submitBtn.style.color = 'white';
    
    const form = document.getElementById('bookingForm');
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        text-align: center;
        padding: 30px 20px;
        background: #e8f5e9;
        border-radius: 12px;
        margin-top: 20px;
    `;
    successDiv.innerHTML = `
        <i class="fas fa-check-circle" style="font-size: 48px; color: #4CAF50; margin-bottom: 15px;"></i>
        <h3 style="color: #2e7d32; margin-bottom: 10px;">Service Booked Successfully!</h3>
        <p style="color: #555; margin-bottom: 5px;">Your service has been added to the cart.</p>
        <p style="color: #777; font-size: 14px;">Order #${order.order_id}</p>
        <div style="margin-top: 20px; display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
            <button onclick="window.location.href='cart.html'" class="btn-primary" style="padding: 12px 30px; border: none; border-radius: 8px; background: #00d4ff; color: #1a1a2e; font-weight: 600; cursor: pointer;">
                View Cart <i class="fas fa-arrow-right"></i>
            </button>
            <button onclick="window.location.href='service.html'" class="btn-outline" style="padding: 12px 30px; border: 2px solid #00d4ff; border-radius: 8px; background: transparent; color: #1a1a2e; font-weight: 600; cursor: pointer;">
                <i class="fas fa-arrow-left"></i> More Services
            </button>
        </div>
    `;
    form.appendChild(successDiv);
    
    submitBtn.style.display = 'none';
    document.querySelectorAll('.form-group').forEach(el => el.style.opacity = '0.5');
    document.querySelectorAll('.form-group input, .form-group textarea, .form-group select').forEach(el => el.disabled = true);
    
    setTimeout(() => {
        window.location.href = 'cart.html';
    }, 5000);
}

function showErrorMessage(message) {
    const form = document.getElementById('bookingForm');
    
    const existingError = form.querySelector('.booking-error');
    if (existingError) existingError.remove();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'booking-error';
    errorDiv.style.cssText = `
        background: #ffebee;
        color: #c62828;
        padding: 15px 20px;
        border-radius: 8px;
        margin-bottom: 20px;
        border-left: 4px solid #c62828;
    `;
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span style="margin-left: 10px;">${message}</span>
    `;
    form.prepend(errorDiv);
}

function showError(message) {
    const container = document.querySelector('.booking-container');
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
            <h2 style="color: #1a1a2e; margin-bottom: 10px;">Something Went Wrong</h2>
            <p style="color: #666; margin-bottom: 30px;">${message}</p>
            <a href="service.html" class="btn-primary" style="padding: 12px 30px; border-radius: 8px; background: #00d4ff; color: #1a1a2e; text-decoration: none; font-weight: 600;">
                <i class="fas fa-arrow-left"></i> Back to Services
            </a>
        </div>
    `;
}

console.log('✅ service-booking.js loaded');