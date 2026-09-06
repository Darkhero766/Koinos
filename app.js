const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const toast = (message) => {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => node.classList.remove("show"), 3200);
};

// The report flow is intentionally short enough to complete on a phone.
const modal = $("#report-modal");
const steps = $$(".report-step");
let currentStep = 1;
const setStep = (step) => {
  currentStep = step;
  steps.forEach((item) => item.classList.toggle("active", Number(item.dataset.step) === step));
  $("#modal-step").textContent = `0${step} / 04`;
  $("#modal-progress-bar").style.width = `${step * 25}%`;
  if (step === 4) {
    $("#ai-loading").style.display = "block";
    $("#ai-result").classList.remove("show");
    setTimeout(() => {
      $("#ai-loading").style.display = "none";
      $("#ai-result").classList.add("show");
    }, 1800);
  }
};
const openModal = () => {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  setStep(1);
  $("#modal-success").classList.remove("show");
};
const closeModal = () => {
  modal.hidden = true;
  document.body.style.overflow = "";
};
$$(".report-trigger").forEach((button) => button.addEventListener("click", openModal));
$(".modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
$$(".modal-next").forEach((button) => button.addEventListener("click", () => setStep(Math.min(4, currentStep + 1))));
$("#take-photo").addEventListener("click", () => {
  $("#file-name").textContent = "Photo ready to analyze";
  $("#take-photo").textContent = "Retake photo";
  toast("Photo captured in demo mode.");
});
$("#photo-upload").addEventListener("change", (event) => {
  if (event.target.files?.[0]) $("#file-name").textContent = event.target.files[0].name;
});
$$("[data-suggestion]").forEach((button) => button.addEventListener("click", () => {
  const input = $("#report-description");
  input.value = input.value ? `${input.value} ${button.dataset.suggestion}.` : `${button.dataset.suggestion}.`;
  input.focus();
}));
$(".join-issue-button").addEventListener("click", () => {
  $$(".report-step").forEach((item) => item.classList.remove("active"));
  $("#modal-success").classList.add("show");
});
$(".separate-button").addEventListener("click", () => {
  toast("Your separate report has been saved for this demo.");
  closeModal();
});
$(".close-success").addEventListener("click", closeModal);

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
  card.querySelector(".issue-tag").textContent = issue.tag;
  card.querySelector(".issue-tag").className = `issue-tag ${issue.tagClass}`;
  card.querySelector(".issue-panel-top .mono").textContent = issue.days;
  card.querySelector("h3").textContent = issue.title;
  card.querySelector("> p").textContent = issue.location;
  const metrics = $$(".issue-metrics strong", card);
  [issue.affected, issue.priority, issue.reports].forEach((value, index) => { metrics[index].textContent = value; });
  $$(".big-marker").forEach((marker) => marker.classList.toggle("selected", marker.dataset.mapIssue === key));
  $(".issue-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
};
$$("[data-map-issue]").forEach((control) => control.addEventListener("click", () => selectIssue(control.dataset.mapIssue)));
$$(".filter-button").forEach((button) => button.addEventListener("click", () => {
  $$(".filter-button").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  const filter = button.dataset.filter;
  const mapKey = filter === "all" || filter === "roads" ? "pothole" : filter;
  selectIssue(mapKey);
  toast(filter === "all" ? "Showing everything near you." : `Showing ${button.textContent.toLowerCase()} issues.`);
}));
$(".issue-detail-button").addEventListener("click", () => toast("Issue story opened — this demo keeps you on the neighborhood map."));

let affected = 47;
$(".support-button").addEventListener("click", (event) => {
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
  $(".damaged").style.width = `${comparison.value}%`;
  $(".slider-handle").style.left = `${comparison.value}%`;
};
comparison.addEventListener("input", updateComparison);

$$(".verify-button").forEach((button) => button.addEventListener("click", () => {
  $(".verified-message").classList.add("show");
  $(".proof-actions").style.opacity = ".55";
  toast(button.classList.contains("verify-button") && button.textContent.includes("resolved") ? "Thanks — the community has verified this repair." : "Thanks — we’ll keep this issue open.");
}));

$(".merge-button").addEventListener("click", () => {
  $(".shared-issue").classList.add("is-merging");
  $(".merge-button").innerHTML = "37 reports merged <span>✓</span>";
  toast("37 reports became one shared community issue.");
  setTimeout(() => $(".shared-issue").classList.remove("is-merging"), 900);
});
$$("[data-toast]").forEach((button) => button.addEventListener("click", () => toast(button.dataset.toast)));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeModal();
});