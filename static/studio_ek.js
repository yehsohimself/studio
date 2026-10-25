/* Studio geliştirmeleri (2026-10-24; kullanıcı: "küçük büyük bütün geliştirmeleri yap; kendi kendini besleyen, sürekli gelişen bir yapıya kavuştur").
   index.html'deki işlevleri sarmalayarak çalışır (Meet oturumunun dosyasıyla çakışmasın diye ayrı dosya):
   - okuma görünümünde paragraf metnini yerinde düzeltme (düzeltilen adlar ses modeline öğretilir)
   - Yayın paketi kartı (YouTube başlık/açıklama/bölümler, kapak, Shorts, Instagram, LinkedIn; beğeni → sonraki paketler)
   - Kurgu: paragrafları sürükleyip sırala, çıkar, önizle, geri al, kaydet, videosunu oluştur
   - Düzenlenmiş video panelinde altyazı görünümü önizlemesi (tek kare)
   - Kitaplıkta süzgeç ve sahnelerde (görüntüde) arama; İndirilenlerde temizleme önerisi
   - Video ▾ / Word ▾ menülerine ekler (zip, kurgu, yayın paketi, Content ve Couple köprüsü), Sonraki adımlar
   - Ayarlar → Sistem → Studio gelişimi (araç güncellemeleri, gelişmeler, öneriler, öğrenilenler) */
(() => {
if (typeof URUN === 'undefined' || URUN !== 'transcript') return;
const SVG_KALEM = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>';
const json = async (url, opts) => { const r = await fetch(url, opts); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.hata || 'Olmadı'); return j; };
const post = (url, body) => json(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})});
const aktif = () => state.aktifTemel, veri = () => state.sonuc?.veri || {};
const port = p => `${location.protocol}//${location.hostname}:${p}/`;
const isGoster = () => { $('#jobsSec')?.classList.remove('hidden'); setTimeout(isleriTara, 600); };
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
  let k = KR.id ? await kurguKaydet(KR.ad, KR.id) : await kurguKaydet('Kurgu ' + new Date().toLocaleString('tr-TR', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}), '');
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
    items = [...items, null, ['Hepsi tek dosyada (zip)', () => { location.href = '/zip/' + encodeURIComponent(temel) + '.zip'; toast('Zip hazırlanıyor'); }],
      ...(tur ? [[`Hepsi + üretilen ${tur} video (zip)`, () => { location.href = '/zip/' + encodeURIComponent(temel) + '.zip?video=1'; toast('Zip hazırlanıyor; videolar büyükse biraz sürer'); }]] : []),
      ...(v.yayin ? [['Yayın paketi (Word)', () => indirDosya(temel + '.yayin.docx', 'Yayın paketi')]] : [])];
  }
  if (anchor?.id === 'videoBtn' && temel){
    const http = /^https?:/.test(v.link || '');
    items = [...items, null, ['Metinden kurgu… (sırala, çıkar, önizle)', kurguAc], ['Yayın paketi…', () => { sekmeSec('yayin', true); if (!v.yayin) yayinBaslat(temel); }],
      ['Görüntüde aranabilir yap', async () => { try{ await post('/api/sahne-dizin/' + encodeURIComponent(temel)); toast('Sahneler çıkarılıp betimleniyor (1-3 dk); sonra Kitaplık → Sahneler’de aranır'); }catch(e){ toast(e.message); } }],
      ...(document.documentElement.dataset.misafir === '1' ? [] : [null, ...(http ? [['Content’te kendi versiyonunu yap ↗', () => window.open(port(8769) + '?link=' + encodeURIComponent(v.link) + '&istek=', '_blank')]] : []),
      ['Couple’da iş aç ↗', () => window.open(port(8768) + '?toplanti=' + encodeURIComponent(temel), '_blank')]])];
  }
  return _popover(anchor, items, opts);
};
function sonrakiEkle(temel, v){
  const sl = $('#stSonra .sl'); if (!sl || sl.querySelector('[data-st]')) return;
  const ek = [['yp', 'Yayın paketi', v.yayin ? 'Hazır. Başlık, açıklama, kapak, Shorts.' : 'Başlık, açıklama, bölümler, kapak, Shorts.'], ['kr', 'Metinden kurgu', 'Paragrafları sırala, çıkar, önizle.']];
  if (/^https?:/.test(v.link || '') && document.documentElement.dataset.misafir !== '1') ek.push(['ct', 'Kendi versiyonunu yap', 'Content’te bu videonun akımıyla.']);
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
  const zaman = t => t ? new Date(t * 1000).toLocaleString('tr-TR', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : '—';
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
  const zaman = t => t ? new Date(t * 1000).toLocaleString('tr-TR', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : 'henüz girmedi';
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
const ustOlc = () => { const n = $('.nav') || $('header'); if (n) document.documentElement.style.setProperty('--st-ust', Math.round(n.getBoundingClientRect().bottom) + 'px'); };
if ($('.nav') || $('header')){ ustOlc(); try{ new ResizeObserver(ustOlc).observe($('.nav') || $('header')); }catch(e){} window.addEventListener('resize', ustOlc); }

/* ---------------------------------------------------------------- 10) ana sayfa: çift birincil düğme ve tekrar eden çıktı satırları */
function mevcutBak(){ document.body.classList.toggle('st-mevcut', !!$('#mevcutAc')); }
if ($('#notice')) new MutationObserver(mevcutBak).observe($('#notice'), {childList: true, subtree: true});

/* ---------------------------------------------------------------- bağlantılar */
const _sonucGoster = sonucGoster;
sonucGoster = async function(temel, opts = {}){   // eslint-disable-line no-global-assign
  if (KR.acik && temel !== aktif()){ kurguDurdur(); KR.acik = false; $('#kurgubar')?.classList.remove('show'); }
  const r = await _sonucGoster(temel, opts);
  try{ const v = veri();
    duzeltKur();
    if (!v.toplanti){ yayinCiz(temel); sonrakiEkle(temel, v); okumaKur(temel, v, opts); }
    if (KR.acik && aktif() === temel){ $('#doc').classList.add('kurgu'); kurguCiz(); }
  }catch(e){ console.warn('Studio eki:', e); }
  return r;
};
const _gitSn = gitSn;
gitSn = function(sn){ sekmeSec('metin'); return _gitSn(sn); };   // eslint-disable-line no-global-assign
const _stSonraKur = stSonraKur;
stSonraKur = function(temel, v){ _stSonraKur(temel, v); try{ sonrakiEkle(temel, v); }catch(e){} };   // eslint-disable-line no-global-assign
const _altDlgAc = altDlgAc;
altDlgAc = function(temel, v){ _altDlgAc(temel, v); try{ altOnizleKur(); }catch(e){} };   // eslint-disable-line no-global-assign
const _sistemCiz = sistemCiz;
sistemCiz = async function(){ const r = await _sistemCiz(); try{ await gelisimCiz(); await davetCiz(); }catch(e){} return r; };   // eslint-disable-line no-global-assign
const _libGoster = libGoster;
libGoster = function(tab, kaydir){ _libGoster(tab, kaydir); try{ $('#stSuz')?.classList.toggle('hidden', tab !== 'tx'); $('#stSahne')?.classList.toggle('hidden', tab !== 'tx' || !SZ.sahne); if (tab === 'tx' && SZ.sahne) $('#hist').classList.add('hidden'); if (tab === 'dl') temizlikKur(); }catch(e){} };   // eslint-disable-line no-global-assign

const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/static/studio_ek.css?v=12'; document.head.appendChild(css);
const bekle = setInterval(() => { if ($('#hist')){ clearInterval(bekle); suzgecKur(); } }, 300);
if ($('#dls')) new MutationObserver(() => temizlikKur()).observe($('#dls'), {childList: true});
if ($('#aySistem') && $('#aySistem').textContent.trim() && !$('#aySistem').textContent.includes('Yükleniyor')) gelisimCiz();
if (state.aktifTemel && state.sonuc){ duzeltKur(); if (!veri().toplanti){ yayinCiz(state.aktifTemel); sonrakiEkle(state.aktifTemel, veri()); } }
})();
