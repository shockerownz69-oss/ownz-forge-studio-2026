// Staged only. Owner token is never stored in localStorage or frontend source.
let loginPending = null;
function requestOwnerToken() {
  return new Promise((resolve, reject) => {
    const shade = document.createElement('div');
    shade.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000d;display:grid;place-items:center;padding:16px';
    const form = document.createElement('form');
    form.style.cssText = 'background:#181818;color:white;border:2px solid #b22;padding:24px;border-radius:12px;max-width:420px;width:100%;display:grid;gap:12px;font:16px system-ui';
    const heading = document.createElement('strong');heading.textContent = 'OWNZ FORGE — OWNER SIGN IN';
    const field = document.createElement('input');field.type='password';field.required=true;field.autocomplete='current-password';field.placeholder='Owner password';field.style.cssText='padding:12px;font:inherit;min-height:44px';
    const error = document.createElement('div');error.setAttribute('role','alert');
    const submit=document.createElement('button');submit.type='submit';submit.textContent='UNLOCK AI';submit.style.cssText='min-height:44px;background:#a22;color:white;border:0;border-radius:6px';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='CANCEL';cancel.style.cssText='min-height:44px';
    cancel.onclick=()=>{shade.remove();reject(new Error('Owner sign-in cancelled'))};
    form.append(heading,field,error,submit,cancel);shade.append(form);document.body.append(shade);field.focus();
    form.addEventListener('submit',async e=>{
      e.preventDefault();submit.disabled=true;error.textContent='';
      try {
        const response=await fetch('/api/owner/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:field.value})});
        field.value='';
        if(!response.ok){error.textContent=response.status===429?'Too many attempts. Try again later.':'Sign-in unsuccessful';return;}
        shade.remove();resolve();
      }catch(_){error.textContent='Owner login service unavailable';}
      finally{submit.disabled=false;}
    });
  });
}
export async function ownerFetch(url, options) {
  const send=()=>fetch(url,{...options,credentials:'same-origin'});
  let response=await send();
  if(response.status!==401)return response;
  if(!loginPending)loginPending=requestOwnerToken().finally(()=>{loginPending=null});
  await loginPending;
  response=await send();
  return response;
}

// Shared same-origin owner-auth request bridge for legacy editor/public scripts.
globalThis.OWNZ_FORGE_OWNER_FETCH = ownerFetch;
globalThis.dispatchEvent(new Event('ownz-owner-auth-ready'));
