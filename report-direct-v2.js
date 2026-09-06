/* Direct report submit path for the static deployment. */
(() => {
  const $ = s => document.querySelector(s);
  const message = text => { const el = $('#message'); if (el) el.textContent = text; };
  async function client() { return window.KOINOS_DB?.client?.(); }
  async function compress(file) {
    if (!file) return null;
    if (!file.type?.startsWith('image/')) throw Error('Please choose an image file.');
    if (file.size > 12 * 1024 * 1024) throw Error('Please choose an image under 12 MB.');
    if (/heic|heif/i.test(file.type)) throw Error('HEIC/HEIF is not supported by this browser. Choose a JPG, PNG or WebP copy from Files.');
    const url=URL.createObjectURL(file), img=new Image();
    try {
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
      const max=1600, scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)), canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Image processor unavailable.');ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.68));
      return blob?new File([blob],`koinos-${Date.now()}.jpg`,{type:'image/jpeg'}):file;
    } finally { URL.revokeObjectURL(url); }
  }
  async function upload(file) {
    if(!file)return null;const c=await client();if(!c)throw Error('Supabase is not configured.');
    const prepared=await compress(file),user=(await c.auth.getUser()).data?.user||null;
    const device=localStorage.getItem('koinos-device-id')||(crypto.randomUUID?.()||String(Date.now()));localStorage.setItem('koinos-device-id',device);
    const folder=user?.id||`anonymous/${device}`,path=`${folder}/${Date.now()}-${prepared.name.replace(/[^a-zA-Z0-9._-]/g,'-')}`;
    const {error}=await c.storage.from('issue-images').upload(path,prepared,{contentType:'image/jpeg',cacheControl:'31536000',upsert:false});
    if(error)throw Error(`Photo upload failed: ${error.message}`);
    return c.storage.from('issue-images').getPublicUrl(path).data.publicUrl;
  }
  async function reverse(p){try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}`,{headers:{'Accept-Language':'en'}});const x=await r.json();return x.display_name||'Pinned location';}catch{return'Pinned location';}}
  document.addEventListener('DOMContentLoaded',()=>{
    const input=$('#photo'),button=$('.photo-picker-button');
    button?.addEventListener('click',e=>{e.preventDefault();input?.click();});
    document.addEventListener('click',async e=>{
      const submit=e.target.closest?.('#submit');if(!submit)return;e.preventDefault();e.stopImmediatePropagation();
      const desc=$('#description')?.value.trim(),category=$('#category')?.value||'other',note=$('#location-note')?.textContent||'';
      const coords=note.match(/(-?\d+(?:\.\d+)?)[^\d-]+(-?\d+(?:\.\d+)?)(?:\s*$)/),p=coords?{lat:Number(coords[1]),lng:Number(coords[2])}:null;
      if(!desc){message('Add a short description.');return;}if(!p){message('Choose the exact location on the map.');return;}
      submit.disabled=true;message('Saving securely…');
      try{const photoUrl=await upload(input?.files?.[0]||null),row=await window.KOINOS_DB.createIssue({title:desc.slice(0,70),description:desc,category,latitude:p.lat,longitude:p.lng,locationLabel:await reverse(p),anonymous:$('#anonymous')?.checked,photoUrl});message(`Report saved ✓ ${row.title}. ${row.anonymous?'Submitted anonymously.':'Linked to your account.'} Open Track to follow it.`);submit.textContent='Report saved ✓';}
      catch(err){console.error(err);message(err?.message||'Could not save the report. Please try again.');submit.disabled=false;}
    },true);
  });
})();
