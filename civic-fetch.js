/* Route civic read/support requests through Supabase when the optional API service is offline. */
(() => {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (/koinos-api[^/]*\.onrender\.com\/api\/issues(?:\?|$)/.test(url) && String(init.method || 'GET').toUpperCase() === 'GET' && window.KOINOS_DB) {
      try {
        const u = new URL(url), items = await window.KOINOS_DB.listIssues({lat:u.searchParams.get('lat'),lng:u.searchParams.get('lng'),radiusKm:u.searchParams.get('radiusKm')||30});
        return new Response(JSON.stringify(items), {status:200,headers:{'Content-Type':'application/json'}});
      } catch (e) { console.warn('Supabase civic read failed; using API fallback:', e); }
    }
    if (/koinos-api[^/]*\.onrender\.com\/api\/issues\/[^/]+\/upvote$/.test(url) && String(init.method || 'GET').toUpperCase() === 'POST' && window.KOINOS_DB) {
      try { const id=url.split('/api/issues/')[1].split('/upvote')[0], item=await window.KOINOS_DB.upvote(id); return new Response(JSON.stringify(item),{status:200,headers:{'Content-Type':'application/json'}}); }
      catch (e) { console.warn('Supabase civic vote failed; using API fallback:', e); }
    }
    return original(input, init);
  };
})();
