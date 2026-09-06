const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Load the visual polish layer after the existing stylesheet so the current build stays intact.
(() => {
  if (!document.querySelector('link[data-koinos-polish]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/hackathon-polish.css';
    link.dataset.koinosPolish = 'true';
    document.head.appendChild(link);
  }
})();

const toast = (message) => {
  const node = $("#toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => node.classList.remove("show"), 3200);
};

// Mobile navigation: simple, thumb-friendly, and always one tap away.
(() => {
  if ($('.koinos-mobile-nav')) return;
  const nav = document.createElement('nav');
  nav.className = 'koinos-mobile-nav';
  nav.setAttribute('aria-label', 'Mobile navigation');
  nav.innerHTML = `
    <button type="button" data-mobile-target="#top" class="active"><span>⌂</span>Home</button>
    <button type="button" data-mobile-target="#explore"><span>⌖</span>Map</button>
    <button type="button" data-mobile-report class="report-nav"><span>＋</span>Report</button>
    <button type="button" data-mobile-target="#how-it-works"><span>◌</span>How it works</button>
    <button type="button" data-mobile-target="#impact"><span>↗</span>Impact</button>`;
  document.body.appendChild(nav);
  nav.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-mobile-report')) {
      const trigger = $('.report-trigger');
      if (trigger) trigger.click();
      return;
    }
    const target = button.dataset.mobileTarget;
    if (target) document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $$('.koinos-mobile-nav button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
  });
})();

// Small contextual rail gives the demo a polished, product-like response.
const demoRail = document.createElement('div');
demoRail.className = 'koinos-demo-rail';
demoRail.textContent = 'KOINOS · LIVE CIVIC DEMO';
document.body.appendChild(demoRail);
const showDemoRail = () => {
  demoRail.classList.add('show');
  clearTimeout(window.demoRailTimer);
  window.demoRailTimer = setTimeout(() => demoRail.classList.remove('show'), 2200);
};

// Reveal sections as the visitor scrolls through the story.
(() => {
  const targets = $$('.pulse-card, .merge-stage, .stats-strip, .report-callout, .steps-row, .explore-layout, .community-visual, .priority-layout, .proof-section, .health-section, .final-cta');
  if (!('IntersectionObserver' in window)) return;
  targets.forEach((node) => node.classList.add('koinos-reveal'));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  targets.forEach((node) => observer.observe(node));
})();

// The report flow is intentionally short enough to complete on a phone.
const modal = $("#report-modal");
const steps = $$(".report-step");
let currentStep = 1;
const setStep = (step) => {
  currentStep = step;
  steps.forEach((item) => item.classList.toggle("active", Number(item.dataset.step) === step));
  const modalStep = $("#modal-step");
  const progress = $("#modal-progress-bar");
  if (modalStep) modalStep.textContent = `0${step} / 04`;
  if (progress) progress.style.width = `${step * 25}%`;
  if (step === 4) {
    const loading = $("#ai-loading");
    const result = $("#ai-result");
    if (loading) loading.style.display = "block";
    if (result) result.classList.remove("show");
    clearTimeout(window.aiTimer);
    window.aiTimer = setTimeout(() => {
      if (loading) loading.style.display = "none";
      if (result) result.classList.add("show");
      showDemoRail();
    }, 1800);
  }
};
const openModal = () => {
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  setStep(1);
  $("#modal-success")?.classList.remove("show");
  setTimeout(() => $("#take-photo")?.focus(), 40);
};
const closeModal = () => {
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
};
$$(".report-trigger").forEach((button) => button.addEventListener("click", openModal));
$(".modal-close")?.addEventListener("click", closeModal);
modal?.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
$$(".modal-next").forEach((button) => button.addEventListener("click", () => setStep(Math.min(4, currentStep + 1))));

// Use the actual file picker/camera on supported devices, while keeping demo fallback copy.
const photoUpload = $("#photo-upload");
if (photoUpload) {
  photoUpload.setAttribute('accept', 'image/*');
  photoUpload.setAttribute('capture', 'environment');
}
$("#take-photo")?.addEventListener("click", () => {
  if (photoUpload) {
    photoUpload.click();
    return;
  }
  $("#file-name").textContent = "Photo ready to analyze";
  $("#take-photo").textContent = "Retake photo";
  toast("Photo captured in demo mode.");
});
photoUpload?.addEventListener("change", (event) => {
  if (event.target.files?.[0]) {
    $("#file-name").textContent = event.target.files[0].name;
    $("#take-photo").textContent = "Retake photo";
    toast("Photo ready. KOINOS can analyze it.");
  }
});
$$("[data-suggestion]").forEach((button) => button.addEventListener("click", () => {
  const input = $("#report-description");
  if (!input) return;
  input.value = input.value ? `${input.value} ${button.dataset.suggestion}.` : `${button.dataset.suggestion}.`;
  input.focus();
}));
$(".join-issue-button")?.addEventListener("click", () => {
  $$(".report-step").forEach((item) => item.classList.remove("active"));
  $("#modal-success")?.classList.add("show");
  showDemoRail();
});
$(".separate-button")?.addEventListener("click", () => {
  toast("Your separate report has been saved for this demo.");
  closeModal();
});
$(".close-success")?.addEventListener("click", closeModal);

// Neighborhood map: markers and list rows share one simple issue state.
const issueData = {
  pothole: { tag: "High priority", tagClass: "tag-red", days: "11 days", title: "Large pothole", location: "MG Road, near 12th Main", affected: "47", priority: "89", reports: "14" },
  water: { tag: "Water", tagClass: "tag-blue", days: "6 days", title: "Water leak", location: "12th Main, near the park", affected: "18", priority: "87", reports: "8" },
  waste: { tag: "Waste", tagClass: "tag-yellow", days: "3 days", title: "Overflowing waste", location: "100 Ft Road, 3rd Cross", affected: "32", priority: "76", reports: "11" },
  streetlights: { tag: "Streetlights", tagClass: "tag-yellow", days: "9 days", title: "Broken streetlight", location: "100 Ft Road, by the bus stop", affected: "23", priority: "81", reports: "9" }
};
const selectIssue = (key) => {
  const issue = issueData[key] || issueData.pothole;
  const card = $("#selected-issue");
  if (!card) return;
  const tag = card.querySelector(".issue-tag");
  if (tag) {
    tag.textContent = issue.tag;
    tag.className = `issue-tag ${issue.tagClass}`;
  }
  card.querySelector(".issue-panel-top .mono")?.replaceChildren(document.createTextNode(issue.days));
  card.querySelector("h3")?.replaceChildren(document.createTextNode(issue.title));
  card.querySelector("> p")?.replaceChildren(document.createTextNode(issue.location));
  const metrics = $$(".issue-metrics strong", card);
  [issue.affected, issue.priority, issue.reports].forEach((value, index) => { if (metrics[index]) metrics[index].textContent = value; });
  $$(".big-marker").forEach((marker) => marker.classList.toggle("selected", marker.dataset.mapIssue === key));
  if (window.innerWidth < 901) $(".issue-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
};
$$("[data-map-issue]").forEach((control) => control.addEventListener("click", () => {
  selectIssue(control.dataset.mapIssue);
  showDemoRail();
}));
$$(".filter-button").forEach((button) => button.addEventListener("click", () => {
  $$(".filter-button").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  const filter = button.dataset.filter;
  const mapKey = filter === "all" || filter === "roads" ? "pothole" : filter;
  selectIssue(mapKey);
  toast(filter === "all" ? "Showing everything near you." : `Showing ${button.textContent.toLowerCase()} issues.`);
}));
$(".issue-detail-button")?.addEventListener("click", () => {
  document.querySelector('.issue-panel')?.classList.add('koinos-detail-focus');
  toast("Issue story opened — evidence, community, and what happens next.");
});

// Lightweight map zoom interaction — visual only, with no external map dependency.
let mapScale = 1;
$$(".map-zoom button").forEach((button) => button.addEventListener("click", () => {
  mapScale = Math.max(.88, Math.min(1.18, mapScale + (button.textContent.trim() === '+' ? .08 : -.08)));
  const surface = $("#big-map");
  if (surface) surface.style.setProperty('--map-scale', mapScale);
  surface?.classList.add('zooming');
  setTimeout(() => surface?.classList.remove('zooming'), 220);
  toast(mapScale > 1 ? 'Zoomed in.' : mapScale < 1 ? 'Zoomed out.' : 'Map reset.');
}));

let affected = 47;
$(".support-button")?.addEventListener("click", (event) => {
  if (event.currentTarget.dataset.supported) return;
  affected += 1;
  $("#affected-count").textContent = affected;
  $(".support-note").textContent = `${affected} people have confirmed this problem.`;
  event.currentTarget.dataset.supported = "true";
  event.currentTarget.innerHTML = "You’re affected too <span>✓</span>";
  toast("Your voice was added to this community issue.");
});

const comparison = $(".comparison-slider");
const updateComparison = () => {
  if (!comparison) return;
  $(".damaged").style.width = `${comparison.value}%`;
  $(".slider-handle").style.left = `${comparison.value}%`;
};
comparison?.addEventListener("input", updateComparison);
updateComparison();

$$(".verify-button").forEach((button) => button.addEventListener("click", () => {
  $(".verified-message")?.classList.add("show");
  if ($(".proof-actions")) $(".proof-actions").style.opacity = ".55";
  const resolved = button.textContent.toLowerCase().includes("resolved");
  toast(resolved ? "Thanks — the community has verified this repair." : "Thanks — we’ll keep this issue open.");
}));

$(".merge-button")?.addEventListener("click", () => {
  $(".shared-issue")?.classList.add("is-merging");
  $(".merge-button").innerHTML = "37 reports merged <span>✓</span>";
  toast("37 reports became one shared community issue.");
  showDemoRail();
  setTimeout(() => $(".shared-issue")?.classList.remove("is-merging"), 900);
});
$$("[data-toast]").forEach((button) => button.addEventListener("click", () => toast(button.dataset.toast)));

// Demo button should actually take the judge into the product rather than just showing a toast.
$(".demo-button")?.addEventListener("click", () => {
  $("#explore")?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showDemoRail();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal && !modal.hidden) closeModal();
});

// Quick-report QR modal: lets a printed sign or noticeboard link straight into the report flow.
const qrModal = $("#qr-modal");
const buildQrUrl = () => {
  const target = `${window.location.origin}${window.location.pathname}#report`;
  const params = new URLSearchParams({ size: "220x220", data: target, margin: "8" });
  return { image: `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`, target };
};
const openQrModal = () => {
  if (!qrModal) return;
  const { image, target } = buildQrUrl();
  const img = $("#qr-code-image");
  if (img) img.src = image;
  const download = $("#qr-download");
  if (download) download.href = image;
  qrModal.dataset.link = target;
  qrModal.hidden = false;
  document.body.style.overflow = "hidden";
};
const closeQrModal = () => {
  if (!qrModal) return;
  qrModal.hidden = true;
  document.body.style.overflow = "";
};
$(".qr-trigger")?.addEventListener("click", openQrModal);
qrModal?.querySelector(".modal-close")?.addEventListener("click", closeQrModal);
qrModal?.addEventListener("click", (event) => { if (event.target === qrModal) closeQrModal(); });
$("#qr-copy-link")?.addEventListener("click", async () => {
  const link = qrModal?.dataset.link || "";
  try {
    await navigator.clipboard.writeText(link);
    toast("Quick-report link copied.");
  } catch {
    toast(link);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && qrModal && !qrModal.hidden) closeQrModal();
});

// Anonymous reporting: keeps the reporter's identity out of the community-facing copy.
const anonymousToggle = $("#anonymous-toggle");
const isAnonymous = () => Boolean(anonymousToggle?.checked);
const successCopy = $("#modal-success p");
const successCopyDefault = successCopy?.textContent;
$$(".modal-next, .join-issue-button").forEach((button) => button.addEventListener("click", () => {
  if (!successCopy || !successCopyDefault) return;
  successCopy.textContent = isAnonymous()
    ? "Your anonymous report joined 37 others. KOINOS will keep the thread posted without sharing who reported it."
    : successCopyDefault;
}));

// Analytics dashboard: numbers count up once they're on screen, like a real reporting dashboard.
(() => {
  const stats = $$(".analytics-stat strong[data-count-to]");
  if (!stats.length) return;
  const animate = (node) => {
    const target = Number(node.dataset.countTo || 0);
    const suffix = node.dataset.suffix || "";
    const duration = 900;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = `${Math.round(target * eased)}${suffix}`;
      if (progress < 1) requestAnimationFrame(step);
      else node.textContent = `${target}${suffix}`;
    };
    requestAnimationFrame(step);
  };
  if (!('IntersectionObserver' in window)) { stats.forEach(animate); return; }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { animate(entry.target); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.4 });
  stats.forEach((node) => observer.observe(node));
})();

// Optional backend integration: if a KOINOS API is configured, mirror new reports to it.
// The demo works fully offline without this — see /server for the reference Express API.
window.KOINOS_API_BASE = window.KOINOS_API_BASE || null;
const submitToBackend = async (payload) => {
  if (!window.KOINOS_API_BASE) return;
  try {
    await fetch(`${window.KOINOS_API_BASE}/api/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    // Backend is optional for the demo; fail silently and keep the front-end flow uninterrupted.
  }
};
$$(".join-issue-button, .separate-button").forEach((button) => button.addEventListener("click", () => {
  submitToBackend({
    description: $("#report-description")?.value || "",
    anonymous: isAnonymous(),
    category: "unclassified",
    createdAt: new Date().toISOString()
  });
}));
