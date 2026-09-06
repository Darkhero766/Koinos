/* Route civic requests through Supabase when the optional API service is offline. */
(() => {
  const original = window.fetch.bind(window);
  const response = (body, status=200) => new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json'}});
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = String(init.method || 'GET').toUpperCase();
    if (/koinos-api[^/]*\.onrender\.com\/api\/issues(?:\?|$)/.test(url) && method === 'GET' && window.KOINOS_DB) {
      try { const u=new URL(url),items=await window.KOINOS_DB.listIssues({lat:u.searchParams.get('lat'),lng:u.searchParams.get('lng'),radiusKm:u.searchParams.get('radiusKm')||30}); return response(items); }
      catch(e){ console.warn('Supabase civic read failed; using API fallback:',e); }
    }
    if (/koinos-api[^/]*\.onrender\.com\/api\/issues$/.test(url) && method === 'POST' && window.KOINOS_DB) {
      try { const raw=typeof init.body==='string'?init.body:'{}', body=JSON.parse(raw), item=await window.KOINOS_DB.createIssue(body); return response({...item,similarIssues:[],communityMatch:false},201); }
      catch(e){ console.warn('Supabase civic create failed; using API fallback:',e); }
    }
    if (/koinos-api[^/]*\.onrender\.com\/api\/issues\/[^/]+\/upvote$/.test(url) && method === 'POST' && window.KOINOS_DB) {
      try { const id=url.split('/api/issues/')[1].split('/upvote')[0],item=await window.KOINOS_DB.upvote(id); return response(item); }
      catch(e){ console.warn('Supabase civic vote failed; using API fallback:',e); }
    }
    return original(input, init);
  };
})();
