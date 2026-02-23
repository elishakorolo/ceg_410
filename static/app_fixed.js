// app.js - Structural Analysis Web App (FIXED)

// ===== DATA STORAGE =====
let beamNodes = [];
let beamLoads = [];
let beamSpanMultipliers = {};

let frameNodes = [];
let frameMembers = [];
let frameLoads = [];

function numberToLetter(num) {
    return String.fromCharCode(65 + num);
}

function letterToNumber(letter) {
    return letter.toUpperCase().charCodeAt(0) - 65;
}

// ===== COLLAPSIBLE SECTIONS =====
function toggleSection(header) {
    const section = header.parentElement;
    section.classList.toggle('collapsed');
}

// ===== TAB SWITCHING =====
function switchMainTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tab + '-content').classList.add('active');
    if (tab === 'beam') {
        updateVisualization();
    } else {
        updateFrameVisualization();
    }
}

// ===== BEAM ANALYSIS =====

function clearAllBeam() {
    if (confirm('Are you sure you want to clear all beam data?')) {
        beamNodes = [];
        beamLoads = [];
        beamSpanMultipliers = {};
        document.getElementById('node-x').value = '';
        document.getElementById('load-mag').value = '';
        document.getElementById('load-start').value = '';
        updateNodesList();
        updateSpanMultipliersList();
        updateLoadsList();
        updateVisualization();
        document.getElementById('beam-results').innerHTML = '';
    }
}

function addNode() {
    const x = parseFloat(document.getElementById('node-x').value);
    const type = document.getElementById('node-type').value;
    if (isNaN(x)) { alert('Please enter a valid position'); return; }
    if (beamNodes.some(n => Math.abs(n.x - x) < 0.01)) { alert('Node already exists at this position'); return; }
    beamNodes.push({ id: beamNodes.length, x: x, type: type });
    beamNodes.sort((a, b) => a.x - b.x);
    beamNodes.forEach((n, i) => n.id = i);
    updateNodesList();
    updateSpanMultipliersList();
    updateVisualization();
    document.getElementById('node-x').value = '';
}

function updateNodesList() {
    const list = document.getElementById('nodes-list');
    list.innerHTML = beamNodes.map((n, i) => `
        <div class="item">
            <span><strong>${numberToLetter(i)}</strong>: x = ${n.x}m (${n.type})</span>
            <button onclick="removeNode(${i})">Remove</button>
        </div>
    `).join('');
}

function removeNode(index) {
    beamNodes.splice(index, 1);
    beamNodes.forEach((n, i) => n.id = i);
    updateNodesList();
    updateSpanMultipliersList();
    updateVisualization();
}

function updateSpanMultipliersList() {
    const list = document.getElementById('span-multipliers-list');
    if (beamNodes.length < 2) {
        list.innerHTML = '<p style="color: #999; font-size: 12px;">Add at least 2 nodes to define spans</p>';
        return;
    }
    let html = '';
    for (let i = 0; i < beamNodes.length - 1; i++) {
        const spanKey = `${i}`;
        const currentValue = beamSpanMultipliers[spanKey] || 1.0;
        html += `
            <div class="item">
                <span>Span ${numberToLetter(i)}-${numberToLetter(i+1)} (${beamNodes[i].x}m to ${beamNodes[i+1].x}m)</span>
                <input type="number" value="${currentValue}" step="0.1"
                       style="width: 80px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;"
                       onchange="beamSpanMultipliers['${spanKey}'] = parseFloat(this.value); updateVisualization()">
            </div>
        `;
    }
    list.innerHTML = html;
}

function updateLoadInputs() {
    const loadType = document.getElementById('load-type').value;
    const container = document.getElementById('load-inputs');
    if (loadType === 'Point') {
        container.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Magnitude (kN)</label>
                    <input type="number" id="load-mag" step="0.1" placeholder="10">
                </div>
                <div class="form-group">
                    <label>Position (m)</label>
                    <input type="number" id="load-start" step="0.1" placeholder="2.5">
                </div>
            </div>
        `;
    } else if (loadType === 'UDL') {
        container.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Intensity (kN/m)</label>
                    <input type="number" id="load-mag" step="0.1" placeholder="10">
                </div>
                <div class="form-group">
                    <label>Start (m)</label>
                    <input type="number" id="load-start" step="0.1" placeholder="0">
                </div>
            </div>
            <div class="form-group">
                <label>End (m)</label>
                <input type="number" id="load-end" step="0.1" placeholder="5">
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Start Intensity (kN/m)</label>
                    <input type="number" id="load-mag" step="0.1" placeholder="0">
                </div>
                <div class="form-group">
                    <label>End Intensity (kN/m)</label>
                    <input type="number" id="load-mag-end" step="0.1" placeholder="24">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Start Position (m)</label>
                    <input type="number" id="load-start" step="0.1" placeholder="0">
                </div>
                <div class="form-group">
                    <label>End Position (m)</label>
                    <input type="number" id="load-end" step="0.1" placeholder="4">
                </div>
            </div>
        `;
    }
}

function addLoad() {
    const type = document.getElementById('load-type').value;
    const mag = parseFloat(document.getElementById('load-mag').value);
    const start = parseFloat(document.getElementById('load-start').value);
    if (isNaN(mag) || isNaN(start)) { alert('Please enter valid values'); return; }
    const load = { type: type, mag: mag, start: start };
    if (type === 'UDL' || type === 'VDL') {
        const end = parseFloat(document.getElementById('load-end').value);
        if (isNaN(end)) { alert('Please enter end position'); return; }
        load.end = end;
    }
    if (type === 'VDL') {
        const magEnd = parseFloat(document.getElementById('load-mag-end').value);
        if (isNaN(magEnd)) { alert('Please enter end intensity'); return; }
        load.mag_end = magEnd;
    }
    beamLoads.push(load);
    updateLoadsList();
    updateVisualization();
    document.getElementById('load-mag').value = '';
    document.getElementById('load-start').value = '';
    if (document.getElementById('load-end')) document.getElementById('load-end').value = '';
    if (document.getElementById('load-mag-end')) document.getElementById('load-mag-end').value = '';
}

function updateLoadsList() {
    const list = document.getElementById('loads-list');
    list.innerHTML = beamLoads.map((l, i) => {
        let desc = '';
        if (l.type === 'Point') {
            desc = `Point: ${l.mag} kN at ${l.start}m`;
        } else if (l.type === 'UDL') {
            desc = `UDL: ${l.mag} kN/m from ${l.start}m to ${l.end}m`;
        } else {
            desc = `VDL: ${l.mag}→${l.mag_end} kN/m from ${l.start}m to ${l.end}m`;
        }
        return `
            <div class="item">
                <span>${desc}</span>
                <button onclick="removeLoad(${i})">Remove</button>
            </div>
        `;
    }).join('');
}

function removeLoad(index) {
    beamLoads.splice(index, 1);
    updateLoadsList();
    updateVisualization();
}

function updateVisualization() {
    const canvas = document.getElementById('structure-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = 300;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (beamNodes.length === 0) {
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Add nodes to visualize structure', canvas.width / 2, canvas.height / 2);
        return;
    }
    const minX = Math.min(...beamNodes.map(n => n.x));
    const maxX = Math.max(...beamNodes.map(n => n.x));
    const spanLength = maxX - minX;
    const padding = 80;
    const scale = (canvas.width - 2 * padding) / (spanLength || 1);
    const beamY = canvas.height / 2;
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(padding + (beamNodes[0].x - minX) * scale, beamY);
    for (let i = 1; i < beamNodes.length; i++) {
        ctx.lineTo(padding + (beamNodes[i].x - minX) * scale, beamY);
    }
    ctx.stroke();
    beamNodes.forEach((node, index) => {
        const x = padding + (node.x - minX) * scale;
        ctx.save();
        ctx.translate(x, beamY);
        if (node.type === 'fixed') {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-15, 0, 30, 8);
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 1;
            for (let i = -15; i < 15; i += 5) {
                ctx.beginPath(); ctx.moveTo(i, 8); ctx.lineTo(i + 5, 15); ctx.stroke();
            }
        } else if (node.type === 'pinned') {
            ctx.fillStyle = '#4169E1';
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(-12, 18); ctx.lineTo(12, 18);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
        } else if (node.type === 'roller') {
            ctx.fillStyle = '#32CD32';
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(-12, 18); ctx.lineTo(12, 18);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#FFF';
            ctx.beginPath(); ctx.arc(-6, 22, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(6, 22, 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(numberToLetter(index), 0, -20);
        ctx.font = '11px Arial';
        ctx.fillText(`${node.x}m`, 0, -8);
        ctx.restore();
    });
    beamLoads.forEach(load => {
        if (load.type === 'Point') {
            const x = padding + (load.start - minX) * scale;
            ctx.strokeStyle = '#e74c3c'; ctx.fillStyle = '#e74c3c'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x, beamY - 60); ctx.lineTo(x, beamY - 10); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, beamY - 10); ctx.lineTo(x - 5, beamY - 20); ctx.lineTo(x + 5, beamY - 20);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#000'; ctx.font = '11px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`${load.mag} kN`, x, beamY - 65);
        } else if (load.type === 'UDL') {
            const x1 = padding + (load.start - minX) * scale;
            const x2 = padding + (load.end - minX) * scale;
            ctx.strokeStyle = '#3498db'; ctx.fillStyle = '#3498db'; ctx.lineWidth = 2;
            const numArrows = Math.max(3, Math.floor((x2 - x1) / 30));
            for (let i = 0; i <= numArrows; i++) {
                const x = x1 + (x2 - x1) * i / numArrows;
                ctx.beginPath(); ctx.moveTo(x, beamY - 50); ctx.lineTo(x, beamY - 10); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, beamY - 10); ctx.lineTo(x - 3, beamY - 16); ctx.lineTo(x + 3, beamY - 16);
                ctx.closePath(); ctx.fill();
            }
            ctx.beginPath(); ctx.moveTo(x1, beamY - 50); ctx.lineTo(x2, beamY - 50); ctx.stroke();
            ctx.fillStyle = '#000'; ctx.font = '11px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`${load.mag} kN/m`, (x1 + x2) / 2, beamY - 55);
        } else if (load.type === 'VDL') {
            const x1 = padding + (load.start - minX) * scale;
            const x2 = padding + (load.end - minX) * scale;
            ctx.strokeStyle = '#9b59b6'; ctx.fillStyle = '#9b59b6'; ctx.lineWidth = 2;
            const h1 = 10 + load.mag * 3;
            const h2 = 10 + load.mag_end * 3;
            ctx.beginPath();
            ctx.moveTo(x1, beamY - 10); ctx.lineTo(x1, beamY - h1);
            ctx.lineTo(x2, beamY - h2); ctx.lineTo(x2, beamY - 10); ctx.stroke();
            ctx.fillStyle = 'rgba(155, 89, 182, 0.2)'; ctx.fill();
            ctx.strokeStyle = '#9b59b6'; ctx.fillStyle = '#9b59b6';
            const numArrows = Math.max(3, Math.floor((x2 - x1) / 30));
            for (let i = 0; i <= numArrows; i++) {
                const x = x1 + (x2 - x1) * i / numArrows;
                const h = h1 + (h2 - h1) * i / numArrows;
                ctx.beginPath(); ctx.moveTo(x, beamY - h); ctx.lineTo(x, beamY - 10); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, beamY - 10); ctx.lineTo(x - 3, beamY - 16); ctx.lineTo(x + 3, beamY - 16);
                ctx.closePath(); ctx.fill();
            }
            ctx.fillStyle = '#000'; ctx.font = '11px Arial';
            ctx.textAlign = 'left'; ctx.fillText(`${load.mag}`, x1 + 5, beamY - h1 - 5);
            ctx.textAlign = 'right'; ctx.fillText(`${load.mag_end} kN/m`, x2 - 5, beamY - h2 - 5);
        }
    });
}

async function analyzeBeam() {
    if (beamNodes.length < 2) { alert('Please add at least 2 nodes'); return; }
    document.getElementById('beam-loading').classList.add('active');
    document.getElementById('beam-results').innerHTML = '';
    try {
        const elements = [];
        const E = parseFloat(document.getElementById('beam-E').value) * 1e9;
        const I_base = parseFloat(document.getElementById('beam-I').value) * 1e-6;
        for (let i = 0; i < beamNodes.length - 1; i++) {
            const multiplier = beamSpanMultipliers[`${i}`] || 1.0;
            elements.push({ node_i: i, node_j: i + 1, E: E, I: I_base * multiplier });
        }
        const response = await fetch('/api/beam/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodes: beamNodes, elements: elements, loads: beamLoads })
        });
        const data = await response.json();
        if (data.success) {
            const barDia = parseFloat(document.getElementById('design-bar-dia').value) || 16;
            const maxShear = Math.max(...(data.shears || []).map(s => Math.max(Math.abs(s.v_i), Math.abs(s.v_j))));
            const designParams = {
                max_moment: data.max_moment,
                max_shear: maxShear || 0,
                material: document.getElementById('design-material').value,
                width: parseFloat(document.getElementById('design-width').value),
                fck: parseFloat(document.getElementById('design-fck').value),
                fy: parseFloat(document.getElementById('design-fy').value),
                cover: parseFloat(document.getElementById('design-cover').value),
                bar_dia: barDia,
                L_max: Math.max(...elements.map(e => beamNodes[e.node_j].x - beamNodes[e.node_i].x)),
                design_code: document.getElementById('design-code').value
            };
            const designResponse = await fetch('/api/design/beam', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(designParams)
            });
            const designData = await designResponse.json();
            displayBeamResults(data, designData, barDia);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        document.getElementById('beam-results').innerHTML = `
            <div class="error">
                <strong>Error:</strong> ${error.message}
                <br><small>Make sure the API server is running: python api_server_final.py</small>
            </div>
        `;
    } finally {
        document.getElementById('beam-loading').classList.remove('active');
    }
}

function displayBeamResults(data, designData, barDia) {
    let html = '';

    // DESIGN CARD — handle both IS456 and BS EN formats
    if (designData && designData.success) {
        const beamWidth = parseFloat(document.getElementById('design-width').value);
        const coverValue = parseFloat(document.getElementById('design-cover').value);
        
        // Check if response has nested structure (both BS 8110 and BS EN have this)
        const hasNestedStructure = designData.uls !== undefined;
        const ulsData = hasNestedStructure ? designData.uls : designData;
        const slsData = hasNestedStructure ? designData.sls : null;
        
        // Determine which code for display
        const isBSEN = designData.code && designData.code.includes('BS EN');
        const isBS8110 = designData.code && designData.code.includes('BS 8110');
        
        // ULS DESIGN CARD
        if (ulsData && (ulsData.depth || ulsData.steel_area_req)) {
            let codeLabel = 'Design Results';
            if (isBSEN) codeLabel = 'ULS Design (BS EN 1992)';
            else if (isBS8110) codeLabel = 'ULS Design (BS 8110)';
            
            html += `
            <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 22px; border-radius: 12px; margin-bottom: 16px; color: white;">
                <div style="font-size: 13px; font-weight: 600; opacity: 0.85; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${codeLabel}
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px; margin-bottom: 14px;">
                    <div>
                        <div style="opacity: 0.75; font-size: 11px;">Depth</div>
                        <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${Math.round(ulsData.depth || ulsData.eff_depth)}<span style="font-size: 13px; opacity: 0.8;"> mm</span></div>
                    </div>
                    <div>
                        <div style="opacity: 0.75; font-size: 11px;">Steel Area</div>
                        <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${Math.round(ulsData.steel_area_req || ulsData.steel_area)}<span style="font-size: 13px; opacity: 0.8;"> mm²</span></div>
                    </div>
                    <div>
                        <div style="opacity: 0.75; font-size: 11px;">Bars</div>
                        <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${ulsData.num_bars}<span style="font-size: 13px; opacity: 0.8;">×${Math.round(ulsData.bar_size || barDia)}mm</span></div>
                    </div>
                    <div>
                        <div style="opacity: 0.75; font-size: 11px;">Provided</div>
                        <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${Math.round(ulsData.steel_area_prov || ulsData.provided_area)}<span style="font-size: 13px; opacity: 0.8;"> mm²</span></div>
                    </div>
                    <div>
                        <div style="opacity: 0.75; font-size: 11px;">Utilization</div>
                        <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${(ulsData.utilization || 0).toFixed(0)}<span style="font-size: 13px; opacity: 0.8;">%</span></div>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; font-size: 13px;">
                    <span>${ulsData.section_type || 'Singly Reinforced'}</span>
                    <span>${Math.round(beamWidth)}mm × ${Math.round(ulsData.depth || 450)}mm</span>
                </div>
            </div>`;
            
            // Show shear check if available (both BS codes have this)
            if (hasNestedStructure && ulsData.shear_check) {
                html += `
                <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.08);">
                    <div style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 10px;">ULS Checks</div>
                    <div style="font-size: 13px; margin-bottom: 8px;">
                        <strong>Shear:</strong> ${ulsData.shear_check} 
                        ${ulsData.shear_capacity ? `(V<sub>Rd,c</sub> = ${ulsData.shear_capacity.toFixed(2)} kN, Util: ${ulsData.shear_util.toFixed(0)}%)` : ''}
                        ${ulsData.shear_stress_actual ? `(v = ${ulsData.shear_stress_actual.toFixed(2)} N/mm², v<sub>c</sub> = ${ulsData.shear_stress_allow.toFixed(2)} N/mm²)` : ''}
                    </div>
                </div>`;
            }
        }
        
        // SLS CHECKS (available for both BS 8110 and BS EN 1992)
        if (slsData) {
            html += `
            <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.08);">
                <div style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 12px;">SLS Checks (Serviceability)</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                    <div style="padding: 10px; background: ${slsData.deflection_check === 'OK' ? '#f0fdf4' : '#fef2f2'}; border-radius: 6px; border-left: 3px solid ${slsData.deflection_check === 'OK' ? '#22c55e' : '#ef4444'};">
                        <div style="font-weight: 600; margin-bottom: 4px;">Deflection: ${slsData.deflection_check}</div>
                        <div style="font-size: 12px; color: #666;">Span/depth: ${slsData.span_depth_actual.toFixed(1)} (limit: ${slsData.span_depth_allowable.toFixed(1)})</div>
                        <div style="font-size: 12px; color: #666;">Util: ${slsData.deflection_util.toFixed(0)}%</div>
                    </div>
                    <div style="padding: 10px; background: ${slsData.crack_check === 'OK' ? '#f0fdf4' : '#fef2f2'}; border-radius: 6px; border-left: 3px solid ${slsData.crack_check === 'OK' ? '#22c55e' : '#ef4444'};">
                        <div style="font-weight: 600; margin-bottom: 4px;">Crack Control: ${slsData.crack_check}</div>
                        <div style="font-size: 12px; color: #666;">Max spacing: ${slsData.max_bar_spacing.toFixed(0)}mm</div>
                        <div style="font-size: 12px; color: #666;">Actual: ${slsData.actual_spacing.toFixed(0)}mm</div>
                    </div>
                </div>
            </div>`;
        }
    }

    // MAX MOMENT
    html += `
    <div style="background: #f0f4ff; padding: 12px 16px; border-radius: 10px; border-left: 4px solid #667eea; margin-bottom: 16px; display: flex; align-items: baseline; gap: 10px;">
        <span style="color: #555; font-size: 13px;">Max Moment</span>
        <span style="color: #333; font-size: 22px; font-weight: 700;">${data.max_moment.toFixed(3)} kNm</span>
        <span style="color: #888; font-size: 13px;">at ${data.max_moment_location.toFixed(2)} m</span>
    </div>`;

    // REACTIONS TABLE
    if (data.reactions && data.reactions.length > 0) {
        html += `
        <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.08);">
            <div style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 10px;">Support Reactions</div>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead><tr style="background:#f7f7f7;">
                    <th style="padding:7px 10px; text-align:left; border-bottom:2px solid #eee;">Node</th>
                    <th style="padding:7px 10px; text-align:left; border-bottom:2px solid #eee;">Pos (m)</th>
                    <th style="padding:7px 10px; text-align:left; border-bottom:2px solid #eee;">Type</th>
                    <th style="padding:7px 10px; text-align:right; border-bottom:2px solid #eee;">Reaction (kN)</th>
                </tr></thead>
                <tbody>`;
        data.reactions.forEach(r => {
            html += `<tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:7px 10px;">${numberToLetter(r.node)}</td>
                <td style="padding:7px 10px;">${(r.x || 0).toFixed(2)}</td>
                <td style="padding:7px 10px;">${r.type}</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600;">${(r.reaction || 0).toFixed(3)}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // MEMBER MOMENTS TABLE
    if (data.moments && data.moments.length > 0) {
        html += `
        <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.08);">
            <div style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 10px;">Member End Moments</div>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead><tr style="background:#f7f7f7;">
                    <th style="padding:7px 10px; text-align:left; border-bottom:2px solid #eee;">Span</th>
                    <th style="padding:7px 10px; text-align:right; border-bottom:2px solid #eee;">M<sub>left</sub> (kNm)</th>
                    <th style="padding:7px 10px; text-align:right; border-bottom:2px solid #eee;">M<sub>right</sub> (kNm)</th>
                </tr></thead>
                <tbody>`;
        data.moments.forEach((m, i) => {
            html += `<tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:7px 10px;">${numberToLetter(i)}–${numberToLetter(i+1)}</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600;">${(m.m_i || 0).toFixed(3)}</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600;">${(m.m_j || 0).toFixed(3)}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // DIAGRAMS
    if (data.diagrams) {
        html += `
        <div style="background: white; padding: 16px; border-radius: 10px; box-shadow: 0 1px 6px rgba(0,0,0,0.08);">
            <div style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 12px;">Diagrams</div>
            <div style="margin-bottom: 14px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 6px;">Shear Force Diagram</div>
                <img src="data:image/png;base64,${data.diagrams.sfd}" style="width:100%; border-radius:6px;">
            </div>
            <div>
                <div style="font-size: 12px; color: #888; margin-bottom: 6px;">Bending Moment Diagram</div>
                <img src="data:image/png;base64,${data.diagrams.bmd}" style="width:100%; border-radius:6px;">
            </div>
        </div>`;
    }

    document.getElementById('beam-results').innerHTML = html;
}

// ===== FRAME ANALYSIS =====

function clearAllFrame() {
    if (confirm('Are you sure you want to clear all frame data?')) {
        frameNodes = [];
        frameMembers = [];
        frameLoads = [];
        document.getElementById('frame-node-x').value = '';
        document.getElementById('frame-node-y').value = '';
        document.getElementById('frame-member-i').value = '';
        document.getElementById('frame-member-j').value = '';
        document.getElementById('frame-load-member').value = '';
        document.getElementById('frame-load-mag').value = '';
        document.getElementById('frame-load-pos').value = '';
        updateFrameNodesList();
        updateFrameMembersList();
        updateFrameLoadsList();
        updateFrameVisualization();
        document.getElementById('frame-results').innerHTML = '';
    }
}

function addFrameNode() {
    const x = parseFloat(document.getElementById('frame-node-x').value);
    const y = parseFloat(document.getElementById('frame-node-y').value);
    const type = document.getElementById('frame-node-type').value;
    if (isNaN(x) || isNaN(y)) { alert('Please enter valid coordinates'); return; }
    frameNodes.push({ id: frameNodes.length, x: x, y: y, type: type });
    updateFrameNodesList();
    updateFrameVisualization();
    document.getElementById('frame-node-x').value = '';
    document.getElementById('frame-node-y').value = '';
}

function updateFrameNodesList() {
    const list = document.getElementById('frame-nodes-list');
    list.innerHTML = frameNodes.map((n, i) => `
        <div class="item">
            <span><strong>${numberToLetter(i)}</strong>: (${n.x}, ${n.y})m — ${n.type}</span>
            <button onclick="removeFrameNode(${i})">Remove</button>
        </div>
    `).join('');
}

function removeFrameNode(index) {
    frameNodes.splice(index, 1);
    frameNodes.forEach((n, i) => n.id = i);
    updateFrameNodesList();
    updateFrameVisualization();
}

function addFrameMember() {
    const iLetter = document.getElementById('frame-member-i').value.toUpperCase();
    const jLetter = document.getElementById('frame-member-j').value.toUpperCase();
    const I_mult = parseFloat(document.getElementById('frame-member-I').value);
    if (!iLetter || !jLetter || isNaN(I_mult)) { alert('Please enter valid values'); return; }
    const i = letterToNumber(iLetter);
    const j = letterToNumber(jLetter);
    if (i >= frameNodes.length || j >= frameNodes.length || i < 0 || j < 0) { alert('Invalid node letters'); return; }
    frameMembers.push({ id: frameMembers.length, node_i: i, node_j: j, I_mult: I_mult });
    updateFrameMembersList();
    updateFrameVisualization();
    document.getElementById('frame-member-i').value = '';
    document.getElementById('frame-member-j').value = '';
    document.getElementById('frame-member-I').value = '1';
}

function updateFrameMembersList() {
    const list = document.getElementById('frame-members-list');
    list.innerHTML = frameMembers.map((m, i) => {
        const label = `${numberToLetter(m.node_i)}-${numberToLetter(m.node_j)}`;
        return `
            <div class="item">
                <span>Member ${label} (I × ${m.I_mult})</span>
                <button onclick="removeFrameMember(${i})">Remove</button>
            </div>
        `;
    }).join('');
}

function removeFrameMember(index) {
    frameMembers.splice(index, 1);
    updateFrameMembersList();
    updateFrameVisualization();
}

function addFrameLoad() {
    const memberLabel = document.getElementById('frame-load-member').value.toUpperCase();
    const type = document.getElementById('frame-load-type').value;
    const mag = parseFloat(document.getElementById('frame-load-mag').value);
    const pos = parseFloat(document.getElementById('frame-load-pos').value);
    if (!memberLabel || isNaN(mag) || isNaN(pos)) { alert('Please enter valid values'); return; }
    const memberIndex = frameMembers.findIndex(m => {
        const label = `${numberToLetter(m.node_i)}${numberToLetter(m.node_j)}`;
        return label === memberLabel || label === memberLabel.split('').reverse().join('');
    });
    if (memberIndex === -1) { alert('Member not found'); return; }
    // Send both 'magnitude'/'position' AND 'mag'/'pos' for full compatibility
    frameLoads.push({
        member: memberIndex,
        type: type,
        magnitude: mag,
        mag: mag,
        position: pos,
        pos: pos
    });
    updateFrameLoadsList();
    updateFrameVisualization();
    document.getElementById('frame-load-member').value = '';
    document.getElementById('frame-load-mag').value = '';
    document.getElementById('frame-load-pos').value = '';
}

function updateFrameLoadsList() {
    const list = document.getElementById('frame-loads-list');
    list.innerHTML = frameLoads.map((l, i) => {
        const member = frameMembers[l.member];
        const label = member ? `${numberToLetter(member.node_i)}${numberToLetter(member.node_j)}` : '?';
        return `
            <div class="item">
                <span>Member ${label}: ${l.type} ${l.magnitude}kN at ${l.position}m</span>
                <button onclick="removeFrameLoad(${i})">Remove</button>
            </div>
        `;
    }).join('');
}

function removeFrameLoad(index) {
    frameLoads.splice(index, 1);
    updateFrameLoadsList();
    updateFrameVisualization();
}

function updateFrameVisualization() {
    const canvas = document.getElementById('frame-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = 400;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (frameNodes.length === 0) {
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Add nodes and members to visualize frame', canvas.width / 2, canvas.height / 2);
        return;
    }
    const xs = frameNodes.map(n => n.x);
    const ys = frameNodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const padding = 80;
    const scaleX = (canvas.width - 2 * padding) / (maxX - minX || 1);
    const scaleY = (canvas.height - 2 * padding) / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY);
    const toCanvasX = (x) => padding + (x - minX) * scale;
    const toCanvasY = (y) => canvas.height - padding - (y - minY) * scale;

    // Draw members
    ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 4;
    frameMembers.forEach(member => {
        const nodeI = frameNodes[member.node_i];
        const nodeJ = frameNodes[member.node_j];
        ctx.beginPath();
        ctx.moveTo(toCanvasX(nodeI.x), toCanvasY(nodeI.y));
        ctx.lineTo(toCanvasX(nodeJ.x), toCanvasY(nodeJ.y));
        ctx.stroke();
        const midX = (toCanvasX(nodeI.x) + toCanvasX(nodeJ.x)) / 2;
        const midY = (toCanvasY(nodeI.y) + toCanvasY(nodeJ.y)) / 2;
        ctx.fillStyle = '#666'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
        ctx.fillText(`${numberToLetter(member.node_i)}${numberToLetter(member.node_j)}`, midX, midY - 5);
    });

    // Draw loads
    frameLoads.forEach(load => {
        const member = frameMembers[load.member];
        if (!member) return;
        const nodeI = frameNodes[member.node_i];
        const nodeJ = frameNodes[member.node_j];
        const dx = nodeJ.x - nodeI.x;
        const dy = nodeJ.y - nodeI.y;
        const L = Math.sqrt(dx*dx + dy*dy);
        if (load.type === 'point' || load.type === 'Point') {
            const ratio = (load.position || load.pos || 0) / L;
            const loadX = toCanvasX(nodeI.x + dx * ratio);
            const loadY = toCanvasY(nodeI.y + dy * ratio);
            
            // Always draw loads pointing downward (gravity direction)
            const arrowLength = 50;
            const arrowStartX = loadX;
            const arrowStartY = loadY - arrowLength;  // Start above the member
            
            ctx.strokeStyle = '#e74c3c'; ctx.fillStyle = '#e74c3c'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(arrowStartX, arrowStartY); ctx.lineTo(loadX, loadY); ctx.stroke();
            
            // Arrowhead pointing down
            const arrowSize = 8;
            ctx.beginPath();
            ctx.moveTo(loadX, loadY);
            ctx.lineTo(loadX - arrowSize, loadY - arrowSize);
            ctx.lineTo(loadX + arrowSize, loadY - arrowSize);
            ctx.closePath(); ctx.fill();
            
            ctx.fillStyle = '#000'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`${load.magnitude || load.mag} kN`, arrowStartX, arrowStartY - 5);
        } else if (load.type === 'udl' || load.type === 'UDL') {
            const arrowLength = 40;
            const numArrows = Math.max(4, Math.floor(L * scale / 50));
            ctx.strokeStyle = '#3498db'; ctx.fillStyle = '#3498db'; ctx.lineWidth = 2;
            const points = [];
            for (let i = 0; i <= numArrows; i++) {
                const ratio = i / numArrows;
                points.push({ x: toCanvasX(nodeI.x + dx * ratio), y: toCanvasY(nodeI.y + dy * ratio) });
            }
            for (let i = 0; i <= numArrows; i++) {
                const x = points[i].x, y = points[i].y;
                ctx.beginPath(); ctx.moveTo(x, y - arrowLength); ctx.lineTo(x, y); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y - 8); ctx.lineTo(x + 4, y - 8); ctx.closePath(); ctx.fill();
            }
            ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y - arrowLength);
            for (let i = 1; i <= numArrows; i++) ctx.lineTo(points[i].x, points[i].y - arrowLength);
            ctx.stroke();
            ctx.fillStyle = '#000'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
            const midIdx = Math.floor(numArrows / 2);
            ctx.fillText(`${load.magnitude || load.mag} kN/m`, points[midIdx].x, points[midIdx].y - arrowLength - 15);
        }
    });

    // Draw nodes
    frameNodes.forEach((node, index) => {
        const x = toCanvasX(node.x), y = toCanvasY(node.y);
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
        if (node.type === 'fixed') {
            ctx.fillStyle = '#8B4513'; ctx.fillRect(x - 10, y + 6, 20, 6);
        } else if (node.type === 'pinned') {
            ctx.fillStyle = '#4169E1';
            ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x - 8, y + 18); ctx.lineTo(x + 8, y + 18);
            ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#000'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
        ctx.fillText(numberToLetter(index), x, y - 12);
    });
}

async function analyzeFrame() {
    if (frameNodes.length < 2 || frameMembers.length < 1) {
        alert('Please add at least 2 nodes and 1 member');
        return;
    }
    document.getElementById('frame-loading').classList.add('active');
    document.getElementById('frame-results').innerHTML = '';
    try {
        const E = parseFloat(document.getElementById('frame-E').value) * 1e9;
        const I_base = parseFloat(document.getElementById('frame-I').value) * 1e-6;
        const canSway = document.getElementById('frame-can-sway') 
                        ? document.getElementById('frame-can-sway').checked 
                        : false;
        const response = await fetch('/api/frame/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nodes: frameNodes,
                members: frameMembers.map(m => ({ ...m, E: E, I: I_base * m.I_mult })),
                loads: frameLoads,
                can_sway: canSway
            })
        });
        const data = await response.json();
        if (data.success) {
            // Design critical members
            const designCode = document.getElementById('frame-design-code').value;
            const fck = parseFloat(document.getElementById('frame-design-fck').value);
            const fy = parseFloat(document.getElementById('frame-design-fy').value);
            const beamWidth = parseFloat(document.getElementById('frame-beam-width').value) || 300;
            const columnSize = parseFloat(document.getElementById('frame-column-size').value) || 300;
            const cover = parseFloat(document.getElementById('frame-design-cover').value) || 40;
            const barDia = parseFloat(document.getElementById('frame-design-bar-dia').value) || 16;
            
            // Find critical beam (horizontal member with max moment)
            let maxBeamMoment = 0;
            let maxBeamShear = 0;
            let maxBeamLength = 0;
            let criticalBeamIndex = -1;
            
            data.member_forces.forEach((m, i) => {
                const member = frameMembers[m.member];
                if (member) {
                    const ni = frameNodes[member.node_i];
                    const nj = frameNodes[member.node_j];
                    const isHorizontal = Math.abs(ni.y - nj.y) < 0.01;
                    const L = Math.sqrt((nj.x - ni.x)**2 + (nj.y - ni.y)**2);
                    
                    if (isHorizontal) {
                        const memberMoment = Math.max(Math.abs(m.M_ab), Math.abs(m.M_ba));
                        const memberShear = Math.max(Math.abs(m.V_a), Math.abs(m.V_b));
                        if (memberMoment > maxBeamMoment) {
                            maxBeamMoment = memberMoment;
                            maxBeamShear = memberShear;
                            maxBeamLength = L;
                            criticalBeamIndex = i;
                        }
                    }
                }
            });
            
            // Find critical column (vertical member with max moment)
            // Use max support Ry as axial load (server sets member N_a/N_b = 0 always)
            let maxColumnAxial = 0;
            let maxColumnMoment = 0;
            let maxColumnLength = 0;
            let criticalColumnIndex = -1;

            // Derive axial load from support reactions (Ry = vertical reaction = column axial)
            if (data.reactions) {
                data.reactions.forEach(r => {
                    maxColumnAxial = Math.max(maxColumnAxial, Math.abs(r.Ry || 0));
                });
            }

            data.member_forces.forEach((m, i) => {
                const member = frameMembers[m.member];
                if (member) {
                    const ni = frameNodes[member.node_i];
                    const nj = frameNodes[member.node_j];
                    const isVertical = Math.abs(ni.x - nj.x) < 0.01;
                    const L = Math.sqrt((nj.x - ni.x)**2 + (nj.y - ni.y)**2);
                    
                    if (isVertical) {
                        const memberMoment = Math.max(Math.abs(m.M_ab), Math.abs(m.M_ba));
                        if (memberMoment > maxColumnMoment) {
                            maxColumnMoment = memberMoment;
                            maxColumnLength = L;
                            criticalColumnIndex = i;
                        }
                    }
                }
            });
            
            // Design critical beam
            let beamDesign = null;
            if (maxBeamMoment > 0) {
                const beamDesignParams = {
                    design_code: designCode,
                    max_moment: maxBeamMoment,
                    max_shear: maxBeamShear,
                    L_max: maxBeamLength,
                    width: beamWidth,
                    fck: fck,
                    fy: fy,
                    cover: cover,
                    bar_dia: barDia
                };
                
                const beamDesignResponse = await fetch('/api/design/beam', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(beamDesignParams)
                });
                beamDesign = await beamDesignResponse.json();
            }
            
            // Design critical column
            let columnDesign = null;
            if (maxColumnMoment > 0 || maxColumnAxial > 0) {
                const columnDesignParams = {
                    design_code: designCode,
                    axial_force: maxColumnAxial,
                    moment: maxColumnMoment,
                    length: maxColumnLength,
                    width: columnSize,
                    depth: columnSize,
                    fck: fck,
                    fyk: fy,
                    cover: cover,
                    bar_dia: barDia
                };
                
                const columnDesignResponse = await fetch('/api/design/column', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(columnDesignParams)
                });
                columnDesign = await columnDesignResponse.json();
            }
            
            displayFrameResults(data, beamDesign, columnDesign, barDia);
        } else {
            throw new Error(data.error || 'Frame analysis failed');
        }
    } catch (error) {
        document.getElementById('frame-results').innerHTML = `
            <div class="error">
                <strong>Error:</strong> ${error.message}
                <br><small>Make sure the API server is running: python api_server_complete.py</small>
            </div>
        `;
    } finally {
        document.getElementById('frame-loading').classList.remove('active');
    }
}

function displayFrameResults(data, beamDesign, columnDesign, barDia) {
    let html = '';

    // BEAM DESIGN RESULTS
    if (beamDesign && beamDesign.success) {
        // Detect code type
        const isIS456 = beamDesign.code && beamDesign.code.includes('IS 456');
        const isBSEN = beamDesign.code && beamDesign.code.includes('BS EN');
        const isBS8110 = beamDesign.code && beamDesign.code.includes('BS 8110');
        
        // For IS456, data is flat; for BS codes, data is nested
        const hasNestedStructure = beamDesign.uls !== undefined;
        const ulsData = hasNestedStructure ? beamDesign.uls : beamDesign;
        const slsData = hasNestedStructure ? beamDesign.sls : null;
        
        const beamWidth = parseFloat(document.getElementById('frame-beam-width').value) || 300;
        
        let codeLabel = 'Beam Design';
        if (isIS456) codeLabel = 'Beam Design (IS 456)';
        else if (isBSEN) codeLabel = 'Beam Design (BS EN 1992 - ULS)';
        else if (isBS8110) codeLabel = 'Beam Design (BS 8110 - ULS)';
        
        html += `
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 22px; border-radius: 12px; margin-bottom: 16px; color: white;">
            <div style="font-size: 13px; font-weight: 600; opacity: 0.85; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                ${codeLabel}
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px; margin-bottom: 14px;">
                <div>
                    <div style="opacity: 0.75; font-size: 11px;">Depth</div>
                    <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${Math.round(ulsData.depth || ulsData.eff_depth)}<span style="font-size: 13px; opacity: 0.8;"> mm</span></div>
                </div>
                <div>
                    <div style="opacity: 0.75; font-size: 11px;">Steel Area</div>
                    <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${Math.round(ulsData.steel_area_req || ulsData.steel_area)}<span style="font-size: 13px; opacity: 0.8;"> mm²</span></div>
                </div>
                <div>
                    <div style="opacity: 0.75; font-size: 11px;">Bars</div>
                    <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${ulsData.num_bars}<span style="font-size: 13px; opacity: 0.8;">×${Math.round(ulsData.bar_size || barDia)}mm</span></div>
                </div>
                <div>
                    <div style="opacity: 0.75; font-size: 11px;">Provided</div>
                    <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${Math.round(ulsData.steel_area_prov || ulsData.provided_area)}<span style="font-size: 13px; opacity: 0.8;"> mm²</span></div>
                </div>
                <div>
                    <div style="opacity: 0.75; font-size: 11px;">Utilization</div>
                    <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${(ulsData.utilization || 0).toFixed(0)}<span style="font-size: 13px; opacity: 0.8;">%</span></div>
                </div>
            </div>
            <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 14px; font-size: 13px;">
                <span>${ulsData.section_type || 'Singly Reinforced'}</span> • <span>${Math.round(beamWidth)}mm × ${Math.round(ulsData.depth || 450)}mm</span>
            </div>
        </div>`;
        
        // SLS checks (available for both BS 8110 and BS EN 1992)
        if (slsData) {
            html += `
            <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.08);">
                <div style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 12px;">Beam SLS Checks</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                    <div style="padding: 10px; background: ${slsData.deflection_check === 'OK' ? '#f0fdf4' : '#fef2f2'}; border-radius: 6px; border-left: 3px solid ${slsData.deflection_check === 'OK' ? '#22c55e' : '#ef4444'};">
                        <div style="font-weight: 600; margin-bottom: 4px;">Deflection: ${slsData.deflection_check}</div>
                        <div style="font-size: 12px; color: #666;">Span/depth: ${slsData.span_depth_actual.toFixed(1)} / ${slsData.span_depth_allowable.toFixed(1)}</div>
                    </div>
                    <div style="padding: 10px; background: ${slsData.crack_check === 'OK' ? '#f0fdf4' : '#fef2f2'}; border-radius: 6px; border-left: 3px solid ${slsData.crack_check === 'OK' ? '#22c55e' : '#ef4444'};">
                        <div style="font-weight: 600; margin-bottom: 4px;">Crack: ${slsData.crack_check}</div>
                        <div style="font-size: 12px; color: #666;">Spacing: ${slsData.actual_spacing.toFixed(0)}mm / ${slsData.max_bar_spacing.toFixed(0)}mm</div>
                    </div>
                </div>
            </div>`;
        }
    }
    
    // COLUMN DESIGN RESULTS
    if (columnDesign && columnDesign.success) {
        // Detect code type
        const isIS456 = columnDesign.code && columnDesign.code.includes('IS 456');
        const isBSEN = columnDesign.code && columnDesign.code.includes('BS EN');
        const isBS8110 = columnDesign.code && columnDesign.code.includes('BS 8110');
        
        // For IS456, data is flat; for BS codes, data is nested
        const hasNestedStructure = columnDesign.uls !== undefined;
        const ulsData = hasNestedStructure ? columnDesign.uls : columnDesign;
        const slsData = hasNestedStructure ? columnDesign.sls : null;
        
        const columnSize = parseFloat(document.getElementById('frame-column-size').value) || 300;
        
        let codeLabel = 'Column Design';
        if (isIS456) codeLabel = 'Column Design (IS 456)';
        else if (isBSEN) codeLabel = 'Column Design (BS EN 1992 - ULS)';
        else if (isBS8110) codeLabel = 'Column Design (BS 8110 - ULS)';
        
        html += `
        <div style="background: linear-gradient(135deg, #f093fb, #f5576c); padding: 22px; border-radius: 12px; margin-bottom: 16px; color: white;">
            <div style="font-size: 13px; font-weight: 600; opacity: 0.85; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                ${codeLabel}
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px; margin-bottom: 14px;">
                <div>
                    <div style="opacity: 0.75; font-size: 11px;">Steel Area</div>
                    <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${Math.round(ulsData.steel_area_req || ulsData.steel_area)}<span style="font-size: 13px; opacity: 0.8;"> mm²</span></div>
                </div>
                <div>
                    <div style="opacity: 0.75; font-size: 11px;">Bars</div>
                    <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${ulsData.num_bars}<span style="font-size: 13px; opacity: 0.8;">×${Math.round(ulsData.bar_size || barDia)}mm</span></div>
                </div>
                <div>
                    <div style="opacity: 0.75; font-size: 11px;">Provided</div>
                    <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${Math.round(ulsData.steel_area_prov || ulsData.provided_area)}<span style="font-size: 13px; opacity: 0.8;"> mm²</span></div>
                </div>
                <div>
                    <div style="opacity: 0.75; font-size: 11px;">Capacity</div>
                    <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${(ulsData.axial_capacity || 0).toFixed(0)}<span style="font-size: 13px; opacity: 0.8;"> kN</span></div>
                </div>
                <div>
                    <div style="opacity: 0.75; font-size: 11px;">Utilization</div>
                    <div style="font-size: 26px; font-weight: 700; line-height: 1.1;">${(ulsData.utilization || 0).toFixed(0)}<span style="font-size: 13px; opacity: 0.8;">%</span></div>
                </div>
            </div>
            <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 10px 14px; font-size: 13px;">
                <span>${ulsData.category || ulsData.slenderness_category || 'Column'}</span> • <span>${Math.round(columnSize)}mm × ${Math.round(columnSize)}mm</span> • <span>${(ulsData.steel_percentage || 0).toFixed(2)}% steel</span>
            </div>
        </div>`;
        
        if (slsData) {
            html += `
            <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.08);">
                <div style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 8px;">Column SLS Checks</div>
                <div style="font-size: 13px;">Cover: ${slsData.cover_check}</div>
                <div style="font-size: 12px; color: #666; margin-top: 4px;">Link: ø${slsData.min_link_dia.toFixed(0)}mm @ ${slsData.max_link_spacing.toFixed(0)}mm max</div>
            </div>`;
        }
    }

    // SWAY BADGE (if applicable)
    const swayMm = (data.sway_delta || 0) * 1000;
    if (Math.abs(swayMm) > 0.001) {
        html += `
        <div style="background: #fff8e1; padding: 12px 16px; border-radius: 10px; border-left: 4px solid #f59e0b; margin-bottom: 16px; display: flex; align-items: baseline; gap: 10px;">
            <span style="color: #92400e; font-size: 13px;">Lateral Sway (Δ)</span>
            <span style="color: #78350f; font-size: 22px; font-weight: 700;">${swayMm.toFixed(3)} mm</span>
        </div>`;
    }

    // MAX MOMENT + MAX SHEAR
    if (data.max_moment !== undefined) {
        html += `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
            <div style="background:#f0f4ff; padding:12px 16px; border-radius:10px; border-left:4px solid #667eea;">
                <span style="color:#555; font-size:12px; display:block;">Max Moment</span>
                <span style="color:#333; font-size:22px; font-weight:700;">${(data.max_moment||0).toFixed(3)}<span style="font-size:13px; color:#888;"> kNm</span></span>
            </div>
            <div style="background:#f0fff4; padding:12px 16px; border-radius:10px; border-left:4px solid #38a169;">
                <span style="color:#555; font-size:12px; display:block;">Max Shear</span>
                <span style="color:#333; font-size:22px; font-weight:700;">${(data.max_shear||0).toFixed(3)}<span style="font-size:13px; color:#888;"> kN</span></span>
            </div>
        </div>`;
    }

    // MEMBER FORCES TABLE
    if (data.member_forces && data.member_forces.length > 0) {
        html += `
        <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.08);">
            <div style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 10px;">Member End Moments & Forces</div>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead><tr style="background:#f7f7f7;">
                    <th style="padding:7px 10px; text-align:left; border-bottom:2px solid #eee;">Member</th>
                    <th style="padding:7px 10px; text-align:right; border-bottom:2px solid #eee;">M<sub>AB</sub> (kNm)</th>
                    <th style="padding:7px 10px; text-align:right; border-bottom:2px solid #eee;">M<sub>BA</sub> (kNm)</th>
                    <th style="padding:7px 10px; text-align:right; border-bottom:2px solid #eee;">V<sub>A</sub> (kN)</th>
                    <th style="padding:7px 10px; text-align:right; border-bottom:2px solid #eee;">V<sub>B</sub> (kN)</th>
                    <th style="padding:7px 10px; text-align:right; border-bottom:2px solid #eee;">N<sub>A</sub> (kN)</th>
                </tr></thead>
                <tbody>`;
        data.member_forces.forEach((m) => {
            const ni = frameMembers[m.member] ? frameMembers[m.member].node_i : m.member;
            const nj = frameMembers[m.member] ? frameMembers[m.member].node_j : m.member + 1;
            const label = (ni !== undefined && nj !== undefined)
                ? `${numberToLetter(ni)}–${numberToLetter(nj)}`
                : `M${m.member}`;
            html += `<tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:7px 10px;">${label}</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600;">${(m.M_ab || 0).toFixed(3)}</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600;">${(m.M_ba || 0).toFixed(3)}</td>
                <td style="padding:7px 10px; text-align:right;">${(m.V_a || 0).toFixed(3)}</td>
                <td style="padding:7px 10px; text-align:right;">${(m.V_b || 0).toFixed(3)}</td>
                <td style="padding:7px 10px; text-align:right;">${(m.N_a || 0).toFixed(3)}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // REACTIONS TABLE
    if (data.reactions && data.reactions.length > 0) {
        html += `
        <div style="background: white; padding: 16px; border-radius: 10px; margin-bottom: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.08);">
            <div style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 10px;">Support Reactions</div>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead><tr style="background:#f7f7f7;">
                    <th style="padding:7px 10px; text-align:left; border-bottom:2px solid #eee;">Node</th>
                    <th style="padding:7px 10px; text-align:right; border-bottom:2px solid #eee;">R<sub>x</sub> (kN)</th>
                    <th style="padding:7px 10px; text-align:right; border-bottom:2px solid #eee;">R<sub>y</sub> (kN)</th>
                    <th style="padding:7px 10px; text-align:right; border-bottom:2px solid #eee;">M (kNm)</th>
                </tr></thead>
                <tbody>`;
        data.reactions.forEach(r => {
            html += `<tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:7px 10px;">${numberToLetter(r.node)}</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600;">${(r.Rx || 0).toFixed(3)}</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600;">${(r.Ry || 0).toFixed(3)}</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600;">${(r.M || 0).toFixed(3)}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // DIAGRAMS (BMD + SFD on frame geometry — generated by server)
    if (data.diagrams) {
        html += `
        <div style="background: white; padding: 16px; border-radius: 10px; box-shadow: 0 1px 6px rgba(0,0,0,0.08);">
            <div style="font-size: 13px; font-weight: 600; color: #444; margin-bottom: 12px;">Diagrams</div>
            <div style="margin-bottom: 20px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px;">Bending Moment Diagram</div>
                <img src="data:image/png;base64,${data.diagrams.bmd}" style="width:100%; border-radius:6px;">
            </div>
            <div>
                <div style="font-size: 12px; color: #888; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px;">Shear Force Diagram</div>
                <img src="data:image/png;base64,${data.diagrams.sfd}" style="width:100%; border-radius:6px;">
            </div>
        </div>`;
    }

    document.getElementById('frame-results').innerHTML = html;
}

// Initialize
window.addEventListener('load', () => {
    updateVisualization();
    updateLoadInputs();
});