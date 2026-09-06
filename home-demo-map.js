(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;' }[c]));
  const DELHI = [28.6139, 77.2090];

  // Demo/reference records intentionally mirror the public Delhi examples used
  // on Live issues. They are labelled as demo/public references, never as user reports.
  const DEMO = [
    { id:'home-public-sonia-vihar', title:'Waterlogged & damaged road', severity:'high', status:'reported', priority:91, upvotes:63, latitude:28.7117, longitude:77.2452, locationLabel:'Sonia Vihar · Main 25-Foot Road', sourceLabel:'Public case · Aug 2026', sourceUrl:'https://timesofindia.indiatimes.com/city/delhi/delhi-schoolchildren-struggle-through-waterlogged-broken-roads/articleshow/133531416.cms', referencePhotoUrl:'https://images.hindustantimes.com/rf/image_size_640x362/HT/p2/2016/08/31/Pictures/rain_d16e2974-6f48-11e6-a062-3948ff2071e9.jpg', referencePhotoCredit:'Delhi waterlogging reference · Hindustan Times' },
    { id:'home-public-chandni', title:'Repeated road digging / utility works', severity:'medium', status:'in_progress', priority:76, upvotes:41, latitude:28.6508, longitude:77.2303, locationLabel:'Chandni Chowk · Esplanade Road', sourceLabel:'Public case · Sep 2026', sourceUrl:'https://indianexpress.com/article/cities/delhi/eye-on-curbing-repeated-road-digging-delhi-plans-multi-utility-underground-ducts-10862364/', referencePhotoUrl:'https://swarajya.gumlet.io/swarajya/2025-11-08/e0oagg2y/G4wpDy7W4AAjx3-1.jpeg?compress=true&format=auto&q=75&w=610', referencePhotoCredit:'Chandni Chowk road-work reference · Swarajya' },
    { id:'home-public-route', title:'Potholes & street-light defects flagged', severity:'high', status:'reported', priority:88, upvotes:52, latitude:28.6242, longitude:77.2066, locationLabel:'Central Delhi · BRICS route', sourceLabel:'Public case · Sep 2026', sourceUrl:'https://navbharattimes.indiatimes.com/metro/delhi/development/brics-summit-route-delhi-traffic-police-ask-civic-agencies-to-fix-roads/articleshow/133804957.cms', referencePhotoUrl:'https://static.toiimg.com/thumb/msid-122031415%2Cwidth-1070%2Cheight-580%2Cimgsize-94080%2Cresizemode-6%2Coverlay-toi_sw%2Cpt-32%2Cy_pad-40/photo.jpg', referencePhotoCredit:'Delhi pothole reference · Times of India' },
    { id:'home-public-minto', title:'Flooded underpass / drainage complaint', severity:'high', status:'reported', priority:84, upvotes:37, latitude:28.6368, longitude:77.2273, locationLabel:'Minto Road · Underpass', sourceLabel:'Public case reference · Aug 2026', sourceUrl:'https://indianexpress.com/photos/india-news/in-photos-heavy-rain-lashes-delhi-triggers-waterlogging-and-traffic-jams/', referencePhotoUrl:'https://images.hindustantimes.com/rf/image_size_640x362/HT/p2/2016/08/31/Pictures/rain_d16e2974-6f48-11e6-a062-3948ff2071e9.jpg', referencePhotoCredit:'Delhi waterlogging reference · public case image' }
  ];

  const colour = sev => sev === 'high' ? '#ef3f35' : sev === 'medium' ? '#f59b35' : '#39b878';
  const pinIcon = (L, sev) => L.divIcon({ className:'koinos-pin-wrap', iconSize:[34,42], iconAnchor:[17,40], popupAnchor:[0,-34], html:`<span class="koinos-pin" style="--pin:${colour(sev)}"><i></i></span>` });

  function popup(i) {
    const img = i.referencePhotoUrl ? `<img class="koinos-demo-popup-image" src="${esc(i.referencePhotoUrl)}" alt="${esc(i.title)} reference image" loading="lazy" referrerpolicy="no-referrer">` : '';
    return `<div class="koinos-demo-popup">
      ${img}
      <div class="koinos-demo-popup-body">
        <div class="koinos-demo-popup-kicker"><span class="koinos-demo-badge ${i.severity}">${esc(i.severity)} · ${esc(i.status)}</span><span>${Number(i.priority)}/100</span></div>
        <h3>${esc(i.title)}</h3>
        <p class="koinos-demo-location">⌖ ${esc(i.locationLabel)}</p>
        <div class="koinos-demo-stats"><strong>${Number(i.upvotes)}</strong><span>supporters</span><span>•</span><span>Delhi demo reference</span></div>
        <div class="koinos-demo-source"><span>${esc(i.sourceLabel)}</span><a href="${esc(i.sourceUrl)}" target="_blank" rel="noopener noreferrer">Case source ↗</a></div>
        <p class="koinos-demo-note">Reference image only — not an exact KOINOS user-uploaded case photo.</p>
      </div>
    </div>`;
  }

  function withinDelhi(p) {
    return p && p.lat > 28.35 && p.lat < 28.9 && p.lng > 76.8 && p.lng < 77.6;
  }

  async function getPosition() {
    if (!navigator.geolocation) return null;
    return new Promise(resolve => navigator.geolocation.getCurrentPosition(
      p => resolve({lat:p.coords.latitude,lng:p.coords.longitude}),
      () => resolve(null),
      { enableHighAccuracy:false, timeout:4500, maximumAge:60000 }
    ));
  }

  async function init() {
    const host = $('.hero-visual');
    if (!host || !window.L) return;
    await new Promise(r => setTimeout(r, 80));

    // live-core creates the first map; replace only the home visual with the
    // richer demo map so the rest of the live/report logic remains untouched.
    host.innerHTML = '<div id="koinos-home-demo-map" class="koinos-home-demo-map"></div><div class="koinos-home-map-chip"><span></span>Delhi · civic reports</div><div class="koinos-home-map-legend"><b><i class="high"></i>High</b><b><i class="medium"></i>Medium</b><b><i class="low"></i>Low</b></div>';
    const map = L.map('koinos-home-demo-map', { zoomControl:false, scrollWheelZoom:false, dragging:true, doubleClickZoom:true }).setView(DELHI, 12.5);
    L.control.zoom({ position:'topright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© OpenStreetMap contributors' }).addTo(map);

    const user = await getPosition();
    if (withinDelhi(user)) {
      L.circleMarker([user.lat,user.lng], { radius:7, weight:3, fillOpacity:1 }).addTo(map).bindPopup('<strong>Your live location</strong><br><span style="color:#777">Demo civic reports are shown around Delhi.</span>');
      map.setView([user.lat,user.lng], 13.2);
    }

    DEMO.forEach(i => {
      const m = L.marker([i.latitude,i.longitude], { icon:pinIcon(L,i.severity), zIndexOffset:i.severity==='high'?300:i.severity==='medium'?200:100 }).addTo(map);
      m.bindPopup(popup(i), { maxWidth:390, minWidth:310, className:'koinos-demo-popup-container', closeButton:true, autoPan:true });
    });

    // Keep the four pins visible together when the user has not shared a Delhi location.
    if (!withinDelhi(user)) map.fitBounds(L.latLngBounds(DEMO.map(i => [i.latitude,i.longitude])), { padding:[34,34], maxZoom:13 });
    setTimeout(() => map.invalidateSize(), 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
