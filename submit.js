import { insertSubmission } from './supabase.js';

/**
 * Submit current result to Supabase. Can be called from other UI actions
 * (print/copy) to ensure data is uploaded before those actions.
 * Returns { success: boolean, error }
 */
export async function submitResult({ skipConfirm = false } = {}) {
  const btn = document.getElementById('submitBtn');
  try {
    const payload = window.buildSubmissionPayload();

    if (!payload.student_name) {
      window.flashNotice('Please enter your name before calculating/submitting.', 'danger');
      // Highlight the input field
      const nameInput = document.getElementById('userName');
      if (nameInput) nameInput.focus();
      return { success: false, error: 'no-name' };
    }

    const hasMarks = payload.subjects.some(s => s.marks !== null);
    if (!hasMarks) {
      window.flashNotice('Please enter marks for at least one subject before submitting.', 'danger');
      return { success: false, error: 'no-marks' };
    }
    if (payload.semester_gpa_including_failed === null) {
      window.flashNotice('GPA not calculated. Please ensure marks and included subjects produce a GPA.', 'danger');
      return { success: false, error: 'no-gpa' };
    }

    if (!skipConfirm) {
      const ok = confirm('Are you sure you want to submit?');
      if (!ok) return { success: false, error: 'cancelled' };
    }

    if (btn) { btn.disabled = true; var prevText = btn.textContent; btn.textContent = 'Submitting...'; }

    const { data, error } = await insertSubmission(payload);
    if (error) {
      window.flashNotice('Submission failed: ' + (error.message || 'Unknown error'), 'danger');
      if (btn) { btn.disabled = false; btn.textContent = prevText || 'Submit Result'; }
      return { success: false, error };
    }

    window.flashNotice('Result submitted successfully.', 'info');

    if (btn) { btn.disabled = false; btn.textContent = prevText || 'Submit Result'; }
    return { success: true, data };

  } catch (err) {
    window.flashNotice('An unexpected error occurred while submitting.', 'danger');
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Result'; }
    return { success: false, error: err };
  }
}

// Expose for other scripts
window.submitResult = submitResult;

// Wire button click to submitResult when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('submitBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await submitResult();
  });
});

