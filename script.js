/* =========================================================
   GPA & CGPA Calculator — Application Logic
   Organized in clearly separated sections:
     1. Data: programs & grading scale (easy to extend)
     2. Grading conversion (isolated, swappable)
     3. State
     4. Render helpers
     5. Calculation engine (GPA / stats / CGPA)
     6. Event wiring
     7. Export / Print / Copy
   ========================================================= */

/* ---------------------------------------------------------
   1. PROGRAM DATA
   To add a new program later: add an entry here with its
   own subject list. Nothing else needs to change.
--------------------------------------------------------- */
const PROGRAMS = {
  cs: {
    label: "BCS — Bachelor of Computer Science",
    semesterLabel: "Semester 4",
    subjects: [
      { name: "Software Engineering", credits: 3 },
      { name: "Design and Analysis of Algorithms", credits: 3 },
      { name: "Probability and Statistics", credits: 3 },
      { name: "COAL Theory", credits: 2 },
      { name: "Artificial Intelligence", credits: 2 },
      { name: "Database Systems", credits: 3 },
      { name: "Database Systems Lab", credits: 1 },
      { name: "COAL Lab", credits: 1 },
      { name: "AI Lab", credits: 1 }
    ]
  }
};

/* ---------------------------------------------------------
   2. GRADING SCALE (marks -> GPA)
   Kept as a single sorted table so it can be edited or
   replaced without touching any other logic.
   Below 60 marks = Fail (GPA 0).
--------------------------------------------------------- */
const GRADING_SCALE = [
  { min: 87, max: 100,   gpa: 4.00, letter: "A"  },
  { min: 80, max: 86.99, gpa: 3.50, letter: "B+" },
  { min: 72, max: 79.99, gpa: 3.00, letter: "B"  },
  { min: 66, max: 71.99, gpa: 2.50, letter: "C+" },
  { min: 60, max: 65.99, gpa: 2.00, letter: "C"  },
  { min: 0,  max: 59.99, gpa: 0.00, letter: "F"  }
];

const PASS_MARK = 60; // marks at or above this are a pass; below this is an automatic fail

/** Convert marks (0-100) to GPA using GRADING_SCALE. Returns null if out of range. */
function marksToGpa(marks) {
  if (marks === null || marks === undefined || isNaN(marks)) return null;
  if (marks < 0 || marks > 100) return null;
  const row = GRADING_SCALE.find(r => marks >= r.min && marks <= r.max);
  return row ? row.gpa : null;
}

/** Find the letter grade for a given marks value, for display in the reference table. */
function marksToLetter(marks) {
  const row = GRADING_SCALE.find(r => marks >= r.min && marks <= r.max);
  return row ? row.letter : "--";
}

/** Derive pass/fail status automatically from marks. */
function statusFromMarks(marks) {
  if (marks === null || isNaN(marks)) return "not-entered";
  return marks < PASS_MARK ? "failed" : "passed";
}

/* ---------------------------------------------------------
   3. STATE
--------------------------------------------------------- */
let subjects = [];          // array of subject-row state objects
let cgpaMethod = "1";       // "1" | "2"

function makeSubjectState(def, idx) {
  return {
    id: "subj-" + idx,
    name: def.name,
    credits: def.credits,
    marks: "",           // raw marks as typed (string, may be "")
    status: "not-entered", // auto-derived: "not-entered" | "passed" | "failed"
    includeInGpa: true    // user-controlled: whether this subject counts toward the GPA
  };
}

function loadProgram(programKey) {
  const program = PROGRAMS[programKey];
  subjects = program.subjects.map((s, i) => makeSubjectState(s, i));
}

/* ---------------------------------------------------------
   4. RENDER HELPERS
--------------------------------------------------------- */
const el = (id) => document.getElementById(id);

function renderSubjectTable() {
  const tbody = el("subjectTbody");
  tbody.innerHTML = "";

  subjects.forEach((s) => {
    const tr = document.createElement("tr");
    tr.id = s.id;
    const gpaInfo = computeSubjectGpa(s);
    applyRowClass(tr, s, gpaInfo);

    tr.innerHTML = `
      <td class="col-subject" data-label="Subject">
        <input class="subject-name-input" data-field="name" data-id="${s.id}" value="${escapeHtml(s.name)}">
      </td>
      <td class="col-credit" data-label="Credits">
        <input type="number" class="cell-input" data-field="credits" data-id="${s.id}" value="${s.credits}" min="0" step="1">
      </td>
      <td class="col-input" data-label="Marks">
        <input type="number" class="cell-input" data-field="marks" data-id="${s.id}"
               value="${s.marks}" placeholder="0-100" min="0" max="100" step="0.01">
      </td>
      <td class="col-gpa" data-label="GPA">
        <span class="gpa-display ${gpaInfo.gpa === null ? 'dash' : ''}">${gpaInfo.gpa === null ? '--' : gpaInfo.gpa.toFixed(2)}</span>
      </td>
      <td class="col-status" data-label="Status">
        ${statusBadge(s.status)}
      </td>
      <td class="col-include" data-label="Include">
        <div class="include-checkbox-wrap">
          <input type="checkbox" class="include-checkbox" data-field="includeInGpa" data-id="${s.id}" ${s.includeInGpa ? "checked" : ""} title="Include this subject in the semester GPA">
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function statusBadge(status) {
  const label = status === "not-entered" ? "Not Entered" : (status === "passed" ? "Passed" : "Failed");
  return `<span class="status-badge status-${status}">${label}</span>`;
}

function applyRowClass(tr, s, gpaInfo) {
  tr.classList.remove("row-failed", "row-passed");
  if (s.status === "failed") tr.classList.add("row-failed");
  else if (s.status === "passed") tr.classList.add("row-passed");
}

/** Update a single row's GPA cell, status badge, and highlight in place (keeps input focus while typing). */
function updateRowDisplay(subj) {
  const tr = document.getElementById(subj.id);
  if (!tr) return;
  const info = computeSubjectGpa(subj);

  const gpaSpan = tr.querySelector(".gpa-display");
  if (gpaSpan) {
    gpaSpan.textContent = info.gpa === null ? "--" : info.gpa.toFixed(2);
    gpaSpan.classList.toggle("dash", info.gpa === null);
  }

  const statusCell = tr.querySelector(".col-status");
  if (statusCell) statusCell.innerHTML = statusBadge(subj.status);

  applyRowClass(tr, subj, info);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------
   5. CALCULATION ENGINE
--------------------------------------------------------- */

/**
 * Determine the effective GPA for a single subject row.
 * Status (passed/failed/not-entered) is derived automatically from marks.
 * Returns { gpa, hasEntry, countsInGpa }
 *   hasEntry     -> user has entered marks for this subject
 *   countsInGpa  -> hasEntry AND the "Include in GPA" checkbox is checked
 */
function computeSubjectGpa(s) {
  const raw = s.marks;
  if (raw === "" || raw === null || raw === undefined) {
    s.status = "not-entered";
    return { gpa: null, hasEntry: false, countsInGpa: false };
  }

  const num = parseFloat(raw);
  if (isNaN(num) || num < 0 || num > 100) {
    s.status = "not-entered";
    return { gpa: null, hasEntry: false, countsInGpa: false };
  }

  s.status = statusFromMarks(num);
  const gpa = marksToGpa(num); // will be 0 for marks below PASS_MARK

  return {
    gpa,
    hasEntry: true,
    countsInGpa: s.includeInGpa === true
  };
}

function calculateAll() {
  let sumPoints = 0, creditsInGpa = 0;
  let completed = 0, failed = 0, pending = 0;
  let completedCredits = 0, failedCredits = 0, totalCredits = 0;

  subjects.forEach((s) => {
    const credits = parseFloat(s.credits) || 0;
    totalCredits += credits;
    const info = computeSubjectGpa(s);

    if (!info.hasEntry) {
      pending++;
      return;
    }

    if (s.status === "passed") {
      completed++;
      completedCredits += credits;
    } else if (s.status === "failed") {
      failed++;
      failedCredits += credits;
    }

    if (info.countsInGpa) {
      sumPoints += info.gpa * credits;
      creditsInGpa += credits;
    }
  });

  const gpa = creditsInGpa > 0 ? sumPoints / creditsInGpa : null;

  return {
    gpa,
    completed, failed, pending,
    completedCredits,
    attemptedCredits: creditsInGpa,
    remainingCredits: totalCredits - completedCredits - failedCredits,
    totalCredits
  };
}

function updateDial(dialFillId, valueElId, gpa) {
  const fill = el(dialFillId);
  const valueEl = el(valueElId);
  const circumference = 276.5; // 2 * PI * 44, matches SVG radius
  if (gpa === null) {
    fill.style.strokeDashoffset = circumference;
    valueEl.textContent = "--";
    fill.style.stroke = "var(--line)";
    return;
  }
  const ratio = Math.max(0, Math.min(1, gpa / 4));
  fill.style.strokeDashoffset = circumference * (1 - ratio);
  valueEl.textContent = gpa.toFixed(2);
  fill.style.stroke = gpa >= 2.0 ? "var(--accent)" : "var(--danger)";
}

function renderResults() {
  const r = calculateAll();

  updateDial("dialGpaFill", "gpaValue", r.gpa);

  el("statCompleted").textContent = r.completed;
  el("statPending").textContent = r.pending;
  el("statFailed").textContent = r.failed;
  el("statCompletedCr").textContent = r.completedCredits;
  el("statRemainingCr").textContent = Math.max(0, r.remainingCredits);
  el("statAttemptedCr").textContent = r.attemptedCredits;
  el("statTotalCr").textContent = r.totalCredits;

  // Feed the computed semester GPA into the CGPA calculators (auto-fill, stays editable)
  if (r.gpa !== null) {
    autofillIfUntouched("sem4GpaM1", r.gpa.toFixed(2));
    autofillIfUntouched("sem4Gpa", r.gpa.toFixed(2));
  }

  renderNotices(r);
  calculateCgpa();
}

// Tracks which auto-fillable fields the user has manually edited,
// so we never clobber a deliberate edit.
const userTouched = new Set();
function autofillIfUntouched(id, value) {
  if (userTouched.has(id)) return;
  el(id).value = value;
}

function renderNotices(r) {
  const area = el("noticeArea");
  const notices = [];

  if (r.pending > 0) {
    notices.push({ type: "warning", text: `${r.pending} subject${r.pending === 1 ? " is" : "s are"} still pending.` });
  }
  if (r.failed > 0) {
    const excludedFailed = subjects.filter(s => s.status === "failed" && !s.includeInGpa).length;
    if (excludedFailed > 0) {
      notices.push({ type: "info", text: `${excludedFailed} failed subject${excludedFailed === 1 ? "" : "s"} excluded from GPA — uncheck "Include in GPA" is being respected.` });
    } else {
      notices.push({ type: "danger", text: `${r.failed} subject${r.failed === 1 ? "" : "s"} failed (below ${PASS_MARK} marks) and ${r.failed === 1 ? "is" : "are"} counted in Semester GPA.` });
    }
  }
  if (r.completed === 0 && r.failed === 0) {
    notices.push({ type: "info", text: "No completed subjects entered yet." });
  }

  area.innerHTML = notices.map(n => `<div class="notice notice-${n.type}">${n.text}</div>`).join("");
}

/* ----- CGPA calculation ----- */
function calculateCgpa() {
  let result = null;

  if (cgpaMethod === "1") {
    const prevCgpa = parseFloat(el("prevCgpa").value);
    const prevCredits = parseFloat(el("prevCredits").value);
    const sem4Gpa = parseFloat(el("sem4GpaM1").value);
    const sem4Credits = parseFloat(el("sem4CreditsM1").value);

    if (!isNaN(prevCgpa) && !isNaN(prevCredits) && !isNaN(sem4Gpa) && !isNaN(sem4Credits)) {
      const totalCredits = prevCredits + sem4Credits;
      if (totalCredits > 0) {
        result = ((prevCgpa * prevCredits) + (sem4Gpa * sem4Credits)) / totalCredits;
      }
    }
  } else {
    const pairs = [
      [el("sem1Gpa").value, el("sem1Credits").value],
      [el("sem2Gpa").value, el("sem2Credits").value],
      [el("sem3Gpa").value, el("sem3Credits").value],
      [el("sem4Gpa").value, el("sem4Credits").value]
    ];
    let sumPoints = 0, sumCredits = 0, any = false;
    pairs.forEach(([gpaStr, credStr]) => {
      const gpa = parseFloat(gpaStr);
      const credits = parseFloat(credStr);
      if (!isNaN(gpa) && !isNaN(credits) && credits > 0) {
        sumPoints += gpa * credits;
        sumCredits += credits;
        any = true;
      }
    });
    if (any && sumCredits > 0) result = sumPoints / sumCredits;
  }

  el("cgpaResultValue").textContent = result === null ? "--" : result.toFixed(2);
}

/* ---------------------------------------------------------
   6. EVENT WIRING
--------------------------------------------------------- */
function initProgramSelect() {
  el("programSelect").addEventListener("change", (e) => {
    loadProgram(e.target.value);
    renderSubjectTable();
    renderResults();
  });
}

function initSubjectTableEvents() {
  const tbody = el("subjectTbody");

  tbody.addEventListener("input", (e) => {
    const target = e.target;
    const field = target.dataset.field;
    const id = target.dataset.id;
    if (!field || !id) return;
    const subj = subjects.find(s => s.id === id);
    if (!subj) return;

    if (field === "name") subj.name = target.value;
    if (field === "credits") subj.credits = target.value === "" ? 0 : parseFloat(target.value);
    if (field === "marks") {
      subj.marks = target.value;
      validateMarksInput(target, subj);
    }
    updateRowDisplay(subj);
  });

  tbody.addEventListener("change", (e) => {
    const target = e.target;
    if (target.dataset.field === "includeInGpa") {
      const subj = subjects.find(s => s.id === target.dataset.id);
      if (subj) subj.includeInGpa = target.checked;
    }
  });
}

function validateMarksInput(inputEl, subj) {
  const val = parseFloat(subj.marks);
  let invalid = false;
  if (subj.marks !== "" && (isNaN(val) || val < 0 || val > 100)) invalid = true;
  inputEl.classList.toggle("invalid", invalid);
}

function initResetButtons() {
  el("resetGpaBtn").addEventListener("click", () => {
    loadProgram(el("programSelect").value);
    renderSubjectTable();
    renderResults();
  });

  el("resetCgpaBtn").addEventListener("click", () => {
    el("prevCgpa").value = "";
    el("prevCredits").value = 50;
    el("sem4CreditsM1").value = 19;
    ["sem1Gpa", "sem2Gpa", "sem3Gpa"].forEach(id => el(id).value = "");
    el("sem1Credits").value = 15;
    el("sem2Credits").value = 17;
    el("sem3Credits").value = 18;
    el("sem4Credits").value = 19;
    userTouched.delete("sem4GpaM1");
    userTouched.delete("sem4Gpa");
    renderResults();
  });
}

function initCgpaMethodToggle() {
  const toggle = el("cgpaMethodToggle");
  toggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".mode-btn");
    if (!btn) return;
    cgpaMethod = btn.dataset.method;
    [...toggle.querySelectorAll(".mode-btn")].forEach(b => b.classList.toggle("active", b === btn));
    el("method1").classList.toggle("hidden", cgpaMethod !== "1");
    el("method2").classList.toggle("hidden", cgpaMethod !== "2");
    calculateCgpa();
  });
}

function initCgpaInputs() {
  const ids = ["prevCgpa", "prevCredits", "sem4GpaM1", "sem4CreditsM1",
               "sem1Gpa", "sem1Credits", "sem2Gpa", "sem2Credits",
               "sem3Gpa", "sem3Credits", "sem4Gpa", "sem4Credits"];
  ids.forEach(id => {
    const node = el(id);
    node.addEventListener("input", () => {
      if (id === "sem4GpaM1" || id === "sem4Gpa") userTouched.add(id);
      validateCgpaField(node);
      calculateCgpa();
    });
  });
}

function validateCgpaField(node) {
  const val = parseFloat(node.value);
  let invalid = false;
  if (node.value !== "" && isNaN(val)) invalid = true;
  if (node.min !== "" && !isNaN(val) && val < parseFloat(node.min)) invalid = true;
  if (node.max && !isNaN(val) && val > parseFloat(node.max)) invalid = true;
  node.classList.toggle("invalid", invalid);
}

/* ----- Quick grade converter (marks -> GPA) ----- */
function initQuickConverter() {
  el("quickInput").addEventListener("input", () => {
    const val = parseFloat(el("quickInput").value);
    const out = el("quickOutputValue");
    if (isNaN(val)) { out.textContent = "--"; return; }
    const gpa = marksToGpa(val);
    out.textContent = gpa === null ? "Out of range" : `${gpa.toFixed(2)} GPA (${marksToLetter(val)})`;
  });

  renderGradingTableReference();
}

function renderGradingTableReference() {
  const table = el("gradingTable");
  let html = "<tr><th>Marks Range</th><th>Letter</th><th>GPA</th></tr>";
  GRADING_SCALE.forEach(row => {
    html += `<tr><td>${row.min}${row.max < 100 ? "–" + Math.floor(row.max) : "+"}</td><td>${row.letter}</td><td>${row.gpa.toFixed(2)}</td></tr>`;
  });
  table.innerHTML = html;
}

/* ---------------------------------------------------------
   7. EXPORT / PRINT / COPY
--------------------------------------------------------- */
function buildReportText() {
  const r = calculateAll();
  const programKey = el("programSelect").value;
  const program = PROGRAMS[programKey];
  const cgpa = el("cgpaResultValue").textContent;
  const date = new Date().toLocaleDateString();
  const userName = el("userName").value.trim() || "Student";

  let lines = [];
  lines.push(`GPA & CGPA Report`);
  lines.push(`Student Name: ${userName}`);
  lines.push(`Program: ${program.label}`);
  lines.push(`Semester: ${program.semesterLabel}`);
  lines.push(`Date: ${date}`);
  lines.push("");
  lines.push("Subjects:");
  subjects.forEach(s => {
    const info = computeSubjectGpa(s);
    const gpaText = info.gpa === null ? "--" : info.gpa.toFixed(2);
    const statusText = s.status === "not-entered" ? "Not Entered" : (s.status === "passed" ? "Passed" : "Failed");
    const includeText = s.includeInGpa ? "Included in GPA" : "Excluded from GPA";
    lines.push(`- ${s.name} | Credit Hrs: ${s.credits} | Marks: ${s.marks || "--"} | GPA: ${gpaText} | Status: ${statusText} | ${includeText}`);
  });
  lines.push("");
  lines.push(`Semester GPA: ${r.gpa === null ? "--" : r.gpa.toFixed(2)}`);
  lines.push(`Final CGPA: ${cgpa}`);
  return lines.join("\n");
}

function buildReportHtml() {
  const r = calculateAll();
  const programKey = el("programSelect").value;
  const program = PROGRAMS[programKey];
  const cgpa = el("cgpaResultValue").textContent;
  const date = new Date().toLocaleDateString();
  const userName = el("userName").value.trim() || "Student";

  let rows = subjects.map(s => {
    const info = computeSubjectGpa(s);
    const gpaText = info.gpa === null ? "--" : info.gpa.toFixed(2);
    const statusText = s.status === "not-entered" ? "Not Entered" : (s.status === "passed" ? "Passed" : "Failed");
    const includeText = s.includeInGpa ? "Yes" : "No";
    return `<tr><td>${escapeHtml(s.name)}</td><td>${s.credits}</td><td>${s.marks || "--"}</td><td>${gpaText}</td><td>${statusText}</td><td>${includeText}</td></tr>`;
  }).join("");

  return `
    <h2>GPA &amp; CGPA Report</h2>
    <p><strong>Student Name:</strong> ${escapeHtml(userName)}<br>
       <strong>Program:</strong> ${program.label}<br>
       <strong>Semester:</strong> ${program.semesterLabel}<br>
       <strong>Date:</strong> ${date}</p>
    <table>
      <tr><th>Subject</th><th>Credit Hrs</th><th>Marks</th><th>GPA</th><th>Status</th><th>In GPA</th></tr>
      ${rows}
    </table>
    <p><strong>Semester GPA:</strong> ${r.gpa === null ? "--" : r.gpa.toFixed(2)}<br>
       <strong>Final CGPA:</strong> ${cgpa}</p>
  `;
}

/**
 * Build a structured submission payload suitable for sending to the backend.
 * This is exposed on `window` so module scripts can call it.
 */
window.buildSubmissionPayload = function() {
  const r = calculateAll();
  const programKey = el("programSelect").value;
  const program = PROGRAMS[programKey];
  const cgpa = el("cgpaResultValue").textContent;
  const date = new Date().toISOString();
  const userName = el("userName").value.trim() || null;
  const userRoll = el("userRoll") ? el("userRoll").value.trim() || null : null;

  // Prevent empty submission: at least one subject must have marks entered
  const subjectRows = subjects.map(s => {
    const info = computeSubjectGpa(s);
    return {
      name: s.name,
      credits: Number(s.credits) || 0,
      marks: (s.marks === "" ? null : (isNaN(Number(s.marks)) ? null : Number(s.marks))),
      gpa: info.gpa === null ? null : Number(info.gpa),
      status: s.status
    };
  });

  return {
    program: program.label,
    program_key: programKey,
    semester: program.semesterLabel || "",
    student_name: userName,
    roll_number: userRoll,
    semester_gpa_including_failed: r.gpa === null ? null : Number(r.gpa.toFixed(2)),
    // compute excluding failed: re-calc ignoring failed subjects
    semester_gpa_excluding_failed: (function(){
      let sum = 0, creds = 0;
      subjects.forEach(s => {
        const info = computeSubjectGpa(s);
        if (info.hasEntry && s.status !== 'failed' && info.countsInGpa) {
          sum += info.gpa * (Number(s.credits) || 0);
          creds += Number(s.credits) || 0;
        }
      });
      return creds > 0 ? Number((sum/creds).toFixed(2)) : null;
    })(),
    final_cgpa: (el("cgpaResultValue").textContent === "--") ? null : Number(el("cgpaResultValue").textContent),
    total_credits: r.totalCredits,
    subjects: subjectRows,
    created_at: date
  };
};

function initExportButtons() {
  // Calculate GPA = submit to database
  el("calcGpaBtn").addEventListener("click", () => {
    (async () => {
      const nameInput = el("userName");
      const nameError = el("nameError");
      
      if (!nameInput.value.trim()) {
        nameInput.classList.add("invalid");
        if(nameError) nameError.style.display = "block";
        nameInput.scrollIntoView({ behavior: "smooth", block: "center" });
        nameInput.focus();
        return;
      }

      renderResults();

      const dial = el("dialGpa");
      if (dial) dial.scrollIntoView({ behavior: "smooth", block: "center" });

      if (window.submitResult) {
        await window.submitResult({ skipConfirm: true });
      }
    })();
  });

  // Clear error state when user types
  el("userName").addEventListener("input", () => {
    el("userName").classList.remove("invalid");
    const nameError = el("nameError");
    if(nameError) nameError.style.display = "none";
  });

  // Print = generate printable report
  el("printBtn").addEventListener("click", () => {
    el("printReport").innerHTML = buildReportHtml();
    window.print();
  });

  // Copy = copy text to clipboard
  el("copyBtn").addEventListener("click", () => {
    const text = buildReportText();
    navigator.clipboard.writeText(text).then(() => {
      flashNotice("Result copied to clipboard.");
    }).catch(() => {
      flashNotice("Could not copy automatically — please select and copy manually.", "danger");
    });
  });
}

function flashNotice(text, type = "info") {
  const area = el("noticeArea");
  const div = document.createElement("div");
  div.className = `notice notice-${type}`;
  div.textContent = text;
  area.prepend(div);
  setTimeout(() => div.remove(), 3200);
}

/* ----- Tab Navigation ----- */
function initTabNavigation() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;
      
      // Remove active class from all buttons and contents
      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(tc => tc.classList.remove("active"));
      
      // Add active class to clicked button and corresponding content
      btn.classList.add("active");
      const tabContent = document.getElementById(`tab-${tabName}`);
      if (tabContent) tabContent.classList.add("active");
    });
  });
}

/* ---------------------------------------------------------
   INIT
   --------------------------------------------------------- */
function init() {
  loadProgram("cs");
  renderSubjectTable();

  initTabNavigation();
  initProgramSelect();
  initSubjectTableEvents();
  initResetButtons();
  initCgpaMethodToggle();
  initCgpaInputs();
  initQuickConverter();
  initExportButtons();

  renderResults();
}

document.addEventListener("DOMContentLoaded", init);
