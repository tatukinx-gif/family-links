// Use only with a test deployment. Never point this module at the live CSV.
export function createFamilyLinksClient(endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' ||
      !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) ||
      url.search || url.hash || url.username || url.password)
    throw new Error('検証用Apps ScriptのHTTPS URLを指定してください。');
  const key = 'family-links-staging-device-v1';
  function credentials(create) {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    if (!create) return {};
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)),
      byte => byte.toString(16).padStart(2,'0')).join('');
    const device = {device_id:crypto.randomUUID(),token};
    localStorage.setItem(key,JSON.stringify(device));
    return device;
  }
  async function send(action, fields = {}) {
    const response = await fetch(url, {
      method:'POST', credentials:'omit', redirect:'follow', referrerPolicy:'no-referrer',
      headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify({action,...credentials(action==='register'),...fields}),
      signal:AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error('通信に失敗しました。');
    const result = await response.json();
    if (!result.ok) throw new Error(result.error==='rate_limit'
      ? '申請が集中しています。時間をおいてお試しください。'
      : '操作を完了できませんでした。登録・承認状況をご確認ください。');
    return result;
  }
  return {register:name=>send('register',{name}),list:()=>send('list'),
    status:()=>credentials(false).device_id?send('status'):Promise.resolve({status:'unregistered'}),
    hide:link_id=>send('hide',{link_id})};
}
