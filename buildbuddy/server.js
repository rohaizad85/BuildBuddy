require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Your Supabase config
const SUPABASE_URL = 'https://kkloxbmybhoawojaovtj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || '';

// Inventory cache
let inventory = [];
let inventoryLoaded = false;

async function loadInventory() {
    if (inventoryLoaded) return inventory;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/inventory?select=*`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        inventory = await res.json();
        inventoryLoaded = true;
        console.log('Inventory loaded:', inventory.length, 'items');
    } catch (e) {
        console.error('Failed to load inventory:', e.message);
        inventory = [];
    }
    return inventory;
}

app.use(express.json());
app.use(express.static('.'));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.post('/api/gemini-compat', async (req, res) => {
    const { prompt } = req.body;
    console.log('Checking compatibility...');
    
    await loadInventory();
    
    // Parse parts from prompt
    const lines = prompt.split('\n').filter(l => l.startsWith('- '));
    const parts = [];
    lines.forEach(l => {
        const m = l.match(/- (\w+): (.+) \((.+)\)/) || l.match(/- (\w+): (.+)/);
        if (m) parts.push({ category: m[1].toUpperCase(), name: m[2], brand: m[3] || '' });
    });
    
    console.log('Parts:', parts.map(p => p.name).join(', '));
    
    const cpu = parts.find(p => p.category === 'CPU');
    const mobo = parts.find(p => p.category === 'MOTHERBOARD');
    const ram = parts.find(p => p.category === 'RAM');
    const gpu = parts.find(p => p.category === 'GPU');
    const psu = parts.find(p => p.category === 'PSU');
    const storage = parts.find(p => p.category === 'STORAGE');
    
    const compatibility = [];
    const issues = [];
    const alternatives = [];
    
    const partDetails = parts.map(p => ({
        name: p.name,
        category: p.category,
        role: getRole(p.category),
        note: getNote(p.category)
    }));
    
    // CPU + Motherboard check
    if (cpu && mobo) {
        const cb = cpu.brand.toLowerCase();
        const mb = mobo.brand.toLowerCase();
        
        if (cb.includes('intel') && mb.includes('amd')) {
            compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'incompatible', detail: 'Intel CPU requires Intel-compatible motherboard (LGA1700 socket)' });
            issues.push({ part: mobo.name, problem: 'Incompatible with Intel CPU', severity: 'critical' });
            
            // Suggest Intel motherboards
            const intelMobos = inventory.filter(i => i.i_category === 'motherboard' && (i.i_brand?.toLowerCase().includes('asus') || i.i_brand?.toLowerCase().includes('gigabyte') || i.i_name?.toLowerCase().includes('b760') || i.i_name?.toLowerCase().includes('z790')));
            if (intelMobos.length) {
                alternatives.push({
                    replace: mobo.name,
                    reason: 'Intel-compatible motherboards from our stock:',
                    options: intelMobos.slice(0, 3).map(i => ({ id: i.i_id, name: i.i_name, price: i.i_price, brand: i.i_brand }))
                });
            }
        } else if (cb.includes('amd') && mb.includes('intel')) {
            compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'incompatible', detail: 'AMD CPU requires AMD-compatible motherboard (AM5 socket)' });
            issues.push({ part: mobo.name, problem: 'Incompatible with AMD CPU', severity: 'critical' });
            
            // Suggest AMD motherboards
            const amdMobos = inventory.filter(i => i.i_category === 'motherboard' && (i.i_brand?.toLowerCase().includes('msi') || i.i_brand?.toLowerCase().includes('asrock') || i.i_name?.toLowerCase().includes('b650')));
            if (amdMobos.length) {
                alternatives.push({
                    replace: mobo.name,
                    reason: 'AMD-compatible motherboards from our stock:',
                    options: amdMobos.slice(0, 3).map(i => ({ id: i.i_id, name: i.i_name, price: i.i_price, brand: i.i_brand }))
                });
            }
        } else if (cb.includes('amd') && (mb.includes('msi') || mb.includes('asrock') || mobo.name?.toLowerCase().includes('b650'))) {
            compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'compatible', detail: 'AMD AM5 CPU and motherboard - perfect match' });
        } else if (cb.includes('intel') && (mb.includes('asus') || mb.includes('gigabyte') || mobo.name?.toLowerCase().includes('b760') || mobo.name?.toLowerCase().includes('z790'))) {
            compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'compatible', detail: 'Intel CPU and motherboard - perfect match' });
        } else {
            compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'warning', detail: 'Check socket compatibility - verify before purchase' });
        }
    }
    
    // RAM check
    if (ram) {
        compatibility.push({ parts: ram.name, status: 'compatible', detail: 'DDR5 RAM - compatible with modern motherboards' });
    }
    
    // GPU check
    if (gpu) {
        compatibility.push({ parts: gpu.name, status: 'compatible', detail: 'Compatible with PCIe x16 slot on any modern motherboard' });
    }
    
    // PSU check
    if (psu) {
        const wattMatch = psu.name?.match(/(\d+)/);
        const watts = wattMatch ? parseInt(wattMatch[0]) : 0;
        if (gpu && gpu.name?.toLowerCase().includes('4090') && watts < 850) {
            compatibility.push({ parts: psu.name, status: 'warning', detail: `PSU may be underpowered for high-end GPU (${watts}W might not suffice)` });
            issues.push({ part: psu.name, problem: 'PSU wattage may be insufficient', severity: 'warning' });
            
            // Suggest higher wattage PSUs
            const highPSUs = inventory.filter(i => i.i_category === 'psu').sort((a, b) => b.i_price - a.i_price);
            if (highPSUs.length) {
                alternatives.push({
                    replace: psu.name,
                    reason: 'Higher wattage PSUs for your build:',
                    options: highPSUs.slice(0, 2).map(i => ({ id: i.i_id, name: i.i_name, price: i.i_price, brand: i.i_brand }))
                });
            }
        } else {
            compatibility.push({ parts: psu.name, status: 'compatible', detail: `${watts}W PSU - sufficient for standard builds` });
        }
    }
    
    // Storage check
    if (storage) {
        compatibility.push({ parts: storage.name, status: 'compatible', detail: 'NVMe SSD - fast storage for OS and applications' });
    }
    
    // GPU brand match suggestions
    if (cpu && gpu) {
        const cb = cpu.brand.toLowerCase();
        const gb = gpu.brand.toLowerCase();
        if (cb.includes('amd') && gb.includes('amd')) {
            compatibility.push({ parts: `${cpu.name} + ${gpu.name}`, status: 'compatible', detail: 'AMD CPU + AMD GPU enables Smart Access Memory for extra performance' });
        }
    }
    
    const suggestions = [];
    if (parts.length < 4) suggestions.push('Add RAM and storage to complete your build');
    if (!psu) suggestions.push('Don\'t forget to add a power supply');
    if (!cpu || !mobo) suggestions.push('Start by selecting a compatible CPU and motherboard pair');
    
    const result = {
        compatible: issues.filter(i => i.severity === 'critical').length === 0,
        confidence: issues.length ? 'medium' : 'high',
        summary: issues.filter(i => i.severity === 'critical').length ? 'Critical issues found!' : 
                 issues.length ? 'Minor warnings - review below' : 'All components look compatible',
        compatibility,
        partDetails,
        issues,
        alternatives,
        suggestions,
        bottlenecks: [],
        estimatedWattage: gpu?.name?.toLowerCase().includes('4090') ? 850 : gpu?.name?.toLowerCase().includes('4080') ? 750 : 500
    };
    
    console.log('Result:', result.summary);
    res.json(result);
});

function getRole(category) {
    const roles = {
        'CPU': 'The brain of the PC - processes all instructions',
        'MOTHERBOARD': 'Main circuit board connecting all components',
        'RAM': 'Temporary memory for active tasks and apps',
        'GPU': 'Handles graphics for games and display',
        'STORAGE': 'Permanent storage for OS and files',
        'PSU': 'Supplies power to all components',
        'COOLER': 'Keeps CPU temperature in safe range'
    };
    return roles[category] || 'Essential PC component';
}

function getNote(category) {
    const notes = {
        'CPU': 'Match with compatible motherboard socket',
        'MOTHERBOARD': 'Must match CPU socket type',
        'RAM': 'DDR5 recommended for new builds',
        'GPU': 'Ensure PSU has enough wattage',
        'PSU': 'Choose wattage based on GPU requirements',
        'COOLER': 'Required for all CPUs'
    };
    return notes[category] || '';
}

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
    loadInventory();
});