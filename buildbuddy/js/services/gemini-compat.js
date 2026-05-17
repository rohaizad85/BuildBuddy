// AI Compatibility Checker Service
class GeminiCompat {
    constructor() {
        this.model = 'gemini-2.0-flash';
    }

    async checkCompatibility(selectedParts) {
        const statusEl = document.getElementById('compatibilityStatus');
        const detailsEl = document.getElementById('aiDetails');
        
        if (!statusEl) return;
        
        statusEl.className = 'ai-status checking';
        statusEl.innerHTML = '<i class="fas fa-robot fa-spin"></i> AI analyzing compatibility...';
        if (detailsEl) detailsEl.style.display = 'none';

        try {
            const response = await fetch('http://localhost:3000/api/gemini-compat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: this.buildPrompt(selectedParts) })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            this.displayResults(result, selectedParts);
            return result;
        } catch (error) {
            console.error('AI check failed:', error);
            statusEl.className = 'ai-status error';
            statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> AI unavailable';
            return this.fallbackCheck(selectedParts);
        }
    }

    buildPrompt(parts) {
        return `You are a PC building expert. Analyze these components for compatibility:

${parts.map(p => `- ${p.category.toUpperCase()}: ${p.name} (${p.brand || ''})`).join('\n')}

        Return ONLY this JSON (no markdown, no backticks):
        {
        "compatible": true or false,
        "confidence": "high/medium/low",
        "summary": "Brief 1-sentence overall verdict",
        "compatibility": [
            {"parts": "Part A + Part B", "status": "compatible/warning/incompatible", "detail": "Short explanation (1 line)"}
        ],
        "partDetails": [
            {"name": "part name", "category": "CPU/Motherboard/RAM/GPU", "role": "What this part does in the PC (1 line)", "note": "Any specific note about this choice (1 line)"}
        ],
        "suggestions": ["improvement tip"],
        "bottlenecks": ["potential bottleneck"],
        "estimatedWattage": 500
        }`;
    }

    displayResults(result, parts) {
    const statusEl = document.getElementById('compatibilityStatus');
    const detailsEl = document.getElementById('aiDetails');
    
    if (!statusEl) return;
    
    // Status header
    if (result.compatible) {
        statusEl.className = 'ai-status compatible';
        statusEl.innerHTML = `<i class="fas fa-check-circle"></i> <strong>${result.summary || 'Build Compatible'}</strong> ✅`;
    } else {
        statusEl.className = 'ai-status incompatible';
        statusEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> <strong>${result.summary || 'Issues Found'}</strong>`;
    }
    
    // Always show details
    if (!detailsEl) return;
    detailsEl.style.display = 'block';
    let html = '';
    
    // Part descriptions
    if (result.partDetails?.length) {
        html += `<div style="margin-bottom:15px;"><strong style="color:#1a1a2e;font-size:15px;">📋 Components Overview:</strong>`;
        result.partDetails.forEach(p => {
            html += `<div style="margin:8px 0;padding:12px;background:#f8f9fc;border-radius:8px;border-left:4px solid #00d4ff;">
                <strong style="font-size:14px;">${p.name}</strong> 
                <span style="color:#00d4ff;font-size:11px;font-weight:600;">${p.category || ''}</span>
                <div style="font-size:13px;color:#555;margin-top:4px;">${p.role}</div>
                ${p.note ? `<div style="font-size:12px;color:#888;margin-top:4px;">💡 ${p.note}</div>` : ''}
            </div>`;
        });
        html += `</div>`;
    }
    
    // Compatibility pairs
    if (result.compatibility?.length) {
        html += `<div style="margin-bottom:15px;"><strong style="color:#1a1a2e;font-size:15px;">🔗 Compatibility:</strong>`;
        result.compatibility.forEach(c => {
            const icon = c.status === 'compatible' ? '✅' : c.status === 'warning' ? '⚠️' : '❌';
            const color = c.status === 'compatible' ? '#2e7d32' : c.status === 'warning' ? '#e65100' : '#c62828';
            html += `<div style="margin:6px 0;padding:8px 12px;background:${c.status === 'compatible' ? '#e8f5e9' : c.status === 'warning' ? '#fff3e0' : '#ffebee'};border-radius:6px;font-size:13px;">
                ${icon} <strong>${c.parts}:</strong> ${c.detail}
            </div>`;
        });
        html += `</div>`;
    }
    
    // Bottlenecks
    if (result.bottlenecks?.length) {
        html += `<div style="margin-bottom:10px;padding:12px;background:#fff3e0;border-radius:8px;border-left:4px solid #ff9800;">
            <strong style="color:#e65100;">⚠️ Potential Bottlenecks:</strong>
            ${result.bottlenecks.map(b => `<div style="font-size:13px;margin-top:4px;">• ${b}</div>`).join('')}
        </div>`;
    }
    
    // Suggestions
    if (result.suggestions?.length) {
        html += `<div style="margin-bottom:10px;padding:12px;background:#e3f2fd;border-radius:8px;border-left:4px solid #2196F3;">
            <strong style="color:#1565c0;">💡 Suggestions:</strong>
            ${result.suggestions.map(s => `<div style="font-size:13px;margin-top:4px;">• ${s}</div>`).join('')}
        </div>`;
    }
    
     if (result.alternatives?.length) {
        html += `<div style="margin-bottom:10px;"><strong style="color:#e65100;font-size:15px;">🔄 Suggested Replacements:</strong>`;
        result.alternatives.forEach(alt => {
            html += `<div style="margin:8px 0;padding:12px;background:#fff8e1;border-radius:8px;border-left:4px solid #ff9800;">
                <div style="font-size:13px;color:#e65100;margin-bottom:6px;"><strong>Replace:</strong> ${alt.replace}</div>
                <div style="font-size:12px;color:#666;margin-bottom:8px;">${alt.reason}</div>`;
            alt.options.forEach(opt => {
                html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;margin:4px 0;background:white;border-radius:6px;">
                    <span style="font-size:13px;"><strong>${opt.name}</strong> <span style="color:#888;">(${opt.brand})</span></span>
                    <span style="font-weight:600;color:#1a1a2e;">RM ${opt.price}</span>
                </div>`;
            });
            html += `</div>`;
        });
        html += `</div>`;
    }

    // Wattage
    if (result.estimatedWattage) {
        html += `<div style="padding:10px;background:#f5f5f5;border-radius:8px;text-align:center;font-size:14px;">
            ⚡ Estimated Power Consumption: <strong>${result.estimatedWattage}W</strong>
        </div>`;
    }
    
    if (html) {
        detailsEl.innerHTML = html;
    } else {
        // Fallback: show what we have
        detailsEl.innerHTML = `<pre style="font-size:12px;color:#666;">${JSON.stringify(result, null, 2)}</pre>`;
    }
}

    fallbackCheck(parts) {
    const cpu = parts.find(p => p.category === 'cpu' || p.category === 'CPU');
    const mobo = parts.find(p => p.category === 'motherboard' || p.category === 'MOTHERBOARD');
    const ram = parts.find(p => p.category === 'ram' || p.category === 'RAM');
    const gpu = parts.find(p => p.category === 'gpu' || p.category === 'GPU');
    
    // Define these at the top so they're accessible everywhere
    const cpuBrand = (cpu?.brand || '').toLowerCase();
    const moboBrand = (mobo?.brand || '').toLowerCase();
    
    const compatibility = [];
    const issues = [];
    
    const partDetails = parts.map(p => ({
        name: p.name,
        category: (p.category || '').toUpperCase(),
        role: this.getPartRole(p.category),
        note: this.getPartNote(p.category)
    }));
    
    // CPU + Motherboard
    if (cpu && mobo) {
        if (cpuBrand.includes('intel') && moboBrand.includes('amd')) {
            compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'incompatible', detail: 'Intel CPU needs Intel-compatible motherboard' });
            issues.push({ part: cpu.name, problem: 'CPU/Motherboard mismatch', severity: 'critical' });
        } else if (cpuBrand.includes('amd') && moboBrand.includes('intel')) {
            compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'incompatible', detail: 'AMD CPU needs AMD-compatible motherboard' });
            issues.push({ part: cpu.name, problem: 'CPU/Motherboard mismatch', severity: 'critical' });
        } else {
            compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'compatible', detail: 'CPU and motherboard brands match' });
        }
    }
    
    // RAM
    if (ram && mobo) {
        compatibility.push({ parts: `${ram.name} + ${mobo.name}`, status: 'compatible', detail: 'Verify RAM type matches motherboard slots' });
    }
    
    // GPU
    if (gpu) {
        compatibility.push({ parts: gpu.name, status: 'compatible', detail: 'Compatible with standard PCIe x16 slot' });
    }
    
    const suggestions = [];
    if (cpu && gpu && cpuBrand.includes('intel') && gpu.name?.toLowerCase().includes('4090')) {
        suggestions.push('High-end GPU - ensure adequate cooling and PSU');
    }
    if (parts.length < 4) suggestions.push('Add RAM and storage to complete your build');
    
    return {
        compatible: issues.length === 0,
        confidence: 'medium',
        summary: issues.length ? 'Issues found in your build' : 'Components look compatible',
        compatibility,
        partDetails,
        issues,
        suggestions,
        bottlenecks: [],
        estimatedWattage: 500
        };
    }

    getPartRole(category) {
        const cat = (category || '').toLowerCase();
        const roles = {
            'cpu': 'Processes all instructions and calculations - the brain of your PC',
            'motherboard': 'Main circuit board connecting all components together',
            'ram': 'Temporary memory for active tasks and running applications',
            'gpu': 'Handles graphics rendering for games, video, and display output',
            'storage': 'Permanent storage for your OS, files, and applications',
            'psu': 'Supplies power to all components in the system',
            'cooler': 'Keeps the CPU temperature in safe operating range'
        };
        return roles[cat] || 'Essential PC component';
    }

    getPartNote(category) {
        const cat = (category || '').toLowerCase();
        const notes = {
            'cpu': 'Choose based on cores/threads for your workload',
            'motherboard': 'Must match CPU socket and have needed features',
            'ram': '16GB recommended for gaming, 32GB for content creation',
            'gpu': 'Most important for gaming performance and resolution',
            'psu': 'Get 80+ rated with enough wattage headroom',
            'cooler': 'Required for all CPUs - aftermarket for better temps'
        };
        return notes[cat] || '';
    }
    
}

export default new GeminiCompat();