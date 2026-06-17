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
            statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> AI unavailable - using fallback check';
            const fallbackResult = this.fallbackCheck(selectedParts);
            this.displayResults(fallbackResult, selectedParts);
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
        const statusEl = document.getElementById('compatibilityStatus');
        const detailsEl = document.getElementById('aiDetails');
        
        if (!statusEl) return;
        
        // Check for warnings and issues
        const hasIncompatible = result.compatibility?.some(c => c.status === 'incompatible');
        const hasWarnings = result.compatibility?.some(c => c.status === 'warning');
        const hasCriticalWarnings = result.warnings?.some(w => w.severity === 'high' || w.severity === 'critical');
        const hasMediumWarnings = result.warnings?.some(w => w.severity === 'medium');
        
        // Status header with color coding
        if (hasIncompatible || hasCriticalWarnings) {
            statusEl.className = 'ai-status incompatible';
            statusEl.innerHTML = `<i class="fas fa-times-circle"></i> <strong>${result.summary || '⚠️ Compatibility Issues Found'}</strong> ❌`;
        } else if (hasWarnings || hasMediumWarnings) {
            statusEl.className = 'ai-status warning';
            statusEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <strong>${result.summary || '⚠️ Potential Issues Found'}</strong> ⚠️`;
        } else {
            statusEl.className = 'ai-status compatible';
            statusEl.innerHTML = `<i class="fas fa-check-circle"></i> <strong>${result.summary || '✅ Build Compatible'}</strong> ✅`;
        }
        
        if (!detailsEl) return;
        detailsEl.style.display = 'block';
        let html = '';
        
        // ===== PART DESCRIPTIONS =====
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
        
        // ===== COMPATIBILITY PAIRS =====
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
        
        // ===== WARNINGS SECTION =====
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
        
        // ===== BOTTLENECKS =====
        if (result.bottlenecks?.length) {
            html += `<div style="margin-bottom:10px;padding:12px;background:#fff3e0;border-radius:8px;border-left:4px solid #ff9800;">
                <strong style="color:#e65100;">⚠️ Potential Bottlenecks:</strong>
                ${result.bottlenecks.map(b => `<div style="font-size:13px;margin-top:4px;">• ${b}</div>`).join('')}
            </div>`;
        }
        
        // ===== SUGGESTIONS =====
        if (result.suggestions?.length) {
            html += `<div style="margin-bottom:10px;padding:12px;background:#e3f2fd;border-radius:8px;border-left:4px solid #2196F3;">
                <strong style="color:#1565c0;">💡 Suggestions:</strong>
                ${result.suggestions.map(s => `<div style="font-size:13px;margin-top:4px;">• ${s}</div>`).join('')}
            </div>`;
        }
        
        // ===== ALTERNATIVES =====
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
        
        // ===== SUMMARY STATS =====
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
        const cpu = parts.find(p => p.category === 'cpu' || p.category === 'CPU');
        const mobo = parts.find(p => p.category === 'motherboard' || p.category === 'MOTHERBOARD');
        const ram = parts.find(p => p.category === 'ram' || p.category === 'RAM');
        const gpu = parts.find(p => p.category === 'gpu' || p.category === 'GPU');
        const psu = parts.find(p => p.category === 'psu' || p.category === 'PSU');
        const storage = parts.find(p => p.category === 'storage' || p.category === 'STORAGE');
        const cooler = parts.find(p => p.category === 'cooler' || p.category === 'COOLER');
        
        const cpuBrand = (cpu?.brand || '').toLowerCase();
        const moboBrand = (mobo?.brand || '').toLowerCase();
        
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
        
        // ===== CPU + MOTHERBOARD =====
        if (cpu && mobo) {
            if (cpuBrand.includes('intel') && moboBrand.includes('amd')) {
                compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'incompatible', detail: '❌ Intel CPU requires an Intel-compatible motherboard' });
                issues.push({ part: cpu.name, problem: 'CPU/Motherboard mismatch (Intel CPU on AMD board)', severity: 'critical' });
                warnings.push({ message: `Intel CPU (${cpu.name}) detected with AMD motherboard (${mobo.name}) - Not compatible`, severity: 'critical' });
            } else if (cpuBrand.includes('amd') && moboBrand.includes('intel')) {
                compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'incompatible', detail: '❌ AMD CPU requires an AMD-compatible motherboard' });
                issues.push({ part: cpu.name, problem: 'CPU/Motherboard mismatch (AMD CPU on Intel board)', severity: 'critical' });
                warnings.push({ message: `AMD CPU (${cpu.name}) detected with Intel motherboard (${mobo.name}) - Not compatible`, severity: 'critical' });
            } else {
                compatibility.push({ parts: `${cpu.name} + ${mobo.name}`, status: 'compatible', detail: '✅ CPU and motherboard brands match' });
            }
        }
        
        // ===== RAM =====
        if (ram && mobo) {
            // Check if RAM is DDR4 or DDR5 (simple check)
            const ramType = ram.name.toLowerCase().includes('ddr5') ? 'DDR5' : 
                           ram.name.toLowerCase().includes('ddr4') ? 'DDR4' : 'Unknown';
            const moboType = mobo.name.toLowerCase().includes('ddr5') ? 'DDR5' : 
                            mobo.name.toLowerCase().includes('ddr4') ? 'DDR4' : 'Unknown';
            
            if (ramType !== 'Unknown' && moboType !== 'Unknown' && ramType !== moboType) {
                compatibility.push({ parts: `${ram.name} + ${mobo.name}`, status: 'incompatible', detail: `❌ ${ramType} RAM with ${moboType} motherboard - Not compatible` });
                warnings.push({ message: `RAM type mismatch: ${ramType} RAM on ${moboType} motherboard`, severity: 'critical' });
            } else if (ramType === 'Unknown' || moboType === 'Unknown') {
                compatibility.push({ parts: `${ram.name} + ${mobo.name}`, status: 'warning', detail: '⚠️ Verify RAM type matches motherboard specifications' });
                warnings.push({ message: 'Unable to verify RAM compatibility - check DDR type', severity: 'medium' });
            } else {
                compatibility.push({ parts: `${ram.name} + ${mobo.name}`, status: 'compatible', detail: '✅ RAM type matches motherboard' });
            }
        }
        
        // ===== GPU =====
        if (gpu) {
            compatibility.push({ parts: gpu.name, status: 'compatible', detail: '✅ Compatible with standard PCIe x16 slot' });
            
            // GPU bottleneck check with CPU
            if (cpu) {
                const isHighEndGPU = gpu.name.toLowerCase().includes('4090') || 
                                    gpu.name.toLowerCase().includes('4080') ||
                                    gpu.name.toLowerCase().includes('7900') ||
                                    gpu.name.toLowerCase().includes('7800');
                
                const isEntryCPU = cpu.name.toLowerCase().includes('i3') || 
                                  cpu.name.toLowerCase().includes('ryzen 3') ||
                                  cpu.name.toLowerCase().includes('athlon');
                
                if (isHighEndGPU && isEntryCPU) {
                    bottlenecks.push(`High-end GPU (${gpu.name}) may be bottlenecked by entry-level CPU (${cpu.name})`);
                    warnings.push({ message: `GPU (${gpu.name}) may be bottlenecked by CPU (${cpu.name}) - Consider CPU upgrade`, severity: 'medium' });
                }
            }
        }
        
        // ===== POWER SUPPLY =====
        if (psu) {
            const psuWattage = parseInt(psu.name.match(/(\d+)/)?.[0] || 0);
            
            // Estimate wattage based on components
            let estimatedWattage = 400;
            if (cpu) {
                if (cpu.name.toLowerCase().includes('i9') || cpu.name.toLowerCase().includes('ryzen 9')) estimatedWattage += 150;
                else if (cpu.name.toLowerCase().includes('i7') || cpu.name.toLowerCase().includes('ryzen 7')) estimatedWattage += 100;
                else if (cpu.name.toLowerCase().includes('i5') || cpu.name.toLowerCase().includes('ryzen 5')) estimatedWattage += 70;
                else estimatedWattage += 50;
            }
            if (gpu) {
                if (gpu.name.toLowerCase().includes('4090')) estimatedWattage += 450;
                else if (gpu.name.toLowerCase().includes('4080')) estimatedWattage += 320;
                else if (gpu.name.toLowerCase().includes('4070')) estimatedWattage += 200;
                else if (gpu.name.toLowerCase().includes('4060')) estimatedWattage += 115;
                else if (gpu.name.toLowerCase().includes('7900')) estimatedWattage += 350;
                else if (gpu.name.toLowerCase().includes('7800')) estimatedWattage += 250;
                else estimatedWattage += 100;
            }
            if (ram) estimatedWattage += 20;
            if (storage) estimatedWattage += 15;
            if (cooler) estimatedWattage += 20;
            
            if (psuWattage > 0 && psuWattage < estimatedWattage) {
                compatibility.push({ parts: `${psu.name}`, status: 'warning', detail: `⚠️ PSU may be insufficient for your build (${estimatedWattage}W needed)` });
                warnings.push({ message: `PSU (${psuWattage}W) may be insufficient - recommended ${estimatedWattage}W`, severity: 'high' });
                suggestions.push(`Upgrade PSU to at least ${estimatedWattage + 100}W for headroom`);
            } else if (psuWattage > 0) {
                compatibility.push({ parts: `${psu.name}`, status: 'compatible', detail: `✅ PSU provides sufficient power (${psuWattage}W)` });
            }
        }
        
        // ===== COOLER =====
        if (cpu && cooler) {
            const isHighEndCPU = cpu.name.toLowerCase().includes('i9') || 
                                cpu.name.toLowerCase().includes('ryzen 9') ||
                                cpu.name.toLowerCase().includes('i7') ||
                                cpu.name.toLowerCase().includes('ryzen 7');
            
            const isStockCooler = cooler.name.toLowerCase().includes('stock') || 
                                 cooler.name.toLowerCase().includes('wraith') ||
                                 cooler.name.toLowerCase().includes('intel stock');
            
            if (isHighEndCPU && isStockCooler) {
                warnings.push({ message: `High-end CPU (${cpu.name}) with stock cooler may have thermal issues`, severity: 'medium' });
                suggestions.push('Consider an aftermarket cooler for better thermal performance');
            }
        }
        
        // ===== MISSING ESSENTIAL COMPONENTS =====
        if (!cpu) {
            warnings.push({ message: 'CPU is missing - Select a processor to complete your build', severity: 'high' });
        }
        if (!mobo) {
            warnings.push({ message: 'Motherboard is missing - Select a motherboard to complete your build', severity: 'high' });
        }
        if (!ram) {
            warnings.push({ message: 'RAM is missing - Add memory to your build', severity: 'medium' });
        }
        if (!psu) {
            warnings.push({ message: 'Power Supply is missing - Add a PSU to your build', severity: 'medium' });
        }
        
        // ===== GENERAL SUGGESTIONS =====
        if (parts.length < 4) {
            suggestions.push('Consider adding RAM and storage to complete your build');
        }
        if (parts.length < 5) {
            suggestions.push('Add a power supply and cooler if not selected');
        }
        
        const hasIncompatible = compatibility.some(c => c.status === 'incompatible');
        const hasWarnings = compatibility.some(c => c.status === 'warning');
        const hasCriticalWarnings = warnings.some(w => w.severity === 'critical');
        const hasHighWarnings = warnings.some(w => w.severity === 'high');
        
        let summary = '';
        if (hasIncompatible || hasCriticalWarnings) {
            summary = '⚠️ Critical compatibility issues detected! Review warnings before purchasing.';
        } else if (hasWarnings || hasHighWarnings) {
            summary = '⚠️ Potential issues found - review warnings for details.';
        } else if (warnings.length > 0) {
            summary = 'ℹ️ Some components need attention - check warnings.';
        } else {
            summary = '✅ All selected components appear compatible!';
        }
        
        return {
            compatible: !hasIncompatible && !hasCriticalWarnings,
            confidence: 'medium',
            summary: summary,
            compatibility: compatibility,
            partDetails: partDetails,
            issues: issues,
            warnings: warnings,
            suggestions: suggestions.length > 0 ? suggestions : ['Your build is complete! Consider adding extras like RGB lighting or case fans.'],
            bottlenecks: bottlenecks,
            estimatedWattage: parts.reduce((total, p) => {
                // Rough estimate
                if (p.category === 'cpu') return total + 100;
                if (p.category === 'gpu') return total + 250;
                if (p.category === 'psu') return total + 0;
                return total + 30;
            }, 200)
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