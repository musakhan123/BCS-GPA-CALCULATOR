import { supabase, fetchSubmissions, deleteSubmission, signInWithEmail, signOut, getSession } from './supabase.js';

// Utilities
const el = id => document.getElementById(id);

async function renderTable(rows) {
  const tbody = document.querySelector('#resultsTable tbody');
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    const created = new Date(r.created_at).toLocaleString();
    tr.innerHTML = `
      <td>${created}</td>
      <td>${escapeHtml(r.student_name || '--')}</td>
      <td>${escapeHtml(r.roll_number || '--')}</td>
      <td>${escapeHtml(r.program || '--')}</td>
      <td>${r.semester_gpa_including_failed === null ? '--' : r.semester_gpa_including_failed}</td>
      <td>${r.final_cgpa === null ? '--' : r.final_cgpa}</td>
      <td>
        <button class="action" data-id="${r.id}" data-action="view">View</button>
        <button class="action" data-id="${r.id}" data-action="delete">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(str){ if(!str) return ''; return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

let currentRows = [];

async function loadAndRender() {
  el('refreshBtn').disabled = true;
  const { data, error } = await fetchSubmissions();
  el('refreshBtn').disabled = false;
  if (error) {
    alert('Could not fetch submissions: ' + error.message);
    return;
  }
  currentRows = data;
  applyFiltersAndRender();
}

function applyFiltersAndRender(){
  const name = el('searchName').value.trim().toLowerCase();
  const roll = el('searchRoll').value.trim().toLowerCase();
  const order = el('sortOrder').value;
  let rows = currentRows.slice();
  if (name) rows = rows.filter(r => (r.student_name || '').toLowerCase().includes(name));
  if (roll) rows = rows.filter(r => (r.roll_number || '').toLowerCase().includes(roll));
  rows.sort((a,b)=>{
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return order === 'asc' ? ta - tb : tb - ta;
  });
  renderTable(rows);
}

function attachTableHandlers(){
  document.querySelector('#resultsTable tbody').addEventListener('click', async (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if(action === 'view'){
      const row = currentRows.find(r=>r.id===id);
      if(row) showDetail(row);
    } else if(action === 'delete'){
      if(!confirm('Delete this submission?')) return;
      const res = await deleteSubmission(id);
      if(res.error) alert('Delete failed: ' + res.error.message);
      else { alert('Deleted'); loadAndRender(); }
    }
  });
}

function showDetail(row){
  const modal = el('detailModal');
  const content = el('detailContent');
  const created = new Date(row.created_at).toLocaleString();
  const subjects = (row.subjects || []).map(s=>`<tr><td>${escapeHtml(s.name)}</td><td>${s.credits}</td><td>${s.marks===null?'--':s.marks}</td><td>${s.gpa===null?'--':s.gpa}</td><td>${escapeHtml(s.status)}</td></tr>`).join('');
  content.innerHTML = `
    <h2>Submission Detail</h2>
    <p><strong>Date:</strong> ${created}<br>
    <strong>Student:</strong> ${escapeHtml(row.student_name || '--')}<br>
    <strong>Roll:</strong> ${escapeHtml(row.roll_number || '--')}<br>
    <strong>Program:</strong> ${escapeHtml(row.program || '--')}<br>
    <strong>Semester GPA:</strong> ${row.semester_gpa_including_failed === null ? '--' : row.semester_gpa_including_failed}<br>
    <strong>CGPA:</strong> ${row.final_cgpa === null ? '--' : row.final_cgpa}</p>
    <h3>Subjects</h3>
    <table><tr><th>Subject</th><th>Credits</th><th>Marks</th><th>GPA</th><th>Status</th></tr>${subjects}</table>
  `;
  modal.classList.remove('hidden');
}

function attachUi(){
  el('searchName').addEventListener('input', applyFiltersAndRender);
  el('searchRoll').addEventListener('input', applyFiltersAndRender);
  el('sortOrder').addEventListener('change', applyFiltersAndRender);
  el('refreshBtn').addEventListener('click', loadAndRender);
  el('closeDetail').addEventListener('click', ()=> el('detailModal').classList.add('hidden'));

  el('exportCsv').addEventListener('click', ()=> exportCsv(currentRows));
  el('exportExcel').addEventListener('click', ()=> exportExcel(currentRows));
  el('exportPdf').addEventListener('click', ()=> exportPdf(currentRows));
}

function exportCsv(rows){
  if(!rows || rows.length===0){ alert('No data to export'); return; }
  const header = ['created_at','student_name','roll_number','program','semester_gpa_including_failed','semester_gpa_excluding_failed','final_cgpa','total_credits'];
  const lines = [header.join(',')];
  rows.forEach(r=>{
    const vals = header.map(h=>`"${String(r[h]===null||r[h]===undefined?'':r[h]).replace(/"/g,'""')}"`);
    lines.push(vals.join(','));
  });
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'submissions.csv'; a.click(); URL.revokeObjectURL(url);
}

function exportExcel(rows){
  if(!rows || rows.length===0){ alert('No data to export'); return; }
  const sheetData = rows.map(r=>({
    Date: r.created_at,
    Student: r.student_name,
    Roll: r.roll_number,
    Program: r.program,
    Semester_GPA: r.semester_gpa_including_failed,
    CGPA: r.final_cgpa,
    Total_Credits: r.total_credits
  }));
  const ws = XLSX.utils.json_to_sheet(sheetData);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
  XLSX.writeFile(wb, 'submissions.xlsx');
}

async function exportPdf(rows){
  if(!rows || rows.length===0){ alert('No data to export'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(12);
  doc.text('Submissions', 14, 20);
  let y = 30;
  rows.slice(0,30).forEach(r=>{
    doc.text(`${new Date(r.created_at).toLocaleString()} - ${r.student_name || '--'} - ${r.roll_number || '--'} - GPA: ${r.semester_gpa_including_failed || '--'}`, 14, y);
    y += 8;
    if(y > 270){ doc.addPage(); y = 20; }
  });
  doc.save('submissions.pdf');
}

// Simple auth UI: sign in with email magic link. If policies allow anon select, guest view will work.
function renderAuthArea(){
  const area = el('authArea');
  area.innerHTML = `
    <div id="authControls">
      <input type="email" id="authEmail" placeholder="Admin email for sign-in">
      <button id="authSignIn">Sign in</button>
      <button id="authGuest">View as guest</button>
    </div>
  `;
  el('authSignIn').addEventListener('click', async ()=>{
    const email = el('authEmail').value.trim();
    if(!email) return alert('Enter email');
    const res = await signInWithEmail(email);
    if(res.error) alert('Sign-in failed: ' + res.error.message);
    else alert('Check your email for a magic link to sign in.');
  });
  el('authGuest').addEventListener('click', async ()=>{
    // attempt to load as anon
    await loadAndRender();
  });
}

// On load
document.addEventListener('DOMContentLoaded', async ()=>{
  renderAuthArea();
  attachUi();
  attachTableHandlers();

  // Try to load automatically (if policies permit)
  await loadAndRender();
});
