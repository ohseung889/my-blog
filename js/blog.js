/* ============================================================
   MY.BLOG — 공유 렌더 엔진
   모든 페이지가 이 파일을 통해 data.json/data.js 의 내용을 렌더합니다.
   ============================================================ */

// ── 데이터 로드 ───────────────────────────────────────────────
async function getData() {
  if (window.BLOG_DATA) return window.BLOG_DATA;     // data.js (정적)
  const r = await fetch('/api/data');
  return r.json();                                     // 로컬 서버
}

// ── 외부 라이브러리 자동 로드 ────────────────────────────────
(function() {
  // Marked.js — Markdown 렌더링
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/marked@9/marked.min.js';
  s.onload = () => marked.setOptions({ breaks: true, gfm: true });
  document.head.appendChild(s);
})();

// ── 유틸 ─────────────────────────────────────────────────────
function h(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function paras(text) {
  if (!text) return '';
  if (window.marked) return marked.parse(text);  // Markdown 지원
  return text.split('\n\n').filter(Boolean).map(p => `<p>${h(p)}</p>`).join('');
}
function setVar(name, val) { document.documentElement.style.setProperty(name, val); }

// ── OG 태그 / SEO ─────────────────────────────────────────────
function setMeta(title, desc, imgPath) {
  const siteName = window.BLOG_DATA?.site?.name || 'MY.BLOG';
  document.title = (title || siteName) + ' — ' + siteName;
  const tags = {
    'og:title': title || siteName,
    'og:description': desc || '',
    'og:image': imgPath ? (location.origin + '/' + imgPath) : '',
    'og:type': 'website',
    'og:url': location.href,
    'description': desc || '',
    'twitter:card': 'summary_large_image',
    'twitter:title': title || siteName,
    'twitter:description': desc || '',
    'twitter:image': imgPath ? (location.origin + '/' + imgPath) : '',
  };
  Object.entries(tags).forEach(([name, content]) => {
    const isProp = name.startsWith('og:') || name.startsWith('twitter:');
    const attr   = isProp ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  });
}

// ── Leaflet 지도 자동 로드 ────────────────────────────────────
function loadLeaflet() {
  return new Promise(resolve => {
    if (window.L) return resolve();
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = resolve;
    document.head.appendChild(js);
  });
}

// ── 스크롤 리빌 ───────────────────────────────────────────────
function initReveal() {
  const obs = new IntersectionObserver(
    es => es.forEach(e => e.isIntersecting && e.target.classList.add('visible')),
    { threshold: 0.08 }
  );
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ── 모달 ─────────────────────────────────────────────────────
let _modalEntries = {};
function openModal(id) {
  const e = _modalEntries[id]; if (!e) return;
  const photos = (e.photos || []).map((p,i) =>
    `<img src="/${p}" onclick="openLightbox(${JSON.stringify(e.photos||[])},${i})" />`
  ).join('');
  document.getElementById('modal-inner').innerHTML = `
    <img class="modal-hero" src="/${e.heroImage}" />
    <div class="modal-bwrap">
      <span class="entry-tag">${h(e.tag)}</span>
      <h2 class="modal-title">${h(e.title)}</h2>
      <hr class="modal-divider"/>
      <div class="modal-text">${paras(e.body)}</div>
      ${photos ? `<div class="modal-photos">${photos}</div>` : ''}
      <div class="modal-footer-meta">${(e.meta||[]).map(m=>`<span>${h(m)}</span>`).join('')}</div>
    </div>`;
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
}
function _handleModalBg(e) { if (e.target === document.getElementById('modal')) closeModal(); }

// ── 라이트박스 ────────────────────────────────────────────────
let _lbPhotos = [], _lbIdx = 0;
function openLightbox(photos, idx) {
  _lbPhotos = photos; _lbIdx = idx;
  document.getElementById('lb-img').src = '/' + photos[idx];
  document.getElementById('lb-count').textContent = `${idx + 1} / ${photos.length}`;
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}
function lbNav(d) {
  _lbIdx = (_lbIdx + d + _lbPhotos.length) % _lbPhotos.length;
  document.getElementById('lb-img').src = '/' + _lbPhotos[_lbIdx];
  document.getElementById('lb-count').textContent = `${_lbIdx + 1} / ${_lbPhotos.length}`;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeLightbox(); closeModal(); }
  if (e.key === 'ArrowRight') lbNav(1);
  if (e.key === 'ArrowLeft')  lbNav(-1);
});

// ── 사진 목록 가져오기 ────────────────────────────────────────
async function getPhotosFromDir(dir) {
  try {
    const r = await fetch('/api/photos?dir=' + encodeURIComponent(dir));
    if (!r.ok) throw new Error();
    const list = await r.json();
    return list.map(f => f.path);
  } catch {
    return [];
  }
}

// ================================================================
// 홈 페이지
// ================================================================
async function initHomePage() {
  const data = await getData();
  const s = data.site || {};
  const travel = data.travel || [];
  const diary  = data.diary  || [];

  // 사이트명
  document.querySelectorAll('[data-site-name]').forEach(el => el.textContent = s.name || 'MY.BLOG');

  // 카테고리 카드 통계
  const totalPhotos   = travel.reduce((a,t) => a + (t.stats?.photos||0), 0);
  const totalEntries  = travel.reduce((a,t) => a + (t.entries?.length||0), 0);
  const diaryCount    = diary.length;
  document.getElementById('travel-card-count') &&
    (document.getElementById('travel-card-count').textContent =
      `${travel.length}개 여행 · ${totalPhotos}장의 사진`);
  document.getElementById('diary-card-count') &&
    (document.getElementById('diary-card-count').textContent =
      `${diaryCount > 0 ? diaryCount + '개 일기' : '곧 시작 예정'}`);

  // 최근 기록 — travel 최신순 + diary 최신순 합쳐서 상위 4개
  const recent = document.getElementById('recent-list');
  if (!recent) return initReveal();

  const travelItems = travel.map(t => ({
    type: 'travel', dot: 'travel', tag: '여행',
    href: `travel/${t.id}/index.html`,
    meta: `${t.flag} ${t.country}`,
    title: t.title,
    sub: `${t.description?.slice(0,40)||''}... · ${t.stats?.photos||0}장의 사진`
  }));
  const diaryItems = diary.map(d => ({
    type: 'diary', dot: 'diary', tag: '일기',
    href: `diary/${d.id}/index.html`,
    meta: d.category,
    title: d.title,
    sub: `${d.description?.slice(0,40)||''}...`
  }));

  const items = [...travelItems, ...diaryItems].slice(0, 4);
  const comingSoon = `
    <div class="recent-item dev" style="opacity:0.4;pointer-events:none;">
      <div class="recent-dot"></div>
      <div class="recent-meta">Coming soon</div>
      <div class="recent-text"><div class="recent-title">개발 기록이 곧 추가됩니다</div></div>
      <span class="recent-tag">개발</span>
    </div>`;
  recent.innerHTML = items.map(it => `
    <a class="recent-item ${it.dot}" href="${it.href}">
      <div class="recent-dot"></div>
      <div class="recent-meta">${h(it.meta)}</div>
      <div class="recent-text">
        <div class="recent-title">${h(it.title)}</div>
        <div class="recent-sub">${h(it.sub)}</div>
      </div>
      <span class="recent-tag">${it.tag}</span>
      <span class="recent-arrow">→</span>
    </a>`).join('') + comingSoon;

  initReveal();
}

// ================================================================
// 여행 목록 페이지
// ================================================================
async function initTravelList() {
  const data = await getData();
  const travel = data.travel || [];

  const totalPhotos  = travel.reduce((a,t) => a + (t.stats?.photos||0), 0);
  const totalEntries = travel.reduce((a,t) => a + (t.entries?.length||0), 0);
  const totalCountries = new Set(travel.map(t => t.country?.split('·')[0]?.trim())).size;

  document.getElementById('stat-trips')     && (document.getElementById('stat-trips').textContent     = travel.length);
  document.getElementById('stat-countries') && (document.getElementById('stat-countries').textContent = totalCountries);
  document.getElementById('stat-photos')    && (document.getElementById('stat-photos').textContent    = totalPhotos);
  document.getElementById('stat-entries')   && (document.getElementById('stat-entries').textContent   = totalEntries);

  const grid = document.getElementById('trips-grid');
  if (!grid) return initReveal();

  grid.innerHTML = travel.map(t => `
    <a class="trip-card reveal" href="${t.id}/index.html">
      <img class="trip-thumb" src="/${t.thumbImage}" alt="${h(t.title)}"
           onerror="this.style.display='none'" />
      <div class="trip-body">
        <div class="trip-flag">${t.flag}</div>
        <div class="trip-country">${h(t.country)}</div>
        <h3 class="trip-name">${h(t.title)}</h3>
        <p class="trip-desc">${h(t.description)}</p>
        <div class="trip-meta">
          <span>📍 <strong>${t.stats?.days||'?'}일</strong></span>
          <span>📸 <strong>${t.stats?.photos||0}장</strong></span>
          <span>📖 <strong>${t.entries?.length||0}개 일기</strong></span>
        </div>
      </div>
    </a>`).join('') + `
    <div class="trip-card coming">
      <div class="coming-inner"><div class="coming-icon">🗺</div><p class="coming-text">다음 여행 기록이 추가됩니다</p></div>
    </div>`;

  initReveal();
}

// ================================================================
// 여행 상세 페이지 (france / switzerland 공통)
// ================================================================
async function initTravelPage(tripId) {
  const data = await getData();
  const trip = data.travel.find(t => t.id === tripId);
  if (!trip) { document.body.innerHTML = '<p style="color:white;padding:40px">데이터를 찾을 수 없습니다</p>'; return; }

  setMeta(trip.title, trip.description, trip.thumbImage);
  if (trip.accentColor) setVar('--accent', trip.accentColor);

  // ── 히어로 ──
  const titleParts = (trip.heroTitle || '').split('\n');
  document.querySelector('.hero-photo').style.backgroundImage = `url('/${trip.heroImage}')`;
  document.querySelector('.hero-eyebrow').innerHTML = `${trip.flag} ${h(trip.country)}`;
  document.querySelector('.hero-title').innerHTML =
    `${h(titleParts[0] || '')}<br/><em>${h(titleParts[1] || '')}</em>`;
  document.querySelector('.hero-desc').innerHTML =
    (trip.heroSubtitle || '').replace('\n', '<br/>');
  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) heroStats.innerHTML = `
    <div><div class="stat-num">${trip.stats?.days||'?'}</div><div class="stat-label">Days</div></div>
    <div><div class="stat-num">${trip.stats?.photos||0}</div><div class="stat-label">Photos</div></div>
    <div><div class="stat-num">${trip.entries?.length||0}</div><div class="stat-label">Entries</div></div>`;

  // ── 피처드 그리드 ──
  const featMain  = trip.entries.find(e => e.featuredType === 'main');
  const featSide1 = trip.entries.find(e => e.featuredType === 'side1');
  const featSide2 = trip.entries.find(e => e.featuredType === 'side2');

  const fmEl = document.querySelector('.featured-main');
  if (fmEl && featMain) {
    fmEl.querySelector('.bg').style.background =
      `linear-gradient(to bottom,rgba(10,12,15,.05) 0%,rgba(10,12,15,.88) 100%), url('/${featMain.heroImage}') center/cover`;
    fmEl.querySelector('.content').innerHTML = `
      <span class="entry-tag">${h(featMain.tag)}</span>
      <p class="entry-date">${h(featMain.location)}</p>
      <h3 class="entry-title">${h(featMain.title)}</h3>
      <p class="entry-excerpt">${h((featMain.body||'').slice(0,120))}…</p>
      <div class="entry-meta">${(featMain.meta||[]).map(m=>`<span>${h(m)}</span>`).join('')}</div>`;
    fmEl.onclick = () => openModal(featMain.id);
  }

  const sides = [featSide1, featSide2];
  document.querySelectorAll('.side-card').forEach((el, i) => {
    const entry = sides[i];
    if (!entry) return;
    el.querySelector('.bg').style.background =
      `linear-gradient(to bottom,rgba(10,12,15,.05) 0%,rgba(10,12,15,.88) 100%), url('/${entry.heroImage}') center/cover`;
    el.querySelector('.content').innerHTML = `
      <span class="entry-tag">${h(entry.tag)}</span>
      <p class="entry-date">${h(entry.location)}</p>
      <h3 class="entry-title">${h(entry.title)}</h3>
      <p class="entry-excerpt">${h((entry.body||'').slice(0,80))}…</p>`;
    el.onclick = () => openModal(entry.id);
  });

  // ── 일기 카드 그리드 ──
  const grid = document.getElementById('entries-grid');
  if (grid) {
    grid.innerHTML = trip.entries.map(e => `
      <div class="entry-card reveal" onclick="openModal('${e.id}')">
        <img class="card-thumb" src="/${e.cardImage||e.heroImage}" onerror="this.style.background='var(--surface2)'" />
        <div class="card-body">
          <span class="entry-tag">${h(e.tag)}</span>
          <p class="entry-date">${h(e.location)}</p>
          <h3 class="entry-title">${h(e.title)}</h3>
          <p class="entry-excerpt">${h((e.body||'').split('\n\n')[0]?.slice(0,100)||'')}…</p>
          <div class="mood">${h(e.mood||'')}</div>
        </div>
      </div>`).join('');
  }

  // ── 갤러리 ──
  const galleryGrid = document.getElementById('gallery-grid');
  if (galleryGrid) {
    let photos = await getPhotosFromDir(trip.imageDir);
    if (!photos.length) photos = trip.entries.flatMap(e => e.photos || []).slice(0, 20);
    const shown = photos.slice(0, 9);
    galleryGrid.innerHTML = shown.map((p, i) => `
      <div class="gallery-item" onclick="openLightbox(${JSON.stringify(photos)},${i})">
        <img src="/${p}" alt="" /><div class="ov"></div>
      </div>`).join('');
    const moreBtn = document.getElementById('gallery-more-btn');
    if (moreBtn) moreBtn.textContent = `전체 사진 보기 (${photos.length}장) →`;
    if (moreBtn) moreBtn.onclick = () => openLightbox(photos, 0);
  }

  // ── 인용구 ──
  document.getElementById('quote-text')   && (document.getElementById('quote-text').textContent   = trip.quote || '');
  document.getElementById('quote-source') && (document.getElementById('quote-source').textContent = trip.quoteSource || '');

  // ── 푸터 ──
  document.getElementById('footer-name') && (document.getElementById('footer-name').textContent = `${trip.flag} ${trip.country.split('·')[0].trim()}`);

  // ── 모달 데이터 등록 ──
  trip.entries.forEach(e => { _modalEntries[e.id] = e; });

  initReveal();
}

// ================================================================
// 일기 목록 페이지
// ================================================================
async function initDiaryList() {
  const data  = await getData();
  const diary = data.diary || [];
  const grid  = document.getElementById('diary-grid');
  if (!grid) return initReveal();

  grid.innerHTML = diary.map(d => `
    <a class="diary-card reveal" href="${d.id}/index.html">
      <img class="diary-thumb" src="/${d.thumbImage}" alt="${h(d.title)}" onerror="this.style.background='var(--surface2)'" />
      <div class="diary-body">
        <div class="diary-cat">${h(d.category)}</div>
        <h3 class="diary-name">${h(d.title)}</h3>
        <p class="diary-desc">${h(d.description)}</p>
        <div class="diary-meta">
          <span>📸 ${d.stats?.photos||0}장 · ${d.stats?.outfits||d.stats?.locations||0}개 세트</span>
          <span class="diary-arrow">→</span>
        </div>
      </div>
    </a>`).join('') + `
    <div class="diary-card coming">
      <div class="coming-inner"><div class="coming-icon">📝</div><p class="coming-text">새 일기가 추가됩니다</p></div>
    </div>`;

  initReveal();
}

// ================================================================
// 일기 상세 페이지 (wedding 등)
// ================================================================
async function initDiaryPage(diaryId) {
  const data  = await getData();
  const diary = data.diary.find(d => d.id === diaryId);
  if (!diary) return;

  setMeta(diary.title, diary.description, diary.thumbImage);
  if (diary.accentColor) setVar('--accent', diary.accentColor);

  // ── 히어로 ──
  const titleParts = (diary.heroTitle || '').split('\n');
  document.querySelector('.hero-photo').style.backgroundImage = `url('/${diary.heroImage}')`;
  document.querySelector('.hero-title').innerHTML =
    `${h(titleParts[0] || '')}<br/><em>${h(titleParts[1] || '')}</em>`;
  document.querySelector('.hero-desc').innerHTML =
    (diary.heroSubtitle || '').replace('\n', '<br/>');

  // ── 인트로 ──
  if (diary.intro) {
    document.getElementById('intro-title') && (document.getElementById('intro-title').textContent = diary.intro.title);
    document.getElementById('intro-body')  && (document.getElementById('intro-body').innerHTML  = paras(diary.intro.body));
  }
  const istats = document.querySelector('.intro-stats');
  if (istats) istats.innerHTML = `
    <div class="istat"><div class="istat-num">${diary.stats?.photos||0}</div><div class="istat-label">Photos</div></div>
    <div class="istat"><div class="istat-num">${diary.stats?.outfits||diary.stats?.locations||0}</div><div class="istat-label">Outfits</div></div>
    <div class="istat"><div class="istat-num">${diary.stats?.locations||diary.photoSets?.length||0}</div><div class="istat-label">Sets</div></div>`;

  // ── 사진 세트 ──
  const setsEl = document.getElementById('photo-sets');
  if (setsEl && diary.photoSets) {
    setsEl.innerHTML = diary.photoSets.map(ps => {
      const gridClass =
        ps.layout === 'grid-3'    ? 'set-grid-3' :
        ps.layout === 'grid-asym' ? 'set-grid-asym' : 'set-grid-2';
      const photosHtml =
        ps.layout === 'grid-asym' && ps.photos.length >= 3
          ? `<div class="set-img-wrap"><img class="set-img" src="/${ps.photos[0]}" onclick="openLightbox(${JSON.stringify(diary.allPhotos||ps.photos)},0)" /></div>
             <div class="right-col">
               ${ps.photos.slice(1).map((p,i)=>`<div class="set-img-wrap"><img class="set-img" src="/${p}" onclick="openLightbox(${JSON.stringify(diary.allPhotos||ps.photos)},${i+1})" /></div>`).join('')}
             </div>`
          : ps.photos.map((p,i) =>
              `<div class="set-img-wrap"><img class="set-img" src="/${p}" onclick="openLightbox(${JSON.stringify(diary.allPhotos||ps.photos)},${i})" /></div>`
            ).join('');
      return `
        <div class="photo-set reveal">
          <div class="set-header">
            <div>
              <span class="set-label">${h(ps.label)}</span>
              <h3 class="set-name">${h(ps.name)}</h3>
              <p class="set-desc">${h(ps.description)}</p>
            </div>
          </div>
          <div class="${gridClass}">${photosHtml}</div>
        </div>`;
    }).join('');
  }

  // ── 전체 사진 갤러리 ──
  const allEl = document.getElementById('all-photos-grid');
  if (allEl && diary.allPhotos) {
    allEl.innerHTML = diary.allPhotos.map((p,i) =>
      `<div class="ap-item"><img src="/${p}" onclick="openLightbox(${JSON.stringify(diary.allPhotos)},${i})" /></div>`
    ).join('');
  }

  // ── 인용구 ──
  document.getElementById('quote-text')   && (document.getElementById('quote-text').textContent   = diary.quote || '');
  document.getElementById('quote-source') && (document.getElementById('quote-source').textContent = diary.quoteSource || '');

  initReveal();
}

// ================================================================
// 개발 기록 목록 페이지
// ================================================================
async function initDevList() {
  const data = await getData();
  const dev  = data.dev || [];

  document.getElementById('dev-total') && (document.getElementById('dev-total').textContent = dev.length);

  const grid = document.getElementById('dev-grid');
  if (!grid) return initReveal();

  if (dev.length === 0) {
    grid.innerHTML = `<div class="dev-empty"><p>아직 개발 기록이 없습니다.</p><p style="font-size:.85rem;color:var(--muted);margin-top:8px">에디터에서 첫 기록을 추가해보세요.</p></div>`;
    return initReveal();
  }

  grid.innerHTML = dev.map(d => `
    <a class="dev-card reveal" href="${d.id}/index.html">
      <div class="dev-card-top">
        <span class="dev-cat-badge">${h(d.category)}</span>
        <span class="dev-date">${h(d.date)}</span>
      </div>
      <h3 class="dev-card-title">${h(d.title)}</h3>
      <p class="dev-card-desc">${h(d.description)}</p>
      <div class="dev-tags">${(d.tags||[]).map(t=>`<span class="dev-tag">${h(t)}</span>`).join('')}</div>
      <div class="dev-card-footer">
        <span>${(d.codeBlocks||[]).length}개 코드 블록</span>
        <span class="dev-arrow">→</span>
      </div>
    </a>`).join('');

  initReveal();
}

// ================================================================
// 개발 기록 상세 페이지
// ================================================================
async function initDevPage(devId) {
  const data  = await getData();
  const entry = (data.dev || []).find(d => d.id === devId);
  if (!entry) {
    document.body.innerHTML = '<p style="color:white;padding:80px 40px">기록을 찾을 수 없습니다.</p>';
    return;
  }

  // ── 헤더 정보 ──
  document.querySelector('.dev-page-category') && (document.querySelector('.dev-page-category').textContent = entry.category);
  document.querySelector('.dev-page-date')     && (document.querySelector('.dev-page-date').textContent     = entry.date);
  document.querySelector('.dev-page-title')    && (document.querySelector('.dev-page-title').textContent    = entry.title);
  document.querySelector('.dev-page-desc')     && (document.querySelector('.dev-page-desc').textContent     = entry.description);

  const tagsEl = document.getElementById('dev-page-tags');
  if (tagsEl) tagsEl.innerHTML = (entry.tags||[]).map(t=>`<span class="dev-tag">${h(t)}</span>`).join('');

  // ── 본문 ──
  const bodyEl = document.getElementById('dev-page-body');
  if (bodyEl) bodyEl.innerHTML = paras(entry.body);

  // ── 코드 블록 ──
  const blocksEl = document.getElementById('code-blocks');
  if (!blocksEl) return initReveal();

  blocksEl.innerHTML = '';
  (entry.codeBlocks || []).forEach((block, i) => {
    // html/css/js 분리 여부 감지
    const hasTabs = block.css !== undefined || block.js !== undefined;
    const combined = hasTabs
      ? `<style>${block.css||''}</style>${block.html||''}<script>${block.js||''}<\/script>`
      : (block.html || '');

    const tabsHtml = hasTabs ? `
      <div class="code-tabs">
        <div class="code-tab-bar">
          <button class="code-tab-btn active" onclick="switchCodeTab(this,'html',${i})">HTML</button>
          <button class="code-tab-btn" onclick="switchCodeTab(this,'css',${i})">CSS</button>
          <button class="code-tab-btn" onclick="switchCodeTab(this,'js',${i})">JS</button>
          <div style="flex:1"></div>
          <button class="code-btn" onclick="copyTabCode(${i})">📋 복사</button>
          <button class="code-btn" id="toggle-btn-${i}" onclick="toggleCode(${i})">🙈 숨기기</button>
        </div>
        <div id="code-pane-html-${i}">
          <pre class="code-pre" id="code-src-html-${i}"><code>${h(block.html||'')}</code></pre>
        </div>
        <div id="code-pane-css-${i}" style="display:none">
          <pre class="code-pre" id="code-src-css-${i}"><code>${h(block.css||'')}</code></pre>
        </div>
        <div id="code-pane-js-${i}" style="display:none">
          <pre class="code-pre" id="code-src-js-${i}"><code>${h(block.js||'')}</code></pre>
        </div>
      </div>` : `
      <div class="code-wrap" id="code-wrap-${i}">
        <div class="code-bar">
          <span class="code-lang-badge">HTML</span>
          <div style="display:flex;gap:8px">
            <button class="code-btn" onclick="copyBlockCode(${i})">📋 복사</button>
            <button class="code-btn" id="toggle-btn-${i}" onclick="toggleCode(${i})">🙈 숨기기</button>
          </div>
        </div>
        <pre class="code-pre" id="code-src-${i}"><code>${h(block.html||'')}</code></pre>
      </div>`;

    const wrap = document.createElement('div');
    wrap.className = 'code-block reveal';
    wrap.innerHTML = `
      <div class="code-block-hd">
        <h3 class="block-title">${h(block.title)}</h3>
        ${block.description ? `<p class="block-desc">${h(block.description)}</p>` : ''}
      </div>
      <div class="preview-wrap">
        <div class="preview-bar"><span>▶ 실행 결과</span></div>
        <iframe id="preview-${i}" frameborder="0" sandbox="allow-scripts allow-same-origin"
          style="width:100%;border:none;display:block;min-height:80px;transition:height .3s"></iframe>
      </div>
      ${tabsHtml}`;
    blocksEl.appendChild(wrap);

    requestAnimationFrame(() => {
      const iframe = document.getElementById(`preview-${i}`);
      if (!iframe) return;
      iframe.srcdoc = combined;
      iframe.onload = () => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          const ht = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
          iframe.style.height = Math.min(ht + 32, 700) + 'px';
        } catch {}
      };
    });
  });

  setMeta(entry.title, entry.description);
  initReveal();
}

function switchCodeTab(btn, lang, idx) {
  const block = btn.closest('.code-tabs');
  block.querySelectorAll('.code-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['html','css','js'].forEach(l => {
    const pane = document.getElementById(`code-pane-${l}-${idx}`);
    if (pane) pane.style.display = l === lang ? 'block' : 'none';
  });
}

async function copyTabCode(idx) {
  const active = document.querySelector(`#code-pane-html-${idx}:not([style*="none"]), #code-pane-css-${idx}:not([style*="none"]), #code-pane-js-${idx}:not([style*="none"])`);
  if (!active) return;
  try {
    await navigator.clipboard.writeText(active.textContent);
    showCodeCopyToast();
  } catch {}
}

function showCodeCopyToast() {
  const t = document.createElement('div');
  t.textContent = '✅ 복사됨';
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#4ade80;color:#000;padding:8px 16px;border-radius:8px;font-weight:700;font-size:.85rem;z-index:9999';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// 코드 복사
async function copyBlockCode(idx) {
  const el = document.getElementById(`code-src-${idx}`);
  if (!el) return;
  try {
    await navigator.clipboard.writeText(el.textContent);
    const btn = document.querySelector(`#code-wrap-${idx} .code-btn`);
    const orig = btn.textContent;
    btn.textContent = '✅ 복사됨';
    setTimeout(() => btn.textContent = orig, 1500);
  } catch {}
}

// 소스코드 보기/숨기기
function toggleCode(idx) {
  const wrap = document.getElementById(`code-wrap-${idx}`);
  const pre  = document.getElementById(`code-src-${idx}`);
  const btn  = document.getElementById(`toggle-btn-${idx}`);
  if (!pre && !wrap) return;
  const el = pre || wrap;
  const hidden = el.style.display === 'none';
  el.style.display = hidden ? 'block' : 'none';
  if (btn) btn.textContent = hidden ? '🙈 숨기기' : '👁 보기';
}

// ================================================================
// 타임라인 페이지
// ================================================================
async function initTimeline() {
  const data = await getData();
  const events = [];
  const MONTHS = ['','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  (data.travel||[]).forEach(t => {
    if (!t.date) return;
    events.push({ date: t.date, type: 'travel', title: t.title,
      sub: t.country, icon: t.flag||'✈️', href: `travel/${t.id}/index.html` });
  });
  (data.diary||[]).forEach(d => {
    if (!d.date) return;
    events.push({ date: d.date, type: 'diary', title: d.title,
      sub: d.category, icon: '📝', href: `diary/${d.id}/index.html` });
  });
  (data.dev||[]).forEach(d => {
    if (!d.date) return;
    events.push({ date: d.date, type: 'dev', title: d.title,
      sub: d.category, icon: '💻', href: `dev/${d.id}/index.html` });
  });

  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 연-월 그룹핑
  const groups = {};
  events.forEach(e => {
    const [y, m] = e.date.split('-');
    const key = `${y}-${m}`;
    if (!groups[key]) groups[key] = { year: y, month: parseInt(m), items: [] };
    groups[key].items.push(e);
  });

  const container = document.getElementById('timeline-container');
  if (!container) return initReveal();

  const labelEl = document.getElementById('tl-total');
  if (labelEl) labelEl.textContent = events.length;

  container.innerHTML = Object.values(groups)
    .sort((a, b) => new Date(`${b.year}-${b.month}`) - new Date(`${a.year}-${a.month}`))
    .map(g => `
      <div class="tl-group reveal">
        <div class="tl-month-label">
          <span class="tl-year">${g.year}</span>
          <span class="tl-mon">${MONTHS[g.month]}</span>
        </div>
        <div class="tl-items">
          ${g.items.map(e => `
            <a class="tl-item tl-${e.type}" href="${e.href}">
              <div class="tl-icon">${e.icon}</div>
              <div class="tl-content">
                <div class="tl-title">${h(e.title)}</div>
                <div class="tl-sub">${h(e.sub)}</div>
              </div>
              <span class="tl-date">${e.date}</span>
            </a>`).join('')}
        </div>
      </div>`).join('');

  initReveal();
}

// ================================================================
// 여행 목록 — Leaflet 지도
// ================================================================
async function initTravelMap(travel) {
  await loadLeaflet();
  const mapEl = document.getElementById('travel-map');
  if (!mapEl || !window.L) return;

  const validTrips = travel.filter(t => t.coordinates?.lat);
  if (!validTrips.length) { mapEl.style.display = 'none'; return; }

  const center = validTrips[0].coordinates;
  const map = L.map(mapEl, { zoomControl: true, scrollWheelZoom: false })
    .setView([center.lat, center.lng], 4);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '©OpenStreetMap ©CartoDB', maxZoom: 18
  }).addTo(map);

  validTrips.forEach(t => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="background:#6cb8f5;color:#050810;font-size:18px;width:36px;height:36px;
               border-radius:50%;display:flex;align-items:center;justify-content:center;
               box-shadow:0 0 0 3px rgba(108,184,245,.3);cursor:pointer">${t.flag}</div>`,
      iconSize: [36, 36], iconAnchor: [18, 18]
    });
    L.marker([t.coordinates.lat, t.coordinates.lng], { icon })
      .addTo(map)
      .bindPopup(`<b>${t.flag} ${t.title}</b><br><small>${t.country}</small>`)
      .on('click', () => { window.location.href = `${t.id}/index.html`; });
  });

  if (validTrips.length > 1) {
    const bounds = L.latLngBounds(validTrips.map(t => [t.coordinates.lat, t.coordinates.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}
