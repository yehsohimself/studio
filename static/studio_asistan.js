/* Studio asistanı (2026-10-31; kullanıcı: "çok kısıtlı hissediyorum, bir soruya soruyla karşılık verebilmeliyim, chatbox olmalı; deneyim
   humanize edilmeli"). Her ekranda açılan tek sohbet: link kutusuna link yerine cümle yazmak, "Studio'ya sor" düğmesi ya da okuma ekranındaki
   Sor (/) aynı paneli açar. Asistan açık videoyu, kitaplığı ve süren işleri bilir; gerekirse tek soru sorar (dokunulabilir cevaplar), işleri
   öneri kartıyla verir: kullanıcı "Başlat" der, kart işin ilerlemesini canlı gösterir, bitince sohbete "hazır" notu düşer.
   Sesle yazma (bas, konuş, bırak), dosya ve link bırakma. Sunucu: /api/asistan (studio_asistan.py). Davetliye kapalı. */
(() => {
if (typeof URUN === 'undefined' || URUN !== 'transcript' || document.documentElement.dataset.misafir === '1') return;
{ const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/static/studio_asistan.css?v=10'; document.head.appendChild(l); }
const T = x => (window.DIL?.t || (y => y))(x);
const durumSakla = (k, v) => { try{ v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const durumOku = k => { let v = null; try{ v = JSON.parse(localStorage.getItem(k) || 'null'); }catch(e){} if (!v && k.startsWith('asKart_')) v = AS.kartlar?.[k.slice(7)] || null; return v; };
const AS = {kartlar: {}, acik: false, mesajlar: [], tercihler: [], ad: '', hazir: true, bekliyor: false, yuklendi: false, takip: {}, zamanlayici: null, kayit: null, durumT: null};
const IK = {
  ac: 'M4 5h16v14H4zM4 9h16', git: 'M5 12h14M13 6l6 6-6 6', kitaplik: 'M4 5h4v14H4zM10 5h4v14h-4zM16 6l4 1-3 13-4-1z',
  yaziya_dok: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5', ozetle: 'M5 6h14M5 10h14M5 14h9M5 18h6', indir: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  klip: 'M6 7a2 2 0 1 0 0 .1M6 17a2 2 0 1 0 0 .1M8 8l12 9M8 16l12-9', altyazili: 'M3 6h18v12H3zM6 14h5M13 14h5M6 11h12',
  cevir: 'M4 5h8M8 3v2M5 11c2-1 4-3 5-6M6 7c1 2 3 4 6 5M13 21l4-9 4 9M14.5 18h5', dublaj: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  one_cikanlar: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z', yayin: 'M4 12l16-8-6 16-3-7z', ozet_yenile: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  sessizlik: 'M4 12h3l2-6 3 12 2-6h6', dosya: 'M6 3h9l4 4v14H6z'
};
const svg = p => `<svg viewBox="0 0 24 24"><path d="${p}"/></svg>`;
const selam = () => { const s = new Date().getHours(); return s < 5 ? 'İyi geceler' : s < 12 ? 'Günaydın' : s < 18 ? 'İyi günler' : s < 23 ? 'İyi akşamlar' : 'İyi geceler'; };
const zk = sn => { sn = Math.max(0, Math.round(sn || 0)); return sn >= 3600 ? `${Math.floor(sn / 3600)}:${String(Math.floor(sn % 3600 / 60)).padStart(2, '0')}:${String(sn % 60).padStart(2, '0')}` : `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}`; };
const acikVideo = () => (!$('#resultSec').classList.contains('hidden') && state.aktifTemel && !state.sonuc?.veri?.toplanti) ? state.aktifTemel : '';
const linkKutusu = () => { const v = ($('#link')?.value || '').trim(); const m = v.match(/https?:\/\/\S+/); return m ? m[0] : ''; };

/* ---------------------------------------------------------------- yapı */
document.body.insertAdjacentHTML('beforeend', `<div id="asKok" style="display:none">
<button class="as-fab" id="asFab" type="button" title="${T('Studio’ya sorun ya da ne istediğinizi anlatın (/)')}"><span class="as-orb"></span><span class="as-fab-t">${T('Studio’ya sor')}</span></button>
<aside class="as-panel" id="asPanel" aria-label="${T('Studio asistanı')}" aria-hidden="true">
  <header class="as-h"><span class="as-orb as-orb-b" id="asOrb"></span><div class="as-ht"><b>Studio</b><small id="asBag"></small></div>
    <span class="as-hb"><button type="button" id="asMenu" class="as-ib" title="${T('Diğer')}" aria-label="${T('Diğer')}">${svg('M5 12h.01M12 12h.01M19 12h.01')}</button><button type="button" id="asKapat" class="as-ib" aria-label="${T('Kapat')}">${svg('M6 6l12 12M18 6L6 18')}</button></span></header>
  <div class="as-m" id="asMesaj" aria-live="polite"></div>
  <div class="as-sec" id="asSec"></div>
  <form class="as-g" id="asForm" autocomplete="off">
    <canvas class="as-dalga" id="asDalga" width="600" height="80" aria-hidden="true"></canvas>
    <textarea id="asGir" rows="1" placeholder="${T('Bir şey sorun ya da ne istediğinizi yazın…')}" aria-label="${T('Mesaj')}"></textarea>
    <div class="as-gb">
      <button type="button" id="asEk" class="as-ib" title="${T('Dosya ekle')}" aria-label="${T('Dosya ekle')}">${svg('M12 5v14M5 12h14')}</button>
      <span class="as-ipucu" id="asIpucu"></span>
      <button type="button" id="asMik" class="as-ib" title="${T('Sesle yazın: basın, konuşun, yeniden basın')}" aria-label="${T('Sesle yazın')}">${svg('M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3')}</button>
      <button type="submit" id="asGon" class="as-gon" aria-label="${T('Gönder')}">${svg('M12 19V5M5 12l7-7 7 7')}</button>
    </div>
    <input type="file" id="asDosya" accept="video/*,audio/*" hidden>
  </form>
  <div class="as-birak" id="asBirak"><span class="as-orb as-orb-b"></span><b>${T('Bırakın, ekleyeyim')}</b><small>${T('Video, ses dosyası ya da link')}</small></div>
</aside></div>`);
const P = $('#asPanel'), M = $('#asMesaj'), G = $('#asGir');

/* ---------------------------------------------------------------- aç / kapat */
async function yukle(){
  try{ const j = await (await fetch('/api/asistan')).json(); AS.mesajlar = j.mesajlar || []; AS.tercihler = j.tercihler || []; AS.kartlar = j.kartlar || {}; AS.ad = j.ad && j.ad !== 'kullanıcı' ? j.ad : ''; AS.hazir = j.hazir !== false; }catch(e){}
  AS.yuklendi = true;
}
async function ac(metin, gonder){
  AS.acik = true; document.body.classList.add('asAcik'); P.setAttribute('aria-hidden', 'false');
  bagGuncelle(); if (!AS.yuklendi) await yukle(); ciz(true);
  if (metin){ G.value = metin; boy(); if (gonder) return sor(metin); }
  setTimeout(() => G.focus({preventScroll: true}), 80);
}
function kapat(){ AS.acik = false; document.body.classList.remove('asAcik'); P.setAttribute('aria-hidden', 'true'); kayitDur(true); }
window.asistanAc = ac;
$('#asFab').onclick = () => ac();
$('#asKapat').onclick = kapat;
// okuma ekranındaki eski "Bu videoyla sohbet" (Sor, /) artık bu panel: aynı videoyu bilir, ayrıca iş de başlatır
window.sohbetAc = () => ac(); window.sohbetKapat = () => {};
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && AS.acik && !document.querySelector('dialog[open]')){ e.preventDefault(); kapat(); return; }
  if (e.key === '/' && !e.metaKey && !e.ctrlKey && !AS.acik && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable && state.yuz === 'video'){ e.preventDefault(); ac(); }
});

function bagGuncelle(){
  const t = acikVideo(), l = linkKutusu();
  const b = $('#asBag');
  if (t){ const bas = state.sonuc?.veri?.baslik || ''; b.innerHTML = `<i class="as-nok"></i>${esc(T('Bu videoya bakıyor'))} · ${esc(bas.length > 44 ? bas.slice(0, 42) + '…' : bas)}`; }
  else if (l){ const bas = state.preview?.baslik || l.replace(/^https?:\/\/(www\.)?/, ''); b.innerHTML = `<i class="as-nok"></i>${esc(T('Bu linke bakıyor'))} · ${esc(bas.length > 44 ? bas.slice(0, 42) + '…' : bas)}`; }
  else { const n = (state.tumListe || []).filter(x => !x.toplanti).length; b.innerHTML = `<i class="as-nok"></i>${esc(T('Kitaplığınız'))}${n ? ` · ${n} ${esc(T('video'))}` : ''}`; }
}

/* ---------------------------------------------------------------- çizim */
function oneriler(){
  const t = acikVideo(), l = linkKutusu();
  if (t){ const s = state.sonuc?.veri || {};
    return [T('3 cümlede ne anlatıyor?'), T('En çarpıcı anı bul, dikey klip yapalım'), s.dil === 'en' ? T('Türkçe altyazılı versiyonunu çıkar') : T('İngilizce altyazılı versiyonunu çıkar'), T('Bu videoyu nasıl paylaşmalıyım?')]; }
  if (l) return [T('Yazıya dök ve İngilizceye çevir'), T('Sadece özetini çıkar'), T('Sesini MP3 olarak indir'), T('Bundan Reels için kısa klipler çıkar')];
  const son = (state.tumListe || []).filter(x => !x.toplanti)[0];
  const o = [T('Neler yapabilirsin?')];
  if (son) o.unshift(T('Son videomdan paylaşılabilir anlar bul'));
  o.push(T('Kitaplığımda en çok hangi konular geçiyor?'));
  const sur = Object.values(AS.takip).find(x => x.durum === 'calisiyor' || x.durum === 'sirada');
  if (sur) o.unshift(T('Süren iş ne durumda?'));
  return o.slice(0, 4);
}
function bos(){
  const t = acikVideo(), l = linkKutusu();
  const alt = t ? T('Bu videoyu baştan sona okudum. Sorun, yorumlatın ya da ondan ne yapmak istediğinizi anlatın.')
    : l ? T('Bu linkle ne yapalım? Kendi cümlenizle anlatın; gerekirse ben size sorarım.')
    : T('Bir link yapıştırın, kitaplığınız hakkında bir şey sorun ya da ne yapmak istediğinizi anlatın.');
  return `<div class="as-bos"><span class="as-orb as-orb-xl"></span><h3>${esc(T(selam()))}${AS.ad ? ', ' + esc(AS.ad) : ''}.</h3><p>${esc(alt)}</p>
    <div class="as-cips">${oneriler().map(o => `<button type="button" class="as-cip" data-soru="${esc(o)}">${esc(o)}</button>`).join('')}</div>
    ${AS.hazir ? '' : `<p class="as-uyari">${esc(T('Claude şu an bağlı değil; yanıt veremem. Ayarlar → Genel → Claude ile yaz.'))}</p>`}</div>`;
}
function gunAyrac(z, onceki){
  const d = new Date(z * 1000), o = onceki ? new Date(onceki * 1000) : null;
  if (o && d.toDateString() === o.toDateString()) return '';
  const bugun = new Date(), dun = new Date(Date.now() - 864e5);
  const ad = d.toDateString() === bugun.toDateString() ? T('Bugün') : d.toDateString() === dun.toDateString() ? T('Dün') : d.toLocaleDateString(DIL?.locale || 'tr-TR', {day: 'numeric', month: 'long'});
  return `<div class="as-gun"><span>${esc(ad)}</span></div>`;
}
function kartHtml(e, anahtar){
  const k = durumOku('asKart_' + anahtar) || {};
  const ik = IK[e.tur] || IK.ac;
  const anlik = ['ac', 'git', 'kitaplik'].includes(e.tur);
  let alt = '';
  if (k.durum === 'iptal') alt = `<div class="as-kd sonuk">${esc(T('Vazgeçildi'))}</div>`;
  else if (k.durum === 'hata') alt = `<div class="as-kd hata">${esc(k.hata || T('Başlatılamadı'))}<button type="button" class="as-tb" data-k="${anahtar}" data-a="yeniden">${esc(T('Yeniden dene'))}</button></div>`;
  else if (k.durum === 'bitti') alt = `<div class="as-kd ok">${svg('M5 12l5 5 9-10')}<span>${esc(k.not || T('Hazır'))}</span>${k.ac ? `<button type="button" class="as-tb" data-k="${anahtar}" data-a="sonuc">${esc(k.acEt || T('Aç'))}</button>` : ''}</div>`;
  else if (k.durum) alt = `<div class="as-kd sur"><div class="as-pb"><i style="width:${Math.max(4, k.yuzde || 0)}%"></i></div><span>${esc(k.not || T('Başladı'))}</span></div>`;
  else alt = `<div class="as-kb"><button type="button" class="as-bb" data-k="${anahtar}" data-a="calis">${esc(anlik ? (e.tur === 'git' ? T('Git') : T('Aç')) : T('Başlat'))}</button>${anlik ? '' : `<button type="button" class="as-tb" data-k="${anahtar}" data-a="iptal">${esc(T('Vazgeç'))}</button>`}</div>`;
  return `<div class="as-kart ${k.durum || ''}" data-k="${anahtar}"><i class="as-ki">${svg(ik)}</i><div class="as-kt"><b>${esc(T(e.etiket || ''))}</b>${e.detay ? `<span>${esc(T(e.detay))}</span>` : ''}${e.baslik && !['ac'].includes(e.tur) && e.temel !== acikVideo() ? `<small>${esc(e.baslik)}</small>` : ''}${e.neden ? `<em>${esc(e.neden)}</em>` : ''}</div>${alt}</div>`;
}
// [dk:sn] ve [dk:sn@temel] işaretleri markdown'dan önce yer tutucuya çevrilir (temel adlarındaki _ italik sanılmasın)
function zamanla(metin, temel){
  const tok = [];
  const ara = String(metin || '').replace(/\[(\d{1,2}:\d{2}(?::\d{2})?)(?:@([^\]\s]+))?\]/g, (m, z, t) => { tok.push([z, t]); return `⁣Z${tok.length - 1}⁣`; });
  return mdHtml(ara).replace(/⁣Z(\d+)⁣/g, (m, i) => { const [z, t] = tok[+i]; const p = z.split(':').map(Number); const sn = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
    const ad = t ? ((state.tumListe || []).find(x => x.temel === t)?.baslik || '') : '';
    return `<button type="button" class="as-zt${t ? ' dis' : ''}" data-sn="${sn}" data-t="${esc(t || temel || '')}"${ad ? ` title="${esc(ad)}"` : ''}>${z}${t ? `<i>${svg('M7 17L17 7M9 7h8v8')}</i>` : ''}</button>`; });
}
function mesajHtml(m, i){
  if (m.rol === 'ben') return `<div class="as-b ben">${esc(m.metin)}${m.link && !m.metin.includes(m.link) ? `<small>${esc(m.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 50))}</small>` : ''}</div>`;
  if (m.rol === 'not') return `<div class="as-not">${svg(IK.one_cikanlar)}<span>${esc(m.metin)}</span></div>`;
  if (m.rol === 'yerel') return `<div class="as-b st"><span class="as-av as-orb"></span><div class="as-ic"><p>${esc(m.metin)}</p>${(m.eylemler || []).map((e, j) => kartHtml(e, (m.anahtar || m.zaman) + '_' + j)).join('')}</div></div>`;
  const ic = m.hata ? `<p class="as-hata">${esc(m.metin)}</p>` : zamanla(m.metin, m.temel);
  return `<div class="as-b st ${m.akiyor ? 'akiyor' : ''}"><span class="as-av as-orb ${m.akiyor ? 'dusun' : ''}"></span><div class="as-ic">${ic}
    ${(m.eylemler || []).map((e, j) => kartHtml(e, (m.zaman || i) + '_' + j)).join('')}
    ${m.hatirlandi ? `<div class="as-hat">${svg('M12 21s-7-4.5-7-11a7 7 0 0 1 14 0c0 6.5-7 11-7 11z')}<span>${esc(T('Aklımda tutacağım'))}: ${esc(m.hatirlandi)}</span></div>` : ''}
    ${!m.hata && !m.akiyor && m.metin ? `<span class="as-alt"><button type="button" class="as-kop" data-i="${i}">${esc(T('Kopyala'))}</button></span>` : ''}</div></div>`;
}
let durumYazi = '';
function ciz(asagi){
  const yakin = M.scrollHeight - M.scrollTop - M.clientHeight < 140;
  if (!AS.mesajlar.length && !AS.bekliyor){ M.innerHTML = bos(); $('#asSec').innerHTML = ''; return; }
  let h = '', onceki = 0;
  let bag = null;
  AS.mesajlar.forEach((m, i) => { h += gunAyrac(m.zaman || Date.now() / 1000, onceki); onceki = m.zaman || onceki;
    if (m.rol === 'ben'){ const b = m.temel || ''; if (bag !== null && b !== bag && b){ const ad = (state.tumListe || []).find(x => x.temel === b)?.baslik || (b === state.aktifTemel ? state.sonuc?.veri?.baslik : '') || '';
        if (ad) h += `<div class="as-bag"><span>${esc(T('Şimdi'))}: ${esc(ad.length > 60 ? ad.slice(0, 58) + '…' : ad)}</span></div>`; } bag = b; }
    h += mesajHtml(m, i); });
  if (AS.bekliyor) h += `<div class="as-b st dusunuyor"><span class="as-av as-orb dusun"></span><div class="as-ic"><span class="as-durum">${esc(durumYazi)}</span></div></div>`;
  M.innerHTML = h;
  const son = AS.mesajlar[AS.mesajlar.length - 1];
  const sec = (!AS.bekliyor && son && ((son.rol === 'studio' && !son.akiyor) || son.rol === 'not')) ? (son.secenekler || []) : [];
  const duz = x => String(x).replace(/\[(\d{1,2}:\d{2}(?::\d{2})?)(?:@[^\]]*)?\]/g, '$1');
  $('#asSec').innerHTML = sec.map(s => typeof s === 'string' ? `<button type="button" class="as-cip" data-soru="${esc(duz(s))}">${esc(duz(s))}</button>`
    : `<button type="button" class="as-cip" data-soru="${esc(s.m)}" data-ac="${esc(s.t || '')}">${esc(s.e)}</button>`).join('');
  if (asagi || yakin) M.scrollTop = M.scrollHeight;
}
function boy(){ G.style.height = 'auto'; G.style.height = Math.min(180, G.scrollHeight) + 'px'; $('#asGon').classList.toggle('dolu', !!G.value.trim()); }

/* ---------------------------------------------------------------- sohbet */
const DURUMLAR = {
  video: ['Videoyu baştan sona okuyorum', 'Doğru yeri arıyorum', 'Toparlıyorum'],
  link: ['Linke bakıyorum', 'Nasıl yapacağımızı düşünüyorum', 'Toparlıyorum'],
  genel: ['Kitaplığınıza bakıyorum', 'Düşünüyorum', 'Toparlıyorum']
};
function durumBaslat(){
  const L = DURUMLAR[acikVideo() ? 'video' : linkKutusu() ? 'link' : 'genel']; let i = 0; durumYazi = T(L[0]) + '…';
  clearInterval(AS.durumT); const t0 = Date.now();
  AS.durumT = setInterval(() => { const s = (Date.now() - t0) / 1000; i = s < 7 ? 0 : s < 16 ? 1 : 2; durumYazi = T(L[i]) + '…'; const d = M.querySelector('.as-durum'); if (d && d.textContent !== durumYazi) d.textContent = durumYazi; }, 1000);
}
async function sor(metin){
  metin = (metin || '').trim(); if (!metin || AS.bekliyor) return;
  const temel = acikVideo(), link = linkKutusu() || (metin.match(/https?:\/\/\S+/) || [''])[0];
  AS.mesajlar.push({rol: 'ben', metin, temel, link: link && !metin.includes(link) ? link : '', zaman: Date.now() / 1000});
  G.value = ''; boy(); AS.bekliyor = true; durumBaslat(); $('#asOrb').classList.add('dusun'); ciz(true);
  const m = {rol: 'studio', metin: '', temel, zaman: Date.now() / 1000, akiyor: true}; let son = 0;
  try{
    const r = await fetch('/api/asistan', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({mesaj: metin, temel, link})});
    if (!r.ok || !r.body){ let j = {}; try{ j = await r.json(); }catch(_){} throw new Error(j.hata || T('Şu an yanıt veremiyorum.')); }
    const okur = r.body.getReader(), coz = new TextDecoder(); let ham = '';
    for (;;){ const {done, value} = await okur.read(); if (done) break; ham += coz.decode(value, {stream: true});
      const k = ham.indexOf('\x00'); m.metin = k >= 0 ? ham.slice(0, k) : ham;
      if (m.metin.trim() && !AS.mesajlar.includes(m)){ AS.mesajlar.push(m); AS.bekliyor = false; }
      if (Date.now() - son > 70){ son = Date.now(); ciz(); } }
    const h = ham.indexOf('\x00HATA:'), e = ham.indexOf('\x00EK:');
    if (h >= 0) throw new Error(ham.slice(h + 7) || T('Yanıt alınamadı.'));
    if (e >= 0){ try{ Object.assign(m, JSON.parse(ham.slice(e + 4))); }catch(_){} }
    if (!AS.mesajlar.includes(m)) AS.mesajlar.push(m);
    if (!m.metin.trim()) m.metin = m.eylemler?.length ? T('Şunu hazırladım:') : T('Buna şu an bir yanıtım yok.');
    if (m.hatirlandi) AS.tercihler.push({metin: m.hatirlandi});
  }catch(err){ const x = AS.mesajlar.includes(m) ? m : (AS.mesajlar.push(m), m); x.hata = true; x.metin = err.message || T('Siteye ulaşılamadı.'); }
  m.akiyor = false; AS.bekliyor = false; clearInterval(AS.durumT); $('#asOrb').classList.remove('dusun'); ciz();
  // tek ve anlık eylem (aç / git) kullanıcı açıkça istediyse beklemeden yapılır: "fonların anlatıldığı yeri göster"
  if ((m.eylemler || []).length === 1 && m.eylemler[0].tur === 'git') eylem(m.zaman + '_0', 'calis');
}
$('#asForm').onsubmit = e => { e.preventDefault(); sor(G.value); };
G.addEventListener('input', boy);
G.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); sor(G.value); } });
P.addEventListener('click', e => {
  const c = e.target.closest('.as-cip'); if (c){ if (c.dataset.ac && c.dataset.ac !== state.aktifTemel){ sonucGoster(c.dataset.ac).then(() => setTimeout(() => sor(c.dataset.soru), 300)); return; } sor(c.dataset.soru); return; }
  const z = e.target.closest('.as-zt'); if (z){ zamanaGit(+z.dataset.sn, z.dataset.t); return; }
  const k = e.target.closest('[data-a]'); if (k && k.dataset.k){ eylem(k.dataset.k, k.dataset.a); return; }
  const kp = e.target.closest('.as-kop'); if (kp){ navigator.clipboard.writeText(AS.mesajlar[+kp.dataset.i]?.metin || ''); toast(T('Kopyalandı')); return; }
  const u = e.target.closest('[data-unut]'); if (u){ fetch('/api/asistan/tercih', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({sil: +u.dataset.unut})}).then(() => { AS.tercihler.splice(+u.dataset.unut, 1); hafizaGoster(); }); }
});
async function zamanaGit(sn, temel){
  if (temel && temel !== state.aktifTemel){ await sonucGoster(temel); setTimeout(() => gitSn(sn), 700); }
  else gitSn(sn);
  if (matchMedia('(max-width:760px)').matches) kapat();
}
$('#asMenu').onclick = () => popover($('#asMenu'), [
  [T('Yeni sohbet'), async () => { await fetch('/api/asistan', {method: 'DELETE'}); AS.mesajlar = []; ciz(true); G.focus(); }],
  [`${T('Aklımda tuttuklarım')}${AS.tercihler.length ? ' (' + AS.tercihler.length + ')' : ''}`, hafizaGoster]
]);
function hafizaGoster(){
  const L = AS.tercihler;
  M.insertAdjacentHTML('beforeend', `<div class="as-hafiza"><b>${esc(T('Aklımda tuttuklarım'))}</b>${L.length ? L.map((t, i) => `<div><span>${esc(t.metin)}</span><button type="button" class="as-tb" data-unut="${i}">${esc(T('Unut'))}</button></div>`).join('')
    : `<p>${esc(T('Henüz bir şey yok. "Klipler hep dikey olsun" gibi bir tercihinizi söylerseniz hatırlarım.'))}</p>`}</div>`);
  M.querySelectorAll('.as-hafiza').forEach((x, i, a) => { if (i < a.length - 1) x.remove(); });
  M.scrollTop = M.scrollHeight;
}

/* ---------------------------------------------------------------- eylemler */
function eylemBul(anahtar){
  for (const m of AS.mesajlar){ const ek = (m.eylemler || []); for (let j = 0; j < ek.length; j++) if (((m.anahtar || m.zaman) + '_' + j) === anahtar) return ek[j]; }
  return null;
}
function kartYaz(anahtar, d){ const eski = durumOku('asKart_' + anahtar) || {}, yeni = {...eski, ...d}; durumSakla('asKart_' + anahtar, yeni); AS.kartlar[anahtar] = yeni;
  if (yeni.durum !== eski.durum || yeni.is !== eski.is) fetch('/api/asistan/kart', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({anahtar, durum: yeni})}).catch(() => {});
  ciz(); }
async function api(url, body){ const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})}); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.hata || T('Başlatılamadı')); return j; }
function isKaydet(id, kart){ state.jobs[id] = true; $('#jobsSec')?.classList.remove('hidden'); try{ renderJob({id, durum: 'sirada', adim: 0, ilerleme: 0, log: [], ...kart}); }catch(e){} if (!state.timer) state.timer = setInterval(pollJobs, 1500); pollJobs(); }
async function eylem(anahtar, a){
  const e = eylemBul(anahtar); if (!e) return;
  if (a === 'iptal'){ kartYaz(anahtar, {durum: 'iptal'}); return; }
  if (a === 'sonuc'){ const k = durumOku('asKart_' + anahtar) || {}; sonucAc(k.ac); return; }
  const kap = e.temel ? `/kapak/${encodeURIComponent(e.temel)}.jpg` : '';
  try{
    switch (e.tur){
      case 'ac': await sonucGoster(e.temel); kartYaz(anahtar, {durum: 'bitti', not: T('Açıldı'), ac: {temel: e.temel}, acEt: T('Yeniden aç')}); if (matchMedia('(max-width:760px)').matches) kapat(); return;
      case 'git': await zamanaGit(e.sn, e.temel); kartYaz(anahtar, {durum: 'bitti', not: `${zk(e.sn)} ${T('anına gidildi')}`, ac: {temel: e.temel, sn: e.sn}, acEt: T('Yeniden git')}); return;
      case 'kitaplik': yuzSec('kitaplik'); return;
      case 'yaziya_dok': case 'ozetle': {
        const ozm = e.tur === 'ozetle';
        const body = {...txBody(e.link, false), ozet_modu: ozm, ozet: true, konusmaci: !ozm, ceviri_dil: ozm ? '' : (e.ceviri || ''), altyazili: !ozm && !!e.altyazili,
          dublaj: !ozm && !!e.dublaj, dublaj_dil: ozm ? '' : (e.dublaj || ''), video_kaydet: !ozm && !!e.indir, goruntu: false};
        const j = await api('/api/baslat', body);
        isKaydet(j.id, {link: e.link, baslik: state.preview?.baslik, kapak: state.preview?.kapak, sure: state.preview?.sure});
        if (j.indir_id) isKaydet(j.indir_id, {tur: 'indir', link: e.link});
        kartYaz(anahtar, {durum: 'sirada', is: j.id, not: T('Sıraya girdi')}); break; }
      case 'indir': { const j = await api('/api/baslat', {link: e.link, islem: 'indir', kalite: e.kalite, kesit: e.kesit || ''}); isKaydet(j.id, {tur: 'indir', link: e.link, kalite: e.kalite}); kartYaz(anahtar, {durum: 'sirada', is: j.id, not: T('Sıraya girdi')}); break; }
      case 'klip': { const j = await api('/api/baslat', {islem: 'klip', temel: e.temel, kesit: `${e.bas}-${e.bit}`, dikey: e.dikey, stil: e.stil, dil: e.dil}); isKaydet(j.id, {tur: 'klip', temel: e.temel, baslik: e.baslik, kapak: kap}); kartYaz(anahtar, {durum: 'sirada', is: j.id, not: T('Sıraya girdi')}); break; }
      case 'altyazili': { const j = await api('/api/baslat', {islem: 'altyazili', temel: e.temel, dil: e.dil, stil: e.stil, dikey: e.dikey}); isKaydet(j.id, {tur: 'altyazili', temel: e.temel, baslik: e.baslik, kapak: kap}); kartYaz(anahtar, {durum: 'sirada', is: j.id, not: T('Sıraya girdi')}); break; }
      case 'sessizlik': { const j = await api('/api/baslat', {islem: 'sessizlik', temel: e.temel, bicim: e.bicim, baslik: e.baslik}); isKaydet(j.id, {tur: 'sessizlik', temel: e.temel, baslik: e.baslik, kapak: kap}); kartYaz(anahtar, {durum: 'sirada', is: j.id, not: T('Sıraya girdi')}); break; }
      case 'dublaj': { const j = await api('/api/dublaj/' + encodeURIComponent(e.temel), {dil: e.dil, onizleme: e.onizleme});
        kartYaz(anahtar, {durum: 'calisiyor', dublaj: {temel: e.temel, dil: e.dil, t: Date.now() / 1000}, not: j.ceviri ? T('Önce çeviriyor, sonra seslendirecek') : T('Seslendirme sıraya girdi')}); setTimeout(isleriTara, 3000); break; }
      case 'cevir': { await api('/api/ceviri/' + encodeURIComponent(e.temel), {dil: e.dil}); kartYaz(anahtar, {durum: 'calisiyor', ceviri: e.temel, not: T('Çeviriyor')}); break; }
      case 'yayin': { await api('/api/yayin/' + encodeURIComponent(e.temel), {}); kartYaz(anahtar, {durum: 'calisiyor', yayin: e.temel, not: T('Yayın paketi yazılıyor (~1 dk)')}); break; }
      case 'one_cikanlar': { kartYaz(anahtar, {durum: 'calisiyor', not: T('Anları seçiyorum (~30 sn)')});
        const j = await api('/api/klipler/' + encodeURIComponent(e.temel), {}); bitti(anahtar, {not: `${(j.klipler || []).length} ${T('an seçildi')}`, ac: {temel: e.temel, sekme: 'klip'}, acEt: T('Göster')}, e); return; }
      case 'ozet_yenile': { kartYaz(anahtar, {durum: 'calisiyor', not: T('Özeti yeniden yazıyorum')});
        await api('/api/ozet/' + encodeURIComponent(e.temel), {bicim: e.bicim, not: e.not}); bitti(anahtar, {not: T('Özet yenilendi'), ac: {temel: e.temel, sekme: 'ozet'}, acEt: T('Göster')}, e); return; }
      default: return;
    }
    takipBaslat();
  }catch(err){ kartYaz(anahtar, {durum: 'hata', hata: err.message}); }
}
function sonucAc(ac){
  if (!ac) return;
  if (ac.sn != null){ zamanaGit(ac.sn, ac.temel); return; }
  if (ac.dosya){ try{ oynat({ad: ac.dosya, baslik: ac.baslik || ac.dosya}); }catch(e){ yuzSec('kitaplik'); libGoster('dl', true); } return; }
  if (ac.temel){ sonucGoster(ac.temel).then(() => { if (ac.sekme) setTimeout(() => document.querySelector(`#stSek [data-s="${ac.sekme}"], #stSek [data-v="${ac.sekme}"]`)?.click(), 400); }); if (matchMedia('(max-width:760px)').matches) kapat(); }
}
function bitti(anahtar, d, e){
  kartYaz(anahtar, {durum: 'bitti', yuzde: 100, ...d});
  const metin = `${T(e?.etiket || 'İş')}${e?.baslik ? ' · ' + e.baslik : ''}: ${d.not || T('hazır')}`;
  const t = d.ac?.temel || '';
  AS.mesajlar.push({rol: 'not', metin, temel: t, zaman: Date.now() / 1000, secenekler: t && !d.ac?.sekme ? [{e: T('Aç ve özetle'), m: T('3 cümlede ne anlatıyor?'), t}, {e: T('Klip öner'), m: T('En çarpıcı anı bul, dikey klip yapalım'), t}] : []});
  fetch('/api/asistan/not', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({metin, ek: {temel: e?.temel || '', tur: e?.tur || ''}})}).catch(() => {});
  if (!AS.acik) toast(`Studio · ${metin}`, d.ac ? (d.acEt || T('Aç')) : null, d.ac ? () => sonucAc(d.ac) : null, 9000);
}

/* süren işleri izler: /api/isler (iş kimliğiyle), çeviri ve yayın durumları; kartlar canlı ilerler, bitince sohbete not düşer */
function takipBaslat(){ if (!AS.zamanlayici) AS.zamanlayici = setInterval(takip, 2500); takip(); }
async function takip(){
  const bekleyen = [];
  for (const m of AS.mesajlar) (m.eylemler || []).forEach((e, j) => { const a = (m.anahtar || m.zaman) + '_' + j, k = durumOku('asKart_' + a); if (k && ['sirada', 'calisiyor'].includes(k.durum)) bekleyen.push([a, e, k]); });
  if (!bekleyen.length){ clearInterval(AS.zamanlayici); AS.zamanlayici = null; return; }
  let L = null; try{ L = await (await fetch('/api/isler')).json(); }catch(e){ return; }
  for (const [a, e, k] of bekleyen){
    if (k.is || k.dublaj){
      const j = k.is ? L.find(x => x.id === k.is) : L.filter(x => x.tur === 'dublaj' && x.temel === k.dublaj.temel && (x.olusturma || 0) >= k.dublaj.t - 5).sort((x, y) => y.olusturma - x.olusturma)[0];
      if (!j){ if (k.is) kartYaz(a, {durum: 'hata', hata: T('İş bulunamadı; site yeniden başlamış olabilir.')}); continue; }
      AS.takip[j.id] = j;
      if (j.durum === 'bitti'){
        const dosya = (j.dosya || '').split('/').pop();
        bitti(a, j.tur ? {not: j.tur === 'indir' ? T('İndi') : (j.onizleme ? T('Önizleme hazır') : T('Video hazır')), ac: dosya ? {dosya, baslik: j.baslik} : {temel: j.temel}, acEt: dosya ? T('Oynat') : T('Aç')}
          : {not: T('Yazıya döküldü'), ac: {temel: j.temel}, acEt: T('Aç')}, {...e, baslik: e.baslik || j.baslik});
      } else if (j.durum === 'hata' || j.durum === 'durdu') kartYaz(a, {durum: 'hata', hata: j.hata || T('İş durdu')});
      else kartYaz(a, {durum: j.durum, yuzde: j.durum === 'sirada' ? 2 : Math.round(j.ilerleme || 0), not: j.durum === 'sirada' ? (j.sira_no > 1 ? `${T('Sırada')} · ${j.sira_no}.` : T('Birazdan başlıyor')) : adimMetni(j)});
    } else if (k.ceviri){
      try{ const d = await (await fetch('/api/ceviri-durum/' + encodeURIComponent(k.ceviri))).json();
        if (d.calisiyor) kartYaz(a, {yuzde: Math.round(d.ilerleme || 0), not: T(d.metin || 'Çeviriyor').slice(0, 70)});
        else if (d.hata) kartYaz(a, {durum: 'hata', hata: d.hata}); else bitti(a, {not: T('Çeviri hazır'), ac: {temel: k.ceviri}, acEt: T('Aç')}, e); }catch(_){}
    } else if (k.yayin){
      try{ const d = await (await fetch('/api/yayin-durum/' + encodeURIComponent(k.yayin))).json();
        if (d.calisiyor) kartYaz(a, {not: T('Yayın paketi yazılıyor')}); else if (d.hata) kartYaz(a, {durum: 'hata', hata: d.hata}); else bitti(a, {not: T('Yayın paketi hazır'), ac: {temel: k.yayin, sekme: 'yayin'}, acEt: T('Göster')}, e); }catch(_){}
    }
  }
}

const ADIM = {
  '': ['Hazırlanıyor', 'Video iniyor', 'Konuşmacılar ayrılıyor', 'Yazıya dökülüyor', 'Belgeler yazılıyor', 'Özet çıkarılıyor'],
  indir: ['Hazırlanıyor', 'Bağlanıyor', 'İniyor', 'Birleştiriliyor', 'Kaydediliyor'],
  video: ['Hazırlanıyor', 'Kaynak video hazırlanıyor', 'Altyazılar çiziliyor', 'Video yazılıyor', 'Kaydediliyor'],
  dublaj: ['Hazırlanıyor', 'Video hazırlanıyor', 'Ses hazırlanıyor', 'Seslendiriliyor', 'Kaydediliyor']
};
function adimMetni(j){
  const L = ADIM[j.tur === 'indir' ? 'indir' : j.tur === 'dublaj' ? 'dublaj' : j.tur ? 'video' : ''], a = Math.max(0, Math.min(L.length - 1, +j.adim || 0));
  const y = Math.round(j.ilerleme || 0);
  return T(L[a]) + (y > 0 && y < 100 ? ` · %${y}` : '');
}

/* ---------------------------------------------------------------- sesle yazma (kullanıcının kendi sesi; basınca başlar, yeniden basınca biter) */
async function kayitBasla(){
  if (!navigator.mediaDevices?.getUserMedia){ toast(T('Bu tarayıcı mikrofona izin vermiyor.')); return; }
  let akis; try{ akis = await navigator.mediaDevices.getUserMedia({audio: true}); }catch(e){ toast(T('Mikrofon izni verilmedi.')); return; }
  const parcalar = [], mr = new MediaRecorder(akis);
  const ac_ = new (window.AudioContext || window.webkitAudioContext)(), an = ac_.createAnalyser(); an.fftSize = 512; ac_.createMediaStreamSource(akis).connect(an);
  AS.kayit = {mr, akis, ac: ac_, an, t0: Date.now()};
  mr.ondataavailable = e => e.data.size && parcalar.push(e.data);
  mr.onstop = async () => {
    akis.getTracks().forEach(t => t.stop()); ac_.close().catch(() => {});
    const iptal = AS.kayit?.iptal; AS.kayit = null; P.classList.remove('kayit'); $('#asIpucu').textContent = '';
    if (iptal || !parcalar.length) return;
    const b = new Blob(parcalar, {type: mr.mimeType || 'audio/webm'}); if (b.size < 1500){ toast(T('Çok kısaydı; biraz daha uzun konuşun.')); return; }
    $('#asIpucu').textContent = T('Yazıya döküyorum…'); P.classList.add('cozuyor');
    const fd = new FormData(); fd.append('dosya', b, 'ses.' + ((mr.mimeType || '').includes('mp4') ? 'm4a' : 'webm')); fd.append('dil', (window.DIL?.dil === 'en') ? 'en' : 'tr');
    try{ const r = await fetch('/api/asistan/ses', {method: 'POST', body: fd}); const j = await r.json(); if (!r.ok) throw new Error(j.hata);
      G.value = (G.value ? G.value + ' ' : '') + j.metin; boy(); sor(G.value); }
    catch(e){ toast(e.message || T('Sesi yazıya dökemedim.')); }
    finally{ P.classList.remove('cozuyor'); $('#asIpucu').textContent = ''; }
  };
  mr.start(); P.classList.add('kayit'); $('#asIpucu').textContent = T('Dinliyorum… bitince yeniden basın'); dalgaCiz();
  setTimeout(() => { if (AS.kayit?.mr === mr) kayitDur(); }, 90000);
}
function kayitDur(iptal){ if (!AS.kayit) return; AS.kayit.iptal = !!iptal; try{ AS.kayit.mr.stop(); }catch(e){} }
$('#asMik').onclick = () => AS.kayit ? kayitDur() : kayitBasla();
function dalgaCiz(){
  const c = $('#asDalga'), x = c.getContext('2d'), k = AS.kayit; if (!k) return;
  const veri = new Uint8Array(k.an.fftSize), renk = getComputedStyle(document.documentElement).getPropertyValue('--vurgu').trim() || '#2D5BFF';
  const tur = () => { if (!AS.kayit) { x.clearRect(0, 0, c.width, c.height); return; }
    k.an.getByteTimeDomainData(veri); x.clearRect(0, 0, c.width, c.height);
    const n = 48, w = c.width / n; x.fillStyle = renk;
    for (let i = 0; i < n; i++){ let t = 0; for (let j = 0; j < 8; j++) t = Math.max(t, Math.abs(veri[(i * 8 + j) % veri.length] - 128)); const h = Math.max(4, t / 128 * c.height * 1.6); x.globalAlpha = .35 + .65 * Math.min(1, t / 40); x.fillRect(i * w + 2, (c.height - h) / 2, w - 4, h); }
    requestAnimationFrame(tur); };
  tur();
}

/* ---------------------------------------------------------------- dosya / link bırakma */
$('#asEk').onclick = () => $('#asDosya').click();
$('#asDosya').onchange = () => { const f = $('#asDosya').files[0]; $('#asDosya').value = ''; if (f) dosyaEkle(f); };
async function dosyaEkle(f){
  const z = Date.now() / 1000, m = {rol: 'yerel', metin: `${f.name} ${T('yükleniyor')}…`, zaman: z, anahtar: 'd' + Math.round(z), eylemler: []};
  AS.mesajlar.push({rol: 'ben', metin: '📎 ' + f.name, zaman: z}); AS.mesajlar.push(m); ciz(true);
  try{ const fd = new FormData(); fd.append('dosya', f); const r = await fetch('/api/yukle', {method: 'POST', body: fd}); const j = await r.json(); if (!r.ok) throw new Error(j.hata);
    m.metin = T('Dosyayı aldım. Ne yapalım?');
    m.eylemler = [{tur: 'dosya_tx', yol: j.yol, ad: j.ad, etiket: 'Yazıya dök', detay: 'Transkript, konuşmacılar ve özet'}, {tur: 'dosya_oz', yol: j.yol, ad: j.ad, etiket: 'Özetle', detay: 'Hızlı özet; konuşmacılar ayrılmaz'}];
  }catch(e){ m.metin = e.message || T('Dosya alınamadı.'); }
  ciz(true);
}
// yerel kartlar (bırakılan dosya) aynı eylem düğmesinden geçer
const _eylem = eylem;
eylem = async function(anahtar, a){   // eslint-disable-line no-func-assign
  const e = eylemBul(anahtar);
  if (e && (e.tur === 'dosya_tx' || e.tur === 'dosya_oz') && a === 'calis'){
    const ozm = e.tur === 'dosya_oz';
    try{ const j = await api('/api/baslat', {...txBody(e.yol, true), ozet_modu: ozm, ozet: true, konusmaci: !ozm, altyazili: false, dublaj: false, ceviri_dil: '', video_kaydet: false});
      isKaydet(j.id, {link: e.yol, baslik: e.ad}); kartYaz(anahtar, {durum: 'sirada', is: j.id, not: T('Sıraya girdi')}); takipBaslat();
      const m = AS.mesajlar.find(x => (x.eylemler || []).includes(e)); (m?.eylemler || []).forEach((x, j2) => { if (x !== e) kartYaz((m.anahtar) + '_' + j2, {durum: 'iptal'}); }); }
    catch(err){ kartYaz(anahtar, {durum: 'hata', hata: err.message}); }
    return;
  }
  return _eylem(anahtar, a);
};
let surukle = 0;
P.addEventListener('dragenter', e => { e.preventDefault(); surukle++; P.classList.add('birak'); });
P.addEventListener('dragleave', () => { if (--surukle <= 0){ surukle = 0; P.classList.remove('birak'); } });
P.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
P.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); surukle = 0; P.classList.remove('birak');
  const f = e.dataTransfer.files?.[0]; if (f) return dosyaEkle(f);
  const u = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text') || '').trim(); if (u){ G.value = (G.value ? G.value + ' ' : '') + u; boy(); G.focus(); } });

/* ---------------------------------------------------------------- ana sayfa: tek kutu hem link hem cümle */
const L_ = $('#link');
if (L_){
  L_.type = 'text'; L_.setAttribute('inputmode', 'text'); L_.setAttribute('enterkeyhint', 'go');
  L_.placeholder = matchMedia('(max-width:520px)').matches ? T('Link ya da isteğiniz') : T('Video linki yapıştırın ya da ne istediğinizi yazın');
  const cumleMi = v => { v = v.trim(); if (!v || v.startsWith('/')) return false; const linkler = v.match(/https?:\/\/\S+/g) || []; const kalan = v.replace(/https?:\/\/\S+/g, '').trim(); return !linkler.length ? !/^\S+\.\S+$/.test(v) : kalan.split(/\s+/).filter(Boolean).length >= 2 && !/^(https?:\/\/\S+\s*)+$/.test(v); };
  const gonder = e => { const v = L_.value.trim(); if (!cumleMi(v)) return false; e.preventDefault(); e.stopImmediatePropagation(); const link = (v.match(/https?:\/\/\S+/) || [''])[0];
    L_.value = link; L_.dispatchEvent(new Event('input')); ac(v, true); return true; };   // kutuda yalnız link kalır: önizlemesi açılır, asistan "Bu linke bakıyor"
  // belge düzeyinde, yakalama aşamasında: link kutusunun kendi Return/Başlat dinleyicilerinden ÖNCE çalışır
  document.addEventListener('keydown', e => { if (e.target === L_ && e.key === 'Enter' && !e.isComposing) gonder(e); }, true);
  document.addEventListener('click', e => { if (e.target.closest('#go, #goIk')) gonder(e); }, true);
  L_.addEventListener('input', () => { const c = cumleMi(L_.value); document.body.classList.toggle('asCumle', c);
    if (c && !/https?:\/\//.test(L_.value)){ document.body.classList.remove('cikti-acik'); $('#adv')?.classList.remove('open'); }
    const h = $('#hint'); if (h && c) h.textContent = T('Return ile Studio’ya sorun'); });
}
// ana sayfada kişisel karşılama: saat, ad, kaldığı yer; dokununca sohbet açılır
function selamCiz(){
  const ip = $('#ipucu'); if (!ip || $('#asSelam')) return;
  const d = document.createElement('div'); d.id = 'asSelam'; d.className = 'as-selam'; ip.after(d); selamGuncelle();
}
function selamGuncelle(){
  const d = $('#asSelam'); if (!d) return;
  const son = (state.tumListe || []).filter(x => !x.toplanti)[0];
  const sur = Object.values(state.jobs || {}).length;
  const metin = sur ? T('İşleriniz sürüyor; bu arada bir şey sorabilirsiniz.')
    : son ? `${T('En son')} “${(son.baslik || '').slice(0, 48)}${(son.baslik || '').length > 48 ? '…' : ''}” ${T('üzerinde çalıştınız.')}` : T('İlk videonuzla başlayalım.');
  const cips = son ? [[T('Ondan klip çıkar'), `“${son.baslik}” videosundan paylaşılabilir en iyi anı bul ve dikey klip öner.`], [T('Kaldığım yerden devam'), `“${son.baslik}” ile kaldığım yerden devam edelim; sırada ne yapmamı önerirsin?`]] : [[T('Neler yapabilirsin?'), T('Neler yapabilirsin?')]];
  d.innerHTML = `<button type="button" class="as-selam-b" data-y="0"><span class="as-orb"></span><span class="as-selam-t">${esc(metin)}</span></button>
    <span class="as-selam-c">${cips.map((c, i) => `<button type="button" class="as-cip kucuk" data-y="${i + 1}">${esc(c[0])}</button>`).join('')}</span>`;
  d.querySelectorAll('[data-y]').forEach(b => b.onclick = () => { const i = +b.dataset.y; i ? ac(cips[i - 1][1], true) : ac(); });
}
/* iş bitince Studio kendisi seslenir: düğmenin üstünde küçük bir balon, iki dokunuşluk devam önerisi (aynı iş için bir kez) */
const duyurulan = new Set(durumOku('asDuyurulan') || []);
function balon(baslik, metin, cips){
  $('#asBalon')?.remove(); if (AS.acik) return;
  const b = document.createElement('div'); b.id = 'asBalon'; b.className = 'as-balon';
  b.innerHTML = `<button type="button" class="as-balon-x" aria-label="${esc(T('Kapat'))}">${svg('M6 6l12 12M18 6L6 18')}</button><span class="as-orb"></span><div><b>${esc(baslik)}</b><p>${esc(metin)}</p>
    <span>${cips.map((c, i) => `<button type="button" class="as-cip kucuk" data-i="${i}">${esc(c[0])}</button>`).join('')}</span></div>`;
  document.body.appendChild(b); requestAnimationFrame(() => b.classList.add('acik'));
  const kapa = () => { b.classList.remove('acik'); setTimeout(() => b.remove(), 300); };
  b.querySelector('.as-balon-x').onclick = kapa; b.querySelectorAll('[data-i]').forEach(x => x.onclick = () => { kapa(); const c = cips[+x.dataset.i]; c[2] ? c[2]() : ac(c[1], true); });
  setTimeout(kapa, 25000);
}
const _renderJob = renderJob;
renderJob = function(d){   // eslint-disable-line no-global-assign
  _renderJob(d);
  try{
    if (d && d.durum === 'bitti' && !d.tur && d.temel && !d.toplanti && !duyurulan.has(d.id) && (Date.now() / 1000 - (d.bitis || d.olusturma || 0)) < 3600){
      duyurulan.add(d.id); durumSakla('asDuyurulan', [...duyurulan].slice(-60));
      const bas = (d.baslik || '').length > 50 ? d.baslik.slice(0, 48) + '…' : (d.baslik || T('Video'));
      setTimeout(() => balon(`${T('Hazır')}: ${bas}`, T('Bir göz atalım mı? İsterseniz en güzel anı bulup kısa bir klip önereyim.'), [
        [T('Ne anlatıyor?'), '', async () => { await sonucGoster(d.temel); ac(T('3 cümlede ne anlatıyor?'), true); }],
        [T('Klip öner'), '', async () => { await sonucGoster(d.temel); ac(T('En çarpıcı anı bul, dikey klip yapalım'), true); }]]), 1200);
    }
  }catch(e){}
};
yukle().then(() => { selamCiz(); bagGuncelle(); takipBaslat(); });
{ let n = 0; const t = setInterval(() => { if (state.tumListe || ++n > 40){ clearInterval(t); selamGuncelle(); } }, 400); }
// bağlam değişince (video açıldı/kapandı, link yazıldı) panel başlığı ve boş ekran önerileri güncellenir
new MutationObserver(() => { bagGuncelle(); if (AS.acik && !AS.mesajlar.length) ciz(); }).observe($('#resultSec'), {attributes: true, attributeFilter: ['class']});
$('#link')?.addEventListener('input', () => { if (AS.acik) bagGuncelle(); });
})();
