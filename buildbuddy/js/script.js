const products = [
    { id: 1, name: "Intel Core i5-13600K", category: "cpu", price: 1299, socket: "LGA1700", specs: "14 Cores, 5.1 GHz" },
    { id: 2, name: "AMD Ryzen 7 7800X3D", category: "cpu", price: 1599, socket: "AM5", specs: "8 Cores, 5.0 GHz" },
    { id: 3, name: "Intel Core i9-14900K", category: "cpu", price: 2399, socket: "LGA1700", specs: "24 Cores, 6.0 GHz" },
    { id: 4, name: "ASUS ROG B760-F", category: "motherboard", price: 899, socket: "LGA1700", ramType: "DDR5", specs: "ATX, WiFi 6" },
    { id: 5, name: "MSI B650 Tomahawk", category: "motherboard", price: 799, socket: "AM5", ramType: "DDR5", specs: "ATX, PCIe 5.0" },
    { id: 6, name: "Gigabyte Z790 Aorus", category: "motherboard", price: 1299, socket: "LGA1700", ramType: "DDR5", specs: "ATX, Thunderbolt" },
    { id: 7, name: "Corsair Vengeance 16GB", category: "ram", price: 299, ramType: "DDR5", speed: "5600MHz", specs: "2x8GB Kit" },
    { id: 8, name: "Kingston Fury 32GB", category: "ram", price: 499, ramType: "DDR5", speed: "6000MHz", specs: "2x16GB Kit" },
    { id: 9, name: "G.Skill Trident 32GB", category: "ram", price: 549, ramType: "DDR5", speed: "6400MHz", specs: "2x16GB RGB" },
    { id: 10, name: "NVIDIA RTX 4070", category: "gpu", price: 2499, specs: "12GB GDDR6X" },
    { id: 11, name: "AMD Radeon RX 7800 XT", category: "gpu", price: 2199, specs: "16GB GDDR6" },
    { id: 12, name: "NVIDIA RTX 4080", category: "gpu", price: 4599, specs: "16GB GDDR6X" }
];

const services = [
    { id: 1, name: "PC Repair", description: "Diagnostic and repair service", price: 80, icon: "fa-tools" },
    { id: 2, name: "PC Assembly", description: "Full custom PC building service", price: 150, icon: "fa-computer" },
    { id: 3, name: "Maintenance", description: "Cleaning and optimization", price: 60, icon: "fa-broom" },
    { id: 4, name: "OS Installation", description: "Windows/Linux setup", price: 50, icon: "fa-windows" }
];

let selectedParts = {
    cpu: null,
    motherboard: null,
    ram: null,
    gpu: null
};

let cart = [];
let compatibilityMode = true;

const productsGrid = document.getElementById('productsGrid');
const servicesGrid = document.getElementById('servicesGrid');
const selectedPartsDisplay = document.getElementById('selectedPartsDisplay');
const compatibilityToggle = document.getElementById('compatibilityMode');
const modal = document.getElementById('compatibilityModal');
const modalMessage = document.getElementById('modalMessage');
const closeModal = document.querySelector('.close-modal');

function renderProducts(category = 'all') {
    const filteredProducts = category === 'all' 
        ? products 
        : products.filter(p => p.category === category);
    
    productsGrid.innerHTML = filteredProducts.map(product => {
        const isSelected = selectedParts[product.category] === product.id;
        
        return `
            <div class="product-card ${isSelected ? 'selected' : ''}">
                ${product.category === 'cpu' ? '<span class="product-badge">CPU</span>' : ''}
                ${product.category === 'motherboard' ? '<span class="product-badge">MB</span>' : ''}
                ${product.category === 'ram' ? '<span class="product-badge">RAM</span>' : ''}
                ${product.category === 'gpu' ? '<span class="product-badge">GPU</span>' : ''}
                <div class="product-image">
                    <i class="fas fa-${getIconForCategory(product.category)}"></i>
                </div>
                <h4>${product.name}</h4>
                <div class="product-specs">${product.specs}</div>
                <div class="product-price">RM ${product.price}</div>
                <div class="product-actions">
                    <button class="btn-add" onclick="addToCart(${product.id})">
                        <i class="fas fa-cart-plus"></i> Add
                    </button>
                    <button class="btn-select" onclick="selectForBuild(${product.id})">
                        Select
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getIconForCategory(category) {
    const icons = {
        cpu: 'microchip',
        motherboard: 'square',
        ram: 'memory',
        gpu: 'tv'
    };
    return icons[category] || 'box';
}

function renderServices() {
    servicesGrid.innerHTML = services.map(service => `
        <div class="service-card">
            <i class="fas ${service.icon}"></i>
            <h4>${service.name}</h4>
            <p>${service.description}</p>
            <div class="service-price">RM ${service.price}</div>
            <button class="btn-book" onclick="bookService(${service.id})">
                Book Now
            </button>
        </div>
    `).join('');
}

function selectForBuild(productId) {
    const product = products.find(p => p.id === productId);
    
    if (compatibilityMode && !checkCompatibility(product)) {
        return;
    }
    
    selectedParts[product.category] = productId;
    updateSelectedPartsDisplay();
    renderProducts(getCurrentCategory());
    
    if (compatibilityMode) {
        showSuccessMessage(`${product.name} added to build!`);
    }
}

function checkCompatibility(newPart) {
    let isCompatible = true;
    let message = '';
    
    if (newPart.category === 'motherboard' && selectedParts.cpu) {
        const cpu = products.find(p => p.id === selectedParts.cpu);
        if (cpu.socket !== newPart.socket) {
            isCompatible = false;
            message = `CPU socket (${cpu.socket}) does not match motherboard socket (${newPart.socket}).`;
        }
    }
    
    if (newPart.category === 'cpu' && selectedParts.motherboard) {
        const mb = products.find(p => p.id === selectedParts.motherboard);
        if (mb.socket !== newPart.socket) {
            isCompatible = false;
            message = `CPU socket (${newPart.socket}) does not match motherboard socket (${mb.socket}).`;
        }
    }
    
    if (newPart.category === 'ram' && selectedParts.motherboard) {
        const mb = products.find(p => p.id === selectedParts.motherboard);
        if (mb.ramType !== newPart.ramType) {
            isCompatible = false;
            message = `RAM type (${newPart.ramType}) is not compatible with motherboard (${mb.ramType}).`;
        }
    }
    
    if (!isCompatible) {
        showModal('Incompatible Parts', message);
        return false;
    }
    
    return true;
}

function showModal(title, message) {
    modalMessage.innerHTML = `
        <p><strong>${title}</strong></p>
        <p>${message}</p>
        <p style="margin-top: 15px; color: #00d4ff;">
            <i class="fas fa-lightbulb"></i> 
            AI Suggestion: Try selecting compatible parts from the same generation.
        </p>
    `;
    modal.style.display = 'flex';
}

function showSuccessMessage(message) {
    modalMessage.innerHTML = `
        <p><i class="fas fa-check-circle" style="color: #4CAF50; font-size: 24px;"></i></p>
        <p><strong>Success!</strong></p>
        <p>${message}</p>
    `;
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.display = 'none';
    }, 2000);
}

function updateSelectedPartsDisplay() {
    const parts = [];
    for (const category in selectedParts) {
        if (selectedParts[category]) {
            const part = products.find(p => p.id === selectedParts[category]);
            parts.push(`${category.toUpperCase()}: ${part.name}`);
        }
    }
    selectedPartsDisplay.textContent = parts.length ? parts.join(' | ') : 'No parts selected';
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    cart.push(product);
    updateCartCount();
    showSuccessMessage(`${product.name} added to cart!`);
}

function updateCartCount() {
    document.querySelector('.cart-count').textContent = cart.length;
}

function bookService(serviceId) {
    const service = services.find(s => s.id === serviceId);
    showSuccessMessage(`Service booked: ${service.name}`);
}

function getCurrentCategory() {
    const activeCategory = document.querySelector('.category-item.active');
    return activeCategory ? activeCategory.dataset.category : 'all';
}

document.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        renderProducts(item.dataset.category);
    });
});

compatibilityToggle.addEventListener('change', (e) => {
    compatibilityMode = e.target.checked;
});

document.getElementById('startBuilderBtn').addEventListener('click', () => {
    selectedParts = { cpu: null, motherboard: null, ram: null, gpu: null };
    updateSelectedPartsDisplay();
    renderProducts(getCurrentCategory());
    showSuccessMessage('PC Builder started! Select components to begin.');
});

closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

renderProducts();
renderServices();
updateSelectedPartsDisplay();