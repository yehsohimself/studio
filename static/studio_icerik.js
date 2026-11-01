/* Studio: video dışı içerik (2026-11-01; kullanıcı: "Studio sadece video için çalışmamalı. Instagram linki attığımda oradaki statik görseli de indirebilmeliyim;
   yazı indirmeye izin vermeyen bir siteden yazı da indirebilmeliyim"). Sunucu sunucu/39_icerik.py, motor icerik.py.
   - Link kutusu: görsel gönderisi → görseller önizlemede, tek dokunuşla iner; yazı → başlık, künye, "Yazıyı al"
   - Okuma görünümü: yazı kaydı (veri.yazi) kitap gibi: başlıklar, görseller, okuma ilerlemesi, yazı haritası; video araçları yok
   - Kitaplık: Görseller sekmesi, yazılar için "Yazı" süzgeci */
(() => {
if (typeof URUN === 'undefined' || URUN !== 'transcript' || document.documentElement.dataset.misafir === '1') return;
const T = x => (window.DIL?.t || (y => y))(x);
const json = async (url, opts) => { const r = await fetch(url, opts); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.hata || T('Olmadı')); return j; };
const post = (url, body) => json(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})});
const IK = {
  indir: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>', kopya: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
  tik: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>', kitap: '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22zM20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5a2.5 2.5 0 0 1 2.5 2z"/></svg>'};
let I = {sec: new Set(), kayit: null};

/* ---------------------------------------------------------------- link kutusu: önizleme */
function panelKapat(){ $('#icPanel')?.remove(); document.body.classList.remove('st-ic'); I = {sec: new Set(), kayit: null}; }
const _onizle = onizle;
onizle = async function(link){   // eslint-disable-line no-global-assign
  if (state.previewLink !== link) panelKapat();
  const r = await _onizle(link);
  const d = state.preview;
  if (state.previewLink === link && d?.icerik) panelCiz(d, link);
  return r;
};
const _hidePreview = hidePreview;
hidePreview = function(){ panelKapat(); return _hidePreview(); };   // eslint-disable-line no-global-assign

function panelCiz(d, link){
  const ic = d.icerik;
  document.body.classList.add('st-ic');
  $('#preview').classList.add('hidden');
  $('#notice') && ($('#notice').innerHTML = '');
  let p = $('#icPanel');
  if (!p){ p = document.createElement('div'); p.id = 'icPanel'; p.className = 'ic-panel'; $('#preview').after(p); }
  if (ic.tur === 'gorsel') gorselCiz(p, ic, link); else yaziCiz(p, ic, link);
}
const seyrek = n => (n || 0).toLocaleString(window.DIL?.locale || 'tr-TR');
const tarihYaz = t => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t || ''); if (!m) return ''; try{ return new Date(+m[1], m[2] - 1, +m[3]).toLocaleDateString(window.DIL?.locale || 'tr-TR', {day: 'numeric', month: 'long', year: 'numeric'}); }catch(e){ return t; } };
const uzunMetin = (s, id) => `<div class="ic-uzun" id="${id}">${esc(s).replace(/\n/g, '<br>')}</div>`;

function gorselCiz(p, ic, link){
  const D = ic.dosyalar || [];
  I.sec = new Set(D.map(f => f.i));
  const ust = [ic.kanal, ic.platform, tarihYaz(ic.tarih)].filter(Boolean).map(esc).join(' · ');
  const yazilar = D.filter(f => f.yazi);
  p.innerHTML = `
    ${D.length ? `<div class="ic-serit ${D.length === 1 ? 'tek' : ''}" id="icSerit">${D.map((f, n) => `<button type="button" class="ic-g on" data-i="${f.i}" style="--n:${n};--oran:${f.en && f.boy ? (f.en / f.boy).toFixed(3) : 1}" aria-pressed="true" aria-label="${T('Görsel')} ${n + 1}">
        <img src="${esc(f.kucuk)}" alt="" loading="${n > 3 ? 'lazy' : 'eager'}">${D.length > 1 ? `<i class="ic-sec">${IK.tik}</i><em>${n + 1}</em>` : ''}</button>`).join('')}</div>` : ''}
    <div class="ic-bilgi">
      ${ust ? `<div class="ic-ust">${ust}${D[0]?.en ? ` · ${D.length > 1 ? D.length + ' ' + T('görsel') + ' · ' : ''}${D[0].en}×${D[0].boy}` : ''}</div>` : ''}
      ${ic.yalniz_metin ? `<div class="ic-not">${T('Bu gönderide görsel yok; metnini kopyalayabilirsiniz.')}</div>` : ''}
      ${ic.tek_kucuk ? `<div class="ic-not">${T('Tam boy alınamadı, paylaşım görseli geldi. Chrome’da bu siteye giriş yaptıysanız yeniden deneyin.')}</div>` : ''}
      ${ic.metin ? `<div class="ic-blok"><div class="ic-bb"><span>${T('Açıklama')}</span><button type="button" class="ic-mini" data-kopya="metin">${IK.kopya}${T('Kopyala')}</button></div>${uzunMetin(ic.metin, 'icMetin')}</div>` : ''}
      ${yazilar.length ? `<div class="ic-blok"><div class="ic-bb"><span>${T('Görselin üstündeki yazı')}</span><button type="button" class="ic-mini" data-kopya="yazi">${IK.kopya}${T('Kopyala')}</button></div>${uzunMetin(yazilar.map(f => f.yazi).join('\n\n'), 'icYazi')}</div>` : ''}
      ${ic.video_sayi ? `<button type="button" class="ic-tb" id="icVideo">${T('Bu gönderide video da var; videoyu al')}</button>` : ''}
    </div>
    ${D.length ? `<div class="ic-eylem" id="icEylem"></div>` : ''}`;
  p.querySelectorAll('[data-kopya]').forEach(b => b.onclick = () => kopyala(b.dataset.kopya === 'metin' ? ic.metin : yazilar.map(f => f.yazi).join('\n\n'), T('Kopyalandı')));
  uzunBagla(p);
  $('#icVideo')?.addEventListener('click', () => videoGec(link));
  p.querySelectorAll('.ic-g').forEach(b => b.onclick = () => { if (D.length < 2 || I.kayit) return buyukAc(D, +b.dataset.i);
    const i = +b.dataset.i; I.sec.has(i) ? I.sec.delete(i) : I.sec.add(i); b.classList.toggle('on', I.sec.has(i)); b.setAttribute('aria-pressed', I.sec.has(i)); gorselEylem(ic, link); });
  if (ic.mevcut && D.length) I.oncekiId = ic.mevcut.id;
  gorselEylem(ic, link);
}
function gorselEylem(ic, link){
  const e = $('#icEylem'); if (!e) return;
  const D = ic.dosyalar, n = I.sec.size;
  if (I.kayit){
    e.innerHTML = `<span class="ic-oldu"><i>${IK.tik}</i>${T('İndirildi')}</span><button type="button" class="sbtn" id="icFinder">${T('Finder’da göster')}</button><button type="button" class="sbtn plain" id="icKitap">${T('Görseller’de gör')}</button><span class="sp"></span><button type="button" class="sbtn plain" id="icYeni">${T('Yeni link')}</button>`;
    $('#icFinder').onclick = () => post(`/api/icerik/gorsel/${I.kayit.id}/goster`, {}).catch(() => toast(T('Olmadı')));
    $('#icKitap').onclick = () => { temizle(); libGoster('gr', true); };
    $('#icYeni').onclick = temizle;
    return;
  }
  e.innerHTML = `${ic.mevcut ? `<span class="ic-onceki">${T('Daha önce indirdiniz')}</span>` : ''}<span class="sp"></span>${D.length > 1 ? `<button type="button" class="ic-tb" id="icHepsi">${n === D.length ? T('Seçimi kaldır') : T('Hepsini seç')}</button>` : ''}
    <button type="button" class="primary ic-ana" id="icIndir" ${n ? '' : 'disabled'}>${IK.indir}<span>${D.length === 1 ? T('Görseli indir') : (n === D.length && n > 1 ? `${T('Hepsini indir')} (${n})` : `${n} ${T('görseli indir')}`)}</span></button>`;
  $('#icHepsi')?.addEventListener('click', () => { if (I.sec.size === D.length) I.sec.clear(); else D.forEach(f => I.sec.add(f.i)); $$('#icSerit .ic-g').forEach(b => { const on = I.sec.has(+b.dataset.i); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); gorselEylem(ic, link); });
  $('#icIndir').onclick = async ev => { const b = ev.currentTarget; b.disabled = true;
    try{ const sec = [...I.sec].sort((x, y) => x - y); const k = await post('/api/icerik/gorsel', {id: ic.id, secim: sec}); I.kayit = k; dosyaIndir(k, sec); gorselEylem(ic, link); gorselleriYukle(); }
    catch(err){ toast(err.message); b.disabled = false; } };
}
function dosyaIndir(k, sec){   // bilgisayara hemen insin: tek görsel kendi biçiminde, çoklu zip
  const a = document.createElement('a'); a.style.display = 'none';
  a.href = sec.length === 1 ? `/gorsel/${k.id}/${sec[0]}?indir=1` : `${k.zip}?i=${sec.join(',')}`; a.download = '';
  document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 2000);
}
function temizle(){ if (typeof linkEl !== 'undefined'){ linkEl.value = ''; linkEl.dispatchEvent(new Event('input')); } panelKapat(); hidePreview(); }
function videoGec(link){ panelKapat(); state.previewLink = ''; state.preview = null; const pv = $('#preview'); pv.classList.remove('hidden');
  pv.innerHTML = `<div class="ph"></div><div><div class="t" style="color:var(--muted);font-weight:500">${T('Bilgiler alınıyor')}</div></div>`;
  fetch('/api/onizle?tur=video&link=' + encodeURIComponent(link)).then(r => r.json().then(d => [r.ok, d])).then(([ok, d]) => { if (!ok){ pv.innerHTML = `<div class="ph still"></div><div><div class="t" style="color:var(--muted);font-weight:500">${T('Video alınamadı.')}</div></div>`; return; }
    state.previewLink = link; state.preview = d; kaliteGoster(); modeHint(); pv.innerHTML = `${d.kapak ? `<img src="${esc(d.kapak)}" alt="" referrerpolicy="no-referrer">` : '<div class="ph still"></div>'}<div style="min-width:0"><div class="t">${esc(d.baslik || link)}</div><div class="m" id="pvMeta"></div></div>`; previewMeta(); }).catch(() => {}); }

function uzunBagla(k){ k.querySelectorAll('.ic-uzun').forEach(u => { if (u.offsetHeight < 150) return; u.classList.add('kisa'); const b = document.createElement('button'); b.type = 'button'; b.className = 'ic-tb ic-daha'; b.textContent = T('Devamını göster');
  b.onclick = () => { const a = u.classList.toggle('kisa'); b.textContent = a ? T('Devamını göster') : T('Daha az'); }; u.after(b); }); }

function yaziCiz(p, ic, link){
  const ust = [ic.yazar, ic.site, tarihYaz(ic.tarih)].filter(Boolean).map(esc).join(' · ');
  const say = [`${ic.okuma_dk} ${T('dk okuma')}`, `${seyrek(ic.kelime)} ${T('kelime')}`, ic.bolum > 1 ? `${ic.bolum} ${T('bölüm')}` : '', ic.gorsel ? `${ic.gorsel} ${T('görsel')}` : ''].filter(Boolean).map(esc).join(' · ');
  p.innerHTML = `<div class="ic-yazi">
      ${ic.kapak ? `<img class="ic-ykapak" src="${esc(ic.kapak)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : `<i class="ic-yik">${IK.kitap}</i>`}
      <div class="ic-yg"><div class="ic-ust">${ust}</div><h3>${esc(ic.baslik)}</h3><div class="ic-say">${say}</div></div>
    </div>
    ${ic.ozet ? `<p class="ic-giris">${esc(ic.ozet)}</p>` : ''}
    ${ic.kopya_engeli ? `<div class="ic-not ok">${IK.tik}<span>${T('Bu site kopyalamaya kapalı; metni yine de aldım.')}</span></div>` : ''}
    ${ic.kisitli ? `<div class="ic-not">${ic.oturum ? T('Oturumunuzla da yazının yalnız açık kısmı geldi. Bu sitede üyeliğiniz yoksa tamamı alınamaz.') : T('Yazının yalnız açık kısmı alınabildi. Bu sitede üyeliğiniz varsa ve Chrome’da girişliyseniz tamamını oturumunuzla alabilirim.')}${ic.oturum ? '' : `<button type="button" class="ic-tb" id="icOturum">${T('Tarayıcı oturumumla dene')}</button>`}</div>` : ''}
    ${ic.video_da ? `<button type="button" class="ic-tb" id="icVideo">${T('Bu sayfada video da var; videoyu al')}</button>` : ''}
    <div class="ic-eylem"><span class="ic-acik">${T('Özeti de hazırlanır. Sonra çevirebilir, Word ya da PDF indirebilir, Studio’ya sorabilirsiniz.')}</span><span class="sp"></span>
      <button type="button" class="primary ic-ana" id="icAl">${ic.mevcut ? T('Yazıyı aç') : T('Yazıyı al')}</button></div>`;
  $('#icVideo')?.addEventListener('click', () => videoGec(link));
  $('#icOturum')?.addEventListener('click', () => { panelKapat(); state.previewLink = ''; state.cerezAc = true; state.cerez = 'chrome'; onizle(link); });
  $('#icAl').onclick = async ev => { const b = ev.currentTarget; b.disabled = true; b.textContent = T('Alınıyor…');
    try{ const j = ic.mevcut?.temel ? {temel: ic.mevcut.temel} : await post('/api/icerik/yazi', {link, cerez: ic.oturum ? 'chrome' : ''});
      temizle(); await sonucGoster(j.temel); gecmisYukle(); }
    catch(err){ toast(err.message); b.disabled = false; b.textContent = T('Yazıyı al'); } };
}

/* ---------------------------------------------------------------- büyük görsel */
function buyukAc(D, i, kayit){
  let n = Math.max(0, D.findIndex(f => f.i === i));
  const d = document.createElement('div'); d.className = 'ic-buyuk'; d.tabIndex = -1;
  const ciz = () => { const f = D[n]; d.innerHTML = `<button type="button" class="ic-kapat" aria-label="${T('Kapat')}">✕</button>${D.length > 1 ? `<button type="button" class="ic-ok sol" aria-label="${T('Önceki')}">‹</button><button type="button" class="ic-ok sag" aria-label="${T('Sonraki')}">›</button>` : ''}
      <figure><img src="${esc(f.buyuk)}" alt=""><figcaption>${D.length > 1 ? `${n + 1} / ${D.length} · ` : ''}${f.en}×${f.boy}${kayit ? ` · <a href="${esc(f.indir)}" download>${T('İndir')}</a>` : ''}</figcaption></figure>`;
    d.querySelector('.ic-kapat').onclick = kapat; d.querySelector('.sol')?.addEventListener('click', e => { e.stopPropagation(); git(-1); }); d.querySelector('.sag')?.addEventListener('click', e => { e.stopPropagation(); git(1); }); };
  const git = a => { n = (n + a + D.length) % D.length; ciz(); };
  const kapat = () => { document.removeEventListener('keydown', tus, true); d.remove(); };
  const tus = e => { if (e.key === 'Escape'){ e.stopPropagation(); kapat(); } else if (e.key === 'ArrowLeft' && D.length > 1) git(-1); else if (e.key === 'ArrowRight' && D.length > 1) git(1); };
  document.addEventListener('keydown', tus, true); d.onclick = e => { if (e.target === d) kapat(); };
  ciz(); document.body.appendChild(d); d.focus();
}

/* ---------------------------------------------------------------- okuma görünümü */
function yaziKur(temel, v, s){
  const doc = $('#doc'); if (!doc) return;
  const yazi = v.yazi; doc.classList.toggle('yazi', !!yazi); document.body.classList.toggle('st-okuma-yazi', !!yazi);
  if (yazi && doc.querySelector('.ic-kunye')) return;   // bu görünüm zaten kuruldu
  $('#icIlerleme')?.remove(); window.removeEventListener('scroll', ilerleme);
  if (!yazi) return;
  $('#oynatici')?.remove(); $('#stBakis')?.remove(); $('#stMap')?.remove();
  const chips = doc.querySelector('.cover .chips');
  if (chips){ const k = document.createElement('div'); k.className = 'ic-kunye'; k.innerHTML = [yazi.yazar, yazi.site, tarihYaz(yazi.tarih)].filter(Boolean).map(esc).join(' · ') + `<br>${yazi.okuma_dk} ${T('dk okuma')} · ${seyrek(yazi.kelime)} ${T('kelime')}` + (v.link ? ` · <a href="${esc(v.link)}" target="_blank" rel="noopener">${T('Kaynağa git')} ↗</a>` : '') + (yazi.kisitli ? `<div class="ic-not">${T('Yazının yalnız açık kısmı alınabildi.')}</div>` : ''); chips.replaceWith(k); }
  const turler = yazi.turler || [], res = {};
  (yazi.gorseller || []).forEach(g => (res[g.sonra] = res[g.sonra] || []).push(g));
  const fig = g => { const f = document.createElement('figure'); f.className = 'ic-fig'; f.innerHTML = `<img src="/kare/${encodeURIComponent(temel)}/${esc(g.ad)}" alt="${esc(g.alt || '')}" loading="lazy">${g.alt ? `<figcaption>${esc(g.alt)}</figcaption>` : ''}`; return f; };
  const paras = $('#paras'); if (!paras) return;
  if (res[-1]) paras.prepend(...res[-1].map(fig));
  $$('#paras .para').forEach(p => { const i = +p.dataset.i, t = turler[i] || 'p'; p.dataset.ytur = t;
    if (t === 'tablo'){ const x = p.querySelector('.x'); const m = (s.paragraflar[i]?.metin || ''); x.innerHTML = '<table class="ic-tablo">' + m.split('\n').map(r => '<tr>' + r.split(' | ').map(h => `<td>${esc(h)}</td>`).join('') + '</tr>').join('') + '</table>'; }
    if (res[i]) p.after(...res[i].map(fig)); });
  haritaYaz(temel, turler, s);
  const b = document.createElement('div'); b.id = 'icIlerleme'; b.className = 'ic-ilerleme'; b.innerHTML = '<i></i>'; document.body.appendChild(b);
  window.addEventListener('scroll', ilerleme, {passive: true}); ilerleme();
}
function ilerleme(){ const p = $('#paras'), i = $('#icIlerleme i'); if (!p || !i) return; const r = p.getBoundingClientRect(), o = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight * .6)));
  i.style.transform = `scaleX(${o})`; $('#icIlerleme').classList.toggle('gor', r.top < innerHeight && r.bottom > 0);
  const h = $('#icHarita'); if (h){ h.querySelector('.ic-h-bas').style.left = (o * 100).toFixed(1) + '%'; } }
function haritaYaz(temel, turler, s){
  $('#icHarita')?.remove();
  const P = s.paragraflar || [], bolum = []; let cur = null;
  P.forEach((p, i) => { const t = turler[i]; if (t === 'h1' || t === 'h2' || !cur){ cur = {ad: (t === 'h1' || t === 'h2') ? p.metin : T('Giriş'), i, kelime: 0}; bolum.push(cur); } cur.kelime += (p.metin || '').split(/\s+/).length; });
  if (bolum.length < 3) return;
  const top = bolum.reduce((a, x) => a + x.kelime, 0) || 1, renk = ['var(--vurgu)', 'color-mix(in srgb,var(--vurgu) 62%,transparent)', 'color-mix(in srgb,var(--vurgu) 38%,transparent)'];
  const h = document.createElement('section'); h.id = 'icHarita'; h.className = 'ic-harita';
  h.innerHTML = `<div class="ic-h-ust"><b>${T('Yazının haritası')}</b><span>${bolum.length} ${T('bölüm')}</span></div><div class="ic-h-serit">${bolum.map((b, n) => `<button type="button" data-i="${b.i}" title="${esc(b.ad)}" style="flex:${Math.max(1, b.kelime)} 1 0;--r:${renk[n % 3]};--n:${n}"></button>`).join('')}<i class="ic-h-bas"></i></div>
    <ol class="ic-h-liste">${bolum.map(b => `<li><button type="button" data-i="${b.i}"><span>${esc(b.ad)}</span><em>${Math.max(1, Math.round(b.kelime / 230))} ${T('dk')}</em></button></li>`).join('')}</ol>`;
  h.querySelectorAll('button').forEach(x => x.onclick = () => { const p = $(`#paras .para[data-i="${x.dataset.i}"]`); if (!p) return; if (typeof sekmeSec === 'function') sekmeSec('metin'); p.scrollIntoView({behavior: 'smooth', block: 'start'}); });
  ($('#doc .solk') || $('#doc')).appendChild(h);
}
const _sonucGoster = sonucGoster;
sonucGoster = async function(temel, opts = {}){   // eslint-disable-line no-global-assign
  const r = await _sonucGoster(temel, opts);
  try{ yaziKur(temel, state.sonuc?.veri || {}, state.sonuc || {}); }catch(e){ console.warn('Yazı görünümü:', e); }
  return r;
};
// Sayfa doğrudan bir yazıyla açılınca (#t=...) okuma görünümü bu dosya yüklenmeden çizilmiş olabilir; görünüm her yeniden çizildiğinde de kurulur
{ let z = 0; const d = $('#doc'); if (d) new MutationObserver(() => { clearTimeout(z); z = setTimeout(() => { try{ if (state.aktifTemel && state.sonuc) yaziKur(state.aktifTemel, state.sonuc.veri || {}, state.sonuc); }catch(e){} }, 30); }).observe(d, {childList: true});
  if (d && state.aktifTemel && state.sonuc) try{ yaziKur(state.aktifTemel, state.sonuc.veri || {}, state.sonuc); }catch(e){} }
const _popover = popover;
popover = function(anchor, items, opts){   // eslint-disable-line no-global-assign
  const v = state.sonuc?.veri || {}, temel = state.aktifTemel;
  if (anchor?.id === 'dosyaMenu' && v.yazi && temel){
    const e = encodeURIComponent(temel);
    items = [['PDF', () => { location.href = `/icerik-pdf/${e}.pdf?indir=1`; toast(T('PDF hazırlanıyor')); }], ['Düz metin', () => { location.href = `/indir/${e}.txt`; }], ['Markdown', () => { location.href = `/indir/${e}.md`; }], null,
      ...(items || []).filter(x => !x || !/altyazı|srt|vtt|senaryo|yayın|json|word|düz metin|markdown|drive/i.test(String(x[0]))).filter((x, n, L) => x || (n && L[n - 1]))];
    while (items[items.length - 1] === null) items.pop();
  }
  return _popover(anchor, items, opts);
};

/* ---------------------------------------------------------------- kitaplık: görseller ve yazılar */
function kitaplikKur(){
  const tab = $('#libTab'); if (!tab || tab.querySelector('[data-v="gr"]')) return;
  const b = document.createElement('button'); b.type = 'button'; b.dataset.v = 'gr'; b.setAttribute('aria-pressed', 'false'); b.textContent = T('Görseller'); b.onclick = () => libGoster('gr');
  const dl = tab.querySelector('[data-v="dl"]'); (dl || tab.lastChild).after(b);
  const g = document.createElement('div'); g.id = 'gls'; g.className = 'hidden'; $('#dls').after(g);
  const k = $('#szKaynak'); if (k && !k.querySelector('[value="yazi"]')) k.insertAdjacentHTML('beforeend', `<option value="yazi">${T('Yazılar')}</option>`);
  gorselleriYukle();
}
let GL = [], glQ = '';
async function gorselleriYukle(){ try{ GL = await json('/api/icerik/gorseller'); }catch(e){ return; } gorselleriCiz(); }
function gorselleriCiz(){
  const g = $('#gls'); if (!g) return;
  const q = glQ.toLocaleLowerCase('tr');
  const L = GL.filter(k => !q || [k.baslik, k.kanal, k.metin, k.betim, (k.etiketler || []).join(' '), ...(k.dosyalar || []).map(f => f.yazi)].join(' ').toLocaleLowerCase('tr').includes(q));
  if (!GL.length){ g.innerHTML = `<div class="emptyh">${T('Henüz görsel yok. Yukarıya bir Instagram, X ya da Pinterest linki yapıştırın.')}</div>`; return; }
  g.innerHTML = `${GL.length > 8 ? `<label class="ic-ara"><input type="search" id="glQ" placeholder="${T('Açıklamada, görseldeki yazıda ya da içeriğinde ara')}" value="${esc(glQ)}"></label>` : ''}<div class="ic-duvar">${L.map(k => { const f = k.dosyalar[0]; return `<button type="button" class="ic-kart" data-id="${k.id}" title="${esc(k.baslik || '')}"><img src="${esc(f.kucuk)}" alt="" loading="lazy" style="aspect-ratio:${f.en || 1}/${f.boy || 1}">${k.dosyalar.length > 1 ? `<em>${k.dosyalar.length}</em>` : ''}<span>${esc(k.kanal || k.platform || '')}</span></button>`; }).join('')}</div>`;
  const qi = $('#glQ'); if (qi){ qi.oninput = () => { glQ = qi.value; const pos = qi.selectionStart; gorselleriCiz(); const n = $('#glQ'); n.focus(); n.setSelectionRange(pos, pos); }; }
  g.querySelectorAll('.ic-kart').forEach(b => b.onclick = () => gorselKart(GL.find(k => k.id === b.dataset.id)));
}
function gorselKart(k){
  if (!k) return;
  const yazi = k.dosyalar.map(f => f.yazi).filter(Boolean).join('\n\n');
  const d = document.createElement('div'); d.className = 'ic-buyuk ic-detay'; d.tabIndex = -1;
  d.innerHTML = `<div class="ic-dk"><button type="button" class="ic-kapat" aria-label="${T('Kapat')}">✕</button>
    <div class="ic-dk-g">${k.dosyalar.map(f => `<a href="${esc(f.buyuk)}" data-i="${f.i}" class="ic-dk-r"><img src="${esc(f.kucuk)}" alt="" loading="lazy" style="aspect-ratio:${f.en || 1}/${f.boy || 1}"></a>`).join('')}</div>
    <div class="ic-dk-b"><div class="ic-ust">${[k.kanal, k.platform, tarihYaz(k.tarih)].filter(Boolean).map(esc).join(' · ')}</div>
      ${k.betim ? `<p class="ic-betim">${esc(k.betim)}</p>` : ''}
      ${k.metin ? `<div class="ic-blok"><div class="ic-bb"><span>${T('Açıklama')}</span><button type="button" class="ic-mini" data-k="metin">${IK.kopya}${T('Kopyala')}</button></div>${uzunMetin(k.metin, 'dkMetin')}</div>` : ''}
      ${yazi ? `<div class="ic-blok"><div class="ic-bb"><span>${T('Görselin üstündeki yazı')}</span><button type="button" class="ic-mini" data-k="yazi">${IK.kopya}${T('Kopyala')}</button></div>${uzunMetin(yazi, 'dkYazi')}</div>` : ''}
      <div class="ic-dk-e"><a class="primary ic-ana" href="${k.dosyalar.length > 1 ? esc(k.zip) : esc(k.dosyalar[0].indir)}" download>${IK.indir}<span>${k.dosyalar.length > 1 ? `${T('Hepsini indir')} (${k.dosyalar.length})` : T('İndir')}</span></a>
        <button type="button" class="sbtn" id="dkFinder">${T('Finder’da göster')}</button>${k.link ? `<a class="sbtn plain" href="${esc(k.link)}" target="_blank" rel="noopener">${T('Kaynağa git')} ↗</a>` : ''}<span class="sp"></span><button type="button" class="sbtn red" id="dkSil">${T('Kaldır')}</button></div></div></div>`;
  const kapat = () => { document.removeEventListener('keydown', tus, true); d.remove(); };
  const tus = e => { if (e.key === 'Escape' && !document.querySelector('.ic-buyuk:not(.ic-detay)')){ e.stopPropagation(); kapat(); } };
  document.addEventListener('keydown', tus, true);
  d.onclick = e => { if (e.target === d) kapat(); };
  d.querySelector('.ic-kapat').onclick = kapat;
  d.querySelectorAll('.ic-dk-r').forEach(a => a.onclick = e => { e.preventDefault(); buyukAc(k.dosyalar, +a.dataset.i, k); });
  d.querySelectorAll('[data-k]').forEach(b => b.onclick = () => kopyala(b.dataset.k === 'metin' ? k.metin : yazi, T('Kopyalandı')));
  d.querySelector('#dkFinder').onclick = () => post(`/api/icerik/gorsel/${k.id}/goster`, {}).catch(() => toast(T('Olmadı')));
  d.querySelector('#dkSil').onclick = async () => { try{ await json(`/api/icerik/gorsel/${k.id}`, {method: 'DELETE'}); kapat(); await gorselleriYukle();
    toast(T('Kaldırıldı'), T('Geri al'), async () => { await post(`/api/icerik/gorsel/${k.id}/geri`, {}); gorselleriYukle(); toast(T('Geri alındı')); }, 7000); }catch(e){ toast(e.message); } };
  window.addEventListener('hashchange', kapat, {once: true});
  document.body.appendChild(d); d.focus(); uzunBagla(d);
}
const _libGoster = libGoster;
libGoster = function(tab, kaydir){   // eslint-disable-line no-global-assign
  const gr = tab === 'gr';
  _libGoster(gr ? 'dl' : tab, kaydir);
  if (gr){ state.libTab = 'gr'; $('#dls').classList.add('hidden'); $$('#libTab button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === 'gr')); gorselleriYukle(); }
  $('#gls')?.classList.toggle('hidden', !gr);
  $('#dlFinder')?.classList.toggle('hidden', !(tab === 'dl' || gr));
};
function kartEtiketle(){   // yazı kartları: "Video" yerine yazı, süre yerine okuma
  (state.tumListe || []).filter(x => x.yazi).forEach(x => { const c = document.querySelector(`#hist .hc[data-t="${CSS.escape(x.temel)}"]`); if (!c || c.dataset.yz) return; c.dataset.yz = '1'; c.classList.add('ic-yk');
    const dur = c.querySelector('.dur'); if (dur) dur.textContent = `${x.yazi.okuma_dk || 1} ${T('dk okuma')}`; const ph = c.querySelector('.ph'); if (ph) ph.innerHTML = IK.kitap + esc(T('Yazı')); const mt = c.querySelector('.mt'); if (mt) mt.insertAdjacentHTML('afterbegin', `<span class="kal">${T('Yazı')}</span>`); });
}
const _gecmisYukle = gecmisYukle;
gecmisYukle = async function(){ const r = await _gecmisYukle(); try{ kartEtiketle(); }catch(e){} return r; };   // eslint-disable-line no-global-assign
new MutationObserver(() => { try{ kartEtiketle(); kitaplikKur(); }catch(e){} }).observe($('#hist') || document.body, {childList: true});

/* Kitaplık süzgeci: Yazılar */
document.addEventListener('change', e => { if (e.target?.id === 'szKaynak') setTimeout(yaziSuz, 0); });
function yaziSuz(){ const v = $('#szKaynak')?.value; if (v !== 'yazi') return; const yz = new Set((state.tumListe || []).filter(x => x.yazi).map(x => x.temel)); $$('#hist .hc').forEach(c => { c.style.display = yz.has(c.dataset.t) ? '' : 'none'; }); }

/* Görsel ya da yazı önizlemesindeyken Return ve ok düğmesi videoyu değil, görünen işi başlatır */
function icBirincil(e){ if (!document.body.classList.contains('st-ic')) return false; const b = $('#icIndir') || $('#icAl'); e.preventDefault(); e.stopImmediatePropagation(); if (b && !b.disabled) b.click(); return true; }
document.addEventListener('click', e => { if (e.target.closest?.('#goIk')) icBirincil(e); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target?.id === 'link') icBirincil(e); }, true);

/* Ana sayfa metinleri */
const lk = $('#link'); if (lk && !matchMedia('(max-width:520px)').matches) setTimeout(() => { lk.placeholder = T('Video, görsel ya da yazı linki yapıştırın; ne istediğinizi de yazabilirsiniz'); }, 300);
kitaplikKur();
setTimeout(() => { if (state.tumListe) kartEtiketle(); kitaplikKur(); }, 800);
})();
