/* KOINOS UI fixes: resilient demo pins + responsive live map presentation. */
(() => {
  const DEMO_ISSUES = [
    { id:'public-2026-sonia-vihar', title:'Waterlogged & damaged road', severity:'high', status:'reported', priority:91, upvotes:63, lat:28.7117, lng:77.2452, location:'Sonia Vihar · Main 25-Foot Road' },
    { id:'public-2026-chandni-chowk', title:'Repeated road digging / utility works', severity:'medium', status:'in_progress', priority:76, upvotes:41, lat:28.6508, lng:77.2303, location:'Chandni Chowk · Esplanade Road' },
    { id:'public-2026-route-safety', title:'Potholes & street-light defects flagged', severity:'high', status:'reported', priority:88, upvotes:52, lat:28.6242, lng:77.2066, location:'Central Delhi · BRICS route' }
  ];

  const css = `
    /* Live map: keep the map in a predictable box instead of letting the grid stretch it. */
    #live-map { width:100%; height:clamp(420px, 68vh, 680px); min-height:420px; overflow:hidden; }
    .map-wrap { min-width:0; height:fit-content; overflow:hidden; }
    .map-wrap .map-status { z-index:700; max-width:calc(100% - 28px); }
    .issue-img { display:block; width:100%; height:220px; max-height:220px; object-fit:cover; object-position:center; border-radius:14px; }
    .street-photo { height:210px; }
    @media (min-width: 1000px) {
      .grid:has(#live-map) { grid-template-columns:minmax(0, 1.25fr) minmax(360px, .75fr); align-items:start; }
      .grid:has(#live-map) .panel-pad { max-height:680px; overflow:auto; }
    }
    @media (max-width: 999px) {
      #live-map { height:58vh; min-height:360px; max-height:620px; }
      .grid:has(#live-map) { grid-template-columns:1fr; }
    }
    @media (max-width: 640px) {
      #live-map { height:52vh; min-height:320px; max-height:500px; }
      .issue-img { height:190px; max-height:190px; }
    }
    .koinos-demo-marker { background:transparent; border:0; }
    .koinos-demo-marker span { display:block; width:18px; height:18px; border-radius:50%; background:#d7f52c; border:3px solid #20211f; box-shadow:0 0 0 5px rgba(215,245,44,.25), 0 4px 12px rgba(0,0,0,.22); animation:koinos-pin-pulse 2s ease-out infinite; }
    .koinos-demo-popup { min-width:210px; line-height:1.35; }
    .koinos-demo-popup strong { display:block; font-size:15px; margin-bottom:4px; }
    .koinos-demo-popup small { color:#777; }
    .koinos-demo-popup a { display:inline-block; margin-top:9px; font-weight:700; color:#20211f; text-decoration:none; }
    @keyframes koinos-pin-pulse { 0%,100% { box-shadow:0 0 0 4px rgba(215,245,44,.22),0 4px 12px rgba(0,0,0,.22); } 50% { box-shadow:0 0 0 9px rgba(215,245,44,0),0 4px 14px rgba(0,0,0,.25); } }
    @media (prefers-reduced-motion: reduce) { .koinos-demo-marker span { animation:none; } }
  `;

  function addStyle() {
    if (document.getElementById('koinos-ui-fixes')) return;
    const s = document.createElement('style'); s.id='koinos-ui-fixes'; s.textContent=css; document.head.appendChild(s);
  }

  function popup(i) {
    return `<div class="koinos-demo-popup"><strong>${i.title}</strong><div>${i.location}</div><div><b>${i.upvotes}</b> supporters · ${i.priority}/100 priority</div><small>Public Delhi case reference · demo data</small><br><a href="/live.html#${encodeURIComponent(i.id)}">View in Live issues ↗</a></div>`;
  }

  function installHomePins() {
    if (!window.L || installHomePins.done) return;
    installHomePins.done = true;
    const originalMarker = window.L.marker;
    const originalAddLayer = window.L.Map.prototype.addLayer;
    let installedForHome = false;

    window.L.Map.prototype.addLayer = function(layer) {
      const result = originalAddLayer.call(this, layer);
      try {
        if (!installedForHome && this._container?.id === 'koinos-home-map') {
          installedForHome = true;
          const map = this;
          // Wait until the existing home map has finished adding its normal markers.
          setTimeout(() => {
            DEMO_ISSUES.forEach(i => {
              const m = originalMarker.call(window.L, [i.lat, i.lng], {
                icon: window.L.divIcon({ className:'koinos-demo-marker', html:'<span></span>', iconSize:[24,24], iconAnchor:[12,12] })
              }).addTo(map);
              m.bindPopup(popup(i));
            });
          }, 250);
        }
      } catch (e) { console.warn('KOINOS demo pins:', e); }
      return result;
    };

    // If the home map already exists, add pins immediately.
    const existing = document.getElementById('koinos-home-map');
    if (existing && existing._leaflet_id) {
      const maps = [];
      // Leaflet doesn't expose a public map registry, so use the same hook on future layers.
    }
  }

  function hashOpenLiveIssue() {
    if (!location.pathname.endsWith('/live.html') && !location.pathname.endsWith('live.html')) return;
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const target = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (target) { target.scrollIntoView({ behavior:'smooth', block:'center' }); target.click(); }
  }

  function boot() {
    addStyle();
    const wait = () => {
      if (window.L) installHomePins();
      else setTimeout(wait, 150);
    };
    wait();
    setTimeout(hashOpenLiveIssue, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
