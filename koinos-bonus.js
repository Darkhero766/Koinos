/* KOINOS bonus layer: quick-report QR + transparent civic intelligence preview. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  const RULES = [
    { words: /school|hospital|accident|injur|fire|flood|collapse|exposed wire|electric shock|danger|unsafe|open manhole|sewer|sinkhole/i, severity: 'high', points: 70 },
    { words: /pothole|leak|overflow|broken|damaged|blocked|garbage|waste|streetlight|drain|road work|digging/i, severity: 'medium', points: 45 }
  ];

  function predictSeverity(text, category) {
    const source = `${category || ''} ${text || ''}`;
    const hit = RULES.find(rule => rule.words.test(source));
    let score = hit?.points || 25;
    if (/water|road|streetlight|electricity/i.test(category || '')) score += 8;
    if (/children|school|hospital|traffic|motorist|pedestrian/i.test(source)) score += 12;
    if (/multiple|many|daily|repeated|hours|blocked/i.test(source)) score += 8;
    score = Math.min(99, score);
    const severity = score >= 65 ? 'high' : score >= 40 ? 'medium' : 'low';
    return { severity, score };
  }

  function generateSummary(text, category, location) {
    const clean = String(text || '').trim().replace(/\s+/g, ' ');
    if (!clean) return 'Add a short description and KOINOS will prepare a concise civic-action summary.';
    const label = ({road:'road / pothole',water:'water / drainage',waste:'garbage / waste',streetlight:'streetlight / electricity'}[category] || category || 'civic issue');
    const place = location && !/^tap the map|choose the exact location/i.test(location) ? ` near ${location.split(' · ')[0]}` : '';
    return `${label[0].toUpperCase() + label.slice(1)} issue${place}: ${clean.slice(0, 180)}${clean.length > 180 ? '…' : ''}. Evidence and exact location can help the responsible civic team verify and act faster.`;
  }

  function renderIntelligence() {
    const box = $('#intelligence-preview');
    if (!box) return;
    const text = $('#description')?.value || '';
    const category = $('#category')?.value || 'other';
    const location = $('#location-note')?.textContent || '';
    const p = predictSeverity(text, category);
    box.innerHTML = `<div class="ki-intel-head"><span>✦ Civic intelligence</span><b class="ki-severity ${p.severity}">${esc(p.severity)} · ${p.score}/100</b></div><div class="ki-intel-grid"><div><small>Severity prediction</small><strong>${esc(p.severity.toUpperCase())}</strong><span>Based on issue type, risk words and community impact.</span></div><div><small>AI-ready summary</small><strong>${esc(generateSummary(text, category, location))}</strong><span>Generated locally for the demo; no personal data is sent for this preview.</span></div></div>`;
  }

  function loadQRScript() {
    return new Promise(resolve => {
      if (window.QRCode) return resolve(true);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
      s.onload = () => resolve(Boolean(window.QRCode));
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function initQR() {
    const host = $('#quick-report-qr');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    const target = `${location.origin}/report.html?quick=1`;
    if (await loadQRScript()) {
      host.innerHTML = '';
      new QRCode(host, { text: target, width: 156, height: 156, colorDark: '#20211f', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    } else {
      host.innerHTML = `<a class="ki-qr-fallback" href="/report.html?quick=1">Open quick report ↗</a>`;
    }
  }

  function init() {
    initQR();
    if ($('#intelligence-preview')) {
      ['input', 'change'].forEach(type => document.addEventListener(type, e => {
        if (e.target?.id === 'description' || e.target?.id === 'category' || e.target?.id === 'search') renderIntelligence();
      }));
      renderIntelligence();
    }
  }

  window.KOINOS_INTELLIGENCE = { predictSeverity, generateSummary, renderIntelligence };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
