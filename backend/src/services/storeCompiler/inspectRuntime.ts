/**
 * The click-to-edit runtime a dashboard preview ships inside its iframe.
 *
 * The compiler, asked to `inspect`, wraps every block in a `display:contents`
 * marker carrying the node id. This script turns those markers into an editing
 * surface: hover outlines the block, a click selects it and tells the parent
 * window which node it was, and a click on a piece of text makes that text
 * editable in place. A finished edit is reported as {from, to} and the parent
 * decides which prop it belongs to — the page here knows nothing about props.
 *
 * Messages to the parent:  { source:'opendesign', type:'select', nodeId, block, text }
 *                          { source:'opendesign', type:'text',   nodeId, block, from, to }
 * Messages from the parent:{ source:'opendesign', type:'highlight', nodeId, scroll }
 *
 * Preview only. A served page never carries the markers, so it never gets this.
 */
export const INSPECT_STYLE =
  `<style id="od-inspect">` +
  `.od-n.od-hover>*{outline:2px dashed rgba(99,102,241,.85)!important;outline-offset:-2px!important;cursor:pointer}` +
  `.od-n.od-sel>*{outline:2px solid #4f46e5!important;outline-offset:-2px!important}` +
  `[data-od-editing="1"]{outline:2px solid #10b981!important;outline-offset:2px!important;cursor:text!important;` +
  `box-shadow:0 0 0 4px rgba(16,185,129,.18)!important;border-radius:3px}` +
  `.od-tip{position:fixed;z-index:2147483647;pointer-events:none;background:#4f46e5;color:#fff;font:600 11px/1 system-ui,sans-serif;` +
  `padding:4px 7px;border-radius:5px;letter-spacing:.02em;white-space:nowrap;display:none}` +
  `</style>`;

export const INSPECT_SCRIPT =
  `<script>(function(){` +
  `var d=document,SRC='opendesign',hover=null,sel=null,editing=null,orig='',tip;` +
  `function wrapOf(el){return el&&el.closest?el.closest('[data-od-node]'):null;}` +
  `function post(m){m.source=SRC;try{window.parent.postMessage(m,'*');}catch(_){}}` +
  `function ownText(el){var n=el.childNodes,t='';for(var i=0;i<n.length;i++){if(n[i].nodeType===3)t+=n[i].nodeValue;}return t.replace(/\\s+/g,' ').trim();}` +
  `function editable(el){if(!el||el===d.body)return false;var tag=el.tagName.toLowerCase();` +
  `if(/^(input|textarea|select|option|img|svg|video|iframe|script|style)$/.test(tag))return false;` +
  `if(el.querySelector('input,textarea,select,img,video,iframe'))return false;` +
  `var t=(el.textContent||'').replace(/\\s+/g,' ').trim();return t.length>0&&t.length<=600;}` +
  `function textTarget(target,wrap){var el=target;` +
  `while(el&&el!==wrap&&el!==d.body){if(ownText(el)&&editable(el))return el;el=el.parentElement;}return null;}` +
  `function setHover(w){if(hover===w)return;if(hover)hover.classList.remove('od-hover');hover=w;if(hover&&hover!==sel)hover.classList.add('od-hover');}` +
  `function setSel(w){if(sel)sel.classList.remove('od-sel');sel=w;if(sel){sel.classList.remove('od-hover');sel.classList.add('od-sel');}}` +
  `function showTip(w,e){if(!tip){tip=d.createElement('div');tip.className='od-tip';d.body.appendChild(tip);}` +
  `if(!w){tip.style.display='none';return;}tip.textContent=(w.getAttribute('data-od-block')||'bloc').replace(/_/g,' ')+' \\u2014 cliquer pour modifier';` +
  `tip.style.display='block';tip.style.left=Math.min(e.clientX+12,window.innerWidth-tip.offsetWidth-8)+'px';tip.style.top=Math.max(e.clientY-30,4)+'px';}` +
  `function finish(commit){if(!editing)return;var el=editing;editing=null;el.removeAttribute('data-od-editing');el.removeAttribute('contenteditable');` +
  `var w=wrapOf(el);var now=(el.textContent||'').replace(/\\s+/g,' ').trim();` +
  `if(!commit||now===orig){el.textContent=orig;return;}` +
  `if(!now){el.textContent=orig;return;}` +
  `post({type:'text',nodeId:w?w.getAttribute('data-od-node'):null,block:w?w.getAttribute('data-od-block'):null,from:orig,to:now});}` +
  `function startEdit(el){if(editing===el)return;finish(true);editing=el;orig=(el.textContent||'').replace(/\\s+/g,' ').trim();` +
  `el.setAttribute('data-od-editing','1');try{el.contentEditable='plaintext-only';}catch(_){}` +
  `if(el.contentEditable!=='plaintext-only')el.contentEditable='true';el.focus();` +
  `try{var r=d.createRange();r.selectNodeContents(el);var s=window.getSelection();s.removeAllRanges();s.addRange(r);}catch(_){}}` +
  `d.addEventListener('mousemove',function(e){if(editing)return;var w=wrapOf(e.target);setHover(w);showTip(w,e);},true);` +
  `d.addEventListener('mouseleave',function(){setHover(null);showTip(null);},true);` +
  `d.addEventListener('click',function(e){var t=e.target;if(editing&&(editing===t||editing.contains(t)))return;` +
  `if(editing){finish(true);}` +
  `var w=wrapOf(t);if(!w)return;` +
  `if(t.closest&&t.closest('a,button,label,[type=submit],summary'))e.preventDefault();` +
  `e.stopPropagation();setSel(w);showTip(null);` +
  `var te=textTarget(t,w);` +
  `post({type:'select',nodeId:w.getAttribute('data-od-node'),block:w.getAttribute('data-od-block'),text:te?(te.textContent||'').replace(/\\s+/g,' ').trim():null});` +
  `if(te)startEdit(te);},true);` +
  `d.addEventListener('keydown',function(e){if(!editing)return;` +
  `if(e.key==='Escape'){e.preventDefault();finish(false);}` +
  `else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();finish(true);}},true);` +
  `d.addEventListener('focusout',function(e){if(editing&&e.target===editing)setTimeout(function(){if(editing===e.target)finish(true);},0);},true);` +
  `d.addEventListener('submit',function(e){e.preventDefault();e.stopPropagation();},true);` +
  `window.addEventListener('message',function(e){var m=e.data;if(!m||m.source!==SRC)return;` +
  `if(m.type==='highlight'){var w=m.nodeId?d.querySelector('[data-od-node="'+String(m.nodeId).replace(/"/g,'')+'"]'):null;setSel(w);` +
  `if(w&&m.scroll){var first=w.firstElementChild;if(first&&first.scrollIntoView)try{first.scrollIntoView({block:'center'});}catch(_){}}}});` +
  `post({type:'ready'});` +
  `})();</script>`;

export const INSPECT_RUNTIME = INSPECT_STYLE + INSPECT_SCRIPT;
