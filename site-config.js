/* KOINOS browser configuration. No secrets belong here. */
window.KOINOS_CONFIG = {
  // The frontend tries these in order so a Render service rename does not break the site.
  apiCandidates: [
    window.KOINOS_API_BASE,
    'https://koinos-api-5v03.onrender.com',
    'https://koinos-api.onrender.com'
  ].filter(Boolean),
  photoBucket: 'issue-images'
};
