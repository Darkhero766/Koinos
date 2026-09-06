/* KOINOS — simple product interactions. Real data/map logic lives in live-core.js. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

(() => {
  if (!document.querySelector('[data-koinos-polish]')) {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/hackathon-polish.css'; css.dataset.koinosPolish = 'true'; document.head.appendChild(css);
  }
  if (!document.querySelector('script[src="/live-core.js"]')) {
    const script = document.createElement('script'); script.src = '/live-core.js'; script.defer = true; document.head.appendChild(script);
  }
})();

const toast = (message) => {
  const node = $('#toast'); if (!node) return;
  node.textContent = message; node.classList.add('show');
  clearTimeout(window.__toast); window.__toast = setTimeout(() => node.classList.remove('show'), 2600);
};

const modal = $('#report-modal');
const steps = $$('.report-step');
let currentStep = 1;
const renderStep = (step) => {
  currentStep = step;
  steps.forEach(x => x.classList.toggle('active', Number(x.dataset.step) === step));
  if ($('#modal-step')) $('#modal-step').textContent = `0${step} / 04`;
  if ($('#modal-progress-bar')) $('#modal-progress-bar').style.width = `${step * 25}%`;
  if (step === 4) {
    if ($('#ai-loading')) $('#ai-loading').style.display = 'block';
    $('#ai-result')?.classList.remove('show');
    clearTimeout(window.__ai);
    window.__ai = setTimeout(() => { if ($('#ai-loading')) $('#ai-loading').style.display = 'none'; $('#ai-result')?.classList.add('show'); }, 900);
  }
};
const openReport = () => { if (!modal) return; modal.hidden = false; document.body.style.overflow = 'hidden'; renderStep(1); };
const closeReport = () => { if (!modal) return; modal.hidden = true; document.body.style.overflow = ''; };
$$('.report-trigger').forEach(b => b.addEventListener('click', openReport));
$('.modal-close')?.addEventListener('click', closeReport);
modal?.addEventListener('click', e => { if (e.target === modal) closeReport(); });
$$('.modal-next').forEach(b => b.addEventListener('click', () => renderStep(Math.min(4, currentStep + 1))));

const photo = $('#photo-upload');
if (photo) { photo.accept = 'image/*'; photo.setAttribute('capture', 'environment'); }
$('#take-photo')?.addEventListener('click', () => photo?.click());
photo?.addEventListener('change', e => { const f = e.target.files?.[0]; if (!f) return; if ($('#file-name')) $('#file-name').textContent = f.name; if ($('#take-photo')) $('#take-photo').textContent = 'Change photo'; });

$$('[data-suggestion]').forEach(b => b.addEventListener('click', () => {
  const input = $('#report-description'); if (!input) return;
  input.value = `${input.value ? input.value + ' ' : ''}${b.dataset.suggestion}.`; input.focus();
}));

$('.join-issue-button')?.addEventListener('click', async () => {
  if (window.KOINOS_LIVE?.submitReport) await window.KOINOS_LIVE.submitReport();
  $$('.report-step').forEach(x => x.classList.remove('active'));
  $('#modal-success')?.classList.add('show');
  toast('Your report is now part of the community record.');
});
$('.separate-button')?.addEventListener('click', async () => {
  if (window.KOINOS_LIVE?.submitReport) await window.KOINOS_LIVE.submitReport();
  toast('Report saved.'); closeReport();
});
$('.close-success')?.addEventListener('click', closeReport);

$('.support-button')?.addEventListener('click', async e => {
  if (e.currentTarget.dataset.supported) return;
  const issueId = e.currentTarget.dataset.issueId;
  const result = issueId && window.KOINOS_LIVE?.upvote ? await window.KOINOS_LIVE.upvote(issueId) : null;
  const count = result?.upvotes ?? (Number($('#affected-count')?.textContent || 47) + 1);
  if ($('#affected-count')) $('#affected-count').textContent = count;
  if ($('.support-note')) $('.support-note').textContent = `${count} people have confirmed this problem.`;
  e.currentTarget.dataset.supported = 'true';
  e.currentTarget.innerHTML = "You're affected too <span>✓</span>";
  toast('Your voice was added to this community issue.');
});

$('.merge-button')?.addEventListener('click', () => {
  $('.shared-issue')?.classList.add('is-merging');
  $('.merge-button').innerHTML = '37 reports merged <span>✓</span>';
  toast('37 reports became one shared issue.');
  setTimeout(() => $('.shared-issue')?.classList.remove('is-merging'), 800);
});

const comparison = $('.comparison-slider');
const updateComparison = () => { if (!comparison) return; $('.damaged') && ($('.damaged').style.width = `${comparison.value}%`); $('.slider-handle') && ($('.slider-handle').style.left = `${comparison.value}%`); };
comparison?.addEventListener('input', updateComparison); updateComparison();
$$('.verify-button').forEach(b => b.addEventListener('click', () => { $('.verified-message')?.classList.add('show'); toast(b.textContent.toLowerCase().includes('resolved') ? 'Community verification recorded.' : 'Thanks — the issue stays open.'); }));

$$('.filter-button').forEach(b => b.addEventListener('click', () => {
  $$('.filter-button').forEach(x => x.classList.remove('active')); b.classList.add('active');
  window.KOINOS_LIVE?.filterMap(b.dataset.filter || 'all');
}));

window.addEventListener('koinos:issue', e => {
  const issue = e.detail || {}; const card = $('#selected-issue'); if (!card) return;
  card.querySelector('h3') && (card.querySelector('h3').textContent = issue.title || 'Civic issue');
  card.querySelector('> p') && (card.querySelector('> p').textContent = issue.locationLabel || issue.address || 'Nearby');
  const metrics = $$('.issue-metrics strong', card);
  if (metrics[0]) metrics[0].textContent = issue.upvotes ?? 0;
  if (metrics[1]) metrics[1].textContent = issue.priority ?? issue.severity?.toUpperCase() ?? '—';
  if (metrics[2]) metrics[2].textContent = issue.reportCount ?? 1;
  $('.support-button')?.setAttribute('data-issue-id', issue.id || '');
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); observer.unobserve(e.target); } }), { threshold: .08 });
  $$('.merge-stage, .explore-layout, .community-visual, .priority-layout, .proof-section, .final-cta').forEach(n => { n.classList.add('koinos-reveal'); observer.observe(n); });
}

document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal && !modal.hidden) closeReport(); });
