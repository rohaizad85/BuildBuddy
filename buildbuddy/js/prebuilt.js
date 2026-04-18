import dataService from './data-service.js';
import supabase from './supabase-client.js';

let bundles = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    await loadBundles();
    setupFilterListeners();
    updateCartCount();
});

async function loadBundles() {
    try {
        const data = await supabase
            .from('bundles')
            .select('*')
            .order('bundle_price');
        
        bundles = data || [];
        renderBundles();
    } catch (error) {
        console.error('Error loading bundles:', error);
        showError('Failed to load pre-built PCs');
    }
}

function renderBundles() {
    const grid = document.getElementById('prebuiltGrid');
    
    const filteredBundles = currentFilter === 'all' 
        ? bundles 
        : bundles.filter(b => b.bundle_category === currentFilter);
    
    if (filteredBundles.length === 0) {
        grid.innerHTML = `
            <div class="loading-container">
                <i class="fas fa-box-open" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
                <p>No pre-built PCs found in this category.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredBundles.map(bundle => {
        const stockStatus = getStockStatus(bundle.bundle_stock);
        const badgeClass = `badge-${bundle.bundle_category}`;
        
        return `
            <div class="prebuilt-card" onclick="viewBundleDetails(${bundle.bundle_id})">
                <div class="prebuilt-image">
                    <i class="fas fa-desktop"></i>
                    <span class="prebuilt-badge ${badgeClass}">${bundle.bundle_category}</span>
                </div>
                <div class="prebuilt-content">
                    <h3 class="prebuilt-name">${bundle.bundle_name}</h3>
                    <p class="prebuilt-desc">${bundle.bundle_description || 'High-quality pre-built PC'}</p>
                    
                    <div class="prebuilt-specs">
                        ${renderSpecs(bundle.bundle_specs)}
                    </div>
                    
                    <div class="prebuilt-footer">
                        <span class="prebuilt-price">RM ${bundle.bundle_price}</span>
                        <span class="stock-badge ${stockStatus.class}">${stockStatus.text}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderSpecs(specs) {
    if (!specs) return '';
    
    const specItems = [];
    if (specs.cpu) specItems.push(`<span class="spec-tag"><i class="fas fa-microchip"></i> ${specs.cpu}</span>`);
    if (specs.ram) specItems.push(`<span class="spec-tag"><i class="fas fa-memory"></i> ${specs.ram}</span>`);
    if (specs.gpu) specItems.push(`<span class="spec-tag"><i class="fas fa-tv"></i> ${specs.gpu}</span>`);
    if (specs.storage) specItems.push(`<span class="spec-tag"><i class="fas fa-hdd"></i> ${specs.storage}</span>`);
    
    return specItems.join('');
}

function getStockStatus(stock) {
    if (stock > 5) {
        return { text: 'In Stock', class: 'in-stock' };
    } else if (stock > 0) {
        return { text: `Only ${stock} left`, class: 'low-stock' };
    } else {
        return { text: 'Out of Stock', class: 'out-of-stock' };
    }
}

function setupFilterListeners() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderBundles();
        });
    });
}

window.viewBundleDetails = function(bundleId) {
    window.location.href = `prebuilt-detail.html?id=${bundleId}`;
};

function updateCartCount() {
    const cartCount = document.querySelector('.cart-count');
    if (cartCount) {
        const savedCart = localStorage.getItem('buildbuddy_cart');
        const count = savedCart ? JSON.parse(savedCart).length : 0;
        cartCount.textContent = count;
    }
}

function showError(message) {
    const grid = document.getElementById('prebuiltGrid');
    grid.innerHTML = `
        <div class="loading-container">
            <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
            <p>${message}</p>
        </div>
    `;
}

window.addBundleToCart = async function(bundleId) {
    try {
        const bundle = bundles.find(b => b.bundle_id === bundleId);
        if (!bundle) return;
        
        const cart = JSON.parse(localStorage.getItem('buildbuddy_cart')) || [];
        const existingItem = cart.find(item => item.type === 'bundle' && item.id === bundleId);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                type: 'bundle',
                id: bundleId,
                name: bundle.bundle_name,
                price: bundle.bundle_price,
                quantity: 1
            });
        }
        
        localStorage.setItem('buildbuddy_cart', JSON.stringify(cart));
        updateCartCount();
        
        alert(`${bundle.bundle_name} added to cart!`);
    } catch (error) {
        console.error('Error adding to cart:', error);
        alert('Failed to add to cart');
    }
};