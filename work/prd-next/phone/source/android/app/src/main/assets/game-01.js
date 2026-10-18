/* v7 多玩家试玩：?slot=A / ?slot=B 让同一浏览器的两个窗口各有一份独立存档（pg-air-* 为两人共享的“空中”数据） */
(()=>{try{const q=new URLSearchParams(location.search),s=(q.get('slot')||'').replace(/[^\w-]/g,'').slice(0,12);window.__pgSlot=s;if(!s)return;
const P='slot:'+s+':',S=Storage.prototype,g=S.getItem,st=S.setItem,r=S.removeItem;const map=x=>(x=String(x),/^pg-air-/.test(x)?x:P+x);
S.getItem=function(x){return this===window.localStorage?g.call(this,map(x)):g.call(this,x)};
S.setItem=function(x,v){return this===window.localStorage?st.call(this,map(x),v):st.call(this,x,v)};
S.removeItem=function(x){return this===window.localStorage?r.call(this,map(x)):r.call(this,x)};
document.addEventListener('DOMContentLoaded',()=>{document.title=`[${s}] `+document.title})}catch(e){}})();
