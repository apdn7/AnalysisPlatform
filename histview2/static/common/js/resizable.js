function resizableGrid(e) { const t = e.getElementsByTagName('tr')[0]; const n = t ? t.children : void 0; if (n) { e.style.overflow = 'hidden'; for (let i = e.offsetHeight, o = 0; o < n.length; o++) { const r = s(i); n[o].appendChild(r), n[o].style.position = 'relative', d(r); } } function d(e) { let t; let n; let i; let o; let r; e.addEventListener('mousedown', (e) => { n = e.target.parentElement, i = n.nextElementSibling, t = e.pageX; const d = (function (e) { if (l(e, 'box-sizing') == 'border-box') return 0; const t = l(e, 'padding-left'); const n = l(e, 'padding-right'); return parseInt(t) + parseInt(n); }(n)); o = n.offsetWidth - d, i && (r = i.offsetWidth - d); }), e.addEventListener('mouseover', (e) => { e.target.style.borderRight = '2px solid #444444'; }), e.addEventListener('mouseout', (e) => { e.target.style.borderRight = ''; }), document.addEventListener('mousemove', (e) => { if (n) { const d = e.pageX - t; i && (i.style.width = `${r - d}px`), n.style.width = `${o + d}px`; } }), document.addEventListener('mouseup', (e) => { n = void 0, i = void 0, t = void 0, r = void 0, o = void 0; }); } function s(e) { const t = document.createElement('div'); return t.style.top = 0, t.style.right = 0, t.style.width = '5px', t.style.position = 'absolute', t.style.cursor = 'col-resize', t.style.userSelect = 'none', t.style.height = `${e}px`, t; } function l(e, t) { return window.getComputedStyle(e, null).getPropertyValue(t); } }
