import { createFamilyLinksClient } from './family-links-staging-client.js';

// Mount in a separate verification page; the production application is untouched.
export function mountFamilyLinksStaging({endpoint, registration, grid, filters}) {
  const api = createFamilyLinksClient(endpoint);
  const node = (tag, text, attrs = {}) => {
    const el = document.createElement(tag);
    el.textContent = text;
    for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,value);
    return el;
  };
  const button = (label, action) => {
    const el = node('button',label,{type:'button'});
    el.addEventListener('click',action);
    return el;
  };
  let state, selected = 'all';
  const status = node('p','',{role:'status'});
  registration.replaceChildren(status);
  function ask(title, detail, fields, yesLabel, action) {
    const dialog = node('dialog','',{'aria-label':title});
    const error = node('p','',{role:'alert'});
    const cancel = button('いいえ',()=>dialog.close());
    const confirm = button(yesLabel,async()=>{
      confirm.disabled = cancel.disabled = true;
      error.textContent = '';
      try { await action(); dialog.close(); }
      catch(e){ error.textContent=e.message; }
      finally { confirm.disabled=cancel.disabled=false; }
    });
    dialog.addEventListener('cancel',e=>{ if(confirm.disabled)e.preventDefault(); });
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.append(node('h2',title),node('p',detail),...fields,error,cancel,confirm);
    document.body.append(dialog);
    dialog.showModal();
  }
  const register = button('利用者登録',()=>{
    const name = node('input','',{required:'',maxlength:'60',autocomplete:'name'});
    const label = node('label','お名前'); label.append(name);
    ask('利用者登録','ブラウザのサイトデータを消すと再申請が必要です。',[label],
      '登録申請',async()=>{
        if(!name.value.trim())throw Error('お名前を入力してください。');
        await api.register(name.value);
        await refresh();
        status.textContent='登録申請を受け付けました。管理者の承認待ちです。';
      });
  });
  const refreshButton = button('承認状況を更新',()=>refresh().catch(showError));
  registration.append(register,refreshButton);
  function showError(e){status.textContent=e.message;}
  function render(){
    const aud=state.audience;
    const choices=aud?[['all','すべて（共通＋本人）'],['common','共通'],['mine',aud.name]]:[['common','共通']];
    filters.replaceChildren(...choices.map(([id,name])=>{
      const b=button(name,()=>{selected=id;render();});
      b.setAttribute('aria-pressed',String(id===(aud?selected:'common')));
      return b;
    }));
    grid.replaceChildren();
    for(const link of state.links){
      if(selected==='common'&&!link.common||selected==='mine'&&link.common)continue;
      let url;try{url=new URL(link.url);}catch{continue;}
      if(!['https:','http:'].includes(url.protocol)||url.username||url.password)continue;
      const tile=node('div','',{class:'staging-tile'});
      tile.style.position='relative';
      const a=node('a',link.name,{class:'link-card',href:url.href,target:'_blank',rel:'noopener noreferrer'});
      tile.append(a);
      if(link.can_hide){
        const b=button('×',()=>ask(link.name+'を非表示にしますか？',
          '非表示にしたリンクは一覧から隠れます。あとから復元できます。',[],'はい',async()=>{
            await api.hide(link.link_id);
            state.links=state.links.filter(x=>x.link_id!==link.link_id);
            render();
          }));
        b.setAttribute('aria-label',link.name+'を非表示にする');
        Object.assign(b.style,{position:'absolute',top:0,right:0,minWidth:'44px',minHeight:'44px'});
        tile.append(b);
      }
      grid.append(tile);
    }
  }
  async function refresh(){
    state=await api.list();
    if(!state.audience)selected='all';
    register.hidden=state.status!=='unregistered';
    status.textContent=state.status==='pending'?'管理者の承認待ち':state.audience?'承認済み':'共通リンクを表示中';
    render();
  }
  return refresh().catch(showError);
}
