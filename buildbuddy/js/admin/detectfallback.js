// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\admin\detectfallback.js

// ============================================
// FALLBACK BRAND AND CATEGORY DETECTION
// No API calls - uses pattern matching only
// ============================================

const brandPatterns = {
    // CPU Brands
    'Intel': ['intel', 'core i', 'i9-', 'i7-', 'i5-', 'i3-', 'xeon', 'pentium', 'celeron', 'ultra 9', 'ultra 7', 'ultra 5'],
    'AMD': ['amd', 'ryzen', 'threadripper', 'athlon', 'epyc', 'ryzen 9', 'ryzen 7', 'ryzen 5', 'ryzen 3'],
    
    // GPU Brands
    'NVIDIA': ['nvidia', 'geforce', 'rtx', 'gtx', 'titan', 'quadro', 'rtx 40', 'rtx 30', 'rtx 50'],
    'AMD': ['amd radeon', 'radeon', 'rx', 'rx 7000', 'rx 6000', 'rx 5000'],
    'Intel Arc': ['intel arc', 'arc', 'arc a'],
    
    // Motherboard Brands
    'ASUS': ['asus', 'rog', 'tuf', 'prime', 'proart', 'strix'],
    'MSI': ['msi', 'meg', 'mpg', 'mag', 'pro series'],
    'Gigabyte': ['gigabyte', 'aorus', 'aero'],
    'ASRock': ['asrock', 'taichi', 'phantom gaming', 'steel legend'],
    'Biostar': ['biostar'],
    'EVGA': ['evga'],
    'Colorful': ['colorful'],
    
    // RAM Brands
    'Corsair': ['corsair', 'vengeance', 'dominator', 'lpx'],
    'Kingston': ['kingston', 'hyperx', 'fury', 'beast'],
    'G.Skill': ['g.skill', 'gskill', 'trident', 'ripjaws', 'flare', 'royal'],
    'Crucial': ['crucial', 'ballistix'],
    'TeamGroup': ['teamgroup', 't-force', 'delta', 'cardea'],
    'ADATA': ['adata', 'xpg', 'spectrix', 'gammix'],
    'Patriot': ['patriot', 'viper'],
    'GeIL': ['geil'],
    
    // Storage Brands
    'Samsung': ['samsung', 'evo', 'pro', '980', '990', '870', 'ssd'],
    'Western Digital': ['western digital', 'wd', 'sn850', 'sn770', 'sn580', 'blue', 'black', 'red'],
    'Seagate': ['seagate', 'barracuda', 'firecuda', 'ironwolf'],
    'Crucial': ['crucial', 'mx', 'bx', 'p3', 'p5'],
    'Kingston': ['kingston', 'nv2', 'kc3000', 'fury renegade'],
    'Corsair': ['corsair', 'mp600', 'mp700', 'mp400'],
    'ADATA': ['adata', 'xpg', 'gammix', 'spectrix'],
    'TeamGroup': ['teamgroup', 't-force', 'cardea'],
    'Sabrent': ['sabrent', 'rocket'],
    'Silicon Power': ['silicon power', 'sp'],
    
    // PSU Brands
    'Corsair': ['corsair', 'rmx', 'hx', 'ax', 'sf', 'cx', 'tx'],
    'Seasonic': ['seasonic', 'focus', 'prime', 'core', 'gx', 'px'],
    'EVGA': ['evga', 'supernova', 'g5', 'g6', 'p2', 't2'],
    'Cooler Master': ['cooler master', 'v series', 'mwe', 'gold'],
    'Thermaltake': ['thermaltake', 'toughpower', 'smart', 'gf', 'grand'],
    'be quiet!': ['be quiet', 'straight power', 'dark power', 'pure power'],
    'NZXT': ['nzxt', 'c series', 'c650', 'c750', 'c850'],
    'FSP': ['fsp', 'hydro', 'hyper', 'hexa'],
    'Silverstone': ['silverstone', 'strider', 'sx', 'et', 'da'],
    'Antec': ['antec', 'earthwatts', 'high current', 'neoeco'],
    
    // Cooler Brands
    'Noctua': ['noctua', 'nh-d15', 'nh-u12', 'nh-d14', 'nh-d9'],
    'Corsair': ['corsair', 'h100', 'h150', 'h60', 'h80', 'icue'],
    'NZXT': ['nzxt', 'kraken', 'z63', 'z73', 'x63', 'x73'],
    'Cooler Master': ['cooler master', 'hyper', 'masterliquid', 'ml', 'hyper 212'],
    'be quiet!': ['be quiet', 'dark rock', 'pure rock', 'silent loop'],
    'Arctic': ['arctic', 'liquid freezer', 'freezer', 'p12', 'p14'],
    'DeepCool': ['deepcool', 'assassin', 'ak620', 'ls520', 'lt720', 'ag400'],
    'Lian Li': ['lian li', 'gallahad', 'unifan', 'galahead'],
    'Thermaltake': ['thermaltake', 'water', 'tough', 'gravity'],
    'EKWB': ['ekwb', 'ek', 'elite', 'nucleus', 'basic'],
    'ID-Cooling': ['id-cooling', 'id cooling', 'frost', 'zoomflow'],
    'Vetroo': ['vetroo', 'v5', 'v240'],
    
    // Case Brands
    'Lian Li': ['lian li', 'o11', 'lan cool', 'mesh', 'pc-o11'],
    'NZXT': ['nzxt', 'h510', 'h710', 'h5', 'h7', 'h9'],
    'Corsair': ['corsair', '4000d', '5000d', '7000d', 'icue', 'carbide'],
    'Fractal Design': ['fractal', 'define', 'meshify', 'torrent', 'north'],
    'Cooler Master': ['cooler master', 'masterbox', 'td500', 'h500', 'cosmos'],
    'Phanteks': ['phanteks', 'p400', 'p500', 'eclipse', 'evolv'],
    'be quiet!': ['be quiet', 'silent base', 'pure base'],
    'Thermaltake': ['thermaltake', 'view', 'suppressor', 'core', 'versa'],
    'Antec': ['antec', 'p120', 'dark', 'performance', 'nx'],
    'Montech': ['montech', 'air', 'sky', 'x3'],
    
    // Monitor Brands
    'ASUS': ['asus', 'rog', 'tuf', 'proart', 'vg', 'pg', 'pa'],
    'MSI': ['msi', 'optix', 'mag', 'mpg', 'g'],
    'Dell': ['dell', 'alienware', 'ultrasharp', 's2721', 'aw'],
    'Samsung': ['samsung', 'odyssey', 'g7', 'g9', 'g5', 'smart monitor'],
    'LG': ['lg', 'ultragear', 'ultrafine', 'gram', '27gp', '34gp'],
    'Acer': ['acer', 'predator', 'nitro', 'xb', 'x'],
    'HP': ['hp', 'omen', 'x27', 'z', 'spectre'],
    'Gigabyte': ['gigabyte', 'aorus', 'm28u', 'm32u', 'g27f'],
    'ViewSonic': ['viewsonic', 'vx', 'vp', 'elite', 'xg'],
    'BenQ': ['benq', 'zowie', 'pd', 'ex', 'gw'],
    'AOC': ['aoc', 'agon', 'c24', 'c27', 'u34'],
    'Philips': ['philips', 'momentum', 'evnia']
};

const categoryPatterns = {
    'cpu': ['cpu', 'processor', 'core i', 'ryzen', 'threadripper', 'xeon', 'epyc', 'athlon', 'i9-', 'i7-', 'i5-', 'i3-', 'ultra 9', 'ultra 7', 'ultra 5'],
    'gpu': ['gpu', 'graphics', 'video', 'geforce', 'radeon', 'rtx', 'gtx', 'arc', 'quadro', 'titan'],
    'motherboard': ['motherboard', 'mainboard', 'z790', 'b650', 'x670', 'z690', 'b550', 'x570', 'h610', 'a620', 'b760', 'z890'],
    'ram': ['ram', 'memory', 'ddr5', 'ddr4', 'ddr3', 'vengeance', 'trident', 'ripjaws', 'ballistix', 'fury', 'beast'],
    'storage': ['ssd', 'nvme', 'm.2', 'storage', 'hard drive', 'hdd', 'sata', 'evo', 'sn850', '990'],
    'psu': ['psu', 'power supply', 'watt', 'toughpower', 'rmx', 'focus', 'supernova', 'mwe'],
    'cooler': ['cooler', 'cooling', 'fan', 'liquid', 'aio', 'air cooler', 'nh-d15', 'kraken', 'freezer', 'dark rock'],
    'case': ['case', 'chassis', 'tower', 'atx', 'matx', 'mid tower', 'full tower', 'mini'],
    'monitor': ['monitor', 'display', 'screen', '144hz', '240hz', 'oled', 'ips', 'va', '4k', 'ultrawide']
};

// ============================================
// DETECTION FUNCTIONS
// ============================================

/**
 * Detect brand from product name using pattern matching
 * @param {string} productName - The product name to analyze
 * @returns {string} - Detected brand name or empty string
 */
export function detectBrand(productName) {
    if (!productName) return '';
    
    const name = productName.toLowerCase().trim();
    
    for (const [brand, keywords] of Object.entries(brandPatterns)) {
        for (const keyword of keywords) {
            if (name.includes(keyword)) {
                return brand;
            }
        }
    }
    
    return '';
}

/**
 * Detect category from product name using pattern matching
 * @param {string} productName - The product name to analyze
 * @returns {string} - Detected category or 'other'
 */
export function detectCategory(productName) {
    if (!productName) return 'other';
    
    const name = productName.toLowerCase().trim();
    
    for (const [category, keywords] of Object.entries(categoryPatterns)) {
        for (const keyword of keywords) {
            if (name.includes(keyword)) {
                return category;
            }
        }
    }
    
    return 'other';
}

/**
 * Detect both brand and category from product name
 * @param {string} productName - The product name to analyze
 * @returns {Object} - { brand, category, confidence }
 */
export function detectProductInfo(productName) {
    if (!productName || productName.trim().length < 3) {
        return { brand: '', category: 'other', confidence: 'low' };
    }
    
    const brand = detectBrand(productName);
    const category = detectCategory(productName);
    
    // Calculate confidence based on number of matches
    let confidence = 'low';
    const name = productName.toLowerCase().trim();
    
    // Check how many keywords matched
    let matchCount = 0;
    let totalKeywords = 0;
    
    if (brand) {
        const keywords = brandPatterns[brand] || [];
        totalKeywords += keywords.length;
        for (const keyword of keywords) {
            if (name.includes(keyword)) matchCount++;
        }
    }
    
    const catKeywords = categoryPatterns[category] || [];
    totalKeywords += catKeywords.length;
    for (const keyword of catKeywords) {
        if (name.includes(keyword)) matchCount++;
    }
    
    const matchRatio = totalKeywords > 0 ? matchCount / totalKeywords : 0;
    if (matchRatio > 0.3) confidence = 'high';
    else if (matchRatio > 0.15) confidence = 'medium';
    
    return { brand, category, confidence };
}

/**
 * Get a description for a category
 */
export function getCategoryDescription(category) {
    const descriptions = {
        'cpu': 'Central Processing Unit - The brain of your computer',
        'gpu': 'Graphics Processing Unit - Handles gaming and video rendering',
        'motherboard': 'Main circuit board connecting all components',
        'ram': 'Random Access Memory - Temporary memory for active tasks',
        'storage': 'Storage drive for OS, files, and applications',
        'psu': 'Power Supply Unit - Provides power to all components',
        'cooler': 'Cooling system to keep CPU temperatures under control',
        'case': 'Computer case housing all components',
        'monitor': 'Display screen for visual output',
        'other': 'Other PC component or peripheral'
    };
    return descriptions[category] || 'PC component';
}

// ============================================
// EXPORT
// ============================================

export default {
    detectBrand,
    detectCategory,
    detectProductInfo,
    getCategoryDescription
};