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
    canvas.height = 380;
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
            const barDia   = parseFloat(document.getElementById('design-bar-dia').value) || 16;
            const fck      = parseFloat(document.getElementById('design-fck').value);
            const fy       = parseFloat(document.getElementById('design-fy').value);
            const cover    = parseFloat(document.getElementById('design-cover').value);
            const width    = parseFloat(document.getElementById('design-width').value);
            const desCode  = document.getElementById('design-code').value;

            // ── Design each span individually ──────────────────────────────────
            const spanDesigns = [];
            const moments = data.moments || [];
            const shears  = data.shears  || [];

            for (let i = 0; i < elements.length; i++) {
                const el  = elements[i];
                const L   = beamNodes[el.node_j].x - beamNodes[el.node_i].x;
                const m   = moments[i] || { m_i: 0, m_j: 0 };
                const sh  = shears[i]  || { v_i: 0, v_j: 0 };
                const M_i = m.m_i || 0, M_j = m.m_j || 0;
                const V_i = sh.v_i|| 0, V_j = sh.v_j|| 0;

                // Sagging (positive) = max positive moment across span
                const M_sagging = Math.max(0, M_i, M_j);
                // Hogging (negative) = most negative end moment
                const M_hogging = Math.min(0, M_i, M_j);
                const V_max     = Math.max(Math.abs(V_i), Math.abs(V_j));

                try {
                    const resp = await fetch('/api/design/beam', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            design_code: desCode,
                            max_moment: M_sagging,
                            min_moment: M_hogging,
                            max_shear: V_max,
                            L_max: L,
                            width: width,
                            fck, fy, cover, bar_dia: barDia
                        })
                    });
                    const d = await resp.json();
                    spanDesigns.push({
                        spanIdx: i,
                        label: `${numberToLetter(el.node_i)}\u2013${numberToLetter(el.node_j)}`,
                        L, M_i, M_j, V_i, V_j, design: d
                    });
                } catch(e) {
                    spanDesigns.push({ spanIdx: i, label: `Span ${i+1}`, L, design: null });
                }
            }

            displayBeamResults(data, spanDesigns, barDia);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        document.getElementById('beam-results').innerHTML = `
            <div class="error">
                <strong>Error:</strong> ${error.message}
                <br><small>Make sure the API server is running: python api_server.py</small>
            </div>
        `;
    } finally {
        document.getElementById('beam-loading').classList.remove('active');
    }
}

function displayBeamResults(data, spanDesigns, barDia) {
    let html = '';
    const PASS = '#16a34a', FAIL = '#dc2626', WARN = '#d97706';

    // ─── 1. MAX MOMENT PILL ────────────────────────────────────────────────────
    html += `
    <div style="background:#eff6ff;padding:12px 16px;border-radius:10px;border-left:4px solid #3b82f6;
                margin-bottom:14px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
        <span style="color:#555;font-size:13px;">Max Moment</span>
        <span style="color:#1e40af;font-size:22px;font-weight:700;">
            ${(data.max_moment||0).toFixed(3)}<span style="font-size:13px;color:#6b7280;"> kNm</span>
        </span>
        <span style="color:#888;font-size:13px;">at ${(data.max_moment_location||0).toFixed(2)} m</span>
        ${data.max_sagging != null ? `<span style="color:#16a34a;font-size:12px;">(+) sagging: ${(data.max_sagging).toFixed(2)} kNm</span>` : ''}
        ${data.max_hogging != null ? `<span style="color:#dc2626;font-size:12px;">(-) hogging: ${(data.max_hogging).toFixed(2)} kNm</span>` : ''}
    </div>`;

    // ─── 2. REACTIONS ─────────────────────────────────────────────────────────
    if (data.reactions && data.reactions.length > 0) {
        html += `
        <div style="background:white;padding:16px;border-radius:10px;margin-bottom:14px;
                    box-shadow:0 1px 4px rgba(0,0,0,0.07);">
            <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;">Support Reactions</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8fafc;">
                    <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Node</th>
                    <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Pos (m)</th>
                    <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Type</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">Reaction (kN)</th>
                </tr></thead><tbody>`;
        data.reactions.forEach(r => {
            html += `<tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:7px 10px;font-weight:600;">${numberToLetter(r.node)}</td>
                <td style="padding:7px 10px;">${(r.x||0).toFixed(2)}</td>
                <td style="padding:7px 10px;">${r.type||''}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:700;color:#1e40af;">${(r.reaction||0).toFixed(3)}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // ─── 3. MEMBER END MOMENTS & SHEARS ───────────────────────────────────────
    if (data.moments && data.moments.length > 0) {
        html += `
        <div style="background:white;padding:16px;border-radius:10px;margin-bottom:14px;
                    box-shadow:0 1px 4px rgba(0,0,0,0.07);">
            <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;">Member End Moments &amp; Shears</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8fafc;">
                    <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Span</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">M<sub>i</sub> (kNm)</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">M<sub>j</sub> (kNm)</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">V<sub>i</sub> (kN)</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">V<sub>j</sub> (kN)</th>
                </tr></thead><tbody>`;
        data.moments.forEach((m, i) => {
            const s = (data.shears||[])[i] || {};
            html += `<tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:7px 10px;font-weight:600;">${numberToLetter(i)}&ndash;${numberToLetter(i+1)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;">${(m.m_i||0).toFixed(3)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;">${(m.m_j||0).toFixed(3)}</td>
                <td style="padding:7px 10px;text-align:right;">${(s.v_i||0).toFixed(3)}</td>
                <td style="padding:7px 10px;text-align:right;">${(s.v_j||0).toFixed(3)}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // ─── 4. PER-SPAN DESIGN CARDS (gradient) ──────────────────────────────────
    const gradients = [
        'linear-gradient(135deg,#667eea,#764ba2)',
        'linear-gradient(135deg,#f093fb,#f5576c)',
        'linear-gradient(135deg,#4facfe,#00f2fe)',
        'linear-gradient(135deg,#43e97b,#38f9d7)',
        'linear-gradient(135deg,#fa709a,#fee140)',
    ];

    if (spanDesigns && spanDesigns.length > 0) {
        spanDesigns.forEach((sd, idx) => {
            if (!sd || !sd.design || !sd.design.success) return;
            const d   = sd.design;
            const bot = d.bottom  || {};
            const top = d.top     || {};
            const shr = d.shear   || {};
            const sls = d.sls     || {};
            const sec = d.section || {};
            const uls = d.uls     || {};
            const grad = gradients[idx % gradients.length];

            const h_mm  = sec.h    || Math.round(uls.depth || 450);
            const d_eff = sec.d_eff|| Math.round(uls.eff_depth || h_mm-60);
            const bW    = sec.b    || 225;
            const fcu   = sec.fcu  || 25;
            const fy_v  = sec.fy   || 460;

            const botBar = (bot.bar_options||[])[0] || {};
            const topBar = (top.bar_options||[])[0] || {};
            const lkBest = (shr.link_options||[])[1] || (shr.link_options||[])[0] || {};
            const botUtil = Math.min((bot.util||0)*100, 100);
            const shOk   = (shr.status||'').toLowerCase().includes('nominal') || (shr.status||'').toLowerCase().includes('min');

            html += `
            <div style="border-radius:14px;overflow:hidden;margin-bottom:16px;
                        box-shadow:0 4px 16px rgba(0,0,0,0.12);">
                <!-- Gradient header -->
                <div style="background:${grad};padding:18px 20px;color:white;">
                    <div style="font-size:11px;font-weight:600;opacity:0.85;margin-bottom:10px;
                                text-transform:uppercase;letter-spacing:0.6px;">
                        Span ${sd.label} &mdash; BS 8110:1997 Design &mdash; ${sd.L.toFixed(2)} m
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:12px;">
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Section</div>
                            <div style="font-size:20px;font-weight:700;line-height:1.1;">${bW}&times;${h_mm}<span style="font-size:11px;opacity:0.8;"> mm</span></div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">d eff</div>
                            <div style="font-size:20px;font-weight:700;line-height:1.1;">${d_eff}<span style="font-size:11px;opacity:0.8;"> mm</span></div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Bottom (sagging)</div>
                            <div style="font-size:20px;font-weight:700;line-height:1.1;">${botBar.label||'&mdash;'}</div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Top (hogging)</div>
                            <div style="font-size:20px;font-weight:700;line-height:1.1;">${topBar.label||'&mdash;'}</div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Links</div>
                            <div style="font-size:20px;font-weight:700;line-height:1.1;">${lkBest.label||'R8@nom'}</div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Util (bot)</div>
                            <div style="font-size:20px;font-weight:700;line-height:1.1;">${botUtil.toFixed(0)}<span style="font-size:11px;opacity:0.8;">%</span></div>
                        </div>
                    </div>
                </div>
                <!-- Detail body -->
                <div style="background:white;padding:14px 16px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                        <!-- Bottom steel -->
                        <div style="border-left:3px solid #16a34a;padding-left:10px;">
                            <div style="font-size:11px;font-weight:700;color:#15803d;margin-bottom:4px;">BOTTOM STEEL (sagging)</div>
                            <div style="font-size:12px;color:#374151;">
                                M = ${(bot.M_design||0).toFixed(2)} kNm &nbsp;|&nbsp;
                                K = ${(bot.K||0).toFixed(4)}&nbsp;
                                <span style="color:${parseFloat((bot.K||0).toFixed(4)) <= (bot.K_lim||0.156) ? PASS : FAIL};font-weight:700;">
                                    ${parseFloat((bot.K||0).toFixed(4)) <= (bot.K_lim||0.156) ? 'OK' : 'FAIL'}
                                </span>
                            </div>
                            <div style="font-size:12px;color:#374151;">
                                As,req = ${Math.round(bot.As_req||0)} mm&sup2; &nbsp;|&nbsp;
                                As,prov = ${Math.round(bot.As_prov||0)} mm&sup2;
                            </div>
                            <div style="font-size:12px;font-weight:700;color:#15803d;">
                                ${botBar.label||'&mdash;'} &nbsp; Mu = ${(bot.Mu_cap||0).toFixed(2)} kNm
                            </div>
                        </div>
                        <!-- Top steel -->
                        <div style="border-left:3px solid #dc2626;padding-left:10px;">
                            <div style="font-size:11px;font-weight:700;color:#b91c1c;margin-bottom:4px;">TOP STEEL (hogging)</div>
                            <div style="font-size:12px;color:#374151;">
                                M = ${(top.M_design||0).toFixed(2)} kNm &nbsp;|&nbsp;
                                K = ${(top.K||0).toFixed(4)}&nbsp;
                                <span style="color:${parseFloat((top.K||0).toFixed(4)) <= (top.K_lim||0.156) ? PASS : FAIL};font-weight:700;">
                                    ${parseFloat((top.K||0).toFixed(4)) <= (top.K_lim||0.156) ? 'OK' : 'FAIL'}
                                </span>
                            </div>
                            <div style="font-size:12px;color:#374151;">
                                As,req = ${Math.round(top.As_req||0)} mm&sup2; &nbsp;|&nbsp;
                                As,prov = ${Math.round(top.As_prov||0)} mm&sup2;
                            </div>
                            <div style="font-size:12px;font-weight:700;color:#b91c1c;">
                                ${topBar.label||'&mdash;'} &nbsp; Mu = ${(top.Mu_cap||0).toFixed(2)} kNm
                            </div>
                        </div>
                    </div>
                    <!-- Shear + SLS row -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div style="background:#fffbeb;border-left:3px solid #d97706;border-radius:4px;padding:8px 10px;font-size:12px;">
                            <div style="font-weight:700;color:#92400e;margin-bottom:3px;">SHEAR</div>
                            <div>v = ${(shr.v||0).toFixed(3)} &nbsp; vc = ${(shr.vc||0).toFixed(3)} N/mm&sup2;</div>
                            <div>Links: <b>${lkBest.label||'R8@nom'}</b> (2-leg) &nbsp; sv,max = ${(shr.sv_max||0).toFixed(0)} mm</div>
                            <div style="color:${shOk?PASS:WARN};font-weight:700;">${shr.status||''}</div>
                        </div>
                        <div style="background:${sls.deflection_check==='OK'?'#f0fdf4':'#fef2f2'};
                                    border-left:3px solid ${sls.deflection_check==='OK'?PASS:FAIL};
                                    border-radius:4px;padding:8px 10px;font-size:12px;">
                            <div style="font-weight:700;color:${sls.deflection_check==='OK'?'#14532d':'#991b1b'};margin-bottom:3px;">SLS</div>
                            <div>Deflection: <b>${sls.deflection_check||'?'}</b> &nbsp; span/d = ${(sls.span_depth_actual||0).toFixed(1)} / ${(sls.span_depth_allowable||0).toFixed(1)}</div>
                            <div>Crack: <b>${sls.crack_check||'?'}</b> &nbsp; s = ${(sls.actual_spacing||0).toFixed(0)} mm / ${(sls.max_bar_spacing||0).toFixed(0)} mm max</div>
                        </div>
                    </div>
                    <!-- Bar options -->
                    ${(bot.bar_options||[]).length > 1 ? `
                    <div style="margin-top:10px;">
                        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Bottom bar options:</div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px;">
                            ${(bot.bar_options||[]).map((b,i) => `
                                <span style="background:${i===0?'#dcfce7':'#f3f4f6'};
                                             color:${i===0?'#15803d':'#374151'};
                                             border:1px solid ${i===0?'#86efac':'#e5e7eb'};
                                             padding:3px 8px;border-radius:12px;font-size:11px;font-weight:${i===0?'700':'400'};">
                                    ${b.label} (${b.area} mm&sup2;)
                                </span>`).join('')}
                        </div>
                    </div>` : ''}
                </div>
            </div>`;
        });
    }

    // ─── 5. DIAGRAMS ──────────────────────────────────────────────────────────
    if (data.diagrams) {
        html += `
        <div style="background:white;padding:16px;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,0.07);">
            <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;">Diagrams</div>
            <div style="margin-bottom:14px;">
                <div style="font-size:11px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Shear Force Diagram</div>
                <img src="data:image/png;base64,${data.diagrams.sfd}" style="width:100%;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.10);">
            </div>
            <div>
                <div style="font-size:11px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Bending Moment Diagram</div>
                <img src="data:image/png;base64,${data.diagrams.bmd}" style="width:100%;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.10);">
            </div>
        </div>`;
    }

    document.getElementById('beam-results').innerHTML = html;
}

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
    canvas.height = 380;
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

        // Compute canvas direction of member
        const L_canvas_vec = { x: toCanvasX(nodeJ.x) - toCanvasX(nodeI.x), y: toCanvasY(nodeJ.y) - toCanvasY(nodeI.y) };
        const L_canvas = Math.sqrt(L_canvas_vec.x**2 + L_canvas_vec.y**2);
        const nx = L_canvas > 0 ? L_canvas_vec.x / L_canvas : 1;
        const ny = L_canvas > 0 ? L_canvas_vec.y / L_canvas : 0;

        // Perpendicular (CW rotation in canvas = outward normal for gravity on beams, lateral on columns)
        // perpX = ny, perpY = -nx
        // For horizontal member: nx=1, ny=0 → perpX=0, perpY=-1 → arrow from ABOVE ✓
        // For vertical member:   nx=0, ny=1 → perpX=1, perpY=0  → arrow from RIGHT ✓
        const perpX = ny;
        const perpY = -nx;

        const arrowLength = 50;

        if (load.type === 'point' || load.type === 'Point') {
            const ratio = (load.position || load.pos || 0) / L;
            const loadX = toCanvasX(nodeI.x + dx * ratio);
            const loadY = toCanvasY(nodeI.y + dy * ratio);

            // Arrow starts perpArrowLength away in the perpendicular direction
            const arrowStartX = loadX + perpX * arrowLength;
            const arrowStartY = loadY + perpY * arrowLength;

            ctx.strokeStyle = '#e74c3c'; ctx.fillStyle = '#e74c3c'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(arrowStartX, arrowStartY); ctx.lineTo(loadX, loadY); ctx.stroke();

            // Arrowhead pointing toward member
            const headDir = { x: loadX - arrowStartX, y: loadY - arrowStartY };
            const headLen = Math.sqrt(headDir.x**2 + headDir.y**2);
            if (headLen > 0) {
                const hx = headDir.x / headLen;
                const hy = headDir.y / headLen;
                const arrowSize = 8;
                ctx.beginPath();
                ctx.moveTo(loadX, loadY);
                ctx.lineTo(loadX - hx * arrowSize - hy * arrowSize * 0.5,
                           loadY - hy * arrowSize + hx * arrowSize * 0.5);
                ctx.lineTo(loadX - hx * arrowSize + hy * arrowSize * 0.5,
                           loadY - hy * arrowSize - hx * arrowSize * 0.5);
                ctx.closePath(); ctx.fill();
            }

            ctx.fillStyle = '#000'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`${load.magnitude || load.mag} kN`, arrowStartX + perpX * 8, arrowStartY + perpY * 8);

        } else if (load.type === 'udl' || load.type === 'UDL') {
            const numArrows = Math.max(4, Math.floor(L * Math.min(Math.abs(nx) > 0.5 ? (toCanvasX(nodeJ.x) - toCanvasX(nodeI.x)) : (toCanvasY(nodeI.y) - toCanvasY(nodeJ.y)), 300) / 50));
            ctx.strokeStyle = '#3498db'; ctx.fillStyle = '#3498db'; ctx.lineWidth = 2;
            const points = [];
            for (let i = 0; i <= numArrows; i++) {
                const ratio = i / numArrows;
                points.push({
                    x: toCanvasX(nodeI.x + dx * ratio),
                    y: toCanvasY(nodeI.y + dy * ratio)
                });
            }
            // Draw individual arrows perpendicular to member
            for (let i = 0; i <= numArrows; i++) {
                const px = points[i].x, py = points[i].y;
                const startX = px + perpX * arrowLength;
                const startY = py + perpY * arrowLength;
                ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(px, py); ctx.stroke();
                // Arrowhead toward member
                const hx2 = -perpX, hy2 = -perpY;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px - hx2 * 7 - hy2 * 4, py - hy2 * 7 + hx2 * 4);
                ctx.lineTo(px - hx2 * 7 + hy2 * 4, py - hy2 * 7 - hx2 * 4);
                ctx.closePath(); ctx.fill();
            }
            // Top line of UDL
            ctx.beginPath();
            ctx.moveTo(points[0].x + perpX * arrowLength, points[0].y + perpY * arrowLength);
            for (let i = 1; i <= numArrows; i++) {
                ctx.lineTo(points[i].x + perpX * arrowLength, points[i].y + perpY * arrowLength);
            }
            ctx.stroke();
            // Label
            const midIdx = Math.floor(numArrows / 2);
            ctx.fillStyle = '#000'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`${load.magnitude || load.mag} kN/m`,
                         points[midIdx].x + perpX * (arrowLength + 18),
                         points[midIdx].y + perpY * (arrowLength + 18));
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
            const designCode = document.getElementById('frame-design-code').value;
            const fck        = parseFloat(document.getElementById('frame-design-fck').value);
            const fy         = parseFloat(document.getElementById('frame-design-fy').value);
            const beamWidth  = parseFloat(document.getElementById('frame-beam-width').value) || 225;
            const columnSize = parseFloat(document.getElementById('frame-column-size').value) || 300;
            const cover      = parseFloat(document.getElementById('frame-design-cover').value) || 25;
            const barDia     = parseFloat(document.getElementById('frame-design-bar-dia').value) || 16;

            // ── Design every member individually ────────────────────────────────
            const memberDesigns = [];

            for (let i = 0; i < data.member_forces.length; i++) {
                const mf     = data.member_forces[i];
                const member = frameMembers[mf.member];
                if (!member) { memberDesigns.push(null); continue; }

                const ni = frameNodes[member.node_i];
                const nj = frameNodes[member.node_j];
                const L  = Math.sqrt((nj.x - ni.x)**2 + (nj.y - ni.y)**2);
                const isHorizontal = Math.abs(ni.y - nj.y) < 0.01;

                if (isHorizontal) {
                    // Beam member — design for both sagging and hogging
                    const M_ab = mf.M_ab || 0;
                    const M_ba = mf.M_ba || 0;
                    const M_pos = Math.max(0, M_ab, M_ba);         // sagging: max positive
                    const M_neg = Math.min(0, M_ab, M_ba);         // hogging: min negative
                    const V_max = Math.max(Math.abs(mf.V_a||0), Math.abs(mf.V_b||0));

                    try {
                        const resp = await fetch('/api/design/beam', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                design_code: designCode,
                                max_moment: M_pos,
                                min_moment: M_neg,
                                max_shear: V_max,
                                L_max: L,
                                width: beamWidth / 1000,   // m
                                fck, fy, cover, bar_dia: barDia
                            })
                        });
                        const d = await resp.json();
                        memberDesigns.push({ type: 'beam', label: `${numberToLetter(member.node_i)}-${numberToLetter(member.node_j)}`, L, design: d, forces: mf });
                    } catch(e) { memberDesigns.push(null); }

                } else {
                    // Column member
                    const M_col  = Math.max(Math.abs(mf.M_ab||0), Math.abs(mf.M_ba||0));
                    const N_axial = data.reactions
                        ? Math.max(...data.reactions.map(r => Math.abs(r.Ry || 0)))
                        : Math.abs(mf.N_a || mf.N_b || 0);

                    try {
                        const resp = await fetch('/api/design/column', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                design_code: designCode,
                                axial_force: N_axial,
                                moment: M_col,
                                length: L,
                                width: columnSize,
                                depth: columnSize,
                                fck, fyk: fy, cover, bar_dia: barDia
                            })
                        });
                        const d = await resp.json();
                        memberDesigns.push({ type: 'column', label: `${numberToLetter(member.node_i)}-${numberToLetter(member.node_j)}`, L, design: d, forces: mf });
                    } catch(e) { memberDesigns.push(null); }
                }
            }

            displayFrameResults(data, memberDesigns, barDia);
        } else {
            throw new Error(data.error || 'Frame analysis failed');
        }
    } catch (error) {
        document.getElementById('frame-results').innerHTML = `
            <div class="error">
                <strong>Error:</strong> ${error.message}
                <br><small>Make sure the API server is running: python api_server_final.py</small>
            </div>
        `;
    } finally {
        document.getElementById('frame-loading').classList.remove('active');
    }
}

function displayFrameResults(data, memberDesigns, barDia) {
    let html = '';
    const PASS = '#16a34a', FAIL = '#dc2626', WARN = '#d97706';

    // ─── 1. SWAY ───────────────────────────────────────────────────────────────
    const swayMm = (data.sway_delta || 0) * 1000;
    if (Math.abs(swayMm) > 0.001) {
        html += `
        <div style="background:#fff8e1;padding:12px 16px;border-radius:10px;
                    border-left:4px solid #f59e0b;margin-bottom:14px;
                    display:flex;align-items:baseline;gap:10px;">
            <span style="color:#92400e;font-size:13px;">Lateral Sway</span>
            <span style="color:#78350f;font-size:22px;font-weight:700;">${swayMm.toFixed(3)} mm</span>
        </div>`;
    }

    // ─── 2. MAX MOMENT / SHEAR ─────────────────────────────────────────────────
    if (data.max_moment !== undefined) {
        html += `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div style="background:#f0f4ff;padding:12px 16px;border-radius:10px;border-left:4px solid #667eea;">
                <span style="color:#555;font-size:12px;display:block;">Max Moment</span>
                <span style="color:#333;font-size:22px;font-weight:700;">${(data.max_moment||0).toFixed(3)}<span style="font-size:13px;color:#888;"> kNm</span></span>
            </div>
            <div style="background:#f0fff4;padding:12px 16px;border-radius:10px;border-left:4px solid #38a169;">
                <span style="color:#555;font-size:12px;display:block;">Max Shear</span>
                <span style="color:#333;font-size:22px;font-weight:700;">${(data.max_shear||0).toFixed(3)}<span style="font-size:13px;color:#888;"> kN</span></span>
            </div>
        </div>`;
    }

    // ─── 3. MEMBER FORCES TABLE ────────────────────────────────────────────────
    if (data.member_forces && data.member_forces.length > 0) {
        html += `
        <div style="background:white;padding:16px;border-radius:10px;margin-bottom:14px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.07);">
            <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;">Member End Moments &amp; Forces</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8fafc;">
                    <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Member</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">M<sub>AB</sub> (kNm)</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">M<sub>BA</sub> (kNm)</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">V<sub>A</sub> (kN)</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">V<sub>B</sub> (kN)</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">N<sub>A</sub> (kN)</th>
                </tr></thead><tbody>`;
        data.member_forces.forEach(m => {
            const ni = frameMembers[m.member] ? frameMembers[m.member].node_i : m.member;
            const nj = frameMembers[m.member] ? frameMembers[m.member].node_j : m.member + 1;
            const label = (ni !== undefined && nj !== undefined)
                ? `${numberToLetter(ni)}&ndash;${numberToLetter(nj)}` : `M${m.member}`;
            html += `<tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:7px 10px;">${label}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;">${(m.M_ab||0).toFixed(3)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;">${(m.M_ba||0).toFixed(3)}</td>
                <td style="padding:7px 10px;text-align:right;">${(m.V_a||0).toFixed(3)}</td>
                <td style="padding:7px 10px;text-align:right;">${(m.V_b||0).toFixed(3)}</td>
                <td style="padding:7px 10px;text-align:right;">${(m.N_a||0).toFixed(3)}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // ─── 4. REACTIONS ─────────────────────────────────────────────────────────
    if (data.reactions && data.reactions.length > 0) {
        html += `
        <div style="background:white;padding:16px;border-radius:10px;margin-bottom:14px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.07);">
            <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;">Support Reactions</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8fafc;">
                    <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e5e7eb;">Node</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">Rx (kN)</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">Ry (kN)</th>
                    <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e5e7eb;">M (kNm)</th>
                </tr></thead><tbody>`;
        data.reactions.forEach(r => {
            html += `<tr style="border-bottom:1px solid #f0f0f0;">
                <td style="padding:7px 10px;font-weight:600;">${numberToLetter(r.node)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;">${(r.Rx||0).toFixed(3)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;">${(r.Ry||0).toFixed(3)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:600;">${(r.M||0).toFixed(3)}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    // ─── 5. PER-MEMBER DESIGN CARDS (gradient) ─────────────────────────────────
    const beamDesigns   = (memberDesigns || []).filter(d => d && d.type === 'beam');
    const columnDesigns = (memberDesigns || []).filter(d => d && d.type === 'column');

    const beamGrads = [
        'linear-gradient(135deg,#667eea,#764ba2)',
        'linear-gradient(135deg,#4facfe,#00f2fe)',
        'linear-gradient(135deg,#43e97b,#38f9d7)',
        'linear-gradient(135deg,#fa709a,#fee140)',
    ];
    const colGrad = 'linear-gradient(135deg,#f093fb,#f5576c)';

    if (beamDesigns.length > 0) {
        html += `<div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:8px;">
                    Beam Design &mdash; BS 8110:1997 (per member)</div>`;

        beamDesigns.forEach((bd, idx) => {
            if (!bd || !bd.design || !bd.design.success) return;
            const d   = bd.design;
            const sec = d.section || {};
            const bot = d.bottom  || {};
            const top = d.top     || {};
            const shr = d.shear   || {};
            const sls = d.sls     || {};
            const uls = d.uls     || {};
            const grad = beamGrads[idx % beamGrads.length];

            const h_mm  = sec.h    || Math.round(uls.depth || 450);
            const d_eff = sec.d_eff|| Math.round(uls.eff_depth || h_mm-60);
            const bW    = sec.b    || 225;

            const botBar = (bot.bar_options||[])[0] || {};
            const topBar = (top.bar_options||[])[0] || {};
            const lkBest = (shr.link_options||[])[1] || (shr.link_options||[])[0] || {};
            const botUtil= Math.min((bot.util||0)*100, 100);
            const shOk   = (shr.status||'').toLowerCase().includes('nominal') || (shr.status||'').toLowerCase().includes('min');

            html += `
            <div style="border-radius:14px;overflow:hidden;margin-bottom:14px;
                        box-shadow:0 4px 16px rgba(0,0,0,0.12);">
                <div style="background:${grad};padding:18px 20px;color:white;">
                    <div style="font-size:11px;font-weight:600;opacity:0.85;margin-bottom:10px;
                                text-transform:uppercase;letter-spacing:0.6px;">
                        Member ${bd.label} &mdash; Beam &nbsp; (${bd.L.toFixed(2)} m)
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:12px;">
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Section</div>
                            <div style="font-size:20px;font-weight:700;line-height:1.1;">${bW}&times;${h_mm}<span style="font-size:11px;opacity:0.8;"> mm</span></div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">d eff</div>
                            <div style="font-size:20px;font-weight:700;line-height:1.1;">${d_eff}<span style="font-size:11px;opacity:0.8;"> mm</span></div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Bottom steel</div>
                            <div style="font-size:20px;font-weight:700;line-height:1.1;">${botBar.label||'&mdash;'}</div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Top steel</div>
                            <div style="font-size:20px;font-weight:700;line-height:1.1;">${topBar.label||'&mdash;'}</div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Links</div>
                            <div style="font-size:20px;font-weight:700;line-height:1.1;">${lkBest.label||'R8@nom'}</div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Util (bot)</div>
                            <div style="font-size:20px;font-weight:700;line-height:1.1;">${botUtil.toFixed(0)}<span style="font-size:11px;opacity:0.8;">%</span></div>
                        </div>
                    </div>
                </div>
                <div style="background:white;padding:14px 16px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                        <div style="border-left:3px solid #16a34a;padding-left:10px;">
                            <div style="font-size:11px;font-weight:700;color:#15803d;margin-bottom:4px;">BOTTOM STEEL (sagging)</div>
                            <div style="font-size:12px;color:#374151;">M = ${(bot.M_design||0).toFixed(2)} kNm &nbsp;|&nbsp; As,req = ${Math.round(bot.As_req||0)} mm&sup2;</div>
                            <div style="font-size:12px;font-weight:700;color:#15803d;">${botBar.label||'&mdash;'} &nbsp; As,prov = ${Math.round(bot.As_prov||0)} mm&sup2; &nbsp; Mu = ${(bot.Mu_cap||0).toFixed(2)} kNm</div>
                        </div>
                        <div style="border-left:3px solid #dc2626;padding-left:10px;">
                            <div style="font-size:11px;font-weight:700;color:#b91c1c;margin-bottom:4px;">TOP STEEL (hogging)</div>
                            <div style="font-size:12px;color:#374151;">M = ${(top.M_design||0).toFixed(2)} kNm &nbsp;|&nbsp; As,req = ${Math.round(top.As_req||0)} mm&sup2;</div>
                            <div style="font-size:12px;font-weight:700;color:#b91c1c;">${topBar.label||'&mdash;'} &nbsp; As,prov = ${Math.round(top.As_prov||0)} mm&sup2; &nbsp; Mu = ${(top.Mu_cap||0).toFixed(2)} kNm</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div style="background:#fffbeb;border-left:3px solid #d97706;border-radius:4px;padding:8px 10px;font-size:12px;">
                            <div style="font-weight:700;color:#92400e;margin-bottom:2px;">SHEAR</div>
                            <div>v = ${(shr.v||0).toFixed(3)} N/mm&sup2; &nbsp; vc = ${(shr.vc||0).toFixed(3)} N/mm&sup2;</div>
                            <div>Links: <b>${lkBest.label||'R8@nom'}</b> &nbsp; sv,max = ${(shr.sv_max||0).toFixed(0)} mm</div>
                            <div style="color:${shOk?PASS:WARN};font-weight:700;">${shr.status||''}</div>
                        </div>
                        <div style="background:${sls.deflection_check==='OK'?'#f0fdf4':'#fef2f2'};
                                    border-left:3px solid ${sls.deflection_check==='OK'?PASS:FAIL};
                                    border-radius:4px;padding:8px 10px;font-size:12px;">
                            <div style="font-weight:700;color:${sls.deflection_check==='OK'?'#14532d':'#991b1b'};margin-bottom:2px;">SLS</div>
                            <div>Deflection: <b>${sls.deflection_check||'?'}</b> &nbsp; span/d = ${(sls.span_depth_actual||0).toFixed(1)} / ${(sls.span_depth_allowable||0).toFixed(1)}</div>
                            <div>Crack: <b>${sls.crack_check||'?'}</b> &nbsp; s = ${(sls.actual_spacing||0).toFixed(0)} / ${(sls.max_bar_spacing||0).toFixed(0)} mm</div>
                        </div>
                    </div>
                </div>
            </div>`;
        });
    }

    // ─── 6. COLUMN DESIGN CARDS ───────────────────────────────────────────────
    if (columnDesigns.length > 0) {
        html += `<div style="font-size:13px;font-weight:700;color:#374151;margin:4px 0 8px;">
                    Column Design &mdash; BS 8110:1997 (per member)</div>`;
        columnDesigns.forEach(cd => {
            if (!cd || !cd.design || !cd.design.success) return;
            const du   = cd.design.uls || cd.design;
            const slsd = cd.design.sls || {};
            const N_kN = Math.abs(cd.forces.N_a || cd.forces.N_b || 0).toFixed(1);
            const M_kNm= Math.max(Math.abs(cd.forces.M_ab||0), Math.abs(cd.forces.M_ba||0)).toFixed(2);
            const As_req  = Math.round(du.steel_area_req || du.steel_area || 0);
            const As_prov = Math.round(du.steel_area_prov || du.provided_area || 0);
            const nBars   = du.num_bars || '?';
            const bDia    = Math.round(du.bar_size || barDia);
            const util    = parseFloat((du.utilization || 0).toFixed(0));
            const uColor  = util < 70 ? PASS : util < 90 ? WARN : FAIL;

            html += `
            <div style="border-radius:14px;overflow:hidden;margin-bottom:14px;
                        box-shadow:0 4px 16px rgba(0,0,0,0.12);">
                <div style="background:${colGrad};padding:18px 20px;color:white;">
                    <div style="font-size:11px;font-weight:600;opacity:0.85;margin-bottom:10px;
                                text-transform:uppercase;letter-spacing:0.6px;">
                        Member ${cd.label} &mdash; Column &nbsp; (${cd.L.toFixed(2)} m)
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:12px;">
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Axial N (kN)</div>
                            <div style="font-size:22px;font-weight:700;line-height:1.1;">${N_kN}</div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Moment (kNm)</div>
                            <div style="font-size:22px;font-weight:700;line-height:1.1;">${M_kNm}</div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">As,req (mm&sup2;)</div>
                            <div style="font-size:22px;font-weight:700;line-height:1.1;">${As_req}</div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Bars</div>
                            <div style="font-size:22px;font-weight:700;line-height:1.1;">${nBars}Y${bDia}</div>
                        </div>
                        <div>
                            <div style="opacity:0.75;font-size:10px;">Utilization</div>
                            <div style="font-size:22px;font-weight:700;line-height:1.1;">${util}<span style="font-size:11px;opacity:0.8;">%</span></div>
                        </div>
                    </div>
                </div>
                <div style="background:white;padding:12px 16px;font-size:12px;color:#374151;">
                    <span style="color:#6b7280;">As,prov:</span> <b>${As_prov} mm&sup2;</b> &nbsp;&nbsp;
                    <span style="color:#6b7280;">Slenderness:</span> <b>${du.slenderness_category||'?'}</b> &nbsp;&nbsp;
                    ${slsd.cover_check ? `<span style="color:#6b7280;">Cover:</span> <b>${slsd.cover_check}</b> &nbsp;&nbsp;` : ''}
                    ${slsd.min_link_dia ? `<span style="color:#6b7280;">Links:</span> <b>R${slsd.min_link_dia}@${slsd.max_link_spacing} max</b>` : ''}
                </div>
            </div>`;
        });
    }

    // ─── 7. DIAGRAMS ──────────────────────────────────────────────────────────
    if (data.diagrams) {
        html += `
        <div style="background:white;padding:16px;border-radius:10px;
                    box-shadow:0 1px 6px rgba(0,0,0,0.07);">
            <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:12px;">Diagrams</div>
            <div style="margin-bottom:20px;">
                <div style="font-size:12px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;">Bending Moment Diagram</div>
                <img src="data:image/png;base64,${data.diagrams.bmd}" style="width:100%;border-radius:6px;">
            </div>
            <div>
                <div style="font-size:12px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;">Shear Force Diagram</div>
                <img src="data:image/png;base64,${data.diagrams.sfd}" style="width:100%;border-radius:6px;">
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
