"""
FINAL CORRECTED API SERVER
 Beam: Proper slope-deflection (from Streamlit beam code)
 Frame: Proper slope-deflection (from Streamlit frame code)
 Robust load data handling
 Clean minimal output
"""

from flask import Flask, request, jsonify
import numpy as np
import math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Rectangle
import base64
from io import BytesIO

import os
app = Flask(__name__, static_folder='static')

@app.route('/')
def index():
    return app.send_static_file('page_2.html')

# Add CORS headers
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

print("\n" + "="*70)
print("   BEAM SOLVER: Proper Slope-Deflection Method (from Streamlit)")
print("   FRAME SOLVER: Proper Slope-Deflection Method (from Streamlit)")  
print("   VALUES: Accurate and NOT scaled")
print("   DESIGN: Always displays")
print("="*70 + "\n")

# ===== BEAM ANALYSIS (from Streamlit beam code) =====

class BeamNode:
    def __init__(self, id, pos, type):
        self.id = id
        self.x = pos
        self.type = type.lower()
        self.theta = 0.0
        self.reaction = 0.0
        self.moment = 0.0

class BeamElement:
    def __init__(self, node_i, node_j, E, I):
        self.node_i = node_i
        self.node_j = node_j
        self.L = node_j.x - node_i.x
        self.EI = E * I
        self.m_i = 0.0
        self.m_j = 0.0
        self.shear_i = 0.0
        self.shear_j = 0.0

class BeamLoad:
    def __init__(self, type, mag, start, end=None, mag_end=None):
        self.type = type
        self.mag = mag
        self.start = start
        self.end = end
        self.mag_end = mag_end

def get_fems(element, loads):
    """Calculate Fixed End Moments (from Streamlit)"""
    fem_i, fem_j = 0.0, 0.0
    L = element.L
    xi = element.node_i.x
    
    for load in loads:
        if load.type == 'Point':
            if xi <= load.start <= (xi + L):
                a = load.start - xi
                b = L - a
                fem_i += -(load.mag * a * b**2) / (L**2)
                fem_j += +(load.mag * a**2 * b) / (L**2)
                
        elif load.type == 'UDL':
            start = max(load.start, xi)
            end = min(load.end, xi + L)
            if start < end:
                w = load.mag
                a = start - xi
                c = end - start 
                if abs(c - L) < 1e-5:
                    fem_i += -(w * L**2) / 12.0
                    fem_j += +(w * L**2) / 12.0
                else:
                    P_eq = w * c
                    x_c = a + c/2
                    b_c = L - x_c
                    fem_i += -(P_eq * x_c * b_c**2) / (L**2)
                    fem_j += +(P_eq * x_c**2 * b_c) / (L**2)
                    
        elif load.type == 'VDL':
            start = max(load.start, xi)
            end = min(load.end, xi + L)
            if start < end:
                total_length = load.end - load.start
                w1 = load.mag
                w2 = load.mag_end
                
                if total_length > 1e-6:
                    ratio_start = (start - load.start) / total_length
                    w_start = w1 + ratio_start * (w2 - w1)
                    ratio_end = (end - load.start) / total_length
                    w_end = w1 + ratio_end * (w2 - w1)
                else:
                    w_start = w1
                    w_end = w2
                
                a = start - xi
                c = end - start
                
                if abs(a) < 1e-6 and abs(c - L) < 1e-6:
                    fem_i += -(3*w_start + 2*w_end) * L**2 / 60.0
                    fem_j += +(2*w_start + 3*w_end) * L**2 / 60.0
                else:
                    P_total = (w_start + w_end) / 2.0 * c
                    
                    if abs(w_start + w_end) > 1e-6:
                        c_bar = (w_start + 2*w_end) * c / (3.0 * (w_start + w_end))
                    else:
                        c_bar = c / 2.0
                    
                    x_c = a + c_bar
                    b_c = L - x_c
                    fem_i += -(P_total * x_c * b_c**2) / (L**2)
                    fem_j += +(P_total * x_c**2 * b_c) / (L**2)
                    
    return fem_i, fem_j

def get_static_moment(node, side, elements, loads):
    """Calculate moment from cantilever (from Streamlit)"""
    moment = 0.0
    target_elem = None
    
    if side == 'left':
        for e in elements:
            if e.node_j == node and e.node_i.type == 'free':
                target_elem = e
                break
    else:
        for e in elements:
            if e.node_i == node and e.node_j.type == 'free':
                target_elem = e
                break
    
    if not target_elem:
        return 0.0

    if side == 'left':
        for l in loads:
            if l.type == 'Point' and target_elem.node_i.x <= l.start <= target_elem.node_j.x:
                dist = target_elem.node_j.x - l.start
                moment += l.mag * dist
            elif l.type == 'UDL':
                s = max(l.start, target_elem.node_i.x)
                e = min(l.end, target_elem.node_j.x)
                if s < e:
                    length = e - s
                    centroid = s + length / 2
                    dist = target_elem.node_j.x - centroid
                    moment += (l.mag * length) * dist
            elif l.type == 'VDL':
                s = max(l.start, target_elem.node_i.x)
                e = min(l.end, target_elem.node_j.x)
                if s < e:
                    total_length = l.end - l.start
                    if total_length > 1e-6:
                        ratio_start = (s - l.start) / total_length
                        w_start = l.mag + ratio_start * (l.mag_end - l.mag)
                        ratio_end = (e - l.start) / total_length
                        w_end = l.mag + ratio_end * (l.mag_end - l.mag)
                    else:
                        w_start = l.mag
                        w_end = l.mag_end
                    
                    length = e - s
                    P_total = (w_start + w_end) / 2.0 * length
                    
                    if abs(w_start + w_end) > 1e-6:
                        c_bar = (w_start + 2*w_end) * length / (3.0 * (w_start + w_end))
                    else:
                        c_bar = length / 2.0
                    
                    centroid = s + c_bar
                    dist = target_elem.node_j.x - centroid
                    moment += P_total * dist
    else:
        for l in loads:
            if l.type == 'Point' and target_elem.node_i.x <= l.start <= target_elem.node_j.x:
                dist = l.start - target_elem.node_i.x
                moment += l.mag * dist
            elif l.type == 'UDL':
                s = max(l.start, target_elem.node_i.x)
                e = min(l.end, target_elem.node_j.x)
                if s < e:
                    length = e - s
                    centroid = s + length/2
                    dist = centroid - target_elem.node_i.x
                    moment += (l.mag * length) * dist
            elif l.type == 'VDL':
                s = max(l.start, target_elem.node_i.x)
                e = min(l.end, target_elem.node_j.x)
                if s < e:
                    total_length = l.end - l.start
                    if total_length > 1e-6:
                        ratio_start = (s - l.start) / total_length
                        w_start = l.mag + ratio_start * (l.mag_end - l.mag)
                        ratio_end = (e - l.start) / total_length
                        w_end = l.mag + ratio_end * (l.mag_end - l.mag)
                    else:
                        w_start = l.mag
                        w_end = l.mag_end
                    
                    length = e - s
                    P_total = (w_start + w_end) / 2.0 * length
                    
                    if abs(w_start + w_end) > 1e-6:
                        c_bar = (w_start + 2*w_end) * length / (3.0 * (w_start + w_end))
                    else:
                        c_bar = length / 2.0
                    
                    centroid = s + c_bar
                    dist = centroid - target_elem.node_i.x
                    moment += P_total * dist
                    
    return moment

def solve_beam_structure(nodes, elements, loads):
    """Slope-deflection solver (from Streamlit)"""
    dof_nodes = [n for n in nodes if n.type in ['pinned', 'roller']]
    dof_map = {n.id: i for i, n in enumerate(dof_nodes)}
    n_dof = len(dof_nodes)
    
    if n_dof == 0:
        return
    
    K = np.zeros((n_dof, n_dof))
    F = np.zeros(n_dof)
    
    for elem in elements:
        if elem.node_i.type == 'free' or elem.node_j.type == 'free':
            continue
        
        k_val = 2 * elem.EI / elem.L
        fem_i, fem_j = get_fems(elem, loads)
        
        if elem.node_i.id in dof_map:
            idx = dof_map[elem.node_i.id]
            K[idx, idx] += 2 * k_val 
            F[idx] -= fem_i 
            if elem.node_j.id in dof_map:
                jdx = dof_map[elem.node_j.id]
                K[idx, jdx] += k_val
        
        if elem.node_j.id in dof_map:
            idx = dof_map[elem.node_j.id]
            K[idx, idx] += 2 * k_val
            F[idx] -= fem_j
            if elem.node_i.id in dof_map:
                jdx = dof_map[elem.node_i.id]
                K[idx, jdx] += k_val
    
    for i, node in enumerate(dof_nodes):
        m_left = get_static_moment(node, 'left', elements, loads)
        m_right = get_static_moment(node, 'right', elements, loads)
        F[i] += (m_left + m_right)
    
    try:
        thetas = np.linalg.solve(K, F)
        for i, node in enumerate(dof_nodes):
            node.theta = thetas[i]
    except np.linalg.LinAlgError:
        print("Matrix Singular: Structure is unstable.")
        return
    
    for elem in elements:
        k = 2 * elem.EI / elem.L
        fem_i, fem_j = get_fems(elem, loads)
        
        if elem.node_i.type == 'free':
            elem.m_i = 0.0
            elem.m_j = -get_static_moment(elem.node_j, 'left', [elem], loads)
        elif elem.node_j.type == 'free':
            elem.m_i = -get_static_moment(elem.node_i, 'right', [elem], loads)
            elem.m_j = 0.0
        else:
            elem.m_i = fem_i + k * (2*elem.node_i.theta + elem.node_j.theta)
            elem.m_j = fem_j + k * (elem.node_i.theta + 2*elem.node_j.theta)
        
        moment_of_loads_about_j = 0.0
        total_load = 0.0
        
        for l in loads:
            if l.type == 'Point' and elem.node_i.x <= l.start <= elem.node_j.x:
                dist_from_j = elem.node_j.x - l.start
                moment_of_loads_about_j += l.mag * dist_from_j
                total_load += l.mag
            elif l.type == 'UDL':
                s = max(l.start, elem.node_i.x)
                e = min(l.end, elem.node_j.x)
                if s < e:
                    P = l.mag * (e - s)
                    centroid = s + (e-s)/2
                    dist_from_j = elem.node_j.x - centroid
                    moment_of_loads_about_j += P * dist_from_j
                    total_load += P
            elif l.type == 'VDL':
                s = max(l.start, elem.node_i.x)
                e = min(l.end, elem.node_j.x)
                if s < e:
                    total_length = l.end - l.start
                    if total_length > 1e-6:
                        ratio_start = (s - l.start) / total_length
                        w_start = l.mag + ratio_start * (l.mag_end - l.mag)
                        ratio_end = (e - l.start) / total_length
                        w_end = l.mag + ratio_end * (l.mag_end - l.mag)
                    else:
                        w_start = l.mag
                        w_end = l.mag_end
                    
                    length = e - s
                    P = (w_start + w_end) / 2.0 * length
                    
                    if abs(w_start + w_end) > 1e-6:
                        c_bar = (w_start + 2*w_end) * length / (3.0 * (w_start + w_end))
                    else:
                        c_bar = length / 2.0
                    
                    centroid = s + c_bar
                    dist_from_j = elem.node_j.x - centroid
                    moment_of_loads_about_j += P * dist_from_j
                    total_load += P
        
        elem.shear_i = (moment_of_loads_about_j - (elem.m_i + elem.m_j)) / elem.L
        elem.shear_j = -(total_load - elem.shear_i)
    
    for node in nodes:
        r_val = 0.0
        for e in elements:
            if e.node_i == node:
                r_val += e.shear_i
        for e in elements:
            if e.node_j == node:
                r_val -= e.shear_j
        node.reaction = r_val

# ===== FRAME ANALYSIS (from Streamlit frame code) =====

class Node:
    def __init__(self, id, x, y, support_type="free"):
        self.id = id
        self.x = x
        self.y = y
        self.support_type = support_type.lower()
        self.theta = 0.0
        self.reaction_x = 0.0
        self.reaction_y = 0.0
        self.reaction_m = 0.0

class Member:
    def __init__(self, node_start, node_end, E, I):
        self.node_a = node_start
        self.node_b = node_end
        self.E = E
        self.I = I
        self.EI = E * I
        self.L = math.sqrt((node_end.x - node_start.x)**2 + (node_end.y - node_start.y)**2)
        self.angle = math.atan2(node_end.y - node_start.y, node_end.x - node_start.x)
        self.is_vertical = abs(math.cos(self.angle)) < 0.01
        self.is_horizontal = abs(math.sin(self.angle)) < 0.01
        self.cos_a = math.cos(self.angle)
        self.sin_a = math.sin(self.angle)
        
        self.loads = []
        self.fem_ab = 0.0
        self.fem_ba = 0.0
        self.m_ab = 0.0
        self.m_ba = 0.0
        self.shear_a = 0.0
        self.shear_b = 0.0
        self.axial_a = 0.0
        self.axial_b = 0.0

class FrameLoad:
    def __init__(self, type, magnitude, position=0, magnitude_end=0):
        self.type = type.lower()
        self.magnitude = magnitude
        self.position = position
        self.magnitude_end = magnitude_end

def calculate_fems(member):
    """Calculate fixed end moments for frame (from Streamlit)"""
    fem_ab, fem_ba = 0.0, 0.0
    L = member.L
    
    for load in member.loads:
        if load.type == 'point':
            a = load.position
            b = L - a
            P = load.magnitude
            fem_ab += -(P * a * b**2) / (L**2)
            fem_ba += (P * a**2 * b) / (L**2)
            
        elif load.type == 'udl':
            w = load.magnitude
            fem_ab += -(w * L**2) / 12.0
            fem_ba += (w * L**2) / 12.0
            
        elif load.type == 'vdl':
            w1 = load.magnitude
            w2 = load.magnitude_end
            # Decompose into rectangular and triangular
            w_rect = min(w1, w2)
            w_tri = abs(w2 - w1)
            
            # Rectangular part
            fem_ab += -(w_rect * L**2) / 12.0
            fem_ba += (w_rect * L**2) / 12.0
            
            # Triangular part
            if w2 > w1:
                fem_ab += -(w_tri * L**2) / 20.0
                fem_ba += (w_tri * L**2) / 30.0
            else:
                fem_ab += -(w_tri * L**2) / 30.0
                fem_ba += (w_tri * L**2) / 20.0
    
    member.fem_ab = fem_ab
    member.fem_ba = fem_ba
    return fem_ab, fem_ba

def analyze_frame(nodes, members, loads_data):
    """Frame analysis using slope deflection (from Streamlit)"""
    # Clear existing loads
    for m in members:
        m.loads = []
    
    # Parse and assign loads to members
    for load_data in loads_data:
        if 'member' in load_data:
            member_idx = load_data['member']
            if 0 <= member_idx < len(members):
                # Robust load data parsing
                load_type = load_data.get('type', 'point').lower()
                magnitude = load_data.get('magnitude', load_data.get('mag', 0))
                position = load_data.get('position', load_data.get('pos', 0))
                magnitude_end = load_data.get('magnitude_end', load_data.get('mag_end', 0))
                
                members[member_idx].loads.append(FrameLoad(
                    load_type,
                    magnitude,
                    position,
                    magnitude_end
                ))
    
    # Calculate FEMs
    for m in members:
        calculate_fems(m)
    
    # Identify DOF nodes
    dof_nodes = [n for n in nodes if n.support_type in ['pinned', 'roller']]
    n_dof = len(dof_nodes)
    dof_map = {n.id: i for i, n in enumerate(dof_nodes)}
    
    if n_dof == 0:
        # All fixed - just use FEMs
        for m in members:
            m.m_ab = m.fem_ab
            m.m_ba = m.fem_ba
    else:
        # Build and solve stiffness matrix
        K = np.zeros((n_dof, n_dof))
        F = np.zeros(n_dof)
        
        for m in members:
            k_val = 2 * m.EI / m.L
            
            if m.node_a.id in dof_map:
                i = dof_map[m.node_a.id]
                K[i, i] += 2 * k_val
                F[i] -= m.fem_ab
                if m.node_b.id in dof_map:
                    j = dof_map[m.node_b.id]
                    K[i, j] += k_val
            
            if m.node_b.id in dof_map:
                i = dof_map[m.node_b.id]
                K[i, i] += 2 * k_val
                F[i] -= m.fem_ba
                if m.node_a.id in dof_map:
                    j = dof_map[m.node_a.id]
                    K[i, j] += k_val
        
        try:
            thetas = np.linalg.solve(K, F)
            for i, node in enumerate(dof_nodes):
                node.theta = thetas[i]
        except:
            pass
        
        # Calculate member moments
        for m in members:
            k = 2 * m.EI / m.L
            m.m_ab = m.fem_ab + k * (2*m.node_a.theta + m.node_b.theta)
            m.m_ba = m.fem_ba + k * (m.node_a.theta + 2*m.node_b.theta)
    
    # Calculate member shears and axials
    for m in members:
        P_total = 0
        M_about_b = 0
        
        for load in m.loads:
            if load.type == 'point':
                P_total += load.magnitude
                M_about_b += load.magnitude * (m.L - load.position)
            elif load.type == 'udl':
                P = load.magnitude * m.L
                P_total += P
                M_about_b += P * (m.L / 2)
            elif load.type == 'vdl':
                w1, w2 = load.magnitude, load.magnitude_end
                P = (w1 + w2) * m.L / 2
                P_total += P
                if abs(w2 - w1) < 1e-6:
                    centroid = m.L / 2
                else:
                    if w2 > w1:
                        centroid = m.L * (w1 + 2*w2) / (3 * (w1 + w2))
                    else:
                        centroid = m.L * (2*w1 + w2) / (3 * (w1 + w2))
                M_about_b += P * (m.L - centroid)
        
        V_a_local = (M_about_b - (m.m_ab + m.m_ba)) / m.L
        V_b_local = P_total - V_a_local
        
        if m.is_horizontal:
            m.shear_a = V_a_local
            m.shear_b = -V_b_local
            m.axial_a = 0
            m.axial_b = 0
        elif m.is_vertical:
            m.shear_a = 0
            m.shear_b = 0
            m.axial_a = V_a_local
            m.axial_b = -V_b_local
        else:
            m.shear_a = V_a_local * m.cos_a
            m.shear_b = -V_b_local * m.cos_a
            m.axial_a = V_a_local * m.sin_a
            m.axial_b = -V_b_local * m.sin_a
    
    # Calculate reactions
    for node in nodes:
        Rx, Ry, M = 0.0, 0.0, 0.0
        
        for m in members:
            if m.node_a == node:
                Rx += -m.axial_a * m.cos_a + m.shear_a * m.sin_a
                Ry += -m.axial_a * m.sin_a - m.shear_a * m.cos_a
                M += m.m_ab
            elif m.node_b == node:
                Rx += m.axial_b * m.cos_a - m.shear_b * m.sin_a
                Ry += m.axial_b * m.sin_a + m.shear_b * m.cos_a
                M += m.m_ba
        
        if node.support_type in ['fixed', 'pinned', 'roller']:
            node.reaction_x = -Rx
            node.reaction_y = -Ry
            if node.support_type == 'fixed':
                node.reaction_m = -M

# ===== DIAGRAM CREATION =====

def create_beam_diagram_image(x, y, title, ylabel, color):
    """Create detailed annotated beam diagram — light theme"""
    pos_fill = '#dbeafe' if 'Moment' in title else '#dcfce7'
    neg_fill = '#fee2e2' if 'Moment' in title else '#fef9c3'
    line_col = '#1d4ed8' if 'Moment' in title else '#15803d'
    ann_neg  = '#b91c1c'

    fig, ax = plt.subplots(figsize=(13, 4.5))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#f9fafb')
    for spine in ax.spines.values():
        spine.set_edgecolor('#e5e7eb')
    ax.tick_params(colors='#374151', labelsize=9)
    for lbl in ax.get_xticklabels() + ax.get_yticklabels():
        lbl.set_color('#374151')

    ax.plot(x, y, color=line_col, linewidth=2.5, zorder=4)
    ax.fill_between(x, 0, y, where=(y >= 0), color=pos_fill, alpha=0.8, interpolate=True, zorder=3)
    ax.fill_between(x, 0, y, where=(y < 0), color=neg_fill,  alpha=0.8, interpolate=True, zorder=3)
    ax.axhline(0, color='#9ca3af', linewidth=1.5, zorder=2)
    ax.grid(True, alpha=0.5, linestyle=':', linewidth=0.6, color='#e5e7eb', zorder=1)

    def annotate_val(xv, yv, label, col, above=True):
        offset = 16 if above else -20
        ax.annotate(
            label, xy=(xv, yv), xytext=(0, offset),
            textcoords='offset points', fontsize=8, fontweight='bold',
            ha='center', color=col,
            bbox=dict(boxstyle='round,pad=0.3', facecolor='white',
                      edgecolor=col, alpha=0.95, linewidth=0.9),
            arrowprops=dict(arrowstyle='->', color=col, lw=0.9) if abs(offset) > 18 else {}
        )

    if len(y) > 0:
        idx_max = int(np.argmax(y));  max_val = float(y[idx_max])
        idx_min = int(np.argmin(y));  min_val = float(y[idx_min])
        if abs(max_val) > 0.01:
            ax.plot(x[idx_max], max_val, 'o', color=line_col, markersize=7, zorder=6)
            annotate_val(x[idx_max], max_val, f'{max_val:.3f}', line_col, above=True)
        if abs(min_val) > 0.01 and idx_min != idx_max:
            ax.plot(x[idx_min], min_val, 'o', color=ann_neg, markersize=7, zorder=6)
            annotate_val(x[idx_min], min_val, f'{min_val:.3f}', ann_neg, above=False)
        for end_i, (xv, yv) in [(0, (x[0], y[0])), (-1, (x[-1], y[-1]))]:
            if abs(yv) > 0.01:
                ax.plot(xv, yv, 's', color='#6b7280', markersize=6, zorder=5)
                ax.annotate(f'{yv:.3f}', xy=(xv, yv),
                            xytext=(10 if end_i == 0 else -10, 10),
                            textcoords='offset points', fontsize=7.5,
                            ha='left' if end_i == 0 else 'right', color='#374151',
                            bbox=dict(boxstyle='round,pad=0.25', facecolor='white',
                                      edgecolor='#d1d5db', alpha=0.9, linewidth=0.7))

    ax.set_title(title, fontsize=12, fontweight='bold', color='#111827', pad=10)
    ax.set_xlabel('Position along beam (m)', fontsize=10, color='#6b7280', fontweight='bold')
    ax.set_ylabel(ylabel, fontsize=10, color='#6b7280', fontweight='bold')

    plt.tight_layout(pad=1.2)
    buffer = BytesIO()
    plt.savefig(buffer, format='png', dpi=120, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.read()).decode()
    plt.close(fig)
    return image_base64


# ===== FRAME ANALYSIS — Full Streamlit port with sway + diagrams =====

class FrameNode:
    def __init__(self, id, x, y, support_type="free"):
        self.id = id
        self.x = x
        self.y = y
        self.support_type = support_type.lower()
        self.theta = 0.0
        self.reaction_x = 0.0
        self.reaction_y = 0.0
        self.reaction_m = 0.0

class FrameMember:
    def __init__(self, node_start, node_end, E, I):
        self.node_a = node_start
        self.node_b = node_end
        self.E = E
        self.I = I
        self.EI = E * I
        self.L = math.sqrt((node_end.x - node_start.x)**2 + (node_end.y - node_start.y)**2)
        self.angle = math.atan2(node_end.y - node_start.y, node_end.x - node_start.x)
        self.is_vertical = abs(math.cos(self.angle)) < 0.01
        self.is_horizontal = abs(math.sin(self.angle)) < 0.01
        self.cos_a = math.cos(self.angle)
        self.sin_a = math.sin(self.angle)
        self.loads = []
        self.fem_ab = 0.0
        self.fem_ba = 0.0
        self.m_ab = 0.0
        self.m_ba = 0.0
        self.shear_a = 0.0
        self.shear_b = 0.0
        self.axial_a = 0.0
        self.axial_b = 0.0

class FrameLoad:
    def __init__(self, type, magnitude, position=0, magnitude_end=0):
        self.type = type.lower()
        self.magnitude = magnitude
        self.position = position
        self.magnitude_end = magnitude_end

def frame_calculate_fems(member):
    """Fixed end moments — exact port from Streamlit"""
    fem_ab, fem_ba = 0.0, 0.0
    L = member.L
    for load in member.loads:
        if load.type == 'point':
            a = load.position
            b = L - a
            P = load.magnitude
            fem_ab += -(P * a * b**2) / (L**2)
            fem_ba += (P * a**2 * b) / (L**2)
        elif load.type == 'udl':
            w = load.magnitude
            fem_ab += -(w * L**2) / 12.0
            fem_ba += (w * L**2) / 12.0
        elif load.type == 'vdl':
            w1 = load.magnitude
            w2 = load.magnitude_end
            w_rect = min(w1, w2)
            w_tri = abs(w2 - w1)
            fem_ab += -(w_rect * L**2) / 12.0
            fem_ba += (w_rect * L**2) / 12.0
            if w2 > w1:
                fem_ab += -(w_tri * L**2) / 20.0
                fem_ba += (w_tri * L**2) / 30.0
            else:
                fem_ab += -(w_tri * L**2) / 30.0
                fem_ba += (w_tri * L**2) / 20.0
    member.fem_ab = fem_ab
    member.fem_ba = fem_ba

def solve_frame(nodes, members, can_sway=False):
    """Full slope-deflection frame solver — corrected sway implementation.

    ψ = +Δ/L for ALL vertical members regardless of orientation (clockwise-positive
    chord rotation when the sway level moves right).  The resulting K-matrix signs:
      K[joint_i, sway] = -3k/L   (psi term in moment equilibrium)
      K[sway, joint_i] = +3k/L   (dH/dθ in horizontal equilibrium)
      K[sway, sway]    = -6k/L²  (lateral restoring stiffness, always negative)
    """
    for member in members:
        frame_calculate_fems(member)

    rotation_dofs = [n for n in nodes if n.support_type != 'fixed']
    dof_map = {n.id: i for i, n in enumerate(rotation_dofs)}
    n_dofs = len(rotation_dofs) + (1 if can_sway else 0)

    if n_dofs == 0:
        for m in members:
            m.m_ab = m.fem_ab
            m.m_ba = m.fem_ba
        frame_calculate_shears(members)
        frame_calculate_reactions(nodes, members)
        return 0.0

    K = np.zeros((n_dofs, n_dofs))
    F = np.zeros(n_dofs)

    # Joint rotation equilibrium rows
    for member in members:
        k = 2 * member.EI / member.L

        if member.node_a.id in dof_map:
            i = dof_map[member.node_a.id]
            K[i, i] += 2 * k
            F[i] -= member.fem_ab
            if member.node_b.id in dof_map:
                K[i, dof_map[member.node_b.id]] += k
            if can_sway and member.is_vertical:
                K[i, -1] -= 3 * k / member.L

        if member.node_b.id in dof_map:
            i = dof_map[member.node_b.id]
            K[i, i] += 2 * k
            F[i] -= member.fem_ba
            if member.node_a.id in dof_map:
                K[i, dof_map[member.node_a.id]] += k
            if can_sway and member.is_vertical:
                K[i, -1] -= 3 * k / member.L

    # Sway equilibrium row: sum of horizontal forces = 0
    if can_sway:
        for member in members:
            if member.is_vertical:
                k = 2 * member.EI / member.L
                F[-1] -= (member.fem_ab + member.fem_ba) / member.L
                if member.node_a.id in dof_map:
                    K[-1, dof_map[member.node_a.id]] += 3 * k / member.L
                if member.node_b.id in dof_map:
                    K[-1, dof_map[member.node_b.id]] += 3 * k / member.L
                K[-1, -1] -= 6 * k / (member.L ** 2)

    try:
        solution = np.linalg.solve(K, F)
    except np.linalg.LinAlgError:
        raise ValueError("Singular matrix — check supports and member connectivity")

    for i, node in enumerate(rotation_dofs):
        node.theta = solution[i]

    sway_delta = float(solution[-1]) if can_sway else 0.0

    for member in members:
        k = 2 * member.EI / member.L
        theta_a = member.node_a.theta
        theta_b = member.node_b.theta
        psi = (sway_delta / member.L) if (can_sway and member.is_vertical) else 0.0
        member.m_ab = member.fem_ab + k * (2 * theta_a + theta_b - 3 * psi)
        member.m_ba = member.fem_ba + k * (theta_a + 2 * theta_b - 3 * psi)

    frame_calculate_shears(members)
    frame_calculate_reactions(nodes, members)
    return sway_delta

def frame_calculate_shears(members):
    """Calculate shear and axial for each member"""
    for member in members:
        total_transverse = 0.0
        moment_about_b = 0.0
        for load in member.loads:
            if load.type == 'point':
                a = load.position
                P = load.magnitude
                total_transverse += P
                moment_about_b += P * (member.L - a)
            elif load.type == 'udl':
                w = load.magnitude
                total_load = w * member.L
                total_transverse += total_load
                moment_about_b += total_load * member.L / 2
            elif load.type == 'vdl':
                w1, w2 = load.magnitude, load.magnitude_end
                w_avg = (w1 + w2) / 2
                total_load = w_avg * member.L
                total_transverse += total_load
                if abs(w2 - w1) < 1e-6:
                    centroid = member.L / 2
                elif w2 > w1:
                    centroid = member.L * (w1 + 2*w2) / (3*(w1+w2))
                else:
                    centroid = member.L * (2*w1 + w2) / (3*(w1+w2))
                moment_about_b += total_load * (member.L - centroid)
        member.shear_a = (moment_about_b - member.m_ab - member.m_ba) / member.L
        member.shear_b = -(total_transverse - member.shear_a)
        member.axial_a = 0.0
        member.axial_b = 0.0

def frame_calculate_reactions(nodes, members):
    """Calculate support reactions"""
    for node in nodes:
        node.reaction_x = 0.0
        node.reaction_y = 0.0
        node.reaction_m = 0.0
    for node in nodes:
        fx, fy, m = 0.0, 0.0, 0.0
        for member in members:
            if member.node_a == node:
                fx += -member.axial_a * member.cos_a + member.shear_a * member.sin_a
                fy += -member.axial_a * member.sin_a - member.shear_a * member.cos_a
                m += member.m_ab
            elif member.node_b == node:
                fx += member.axial_b * member.cos_a - member.shear_b * member.sin_a
                fy += member.axial_b * member.sin_a + member.shear_b * member.cos_a
                m += member.m_ba
        if node.support_type in ['fixed', 'pinned', 'roller']:
            node.reaction_x = -fx
            node.reaction_y = -fy
            if node.support_type == 'fixed':
                node.reaction_m = -m

def generate_frame_diagram(nodes, members, diagram_type='bmd'):
    """Generate BMD or SFD image — light theme"""
    if diagram_type == 'bmd':
        line_col   = '#1d4ed8'
        fill_color = '#dbeafe'
        ann_peak   = '#b91c1c'
        ann_end    = '#6b7280'
        title_str  = 'Bending Moment Diagram (BMD) [kNm]'
        unit_text  = 'kNm'
    else:
        line_col   = '#15803d'
        fill_color = '#dcfce7'
        ann_peak   = '#92400e'
        ann_end    = '#6b7280'
        title_str  = 'Shear Force Diagram (SFD) [kN]'
        unit_text  = 'kN'

    fig, ax = plt.subplots(figsize=(14, 10))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#f9fafb')
    for spine in ax.spines.values():
        spine.set_edgecolor('#e5e7eb')
    ax.tick_params(colors='#374151', labelsize=9)
    for lbl in ax.get_xticklabels() + ax.get_yticklabels():
        lbl.set_color('#374151')

    # Gather all values to get scale
    all_values = []
    for member in members:
        s_vals = np.linspace(0, member.L, 50)
        for s in s_vals:
            if diagram_type == 'bmd':
                M = member.m_ab + member.shear_a * s
                for load in member.loads:
                    if load.type == 'point' and s >= load.position:
                        M -= load.magnitude * (s - load.position)
                    elif load.type == 'udl':
                        M -= 0.5 * load.magnitude * s**2
                    elif load.type == 'vdl':
                        w1, w2 = load.magnitude, load.magnitude_end
                        w_s = w1 + (w2 - w1) * s / member.L
                        M -= 0.5 * ((w1 + w_s) / 2) * s**2
                all_values.append(M)
            else:
                V = member.shear_a
                for load in member.loads:
                    if load.type == 'point' and s >= load.position:
                        V -= load.magnitude
                    elif load.type == 'udl':
                        V -= load.magnitude * s
                    elif load.type == 'vdl':
                        w1, w2 = load.magnitude, load.magnitude_end
                        w_s = w1 + (w2 - w1) * s / member.L
                        V -= ((w1 + w_s) / 2) * s
                all_values.append(V)

    max_val = max(abs(v) for v in all_values) if all_values else 1.0
    x_coords = [n.x for n in nodes]
    y_coords = [n.y for n in nodes]
    frame_width = max(x_coords) - min(x_coords) if len(x_coords) > 1 else 1.0
    frame_height = max(y_coords) - min(y_coords) if len(y_coords) > 1 else 1.0
    frame_size = max(frame_width, frame_height, 1.0)
    scale = (0.22 * frame_size) / max_val if max_val > 0.001 else 1.0

    # Draw frame structure
    for member in members:
        ax.plot([member.node_a.x, member.node_b.x],
                [member.node_a.y, member.node_b.y],
                color='#374151', linewidth=4, zorder=1, solid_capstyle='round', alpha=0.8)

    # Draw supports
    support_size = frame_size * 0.08
    from matplotlib.patches import Polygon as MplPolygon
    for node in nodes:
        if node.support_type == 'fixed':
            rect = Rectangle((node.x - support_size/2, node.y - support_size/2),
                              support_size, support_size,
                              fill=True, facecolor='#9ca3af', edgecolor='#374151', linewidth=1.5, zorder=5)
            ax.add_patch(rect)
            for i in range(5):
                offset = (i - 2) * support_size / 4
                ax.plot([node.x - support_size/2, node.x + support_size/2],
                        [node.y + offset, node.y + offset],
                        color='#6b7280', linewidth=0.7, zorder=5)
        elif node.support_type == 'pinned':
            tri = MplPolygon([[node.x, node.y],
                               [node.x - support_size/2, node.y - support_size*0.866],
                               [node.x + support_size/2, node.y - support_size*0.866]],
                              fill=True, facecolor='#3b82f6', edgecolor='#1d4ed8', linewidth=2, zorder=5)
            ax.add_patch(tri)
            ax.plot([node.x - support_size*0.7, node.x + support_size*0.7],
                    [node.y - support_size*0.866]*2, color='#374151', linewidth=3, zorder=5)
        elif node.support_type == 'roller':
            tri = MplPolygon([[node.x, node.y],
                               [node.x - support_size/2, node.y - support_size*0.6],
                               [node.x + support_size/2, node.y - support_size*0.6]],
                              fill=True, facecolor='#22c55e', edgecolor='#15803d', linewidth=2, zorder=5)
            ax.add_patch(tri)
            for dx in [-support_size/3, support_size/3]:
                c = Circle((node.x + dx, node.y - support_size*0.8),
                            support_size/8, fill=True, facecolor='white', edgecolor='#374151', linewidth=1.5, zorder=5)
                ax.add_patch(c)

    # Node markers
    for node in nodes:
        ax.plot(node.x, node.y, 'o', color='#1d4ed8', markersize=9,
                zorder=10, markeredgecolor='white', markeredgewidth=1.5)
        ax.annotate(f'  {chr(65 + nodes.index(node))}', xy=(node.x, node.y),
                    fontsize=9, color='#111827', fontweight='bold', zorder=11)

    for member in members:
        n_points = 150
        s_vals = np.linspace(0, member.L, n_points)
        x_local = member.node_a.x + s_vals * member.cos_a
        y_local = member.node_a.y + s_vals * member.sin_a
        values = np.zeros(n_points)

        for i, s in enumerate(s_vals):
            if diagram_type == 'bmd':
                M = member.m_ab + member.shear_a * s
                for load in member.loads:
                    if load.type == 'point' and s >= load.position:
                        M -= load.magnitude * (s - load.position)
                    elif load.type == 'udl':
                        M -= 0.5 * load.magnitude * s**2
                    elif load.type == 'vdl':
                        w1, w2 = load.magnitude, load.magnitude_end
                        w_s = w1 + (w2 - w1) * s / member.L
                        M -= 0.5 * ((w1 + w_s) / 2) * s**2
                values[i] = M
            else:
                V = member.shear_a
                for load in member.loads:
                    if load.type == 'point' and s >= load.position:
                        V -= load.magnitude
                    elif load.type == 'udl':
                        V -= load.magnitude * s
                    elif load.type == 'vdl':
                        w1, w2 = load.magnitude, load.magnitude_end
                        w_s = w1 + (w2 - w1) * s / member.L
                        V -= ((w1 + w_s) / 2) * s
                values[i] = V

        offset_x = -np.sin(member.angle) * values * scale
        offset_y =  np.cos(member.angle) * values * scale
        diagram_x = x_local + offset_x
        diagram_y = y_local + offset_y

        ax.plot(diagram_x, diagram_y, color=line_col, linewidth=2.5, zorder=3)
        x_fill = np.concatenate([x_local, diagram_x[::-1]])
        y_fill = np.concatenate([y_local, diagram_y[::-1]])
        ax.fill(x_fill, y_fill, color=fill_color, alpha=0.7, zorder=2, edgecolor=line_col, linewidth=0.5)

        # Dashed reference lines at ends
        ax.plot([x_local[0], diagram_x[0]], [y_local[0], diagram_y[0]],
                linestyle='--', color='#d1d5db', lw=0.8, alpha=0.8, zorder=2)
        ax.plot([x_local[-1], diagram_x[-1]], [y_local[-1], diagram_y[-1]],
                linestyle='--', color='#d1d5db', lw=0.8, alpha=0.8, zorder=2)

        # Smart annotations: end values + peak
        peak_idx = int(np.argmax(np.abs(values)))
        ann_indices = [0, -1, peak_idx]
        ann_seen = set()
        for idx in ann_indices:
            v = values[idx]
            if abs(v) < 0.005 * max_val:
                continue
            key = round(v, 2)
            if key in ann_seen:
                continue
            ann_seen.add(key)
            ann_col = ann_peak if idx == peak_idx else ann_end
            ax.plot(diagram_x[idx], diagram_y[idx], 'o', color=ann_col,
                    markersize=6, zorder=7)
            ax.annotate(f'{v:.2f} {unit_text}',
                        xy=(diagram_x[idx], diagram_y[idx]),
                        xytext=(8, 8), textcoords='offset points',
                        fontsize=8, fontweight='bold', color=ann_col,
                        bbox=dict(boxstyle='round,pad=0.3', facecolor='white',
                                  edgecolor=ann_col, alpha=0.92, linewidth=0.8))

    ax.set_title(title_str, fontsize=13, fontweight='bold', color='#111827', pad=12)
    ax.set_xlabel('X (m)', fontsize=10, color='#6b7280', fontweight='bold')
    ax.set_ylabel('Y (m)', fontsize=10, color='#6b7280', fontweight='bold')
    ax.grid(True, alpha=0.5, linestyle=':', linewidth=0.6, color='#e5e7eb')
    ax.set_aspect('equal')

    # Expand limits to include diagram
    all_x = [n.x for n in nodes]
    all_y = [n.y for n in nodes]
    for member in members:
        s_vals = np.linspace(0, member.L, 50)
        x_local = member.node_a.x + s_vals * member.cos_a
        y_local = member.node_a.y + s_vals * member.sin_a
        values = np.zeros(50)
        for i, s in enumerate(s_vals):
            if diagram_type == 'bmd':
                M = member.m_ab + member.shear_a * s
                for load in member.loads:
                    if load.type == 'point' and s >= load.position:
                        M -= load.magnitude * (s - load.position)
                    elif load.type == 'udl':
                        M -= 0.5 * load.magnitude * s**2
                    elif load.type == 'vdl':
                        w1, w2 = load.magnitude, load.magnitude_end
                        w_s = w1 + (w2 - w1) * s / member.L
                        M -= 0.5 * ((w1 + w_s) / 2) * s**2
                values[i] = M
            else:
                V = member.shear_a
                for load in member.loads:
                    if load.type == 'point' and s >= load.position:
                        V -= load.magnitude
                    elif load.type == 'udl':
                        V -= load.magnitude * s
                    elif load.type == 'vdl':
                        w1, w2 = load.magnitude, load.magnitude_end
                        w_s = w1 + (w2 - w1) * s / member.L
                        V -= ((w1 + w_s) / 2) * s
                values[i] = V
        offset_x = -np.sin(member.angle) * values * scale
        offset_y =  np.cos(member.angle) * values * scale
        all_x.extend(x_local + offset_x)
        all_y.extend(y_local + offset_y)

    margin = 0.15 * max(max(all_x) - min(all_x), max(all_y) - min(all_y), 1.0)
    ax.set_xlim(min(all_x) - margin, max(all_x) + margin)
    ax.set_ylim(min(all_y) - margin, max(all_y) + margin)

    plt.tight_layout(pad=1.2)
    buf = BytesIO()
    plt.savefig(buf, format='png', dpi=120, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    buf.seek(0)
    img_b64 = base64.b64encode(buf.read()).decode()
    plt.close(fig)
    return img_b64


# ===== DESIGN FUNCTION =====

def design_beam(M_max, width, fck, fy, cover, bar_dia, L_max):
    """Beam design"""
    b = width
    fcd = 0.67 * fck / 1.5
    fyd = fy / 1.15
    xu_lim = 0.48
    Mu_lim = 0.36 * xu_lim * (1 - 0.42 * xu_lim) * fcd
    M_design = abs(M_max) * 1e6
    d_req = np.sqrt(M_design / (Mu_lim * b))
    D = np.ceil((d_req + cover + bar_dia/2) / 25) * 25
    d = D - cover - bar_dia/2
    Mu_lim_actual = Mu_lim * b * d * d
    if M_design <= Mu_lim_actual:
        p = M_design / (fcd * b * d**2)
        Ast = 0.5 * fcd * b * d * (1 - np.sqrt(1 - 4.6 * p)) / fyd
        section_type = "Singly Reinforced"
        comp_steel = 0
    else:
        Ast = 0.5 * fcd * b * d / fyd + (M_design - Mu_lim_actual) / (fyd * 0.9 * d)
        section_type = "Doubly Reinforced"
        comp_steel = (M_design - Mu_lim_actual) / (fyd * 0.9 * d)
    Ast_min = 0.85 * b * d / fy
    Ast = max(Ast, Ast_min)
    num_bars = int(np.ceil(Ast / (np.pi * (bar_dia/2)**2)))
    provided = num_bars * np.pi * (bar_dia/2)**2
    return {
        'success': True,
        'depth': float(D),
        'eff_depth': float(d),
        'steel_area': float(Ast),
        'comp_steel_area': float(comp_steel),
        'section_type': section_type,
        'num_bars': int(num_bars),
        'provided_area': float(provided),
        'utilization': float(Ast / provided * 100) if provided > 0 else 100
    }


# ===== API ENDPOINTS =====

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'API server is running'})


@app.route('/api/beam/analyze', methods=['POST'])
def analyze_beam():
    """Beam analysis with proper slope-deflection"""
    try:
        print("\n" + "="*50)
        print("BEAM ANALYSIS REQUEST")
        print("="*50)
        data = request.json
        nodes = []
        for n in data['nodes']:
            node = BeamNode(n['id'], n['x'], n['type'])
            nodes.append(node)
        elements = []
        for e in data['elements']:
            elem = BeamElement(nodes[e['node_i']], nodes[e['node_j']], e['E'], e['I'])
            elements.append(elem)
        loads = []
        for l in data['loads']:
            if l['type'] == 'Point':
                loads.append(BeamLoad('Point', l['mag'], l['start']))
            elif l['type'] == 'UDL':
                loads.append(BeamLoad('UDL', l['mag'], l['start'], l['end']))
            elif l['type'] == 'VDL':
                loads.append(BeamLoad('VDL', l['mag'], l['start'], l['end'], l.get('mag_end', l['mag'])))
        solve_beam_structure(nodes, elements, loads)
        L_total = max(n.x for n in nodes)
        x_vals = np.linspace(0, L_total, 200)
        v_vals = np.zeros_like(x_vals)
        m_vals = np.zeros_like(x_vals)
        for k, x in enumerate(x_vals):
            sum_r = sum(n.reaction for n in nodes if n.x <= x)
            sum_l = 0
            for l in loads:
                if l.type == 'Point' and l.start <= x:
                    sum_l += l.mag
                elif l.type == 'UDL' and l.start <= x:
                    end = min(x, l.end)
                    if end > l.start:
                        sum_l += l.mag * (end - l.start)
                elif l.type == 'VDL' and l.start <= x:
                    end = min(x, l.end)
                    if end > l.start:
                        length = end - l.start
                        total_length = l.end - l.start
                        ratio = length / total_length if total_length > 1e-6 else 1
                        w_end = l.mag + ratio * (l.mag_end - l.mag)
                        sum_l += (l.mag + w_end) / 2.0 * length
            v_vals[k] = sum_r - sum_l
            sum_m_r = sum(n.reaction * (x - n.x) for n in nodes if n.x <= x)
            sum_m_l = 0
            for l in loads:
                if l.type == 'Point' and l.start <= x:
                    sum_m_l += l.mag * (x - l.start)
                elif l.type == 'UDL' and l.start <= x:
                    end = min(x, l.end)
                    if end > l.start:
                        length = end - l.start
                        centroid = l.start + length/2
                        sum_m_l += l.mag * length * (x - centroid)
                elif l.type == 'VDL' and l.start <= x:
                    end = min(x, l.end)
                    if end > l.start:
                        length = end - l.start
                        total_length = l.end - l.start
                        ratio = length / total_length if total_length > 1e-6 else 1
                        w_end = l.mag + ratio * (l.mag_end - l.mag)
                        P = (l.mag + w_end) / 2.0 * length
                        if abs(l.mag + w_end) > 1e-6:
                            c_bar = (l.mag + 2*w_end) * length / (3.0 * (l.mag + w_end))
                        else:
                            c_bar = length / 2.0
                        centroid = l.start + c_bar
                        sum_m_l += P * (x - centroid)
            m_vals[k] = sum_m_r - sum_m_l
        max_moment = max(abs(m) for m in m_vals)
        max_moment_location = x_vals[np.argmax([abs(m) for m in m_vals])]
        # Sagging (positive) and hogging (negative) extremes for dual-face design
        max_sagging = float(max(m_vals))   # most positive = bottom tension
        max_hogging = float(min(m_vals))   # most negative = top tension
        sfd_img = create_beam_diagram_image(x_vals, v_vals, "Shear Force Diagram", "Shear (kN)", "blue")
        bmd_img = create_beam_diagram_image(x_vals, m_vals, "Bending Moment Diagram", "Moment (kNm)", "red")
        print(f" Max Moment: {max_moment:.3f} kNm at {max_moment_location:.2f} m")
        return jsonify({
            'success': True,
            'reactions': [{'node': n.id, 'x': n.x, 'type': n.type, 'reaction': float(n.reaction)}
                         for n in nodes if n.type != 'free'],
            'moments': [{'span': f"{e.node_i.id}-{e.node_j.id}", 'm_i': float(e.m_i), 'm_j': float(e.m_j)}
                       for e in elements],
            'shears': [{'span': f"{e.node_i.id}-{e.node_j.id}", 'v_i': float(e.shear_i), 'v_j': float(e.shear_j)}
                      for e in elements],
            'max_moment': float(max_moment),
            'max_moment_location': float(max_moment_location),
            'max_sagging': max_sagging,
            'max_hogging': max_hogging,
            'diagrams': {'sfd': sfd_img, 'bmd': bmd_img}
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/frame/analyze', methods=['POST'])
def analyze_frame_endpoint():
    """Frame analysis with full Streamlit slope-deflection + BMD/SFD diagrams"""
    try:
        print("\n" + "="*50)
        print("FRAME ANALYSIS REQUEST")
        print("="*50)
        data = request.json
        nodes_list  = data['nodes']
        members_list = data['members']
        loads_list  = data.get('loads', [])
        can_sway    = data.get('can_sway', False)

        # Build nodes
        nodes = [FrameNode(i, n['x'], n['y'], n['type']) for i, n in enumerate(nodes_list)]

        # Build members
        members = []
        for m in members_list:
            member = FrameMember(nodes[m['node_i']], nodes[m['node_j']], m['E'], m['I'])
            members.append(member)

        # Assign loads to members
        for load_data in loads_list:
            if 'member' not in load_data:
                continue
            midx = load_data['member']
            if not (0 <= midx < len(members)):
                continue
            load_type = load_data.get('type', 'point').lower()
            magnitude = load_data.get('magnitude', load_data.get('mag', 0))
            position  = load_data.get('position',  load_data.get('pos', 0))
            mag_end   = load_data.get('magnitude_end', load_data.get('mag_end', 0))
            members[midx].loads.append(FrameLoad(load_type, magnitude, position, mag_end))
            print(f"  Load on member {midx}: {load_type} {magnitude}kN @ {position}m")

        # Solve
        sway_delta = solve_frame(nodes, members, can_sway)

        # Max values
        max_moment = max((max(abs(m.m_ab), abs(m.m_ba)) for m in members), default=0)
        max_shear  = max((max(abs(m.shear_a), abs(m.shear_b)) for m in members), default=0)
        print(f" Max Moment: {max_moment:.3f} kNm  |  Max Shear: {max_shear:.3f} kN")

        # Generate diagrams
        bmd_img = generate_frame_diagram(nodes, members, 'bmd')
        sfd_img = generate_frame_diagram(nodes, members, 'sfd')
        print(" Diagrams generated")
        print("="*50 + "\n")

        return jsonify({
            'success': True,
            'sway_delta': float(sway_delta) if sway_delta else 0.0,
            'reactions': [
                {'node': n.id, 'x': float(n.x), 'y': float(n.y),
                 'Rx': float(n.reaction_x), 'Ry': float(n.reaction_y), 'M': float(n.reaction_m)}
                for n in nodes if n.support_type != 'free'
            ],
            'member_forces': [
                {'member': i,
                 'M_ab': float(m.m_ab), 'M_ba': float(m.m_ba),
                 'V_a': float(m.shear_a), 'V_b': float(m.shear_b),
                 'N_a': float(m.axial_a), 'N_b': float(m.axial_b)}
                for i, m in enumerate(members)
            ],
            'max_moment': float(max_moment),
            'max_shear': float(max_shear),
            'diagrams': {'bmd': bmd_img, 'sfd': sfd_img}
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/design/beam', methods=['POST'])
def design_beam_endpoint():
    try:
        data = request.json
        design_code = data.get('design_code', 'BS_8110')  # Default to BS 8110 (Nigerian Standard)
        
        if design_code == 'BS_EN_1992':
            result = design_beam_bs_en(
                data['max_moment'],
                data.get('max_shear', 0),
                data.get('L_max', 5.0),
                data['width'],
                data['fck'],
                data['fy'],  # fyk in BS code
                data['cover'],
                data['bar_dia']
            )
        elif design_code == 'BS_8110':
            result = design_beam_bs_8110(
                data['max_moment'],
                data.get('min_moment', 0),
                data.get('max_shear', 0),
                data.get('L_max', 5.0),
                data['width'],
                data['fck'],
                data['fy'],
                data['cover'],
                data['bar_dia']
            )
        else:  # Fallback to BS 8110
            result = design_beam_bs_8110(
                data['max_moment'],
                data.get('min_moment', 0),
                data.get('max_shear', 0),
                data.get('L_max', 5.0),
                data['width'],
                data['fck'],
                data['fy'],
                data['cover'],
                data['bar_dia']
            )
        
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/design/column', methods=['POST'])
def design_column_endpoint():
    try:
        data = request.json
        design_code = data.get('design_code', 'IS456')
        
        if design_code == 'IS456':
            result = design_column_is456(
                data['axial_force'],
                data['moment'],
                data['length'],
                data['width'],
                data['depth'],
                data['fck'],
                data.get('fyk', data.get('fy', 415)),
                data['cover'],
                data['bar_dia']
            )
        elif design_code == 'BS_EN_1992':
            result = design_column_bs_en(
                data['axial_force'],
                data['moment'],
                data['length'],
                data['width'],
                data['depth'],
                data['fck'],
                data['fyk'],
                data['cover'],
                data['bar_dia']
            )
        elif design_code == 'BS_8110':
            result = design_column_bs_8110(
                data['axial_force'],
                data['moment'],
                data['length'],
                data['width'],
                data['depth'],
                data['fck'],  # fcu in BS 8110
                data.get('fyk', data.get('fy', 460)),  # fy
                data['cover'],
                data['bar_dia']
            )
        else:
            # Fallback to IS 456
            result = design_column_is456(
                data['axial_force'],
                data['moment'],
                data['length'],
                data['width'],
                data['depth'],
                data['fck'],
                data.get('fyk', data.get('fy', 415)),
                data['cover'],
                data['bar_dia']
            )
        
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 400


# BS EN 1992 (Eurocode 2) Design Functions

def design_beam_bs_en(M_max, V_max, L_span, width, fck, fyk, cover, bar_dia):
    """
    Beam design to BS EN 1992-1-1:2004 (Eurocode 2)
    Returns both ULS and SLS checks
    """
    import numpy as np
    
    # Material properties
    b = width * 1000  # Convert to mm
    gamma_c = 1.5
    gamma_s = 1.15
    alpha_cc = 0.85  # For long-term loading
    
    fcd = alpha_cc * fck / gamma_c  # Design compressive strength
    fyd = fyk / gamma_s  # Design yield strength
    
    # ========== ULTIMATE LIMIT STATE (ULS) ==========
    
    # Convert moment to design value (Nmm)
    M_Ed = abs(M_max) * 1e6  # kNm to Nmm
    V_Ed = abs(V_max) * 1000  # kN to N
    
    # Limiting neutral axis depth for fck ≤ 50 MPa
    xu_lim = 0.45 if fck <= 50 else (0.35 if fck <= 90 else 0.25)
    
    # K factor for limiting moment
    K_lim = 0.167 if fck <= 50 else 0.120
    
    # Required effective depth
    K_req = M_Ed / (b * fcd * 1000**2)  # Note: per mm width
    d_req = np.sqrt(M_Ed / (K_lim * b * fcd))
    
    # Total depth (round up to 25mm)
    D = np.ceil((d_req + cover + bar_dia) / 25) * 25
    d = D - cover - bar_dia/2
    
    # Actual K
    K_actual = M_Ed / (b * d**2 * fcd)
    
    # Determine if singly or doubly reinforced
    section_type = "Singly Reinforced"
    As_req = 0.0
    As_comp = 0.0
    
    if K_actual <= K_lim:
        # Singly reinforced
        z = d * (0.5 + np.sqrt(0.25 - K_actual/1.134))
        z = min(z, 0.95 * d)
        As_req = M_Ed / (fyd * z)
        section_type = "Singly Reinforced"
    else:
        # Doubly reinforced required
        z = 0.95 * d
        M_lim = K_lim * b * d**2 * fcd
        As_req = M_lim / (fyd * z) + (M_Ed - M_lim) / (fyd * (d - cover - bar_dia))
        As_comp = (M_Ed - M_lim) / (fyd * (d - cover - bar_dia))
        section_type = "Doubly Reinforced"
    
    # Minimum reinforcement (Clause 9.2.1.1)
    As_min = max(0.26 * (fck**0.5 / fyk) * b * d, 0.0013 * b * d)
    As_req = max(As_req, As_min)
    
    # Maximum reinforcement (Clause 9.2.1.1)
    As_max = 0.04 * b * D
    
    # Provide bars
    num_bars = int(np.ceil(As_req / (np.pi * (bar_dia/2)**2)))
    As_prov = num_bars * np.pi * (bar_dia/2)**2
    
    # Shear check (Clause 6.2)
    # VRd,c = [CRd,c·k·(100·ρl·fck)^(1/3)]·b·d
    CRd_c = 0.18 / gamma_c
    k = min(1 + np.sqrt(200/d), 2.0)  # d in mm
    rho_l = min(As_prov / (b * d), 0.02)
    v_min = 0.035 * k**1.5 * fck**0.5
    
    VRd_c = max(CRd_c * k * (100 * rho_l * fck)**(1/3), v_min) * b * d
    
    shear_check = "OK" if V_Ed <= VRd_c else "Shear reinforcement required"
    shear_util = (V_Ed / VRd_c * 100) if VRd_c > 0 else 100
    
    # ========== SERVICEABILITY LIMIT STATE (SLS) ==========
    
    # Deflection check (Clause 7.4)
    # Basic span/depth ratio
    rho_0 = 0.001 * np.sqrt(fck)  # Reference reinforcement ratio
    rho_prov = As_prov / (b * d)
    rho_req = As_req / (b * d)
    
    if fck <= 50:
        K_basic = 1.0 if section_type == "Singly Reinforced" else 1.5
    else:
        K_basic = 1.3 if section_type == "Singly Reinforced" else 1.8
    
    # For simply supported beam
    basic_ratio = 20 * K_basic
    
    # Modification factor
    if rho_prov <= rho_0:
        factor = 1.5
    else:
        factor = (rho_0 / rho_prov) * (500 / fyk) * np.sqrt(As_req / As_prov)
        factor = min(factor, 1.5)
    
    allowable_ratio = basic_ratio * factor
    actual_ratio = L_span * 1000 / d  # L in m, d in mm
    
    deflection_check = "OK" if actual_ratio <= allowable_ratio else "FAIL"
    deflection_util = (actual_ratio / allowable_ratio * 100) if allowable_ratio > 0 else 100
    
    # Crack width check (Clause 7.3)
    # Simplified - assume cracking will be within limits if:
    # 1. Bar spacing is appropriate
    # 2. Bar size is limited based on stress
    
    # Maximum bar spacing (Table 7.2N)
    wk = 0.3  # mm for moderate exposure (XC1, XD1, XS1)
    
    # Stress in reinforcement under quasi-permanent loads
    # Simplified: assume 60% of design stress
    sigma_s = 0.6 * fyk
    
    # Maximum bar spacing
    if wk == 0.3:
        if sigma_s <= 160:
            max_spacing = 300
        elif sigma_s <= 200:
            max_spacing = 250
        elif sigma_s <= 240:
            max_spacing = 200
        elif sigma_s <= 280:
            max_spacing = 150
        else:
            max_spacing = 100
    else:
        max_spacing = 150
    
    # Check spacing
    effective_width = b - 2*cover - num_bars*bar_dia
    spacing = effective_width / (num_bars - 1) if num_bars > 1 else 0
    
    crack_check = "OK" if spacing <= max_spacing else "Review spacing"
    
    # Bar diameter limit for crack control
    max_bar_dia_crack = 32  # mm for wk = 0.3mm
    bar_dia_check = "OK" if bar_dia <= max_bar_dia_crack else "Reduce bar size"
    
    return {
        'success': True,
        'code': 'BS EN 1992-1-1:2004',
        
        # ULS Results
        'uls': {
            'depth': float(D),
            'eff_depth': float(d),
            'steel_area_req': float(As_req),
            'steel_area_prov': float(As_prov),
            'comp_steel': float(As_comp),
            'section_type': section_type,
            'num_bars': int(num_bars),
            'bar_size': int(bar_dia),
            'utilization': float(As_req / As_prov * 100) if As_prov > 0 else 100,
            'K_actual': float(K_actual),
            'K_limit': float(K_lim),
            'moment_capacity': float(M_Ed / 1e6),  # Back to kNm
            'shear_check': shear_check,
            'shear_capacity': float(VRd_c / 1000),  # kN
            'shear_util': float(shear_util)
        },
        
        # SLS Results
        'sls': {
            'deflection_check': deflection_check,
            'span_depth_actual': float(actual_ratio),
            'span_depth_allowable': float(allowable_ratio),
            'deflection_util': float(deflection_util),
            'crack_width_limit': float(wk),
            'max_bar_spacing': float(max_spacing),
            'actual_spacing': float(spacing),
            'crack_check': crack_check,
            'bar_dia_check': bar_dia_check
        }
    }


def design_column_is456(N, M, L, b, D, fck, fy, cover, bar_dia):
    """
    Design column per IS 456:2000
    Simplified approach for axial + bending
    """
    # Constants
    d_prime = cover + bar_dia  # to center of compression steel
    d = D - d_prime
    
    # Check slenderness
    lex = 0.85 * L * 1000  # Effective length in mm (assuming braced, pinned)
    i = D / math.sqrt(12)  # Radius of gyration
    slenderness = lex / i
    
    # Classify column
    if slenderness <= 12:
        category = "Short column"
        M_add = 0
    else:
        category = "Slender column"
        # Additional moment from slenderness
        M_add = (N * lex**2) / (2000 * D)  # Simplified
    
    M_design = max(M, M + M_add)
    
    # Material strengths
    fck_mpa = fck
    fy_mpa = fy
    
    # Moment capacity check using interaction diagram approach
    # For rectangular column with steel on two faces
    K = M_design * 1e6 / (b * D**2 * 0.67 * fck)  # IS 456 allows 0.67 fck
    K_prime = N * 1e3 / (b * D * 0.67 * fck)
    
    # Steel area calculation (simplified)
    # p = percentage of steel
    # For combined axial + bending, use iterative or chart method
    # Simplified: Asc = (M/d + N*e_min)/(0.87*fy)
    e_min = max(L/500 + D/30, 20) / 1000  # Minimum eccentricity in m
    e_actual = M_design / N if N > 0 else D / 2
    
    if N > 0:
        # Compression member
        Asc_req = (M_design * 1e6 / (0.87 * fy * (d - d_prime))) + (N * 1e3 * (e_min * 1000 - (D/2 - d_prime)) / (0.87 * fy * (d - d_prime)))
    else:
        # Pure bending
        Asc_req = M_design * 1e6 / (0.87 * fy * (d - d_prime))
    
    # Ensure minimum and maximum
    Ac = b * D
    Asc_min = 0.008 * Ac  # 0.8% minimum
    Asc_max = 0.04 * Ac   # 4% maximum (6% at laps)
    
    Asc_req = max(Asc_req, Asc_min)
    Asc_req = min(Asc_req, Asc_max)
    
    # Number of bars
    Ab = math.pi * bar_dia**2 / 4
    num_bars = math.ceil(Asc_req / Ab)
    num_bars = max(num_bars, 4)  # Minimum 4 bars for rectangular column
    Asc_prov = num_bars * Ab
    
    # Check capacity
    # Simplified: P_uz = 0.4*fck*Ac + 0.67*fy*Asc for short column
    if slenderness <= 12:
        Pu = 0.4 * fck * (Ac - Asc_prov) + 0.67 * fy * Asc_prov
    else:
        # Reduced capacity for slender column
        Pu = 0.4 * fck * (Ac - Asc_prov) + 0.67 * fy * Asc_prov
        Pu = Pu * (1 - (slenderness - 12) / 200)  # Simplified reduction
    
    utilization = (N * 1000 / Pu) * 100 if Pu > 0 else 0
    
    return {
        'success': True,
        'code': 'IS 456:2000',
        'steel_area': Asc_req,
        'steel_area_prov': Asc_prov,
        'num_bars': num_bars,
        'bar_size': bar_dia,
        'axial_capacity': Pu / 1000,  # kN
        'utilization': utilization,
        'slenderness': slenderness,
        'slenderness_category': category,
        'steel_percentage': (Asc_prov / Ac) * 100
    }


def design_column_bs_en(N_Ed, M_Ed, L_col, b_col, h_col, fck, fyk, cover, bar_dia):
    """
    Column design to BS EN 1992-1-1:2004
    Simplified for rectangular sections under axial + uniaxial bending
    """
    import numpy as np
    
    # Material properties
    gamma_c = 1.5
    gamma_s = 1.15
    alpha_cc = 0.85
    
    fcd = alpha_cc * fck / gamma_c
    fyd = fyk / gamma_s
    
    b = b_col  # mm
    h = h_col  # mm
    d = h - cover - bar_dia
    d2 = cover + bar_dia
    
    # ========== SLENDERNESS CHECK (Clause 5.8) ==========
    
    # Effective length
    l_0 = 0.7 * L_col * 1000  # Assume both ends restrained, convert to mm
    i = h / np.sqrt(12)  # Radius of gyration for rectangular section
    slenderness = l_0 / i
    
    # Limiting slenderness
    lambda_lim = 25  # Simplified
    
    if slenderness <= lambda_lim:
        slenderness_category = "Short column"
        # No second order effects
        M_Ed_total = max(M_Ed * 1e6, N_Ed * 1000 * max(h/30, 20))  # Minimum eccentricity
    else:
        slenderness_category = "Slender column"
        # Simplified second-order moment
        M_2 = N_Ed * 1000 * (l_0**2 / (10 * h))  # Simplified
        M_Ed_total = M_Ed * 1e6 + M_2
    
    # ========== DESIGN FOR AXIAL + BENDING ==========
    
    # Simplified interaction - assume neutral axis within section
    # Use simplified rectangular stress block
    
    # Trial: assume x = 0.4h
    x = 0.4 * h
    
    # For balanced design, iterate to find steel
    # Simplified approach: use design charts or formulae
    
    # K = M / (b·h²·fcd)
    K = M_Ed_total / (b * h**2 * fcd)
    
    # K' = N / (b·h·fcd)
    K_prime = (N_Ed * 1000) / (b * h * fcd)
    
    # Mechanical reinforcement ratio ω = As·fyd / (b·h·fcd)
    # From interaction charts, simplified
    omega = K + 0.5 * K_prime
    omega = max(omega, 0.10)  # Minimum
    omega = min(omega, 0.40)  # Maximum for ductility
    
    As_total = omega * b * h * fcd / fyd
    
    # Minimum steel (Clause 9.5.2)
    As_min = max(0.10 * N_Ed * 1000 / fyd, 0.002 * b * h)
    
    # Maximum steel
    As_max = 0.04 * b * h
    
    As_total = max(As_total, As_min)
    As_total = min(As_total, As_max)
    
    # Provide bars (assume bars on two faces)
    num_bars = int(np.ceil(As_total / (np.pi * (bar_dia/2)**2)))
    num_bars = max(num_bars, 4)  # Minimum 4 bars
    As_prov = num_bars * np.pi * (bar_dia/2)**2
    
    # Capacity check
    # Simplified: N_Rd ≈ 0.8·fcd·Ac + As·fyd
    Ac = b * h - As_prov
    N_Rd = 0.8 * fcd * Ac + As_prov * fyd
    N_Rd = N_Rd / 1000  # Convert to kN
    
    utilization = (N_Ed / N_Rd * 100) if N_Rd > 0 else 100
    
    # ========== SLS CHECKS ==========
    
    # Crack control - less critical for columns but check minimum cover
    cover_check = "OK" if cover >= 25 else "Increase cover"
    
    # Links/ties for confinement (Clause 9.5.3)
    link_dia_min = max(6, bar_dia / 4)
    link_spacing_max = min(20 * bar_dia, b, h, 400)
    
    return {
        'success': True,
        'code': 'BS EN 1992-1-1:2004',
        
        'uls': {
            'steel_area_req': float(As_total),
            'steel_area_prov': float(As_prov),
            'num_bars': int(num_bars),
            'bar_size': int(bar_dia),
            'steel_percentage': float(As_prov / (b * h) * 100),
            'axial_capacity': float(N_Rd),
            'utilization': float(utilization),
            'slenderness': float(slenderness),
            'category': slenderness_category,
            'design_moment': float(M_Ed_total / 1e6)  # kNm
        },
        
        'sls': {
            'cover_check': cover_check,
            'min_link_dia': float(link_dia_min),
            'max_link_spacing': float(link_spacing_max)
        }
    }
# BS 8110 (Nigerian Standard) Design Functions

def design_beam_bs_8110(M_max, M_min=0, V_max=0, L_span=5.0, width=0.225, fck=25, fy=460, cover=25, bar_dia=16):
    """
    Beam design to BS 8110:1997 (Nigerian/British Standard).
    Designs BOTTOM steel for sagging (M_pos) and TOP steel for hogging (M_neg).
    Partial factors: γm=1.5 (concrete), γs=1.05 (steel).
    """
    import numpy as np

    # ── Section geometry ─────────────────────────────────────────────────────────
    b      = width * 1000      # mm
    stir   = 8                 # nominal stirrup dia (mm)
    d      = None              # effective depth — computed from worst moment
    K_lim  = 0.156 if fy <= 460 else 0.140
    fyv    = 250.0             # mild-steel links (R-bars), Nigerian standard

    # Bar area look-up
    BARS_NG   = {16: 201.1, 20: 314.2, 25: 490.9, 32: 804.2, 40: 1256.6}
    LINK_BARS = {6: 28.3, 8: 50.3, 10: 78.5, 12: 113.1}

    def _as_min(b_mm, h_mm, fy_MPa):
        pct = 0.13 if fy_MPa >= 460 else 0.20
        return pct / 100 * b_mm * h_mm

    def _select_bars(As_req):
        opts = []
        for dia, a1 in BARS_NG.items():
            for n in range(2, 9):
                prov = n * a1
                if prov >= As_req:
                    opts.append({'label': f'{n}Y{dia}', 'n': n, 'dia': dia,
                                 'area': round(prov, 1),
                                 'excess': round(prov - As_req, 1)})
                    break
        return opts[:5]

    def _flexure(M_kNm, b_mm, d_mm, h_mm, fcu, fy_MPa):
        """BS 8110 Cl.3.4.4 — singly-reinforced rect. beam."""
        M = abs(M_kNm) * 1e6        # N·mm
        As_min_v = _as_min(b_mm, h_mm, fy_MPa)
        fy_d = fy_MPa / 1.05         # design yield (γs=1.05)

        if M < 1.0:
            z = min(0.95 * d_mm, d_mm)
            return dict(As_req=As_min_v, K=0.0, K_lim=K_lim, z=z,
                        Mu_cap=0.87*fy_MPa*As_min_v*z/1e6,
                        status='MIN_STEEL', util=0.0,
                        section_type='Singly Reinforced')

        K = M / (fcu * b_mm * d_mm**2)

        if K > K_lim:
            return dict(As_req=None, K=K, K_lim=K_lim, z=None,
                        Mu_cap=None, status='DOUBLY_REINFORCED_NEEDED', util=999,
                        section_type='Doubly Reinforced')

        z_ratio = 0.5 + (0.25 - K / 0.9)**0.5
        z       = min(0.95 * d_mm, z_ratio * d_mm)
        As_req  = max(M / (fy_d * z), As_min_v)

        # Check max steel
        if As_req > 0.04 * b_mm * h_mm:
            return dict(As_req=As_req, K=K, K_lim=K_lim, z=z,
                        Mu_cap=None, status='SECTION_TOO_SMALL', util=999,
                        section_type='Singly Reinforced')

        Mu_cap = fy_d * As_req * z / 1e6
        util   = abs(M_kNm) / Mu_cap if Mu_cap > 0 else 0

        return dict(As_req=As_req, K=K, K_lim=K_lim, z=z,
                    Mu_cap=Mu_cap, status='OK', util=util,
                    section_type='Singly Reinforced')

    # ── Compute depth from the larger of the two moments ────────────────────────
    M_pos = max(M_max, 0)            # sagging (bottom steel)
    M_neg = abs(min(M_min, 0))       # hogging (top steel)
    M_design_abs = max(M_pos, M_neg)

    if M_design_abs < 0.01:
        M_design_abs = 0.01

    M_nmm       = M_design_abs * 1e6
    fcu_d       = 0.67 * fck / 1.5
    d_req       = np.sqrt(M_nmm / (K_lim * b * fcu_d))
    D           = float(np.ceil((d_req + cover + stir + bar_dia) / 25) * 25)
    d_eff       = D - cover - stir - bar_dia / 2
    h_mm        = D

    As_min_val  = _as_min(b, h_mm, fy)

    # ── Flexure — sagging (bottom) ───────────────────────────────────────────────
    res_bot = _flexure(M_pos, b, d_eff, h_mm, fck, fy)
    As_bot  = res_bot['As_req'] or As_min_val
    bars_bot = _select_bars(As_bot)
    As_bot_prov = bars_bot[0]['area'] if bars_bot else As_min_val

    # ── Flexure — hogging (top) ──────────────────────────────────────────────────
    res_top = _flexure(M_neg, b, d_eff, h_mm, fck, fy)
    As_top  = res_top['As_req'] or As_min_val
    bars_top = _select_bars(As_top)
    As_top_prov = bars_top[0]['area'] if bars_top else As_min_val

    # ── Shear design (BS 8110 Cl.3.4.5) ─────────────────────────────────────────
    V_N      = abs(V_max) * 1000       # N
    v        = V_N / (b * d_eff)       # N/mm²
    fcu_cap  = min(fck, 40.0)

    rho_term   = min(100 * As_bot_prov / (b * d_eff), 3.0)
    depth_term = max(400 / d_eff, 1.0)**0.25
    vc         = (0.79 / 1.25) * (rho_term**(1/3)) * depth_term * (fcu_cap / 25)**(1/3)
    v_max      = min(0.8 * fck**0.5, 5.0)

    if v < vc / 2:
        link_status = 'Nominal links only'
        Asv_sv_req  = 0.4 * b / (0.87 * fyv)
    elif v <= vc + 0.4:
        link_status = 'Min links required'
        Asv_sv_req  = 0.4 * b / (0.87 * fyv)
    else:
        link_status = 'Design links required'
        Asv_sv_req  = b * (v - vc) / (0.87 * fyv)

    sv_max = min(0.75 * d_eff, 500)
    link_options = []
    for ldia, a1 in LINK_BARS.items():
        Av   = 2 * a1
        sv   = Av / max(Asv_sv_req, 1e-9)
        sv   = min(sv, sv_max)
        sv_r = max(round(sv / 25) * 25, 25)
        v_prov = Av * fyv * 0.87 / (b * sv_r) + vc if sv_r > 0 else 0
        link_options.append({'label': f'R{ldia}@{int(sv_r)}',
                              'dia': ldia, 'Av': round(Av, 1),
                              'sv': int(sv_r), 'v_prov': round(float(v_prov), 3)})

    shear_check  = link_status
    shear_util   = (v / max(vc, 0.001) * 100)

    # ── SLS — deflection (BS 8110 Cl.3.4.6) ─────────────────────────────────────
    basic_ratio = 20.0
    M_nmm_sls   = max(M_pos, 0.001) * 1e6
    fs = min((2 * fy * As_bot) / (3 * As_bot_prov) if As_bot_prov > 0 else fy,
             0.87 * fy)
    # Simplified modification factor (BS 8110 Table 3.10)
    mf = min(2.0, max(0.95, 0.55 + (477 - fs) / (120 * (0.9 + M_nmm_sls / (b * d_eff**2)))))
    allowable_ratio = basic_ratio * mf
    actual_ratio    = L_span * 1000 / d_eff
    deflection_check = 'OK' if actual_ratio <= allowable_ratio else 'FAIL - Increase depth'
    deflection_util  = actual_ratio / max(allowable_ratio, 0.1) * 100

    # SLS — crack control
    max_spacing = 300 if fy <= 460 else 200
    n_b = bars_bot[0]['n'] if bars_bot else 2
    eff_w = b - 2*cover - n_b * bar_dia
    spacing = eff_w / max(n_b - 1, 1) if n_b > 1 else 0
    crack_check = 'OK' if spacing <= max_spacing else 'Review spacing'

    # ── Return ───────────────────────────────────────────────────────────────────
    return {
        'success': True,
        'code': 'BS 8110:1997 (Nigerian Standard)',

        'section': {
            'b': int(b),
            'h': int(h_mm),
            'd_eff': float(d_eff),
            'cover': int(cover),
            'fcu': float(fck),
            'fy': float(fy),
            'fyv': float(fyv),
            'As_min': float(As_min_val),
            'rho_min_pct': 0.13 if fy >= 460 else 0.20,
        },

        # ── Bottom steel (sagging) ──────────────────────────────────────────────
        'bottom': {
            'M_design': float(M_pos),
            'K': float(res_bot.get('K', 0) or 0),
            'K_lim': float(K_lim),
            'z': float(res_bot.get('z') or 0),
            'As_req': float(As_bot),
            'As_prov': float(As_bot_prov),
            'Mu_cap': float(res_bot.get('Mu_cap') or 0),
            'util': float(res_bot.get('util', 0) or 0),
            'status': res_bot.get('status', 'OK'),
            'section_type': res_bot.get('section_type', 'Singly Reinforced'),
            'bar_options': bars_bot,
        },

        # ── Top steel (hogging) ─────────────────────────────────────────────────
        'top': {
            'M_design': float(M_neg),
            'K': float(res_top.get('K', 0) or 0),
            'K_lim': float(K_lim),
            'z': float(res_top.get('z') or 0),
            'As_req': float(As_top),
            'As_prov': float(As_top_prov),
            'Mu_cap': float(res_top.get('Mu_cap') or 0),
            'util': float(res_top.get('util', 0) or 0),
            'status': res_top.get('status', 'OK'),
            'section_type': res_top.get('section_type', 'Singly Reinforced'),
            'bar_options': bars_top,
        },

        # ── Shear ───────────────────────────────────────────────────────────────
        'shear': {
            'V_design': float(abs(V_max)),
            'v': float(v),
            'vc': float(vc),
            'v_max': float(v_max),
            'vc_kN': float(vc * b * d_eff / 1000),
            'status': shear_check,
            'util': float(shear_util),
            'link_options': link_options,
            'Asv_sv_req': float(Asv_sv_req),
            'sv_max': float(sv_max),
        },

        # ── SLS ─────────────────────────────────────────────────────────────────
        'sls': {
            'deflection_check': deflection_check,
            'span_depth_actual': float(actual_ratio),
            'span_depth_allowable': float(allowable_ratio),
            'deflection_util': float(deflection_util),
            'max_bar_spacing': float(max_spacing),
            'actual_spacing': float(spacing),
            'crack_check': crack_check,
            'service_stress': float(fs),
        },

        # ── Legacy fields (keep backward-compat with old displayBeamResults) ────
        'uls': {
            'depth': float(h_mm),
            'eff_depth': float(d_eff),
            'steel_area_req': float(As_bot),
            'steel_area_prov': float(As_bot_prov),
            'num_bars': bars_bot[0]['n'] if bars_bot else 2,
            'bar_size': bars_bot[0]['dia'] if bars_bot else 16,
            'utilization': float(min(res_bot.get('util', 0) or 0, 1) * 100),
            'K_actual': float(res_bot.get('K', 0) or 0),
            'K_limit': float(K_lim),
            'shear_check': shear_check,
            'shear_stress_actual': float(v),
            'shear_stress_allow': float(vc),
            'shear_util': float(shear_util),
            'link_status': shear_check,
            'link_options': link_options,
            'Asv_sv_req': float(Asv_sv_req),
            'sv_max': float(sv_max),
            'As_min': float(As_min_val),
            'rho_req': float(100 * As_bot / (b * d_eff)) if b * d_eff > 0 else 0,
            'section_type': res_bot.get('section_type', 'Singly Reinforced'),
        },
        'bar_options': bars_bot,
    }


def design_column_bs_8110(N_Ed, M_Ed, L_col, b_col, h_col, fcu, fy, cover, bar_dia):
    """
    Column design to BS 8110:1997
    Simplified for rectangular sections under axial + uniaxial bending
    """
    import numpy as np
    
    # Material properties
    gamma_m = 1.5
    gamma_s = 1.05
    
    fcu_design = 0.67 * fcu / gamma_m
    fy_design = fy / gamma_s
    
    b = b_col  # mm
    h = h_col  # mm
    d = h - cover - bar_dia
    d2 = cover + bar_dia
    
    # ========== SLENDERNESS CHECK (BS 8110 Clause 3.8.1.3) ==========
    
    # Effective length
    l_e = 0.75 * L_col * 1000  # Assume one end fixed, one pinned
    
    # Slenderness ratio
    lambda_ratio = l_e / h
    
    # Short or slender?
    if lambda_ratio <= 15:
        slenderness_category = "Short column"
        M_add = 0
    elif lambda_ratio <= 32:
        slenderness_category = "Short column (borderline)"
        M_add = 0
    else:
        slenderness_category = "Slender column"
        # Additional moment (BS 8110 Clause 3.8.3)
        beta_a = 1.0  # Simplified
        K = (l_e / h)**2 - 15
        M_add = N_Ed * 1000 * h * beta_a * K / 2000
    
    M_Ed_total = M_Ed * 1e6 + M_add
    
    # Minimum eccentricity (BS 8110 Clause 3.8.2.4)
    e_min = max(0.05 * h, 20)
    M_Ed_total = max(M_Ed_total, N_Ed * 1000 * e_min)
    
    # ========== DESIGN FOR AXIAL + BENDING ==========
    
    # BS 8110 uses interaction charts or simplified formulae
    # For rectangular columns with symmetric reinforcement
    
    # Check if column is primarily compression or primarily bending
    N_bal = 0.25 * fcu_design * b * h  # Approximate balanced load
    
    if N_Ed * 1000 > 0.1 * N_bal:
        # Compression-controlled
        # Use simplified formula (BS 8110 Clause 3.8.4.5)
        
        # Total steel area (BS 8110 suggests 1-4% for economy)
        # Start with 2%
        As_total = 0.02 * b * h
        
        # Refine based on moment
        if M_Ed_total > 0:
            # Approximate additional steel for moment
            As_add = M_Ed_total / (fy_design * 0.9 * h)
            As_total += As_add
    else:
        # Bending-controlled
        As_total = 0.01 * b * h  # Minimum
        
        # Additional steel for moment
        As_moment = M_Ed_total / (fy_design * 0.9 * h)
        As_total += As_moment
    
    # Minimum steel (BS 8110 Clause 3.12.5.3)
    As_min = 0.004 * b * h
    
    # Maximum steel (BS 8110 Clause 3.12.6.1)
    As_max = 0.06 * b * h  # 6% for vertically cast, 8% at laps
    
    As_total = max(As_total, As_min)
    As_total = min(As_total, As_max)
    
    # Provide bars (assume bars on all four faces)
    num_bars = int(np.ceil(As_total / (np.pi * (bar_dia/2)**2)))
    num_bars = max(num_bars, 4)  # Minimum 4 bars
    As_prov = num_bars * np.pi * (bar_dia/2)**2
    
    # Capacity check (simplified)
    # N_Rd ≈ 0.35·fcu·Ac + 0.67·fy·Asc (BS 8110 formula)
    Ac = b * h - As_prov
    N_Rd = (0.35 * fcu * Ac + 0.67 * fy * As_prov) / 1000  # kN
    
    utilization = (N_Ed / N_Rd * 100) if N_Rd > 0 else 100
    
    # ========== SLS CHECKS ==========
    
    # Cover check (BS 8110 Clause 3.3)
    min_cover = max(bar_dia, 25)  # 25mm minimum for moderate exposure
    cover_check = "OK" if cover >= min_cover else f"Increase to minimum {min_cover}mm"
    
    # Links/ties (BS 8110 Clause 3.12.7)
    link_dia_min = max(6, bar_dia / 4)
    link_spacing_max = min(12 * bar_dia, b, h)
    
    return {
        'success': True,
        'code': 'BS 8110:1997 (Nigerian Standard)',
        
        'uls': {
            'steel_area_req': float(As_total),
            'steel_area_prov': float(As_prov),
            'num_bars': int(num_bars),
            'bar_size': int(bar_dia),
            'steel_percentage': float(As_prov / (b * h) * 100),
            'axial_capacity': float(N_Rd),
            'utilization': float(utilization),
            'slenderness': float(lambda_ratio),
            'category': slenderness_category,
            'design_moment': float(M_Ed_total / 1e6),
            'additional_moment': float(M_add / 1e6) if M_add > 0 else 0.0
        },
        
        'sls': {
            'cover_check': cover_check,
            'min_cover_required': float(min_cover),
            'min_link_dia': float(link_dia_min),
            'max_link_spacing': float(link_spacing_max)
        }
    }

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
