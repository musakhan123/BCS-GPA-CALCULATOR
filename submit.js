import { insertSubmission } from './supabase.js';

// Submit handler for the calculator page.
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('submitBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      // Build payload from the main app (exposed on window)
      const payload = window.buildSubmissionPayload();

      // Validation: ensure at least one subject has marks and a GPA was computed
      const hasMarks = payload.subjects.some(s => s.marks !== null);
      if (!hasMarks) {
        window.flashNotice('Please enter marks for at least one subject before submitting.', 'danger');
        return;
      }
      if (payload.semester_gpa_including_failed === null) {
        window.flashNotice('GPA not calculated. Please ensure marks and included subjects produce a GPA.', 'danger');
        return;
      }

      const ok = confirm('Are you sure you want to submit?');
      if (!ok) return;

      // Disable button, show loading state
      btn.disabled = true;
      const prevText = btn.textContent;
      btn.textContent = 'Submitting...';

      const { data, error } = await insertSubmission(payload);
      if (error) {
        console.error('Supabase insert error:', error);
        window.flashNotice('Submission failed: ' + (error.message || 'Unknown error'), 'danger');
      } else {
        window.flashNotice('Result submitted successfully.', 'info');
      }

      // restore button
      btn.disabled = false;
      btn.textContent = prevText;

    } catch (err) {
      console.error(err);
      window.flashNotice('An unexpected error occurred while submitting.', 'danger');
      btn.disabled = false;
      btn.textContent = 'Submit Result';
    }
  });
});
