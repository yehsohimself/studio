/* Studio geliştirmeleri (2026-10-24; kullanıcı: "küçük büyük bütün geliştirmeleri yap; kendi kendini besleyen, sürekli gelişen bir yapıya kavuştur").
   index.html'deki işlevleri sarmalayarak çalışır (Meet oturumunun dosyasıyla çakışmasın diye ayrı dosya):
   - okuma görünümünde paragraf metnini yerinde düzeltme (düzeltilen adlar ses modeline öğretilir)
   - Yayın paketi kartı (YouTube başlık/açıklama/bölümler, kapak, Shorts, Instagram, LinkedIn; beğeni → sonraki paketler)
   - Kurgu: paragrafları sürükleyip sırala, çıkar, önizle, geri al, kaydet, videosunu oluştur
   - Düzenlenmiş video panelinde altyazı görünümü önizlemesi (tek kare)
   - Kitaplıkta süzgeç ve sahnelerde (görüntüde) arama; İndirilenlerde temizleme önerisi
   - Video ▾ / Word ▾ menülerine ekler (zip, kurgu, yayın paketi, Content köprüsü), Sonraki adımlar
   - Ayarlar → Sistem → Studio gelişimi (araç güncellemeleri, gelişmeler, öneriler, öğrenilenler) */
(() => {
if (typeof URUN === 'undefined' || URUN !== 'transcript') return;
const SVG_KALEM = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>';
const json = async (url, opts) => { const r = await fetch(url, opts); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.hata || 'Olmadı'); return j; };
const post = (url, body) => json(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})});
const aktif = () => state.aktifTemel, veri = () => state.sonuc?.veri || {};
const port = p => `${location.protocol}//${location.hostname}:${p}/`;
const isGoster = () => { $('#jobsSec')?.classList.remove('hidden'); setTimeout(isleriTara, 600); };
const T = x => (window.DIL?.t || (y => y))(x);
const MB = b => b >= 1073741824 ? (b / 1073741824).toFixed(1).replace('.', ',') + ' GB' : Math.round(b / 1048576) + ' MB';

/* ---------------------------------------------------------------- 1) metni yerinde düzeltme */
function duzeltKur(){
  if (state.gorunumDil !== 'orijinal') return;
  $$('#paras .para').forEach(p => { if (p.querySelector('.ed')) return;
    const b = document.createElement('button'); b.className = 'ed'; b.type = 'button'; b.title = 'Metni düzelt (çift tıklayarak da)'; b.setAttribute('aria-label', 'Metni düzelt'); b.innerHTML = SVG_KALEM;
    b.onclick = e => { e.stopPropagation(); duzeltBasla(p); }; p.querySelector('.cp')?.before(b); });
}
document.addEventListener('dblclick', e => { const x = e.target.closest('#paras .para .x'); if (!x || state.secim || KR.acik || state.gorunumDil !== 'orijinal') return; window.getSelection()?.removeAllRanges(); duzeltBasla(x.closest('.para')); });
function duzeltBasla(p){
  if (p.classList.contains('duzen')) return; $$('#paras .para.duzen').forEach(duzeltBitir);
  const i = +p.dataset.i, par = state.sonuc.paragraflar[i], x = p.querySelector('.x');
  p._eski = x.innerHTML; p.classList.add('duzen'); x.textContent = par.metin;
  try{ x.contentEditable = 'plaintext-only'; }catch(e){ x.contentEditable = 'true'; }
  const bar = document.createElement('div'); bar.className = 'edbar'; bar.innerHTML = '<span>Return kaydeder, Esc vazgeçer. Düzelttiğiniz adları sonraki videolarda doğru yazarım.</span><span class="sp"></span><button class="sbtn plain" type="button">Vazgeç</button><button class="sbtn blue" type="button">Kaydet</button>';
  x.after(bar); const [vaz, kay] = bar.querySelectorAll('button');
  vaz.onclick = () => duzeltBitir(p); kay.onclick = () => duzeltKaydet(p, i);
  x.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); duzeltKaydet(p, i); } else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); duzeltBitir(p); } };
  x.focus(); const r = document.createRange(); r.selectNodeContents(x); r.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
function duzeltBitir(p){ const x = p.querySelector('.x'); x.removeAttribute('contenteditable'); x.onkeydown = null; if (p._eski != null) x.innerHTML = p._eski; p.querySelector('.edbar')?.remove(); p.classList.remove('duzen'); }
async function duzeltKaydet(p, i){
  const par = state.sonuc.paragraflar[i], metin = p.querySelector('.x').innerText.replace(/\s+/g, ' ').trim(), temel = aktif();
  if (!metin){ toast('Metin boş olamaz'); return; }
  if (metin === par.metin){ duzeltBitir(p); return; }
  try{
    const j = await post('/api/metin-duzelt/' + encodeURIComponent(temel), {bas: par.bas ?? par.sn, bit: par.bit, metin});
    p._eski = null; await sonucGoster(temel, {sessiz: true});
    toast('Düzeltildi · Word, metin ve altyazı güncellendi' + (j.ogrenilen?.length ? ` · öğrendim: ${j.ogrenilen.join(', ')}` : ''), 'Geri al', async () => {
      try{ await post('/api/geri-al/' + encodeURIComponent(temel)); await sonucGoster(temel, {sessiz: true}); toast('Geri alındı'); }catch(e){ toast(e.message); } }, 6000);
  }catch(e){ toast(e.message); }
}

/* ---------------------------------------------------------------- 2) yayın paketi */
let ypTimer = null;
const YP_ACIKLAMA = 'YouTube başlıkları, açıklama ve bölümler, etiketler, kapak yazıları ve görselleri, Shorts kesitleri, Instagram ve LinkedIn metni.';
async function yayinCiz(temel, ilk){
  let k = $('#yayinKutu');
  if (!k){ k = document.createElement('div'); k.className = 'ozet'; k.id = 'yayinKutu'; const once = $('#paylasimKutu') || $('#ozetKutu'); if (!once) return; once.after(k); }
  let d; try{ d = await json('/api/yayin-durum/' + encodeURIComponent(temel)); }catch(e){ k.remove(); return; }
  if (aktif() !== temel) return;
  clearTimeout(ypTimer);
  const p = d.paket;
  const markaSec = `<select class="sel" id="ypMarka" title="Marka seçilirse markanın tonu, zorunluları ve yasakları uygulanır"><option value="">Markasız</option>${d.markalar.map(m => `<option value="${esc(m.kod)}"${(p?.marka || d.onerilen_marka) === m.kod ? ' selected' : ''}>${esc(m.ad)}</option>`).join('')}</select>`;
  if (d.calisiyor){
    k.innerHTML = `<h4>Yayın paketi</h4><div class="yp-ilerle"><div class="pbar mini"><div style="width:60%"></div></div><span>${esc((d.log || []).slice(-1)[0] || 'Hazırlanıyor…')}</span></div>`;
    ypTimer = setTimeout(() => yayinCiz(temel), 3000); return; }
  if (!p){
    k.innerHTML = `<h4>Yayın paketi</h4><div class="yp-ust"><p>${YP_ACIKLAMA} Yaklaşık 1-2 dakika.</p>${markaSec}<button class="sbtn" type="button" id="ypHazirla">Hazırla</button></div>${d.hata ? `<div class="hint" style="color:var(--red)">${esc(d.hata)}</div>` : ''}`;
    $('#ypHazirla').onclick = () => yayinBaslat(temel); return; }
  const y = p.youtube || {}, z = s => zamanK(s);
  const satir = (parca, metin, ek = '', alt = '') => `<div class="yp-s" data-p="${parca}" data-m="${esc(metin)}"><div class="m">${ek}${esc(metin)}${alt ? `<small>${alt}</small>` : ''}</div><div class="acts"><button type="button" data-a="kopya" title="Kopyala">Kopyala</button><button type="button" data-a="iyi" title="Beğendim; sonraki paketler buna benzesin" aria-label="Beğendim"><svg viewBox="0 0 24 24"><path d="M7 11v9H4v-9z"/><path d="M7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/></svg></button><button type="button" data-a="kotu" title="Beğenmedim; nedenini yazabilirsiniz" aria-label="Beğenmedim"><svg viewBox="0 0 24 24"><path d="M17 13V4h3v9z"/><path d="M17 13l-4 7c-1.5 0-2.5-1-2.2-2.6L11.4 14H5a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 6.2 4H17"/></svg></button></div></div>`;
  const kapakV = (p.kapak_gorsel || []);
  k.innerHTML = `<h4>Yayın paketi${p.marka_ad ? ' · ' + esc(p.marka_ad) : ''}</h4>
    ${(y.basliklar || []).length ? `<div class="yp-b"><h5>YouTube başlıkları</h5>${y.basliklar.map(b => satir('baslik', b)).join('')}</div>` : ''}
    ${d.aciklama_tam ? `<div class="yp-b"><h5>Açıklama ve bölümler<span class="sp"></span></h5>${satir('aciklama', d.aciklama_tam)}</div>` : ''}
    ${(y.etiketler || []).length ? `<div class="yp-b"><h5>Etiketler<span class="sp"></span><button class="tiny" type="button" id="ypEtKop">Kopyala</button></h5><div class="yp-et">${y.etiketler.map(t => `<span>${esc(t)}</span>`).join('')}</div></div>` : ''}
    ${(p.kapak || []).length ? `<div class="yp-b"><h5>Kapak<span class="sp"></span>${kapakV.length ? '' : `<button class="tiny" type="button" id="ypKapakCiz" title="Videodan en iyi yüz karelerini seçip kapak yazısıyla çizer">Görselleri çiz</button>`}</h5>
        ${kapakV.length ? `<div class="yp-kapak">${kapakV.map(a => `<a href="/yayin-kapak/${encodeURIComponent(a)}?indir=1" download title="İndir"><img src="/yayin-kapak/${encodeURIComponent(a)}?t=${Math.round(p.zaman)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
        ${p.kapak.map(c => satir('kapak', `${c.satir1} / ${c.satir2}`, '', esc(c.neden || ''))).join('')}</div>` : ''}
    ${(p.shorts || []).length ? `<div class="yp-b"><h5>Shorts ve Reels<span class="sp"></span><button class="tiny" type="button" id="ypShorts" title="Dikey, yüz takipli, kelime kelime altyazılı videolar (üstte kanca başlığı)">Videolarını oluştur</button></h5>
        ${p.shorts.map(s => satir('shorts', `${s.shorts_baslik}`, `<button type="button" class="yp-z" data-sn="${s.bas}">${z(s.bas)}–${z(s.bit)}</button> `, esc(`${s.aciklama || ''} ${(s.etiketler || []).join(' ')}`))).join('')}</div>` : ''}
    ${p.instagram ? `<div class="yp-b"><h5>Instagram</h5>${satir('instagram', p.instagram.aciklama + '\n\n' + (p.instagram.etiketler || []).join(' '))}</div>` : ''}
    ${p.linkedin ? `<div class="yp-b"><h5>LinkedIn</h5>${satir('linkedin', p.linkedin.metin + '\n\n' + (p.linkedin.etiketler || []).join(' '))}</div>` : ''}
    <div class="yp-ust" style="margin-top:14px">${markaSec}<span class="hint" style="flex:1">Beğendiklerinizi ve kopyaladıklarınızı sonraki paketlerde dikkate alırım.</span><button class="sbtn plain" type="button" id="ypYeniden">Yeniden hazırla</button><a class="sbtn" href="/indir/${encodeURIComponent(temel)}.yayin.docx" download>Word</a></div>`;
  $('#ypYeniden').onclick = () => yayinBaslat(temel);
  $('#ypEtKop')?.addEventListener('click', () => { kopyala(y.etiketler.join(', '), 'Etiketler kopyalandı'); post(`/api/yayin/${encodeURIComponent(temel)}/tercih`, {parca: 'etiket', metin: y.etiketler.join(', '), iyi: true, kopya: true}); });
  $('#ypKapakCiz')?.addEventListener('click', async e => { e.target.disabled = true; try{ await post(`/api/yayin/${encodeURIComponent(temel)}/kapak`); toast('Kapak görselleri çiziliyor; video gerekiyorsa önce iner'); yayinCiz(temel); }catch(er){ toast(er.message); e.target.disabled = false; } });
  $('#ypShorts')?.addEventListener('click', async e => { e.target.disabled = true; try{ const j = await post(`/api/yayin/${encodeURIComponent(temel)}/shorts`); toast(`${j.sayi} Shorts videosu sıraya alındı`); isGoster(); }catch(er){ toast(er.message); e.target.disabled = false; } });
  k.querySelectorAll('.yp-z').forEach(b => b.onclick = () => gitSn(+b.dataset.sn));
  k.querySelectorAll('.yp-s .acts button').forEach(b => b.onclick = e => {
    const s = b.closest('.yp-s'), parca = s.dataset.p, metin = s.dataset.m, url = `/api/yayin/${encodeURIComponent(temel)}/tercih`;
    if (b.dataset.a === 'kopya'){ kopyala(metin, 'Kopyalandı'); post(url, {parca, metin, iyi: true, kopya: true}); return; }
    if (b.dataset.a === 'iyi'){ b.classList.add('on'); post(url, {parca, metin, iyi: true}); toast('Not aldım; sonraki paketler buna benzeyecek'); return; }
    popover(b, [['Neden beğenmediniz? (isteğe bağlı)', null]], {input: {placeholder: 'ör. çok uzun, tık tuzağı gibi', dugme: 'Kaydet', onEnter: not => { b.classList.add('on'); post(url, {parca, metin, iyi: false, not}); toast('Not aldım; bir dahaki pakette kaçınırım'); }}});
    setTimeout(() => { const i = $('.pop input'); if (i){ i.onkeydown = ev => { if (ev.key === 'Enter'){ ev.preventDefault(); const not = i.value.trim(); kapatPop(); b.classList.add('on'); post(url, {parca, metin, iyi: false, not}); toast('Not aldım; bir dahaki pakette kaçınırım'); } }; } }, 0);
  });
}
async function yayinBaslat(temel){
  const marka = $('#ypMarka')?.value || '';
  try{ await post('/api/yayin/' + encodeURIComponent(temel), {marka}); toast('Yayın paketi hazırlanıyor (1-2 dk)'); sekmeSec('yayin'); yayinCiz(temel); }
  catch(e){ toast(e.message); }
}

/* ---------------------------------------------------------------- 3) kurgu (metinden düzenleme) */
const KR = {acik: false, sira: [], cikan: new Set(), gecmis: [], ileri: [], id: '', ad: '', oynat: null, kayitli: []};
function kurguBar(){
  let b = $('#kurgubar'); if (b) return b;
  b = document.createElement('div'); b.className = 'klipbar'; b.id = 'kurgubar';
  b.innerHTML = `<span id="krT"></span><span class="sp"></span>
    <button class="ikon" type="button" id="krGeri" title="Geri al (⌘Z)"><svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg></button>
    <button class="ikon" type="button" id="krIleri" title="Yinele (⇧⌘Z)"><svg viewBox="0 0 24 24"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg></button>
    <button class="sbtn" type="button" id="krOnizle" title="Kurguyu sırasıyla oynatır">▶ Önizle</button>
    <button class="sbtn" type="button" id="krKayit" aria-haspopup="menu">Kurgular ▾</button>
    <button class="sbtn blue" type="button" id="krOlustur" aria-haspopup="menu">Videoyu oluştur ▾</button>
    <button class="sbtn plain" type="button" id="krVaz">Kapat</button>`;
  document.body.appendChild(b);
  $('#krGeri').onclick = () => kurguGeri(); $('#krIleri').onclick = () => kurguIleri();
  $('#krOnizle').onclick = kurguOnizle; $('#krVaz').onclick = kurguKapat;
  $('#krKayit').onclick = e => popover(e.currentTarget, [
    ['Kaydet…', null],
    ...(KR.id ? [[`“${KR.ad}” olarak kaydet`, () => kurguKaydet(KR.ad, KR.id)]] : []),
    ['Yeni adla kaydet…', () => setTimeout(() => popover($('#krKayit'), [], {input: {placeholder: 'Kurgunun adı (ör. 60 sn tanıtım)', dugme: 'Kaydet', onEnter: ad => kurguKaydet(ad, '')}}), 30)],
    ...(KR.kayitli.length ? [null, ['Kayıtlı kurgular', null], ...KR.kayitli.map(k => [`${k.ad} · ${sure(k.sure)}`, () => kurguYukle(k)])] : []),
    ...(KR.id ? [null, ['Bu kurguyu sil', () => sheet('Kurgu silinsin mi?', `“${KR.ad}” kayıtlı kurgulardan kaldırılır; üretilmiş videolar kalır.`, 'Sil', async () => { const j = await post('/api/kurgu/' + encodeURIComponent(aktif()), {sil: KR.id}); KR.kayitli = j.kurgular; KR.id = ''; KR.ad = ''; kurguOzet(); toast('Kurgu silindi'); })]] : [])]);
  $('#krOlustur').onclick = e => popover(e.currentTarget, [['Yatay, altyazılı', () => kurguOlustur({})], ['Dikey (9:16), altyazılı', () => kurguOlustur({dikey: true, stil: 'pop'})], ['Yatay, altyazısız', () => kurguOlustur({altyazisiz: true})], ['Dikey, altyazısız', () => kurguOlustur({dikey: true, altyazisiz: true})]]);
  return b;
}
function kurguDurum(){ return {sira: [...KR.sira], cikan: [...KR.cikan]}; }
function kurguIz(){ KR.gecmis.push(kurguDurum()); if (KR.gecmis.length > 100) KR.gecmis.shift(); KR.ileri = []; }
function kurguGeri(){ if (!KR.gecmis.length) return; KR.ileri.push(kurguDurum()); const s = KR.gecmis.pop(); KR.sira = s.sira; KR.cikan = new Set(s.cikan); kurguCiz(); }
function kurguIleri(){ if (!KR.ileri.length) return; KR.gecmis.push(kurguDurum()); const s = KR.ileri.pop(); KR.sira = s.sira; KR.cikan = new Set(s.cikan); kurguCiz(); }
function kurguTut(){
  const pl = state.sonuc.paragraflar, out = [];
  KR.sira.filter(i => !KR.cikan.has(i)).forEach(i => { const a = pl[i].bas ?? pl[i].sn, b = pl[i].bit; const son = out[out.length - 1];
    if (son && son[2] === i - 1 && Math.abs(son[1] - a) < 1.5) { son[1] = b; son[2] = i; } else out.push([a, b, i]); });
  return out.map(([a, b]) => [Math.max(0, a - 0.05), b + 0.1]);
}
function kurguOzet(){
  const tut = kurguTut(), sn = tut.reduce((t, [a, b]) => t + (b - a), 0), n = KR.sira.length - KR.cikan.size;
  const tasindi = KR.sira.some((v, k) => k && v < KR.sira[k - 1]);
  $('#krT').innerHTML = `${KR.ad ? `<b>${esc(KR.ad)}</b> · ` : ''}<b>${n}</b> paragraf · <b>${sure(sn)}</b>${tasindi ? ' · sıra değişti' : ''}`;
  $('#krGeri').disabled = !KR.gecmis.length; $('#krIleri').disabled = !KR.ileri.length; $('#krOlustur').disabled = !n;
}
function kurguCiz(){
  const kutu = $('#paras'); if (!kutu) return;
  const el = {}; $$('#paras .para').forEach(p => el[+p.dataset.i] = p);
  KR.sira.forEach((i, k) => { const p = el[i]; if (!p) return; kutu.appendChild(p); p.classList.toggle('cik', KR.cikan.has(i)); p.classList.toggle('tasindi', k > 0 && i < KR.sira[k - 1]); p.draggable = true; });
  kurguOzet();
}
async function kurguAc(){
  if (!state.sonuc) return; if (state.secim) secimBitir(); $$('#paras .para.duzen').forEach(duzeltBitir);
  if (state.gorunumDil !== 'orijinal'){ state.gorunumDil = 'orijinal'; await sonucGoster(aktif(), {sessiz: true}); }
  sekmeSec('metin'); KR.acik = true; KR.sira = state.sonuc.paragraflar.map((_, i) => i); KR.cikan = new Set(); KR.gecmis = []; KR.ileri = []; KR.id = ''; KR.ad = '';
  $('#doc').classList.add('kurgu'); $('#doc').classList.remove('ozetm'); kurguBar().classList.add('show');
  try{ KR.kayitli = await json('/api/kurgu/' + encodeURIComponent(aktif())); }catch(e){ KR.kayitli = []; }
  kurguCiz(); $('#paras').scrollIntoView({behavior: 'smooth', block: 'start'});
  toast('Paragrafa tıklayınca çıkar, sürükleyince yeri değişir. ⌘Z geri alır.', null, null, 5000);
}
function kurguKapat(){ kurguDurdur(); KR.acik = false; $('#doc')?.classList.remove('kurgu'); $('#kurgubar')?.classList.remove('show'); const t = aktif(); if (t) sonucGoster(t, {sessiz: true}); }
function kurguYukle(k){
  kurguIz(); const n = state.sonuc.paragraflar.length;
  if (k.sira?.length){ KR.sira = k.sira.filter(i => i < n); const g = new Set(KR.sira); for (let i = 0; i < n; i++) if (!g.has(i)) KR.sira.push(i); KR.cikan = new Set((k.cikan || []).filter(i => i < n)); }
  else { const pl = state.sonuc.paragraflar; KR.sira = pl.map((_, i) => i); KR.cikan = new Set(KR.sira.filter(i => !k.tut.some(([a, b]) => (pl[i].bas ?? pl[i].sn) >= a - 0.5 && pl[i].bit <= b + 0.5))); }
  KR.id = k.id; KR.ad = k.ad; kurguCiz(); toast(`“${k.ad}” açıldı`);
}
async function kurguKaydet(ad, id){
  const tut = kurguTut(); if (!tut.length){ toast('Kurguda hiç paragraf yok'); return null; }
  try{ const j = await post('/api/kurgu/' + encodeURIComponent(aktif()), {ad, id, tut, ...kurguDurum()}); KR.kayitli = j.kurgular; const k = j.kurgular.find(x => x.ad === ad && (!id || x.id === id)) || j.kurgular[j.kurgular.length - 1];
    KR.id = k.id; KR.ad = k.ad; kurguOzet(); toast(`“${k.ad}” kaydedildi`); return k; }
  catch(e){ toast(e.message); return null; }
}
async function kurguOlustur(sec){
  let k = KR.id ? await kurguKaydet(KR.ad, KR.id) : await kurguKaydet('Kurgu ' + new Date().toLocaleString(((window.DIL || {}).locale || 'tr-TR'), {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}), '');
  if (!k) return;
  try{ await post('/api/kurgu/' + encodeURIComponent(aktif()), {olustur: k.id, ...sec}); toast('Kurgu videosu sıraya alındı; bitince İndirilenler’de'); isGoster(); }catch(e){ toast(e.message); }
}
function kurguDurdur(){ if (KR.oynat){ clearInterval(KR.oynat.t); KR.oynat = null; try{ OY.tur === 'yt' ? OY.p?.pauseVideo?.() : OY.p?.pause?.(); }catch(e){} } $$('#paras .para.calan').forEach(p => p.classList.remove('calan')); const b = $('#krOnizle'); if (b) b.textContent = '▶ Önizle'; }
function kurguOnizle(){
  if (KR.oynat){ kurguDurdur(); return; }
  if (!OY.p){ toast('Önizleme için videonun oynatıcısı gerekiyor (YouTube ya da bilgisayardaki video)'); return; }
  const pl = state.sonuc.paragraflar, liste = KR.sira.filter(i => !KR.cikan.has(i)).map(i => [pl[i].bas ?? pl[i].sn, pl[i].bit, i]);
  if (!liste.length) return; let k = 0;
  const git = () => { $$('#paras .para.calan').forEach(p => p.classList.remove('calan')); const el = $(`#paras .para[data-i="${liste[k][2]}"]`); el?.classList.add('calan'); el?.scrollIntoView({behavior: 'smooth', block: 'center'}); oyGit(liste[k][0]); };
  git(); $('#krOnizle').textContent = '■ Durdur';
  KR.oynat = {t: setInterval(() => { const t = oyZaman(); if (t >= liste[k][1] - 0.08 || t < liste[k][0] - 3){
    if (t < liste[k][0] - 3 && oyCaliyor()) return;
    k++; if (k >= liste.length){ kurguDurdur(); return; }
    const ard = Math.abs(liste[k][0] - liste[k - 1][1]) < 0.6; if (ard){ $$('#paras .para.calan').forEach(p => p.classList.remove('calan')); $(`#paras .para[data-i="${liste[k][2]}"]`)?.classList.add('calan'); } else git(); } }, 90)};
}
// tıklama ve sürükleme: pencere düzeyinde yakalanır (okuma görünümünün kelimeye tıklayınca videoya gitme davranışından önce)
window.addEventListener('click', e => {
  if (!KR.acik) return; const p = e.target.closest('#paras .para'); if (!p || e.target.closest('a')) return;
  e.stopPropagation(); e.preventDefault(); const i = +p.dataset.i; kurguIz(); KR.cikan.has(i) ? KR.cikan.delete(i) : KR.cikan.add(i); kurguCiz();
}, true);
let surIdx = null;
document.addEventListener('dragstart', e => { if (!KR.acik) return; const p = e.target.closest?.('#paras .para'); if (!p) return; surIdx = +p.dataset.i; p.classList.add('surukle'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(surIdx)); });
document.addEventListener('dragend', () => { surIdx = null; $$('#paras .para.surukle,#paras .para.ustune,#paras .para.altina').forEach(p => p.classList.remove('surukle', 'ustune', 'altina')); });
document.addEventListener('dragover', e => { if (!KR.acik || surIdx == null) return; const p = e.target.closest?.('#paras .para'); if (!p) return; e.preventDefault();
  const r = p.getBoundingClientRect(), alt = e.clientY > r.top + r.height / 2; $$('#paras .para.ustune,#paras .para.altina').forEach(x => x.classList.remove('ustune', 'altina')); p.classList.add(alt ? 'altina' : 'ustune'); });
document.addEventListener('drop', e => { if (!KR.acik || surIdx == null) return; const p = e.target.closest?.('#paras .para'); if (!p) return; e.preventDefault(); e.stopPropagation();
  const hedef = +p.dataset.i; if (hedef === surIdx) return; const alt = p.classList.contains('altina');
  kurguIz(); KR.sira = KR.sira.filter(i => i !== surIdx); let k = KR.sira.indexOf(hedef) + (alt ? 1 : 0); KR.sira.splice(k, 0, surIdx); kurguCiz(); }, true);
document.addEventListener('keydown', e => { if (!KR.acik || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || e.target.closest?.('input,textarea,[contenteditable]')) return; e.preventDefault(); e.shiftKey ? kurguIleri() : kurguGeri(); });
document.addEventListener('keydown', e => { if (KR.acik && e.key === 'Escape' && !document.querySelector('.pop')) kurguKapat(); });

/* ---------------------------------------------------------------- 4) altyazı önizlemesi (Düzenlenmiş video paneli) */
function altOnizleKur(){
  const dlg = $('#altPanel'); if (!dlg || dlg.classList.contains('hidden')) return;
  let o = $('#altOnz'); if (!o){ o = document.createElement('div'); o.className = 'alt-onz'; o.id = 'altOnz'; o.innerHTML = '<div class="kare"><img alt="Altyazı önizlemesi" hidden></div><div class="hint">Seçtiğiniz görünüm videoda böyle durur. Görünümü ya da dili değiştirince güncellenir.</div>'; dlg.appendChild(o); }
  altOnizleGuncelle();
}
let onzT = null, onzNo = 0;
function altOnizleGuncelle(){
  const o = $('#altOnz'); if (!o) return; clearTimeout(onzT);
  onzT = setTimeout(() => {
    const stil = $('#altStil2 button[aria-pressed="true"]')?.dataset.v || 'kutu', dil = $('#altDil button[aria-pressed="true"]')?.dataset.v || 'orijinal';
    const sn = (OY.p && oyZaman() > 2) ? oyZaman() : (veri().sure || 60) * 0.3;
    const img = o.querySelector('img'); img.classList.add('yuk');
    const u = `/api/altyazi-onizle/${encodeURIComponent(aktif())}?stil=${stil}&dil=${dil}&sn=${Math.round(sn)}`;
    const no = ++onzNo;   // hızlı değiştirince geç gelen eski görsel yenisinin üstüne yazmasın
    const yeni = new Image(); yeni.onload = () => { if (no !== onzNo) return; img.src = u; img.hidden = false; img.classList.remove('yuk'); }; yeni.onerror = () => { if (no !== onzNo) return; o.querySelector('.hint').textContent = 'Önizleme için video ya da kapak görseli bulunamadı.'; img.classList.remove('yuk'); }; yeni.src = u;
  }, 120);
}
document.addEventListener('click', e => { if (e.target.closest('#altStil2 button, #altDil button')) setTimeout(altOnizleGuncelle, 0); });

/* ---------------------------------------------------------------- 5) kitaplık süzgeci ve sahnelerde arama */
const SZ = {q: '', kaynak: 'tum', sure: 'tum', kanal: '', sahne: false};
function suzgecKur(){
  if ($('#stSuz') || !$('#hist')) return;
  const d = document.createElement('div'); d.className = 'st-suz'; d.id = 'stSuz';
  d.innerHTML = `<label class="ara"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="szQ" type="search" placeholder="Başlıkta ya da kanalda ara" aria-label="Kitaplıkta ara"></label>
    <div class="seg mini" id="szSahne" title="Görüntüde arar: videolardaki sahnelerin betimlerinde ve ekrandaki yazılarda"><button type="button" data-v="0" aria-pressed="true">Videolar</button><button type="button" data-v="1" aria-pressed="false">Sahneler</button></div>
    <select class="sel" id="szKaynak" aria-label="Kaynak"><option value="tum">Bütün kaynaklar</option><option value="dosya">Kendi dosyalarım</option><option value="link">Linkten</option><option value="takip">Takip edilen kanallar</option></select>
    <select class="sel" id="szSure" aria-label="Süre"><option value="tum">Her süre</option><option value="kisa">5 dk’dan kısa</option><option value="orta">5–30 dk</option><option value="uzun">30 dk’dan uzun</option></select>
    <select class="sel" id="szKanal" aria-label="Kanal"><option value="">Bütün kanallar</option></select><span class="say" id="szSay"></span>`;
  $('#hist').before(d);
  const sahne = document.createElement('div'); sahne.id = 'stSahne'; sahne.className = 'hidden'; $('#hist').before(sahne);
  let t = null; $('#szQ').oninput = () => { SZ.q = $('#szQ').value.trim(); clearTimeout(t); t = setTimeout(() => SZ.sahne ? sahneAra(false) : suzgecUygula(), SZ.sahne ? 350 : 60); };
  $('#szQ').onkeydown = e => { if (e.key === 'Enter' && SZ.sahne){ e.preventDefault(); sahneAra(true); } };
  $('#szKaynak').onchange = () => { SZ.kaynak = $('#szKaynak').value; suzgecUygula(); };
  $('#szSure').onchange = () => { SZ.sure = $('#szSure').value; suzgecUygula(); };
  $('#szKanal').onchange = () => { SZ.kanal = $('#szKanal').value; suzgecUygula(); };
  $$('#szSahne button').forEach(b => b.onclick = () => { SZ.sahne = b.dataset.v === '1'; $$('#szSahne button').forEach(x => x.setAttribute('aria-pressed', x === b));
    $('#szQ').placeholder = SZ.sahne ? 'Sahne tarif edin: “dışarıda iki kişi”, “logo görünen anlar”' : 'Başlıkta ya da kanalda ara';
    ['#szKaynak', '#szSure', '#szKanal'].forEach(s => $(s).classList.toggle('hidden', SZ.sahne)); $('#hist').classList.toggle('hidden', SZ.sahne && state.libTab === 'tx'); $('#stSahne').classList.toggle('hidden', !SZ.sahne);
    if (SZ.sahne){ $('#szSay').textContent = ''; sahneAra(false); } else suzgecUygula(); $('#szQ').focus(); });
  new MutationObserver(() => suzgecUygula()).observe($('#hist'), {childList: true});
  suzgecUygula();
}
function suzgecUygula(){
  const L = (state.tumListe || []).filter(x => !x.toplanti && !x.atolye), bilgi = {}; L.forEach(x => bilgi[x.temel] = x);
  const kanal = {}; L.forEach(x => { if (x.kanal) kanal[x.kanal] = (kanal[x.kanal] || 0) + 1; });
  const sk = $('#szKanal'); if (sk){ const sec = sk.value; sk.innerHTML = '<option value="">Bütün kanallar</option>' + Object.entries(kanal).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<option value="${esc(k)}">${esc(k)} (${n})</option>`).join(''); sk.value = sec; sk.classList.toggle('hidden', sk.options.length < 2 || SZ.sahne); }
  $('#stSuz')?.classList.toggle('hidden', L.length < 6 || state.libTab !== 'tx');
  const q = SZ.q.toLocaleLowerCase('tr'); let n = 0, top = 0;
  $$('#hist .hc').forEach(c => { const x = bilgi[c.dataset.t]; if (!x) return; top++;
    const dosya = !/^https?:/.test(x.link || ''), dk = (x.sure || 0) / 60;
    const ok = (!q || `${x.baslik} ${x.kanal}`.toLocaleLowerCase('tr').includes(q))
      && (SZ.kaynak === 'tum' || (SZ.kaynak === 'dosya' && dosya) || (SZ.kaynak === 'link' && !dosya && !x.takip) || (SZ.kaynak === 'takip' && x.takip))
      && (SZ.sure === 'tum' || (SZ.sure === 'kisa' && dk < 5) || (SZ.sure === 'orta' && dk >= 5 && dk <= 30) || (SZ.sure === 'uzun' && dk > 30))
      && (!SZ.kanal || x.kanal === SZ.kanal);
    c.style.display = ok ? '' : 'none'; if (ok) n++; });
  const say = $('#szSay'); if (say) say.textContent = n < top && !SZ.sahne ? `${n} / ${top}` : '';
}
async function sahneAra(akilli){
  const k = $('#stSahne'); if (!k) return;
  if (!SZ.q){ let d = {}; try{ d = (await json('/api/sahne-ara?q=')).durum || {}; }catch(e){}
    k.innerHTML = `<div class="st-sahne-ust">${d.video ? `${d.video} videonun ${d.sahne} sahnesi aranabilir. Bir sahne tarif edin; Return yapay zekâyla anlamca arar.` : 'Henüz aranabilir video yok. Studio boşta kaldıkça bilgisayarınızdaki videoları kendiliğinden ekler; bir videoyu hemen eklemek için okuma görünümünde Video ▾ → Görüntüde aranabilir yap.'}</div>`; return; }
  k.innerHTML = `<div class="st-sahne-ust">${akilli ? 'Yapay zekâ sahneleri tarıyor…' : 'Aranıyor…'}</div>`;
  let j; try{ j = await json('/api/sahne-ara?q=' + encodeURIComponent(SZ.q) + (akilli ? '&akilli=1' : '')); }catch(e){ k.innerHTML = `<div class="st-sahne-ust">${esc(e.message)}</div>`; return; }
  const s = j.sonuclar || [];
  k.innerHTML = `<div class="st-sahne-ust"><span>${s.length ? `${s.length} sahne` : 'Eşleşen sahne yok.'}${j.durum?.video ? ` · ${j.durum.video} videoda arandı` : ''}</span><span class="sp"></span>${akilli ? '' : '<button class="sbtn plain" type="button" id="szAkilli" title="Kelime eşleşmesi yerine anlamca arar">Anlamca ara</button>'}</div>
    <div class="st-sahne">${s.map(x => `<button type="button" class="sc" data-t="${esc(x.temel)}" data-sn="${x.sn}"><img src="/kare/${encodeURIComponent(x.temel)}/${esc(x.kare)}" alt="" loading="lazy"><div class="b"><b>${esc(zamanK(x.sn))} · ${esc(x.baslik)}</b><span>${esc(x.aciklama || x.yazi)}</span></div></button>`).join('')}</div>`;
  $('#szAkilli')?.addEventListener('click', () => sahneAra(true));
  k.querySelectorAll('.sc').forEach(b => b.onclick = () => sonucGoster(b.dataset.t, {sn: +b.dataset.sn}));
}

/* ---------------------------------------------------------------- 6) indirilenleri temizleme önerisi */
let temizZaman = 0, temizVeri = null;
async function temizlikKur(){
  const h = $('#dls'); if (!h || h.querySelector('.st-temiz')) return;
  if (Date.now() - temizZaman > 60000){ try{ temizVeri = await json('/api/indirilenler/temizlik'); temizZaman = Date.now(); }catch(e){ return; } }
  const d = temizVeri; if (!d?.dosyalar?.length || h.querySelector('.st-temiz')) return;
  const b = document.createElement('div'); b.className = 'st-temiz';
  b.innerHTML = `<span><b>${d.dosyalar.length} video ${MB(d.toplam)}</b> yer tutuyor; ${d.gun} gündür açılmadı.</span><button class="sbtn plain" type="button">Hangileri?</button><button class="sbtn red" type="button">Kaldır</button>`;
  const [goster, kaldir] = b.querySelectorAll('button');
  goster.onclick = e => popover(e.currentTarget, d.dosyalar.slice(0, 14).map(x => [`${x.baslik.slice(0, 48)} · ${MB(x.boyut)}`, () => {}]));
  kaldir.onclick = () => sheet(`${d.dosyalar.length} video kaldırılsın mı?`, `${MB(d.toplam)} yer açılır. Videolar çöpe gider; bir gün içinde geri alabilirsiniz, sonra tamamen silinir. Transkriptler kalır.`, 'Kaldır', async () => {
    try{ const j = await post('/api/indirilenler/temizle', {dosyalar: d.dosyalar.map(x => x.ad)}); temizZaman = 0; b.remove(); indirilenlerYukle();
      toast(`${j.dosyalar.length} video kaldırıldı`, 'Geri al', async () => { for (const ad of j.dosyalar) await fetch('/api/indirilen-geri/' + encodeURIComponent(ad), {method: 'POST'}); indirilenlerYukle(); toast('Geri alındı'); }, 8000); }
    catch(e){ toast(e.message); } });
  h.prepend(b);
}

/* ---------------------------------------------------------------- 7) menüler ve Sonraki adımlar */
const _popover = popover;
popover = function(anchor, items, opts){   // eslint-disable-line no-global-assign
  const v = veri(), temel = aktif();
  if (anchor?.id === 'dosyaMenu' && temel){
    const tur = (v.turemisler || []).length;
    items = [['Paylaşılabilir sayfa (tek dosya)', () => { location.href = '/disa/' + encodeURIComponent(temel) + '.html?indir=1'; toast('Sayfa indiriliyor; e-postayla ya da mesajla gönderebilirsiniz'); }],
      ['Sayfayı önizle ↗', () => window.open('/disa/' + encodeURIComponent(temel) + '.html', '_blank')], null, ...items, null, ['Hepsi tek dosyada (zip)', () => { location.href = '/zip/' + encodeURIComponent(temel) + '.zip'; toast('Zip hazırlanıyor'); }],
      ...(tur ? [[`Hepsi + üretilen ${tur} video (zip)`, () => { location.href = '/zip/' + encodeURIComponent(temel) + '.zip?video=1'; toast('Zip hazırlanıyor; videolar büyükse biraz sürer'); }]] : []),
      ...(v.yayin ? [['Yayın paketi (Word)', () => indirDosya(temel + '.yayin.docx', 'Yayın paketi')]] : [])];
  }
  if (anchor?.id === 'videoBtn' && temel){
    const http = /^https?:/.test(v.link || '');
    items = [...items, null, ['Metinden kurgu… (sırala, çıkar, önizle)', kurguAc], ['Yayın paketi…', () => { sekmeSec('yayin', true); if (!v.yayin) yayinBaslat(temel); }],
      ['Görüntüde aranabilir yap', async () => { try{ await post('/api/sahne-dizin/' + encodeURIComponent(temel)); toast('Sahneler çıkarılıp betimleniyor (1-3 dk); sonra Kitaplık → Sahneler’de aranır'); }catch(e){ toast(e.message); } }],
      ...(document.documentElement.dataset.misafir === '1' ? [] : [null, ...(http ? [['Content’te kendi versiyonunu yap ↗', () => window.open(port(8769) + '?link=' + encodeURIComponent(v.link) + '&istek=', '_blank')]] : [])])];
  }
  return _popover(anchor, items, opts);
};
function sonrakiEkle(temel, v){
  const sl = $('#stSonra .sl'); if (!sl || sl.querySelector('[data-st]')) return;
  const ek = [['yp', 'Yayın paketi', v.yayin ? 'Hazır. Başlık, açıklama, kapak, Shorts.' : 'Başlık, açıklama, bölümler, kapak, Shorts.'], ['kr', 'Metinden kurgu', 'Paragrafları sırala, çıkar, önizle.']];
  // Content 28 Ekim'den beri video üretmiyor, "bu video nasıl yapılmış?" sorusunu yanıtlıyor; kart yalnız Content kuruluysa
  const contentVar = (document.documentElement.dataset.urunler || 'content').split(',').includes('content');
  if (contentVar && /^https?:/.test(v.link || '') && document.documentElement.dataset.misafir !== '1') ek.push(['ct', 'Nasıl yapılmış?', 'Kullanılan araçlar ve adım adım yapılışı (Content).']);
  ek.forEach(([a, t, s]) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.st = a; b.innerHTML = `${esc(t)}<small>${esc(s)}</small>`; sl.appendChild(b);
    b.onclick = () => { if (a === 'yp'){ sekmeSec('yayin', true); if (!v.yayin) yayinBaslat(temel); }
      else if (a === 'kr') kurguAc(); else window.open(port(8769) + '?link=' + encodeURIComponent(v.link) + '&istek=', '_blank'); }; });
}

/* ---------------------------------------------------------------- 8) Ayarlar → Sistem → Studio gelişimi */
async function gelisimCiz(){
  const kutu = $('#aySistem'); if (!kutu) return;
  let d; try{ d = await json('/api/studio-gelisim'); }catch(e){ return; }
  let g = $('#stGelisim'); if (!g){ g = document.createElement('div'); g.id = 'stGelisim'; kutu.after(g); }
  const ay = d.ayar || {};
  const zaman = t => t ? new Date(t * 1000).toLocaleString(((window.DIL || {}).locale || 'tr-TR'), {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : '—';
  const satir = (et, ic, act = '') => `<div class="row"><div class="l">${et}<small>${ic}</small></div>${act ? `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">${act}</div>` : ''}</div>`;
  const tog = (id, ac) => `<button class="tog" type="button" role="switch" id="${id}" aria-checked="${ac}"></button>`;
  const A = Object.entries(d.araclar || {}), yeni = A.filter(([, x]) => x.yeni), cal = d.calisiyor || {};
  const arac = yeni.length ? yeni.map(([k, x]) => `<div><b>${esc(x.ne)}</b> · ${esc(x.kurulu)} → ${esc(x.son)}${x.ozet ? ' · ' + esc(x.ozet) : ''}${x.risk ? ` <span style="color:var(--orange)">· ${esc(x.risk)}</span>` : ''} ${x.otomatik ? '<i>(kendiliğinden güncellenir)</i>' : `<button class="tiny" type="button" data-gun="${esc(k)}">${cal['gelisim:guncelle:' + k] ? 'Güncelleniyor…' : 'Güncelle'}</button>`}</div>`).join('')
    : `Hepsi güncel (${A.length} araç; son bakış ${zaman(d.araclar_zaman)}).`;
  const gun = (d.guncellemeler || []).slice(0, 3).map(x => `${zaman(x.zaman)} ${x.tamam ? '✓' : '✕'} ${esc(x.mesaj)}`).join('<br>');
  const takip = (d.takip?.maddeler || []).slice(0, 6).map(m => `<div>• ${esc(m.neden || m.baslik)} <a href="${esc(m.link)}" target="_blank" rel="noopener">kaynak ↗</a>${m.oneri ? `<br><span style="color:var(--muted)">${esc(m.oneri)}</span>` : ''}</div>`).join('');
  const oneri = (d.oneriler || []).slice(0, 6).map(o => `<div class="gl-oneri"><span style="flex:1;min-width:200px"><b>${esc(o.baslik)}</b><br><span style="color:var(--muted)">${esc(o.ne_yapilir || o.neden || '')}</span></span><button class="tiny" type="button" data-on="${esc(o.id)}" data-k="1">Yapılsın</button><button class="tiny" type="button" data-on="${esc(o.id)}" data-k="0">Gerek yok</button></div>`).join('');
  const dz = d.duzeltme || {}, sh = d.sahne || {}, tm = d.temizlik || {};
  g.innerHTML = `<h4 class="ayh">Studio gelişimi</h4>`
    + satir('Bu hafta', d.rapor ? `${esc(d.rapor.ozet)} <span style="color:var(--muted)">(${esc(d.rapor.tarih)})</span>` : 'Studio her pazartesi kendi kullanımını, araç güncellemelerini ve video dünyasındaki gelişmeleri gözden geçirip burada özetler.',
      `<button class="sbtn" type="button" id="glTara">${cal['gelisim:tara'] ? 'Taranıyor…' : 'Şimdi tara'}</button>`)
    + satir('Araçlar', `<div class="gl-arac">${arac}</div>${gun ? `<div style="margin-top:6px">${gun}</div>` : ''}`)
    + (takip ? satir('Gelişmeler', takip) : '')
    + (oneri ? satir('Öneriler', `<div class="gl-arac">${oneri}</div><div style="margin-top:4px">Kabul ettikleriniz bir sonraki Claude oturumunda yapılacaklar listesine girer.</div>`) : '')
    + satir('Öğrenilen yazımlar', dz.terimler?.length ? `${dz.duzeltme} düzeltmeniz var. Ses modeline öğretilen: ${dz.terimler.slice(0, 20).map(esc).join(', ')}` : 'Okuma görünümünde bir paragrafı düzelttiğinizde (kalem ya da çift tıklama) düzelttiğiniz adları burada toplar ve sonraki videolarda doğru yazarım.')
    + satir('Görüntü araması', `${sh.video || 0} video, ${sh.sahne || 0} sahne aranabilir. Boşta kaldıkça bilgisayarınızdaki videoları kendiliğinden ekler.`, tog('glSahne', ay.sahne_dizini !== false))
    + satir('Kendi videolarınızda yayın paketi', 'Bilgisayarınızdan yüklediğiniz videolar yazıya dökülünce yayın paketi kendiliğinden hazırlanır.', tog('glYayin', ay.yayin_oto !== false))
    + (d.yedek?.liste?.length ? satir('Yedekler', `${d.yedek.liste.length} yedek Drive’da; son: ${esc(d.yedek.liste[0].ad.replace('Video Hub ', ''))} · ${d.yedek.liste[0].boyut_mb} MB${d.yedek.son?.dogrulandi ? ' · doğrulandı' : (d.yedek.son?.hata ? ' · DOĞRULANAMADI: ' + esc(d.yedek.son.hata) : '')}${d.yedek.son?.ses ? ' · ' + d.yedek.son.ses + ' toplantı sesi' : ''}. İçerik: transkriptler, kapaklar, Ghost, Content, Couple, davetler, indirilenler dizini, ayarlar, profil, kod. Geri yüklemek için sohbette "yedekten geri yükle" deyin ya da Terminal'de python geri_yukle.py çalıştırın.${d.yedek.sirlar ? ' Sırlar yalnız bu Mac’te (.yedek/sirlar.json).' : ''}`) : '')
    + ((d.hatalar?.sayi) ? satir('Arka plan hataları', `Site açıldığından beri ${d.hatalar.sayi} beklenmeyen hata. Son: ${esc((d.hatalar.son[0] || {}).kaynak || '')} · ${esc((d.hatalar.son[0] || {}).hata || '')}`) : '')
    + (tm.toplam ? satir('İndirilenler', `${MB(tm.toplam)} yer tutan, ${tm.gun} gündür açılmamış videolar var; Kitaplık → İndirilenler’de kaldırabilirsiniz.`) : '');
  $('#glTara').onclick = async e => { e.target.disabled = true; e.target.textContent = 'Taranıyor…'; try{ await post('/api/studio-gelisim/tara'); toast('Araçlar, gelişmeler ve kullanım taranıyor (birkaç dakika)'); }catch(er){ toast(er.message); } setTimeout(gelisimCiz, 60000); };
  g.querySelectorAll('[data-gun]').forEach(b => b.onclick = () => sheet(`${b.dataset.gun} güncellensin mi?`, 'Güncellemeden sonra kısa bir deneme yapılır (ses tanımada 1-2 dk); çalışmazsa eski sürüme kendiliğinden döner. Bu sırada yeni iş başlatmayın.', 'Güncelle', async () => {
    try{ await post('/api/studio-gelisim/guncelle', {paket: b.dataset.gun}); b.textContent = 'Güncelleniyor…'; b.disabled = true; toast('Güncelleniyor; deneme bitince burada görünür'); setTimeout(gelisimCiz, 90000); }catch(e){ toast(e.message); } }, false));
  g.querySelectorAll('[data-on]').forEach(b => b.onclick = async () => { await post('/api/studio-gelisim/oneri', {id: b.dataset.on, kabul: b.dataset.k === '1'}); toast(b.dataset.k === '1' ? 'Yapılacaklara eklendi' : 'Kaldırıldı'); gelisimCiz(); });
  [['glSahne', 'sahne_dizini', 'Videolar görüntüde aranabilir hale getirilecek', 'Görüntü dizini durdu'], ['glYayin', 'yayin_oto', 'Kendi videolarınızda yayın paketi kendiliğinden', 'Yayın paketi yalnız istediğinizde']].forEach(([id, k, ac, kapa]) => {
    const el = $('#' + id); el.onclick = async () => { const v = el.getAttribute('aria-checked') !== 'true'; el.setAttribute('aria-checked', v); await post('/api/studio-ayar', {[k]: v}); toast(v ? ac : kapa); }; });
}

/* ---------------------------------------------------------------- 8b) Ayarlar → Davetler (kapalı grup: davet linkiyle Studio'yu deneyen arkadaşlar)
   Linkler Cloudflare'in hesapsız tüneliyle dışarı açılır; Mac yeniden başlayınca adres değişir (kullanıcı kabul etti). Misafir yalnız kendi videolarını görür. */
async function davetCiz(){
  if (document.documentElement.dataset.misafir === '1') return;
  const kutu = $('#aySistem'); if (!kutu) return;
  let d; try{ d = await json('/api/davetler'); }catch(e){ return; }
  let g = $('#stDavet'); if (!g){ g = document.createElement('div'); g.id = 'stDavet'; ($('#stGelisim') || kutu).before(g); }
  const zaman = t => t ? new Date(t * 1000).toLocaleString(((window.DIL || {}).locale || 'tr-TR'), {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : 'henüz girmedi';
  const satir = (et, ic, act = '') => `<div class="row"><div class="l">${et}<small>${ic}</small></div>${act ? `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">${act}</div>` : ''}</div>`;
  const aktif = d.kisiler.filter(k => k.aktif).length;
  g.innerHTML = `<h4 class="ayh">Davetler</h4>`
    + satir('Davet linkleri', d.tunel ? (d.adres ? `Açık. Davet ettikleriniz kendi linkleriyle Studio'ya girer; yalnızca kendi videolarını görür, sizin kitaplığınıza, toplantılarınıza ve ayarlarınıza erişemez. Mac yeniden başlarsa adres değişir: o zaman linkleri buradan yeniden kopyalayıp gönderin.` : 'Açılıyor…')
      : 'Kapalı. Açınca her davetliye özel bir link oluşur.', `<button class="tog" type="button" role="switch" id="dvTunel" aria-checked="${d.tunel}"></button>`)
    + d.kisiler.map(k => satir(`${esc(k.ad)}${k.aktif ? '' : ' <span style="color:var(--muted);font-weight:400">· durduruldu</span>'}`,
        `Bugün ${k.bugun}/${d.sinir.gunluk} video · toplam ${k.toplam} · son giriş ${zaman(k.son_giris)}${k.anahtar ? ' · kendi Claude anahtarıyla' : ''}`,
        `${k.link ? `<button class="sbtn" type="button" data-dk="${k.id}">Linki kopyala</button>` : ''}<button class="sbtn plain" type="button" data-dm="${k.id}" aria-haspopup="menu">Diğer ▾</button>`)).join('')
    + (aktif < d.sinir.kisi ? satir('Yeni davet', `En çok ${d.sinir.kisi} kişi · kişi başı günde ${d.sinir.gunluk} video, en çok ${Math.round(d.sinir.en_uzun_sn / 60)} dakika. Sizin işleriniz her zaman önce yapılır.`,
        '<input class="sel" id="dvAd" placeholder="Adı" style="width:140px"><button class="sbtn blue" type="button" id="dvEkle">Davet et</button>') : satir('Yeni davet', `${d.sinir.kisi} kişinin hepsi davet edildi; yenisi için birini kaldırın.`));
  $('#dvTunel').onclick = async e => { const ac = e.currentTarget.getAttribute('aria-checked') !== 'true'; e.currentTarget.setAttribute('aria-checked', ac); toast(ac ? 'Davet linkleri açılıyor…' : 'Davet linkleri kapatılıyor');
    try{ const j = await post('/api/davetler/tunel', {ac}); toast(ac ? (j.adres ? 'Davet linkleri açık' : 'Açıldı; adres birkaç saniye içinde gelir') : 'Davet linkleri kapalı'); }catch(er){ toast(er.message); } davetCiz(); };
  const ekle = async () => { const ad = $('#dvAd').value.trim(); if (!ad) return; try{ const j = await post('/api/davetler', {ad}); if (j.kisi.link){ kopyala(j.kisi.link, `${ad} için link kopyalandı; ona gönderin`); } else toast(`${ad} eklendi; davet linklerini açınca link oluşur`); davetCiz(); }catch(er){ toast(er.message); } };
  $('#dvEkle')?.addEventListener('click', ekle); $('#dvAd')?.addEventListener('keydown', e => { if (e.key === 'Enter') ekle(); });
  g.querySelectorAll('[data-dk]').forEach(b => b.onclick = () => { const k = d.kisiler.find(x => x.id === b.dataset.dk); kopyala(k.link, `${k.ad} için link kopyalandı`); });
  g.querySelectorAll('[data-dm]').forEach(b => b.onclick = e => { const k = d.kisiler.find(x => x.id === b.dataset.dm);
    popover(e.currentTarget, [
      [k.aktif ? 'Durdur (link çalışmaz, videoları kalır)' : 'Yeniden aç', async () => { try{ await post(`/api/davetler/${k.id}`, {aktif: !k.aktif}); davetCiz(); }catch(er){ toast(er.message); } }],
      ['Yeni link oluştur (eskisi çalışmaz)', async () => { await post(`/api/davetler/${k.id}`, {yenile: true}); toast('Yeni link hazır; eskisi artık açılmaz'); davetCiz(); }],
      null, ['Kaldır', () => sheet(`${k.ad} kaldırılsın mı?`, 'Linki kalıcı olarak çalışmaz. Yaptığı videolar bu Mac’te kalır ama hiçbir listede görünmez.', 'Kaldır', async () => { await fetch(`/api/davetler/${k.id}`, {method: 'DELETE'}); davetCiz(); })]]); });
}

/* ---------------------------------------------------------------- 9) okuma görünümü düzeni (2026-10-24 UI/UX geçişi)
   Sağ sütun sekmelere ayrılır: Özet · Metin · Yayın · Klipler (Meet'in toplantı sayfasındaki .tsek sekmeleriyle aynı görünüm). Eskiden asıl
   metin, özet + yayın paketi + öne çıkan anlar kartlarının altında ~5.000 piksel aşağıdaydı. Kapaktaki bilgi rozetleri tek satır olur. */
const SEKME = [['ozet', 'Özet'], ['metin', 'Metin'], ['yayin', 'Yayın'], ['klip', 'Klipler']];
const SEKME_YERI = {ozetKutu: 'ozet', goruntuKutu: 'ozet', notlarimKutu: 'ozet', paras: 'metin', kunye: 'metin', yayinKutu: 'yayin', markaKutu: 'yayin', paylasimKutu: 'yayin', klipKutu: 'klip'};
let stSekme = null;
function sekmeAta(){
  const sag = $('#doc .sagk'); if (!sag) return;
  [...sag.children].forEach(c => { if (c.id === 'stSek') return; c.dataset.stsek = SEKME_YERI[c.id] || (c.classList.contains('tamMetin') || c.classList.contains('kunye') ? 'metin' : 'ozet'); });
  const bos = k => ![...sag.children].some(c => c.dataset.stsek === k && c.offsetHeight + c.textContent.trim().length > 0);
  $$('#stSek button').forEach(b => b.hidden = b.dataset.k === 'klip' && bos('klip'));
}
function sekmeSec(k, kaydir){
  const doc = $('#doc'); if (!doc || !doc.classList.contains('st-sekmeli')) return;
  if (stSekme && typeof stSekme === 'object') stSekme.k = k; doc.dataset.stsek = k; doc.classList.remove('ozetm');
  $$('#stSek button').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === k));
  if (k === 'yayin' && aktif()) yayinCiz(aktif());
  if (kaydir){ const bar = $('#stSek'); const y = bar.getBoundingClientRect().top + scrollY - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--st-ust')) || 56) - 4; if (scrollY > y) window.scrollTo({top: y, behavior: 'smooth'}); }
}
function okumaKur(temel, v, opts){
  const sag = $('#doc .sagk'); if (!sag || v.toplanti) return;
  $('#doc').classList.add('st-sekmeli');
  if (!$('#stSek')){ const bar = document.createElement('div'); bar.className = 'tsek'; bar.id = 'stSek'; bar.setAttribute('role', 'tablist');
    bar.innerHTML = SEKME.map(([k, ad]) => `<button type="button" role="tab" data-k="${k}">${ad}</button>`).join('');
    sag.prepend(bar); bar.querySelectorAll('button').forEach(b => b.onclick = () => sekmeSec(b.dataset.k, true));
    new MutationObserver(sekmeAta).observe(sag, {childList: true}); }
  sekmeAta();
  const ilk = !stSekme || stSekme._t !== temel;
  let k = ilk ? (v.ozet ? 'ozet' : 'metin') : stSekme.k;
  if (opts?.sn != null || KR.acik) k = 'metin';
  stSekme = {k, _t: temel}; sekmeSec(k);
  // kapak rozetleri → tek satır bilgi (bağlantı rozeti metin bağlantısı olarak kalır)
  const ch = $('#doc .cover .chips'); if (ch && !ch.classList.contains('st-meta')){
    const parca = [...ch.children].map(c => c.tagName === 'A' ? `<a href="${esc(c.href)}" target="${esc(c.target || '_blank')}" rel="noopener">${esc(c.textContent.trim())}</a>` : `<span${c.title ? ` title="${esc(c.title)}"` : ''}>${esc(c.textContent.trim())}</span>`);
    ch.innerHTML = parca.join(' <i>·</i> '); ch.classList.add('st-meta'); }   // ayraçlar boşluklu: satır ancak ayraçta kırılabilir
}
['focusin', 'input'].forEach(t => document.addEventListener(t, e => { if (e.target.id === 'ara' && $('#doc.st-sekmeli') && $('#doc').dataset.stsek !== 'metin') sekmeSec('metin'); }));
document.addEventListener('click', e => { if (e.target.closest('#tamMetin')) sekmeSec('metin', true); }, true);

// yapışkan sekme çubuğu üst menünün altında dursun: menünün gerçek yüksekliği ölçülür (telefonda iki satır; --navh değişkeni bunu tutmuyor)
const ustOlc = () => { const n = $('.nav') || $('header'); if (!n) return;
  const yapisik = /sticky|fixed/.test(getComputedStyle(n).position);    // telefonda menü artık kayıyor (2026-10-29): çubuk en üste yapışır
  document.documentElement.style.setProperty('--st-ust', (yapisik ? Math.round(n.getBoundingClientRect().bottom) : 0) + 'px'); };
// telefonda yüzen "Sor", araç çubuğu ekrandayken onun üstüne biniyordu: çubuk görünürken gizlenir
try{ const aracIzle = new IntersectionObserver(es => es.forEach(e => document.body.classList.toggle('st-arac-gorunur', e.isIntersecting)));
  // ayar panellerindeki örnek videolar (altyazı, dublaj, arka plan) gizliyken açılışta 15 dosya indiriliyordu: yalnız görünür olunca yüklenir
  const ornekIzle = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const v = e.target; ornekIzle.unobserve(v); v.preload = 'metadata'; v.load(); }));
  let izlenen = null; setInterval(() => { const t = $('#doc .toolbar'); if (t && t !== izlenen){ izlenen && aracIzle.unobserve(izlenen); aracIzle.observe(izlenen = t); }
    $$('.altcar video[preload="none"]').forEach(v => { if (!v._izl){ v._izl = 1; ornekIzle.observe(v); } }); }, 1500); }catch(e){}
if ($('.nav') || $('header')){ ustOlc(); try{ new ResizeObserver(ustOlc).observe($('.nav') || $('header')); }catch(e){} window.addEventListener('resize', ustOlc); }

/* ---------------------------------------------------------------- 10) ana sayfa: çift birincil düğme ve tekrar eden çıktı satırları */
function mevcutBak(){ document.body.classList.toggle('st-mevcut', !!$('#mevcutAc')); }
if ($('#notice')) new MutationObserver(mevcutBak).observe($('#notice'), {childList: true, subtree: true});

/* ---------------------------------------------------------------- 11) mini oynatıcı ve klavye kısayolları (2026-10-27)
   Oynatıcı eskiden ekranın üstünde 42vh yer kaplayarak yapışık kalıyor, aşağıdaki kartların ve sekmelerin üstüne biniyordu.
   Artık yerinde durur; okurken geçilince sol alt köşede küçük oynatıcı olur (aynı öğe, video yeniden yüklenmez). */
function miniOyKur(){
  const oy = $('#oynatici'); if (!oy || oy._mini) return; oy._mini = true;
  const yapisik = () => { const s = oy.closest('.solk'); return !!s && getComputedStyle(s).position === 'sticky'; };   // geniş ekranda sol sütun zaten görünür kalır
  const yer = document.createElement('div'); yer.className = 'oy-yer'; oy.before(yer);
  const isaret = document.createElement('div'); isaret.className = 'oy-isaret'; oy.after(isaret);
  const kapat = document.createElement('button'); kapat.type = 'button'; kapat.className = 'oy-kapat'; kapat.title = 'Küçük oynatıcıyı kapat'; kapat.setAttribute('aria-label', 'Küçük oynatıcıyı kapat'); kapat.textContent = '×';
  kapat.onclick = e => { e.stopPropagation(); oy.classList.add('mini-gizli'); try{ OY.tur === 'yt' ? OY.p?.pauseVideo?.() : OY.p?.pause?.(); }catch(_){ } };
  oy.appendChild(kapat);
  const io = new IntersectionObserver(([g]) => {
    const mini = !g.isIntersecting && g.boundingClientRect.top < 80 && !yapisik();
    if (mini === oy.classList.contains('mini')) return;
    yer.style.height = mini ? oy.offsetHeight + 'px' : '0';
    oy.classList.toggle('mini', mini); if (!mini) oy.classList.remove('mini-gizli');
  }, {rootMargin: '-80px 0px 0px 0px'});
  io.observe(isaret);
}
/* Tek kişinin konuştuğu videoda (çoğu YouTube videosu) "Konuşmacı 1 · %100" satırı ve her paragraftaki ad tekrar eden gürültü:
   satır tek ad kutusuna iner, paragraf adları gizlenir (ad verilirse yine görünür). */
function tekKonusmaci(v){
  const adlar = new Set((state.sonuc?.paragraflar || []).map(p => p.ad)); const doc = $('#doc'); if (!doc) return;
  const tek = adlar.size === 1, genel = tek && /^Konuşmacı \d+$/.test([...adlar][0]);
  doc.classList.toggle('tekkon', tek); doc.classList.toggle('tekgenel', genel && !v.toplanti);
  const r = $('#adUygula')?.closest('.r2'); if (r && genel){ const l = r.querySelector('.lbl'); if (l) l.textContent = 'Konuşan'; const i = r.querySelector('.spk input'); if (i){ i.placeholder = 'Adını yazın'; i.title = 'Konuşanın adını yazıp kaydedin; sesi de öğrenilir'; } }
}
/* ---------------------------------------------------------------- 12) özeti yenile ▾ (2026-10-27; gelişim önerisi "Özeti ilk seferde doğru yap")
   Tek "Özeti yenile" yerine biçim (kısa / ayrıntılı / madde madde / kendi notunuz), eski sürüme dönme ve seçilen biçimi varsayılan yapma. */
const OZET_BICIM = {kisa: 'Daha kısa', ayrintili: 'Daha ayrıntılı', madde: 'Madde madde'};
async function ozetYenile(temel, v, govde, b){
  b.disabled = true; b.textContent = 'Özet yazılıyor…'; toast('Özet yeniden yazılıyor');
  try{ const j = await post('/api/ozet/' + encodeURIComponent(temel), govde);
    if (aktif() !== temel) return; v.ozet = j.ozet; v.ozet_gecmis = j.ozet_gecmis; $('#ozetKutu').innerHTML = ozetHtml(v); ozetBagla(temel, v);
    toast(govde.varsayilan ? 'Özet hazır; bundan sonraki videolarda da bu biçim' : 'Özet hazır · önceki sürüm saklandı'); }
  catch(e){ toast(e.message || 'Özet yazılamadı'); b.disabled = false; b.textContent = 'Özeti yenile ▾'; }
}
function ozetMenuKur(temel, v){
  const b = $('#ozetCikar'); if (!b || !v.ozet || b._menu) return; b._menu = true; b.textContent = 'Özeti yenile ▾'; b.setAttribute('aria-haspopup', 'menu');
  const gecmis = v.ozet_gecmis || [];
  if (v.ozet.bicim || v.ozet.istek){ const s = document.createElement('span'); s.className = 'hint'; s.textContent = [OZET_BICIM[v.ozet.bicim], v.ozet.istek ? '“' + v.ozet.istek.slice(0, 60) + '”' : ''].filter(Boolean).join(' · '); b.before(s); }
  b.onclick = e => { e.stopPropagation(); const k = (bicim, ek = {}) => () => ozetYenile(temel, v, {bicim, ...ek}, b);
    const tarih = z => z ? new Date(z * 1000).toLocaleString(DIL.locale, {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : 'önceki';
    popover(b, [
      ['Aynı biçimde yeniden yaz', k(v.ozet.bicim || '')],
      ...Object.entries(OZET_BICIM).filter(([kk]) => kk !== v.ozet.bicim).map(([kk, ad]) => [ad, k(kk)]),
      ...(v.ozet.bicim ? [['Bu biçim her videoda varsayılan olsun', () => post('/api/studio-ayar', {ozet_bicim: v.ozet.bicim}).then(() => toast('Yeni videolarda özet ' + OZET_BICIM[v.ozet.bicim].toLowerCase() + ' yazılacak')).catch(() => toast('Kaydedilemedi'))]] : []),
      ...(gecmis.length ? [null, ['Önceki sürümler', null], ...gecmis.map((o, i) => [`${tarih(o.zaman)}${o.bicim ? ' · ' + OZET_BICIM[o.bicim] : ''} · ${String(o.ozet || '').slice(0, 42)}…`, () => post('/api/ozet/' + encodeURIComponent(temel) + '/geri', {i}).then(j => { v.ozet = j.ozet; v.ozet_gecmis = j.ozet_gecmis; $('#ozetKutu').innerHTML = ozetHtml(v); ozetBagla(temel, v); toast('Önceki özete dönüldü'); }).catch(er => toast(er.message))])] : []),
    ], {input: {placeholder: 'Ne değişsin? ör. rakamları da yaz', dugme: 'Yeniden yaz', onEnter: not => ozetYenile(temel, v, {bicim: v.ozet.bicim || '', not}, b)}});
    const pp = document.querySelector('.pop'), r = b.getBoundingClientRect();   // sayfanın sonunda: menü sığmıyorsa düğmenin üstüne açılır
    if (pp && pp.getBoundingClientRect().bottom > innerHeight - 8 && r.top > pp.offsetHeight + 12) pp.style.top = (r.top + scrollY - pp.offsetHeight - 6) + 'px'; };
}
const _ozetBagla = ozetBagla;
ozetBagla = function(temel, v){ _ozetBagla(temel, v); try{ if (!v.toplanti) ozetMenuKur(temel, v); }catch(e){ console.warn(e); } };   // eslint-disable-line no-global-assign
/* ---------------------------------------------------------------- 13) metinden kesme (2026-10-27; gelişim önerisi "Kesim iptalinde emeği koru")
   Vazgeç'e basınca seçilen paragraflar kaybolmaz: aynı videoda Kes yeniden açılınca geri gelir. Duraksama (ee, ıı, hmm) temizliği
   Seçenekler'in içinden çubuğa çıktı; kaç tane olduğu ve kaç saniye kazandıracağı yazar. */
const kesAnahtar = () => 'kesSecim_' + aktif();
const _secimBitir = secimBitir;
secimBitir = function(){   // eslint-disable-line no-global-assign
  try{ if (state.secim === 'kes' && aktif()){ const s = [...(state.secili || [])]; s.length || $('#kesDolgu').checked ? store.set(kesAnahtar(), {s, d: $('#kesDolgu').checked, z: Date.now()}) : store.set(kesAnahtar(), null); } }catch(e){}
  return _secimBitir();
};
const _secimBasla = secimBasla;
secimBasla = function(v, tur){   // eslint-disable-line no-global-assign
  const r = _secimBasla(v, tur);
  if (tur === 'kes'){ try{
    const k = store.get(kesAnahtar(), null), n = (state.sonuc?.paragraflar || []).length;
    if (k && Date.now() - (k.z || 0) < 30 * 864e5){ (k.s || []).filter(i => i < n).forEach(i => state.secili.add(i)); $('#kesDolgu').checked = !!k.d; secimCiz(); if (state.secili.size) toast(`Önceki seçiminiz geri geldi: ${state.secili.size} paragraf`); }
    kesDolguKur();
  }catch(e){ console.warn(e); } }
  return r;
};
async function kesDolguKur(tekrar){
  let b = $('#kesDolguBtn'); if (!b){ b = document.createElement('button'); b.type = 'button'; b.className = 'sbtn'; b.id = 'kesDolguBtn'; $('#kesSecenek').before(b);
    b.onclick = () => { if (b.dataset.arama) return; $('#kesDolgu').checked = !$('#kesDolgu').checked; secimCiz(); dolguYaz(); }; }
  const temel = aktif(); if (!tekrar) b.hidden = true;
  try{ const d = await json('/api/dolgu/' + encodeURIComponent(temel) + (tekrar ? '?tara=0' : '')); if (aktif() !== temel || state.secim !== 'kes') return;
    const a = d['aralıklar'] || []; if (!d.kelime_zamani_var){ b.hidden = true; return; }
    b.dataset.n = a.length; const sn = a.reduce((t, x) => t + (x[1] - x[0]), 0); b.dataset.sn = sn < 10 ? sn.toFixed(1).replace('.', ',') : Math.round(sn);
    if (d.taraniyor){ b.dataset.arama = '1'; b.hidden = false; dolguYaz(); setTimeout(() => kesDolguKur(true), 4000); return; }
    delete b.dataset.arama; b.hidden = !a.length; dolguYaz(); }catch(e){}
}
function dolguYaz(){ const b = $('#kesDolguBtn'); if (!b) return; const on = $('#kesDolgu').checked;
  if (b.dataset.arama){ b.disabled = true; b.setAttribute('aria-pressed', false); b.textContent = 'Duraksamalar aranıyor…'; b.title = 'ee, ıı, hmm gibi sesler için konuşma yeniden dinleniyor'; return; }
  b.disabled = false; b.setAttribute('aria-pressed', on); b.classList.toggle('blue', false); b.textContent = (on ? '✓ ' : '') + `Duraksamalar (${b.dataset.n}) · ${b.dataset.sn} sn`; b.title = on ? 'Duraksamalar videodan çıkarılacak; geri almak için tıklayın' : 'ee, ıı, hmm gibi duraksamaları videodan çıkar'; }
const _secimCiz = secimCiz;
secimCiz = function(){ const r = _secimCiz(); try{ if (state.secim === 'kes') dolguYaz(); }catch(e){} return r; };   // eslint-disable-line no-global-assign
/* ---------------------------------------------------------------- 14) ana sayfa: kurulum denetimi ve son çalışmalar (2026-10-27)
   Yeni kuran biri eksikleri (ffmpeg, ses modeli, Claude/yerel model) tek kartta görür; geri gelen kullanıcı son videolarına tek tıkla döner. */
function anaKutu(){ let k = $('#stAna'); if (!k){ k = document.createElement('div'); k.id = 'stAna'; ($('#jobsSec') || $('.composer'))?.after(k); } return k; }   // süren iş kartı son çalışmaların ÜSTÜNDE
async function kurulumCiz(yenile){
  let d; try{ d = await json('/api/kurulum' + (yenile ? '?yenile=1' : '')); }catch(e){ return; }
  const k = anaKutu(); let kart = $('#stKurulum');
  const eksik = d.adimlar.filter(a => !a.tamam);
  if (!eksik.length || (store.get('kurulumGizli', 0) > Date.now() && d.hazir)){ kart?.remove(); return; }
  if (!kart){ kart = document.createElement('div'); kart.id = 'stKurulum'; kart.className = 'st-kurulum'; k.prepend(kart); }
  kart.innerHTML = `<div class="st-kb"><div><b>${d.hazir ? 'Studio’yu tamamlayın' : 'Studio’yu hazırlayın'}</b><span class="hint">${eksik.length} adım kaldı${d.hazir ? '; şimdi de kullanabilirsiniz' : ''}</span></div>${d.hazir ? '<button class="sbtn plain" type="button" data-k="gizle">Sonra</button>' : ''}</div>
    <ol>${d.adimlar.map(a => `<li class="${a.tamam ? 'ok' : ''}"><span class="st-ki">${a.tamam ? '✓' : a.iniyor ? '…' : ''}</span><div><div class="st-ka">${esc(a.ad)}${a.durum ? ` <span class="hint">${esc(a.durum)}</span>` : ''}${a.zorunlu && !a.tamam ? ' <span class="chip warn">gerekli</span>' : ''}</div>
      ${a.tamam ? '' : `<div class="hint">${esc(a.iniyor ? 'İndiriliyor; birkaç dakika sürer.' : a.nasil)}</div>${a.komut ? `<div class="st-kmt"><code>${esc(a.komut)}</code><button class="tiny" type="button" data-kopya="${esc(a.komut)}">Kopyala</button></div>` : ''}${a.eylem === 'model' && !a.iniyor ? '<button class="sbtn" type="button" data-k="model">Şimdi indir</button>' : ''}${a.eylem === 'claude' ? '<button class="sbtn blue" type="button" data-k="claude">Claude’a bağlan</button>' : ''}`}</div></li>`).join('')}</ol>
    <button class="textbtn" type="button" data-k="yenile">Yeniden denetle</button>`;
  kart.onclick = async e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.kopya){ kopyala(b.dataset.kopya, 'Komut kopyalandı; Terminal’e yapıştırın'); return; }
    const k2 = b.dataset.k;
    if (k2 === 'gizle'){ store.set('kurulumGizli', Date.now() + 7 * 864e5); kart.remove(); return; }
    if (k2 === 'yenile'){ b.textContent = 'Denetleniyor…'; await kurulumCiz(true); return; }
    if (k2 === 'model'){ b.disabled = true; await post('/api/model-indir', {model: 'turbo'}).catch(() => {}); toast('Ses modeli iniyor'); setTimeout(() => kurulumCiz(true), 1500); return; }
    if (k2 === 'claude'){ b.disabled = true; try{ await post('/api/claude/baglan'); toast('Terminal’de giriş penceresi açıldı; tarayıcıda onaylayın'); }catch(er){ toast(er.message); } setTimeout(() => kurulumCiz(true), 20000); }
  };
}
function sonCiz(){
  const k = anaKutu(); let s = $('#stSon');
  const list = (state.tumListe || []).filter(x => !x.toplanti && !x.atolye).sort((a, b) => (b.olusturma || 0) - (a.olusturma || 0)).slice(0, 4);
  if (!list.length){ s?.remove(); return; }
  if (!s){ s = document.createElement('section'); s.id = 'stSon'; s.className = 'st-son'; k.appendChild(s); }
  const gun = t => { const f = (Date.now() / 1000 - t) / 86400; return f < 1 ? 'bugün' : f < 2 ? 'dün' : new Date(t * 1000).toLocaleDateString(DIL.locale, {day: 'numeric', month: 'short'}); };
  s.innerHTML = `<div class="st-sonb"><h3>Son çalışmalar</h3><button class="textbtn" type="button" onclick="yuzSec('kitaplik')">Tümü →</button></div><div class="st-sonl">${list.map(x => `<button type="button" class="st-sonk" data-t="${esc(x.temel)}">${x.kapak ? `<img src="${esc(x.kapak)}${x.kapak.startsWith('/kapak/') ? '?w=320' : ''}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '<span class="st-sonbos"></span>'}<span class="st-sont">${esc(x.baslik || x.temel)}</span><span class="hint">${gun(x.olusturma || 0)}${x.sure ? ' · ' + sure(x.sure) : ''}</span></button>`).join('')}</div>`;
  s.onclick = e => { const b = e.target.closest('.st-sonk'); if (b) sonucGoster(b.dataset.t); };
}
const _gecmisYukle = gecmisYukle;
gecmisYukle = async function(){ const r = await _gecmisYukle(); try{ sonCiz(); }catch(e){ console.warn(e); } return r; };   // eslint-disable-line no-global-assign
function miniOyBekle(){ let n = 0; const t = setInterval(() => { if ($('#oynatici') || ++n > 40){ clearInterval(t); miniOyKur(); } }, 250); }
document.addEventListener('keydown', e => {
  if (!state.aktifTemel || $('#resultSec')?.classList.contains('hidden') || !OY.p || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest?.('input,textarea,select,[contenteditable],button') || document.querySelector('.pop,dialog[open]')) return;
  const sn = oyZaman();
  if (e.key === ' ' || e.key.toLowerCase() === 'k'){ e.preventDefault(); try{ oyCaliyor() ? (OY.tur === 'yt' ? OY.p.pauseVideo() : OY.p.pause()) : (OY.tur === 'yt' ? OY.p.playVideo() : OY.p.play()); }catch(_){ } }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){ e.preventDefault(); oyGit(Math.max(0, sn + (e.key === 'ArrowLeft' ? -5 : 5))); }
  else if (e.key.toLowerCase() === 'j' || e.key.toLowerCase() === 'l'){ e.preventDefault(); oyGit(Math.max(0, sn + (e.key.toLowerCase() === 'j' ? -10 : 10))); }
});

/* ---------------------------------------------------------------- 15) iş kartında akış görseli (2026-10-31; kullanıcı: "anlatımı netleştiren, hareketli görseller")
   Beş metin adımı ve ince çubuk yerine: düğümlerden geçen bir hat (biten dolu, süren nabızlı, bekleyen soluk; süren düğüme akan ışık) ve
   altında o adımın ne yaptığını gösteren küçük sahne: ses dalgası dolar, konuşmacı blokları belirir, satırlar yazılır, özet maddeleri sıralanır. */
const AKIS_IK = {ceviri: 'M4 5h7M7 3v2c0 4-2 7-5 9M5 8c1 3 3 5 6 6M12 20l4-9 4 9M13.5 17h5', seslendir: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M8 21h8', ses: 'M4 12h2l2-6 3 12 3-9 2 5 2-2h2', kim: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9M15.5 4.1a3.5 3.5 0 0 1 0 6.8',
  metin: 'M5 7h14M5 12h10M5 17h7', belge: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6', ozet: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z',
  baglan: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', indir: 'M12 4v12m0 0l-5-5m5 5l5-5M4 20h16', birles: 'M6 4v6a4 4 0 0 0 4 4h4M18 4v6a4 4 0 0 1-4 4M12 14v6',
  kaydet: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6', video: 'M4 6h16v12H4zM4 10h16M8 6v12M16 6v12', altyazi: 'M4 5h16v14H4zM7 14h4M13 14h4M7 11h10', yaz: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4'};
const AKIS_ADIM = {tx: [['ses', 'Ses'], ['kim', 'Konuşmacılar'], ['metin', 'Metin'], ['belge', 'Belge'], ['ozet', 'Özet']],
  indir: [['baglan', 'Bağlan'], ['indir', 'İndir'], ['birles', 'Birleştir'], ['kaydet', 'Kaydet']], video: [['video', 'Video'], ['altyazi', 'Altyazı'], ['yaz', 'Yaz'], ['kaydet', 'Kaydet']],
  dublaj: [['video', 'Video'], ['ceviri', 'Hazırlık'], ['seslendir', 'Seslendir'], ['kaydet', 'Kaydet']], dudak: [['belge', 'Hazırla'], ['indir', 'Gönder'], ['kim', 'Eşle'], ['kaydet', 'İndir']]};
const AKIS_ANLAT = {ses: 'Videonun sesi alınıyor', kim: 'Kim ne zaman konuşmuş, ayrılıyor', metin: 'Konuşma yazıya dökülüyor', belge: 'Word, metin ve altyazı dosyaları yazılıyor', ozet: 'Özet, öne çıkanlar ve bölümler çıkarılıyor',
  baglan: 'Siteye bağlanılıyor', indir: 'Dosya iniyor', ceviri: 'Konuşanın sesi örnekleniyor, cümleler hazırlanıyor', seslendir: 'Konuşanın sesiyle yeni dilde söyleniyor', birles: 'Görüntü ve ses birleştiriliyor', kaydet: 'İndirilenler’e kaydediliyor', video: 'Kaynak video bulunuyor', altyazi: 'Her altyazı parçası çiziliyor', yaz: 'Altyazılar videoya işleniyor'};
const DALGA = Array.from({length: 36}, (_, i) => 22 + Math.round(34 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * .61)) + (i % 5) * 4));
function akisTuru(d){ return d.tur === 'indir' ? 'indir' : d.tur === 'dudak' ? 'dudak' : d.tur === 'dublaj' ? 'dublaj' : d.tur ? 'video' : 'tx'; }
function akisKur(el, d){
  let a = el.querySelector('.st-akis');
  if (!a){ a = document.createElement('div'); a.className = 'st-akis'; const tur = akisTuru(d), adimlar = AKIS_ADIM[tur];
    a.innerHTML = `<div class="sa-yol"><svg class="sa-cizgi" aria-hidden="true"></svg>${adimlar.map(([k, ad], i) => `<div class="sa-d" data-n="${i + 1}"><i><svg viewBox="0 0 24 24"><path d="${AKIS_IK[k]}"/></svg></i><b>${ad}</b></div>`).join('')}</div><div class="sa-sahne" aria-hidden="true"></div>`;
    (el.querySelector('.steps') || el.querySelector('.top')).after(a); a._tur = tur; a._n = adimlar.length; }
  const n = d.durum === 'bitti' ? a._n + 1 : (d.adim || 0), bitti = ['hata', 'iptal', 'kesildi'].includes(d.durum);
  a.dataset.durum = d.durum === 'bitti' ? 'bitti' : bitti ? 'durdu' : d.durum === 'sirada' ? 'sirada' : 'calisiyor';
  a.querySelectorAll('.sa-d').forEach(x => { const k = +x.dataset.n; x.className = 'sa-d ' + (k < n ? 'ok' : k === n && !bitti && d.durum === 'calisiyor' ? 'on' : ''); });
  akisCizgi(a, n, d.durum === 'calisiyor');
  akisSahne(a, d, n);
}
function akisCizgi(a, n, calisiyor){
  const svg = a.querySelector('.sa-cizgi'), ds = [...a.querySelectorAll('.sa-d i')]; if (!svg || ds.length < 2) return;
  const r = a.querySelector('.sa-yol').getBoundingClientRect(); if (!r.width) return;
  const c = ds.map(e => { const b = e.getBoundingClientRect(); return [b.left + b.width / 2 - r.left, b.top + b.height / 2 - r.top]; });
  let p = '';
  for (let i = 0; i < c.length - 1; i++){ const [x1, y] = c[i], [x2] = c[i + 1]; const d = `M${x1 + 17} ${y} L${x2 - 17} ${y}`;
    const k = i + 1; p += `<path class="sa-p ${k < n - 1 || (k === n - 1 && n > a._n) ? 'ok' : k === n - 1 && calisiyor ? 'ak' : ''}" d="${d}"/>`; }
  svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`); svg.innerHTML = p;
}
function akisSahne(a, d, n){
  const s = a.querySelector('.sa-sahne'), tur = a._tur, adim = AKIS_ADIM[tur][Math.min(n, a._n) - 1]?.[0] || '', iler = Math.max(0, Math.min(100, d.ilerleme || 0));
  const anahtar = `${a.dataset.durum}:${adim}`;
  if (s.dataset.k !== anahtar){ s.dataset.k = anahtar;
    if (a.dataset.durum === 'bitti') s.innerHTML = `<div class="sa-bitti"><svg viewBox="0 0 24 24"><path class="sa-tik" d="M5 12.5l4.5 4.5L19 7"/></svg><span>${d.tur === 'indir' ? 'İndi' : d.tur ? 'Video hazır' : 'Transkript hazır'}</span></div>`;
    else if (a.dataset.durum === 'durdu') s.innerHTML = '';
    else if (a.dataset.durum === 'sirada') s.innerHTML = `<div class="sa-bekle"><i></i><i></i><i></i><span>Önündeki iş bitince başlar</span></div>`;
    else if (adim === 'ses' || adim === 'indir' || adim === 'video' || adim === 'seslendir') s.innerHTML = `<div class="sa-dalga">${DALGA.map(h => `<i style="height:${h}%"></i>`).join('')}</div><div class="sa-not"></div>`;
    else if (adim === 'kim') s.innerHTML = `<div class="sa-kim">${[0, 1, 0, 2, 0, 1, 2, 0, 1, 0, 2, 1].map((k, i) => `<i style="--k:var(--s${k + 1});flex:${[9, 5, 7, 4, 6, 8, 3, 7, 5, 6, 4, 8][i]};animation-delay:${(i * .28).toFixed(2)}s"></i>`).join('')}</div><div class="sa-not">${AKIS_ANLAT.kim}</div>`;
    else if (adim === 'metin' || adim === 'altyazi' || adim === 'yaz' || adim === 'ceviri') s.innerHTML = `<div class="sa-metin">${[92, 78, 88, 64, 84].map((w, i) => `<i style="width:${w}%;animation-delay:${(i * .35).toFixed(2)}s"></i>`).join('')}</div><div class="sa-zaman"><div class="sa-dolu"></div><div class="sa-kafa"></div></div><div class="sa-not"></div>`;
    else if (adim === 'belge' || adim === 'birles' || adim === 'kaydet' || adim === 'baglan') s.innerHTML = `<div class="sa-belge">${['docx', 'txt', 'srt'].map((x, i) => `<i style="animation-delay:${i * .4}s"><b>${x}</b></i>`).join('')}</div><div class="sa-not">${AKIS_ANLAT[adim] || ''}</div>`;
    else if (adim === 'ozet') s.innerHTML = `<div class="sa-ozet">${[0, 1, 2].map(i => `<i style="animation-delay:${i * .45}s"><u></u><span style="width:${[86, 62, 74][i]}%"></span></i>`).join('')}</div><div class="sa-not">${AKIS_ANLAT.ozet}</div>`;
    else s.innerHTML = '';
  }
  const ind = !(iler > 0);
  const dalga = s.querySelector('.sa-dalga'); if (dalga){ dalga.classList.toggle('ind', ind); const bars = dalga.children, kac = Math.round(iler / 100 * bars.length); [...bars].forEach((b, i) => b.classList.toggle('ok', !ind && i < kac)); }
  const zaman = s.querySelector('.sa-zaman'); if (zaman){ zaman.classList.toggle('ind', ind); zaman.querySelector('.sa-dolu').style.width = iler + '%'; zaman.querySelector('.sa-kafa').style.left = iler + '%';
    const m = s.querySelector('.sa-metin'); if (m) m.style.setProperty('--iler', iler + '%'); }
  const not = s.querySelector('.sa-not'); if (not){ const satir = (!d.tur && adim === 'metin' && d.son_satir) ? `“${d.son_satir}”` : (d.model_iniyor ? 'Ses modeli indiriliyor; bir kereliktir' : (AKIS_ANLAT[adim] || '')); if (not.textContent !== satir) not.textContent = satir; }
}
const _renderJob = renderJob;
renderJob = function(d){   // eslint-disable-line no-global-assign
  _renderJob(d);
  try{ const el = $('#job-' + d.id); if (el && kullaniciIsi(d)){ akisKur(el, d);
    if (d.tur === 'dublaj' && d.durum === 'calisiyor'){ const st = el.querySelector('.st'), m = {1: 'Video hazırlanıyor', 2: 'Ses hazırlanıyor', 3: d.ilerleme > 0 ? `Seslendiriliyor · ${d.ilerleme}%` : 'Seslendiriliyor', 4: 'Kaydediliyor'}[d.adim];
      if (st && m) st.innerHTML = m + (d.onizleme ? '<small>ilk 30 saniye, önizleme</small>' : ''); } } }catch(e){ console.warn('akış görseli:', e); }
};
window.addEventListener('resize', () => $$('.st-akis').forEach(a => { const el = a.closest('.job'), d = state.jobData?.[el?.id.replace('job-', '')]; if (d) akisCizgi(a, d.durum === 'bitti' ? a._n + 1 : (d.adim || 0), d.durum === 'calisiyor'); }));

/* ---------------------------------------------------------------- 16) videonun haritası (okuma görünümü)
   Başlığın altında tek şerit: bölümler (üst sıra, adlarıyla), kim ne zaman konuşmuş (alt sıra, konuşmacı renkleriyle), öne çıkan anlar (işaret),
   oynatma başı (video çalarken ilerler). Tıklayınca o ana gider. Kısa videoda (90 sn altı) gösterilmez: anlatacak bir şey yok. */
let smZam = null;
function haritaKur(temel, v, d){
  $('#stMap')?.remove(); clearInterval(smZam);
  const sure = +v.sure || 0, P = d.paragraflar || [];
  if (v.toplanti || sure < 90 || P.length < 3) return;
  const cover = $('#doc .cover'); if (!cover) return;
  const adlar = Object.values(v.etiket || {}), renk = ad => `var(${SPK[Math.max(0, adlar.indexOf(ad)) % SPK.length]})`;
  const bol = [...(v.ozet?.bolumler || [])].filter(b => b && b.sn != null).sort((a, b) => a.sn - b.sn).map((b, i) => i ? b : {...b, sn: 0});   // ilk bölüm videonun başından sayılır (YouTube kuralı)
  const tekKisi = adlar.length < 2;
  const yuz = sn => Math.max(0, Math.min(100, sn / sure * 100));
  // konuşmacı blokları: ardışık aynı kişi birleşir; 0,6 sn'den kısa parçalar çizilmez
  const blok = []; P.forEach(p => { const a = p.bas ?? p.sn, b = p.bit ?? a; const son = blok[blok.length - 1];
    if (son && son.ad === p.ad && a - son.bit < 2){ son.bit = Math.max(son.bit, b); } else blok.push({ad: p.ad, bas: a, bit: b}); });
  const klip = (v.klipler || []).filter(k => k.bas != null);
  const m = document.createElement('div'); m.id = 'stMap'; m.className = 'st-map';
  m.classList.toggle('tek', tekKisi);
  m.innerHTML = `<div class="sm-ust"><span>${bol.length ? `${bol.length} bölüm` : 'Zaman çizgisi'}${adlar.length > 1 ? ` · ${adlar.length} konuşmacı` : ''}${klip.length ? ` · ${klip.length} öne çıkan an` : ''}</span><span class="sm-ip" hidden></span></div>
    <div class="sm-serit" role="slider" aria-label="Videoda bir ana git" aria-valuemin="0" aria-valuemax="${Math.round(sure)}" tabindex="0">
      ${bol.length ? `<div class="sm-bol">${bol.map((b, i) => { const bit = bol[i + 1] ? bol[i + 1].sn : sure, w = yuz(bit) - yuz(b.sn); return `<i style="left:${yuz(b.sn)}%;width:${w}%;animation-delay:${(i * .06).toFixed(2)}s" title="${esc(zamanK(b.sn))} · ${esc(b.baslik)}"><span>${esc(b.baslik)}</span></i>`; }).join('')}</div>` : ''}
      ${tekKisi ? '' : `<div class="sm-kon">${blok.map((b, i) => (b.bit - b.bas) < .6 ? '' : `<i style="left:${yuz(b.bas)}%;width:${Math.max(.15, yuz(b.bit) - yuz(b.bas))}%;--k:${renk(b.ad)};animation-delay:${Math.min(1.2, i * .02).toFixed(2)}s" title="${esc(b.ad)} · ${esc(zamanK(b.bas))}"></i>`).join('')}</div>`}
      ${klip.length ? `<div class="sm-klip">${klip.map(k => `<i style="left:${yuz(k.bas)}%;width:${Math.max(.4, yuz(k.bit) - yuz(k.bas))}%" title="${esc(k.kanca || k.baslik || 'Öne çıkan an')} · ${esc(zamanK(k.bas))}"></i>`).join('')}</div>` : ''}
      <div class="sm-oy" hidden></div>
    </div>`;
  cover.after(m);
  const serit = m.querySelector('.sm-serit'), ip = m.querySelector('.sm-ip');
  const bolumAdi = sn => { let ad = ''; bol.forEach(b => { if (b.sn <= sn) ad = b.baslik; }); return ad; };
  const konusan = sn => { const b = blok.find(x => x.bas <= sn && sn <= x.bit); return b ? b.ad : ''; };
  const snAl = e => { const r = serit.getBoundingClientRect(); return Math.max(0, Math.min(sure, (e.clientX - r.left) / r.width * sure)); };
  serit.addEventListener('mousemove', e => { const sn = snAl(e); ip.hidden = false; ip.textContent = [zamanK(sn), konusan(sn), bolumAdi(sn)].filter(Boolean).join(' · '); });
  serit.addEventListener('mouseleave', () => { ip.hidden = true; });
  serit.addEventListener('click', e => { const sn = snAl(e); gitSn(sn); OY.kullaniciKaydirdi = 0; });
  serit.addEventListener('keydown', e => { const t = oyZaman(); if (e.key === 'ArrowRight'){ e.preventDefault(); gitSn(Math.min(sure, t + 10)); } if (e.key === 'ArrowLeft'){ e.preventDefault(); gitSn(Math.max(0, t - 10)); } });
  const oy = m.querySelector('.sm-oy');
  smZam = setInterval(() => { if (!document.body.contains(m)){ clearInterval(smZam); return; } if (!OY.p){ oy.hidden = true; return; }
    const t = oyZaman(); oy.hidden = !(t > 0.5 || oyCaliyor()); oy.style.left = yuz(t) + '%'; serit.setAttribute('aria-valuenow', Math.round(t)); }, 250);
}

/* ---------------------------------------------------------------- 17) "çıkarım" etiketi yalnız anlamlıyken
   Özet başka dilde yazıldıysa (İngilizce video, Türkçe özet) hiçbir cümle transkriptle eşleşmez ve her cümleye "çıkarım" yapışıyordu: gürültü.
   Eşleşen cümle yoksa etiketler hiç gösterilmez; eşleşme varsa yalnız karşılığı bulunamayanlar işaretlenir. */
const _ozetHtml = ozetHtml;
ozetHtml = function(v){   // eslint-disable-line no-global-assign
  const h = _ozetHtml(v);
  try{ const kyn = (h.match(/class="zt kyn/g) || []).length, cik = (h.match(/class="cikarim"/g) || []).length;
    if (cik && kyn === 0) return h.replace(/ ?<span class="cikarim"[^>]*>[^<]*<\/span>/g, ''); }catch(e){}
  return h;
};

/* ---------------------------------------------------------------- 18) ilk açılış: "nasıl çalışır" (kitaplık boşken)
   Yeni kuran biri boş bir sayfa görmesin: linkten çıktılara giden yolu gösteren kısa, kendiliğinden akan şema. İlk video bitince kalkar. */
function nasilCiz(){
  const k = anaKutu(); let s = $('#stNasil');
  const bos = Array.isArray(state.tumListe) && !state.tumListe.some(x => !x.toplanti && !x.atolye);
  if (!bos){ s?.remove(); return; } if (s) return;
  s = document.createElement('section'); s.id = 'stNasil'; s.className = 'st-nasil';
  s.innerHTML = `<div class="st-sonb"><h3>Nasıl çalışır</h3></div>
    <div class="sn-akis">
      <div class="sn-k"><i class="sn-ik"><svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></i><b>Bir link yapıştırın</b><span>YouTube, Instagram, TikTok ya da bilgisayarınızdaki bir dosya.</span></div>
      <svg class="sn-ok" viewBox="0 0 60 24" aria-hidden="true"><path class="sn-cz" d="M2 12h56"/><path class="sn-ak" d="M2 12h56"/></svg>
      <div class="sn-k"><i class="sn-ik sn-dalga"><span></span><span></span><span></span><span></span><span></span></i><b>Bu bilgisayarda çözülür</b><span>Konuşma yazıya dökülür, konuşanlar ayrılır. Ses dışarı çıkmaz.</span></div>
      <svg class="sn-ok" viewBox="0 0 60 24" aria-hidden="true"><path class="sn-cz" d="M2 12h56"/><path class="sn-ak" d="M2 12h56" style="animation-delay:.9s"/></svg>
      <div class="sn-k"><i class="sn-ik sn-cikti"><em>Transkript</em><em>Özet</em><em>Altyazı</em><em>Dublaj</em></i><b>Çıktılar hazır</b><span>Metin, özet, altyazılı video, başka dilde seslendirme; hepsini tek tıkla.</span></div>
    </div>`;
  k.appendChild(s);
}
const _sonCiz = sonCiz;
sonCiz = function(){ const r = _sonCiz(); try{ nasilCiz(); }catch(e){} return r; };   // eslint-disable-line no-global-assign

/* ---------------------------------------------------------------- 20) Bir bakışta (2026-10-31; kullanıcı: "görselleştirme hâlâ artabilir")
   Özet sekmesinin başında üç canlı kutu: kim ne kadar konuştu (halka), konuşma temposu (kelime/dk + zaman içindeki eğrisi; dokununca o ana gider),
   en çok geçen kelimeler (dokununca metinde aranır). Hepsi elde olan metinden tarayıcıda hesaplanır; sunucuya istek yok. */
const DURAK_K = new Set(('ve veya ama fakat ile için gibi daha çok çok az bir bu şu o ki de da mi mı mu mü ne nasıl neden niye hangi kim nerede ben sen biz siz onlar ' +
  'var yok evet hayır şey şeyi şeyler olan olarak oldu olur olacak etti eder yapıyor yapmış bunu şunu onu bunun şunun onun bana sana ona bize size onlara benim senin onun bizim sizin ' +
  'diye kadar sonra önce şimdi zaten yani işte aslında tamam peki hani böyle şöyle öyle bunlar şunlar hem gerçekten herhalde belki bile sadece değil degil ' +
  'çünkü eğer ise iken içinde üzerinde arasında bütün tüm her hiç hep birşey birisi bazı biraz falan filan hani şimdi bugün yine artık oluyor olduğu olduğunu ' +
  'the and that this with have from they were their what there about would which when your will just like know really going think yeah okay right also because ' +
  'them then than been into could more some only very well these those over here even much where something things thing want said make made does dont youre ' +
  'bizi bize sizi size onları onlara kendi kendimiz kendini kendine bunları şunları bunu şeyler şekilde şekilde gerçek güzel büyük küçük önemli lazım gerek gerekiyor ' +
  'göre gibi olsun olsa diyor dedi fazla diğer başka aynı yeni eski tabii mesela örneğin özellikle genelde dolayı zaman yani orada burada şurada').split(' '));
// fiil çekimleri ve ek yığını kelimeleri listeye girmesin (ör. "dedik", "yapabiliriz", "isteklerimize"); özetinde geçen kelimeler öne çıkar
const FIIL = /(iyor|ıyor|uyor|üyor|yoruz|yorum|yorsun|dık|dik|duk|dük|tık|tik|tuk|tük|mış|miş|muş|müş|ecek|acak|ebilir|abilir|ebiliriz|abiliriz|meli|malı|mıyor|miyor|madı|medi|ımıza|imize|umuza|ümüze|larımız|lerimiz|dır|dir|dur|dür|tır|tir|ing|ed)$/;
function bakisKur(temel, v, d){
  $('#stBakis')?.remove();
  const P = d.paragraflar || [], sure = +v.sure || 0, sag = $('#doc .sagk');
  if (v.toplanti || !sag || P.length < 3 || sure < 60) return;
  const adlar = Object.values(v.etiket || {}), renk = ad => `var(${SPK[Math.max(0, adlar.indexOf(ad)) % SPK.length]})`;
  // konuşma payları ve tempo
  const pay = {}; let toplamSn = 0, toplamK = 0; const kova = 24, K = Array(kova).fill(0), Ks = Array(kova).fill(0), sayac = {}, bicim = {};
  P.forEach(p => { const a = +(p.bas ?? p.sn) || 0, b = Math.max(a + .5, +(p.bit ?? a) || a), sn = b - a, kel = (p.metin || '').split(/\s+/).filter(Boolean);
    pay[p.ad] = (pay[p.ad] || 0) + sn; toplamSn += sn; toplamK += kel.length;
    const i = Math.min(kova - 1, Math.floor(a / sure * kova)); K[i] += kel.length; Ks[i] += sn;
    kel.forEach(w => { const yal = w.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '').replace(/['’].*$/, ''); const k = yal.toLocaleLowerCase(DIL?.locale || 'tr-TR');
      if (k.length < 4 || DURAK_K.has(k) || /^\d+$/.test(k) || FIIL.test(k)) return; const kok = k.slice(0, 6); sayac[kok] = (sayac[kok] || 0) + 1;
      const bb = bicim[kok] || (bicim[kok] = {}); bb[yal] = (bb[yal] || 0) + 1; }); });
  if (!toplamSn || !toplamK) return;
  const wpm = Math.round(toplamK / (toplamSn / 60));
  const hiz = wpm < 115 ? 'Yavaş ve tane tane' : wpm < 145 ? 'Sakin' : wpm < 175 ? 'Doğal hız' : 'Hızlı';
  const egri = K.map((k, i) => Ks[i] > 4 ? k / (Ks[i] / 60) : null);
  const mx = Math.max(60, ...egri.filter(x => x != null)), mn = Math.min(...egri.filter(x => x != null), mx);
  const W = 240, H = 64, nok = egri.map((x, i) => x == null ? null : [i / (kova - 1) * W, H - 6 - ((x - mn) / Math.max(1, mx - mn)) * (H - 16)]);
  const yol = nok.filter(Boolean).map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const enHizli = egri.indexOf(Math.max(...egri.filter(x => x != null)));
  const alan = yol ? yol + ` L${nok.filter(Boolean).slice(-1)[0][0].toFixed(1)} ${H} L${nok.find(Boolean)[0].toFixed(1)} ${H} Z` : '';
  // halka
  const dilim = Object.entries(pay).sort((a, b) => b[1] - a[1]); const r = 34, C = 2 * Math.PI * r; let ofs = 0;
  const tek = dilim.length < 2;
  const halka = tek ? [[T('Konuşma'), toplamSn, 'var(--vurgu)'], [T('Sessizlik'), Math.max(0, sure - toplamSn), 'var(--fill2, rgba(127,127,127,.25))']] : dilim.map(([ad, sn]) => [ad, sn, renk(ad)]);
  const top = halka.reduce((a, x) => a + x[1], 0) || 1;
  const yaylar = halka.map(([ad, sn, rk], i) => { const u = sn / top * C, s = `<circle r="${r}" cx="44" cy="44" fill="none" stroke="${rk}" stroke-width="10" stroke-dasharray="0 ${C.toFixed(2)}" data-d="${Math.max(0, u - 1.5).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-ofs).toFixed(2)}" style="transition-delay:${(i * .12).toFixed(2)}s"/>`; ofs += u; return s; }).join('');
  const ozetMetni = ((v.ozet?.ozet || '') + ' ' + (v.ozet?.maddeler || []).join(' ')).toLocaleLowerCase(DIL?.locale || 'tr-TR');
  const agirlik = (kok, n) => n * (ozetMetni.includes(kok) ? 2.5 : 1);
  const kel = Object.entries(sayac).filter(([, n]) => n >= 2).sort((a, b) => agirlik(b[0], b[1]) - agirlik(a[0], a[1])).slice(0, 9);
  const kmax = kel[0]?.[1] || 1;
  const kelAd = kok => Object.entries(bicim[kok]).sort((a, b) => b[1] - a[1])[0][0];
  const okuma = Math.max(1, Math.round(toplamK / 230));
  const el = document.createElement('section'); el.id = 'stBakis'; el.className = 'st-bakis'; el.dataset.stsek = 'ozet';
  el.innerHTML = `<div class="sb-ust"><b>${T('Bir bakışta')}</b><span>${zamanK(sure)} ${T('video')} · ${toplamK.toLocaleString(DIL?.locale || 'tr-TR')} ${T('kelime')} · ${T('okuması')} ${okuma} ${T('dk')}</span></div>
    <div class="sb-izgara">
      <div class="sb-kutu"><small>${tek ? T('Konuşma oranı') : T('Kim ne kadar konuştu')}</small>
        <div class="sb-halka"><svg viewBox="0 0 88 88" aria-hidden="true"><circle r="${r}" cx="44" cy="44" fill="none" stroke="var(--fill)" stroke-width="10"/><g transform="rotate(-90 44 44)">${yaylar}</g></svg>
          <span><em><b data-say="${tek ? Math.round(toplamSn / Math.max(1, sure) * 100) : dilim.length}">0</b>${tek ? '<i>%</i>' : ''}</em><small>${tek ? T('konuşma') : T('kişi')}</small></span></div>
        <ul class="sb-lej">${(tek ? halka.slice(0, 1) : halka.slice(0, 4)).map(([ad, sn, rk]) => `<li><i style="background:${rk}"></i><span>${esc(ad)}</span><b>${Math.round(sn / top * 100)}%</b></li>`).join('')}</ul></div>
      <div class="sb-kutu"><small>${T('Konuşma temposu')}</small>
        <div class="sb-sayi"><b data-say="${wpm}">0</b><span>${T('kelime/dk')}<em>${T(hiz)}</em></span></div>
        <svg class="sb-egri" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="${T('Zaman içinde tempo; dokununca o ana gider')}"><defs><linearGradient id="sbG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--vurgu)" stop-opacity=".35"/><stop offset="1" stop-color="var(--vurgu)" stop-opacity="0"/></linearGradient></defs>
          <path class="sb-alan" d="${alan}" fill="url(#sbG)"/><path class="sb-cizgi" d="${yol}" fill="none" stroke="var(--vurgu)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" pathLength="1"/>
          ${enHizli >= 0 && nok[enHizli] ? `<circle class="sb-tepe" cx="${nok[enHizli][0].toFixed(1)}" cy="${nok[enHizli][1].toFixed(1)}" r="3.5" fill="var(--vurgu)"/>` : ''}<line class="sb-imlec" x1="0" x2="0" y1="0" y2="${H}" stroke="var(--ink)" stroke-opacity=".35" hidden/></svg>
        <div class="sb-alt"><span>0:00</span>${enHizli >= 0 ? `<button type="button" class="sb-tepe-b" data-sn="${Math.round(enHizli / kova * sure)}">${T('En hızlı an')} · ${zamanK(enHizli / kova * sure)}</button>` : ''}<span>${zamanK(sure)}</span></div></div>
      <div class="sb-kutu"><small>${T('En çok geçenler')}</small>
        <div class="sb-kel">${kel.length ? kel.map(([kok, n], i) => `<button type="button" data-k="${esc(kelAd(kok))}" style="--o:${(.55 + .45 * n / kmax).toFixed(2)};--s:${(12.5 + 6 * n / kmax).toFixed(1)}px;animation-delay:${(i * .05).toFixed(2)}s" title="${n} ${T('kez')}">${esc(kelAd(kok))}</button>`).join('') : `<p>${T('Tekrar eden kelime az.')}</p>`}</div></div>
    </div>`;
  const ust = $('#stSek'); (ust ? ust.after(el) : sag.prepend(el));
  // görünür olunca canlan: sayılar sayar, halka dolar, eğri çizilir
  const halkaDoldur = () => el.querySelectorAll('[data-d]').forEach(c => c.setAttribute('stroke-dasharray', c.dataset.d));
  const canlan = () => { el.classList.add('canli'); requestAnimationFrame(() => requestAnimationFrame(halkaDoldur)); el.querySelectorAll('[data-say]').forEach(b => { const hedef = +b.dataset.say, t0 = performance.now();
    const ad = t => { const k = Math.min(1, (t - t0) / 900); b.textContent = Math.round(hedef * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(ad); }; requestAnimationFrame(ad); }); };
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) { el.classList.add('canli'); halkaDoldur(); el.querySelectorAll('[data-say]').forEach(b => b.textContent = b.dataset.say); }
  else new IntersectionObserver((g, o) => { if (g[0].isIntersecting){ o.disconnect(); canlan(); } }, {threshold: .3}).observe(el);
  el.querySelector('.sb-tepe-b')?.addEventListener('click', e => gitSn(+e.currentTarget.dataset.sn));
  const eg = el.querySelector('.sb-egri'), im = el.querySelector('.sb-imlec');
  eg.addEventListener('mousemove', e => { const b = eg.getBoundingClientRect(), x = (e.clientX - b.left) / b.width; im.hidden = false; im.setAttribute('x1', x * W); im.setAttribute('x2', x * W); eg.title = zamanK(x * sure); });
  eg.addEventListener('mouseleave', () => im.hidden = true);
  eg.addEventListener('click', e => { const b = eg.getBoundingClientRect(); gitSn(Math.max(0, (e.clientX - b.left) / b.width * sure)); });
  el.querySelectorAll('.sb-kel button').forEach(b => b.onclick = () => { const a = $('#ara'); if (!a) return; sekmeSec('metin', true); a.value = b.dataset.k; a.dispatchEvent(new Event('input', {bubbles: true})); });
}

/* ---------------------------------------------------------------- 19) YouTube gömmeyi kapatmışsa (2026-10-31; denemede "This video is unavailable" kutusu)
   Sahibi gömmeye izin vermeyen videoda oynatıcı kara kutu kalıyordu. Kaynak video bilgisayardaysa onunla oynatılır; yoksa kapak + "YouTube'da aç". */
function oyHataBekle(temel, v){
  let n = 0; const t = setInterval(() => { if (++n > 80 || aktif() !== temel){ clearInterval(t); return; } if (OY.tur !== 'yt' || !OY.p?.addEventListener) return; clearInterval(t);
    try{ OY.p.addEventListener('onError', ev => { if ([2, 5, 100, 101, 150].includes(+(ev?.data))) oyYedek(temel, v); }); }catch(e){} }, 250);
}
async function oyYedek(temel, v){
  const kutu = $('#oynatici'); if (!kutu || aktif() !== temel) return;
  const r = await fetch('/medya/' + encodeURIComponent(temel), {method: 'HEAD'}).catch(() => null);
  if (r?.ok){ kutu.innerHTML = `<div class="oyc"><video controls preload="metadata" playsinline src="/medya/${encodeURIComponent(temel)}"></video></div>`; OY.tur = 'yerel'; OY.p = kutu.querySelector('video'); kutu.classList.remove('mini-gizli'); return; }
  OY.p = null; OY.tur = null;
  kutu.innerHTML = `<div class="oyc oy-yok">${v.kapak ? `<img src="${esc(v.kapak)}" alt="" referrerpolicy="no-referrer">` : ''}<div class="oy-not"><b>Bu video yalnızca YouTube’da oynatılıyor</b><span>Sahibi başka sitelerde gösterilmesini kapatmış. Metin ve özet burada; videoyu YouTube’da açabilirsiniz.</span>${/^https?:/.test(v.link || '') ? `<a class="sbtn" href="${esc(v.link)}" target="_blank" rel="noopener">YouTube’da aç ↗</a>` : ''}</div></div>`;
}

/* ---------------------------------------------------------------- bağlantılar */
const _sonucGoster = sonucGoster;
sonucGoster = async function(temel, opts = {}){   // eslint-disable-line no-global-assign
  if (KR.acik && temel !== aktif()){ kurguDurdur(); KR.acik = false; $('#kurgubar')?.classList.remove('show'); }
  const r = await _sonucGoster(temel, opts);
  try{ const v = veri();
    duzeltKur(); miniOyBekle(); tekKonusmaci(v);
    if (!v.toplanti){ yayinCiz(temel); sonrakiEkle(temel, v); okumaKur(temel, v, opts); haritaKur(temel, v, state.sonuc || {}); try{ bakisKur(temel, v, state.sonuc || {}); }catch(e){} oyHataBekle(temel, v); }
    if (KR.acik && aktif() === temel){ $('#doc').classList.add('kurgu'); kurguCiz(); }
  }catch(e){ console.warn('Studio eki:', e); }
  return r;
};
const _gitSn = gitSn;
gitSn = function(sn){ sekmeSec('metin'); return _gitSn(sn); };   // eslint-disable-line no-global-assign
const SONRA_IK = {alt: AKIS_IK.altyazi, db: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M8 21h8', klip: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
  dl: AKIS_IK.indir, sen: AKIS_IK.belge, yp: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M17.5 6.5a7 7 0 0 1 0 11', kr: AKIS_IK.yaz, ct: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01'};
function sonrakiSimge(){ $$('#stSonra .sl > [data-a], #stSonra .sl > [data-st]').forEach(b => { if (b.querySelector('.sn-i')) return; const k = b.dataset.a || b.dataset.st, p = SONRA_IK[k]; if (!p) return;
  const i = document.createElement('i'); i.className = 'sn-i'; i.innerHTML = `<svg viewBox="0 0 24 24"><path d="${p}"/></svg>`; b.prepend(i); }); }
const _stSonraKur = stSonraKur;
stSonraKur = function(temel, v){ _stSonraKur(temel, v); try{ sonrakiEkle(temel, v); sonrakiSimge(); }catch(e){} };   // eslint-disable-line no-global-assign
const _altDlgAc = altDlgAc;
altDlgAc = function(temel, v){ _altDlgAc(temel, v); try{ altOnizleKur(); }catch(e){} };   // eslint-disable-line no-global-assign
const _sistemCiz = sistemCiz;
sistemCiz = async function(){ const r = await _sistemCiz(); try{ await gelisimCiz(); await davetCiz(); }catch(e){} gelismisKur(); return r; };   // eslint-disable-line no-global-assign
// Ayarlar: "Sistem" ve "Studio gelişimi" tanı bölümleri günlük kullanıcının önünde durmasın; kaldırılmadı, en alttaki "Gelişmiş"te katlı (2026-10-29)
function gelismisKur(){
  const s = $('#aySistem'), dlg = s?.closest('dialog'); if (!s || !dlg) return;
  let d = $('#stGelismis');
  if (!d){ d = document.createElement('details'); d.id = 'stGelismis';
    d.innerHTML = '<summary><span>Gelişmiş</span><small>Sistem durumu, yedekler, araç güncellemeleri</small></summary>';
    (dlg.querySelector(':scope > .bt') ? dlg.querySelector(':scope > .bt').before(d) : dlg.appendChild(d)); }
  const h = s.previousElementSibling?.classList.contains('ayh') ? s.previousElementSibling : null;
  [h, s, $('#stGelisim')].forEach(e => { if (e && e.parentElement !== d) d.appendChild(e); });
}
const _libGoster = libGoster;
libGoster = function(tab, kaydir){ _libGoster(tab, kaydir); try{ $('#stSuz')?.classList.toggle('hidden', tab !== 'tx'); $('#stSahne')?.classList.toggle('hidden', tab !== 'tx' || !SZ.sahne); if (tab === 'tx' && SZ.sahne) $('#hist').classList.add('hidden'); if (tab === 'dl') temizlikKur(); }catch(e){} };   // eslint-disable-line no-global-assign

const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/static/studio_ek.css?v=25'; document.head.appendChild(css);
const bekle = setInterval(() => { if ($('#hist')){ clearInterval(bekle); suzgecKur(); } }, 300);
if ($('#dls')) new MutationObserver(() => temizlikKur()).observe($('#dls'), {childList: true});
if ($('#aySistem') && $('#aySistem').textContent.trim() && !$('#aySistem').textContent.includes('Yükleniyor')) gelisimCiz();
if (matchMedia('(max-width:520px)').matches && $('#link')) $('#link').placeholder = (window.DIL?.t || (x => x))('Video linki');
{ const sc = document.createElement('script'); sc.src = '/static/studio_asistan.js?v=11'; document.body.appendChild(sc); }
kurulumCiz(); { let n = 0; const t = setInterval(() => { if (state.tumListe || ++n > 60){ clearInterval(t); try{ sonCiz(); }catch(e){} } }, 300); }
if (state.aktifTemel && state.sonuc){ duzeltKur(); if (!veri().toplanti){ yayinCiz(state.aktifTemel); sonrakiEkle(state.aktifTemel, veri()); } }
})();
