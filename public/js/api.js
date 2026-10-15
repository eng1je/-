const API = {
  base: '',
  token() { return localStorage.getItem('adminToken'); },
  setToken(t){ if(t) localStorage.setItem('adminToken', t); else localStorage.removeItem('adminToken'); },
  async req(path, opts={}) {
    const headers = Object.assign({}, opts.headers || {});
    if (opts.json !== undefined) headers['Content-Type']='application/json';
    const t = this.token();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    const res = await fetch(this.base + path, Object.assign({}, opts, { headers }));
    let data = null;
    const ct = res.headers.get('content-type')||'';
    if (ct.includes('application/json')) { try { data = await res.json(); } catch { data = null; } }
    else { data = await res.text(); }
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : (res.statusText || 'خطأ في الطلب');
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },
  get(p){ return this.req(p); },
  post(p, body){ return this.req(p, { method:'POST', json: body!==undefined, body: body!==undefined ? JSON.stringify(body) : undefined }); },
  put(p, body){ return this.req(p, { method:'PUT', json: body!==undefined, body: body!==undefined ? JSON.stringify(body) : undefined }); },
  del(p){ return this.req(p, { method:'DELETE' }); },
  async upload(p, formData){ return this.req(p, { method:'POST', body: formData }); }
};
window.API = API;