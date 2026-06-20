// D:\Ijad\Y3S2\FYP\Project\buildbuddy\js\services\gemini-compat.js

class GeminiCompat {
    constructor() {
        this.model = 'gemini-2.0-flash';
        this.apiUrl = 'http://localhost:3000/api/gemini-compat';
    }

    async checkCompatibility(selectedParts) {
        const statusEl = document.getElementById('compatibilityStatus');
        const detailsEl = document.getElementById('aiDetails');

        if (statusEl) {
            statusEl.className = 'ai-status checking';
            statusEl.innerHTML = '<i class="fas fa-robot fa-spin"></i> AI analyzing compatibility...';
        }
        if (detailsEl) detailsEl.style.display = 'none';

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: this.buildPrompt(selectedParts) })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();

            if (detailsEl) {
                detailsEl.style.display = 'block';
                this.displayResults(result, selectedParts);
            }
            return result;
        } catch (error) {
            console.error('AI check failed:', error);
            if (statusEl) {
                statusEl.className = 'ai-status error';
                statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> AI unavailable - using fallback check';
            }
            const fallbackResult = this.fallbackCheck(selectedParts);
            if (detailsEl) {
                detailsEl.style.display = 'block';
                this.displayResults(fallbackResult, selectedParts);
            }
            return fallbackResult;
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
        {"name": "part name", "category": "CPU/Motherboard/RAM/GPU", "role": "What this part does (1 line)", "note": "Any specific note (1 line)"}
    ],
    "suggestions": ["improvement tip"],
    "bottlenecks": ["potential bottleneck"],
    "estimatedWattage": 500,
    "warnings": [
        {"message": "Warning message", "severity": "low/medium/high"}
    ]
}`;
    }

    displayResults(result, parts) {
        const detailsEl = document.getElementById('aiDetails');
        if (!detailsEl) return;

        let html = '';

        // Part Descriptions
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

        // Compatibility Pairs
        if (result.compatibility?.length) {
            html += `<div style="margin-bottom:15px;"><strong style="color:#1a1a2e;font-size:15px;">🔗 Compatibility Check:</strong>`;
            result.compatibility.forEach(c => {
                let icon, color, bgColor;
                if (c.status === 'compatible') {
                    icon = '✅';
                    color = '#2e7d32';
                    bgColor = '#e8f5e9';
                } else if (c.status === 'warning') {
                    icon = '⚠️';
                    color = '#e65100';
                    bgColor = '#fff3e0';
                } else {
                    icon = '❌';
                    color = '#c62828';
                    bgColor = '#ffebee';
                }
                html += `<div style="margin:6px 0;padding:10px 14px;background:${bgColor};border-radius:6px;border-left:4px solid ${color};font-size:13px;">
                    ${icon} <strong>${c.parts}:</strong> ${c.detail}
                </div>`;
            });
            html += `</div>`;
        }

        // Warnings
        if (result.warnings?.length) {
            html += `<div style="margin-bottom:15px;"><strong style="color:#1a1a2e;font-size:15px;">⚠️ Warnings:</strong>`;
            result.warnings.forEach(w => {
                let color, bgColor, icon;
                if (w.severity === 'critical' || w.severity === 'high') {
                    color = '#c62828';
                    bgColor = '#ffebee';
                    icon = '🔴';
                } else if (w.severity === 'medium') {
                    color = '#e65100';
                    bgColor = '#fff3e0';
                    icon = '🟡';
                } else {
                    color = '#f57f17';
                    bgColor = '#fff8e1';
                    icon = '🟢';
                }
                html += `<div style="margin:6px 0;padding:10px 14px;background:${bgColor};border-radius:6px;border-left:4px solid ${color};font-size:13px;">
                    ${icon} <strong style="color:${color};">${w.message}</strong>
                    <span style="color:#888;font-size:11px;margin-left:8px;">(${w.severity || 'info'})</span>
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

        // Summary Stats
        const totalParts = parts.length;
        const compatibleCount = result.compatibility?.filter(c => c.status === 'compatible').length || 0;
        const warningCount = result.compatibility?.filter(c => c.status === 'warning').length || 0;
        const incompatibleCount = result.compatibility?.filter(c => c.status === 'incompatible').length || 0;

        html += `<div style="display:flex;gap:15px;flex-wrap:wrap;padding:12px;background:#f5f5f5;border-radius:8px;margin-top:10px;font-size:13px;">`;
        html += `<span><strong>📊 Components:</strong> ${totalParts}</span>`;
        html += `<span style="color:#2e7d32;"><strong>✅ Compatible:</strong> ${compatibleCount}</span>`;
        if (warningCount > 0) {
            html += `<span style="color:#e65100;"><strong>⚠️ Warnings:</strong> ${warningCount}</span>`;
        }
        if (incompatibleCount > 0) {
            html += `<span style="color:#c62828;"><strong>❌ Incompatible:</strong> ${incompatibleCount}</span>`;
        }
        if (result.estimatedWattage) {
            html += `<span><strong>⚡ Wattage:</strong> ${result.estimatedWattage}W</span>`;
        }
        html += `<span><strong>📈 Confidence:</strong> ${result.confidence || 'medium'}</span>`;
        html += `</div>`;

        detailsEl.innerHTML = html;
    }

    fallbackCheck(parts) {
        const cpu = parts.find(p => p.category === 'cpu');
        const mobo = parts.find(p => p.category === 'motherboard');
        const ram = parts.find(p => p.category === 'ram');
        const gpu = parts.find(p => p.category === 'gpu');
        const psu = parts.find(p => p.category === 'psu');

        const compatibility = [];
        const warnings = [];
        const issues = [];
        const bottlenecks = [];
        const suggestions = [];

        const partDetails = parts.map(p => ({
            name: p.name,
            category: (p.category || '').toUpperCase(),
            role: this.getPartRole(p.category),
            note: this.getPartNote(p.category)
        }));

        // CPU + Motherboard
        if (cpu && mobo) {
            const cpuBrand = (cpu.brand || '').toLowerCase();
            const moboBrand = (mobo.brand || '').toLowerCase();
            if (cpuBrand.includes('intel') && moboBrand.includes('amd')) {
                compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'incompatible', detail: '❌ Intel CPU requires Intel motherboard' });
                warnings.push({ message: `Intel CPU (${cpu.name}) with AMD motherboard (${mobo.name}) - Not compatible`, severity: 'critical' });
            } else if (cpuBrand.includes('amd') && moboBrand.includes('intel')) {
                compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'incompatible', detail: '❌ AMD CPU requires AMD motherboard' });
                warnings.push({ message: `AMD CPU (${cpu.name}) with Intel motherboard (${mobo.name}) - Not compatible`, severity: 'critical' });
            } else {
                compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'compatible', detail: '✅ CPU and motherboard brands match' });
            }
        }

        // RAM
        if (ram && mobo) {
            const ramType = ram.name.toLowerCase().includes('ddr5') ? 'DDR5' :
                ram.name.toLowerCase().includes('ddr4') ? 'DDR4' : 'Unknown';
            const moboType = mobo.name.toLowerCase().includes('ddr5') ? 'DDR5' :
                mobo.name.toLowerCase().includes('ddr4') ? 'DDR4' : 'Unknown';
            if (ramType !== 'Unknown' && moboType !== 'Unknown' && ramType !== moboType) {
                compatibility.push({ parts: `${ram.name} + ${mobo.name}`, status: 'incompatible', detail: `❌ ${ramType} RAM with ${moboType} motherboard` });
                warnings.push({ message: `RAM type mismatch: ${ramType} RAM on ${moboType} motherboard`, severity: 'critical' });
            } else {
                compatibility.push({ parts: `${ram.name} + ${mobo.name}`, status: 'compatible', detail: '✅ RAM type matches motherboard' });
            }
        }

        // GPU
        if (gpu) {
            compatibility.push({ parts: gpu.name, status: 'compatible', detail: '✅ Compatible with PCIe x16 slot' });
            if (cpu) {
                const isHighEndGPU = gpu.name.toLowerCase().includes('4090') || gpu.name.toLowerCase().includes('4080');
                const isEntryCPU = cpu.name.toLowerCase().includes('i3') || cpu.name.toLowerCase().includes('ryzen 3');
                if (isHighEndGPU && isEntryCPU) {
                    bottlenecks.push(`High-end GPU (${gpu.name}) may be bottlenecked by entry-level CPU (${cpu.name})`);
                }
            }
        }

        // PSU
        if (psu) {
            const psuWattage = parseInt(psu.name.match(/(\d+)/)?.[0] || 0);
            let estimatedWattage = 400;
            if (cpu) {
                if (cpu.name.toLowerCase().includes('i9') || cpu.name.toLowerCase().includes('ryzen 9')) estimatedWattage += 150;
                else if (cpu.name.toLowerCase().includes('i7') || cpu.name.toLowerCase().includes('ryzen 7')) estimatedWattage += 100;
                else estimatedWattage += 70;
            }
            if (gpu) {
                if (gpu.name.toLowerCase().includes('4090')) estimatedWattage += 450;
                else if (gpu.name.toLowerCase().includes('4080')) estimatedWattage += 320;
                else if (gpu.name.toLowerCase().includes('4070')) estimatedWattage += 200;
                else estimatedWattage += 150;
            }
            if (psuWattage > 0 && psuWattage < estimatedWattage) {
                compatibility.push({ parts: psu.name, status: 'warning', detail: `⚠️ PSU may be insufficient (${estimatedWattage}W needed)` });
                warnings.push({ message: `PSU (${psuWattage}W) may be insufficient - recommended ${estimatedWattage}W`, severity: 'high' });
                suggestions.push(`Upgrade PSU to at least ${estimatedWattage + 100}W`);
            }
        }

        // Missing components
        if (!cpu) warnings.push({ message: 'CPU is missing - Select a processor', severity: 'high' });
        if (!mobo) warnings.push({ message: 'Motherboard is missing', severity: 'high' });
        if (!ram) warnings.push({ message: 'RAM is missing - Add memory', severity: 'medium' });
        if (!psu) warnings.push({ message: 'Power Supply is missing', severity: 'medium' });

        if (parts.length < 4) suggestions.push('Consider adding RAM and storage');
        if (parts.length < 5) suggestions.push('Add a power supply and cooler');

        const hasIncompatible = compatibility.some(c => c.status === 'incompatible');
        const hasWarnings = compatibility.some(c => c.status === 'warning');
        const hasCriticalWarnings = warnings.some(w => w.severity === 'critical');

        let summary = '';
        if (hasIncompatible || hasCriticalWarnings) {
            summary = '⚠️ Critical compatibility issues detected! Review warnings.';
        } else if (hasWarnings) {
            summary = '⚠️ Potential issues found - review warnings.';
        } else if (warnings.length > 0) {
            summary = 'ℹ️ Some components need attention.';
        } else {
            summary = '✅ All selected components appear compatible!';
        }

        return {
            compatible: !hasIncompatible && !hasCriticalWarnings,
            confidence: 'medium',
            summary: summary,
            compatibility: compatibility,
            partDetails: partDetails,
            warnings: warnings,
            suggestions: suggestions.length > 0 ? suggestions : ['Your build is ready!'],
            bottlenecks: bottlenecks,
            estimatedWattage: parts.reduce((total, p) => {
                if (p.category === 'cpu') return total + 100;
                if (p.category === 'gpu') return total + 250;
                return total + 30;
            }, 200)
        };
    }

    getPartRole(category) {
        const roles = {
            'cpu': 'Processes all instructions - the brain of your PC',
            'motherboard': 'Main circuit board connecting all components',
            'ram': 'Temporary memory for active tasks and applications',
            'gpu': 'Handles graphics rendering for gaming and display',
            'storage': 'Permanent storage for OS, files, and applications',
            'psu': 'Supplies power to all components in the system',
            'cooler': 'Keeps the CPU temperature in safe operating range'
        };
        return roles[(category || '').toLowerCase()] || 'Essential PC component';
    }

    getPartNote(category) {
        const notes = {
            'cpu': 'Choose based on cores/threads for your workload',
            'motherboard': 'Must match CPU socket and have needed features',
            'ram': '16GB recommended for gaming, 32GB for content creation',
            'gpu': 'Most important for gaming performance',
            'psu': 'Get 80+ rated with enough wattage headroom'
        };
        return notes[(category || '').toLowerCase()] || '';
    }
}

export default GeminiCompat;