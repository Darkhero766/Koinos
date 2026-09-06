(() => {
  const c = window.KOINOS_SUPABASE || {};
  const configured = Boolean(c.url && !c.url.startsWith('PASTE_') && c.anonKey && !c.anonKey.startsWith('PASTE_'));
  let client = null;
  let initPromise = null;

  const load = url => new Promise((resolve, reject) => {
    const existing = document.querySelector('[data-koinos-supabase-sdk]');
    if (existing) {
      if (window.supabase) return resolve();
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = url;
    s.dataset.koinosSupabaseSdk = '1';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Supabase client could not load.'));
    document.head.appendChild(s);
  });

  async function init() {
    if (!configured) return null;
    if (client) return client;
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (!window.supabase) await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
      client = window.supabase.createClient(c.url, c.anonKey, {
        auth: {
          // Explicitly pin the browser session to one KOINOS key. This prevents
          // different pages (Home/Live/Track/Account) from behaving like separate
          // auth clients and keeps the login when navigating between them.
          storageKey: 'koinos-auth-session',
          storage: window.localStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      });
      window.KOINOS_AUTH = {
        client,
        getSession: () => client.auth.getSession(),
        getUser: async () => (await client.auth.getUser()).data?.user || null,
        getAccessToken: async () => (await client.auth.getSession()).data?.session?.access_token || null,
      };
      return client;
    })();
    try { return await initPromise; } catch (e) { initPromise = null; throw e; }
  }

  window.KOINOS_AUTH_READY = init();
  window.KOINOS_AUTH_CONFIGURED = configured;

  async function updateHeader() {
    const emailEl = document.querySelector('[data-user-email]');
    const signInEls = [...document.querySelectorAll('[data-signin]')];
    const signOutEls = [...document.querySelectorAll('[data-signout]')];
    try {
      const c = await window.KOINOS_AUTH_READY;
      if (!c) {
        emailEl && (emailEl.textContent = 'Guest');
        signInEls.forEach(x => x.classList.remove('hidden'));
        signOutEls.forEach(x => x.classList.add('hidden'));
        return;
      }
      const { data: { session } } = await c.auth.getSession();
      const signedIn = Boolean(session?.user);
      emailEl && (emailEl.textContent = session?.user?.email || 'Guest');
      signInEls.forEach(x => x.classList.toggle('hidden', signedIn));
      signOutEls.forEach(x => x.classList.toggle('hidden', !signedIn));
    } catch (e) {
      console.warn('KOINOS auth header:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const c = await window.KOINOS_AUTH_READY;
    await updateHeader();
    if (c) {
      const { data: { subscription } } = c.auth.onAuthStateChange(() => {
        setTimeout(updateHeader, 0);
      });
      window.addEventListener('pagehide', () => subscription.unsubscribe(), { once: true });
      // Safari/iPad can suspend a tab and restore it later. Re-read the persisted
      // session when the page becomes visible instead of treating the suspension
      // as a logout.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') setTimeout(updateHeader, 50);
      });
    }
    document.addEventListener('click', async e => {
      const button = e.target.closest?.('[data-signout]');
      if (!button) return;
      e.preventDefault();
      button.disabled = true;
      try {
        const client = await window.KOINOS_AUTH_READY;
        if (client) await client.auth.signOut();
      } finally {
        button.disabled = false;
        await updateHeader();
      }
    });
  });
})();
