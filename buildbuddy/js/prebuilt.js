// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\prebuilt.js

import supabase from './supabase-client.js';
import Pc3DViewer from './services/buildcores.js';
import { 
    getUser, 
    getCartCount, 
    updateCartCountDisplay, 
    initCart,
    setupLoginButton 
} from './cart-utils.js';

let bundles = [];
let allInventory = [];
let currentFilter = 'all';
let currentBundle = null;
let pcViewer = null;

document.addEventListener('DOMContentLoaded', async () => {
    // ✅ Setup login button first
    setupLoginButton();
    
    // ✅ Initialize cart
    await initCart();
    
    // ✅ Update cart count
    await updateCartCountDisplay();
    
    await loadInventory();
    await loadBundles();
    setupFilterListeners();
    updateCartCount();
    
    // Initialize 3D viewer (will be ready when modal opens)
    pcViewer = new Pc3DViewer();
});

async function loadInventory() {
    try {
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .order('i_category');
        
        if (error) {
            console.error('Error loading inventory:', error);
            return;
        }
        
        allInventory = data || [];
    } catch (error) {
        console.error('Error loading inventory:', error);
        allInventory = [];
    }
}

async function loadBundles() {
    try {
        // Get all bundles
        const { data: bundleData, error: bundleError } = await supabase
            .from('bundles')
            .select('*')
            .order('bundle_price');
        
        if (bundleError) {
            console.error('Supabase error:', bundleError);
            showError('Failed to load pre-built PCs');
            return;
        }
        
        // Get bundle items and inventory data separately
        const bundlesWithItems = await Promise.all((bundleData || []).map(async (bundle) => {
            // Get bundle items
            const { data: items, error: itemsError } = await supabase
                .from('bundle_items')
                .select('*')
                .eq('bundle_id', bundle.bundle_id);
            
            if (itemsError) {
                console.error('Error loading items for bundle', bundle.bundle_id, itemsError);
                return {
                    ...bundle,
                    bundle_items: []
                };
            }
            
            // Get inventory details for each item
            const itemsWithInventory = await Promise.all((items || []).map(async (item) => {
                const { data: inventory, error: invError } = await supabase
                    .from('inventory')
                    .select('*')
                    .eq('i_id', item.i_id)
                    .single();
                
                if (invError) {
                    console.error('Error loading inventory for item', item.i_id, invError);
                    return {
                        ...item,
                        inventory: null
                    };
                }
                
                return {
                    ...item,
                    inventory: inventory
                };
            }));
            
            return {
                ...bundle,
                bundle_items: itemsWithInventory
            };
        }));
        
        bundles = bundlesWithItems;
        renderBundles();
        
    } catch (error) {
        console.error('Error loading bundles:', error);
        showError('Failed to load pre-built PCs');
    }
}

function renderBundles() {
    const grid = document.getElementById('prebuiltGrid');
    if (!grid) return;
    
    const bundlesArray = Array.isArray(bundles) ? bundles : [];
    
    const filteredBundles = currentFilter === 'all' 
        ? bundlesArray 
        : bundlesArray.filter(b => b.bundle_category === currentFilter);
    
    if (!filteredBundles || filteredBundles.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="text-align:center;padding:60px 20px;grid-column:1/-1;">
                <i class="fas fa-box-open" style="font-size:48px;color:#ccc;margin-bottom:20px;display:block;"></i>
                <p style="color:#666;font-size:16px;">No pre-built PCs found in this category.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredBundles.map(bundle => {
        const stockStatus = getStockStatus(bundle.bundle_stock);
        const badgeClass = `badge-${bundle.bundle_category}`;
        const imageUrl = getImageUrl(bundle.bundle_image_url);
        
        // Extract specs from bundle_items
        const specs = extractSpecsFromItems(bundle.bundle_items);
        
        return `
            <div class="prebuilt-card" onclick="viewBundleDetails(${bundle.bundle_id})">
                <div class="prebuilt-image">
                    ${imageUrl ? 
                        `<img src="${imageUrl}" alt="${bundle.bundle_name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'; this.parentElement.querySelector('.fallback-icon').style.display='flex';">` :
                        ''
                    }
                    <i class="fas fa-desktop fallback-icon" style="${imageUrl ? 'display:none;' : 'display:flex;'}"></i>
                    <span class="prebuilt-badge ${badgeClass}">${bundle.bundle_category}</span>
                </div>
                <div class="prebuilt-content">
                    <h3 class="prebuilt-name">${escapeHtml(bundle.bundle_name)}</h3>
                    <p class="prebuilt-desc">${escapeHtml(bundle.bundle_description || 'High-quality pre-built PC')}</p>
                    
                    <div class="prebuilt-specs">
                        ${renderSpecs(specs)}
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

function getImageUrl(imagePath) {
    if (!imagePath) return null;
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    
    const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
    return `${SUPABASE_URL}/storage/v1/object/public/images/${encodeURIComponent(imagePath)}`;
}

function extractSpecsFromItems(bundleItems) {
    const specs = {};
    
    if (!bundleItems || !Array.isArray(bundleItems)) return specs;
    
    for (const item of bundleItems) {
        const inv = item.inventory;
        if (!inv) continue;
        
        switch (inv.i_category) {
            case 'cpu':
                specs.cpu = inv.i_name;
                // Build CPU specs - only non-empty
                let cpuSpecs = [];
                if (inv.i_cpu_cores) cpuSpecs.push(`${inv.i_cpu_cores} Cores`);
                if (inv.i_cpu_clock_speed) cpuSpecs.push(inv.i_cpu_clock_speed);
                if (cpuSpecs.length > 0) specs.cpu_specs = cpuSpecs.join(' • ');
                break;
            case 'ram':
                specs.ram = inv.i_name;
                // Build RAM specs - only non-empty
                let ramSpecs = [];
                if (inv.i_ram_speed) ramSpecs.push(inv.i_ram_speed);
                if (inv.i_ram_type) ramSpecs.push(inv.i_ram_type);
                if (ramSpecs.length > 0) specs.ram_specs = ramSpecs.join(', ');
                break;
            case 'gpu':
                specs.gpu = inv.i_name;
                if (inv.i_gpu_memory) specs.gpu_specs = inv.i_gpu_memory;
                break;
            case 'storage':
                specs.storage = inv.i_name;
                let storageSpecs = [];
                if (inv.i_storage_type) storageSpecs.push(inv.i_storage_type);
                if (inv.i_storage_speed) storageSpecs.push(inv.i_storage_speed);
                if (storageSpecs.length > 0) specs.storage_specs = storageSpecs.join(' • ');
                break;
            case 'motherboard':
                specs.motherboard = inv.i_name;
                let moboSpecs = [];
                if (inv.i_motherboard_socket) moboSpecs.push(inv.i_motherboard_socket);
                if (inv.i_motherboard_chipset) moboSpecs.push(inv.i_motherboard_chipset);
                if (moboSpecs.length > 0) specs.motherboard_specs = moboSpecs.join(' • ');
                break;
            case 'psu':
                specs.psu = inv.i_name;
                let psuSpecs = [];
                if (inv.i_psu_wattage) psuSpecs.push(`${inv.i_psu_wattage}W`);
                if (inv.i_psu_certification) psuSpecs.push(inv.i_psu_certification);
                if (psuSpecs.length > 0) specs.psu_specs = psuSpecs.join(' • ');
                break;
            case 'cooler':
                specs.cooler = inv.i_name;
                break;
        }
    }
    
    return specs;
}

function renderSpecs(specs) {
    if (!specs || typeof specs !== 'object') return '';
    
    const specItems = [];
    
    // CPU
    if (specs.cpu) {
        let cpuDisplay = specs.cpu;
        if (specs.cpu_specs) {
            cpuDisplay += ` (${specs.cpu_specs})`;
        }
        specItems.push(`<span class="spec-tag"><i class="fas fa-microchip"></i> ${escapeHtml(cpuDisplay)}</span>`);
    }
    
    // RAM
    if (specs.ram) {
        let ramDisplay = specs.ram;
        if (specs.ram_specs) {
            ramDisplay += ` (${specs.ram_specs})`;
        }
        specItems.push(`<span class="spec-tag"><i class="fas fa-memory"></i> ${escapeHtml(ramDisplay)}</span>`);
    }
    
    // GPU
    if (specs.gpu) {
        let gpuDisplay = specs.gpu;
        if (specs.gpu_specs) {
            gpuDisplay += ` (${specs.gpu_specs})`;
        }
        specItems.push(`<span class="spec-tag"><i class="fas fa-tv"></i> ${escapeHtml(gpuDisplay)}</span>`);
    }
    
    // Storage
    if (specs.storage) {
        let storageDisplay = specs.storage;
        if (specs.storage_specs) {
            storageDisplay += ` (${specs.storage_specs})`;
        }
        specItems.push(`<span class="spec-tag"><i class="fas fa-hdd"></i> ${escapeHtml(storageDisplay)}</span>`);
    }
    
    // Motherboard
    if (specs.motherboard) {
        let moboDisplay = specs.motherboard;
        if (specs.motherboard_specs) {
            moboDisplay += ` (${specs.motherboard_specs})`;
        }
        specItems.push(`<span class="spec-tag"><i class="fas fa-square"></i> ${escapeHtml(moboDisplay)}</span>`);
    }
    
    // PSU
    if (specs.psu) {
        let psuDisplay = specs.psu;
        if (specs.psu_specs) {
            psuDisplay += ` (${specs.psu_specs})`;
        }
        specItems.push(`<span class="spec-tag"><i class="fas fa-plug"></i> ${escapeHtml(psuDisplay)}</span>`);
    }
    
    // Cooler
    if (specs.cooler) {
        specItems.push(`<span class="spec-tag"><i class="fas fa-fan"></i> ${escapeHtml(specs.cooler)}</span>`);
    }
    
    return specItems.join('');
}

function getStockStatus(stock) {
    const numStock = parseInt(stock) || 0;
    if (numStock > 5) {
        return { text: 'In Stock', class: 'in-stock' };
    } else if (numStock > 0) {
        return { text: `Only ${numStock} left`, class: 'low-stock' };
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.viewBundleDetails = function(bundleId) {
    const bundle = bundles.find(b => b.bundle_id === bundleId);
    if (bundle) {
        currentBundle = bundle;
        showBundleDetailModal(bundle);
    }
};

function showBundleDetailModal(bundle) {
    const specs = extractSpecsFromItems(bundle.bundle_items);
    const imageUrl = getImageUrl(bundle.bundle_image_url);
    const stockStatus = getStockStatus(bundle.bundle_stock);
    
    // Build component list with specs
    let componentsHtml = '';
    const componentMap = {
        cpu: { icon: 'microchip', label: 'CPU', data: specs },
        ram: { icon: 'memory', label: 'RAM', data: specs },
        gpu: { icon: 'tv', label: 'GPU', data: specs },
        storage: { icon: 'hdd', label: 'Storage', data: specs },
        motherboard: { icon: 'square', label: 'Motherboard', data: specs },
        psu: { icon: 'plug', label: 'PSU', data: specs },
        cooler: { icon: 'fan', label: 'Cooler', data: specs }
    };
    
    // Build components display
    const componentKeys = ['cpu', 'ram', 'gpu', 'storage', 'motherboard', 'psu', 'cooler'];
    for (const key of componentKeys) {
        const specKey = key;
        const specValue = specs[specKey];
        if (specValue) {
            const info = componentMap[key];
            let displayText = specValue;
            // Add specs if available
            const specDetailKey = key + '_specs';
            if (specs[specDetailKey]) {
                displayText += ` (${specs[specDetailKey]})`;
            }
            componentsHtml += `
                <div style="
                    background: #f8f9fc;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <i class="fas fa-${info.icon}" style="color: #00d4ff; width: 16px;"></i>
                    <span style="font-weight: 500;">${escapeHtml(displayText)}</span>
                </div>
            `;
        }
    }
    
    const modal = document.createElement('div');
    modal.className = 'bundle-detail-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(8px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
        overflow-y: auto;
        padding: 20px;
    `;
    
    modal.innerHTML = `
        <div class="bundle-detail-content" style="
            background: white;
            border-radius: 20px;
            max-width: 1200px;
            width: 100%;
            max-height: 95vh;
            overflow-y: auto;
            padding: 30px;
            position: relative;
            animation: slideUp 0.3s ease;
        ">
            <button onclick="this.closest('.bundle-detail-modal').remove()" style="
                position: sticky;
                top: 0;
                float: right;
                background: none;
                border: none;
                font-size: 28px;
                cursor: pointer;
                color: #999;
                z-index: 10;
                padding: 5px 10px;
            " onmouseover="this.style.color='#333'" onmouseout="this.style.color='#999'">
                <i class="fas fa-times"></i>
            </button>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                <!-- Left Column: Images and 3D -->
                <div>
                    <!-- Main Image -->
                    <div style="
                        width: 100%;
                        height: 300px;
                        background: #f8f9fc;
                        border-radius: 12px;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 15px;
                        border: 1px solid #e8e8e8;
                    ">
                        ${imageUrl ? 
                            `<img src="${imageUrl}" alt="${bundle.bundle_name}" style="width:100%;height:100%;object-fit:contain;padding:20px;">` :
                            `<i class="fas fa-desktop" style="font-size:64px;color:#ccc;"></i>`
                        }
                    </div>
                    
                    <!-- 3D Viewer -->
                    <div style="
                        width: 100%;
                        height: 350px;
                        background: #1a1a2e;
                        border-radius: 12px;
                        overflow: hidden;
                        position: relative;
                        border: 1px solid #e8e8e8;
                    ">
                        <div id="pc3dViewer" style="width:100%;height:100%;position:relative;"></div>
                        <div style="
                            position: absolute;
                            bottom: 10px;
                            right: 15px;
                            color: rgba(255,255,255,0.4);
                            font-size: 11px;
                            pointer-events: none;
                            z-index: 5;
                        ">
                            <i class="fas fa-cube"></i> 3D Preview
                        </div>
                    </div>
                </div>
                
                <!-- Right Column: Details -->
                <div>
                    <span class="prebuilt-badge badge-${bundle.bundle_category}" style="
                        display: inline-block;
                        padding: 4px 14px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                        background: #00d4ff;
                        color: #1a1a2e;
                        margin-bottom: 10px;
                    ">${bundle.bundle_category}</span>
                    
                    <h2 style="color: #1a1a2e; margin-bottom: 5px; font-size: 28px;">${escapeHtml(bundle.bundle_name)}</h2>
                    <p style="color: #666; margin-bottom: 15px;">${escapeHtml(bundle.bundle_description || 'High-quality pre-built PC')}</p>
                    
                    <div style="font-size: 32px; font-weight: 700; color: #00d4ff; margin-bottom: 15px;">
                        RM ${bundle.bundle_price}
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <span class="stock-badge ${stockStatus.class}" style="
                            padding: 6px 16px;
                            border-radius: 20px;
                            font-size: 14px;
                            font-weight: 600;
                            ${stockStatus.class === 'in-stock' ? 'background:#e8f5e9;color:#2e7d32;' : ''}
                            ${stockStatus.class === 'low-stock' ? 'background:#fff3e0;color:#e65100;' : ''}
                            ${stockStatus.class === 'out-of-stock' ? 'background:#ffebee;color:#c62828;' : ''}
                        ">${stockStatus.text}</span>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #1a1a2e; margin-bottom: 10px;">Components</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            ${componentsHtml}
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 12px; margin-top: 20px;">
                        <button onclick="window.addBundleToCart(${bundle.bundle_id})" style="
                            flex: 1;
                            padding: 14px;
                            background: #00d4ff;
                            color: #1a1a2e;
                            border: none;
                            border-radius: 10px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 10px;
                        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 20px rgba(0,212,255,0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                            <i class="fas fa-shopping-cart"></i> Add to Cart
                        </button>
                        <button onclick="this.closest('.bundle-detail-modal').remove()" style="
                            padding: 14px 24px;
                            background: #f0f0f5;
                            color: #666;
                            border: none;
                            border-radius: 10px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s;
                        " onmouseover="this.style.background='#e0e0e5'" onmouseout="this.style.background='#f0f0f5'">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load 3D model after modal is rendered
    setTimeout(() => {
        load3DModelForBundle(bundle);
    }, 300);
    
    // Close on click outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function load3DModelForBundle(bundle) {
    try {
        console.log('Loading 3D model for bundle:', bundle.bundle_id);
        
        const viewerContainer = document.getElementById('pc3dViewer');
        if (!viewerContainer) {
            console.warn('3D viewer container not found');
            return;
        }

        // Extract components from bundle_items
        const components = [];
        if (bundle.bundle_items && Array.isArray(bundle.bundle_items)) {
            bundle.bundle_items.forEach(item => {
                const inv = item.inventory;
                if (inv) {
                    // Build specs string - only include non-empty values
                    let specs = [];
                    
                    if (inv.i_category === 'cpu') {
                        if (inv.i_cpu_cores) specs.push(`${inv.i_cpu_cores} Cores`);
                        if (inv.i_cpu_clock_speed) specs.push(inv.i_cpu_clock_speed);
                    } else if (inv.i_category === 'ram') {
                        // Build RAM specs - skip empty values
                        let ramSpecs = [];
                        if (inv.i_ram_speed) ramSpecs.push(inv.i_ram_speed);
                        if (inv.i_ram_type) ramSpecs.push(inv.i_ram_type);
                        if (ramSpecs.length > 0) specs.push(ramSpecs.join(', '));
                    } else if (inv.i_category === 'gpu') {
                        if (inv.i_gpu_memory) specs.push(inv.i_gpu_memory);
                    } else if (inv.i_category === 'storage') {
                        if (inv.i_storage_type) specs.push(inv.i_storage_type);
                        if (inv.i_storage_speed) specs.push(inv.i_storage_speed);
                    } else if (inv.i_category === 'motherboard') {
                        if (inv.i_motherboard_socket) specs.push(inv.i_motherboard_socket);
                        if (inv.i_motherboard_chipset) specs.push(inv.i_motherboard_chipset);
                    } else if (inv.i_category === 'psu') {
                        if (inv.i_psu_wattage) specs.push(`${inv.i_psu_wattage}W`);
                        if (inv.i_psu_certification) specs.push(inv.i_psu_certification);
                    }
                    
                    components.push({
                        name: inv.i_name || 'Unknown Component',
                        category: inv.i_category || 'component',
                        brand: inv.i_brand || '',
                        price: inv.i_price || 0,
                        quantity: item.quantity || 1,
                        specs: specs.join(' • ') || '',
                        image_path: inv.i_image_path || null
                    });
                }
            });
        }
        
        console.log('Extracted components for 3D:', components);

        // Initialize viewer with components
        if (!pcViewer) {
            pcViewer = new Pc3DViewer();
        }
        
        // Set container
        pcViewer.container = viewerContainer;
        
        if (components.length > 0) {
            // Initialize and display
            pcViewer.init('pc3dViewer').then(() => {
                pcViewer.displayComponents(components, {
                    autostart: '1',
                    controls: true,
                    infos: false
                });
            }).catch(err => {
                console.error('Error initializing 3D viewer:', err);
                showFallbackViewer(viewerContainer);
            });
        } else {
            viewerContainer.innerHTML = `
                <div style="
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border-radius: 12px;
                    color: rgba(255,255,255,0.5);
                    font-size: 14px;
                    flex-direction: column;
                    gap: 10px;
                ">
                    <i class="fas fa-info-circle" style="font-size: 32px; color: #ffd93d;"></i>
                    <p>No components found for this bundle</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading 3D model:', error);
        const viewerContainer = document.getElementById('pc3dViewer');
        if (viewerContainer) {
            showFallbackViewer(viewerContainer);
        }
    }
}

function showFallbackViewer(container) {
    container.innerHTML = `
        <div style="
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 12px;
            color: rgba(255,255,255,0.3);
            font-size: 14px;
            flex-direction: column;
            gap: 10px;
        ">
            <i class="fas fa-cube" style="font-size: 48px; opacity: 0.3;"></i>
            <p>3D view temporarily unavailable</p>
            <button onclick="location.reload()" style="
                margin-top: 10px;
                padding: 8px 20px;
                background: #00d4ff;
                color: #1a1a2e;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            ">
                <i class="fas fa-sync-alt"></i> Retry
            </button>
        </div>
    `;
}

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
    if (grid) {
        grid.innerHTML = `
            <div class="empty-state" style="text-align:center;padding:60px 20px;grid-column:1/-1;">
                <i class="fas fa-exclamation-circle" style="font-size:48px;color:#f44336;margin-bottom:20px;display:block;"></i>
                <p style="color:#666;font-size:16px;">${escapeHtml(message)}</p>
                <button onclick="location.reload()" style="margin-top:15px;padding:10px 30px;background:#00d4ff;color:#1a1a2e;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
                    <i class="fas fa-sync-alt"></i> Retry
                </button>
            </div>
        `;
    }
}

window.addBundleToCart = async function(bundleId) {
    try {
        const bundle = bundles.find(b => b.bundle_id === bundleId);
        if (!bundle) {
            showToast('Bundle not found', 'error');
            return;
        }
        
        if (bundle.bundle_stock <= 0) {
            showToast('Sorry, this bundle is out of stock', 'error');
            return;
        }
        
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
        
        showToast(`${bundle.bundle_name} added to cart!`, 'success');
    } catch (error) {
        console.error('Error adding to cart:', error);
        showToast('Failed to add to cart', 'error');
    }
};

function showToast(message, type = 'success') {
    const existing = document.querySelector('.custom-toast');
    if (existing) existing.remove();
    
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#00d4ff'
    };
    
    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: ${colors[type] || '#1a1a2e'};
        color: white;
        padding: 14px 24px;
        border-radius: 12px;
        z-index: 99999;
        box-shadow: 0 8px 30px rgba(0,0,0,0.25);
        animation: slideUp 0.4s ease;
        max-width: 400px;
        font-size: 14px;
        font-weight: 500;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Add animations if not exists
if (!document.getElementById('toast-animation-style')) {
    const style = document.createElement('style');
    style.id = 'toast-animation-style';
    style.textContent = `
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

console.log('✅ prebuilt.js loaded with image and 3D viewer support');