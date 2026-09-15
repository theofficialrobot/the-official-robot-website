const LAB_CART_KEY = 'or_lab_cart_v1';
function loadLabCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(LAB_CART_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e) { return []; }
}
function saveLabCart() {
  try { localStorage.setItem(LAB_CART_KEY, JSON.stringify(state.cart || [])); } catch (e) {}
}

// ========== STATE ==========
const state = {
  typeId: 'humanoid',
  query: '',
  modelId: null,
  variantId: null,
  colorId: null,
  warrantyId: '3yr', // default: additional 3-year extended
  addons: new Set(),
  cart: loadLabCart()
};

function formatMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** Resolve addon price. Supports fixed price or relative pricePct of the current configuration base. */
function getAddonPrice(addon, configBasePrice) {
  if (!addon) return 0;
  if (addon.pricePct != null && configBasePrice != null) {
    return Math.round(configBasePrice * addon.pricePct);
  }
  return addon.price || 0;
}

/** Current selected configuration base price (variant or robot basePrice). */
function getCurrentConfigBasePrice() {
  if (!state.modelId || !ROBOTS[state.modelId]) return 0;
  const robot = ROBOTS[state.modelId];
  const variant = (robot.variants || []).find(v => v.id === state.variantId) || (robot.variants || [])[0];
  return variant ? variant.price : (robot.basePrice || 0);
}

/**
 * Manufacturer-included warranty (researched Aug 2026 from OEM tables, legal pages,
 * and authorized-reseller policies). Returns { months, label, note }.
 */
function getManufacturerWarrantyInfo(robot) {
  if (!robot) return { months: 12, label: '12 months manufacturer standard', note: 'Confirm exact terms on formal quote.' };
  const id = robot.id || '';
  const maker = (robot.maker || '').toLowerCase();
  const type = robot.type || '';

  // Documented OEM terms
  if (id === 'go2') return { months: 12, label: '6 months (Air) / 12 months (Pro · X · EDU)', note: 'Unitree official Go2 spec table. Accessories typically 6 months. Starts on receipt.' };
  if (id === 'g1') return { months: 12, label: '8 months (Base) / 18 months (EDU)', note: 'Unitree official G1 spec table. EDU carries longer coverage.' };
  if (id === 'r1') return { months: 12, label: '6 months (Air) / 8 months (Standard) / 12 months (EDU)', note: 'Unitree R1 warranty by configuration tier.' };
  if (id === 'h2') return { months: 12, label: '8 months (Base) / 12 months (EDU / Plus)', note: 'Unitree H2 official parameters. Base 8 months; EDU/Plus 12 months.' };
  if (id === 'h1') return { months: 12, label: '8 months (Base) / 12 months (EDU class)', note: 'Unitree / authorized-dealer tables. Confirm regional terms.' };
  if (id === 'a2' || id === 'unitree_aliengo_a1_a2') return { months: 12, label: '12 months manufacturer standard (Unitree industrial class)', note: 'Authorized Unitree reseller policy typically 12 months on robots; accessories 6 months.' };
  if (id === 'spot') return { months: 12, label: '12 months limited warranty (defects in materials/workmanship)', note: 'Boston Dynamics Terms of Sale. Normal dynamic falls are not defects. Spot CARE is a separate premium plan.' };
  if (id === 'atlas') return { months: 12, label: '12 months / program- and contract-dependent', note: 'Atlas deployments are program-based; warranty is contractual.' };
  if (maker.includes('skydio') || id.startsWith('skydio')) return { months: 12, label: '12 months limited warranty from delivery', note: 'Skydio Limited Warranty. Batteries: earlier of 1 year or 200 cycles. Propellers: no warranty. Skydio Care optional.' };
  if (maker.includes('dji') || id.startsWith('dji')) return { months: 12, label: '12 months on main aircraft / gimbal / propulsion (excl. propellers)', note: 'DJI After-Sales Service Policy. Batteries often 12 months and <200 cycles. Propellers typically no warranty. DJI Care optional.' };
  if (maker.includes('chasing') || id.startsWith('chasing')) return { months: 12, label: '12 months on main ROV / camera / electronics (batteries/thrusters often 6 months)', note: 'Chasing Innovation Warranty Policy. Propellers/tether often excluded. Starts at end-user sale.' };
  if (maker.includes('parrot')) return { months: 12, label: '12 months (reseller-defined; typically 1 year)', note: 'Parrot states period is set by reseller; US retail commonly 1 year parts/labor.' };
  if (maker.includes('figure') || id.startsWith('figure')) return { months: 12, label: '12 months hardware defects (battery/actuators often 6 months)', note: 'Figure USA legal summary. Excludes accidental damage and misuse.' };
  // Estimated category defaults when OEM sheet is not public
  if (maker.includes('agility') || id.includes('digit')) return { months: 12, label: '12 months / enterprise contract & RaaS dependent', note: 'Digit is enterprise/RaaS oriented; support often bundled in service agreement.' };
  if (maker.includes('deep robotics')) return { months: 12, label: '12 months manufacturer standard (typical industrial)', note: 'Confirm exact term with authorized channel on quote.' };
  if (maker.includes('agibot') || maker.includes('zhiyuan')) return { months: 12, label: '12 months manufacturer standard (typical by tier)', note: 'Confirm tier-specific term on formal quote.' };
  if (maker.includes('unitree')) return { months: 12, label: '12 months manufacturer standard (typical Unitree)', note: 'Unitree robots commonly 6–18 months by tier. Confirm configuration on quote.' };
  if (type === 'aerial') return { months: 12, label: '12 months limited / contract-dependent (typical UAV)', note: 'Consumer and enterprise UAV norm; batteries/propellers often shorter or excluded. Confirm on quote.' };
  if (type === 'water') return { months: 12, label: '12 months limited / contract-dependent (typical marine)', note: 'Enterprise marine programs often define coverage in the sales contract. Confirm on quote.' };
  if (type === 'humanoid' || type === 'campanionoid') return { months: 12, label: '12 months manufacturer standard (typical)', note: 'Research and industrial packages often 12 months; some EDU tiers longer. Confirm on formal quote.' };

  return { months: 12, label: '12 months manufacturer standard (typical)', note: 'Industry default when OEM sheet is not public. Always confirm on formal quote.' };
}

function getWarrantyPrice(warrantyId, configBasePrice) {
  const plan = WARRANTY_PLANS[warrantyId] || WARRANTY_PLANS.mfr;
  if (!plan.pricePct) return 0;
  return Math.round((configBasePrice || 0) * plan.pricePct);
}

function getWarrantyLabel(warrantyId, robot) {
  if (warrantyId === 'mfr') {
    const info = getManufacturerWarrantyInfo(robot);
    return `Manufacturer: ${info.label}`;
  }
  const plan = WARRANTY_PLANS[warrantyId];
  return plan ? plan.name : 'Warranty';
}


/** Preferred key-spec order for cards + configurator mini-specs (matched case-insensitively). */
const KEY_SPEC_ORDER = [
  'Height', 'Standing Envelope', 'Standing Size', 'Standing Height', 'Size',
  'Weight', 'Operating Weight',
  'Degrees of Freedom', 'DOF',
  'Max Speed', 'Speed',
  'Payload', 'Payload Capacity',
  'Battery / Runtime', 'Battery', 'Runtime'
];

/** Amazon-style at-a-glance sheet — every platform of a type shows the same tiles. */
const MINI_SPEC_KEYS = {
  humanoid: ['Height', 'Weight', 'Degrees of Freedom', 'Payload', 'Max Speed', 'Battery / Runtime'],
  hand: ['Degrees of Freedom', 'Fingers', 'Weight', 'Payload', 'Motor Tech', 'Tactile / Force Sensors'],
  campanionoid: ['Weight', 'Degrees of Freedom', 'Payload', 'Max Speed', 'Battery / Runtime', 'Camera / Vision'],
  aerial: ['Weight', 'Flight Time', 'Payload', 'Max Speed', 'Camera / Vision', 'Battery / Runtime'],
  water: ['Weight', 'Payload', 'Depth Rating', 'Camera / Vision', 'Battery / Runtime', 'Control Interface']
};

const HUMANOID_SPEC_GROUPS = [
  { name: 'General', keys: ['Type','Manufacturer','Model','Model Year','Origin','Status','Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Height','Weight','Standing Envelope'] },
  { name: 'Performance', keys: ['Degrees of Freedom','Max Speed','Walking Speed','Payload','Rise After Fall'] },
  { name: 'Power', keys: ['Battery / Runtime','Charging'] },
  { name: 'Manipulation', keys: ['Hands / End-effectors','Hand DOF','Number of Fingers','Manipulation Score'] },
  { name: 'Sensing', keys: ['Camera / Vision','Camera Resolution','Video','Audio','LiDAR','Sensors','Tactile / Force Sensors'] },
  { name: 'Compute & software', keys: ['Compute','CPU / GPU','Operating System','LLM Integration','Connectivity','Control Interface','Navigation','Navigation Score'] },
  { name: 'Mechanical', keys: ['Motor Tech','Gear Tech','Main Structural Material','IP Rating','Safe with Humans'] },
  { name: 'Commercial', keys: ['List Price','Warranty (std)','Best Fit'] }
];

const CAMPANIONOID_SPEC_GROUPS = [
  { name: 'General', keys: ['Type','Manufacturer','Model','Model Year','Origin','Status','Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Standing Size','Height','Weight'] },
  { name: 'Performance', keys: ['Degrees of Freedom','Max Speed','Payload'] },
  { name: 'Power', keys: ['Battery / Runtime','Charging'] },
  { name: 'Sensing', keys: ['Camera / Vision','Video','LiDAR','Sensors','Obstacle Sensing'] },
  { name: 'Compute & software', keys: ['Compute','Connectivity','Control Interface','Navigation'] },
  { name: 'Mechanical', keys: ['Motor Tech','IP Rating','Operating Environment'] },
  { name: 'Commercial', keys: ['List Price','Warranty (std)','Best Fit'] }
];

const AERIAL_SPEC_GROUPS = [
  { name: 'General', keys: ['Type','Manufacturer','Model','Model Year','Origin','Status','Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Weight','Size / Envelope'] },
  { name: 'Performance', keys: ['Max Speed','Flight Time','Range / Link','Payload'] },
  { name: 'Power', keys: ['Battery / Runtime','Charging'] },
  { name: 'Sensing', keys: ['Camera / Vision','Video','Gimbal','Obstacle Sensing'] },
  { name: 'Compute & software', keys: ['Compute','Connectivity','Control Interface'] },
  { name: 'Mechanical', keys: ['IP Rating','Operating Environment'] },
  { name: 'Commercial', keys: ['List Price','Warranty (std)','Best Fit'] }
];

const WATER_SPEC_GROUPS = [
  { name: 'General', keys: ['Type','Manufacturer','Model','Model Year','Origin','Status','Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Weight','Size / Envelope'] },
  { name: 'Performance', keys: ['Depth Rating','Payload','Max Speed'] },
  { name: 'Power', keys: ['Battery / Runtime','Charging'] },
  { name: 'Sensing', keys: ['Camera / Vision','Video','Lights','Sensors'] },
  { name: 'Propulsion', keys: ['Thrusters','Tether','Range / Link'] },
  { name: 'Compute & software', keys: ['Control Interface','Connectivity','Navigation'] },
  { name: 'Mechanical', keys: ['IP Rating','Operating Environment'] },
  { name: 'Commercial', keys: ['List Price','Warranty (std)','Best Fit'] }
];

const HAND_SPEC_GROUPS = [
  { name: 'General', keys: ['Type','Manufacturer','Model','Model Year','Origin','Status','Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Weight','Size','Envelope'] },
  { name: 'Performance', keys: ['Degrees of Freedom','Fingers','Payload','Strength'] },
  { name: 'Sensing', keys: ['Tactile / Force Sensors'] },
  { name: 'Mechanical', keys: ['Motor Tech','Structure'] },
  { name: 'Commercial', keys: ['List Price','Warranty (std)','Best Fit'] }
];

const TYPE_SPEC_GROUPS = {
  humanoid: HUMANOID_SPEC_GROUPS,
  campanionoid: CAMPANIONOID_SPEC_GROUPS,
  aerial: AERIAL_SPEC_GROUPS,
  water: WATER_SPEC_GROUPS,
  hand: HAND_SPEC_GROUPS
};

/** Spec keys treated as “dimension / physical” — used to de-dupe highlight bullets. */
const SPEC_DEDUP_PATTERNS = [
  /height|standing|size|envelope|dimension/i,
  /weight|mass/i,
  /degrees of freedom|\bdof\b/i,
  /max speed|speed|mph|m\/s/i,
  /payload|carrying/i,
  /battery|runtime|endurance/i
];

function isUndisclosed(v) {
  if (v == null) return true;
  const s = String(v).trim();
  return !s || /^(not disclosed|—|-|n\/a|na|unknown)$/i.test(s);
}

function pickMiniSpecs(robot) {
  if (!robot || !robot.specs) return [];
  const keys = MINI_SPEC_KEYS[robot.type] || KEY_SPEC_ORDER.slice(0, 6);
  const specs = robot.specs;
  const entries = Object.entries(specs);
  return keys.map((key) => {
    const exact = specs[key];
    if (exact != null && String(exact).trim() !== '') return [key, exact];
    const found = entries.find(([k]) => k.toLowerCase() === key.toLowerCase() || k.toLowerCase().includes(key.toLowerCase()));
    return [key, found ? found[1] : 'Not disclosed'];
  });
}

function pickKeySpecs(robot, limit = 6) {
  const locked = pickMiniSpecs(robot);
  if (locked.length) return locked.slice(0, Math.max(limit, locked.length));
  if (!robot || !robot.specs) return [];
  const entries = Object.entries(robot.specs);
  const used = new Set();
  const out = [];
  for (const prefer of KEY_SPEC_ORDER) {
    if (out.length >= limit) break;
    const found = entries.find(([k]) => k.toLowerCase() === prefer.toLowerCase() || k.toLowerCase().includes(prefer.toLowerCase()));
    if (found && !used.has(found[0])) {
      used.add(found[0]);
      out.push(found);
    }
  }
  // Fill remaining slots from other specs if needed
  for (const [k, v] of entries) {
    if (out.length >= limit) break;
    if (used.has(k)) continue;
    if (/warranty|best fit|type|audio|connectivity|control|navigation|charging|ip rating|compute|sensors|camera|video|lidar/i.test(k)) continue;
    used.add(k);
    out.push([k, v]);
  }
  return out;
}

function highlightIsCoveredBySpecs(text) {
  if (!text) return false;
  return SPEC_DEDUP_PATTERNS.some(re => re.test(text));
}

/** Capability / feature bullets that are not already covered by key physical specs. */
function pickFeatureHighlights(robot, limit = 6) {
  const list = (robot && robot.highlights) ? robot.highlights : [];
  return list.filter(h => !highlightIsCoveredBySpecs(h)).slice(0, limit);
}

function renderTypeSelect() {
  const el = document.getElementById('typeSelect');
  if (!el) return;
  const types = Object.keys(TYPE_META).sort((a, b) => (TYPE_META[a].order ?? 9) - (TYPE_META[b].order ?? 9));
  el.innerHTML = types.map(t => {
    const meta = TYPE_META[t];
    const count = Object.values(ROBOTS).filter(r => r.type === t).length;
    const selected = state.typeId === t;
    return `
      <button type="button" class="sub-nav-item${selected ? ' selected' : ''}" role="tab" aria-selected="${selected ? 'true' : 'false'}" onclick="selectType('${t}')">
        <span class="icon">${meta.icon}</span>
        <span class="name">${meta.navLabel || meta.label}</span>
        <span class="count">${count}</span>
      </button>`;
  }).join('');
}

const MODEL_PHOTO_EAGER_COUNT = 16;

function hydrateModelPhoto(img) {
  if (!img) return;
  const next = img.getAttribute('data-src');
  if (!next || img.getAttribute('src')) return;
  img.src = next;
  img.removeAttribute('data-src');
}

let modelPhotoObserver = null;

function observeModelPhotos(grid) {
  if (modelPhotoObserver) {
    modelPhotoObserver.disconnect();
    modelPhotoObserver = null;
  }
  if (!grid) return;
  const pending = grid.querySelectorAll('.model-photo[data-src]');
  if (!pending.length) return;
  if (typeof IntersectionObserver === 'undefined') {
    pending.forEach(hydrateModelPhoto);
    return;
  }
  modelPhotoObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const img = entry.target.classList.contains('model-photo')
        ? entry.target
        : entry.target.querySelector('.model-photo[data-src]');
      if (img) hydrateModelPhoto(img);
      modelPhotoObserver.unobserve(entry.target);
    });
  }, { rootMargin: '280px 0px', threshold: 0 });
  pending.forEach((img) => {
    modelPhotoObserver.observe(img.closest('.model-option') || img);
  });
}

function renderModelSelect() {
  const el = document.getElementById('modelSelect');
  if (!el) return;
  if (!state.typeId) {
    el.innerHTML = '<p class="empty-select">Select a category in the bar above to view available platforms.</p>';
    return;
  }
  const q = (state.query || '').trim().toLowerCase();
  const list = Object.values(ROBOTS)
    .filter(r => r.type === state.typeId)
    .filter(r => {
      if (!q) return true;
      const blob = [r.name, r.maker, r.shortDesc, r.uniqueSummary, r.id].join(' ').toLowerCase();
      return blob.indexOf(q) !== -1;
    })
    .sort((a, b) => (b.basePrice || 0) - (a.basePrice || 0));
  if (list.length === 0) {
    el.innerHTML = q
      ? '<p style="color:var(--text-dim);font-size:0.9rem;">No platforms in this type match that search.</p>'
      : '<p style="color:var(--text-dim);font-size:0.9rem;">No platforms currently listed in this category.</p>';
    return;
  }
  el.innerHTML = list.map((r, i) => {
    const raw = r.image ? String(r.image).replace(/"/g, '') : '';
    const img = raw ? encodeURI(raw) : '';
    const photoClass = img ? ' has-photo' : '';
    let photo;
    if (!img) {
      photo = `<div class="icon">${r.icon || '🤖'}</div>`;
    } else if (i < MODEL_PHOTO_EAGER_COUNT) {
      photo = `<img class="model-photo" src="${img}" alt="" decoding="async" loading="eager">`;
    } else {
      photo = `<img class="model-photo" data-src="${img}" alt="" decoding="async" loading="lazy">`;
    }
    return `
    <div class="model-option${photoClass} ${state.modelId === r.id ? 'selected' : ''}" onclick="selectModel('${r.id}')">
      ${photo}
      <div class="name">${r.name}</div>
      <div class="base-price">From ${formatMoney(r.basePrice)}</div>
    </div>`;
  }).join('');
  paintModelCheckers(el);
  observeModelPhotos(el);
}

function paintModelCheckers(grid) {
  const el = grid || document.getElementById('modelSelect');
  if (!el) return;
  const tiles = el.querySelectorAll('.model-option');
  if (!tiles.length) return;
  const styles = getComputedStyle(el);
  const gap = parseFloat(styles.columnGap || styles.gap) || 10;
  const tileW = tiles[0].getBoundingClientRect().width;
  const cols = Math.max(1, Math.round((el.clientWidth + gap) / (tileW + gap)));
  tiles.forEach((tile, i) => {
    const brand = ((Math.floor(i / cols) + (i % cols)) % 2) === 1;
    tile.classList.toggle('check-brand', brand);
    tile.classList.toggle('check-white', !brand);
  });
}

function collapsePlatformPanel() {
  const panel = document.getElementById('platformSelectPanel');
  const bar = document.getElementById('platformCollapsedBar');
  const nameEl = document.getElementById('platformCollapsedName');
  if (!panel || !bar) return;
  if (!state.modelId || !ROBOTS[state.modelId]) {
    expandPlatformPanel();
    return;
  }
  panel.classList.add('is-collapsed');
  bar.hidden = false;
  if (nameEl) nameEl.textContent = ROBOTS[state.modelId].name || state.modelId;
}

function expandPlatformPanel() {
  const panel = document.getElementById('platformSelectPanel');
  const bar = document.getElementById('platformCollapsedBar');
  if (panel) panel.classList.remove('is-collapsed');
  if (bar) bar.hidden = true;
  renderModelSelect();
}

function renderVariants() {
  const el = document.getElementById('variantSelect');
  if (!el) return;
  if (!state.modelId) {
    el.innerHTML = '<p class="empty-select">Select a platform to view published configurations and pricing.</p>';
    return;
  }
  const robot = ROBOTS[state.modelId];
  if (!robot || !robot.variants) {
    el.innerHTML = '<p style="color:var(--text-dim);font-size:0.9rem;">No tier options listed — base configuration applies.</p>';
    return;
  }
  el.innerHTML = robot.variants.map(v => `
    <label class="variant-option ${state.variantId === v.id ? 'selected' : ''}">
      <input type="radio" name="variant" value="${v.id}" ${state.variantId === v.id ? 'checked' : ''} onchange="selectVariant('${v.id}')" onclick="this.focus({preventScroll:true})">
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:baseline; gap:10px; flex-wrap:wrap;">
          <span class="v-name">${v.name}</span>
          <span class="v-price">${formatMoney(v.price)}</span>
        </div>
        <div class="v-desc">${v.desc || ''}</div>
        ${v.detail ? `<div class="v-detail">${v.detail}</div>` : ''}
      </div>
    </label>
  `).join('');
}

function renderColors() {
  const el = document.getElementById('colorSelect');
  if (!el) return;
  if (!state.modelId) {
    el.innerHTML = '<p class="empty-select">Select a platform to view available factory finishes.</p>';
    return;
  }
  const robot = ROBOTS[state.modelId];
  const colors = robot.colors || [{ id: 'standard', name: 'Standard', hex: '#e2e8f0', premium: 0 }];
  el.innerHTML = colors.map(c => `
    <div class="color-swatch ${state.colorId === c.id ? 'selected' : ''}"
         style="background:${c.hex}"
         onclick="selectColor('${c.id}')"
         title="${c.name}">
      <span class="tooltip">${c.name}${c.premium ? ' (+' + formatMoney(c.premium) + ')' : ' — included'}</span>
    </div>
  `).join('');
}

function renderAddons() {
  const el = document.getElementById('addonSelect');
  if (!el) return;
  if (!state.modelId) {
    el.innerHTML = '<p class="empty-select">Select a platform to view compatible accessories and upgrades.</p>';
    return;
  }
  const robot = ROBOTS[state.modelId];
  const configBase = getCurrentConfigBasePrice();
  // Platform-specific addons only — warranties live in Step 6 dropdown
  const platformIds = (robot.addons || ['case']).filter(aid => {
    const a = ADDONS[aid];
    return a && a.groupType !== 'Warranty';
  });

  if (!platformIds.length) {
    el.innerHTML = '<p style="color:var(--text-dim);font-size:0.9rem;">No optional accessories listed for this platform. Proceed to warranty coverage.</p>';
    return;
  }

  el.innerHTML = platformIds.map(aid => {
    const a = ADDONS[aid];
    if (!a) return '';
    const selected = state.addons.has(aid);
    const price = getAddonPrice(a, configBase);
    return `
      <label class="addon-item ${selected ? 'selected' : ''}">
        <input type="checkbox" ${selected ? 'checked' : ''} onchange="toggleAddon('${aid}')" onclick="this.focus({preventScroll:true})">
        <div class="addon-check"></div>
        <div class="addon-photo-fallback">${a.icon || '📦'}</div>
        <div class="addon-info">
          <div class="a-name">${a.name}</div>
          <div class="a-desc">${a.desc || ''}</div>
        </div>
        <div class="addon-price">+${formatMoney(price)}</div>
      </label>
    `;
  }).join('');
}

/** True when type, platform, tier, and color are all chosen — only then show warranty. */
function isConfigReadyForWarranty() {
  return !!(state.typeId && state.modelId && state.variantId && state.colorId);
}

function renderWarranty() {
  const panel = document.getElementById('warrantySelectPanel');
  const sel = document.getElementById('warrantySelect');
  const detail = document.getElementById('warrantyDetail');
  if (!sel) return;

  // Keep coverage selector hidden until the rest of the configuration is complete
  if (!isConfigReadyForWarranty()) {
    if (panel) panel.style.display = 'none';
    if (detail) detail.textContent = '';
    return;
  }
  if (panel) panel.style.display = '';

  const robot = ROBOTS[state.modelId];
  const configBase = getCurrentConfigBasePrice();
  const mfr = getManufacturerWarrantyInfo(robot);
  const wid = state.warrantyId || '3yr';

  // Dollar amounts only — relative % pricing is internal (not shown on site)
  sel.innerHTML = `
    <option value="mfr"${wid === 'mfr' ? ' selected' : ''}>Manufacturer standard — ${mfr.label} (included)</option>
    <option value="1yr"${wid === '1yr' ? ' selected' : ''}>1-Year Protection Plan — ${formatMoney(getWarrantyPrice('1yr', configBase))}</option>
    <option value="2yr"${wid === '2yr' ? ' selected' : ''}>2-Year Protection Plan — ${formatMoney(getWarrantyPrice('2yr', configBase))}</option>
    <option value="3yr"${wid === '3yr' ? ' selected' : ''}>3-Year Protection Plan — ${formatMoney(getWarrantyPrice('3yr', configBase))} · recommended</option>
  `;

  if (detail) {
    if (wid === 'mfr') {
      detail.textContent = mfr.note;
    } else {
      const plan = WARRANTY_PLANS[wid];
      detail.textContent = `${plan.name} adds parts & labor coverage beyond the included manufacturer term (${mfr.label}). Final terms confirmed on formal quote.`;
    }
  }
}

function selectWarranty(id) {
  if (!WARRANTY_PLANS[id]) return;
  freezeScroll(() => {
    state.warrantyId = id;
    renderWarranty();
    updateSummary();
  });
}

function updateSummary() {
  const nameEl = document.getElementById('sumName');
  const varEl = document.getElementById('sumVariant');
  const idealEl = document.getElementById('sumIdeal');
  const baseEl = document.getElementById('sumBase');
  const colorEl = document.getElementById('sumColor');
  const addonsEl = document.getElementById('sumAddons');
  const totalEl = document.getElementById('sumTotal');
  const iconEl = document.getElementById('summaryIcon');
  const imgEl = document.getElementById('summaryImg');
  const mini = document.getElementById('miniSpecs');

  if (!state.modelId || !ROBOTS[state.modelId]) {
    if (nameEl) nameEl.textContent = '—';
    if (varEl) varEl.textContent = 'Select a platform to begin configuration';
    if (idealEl) idealEl.style.display = 'none';
    if (baseEl) baseEl.textContent = '$0';
    if (colorEl) colorEl.textContent = '$0';
    if (addonsEl) addonsEl.textContent = '$0';
    const wEl0 = document.getElementById('sumWarranty');
    if (wEl0) wEl0.textContent = '$0';
    if (totalEl) totalEl.textContent = '$0';
    if (iconEl) iconEl.textContent = '🤖';
    if (imgEl) imgEl.style.display = 'none';
    if (mini) mini.innerHTML = '';
    const hl0 = document.getElementById('summaryHighlights');
    if (hl0) hl0.innerHTML = '';
    renderWarranty();
    return;
  }

  const robot = ROBOTS[state.modelId];
  const variant = (robot.variants || []).find(v => v.id === state.variantId) || (robot.variants || [])[0];
  const color = (robot.colors || []).find(c => c.id === state.colorId) || (robot.colors || [])[0];
  const basePrice = variant ? variant.price : robot.basePrice;
  const colorPremium = color ? (color.premium || 0) : 0;
  let addonsTotal = 0;
  state.addons.forEach(aid => {
    if (ADDONS[aid] && ADDONS[aid].groupType !== 'Warranty') addonsTotal += getAddonPrice(ADDONS[aid], basePrice);
  });
  const warrantyPrice = getWarrantyPrice(state.warrantyId || '3yr', basePrice);
  const total = basePrice + colorPremium + addonsTotal + warrantyPrice;

  if (nameEl) nameEl.textContent = robot.name;
  if (varEl) varEl.textContent = variant ? variant.name : 'Standard';
  if (idealEl) {
    const line = (robot.uniqueSummary || robot.shortDesc || '').trim();
    idealEl.textContent = line;
    idealEl.style.display = line ? 'block' : 'none';
  }
  if (baseEl) baseEl.textContent = formatMoney(basePrice);
  if (colorEl) colorEl.textContent = formatMoney(colorPremium);
  if (addonsEl) addonsEl.textContent = formatMoney(addonsTotal);
  const wEl = document.getElementById('sumWarranty');
  if (wEl) wEl.textContent = formatMoney(warrantyPrice);
  if (totalEl) totalEl.textContent = formatMoney(total);
  renderWarranty();
  if (iconEl) iconEl.textContent = robot.icon || '🤖';
  if (imgEl) {
    if (robot.image) {
      imgEl.loading = 'eager';
      imgEl.src = robot.image;
      imgEl.style.display = 'block';
      if (iconEl) iconEl.style.display = 'none';
    } else {
      imgEl.style.display = 'none';
      if (iconEl) iconEl.style.display = 'grid';
    }
  }
  const highlightsEl = document.getElementById('summaryHighlights');
  // Match Robopedia card exactly: same pickers, limits, markup, and classes
  if (mini) {
    const keySpecs = pickMiniSpecs(robot);
    mini.innerHTML = keySpecs.length
      ? keySpecs.map(([k, v]) => {
          const empty = isUndisclosed(v);
          const shown = empty ? 'Not disclosed' : v;
          return `<div class="robot-card-spec${empty ? ' is-empty' : ''}"><div class="k">${k}</div><div class="v">${shown}</div></div>`;
        }).join('')
      : '';
  }
  if (highlightsEl) {
    const bullets = (robot.highlights || []).slice(0, 4);
    highlightsEl.innerHTML = bullets.map(h => `<li>${h}</li>`).join('');
  }
}

function freezeScroll(fn) {
  const x = window.scrollX || window.pageXOffset || 0;
  const y = window.scrollY || window.pageYOffset || 0;
  fn();
  window.scrollTo({ left: x, top: y, behavior: 'instant' });
}

function selectType(type) {
  if (!TYPE_META[type]) return;
  freezeScroll(() => {
    state.typeId = type;
    // Clear model selection if it no longer matches the chosen type
    if (state.modelId && ROBOTS[state.modelId]?.type !== type) {
      state.modelId = null;
      state.variantId = null;
      state.colorId = null;
      state.addons = new Set();
    }
    renderTypeSelect();
    renderModelSelect();
    renderVariants();
    renderColors();
    renderAddons();
    updateSummary();
    if (state.modelId) collapsePlatformPanel();
    else expandPlatformPanel();
    renderSpecsForCurrent();
  });
}

function selectModel(id) {
  if (!ROBOTS[id]) return;
  freezeScroll(() => {
    const robot = ROBOTS[id];
    state.typeId = robot.type;
    state.modelId = id;
    state.variantId = robot.variants && robot.variants[0] ? robot.variants[0].id : null;
    state.colorId = robot.colors && robot.colors[0] ? robot.colors[0].id : null;
    state.warrantyId = '3yr'; // default: additional 3-year extended
    state.addons = new Set();
    renderTypeSelect();
    renderModelSelect();
    renderVariants();
    renderColors();
    renderAddons();
    renderWarranty();
    updateSummary();
    collapsePlatformPanel();
    renderSpecsForCurrent();
  });
}

function selectVariant(id) {
  freezeScroll(() => {
    state.variantId = id;
    renderVariants();
    renderAddons();
    renderWarranty(); // extended warranty prices are relative to configuration price
    updateSummary();
  });
}

function selectColor(id) {
  freezeScroll(() => {
    state.colorId = id;
    renderColors();
    updateSummary();
  });
}

function toggleAddon(id) {
  const addon = ADDONS[id];
  if (!addon) return;
  freezeScroll(() => {
    if (state.addons.has(id)) {
      state.addons.delete(id);
    } else {
      if (addon.exclusiveGroup) {
        for (const existingId of [...state.addons]) {
          const existing = ADDONS[existingId];
          if (existing && existing.exclusiveGroup === addon.exclusiveGroup) {
            state.addons.delete(existingId);
          }
        }
      }
      state.addons.add(id);
    }
    renderAddons();
    updateSummary();
  });
}

function resetConfig() {
  state.typeId = null;
  state.modelId = null;
  state.variantId = null;
  state.colorId = null;
  state.warrantyId = '3yr';
  state.addons = new Set();
  renderTypeSelect();
  renderModelSelect();
  renderVariants();
  renderColors();
  renderAddons();
  renderWarranty();
  updateSummary();
  expandPlatformPanel();
  renderSpecsForCurrent();
}

function openCart() {
  const overlay = document.getElementById('cartOverlay');
  if (overlay) {
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  renderCart();
}

function closeCart() {
  const overlay = document.getElementById('cartOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function addCurrentToCart() {
  if (!state.modelId) {
    alert('Please select a platform before adding a configuration.');
    return;
  }
  const robot = ROBOTS[state.modelId];
  const variant = (robot.variants || []).find(v => v.id === state.variantId) || (robot.variants || [])[0];
  const color = (robot.colors || []).find(c => c.id === state.colorId);
  const addonList = [...state.addons].map(aid => ADDONS[aid]).filter(a => a && a.groupType !== 'Warranty');
  const basePrice = variant ? variant.price : robot.basePrice;
  const colorPremium = color ? (color.premium || 0) : 0;
  const addonsTotal = addonList.reduce((s, a) => s + getAddonPrice(a, basePrice), 0);
  const warrantyPrice = getWarrantyPrice(state.warrantyId || '3yr', basePrice);
  const warrantyLabel = getWarrantyLabel(state.warrantyId || '3yr', robot);
  state.cart.push({
    id: state.modelId,
    name: robot.name,
    variant: variant ? variant.name : 'Standard',
    color: color ? color.name : 'Standard',
    warranty: warrantyLabel,
    addons: addonList.map(a => a.name),
    total: basePrice + colorPremium + addonsTotal + warrantyPrice
  });
  saveLabCart();
  renderCart();
  openCart();
}

function renderCart() {
  const el = document.getElementById('cartBody');
  const totalEl = document.getElementById('cartSubtotal');
  const badge = document.getElementById('cartBadge');
  if (!el) return;

  const count = state.cart.length;
  if (badge) {
    badge.textContent = String(count);
    badge.setAttribute('data-count', String(count));
  }

  if (count === 0) {
    el.innerHTML = '<div class="cart-empty">Your cart is empty. Configure a platform and add it to the cart.</div>';
    if (totalEl) totalEl.textContent = '$0';
    return;
  }

  el.innerHTML = state.cart.map((item, i) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">${item.variant}${item.color ? ' · ' + item.color : ''}</div>
        ${item.warranty ? `<div class="cart-item-meta">${item.warranty}</div>` : ''}
        ${item.addons && item.addons.length ? `<div class="cart-item-meta">${item.addons.join(', ')}</div>` : ''}
      </div>
      <div class="cart-item-price">${formatMoney(item.total)}</div>
      <button type="button" class="cart-item-remove" onclick="removeFromCart(${i})" title="Remove" aria-label="Remove from cart">×</button>
    </div>
  `).join('');

  const total = state.cart.reduce((s, item) => s + (item.total || 0), 0);
  if (totalEl) totalEl.textContent = formatMoney(total);
}

function removeFromCart(i) {
  if (i < 0 || i >= state.cart.length) return;
  state.cart.splice(i, 1);
  saveLabCart();
  renderCart();
}

function renderSpecsTabs() {
  // Specs are driven by the currently selected bot only
  renderSpecsForCurrent();
}

function renderSpecsForCurrent() {
  const intro = document.getElementById('specsIntro');
  const tbody = document.querySelector('#specsTable tbody');
  const panel = document.getElementById('configSpecs');
  if (!intro && !tbody) return;

  if (!state.modelId || !ROBOTS[state.modelId]) {
    if (intro) intro.textContent = 'Select a platform in the Configuration Lab to review its specifications and history.';
    if (tbody) tbody.innerHTML = '';
    if (panel) panel.style.display = 'none';
    return;
  }

  const robot = ROBOTS[state.modelId];
  if (panel) panel.style.display = '';
  if (intro) intro.textContent = robot.specsIntro || '';
  if (tbody) {
    const mfr = getManufacturerWarrantyInfo(robot);
    const specs = robot.specs || {};
    const nd = /^(not disclosed|—|-)?$/i;
    const cell = (k, v) => {
      let val = v;
      if (/warranty/i.test(k)) val = mfr.label;
      const empty = !val || nd.test(String(val).trim());
      const shown = empty ? 'Not disclosed' : val;
      return `<tr class="${empty ? 'spec-empty' : ''}"><th>${k}</th><td>${shown}</td></tr>`;
    };
    let html = '';
    const groups = (typeof TYPE_SPEC_GROUPS !== 'undefined' && TYPE_SPEC_GROUPS[robot.type]) || null;
    if (groups) {
      const used = new Set();
      groups.forEach(g => {
        html += `<tr class="spec-group"><th colspan="2">${g.name}</th></tr>`;
        g.keys.forEach(k => {
          used.add(k);
          html += cell(k, specs[k]);
        });
      });
      Object.entries(specs).forEach(([k, v]) => {
        if (used.has(k) || /warranty/i.test(k)) return;
        html += cell(k, v);
      });
      if (robot.website) {
        html += `<tr><th>Manufacturer Website</th><td><a href="${robot.website}" target="_blank" rel="noopener">${robot.website}</a></td></tr>`;
      }
      html += `<tr><th>Warranty Notes</th><td>${mfr.note}</td></tr>`;
    } else {
      const rows = [];
      Object.entries(specs).forEach(([k, v]) => {
        if (/warranty/i.test(k)) rows.push(['Manufacturer Warranty', mfr.label]);
        else rows.push([k, v]);
      });
      if (!rows.some(([k]) => /warranty/i.test(k))) rows.push(['Manufacturer Warranty', mfr.label]);
      html = rows.map(([k, v]) => cell(k, v)).join('') + (robot.website ? `<tr><th>Manufacturer Website</th><td><a href="${robot.website}" target="_blank" rel="noopener">${robot.website}</a></td></tr>` : '') + `<tr><th>Warranty Notes</th><td>${mfr.note}</td></tr>`;
    }
    tbody.innerHTML = html || '<tr><th colspan="2">Detailed specifications confirmed on formal quote.</th></tr>';
  }
}

function showSpecs(id, btn) {
  // Kept for compatibility; always defer to current selection model
  if (id && ROBOTS[id]) {
    selectModel(id);
  } else {
    renderSpecsForCurrent();
  }
}


// Cart open / close wiring
(function wireCartControls() {
  const cartBtn = document.getElementById('cartBtn');
  const cartClose = document.getElementById('cartClose');
  const overlay = document.getElementById('cartOverlay');
  if (cartBtn) {
    cartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openCart();
    });
  }
  if (cartClose) {
    cartClose.addEventListener('click', (e) => {
      e.preventDefault();
      closeCart();
    });
  }
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeCart();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCart();
  });
  const promoApply = document.getElementById('promoApply');
  const promoInput = document.getElementById('promoInput');
  const promoMsg = document.getElementById('promoMsg');
  if (promoApply && promoInput) {
    promoApply.addEventListener('click', () => {
      const code = (promoInput.value || '').trim().toUpperCase();
      if (!code) {
        if (promoMsg) promoMsg.textContent = 'Enter a promo code.';
        return;
      }
      // Placeholder — real codes confirmed on formal quote
      if (promoMsg) {
        promoMsg.textContent = code === 'QUEST10'
          ? 'QUEST10 noted. Discount confirmed on formal quote.'
          : 'Code received. Eligibility confirmed on formal quote.';
      }
    });
  }
})();

// Expand Step 2 when buyer wants to change platform
const platformChangeBtn = document.getElementById('platformChangeBtn');
if (platformChangeBtn) {
  platformChangeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    expandPlatformPanel();
  });
}

// Keep the model grid a true 2D checker when the column count changes
const modelSelectGrid = document.getElementById('modelSelect');
if (modelSelectGrid && typeof ResizeObserver !== 'undefined') {
  let checkPaintRaf = 0;
  new ResizeObserver(() => {
    if (checkPaintRaf) cancelAnimationFrame(checkPaintRaf);
    checkPaintRaf = requestAnimationFrame(() => paintModelCheckers(modelSelectGrid));
  }).observe(modelSelectGrid);
}

// Init — honor ?type= / ?q= from nav and home tiles
try {
  const params = new URLSearchParams(location.search);
  const t = params.get('type');
  if (t && typeof TYPE_META !== 'undefined' && TYPE_META[t]) state.typeId = t;
  const q = params.get('q');
  if (q) state.query = q;
} catch (e) {}

(function wireLabSearch() {
  const form = document.getElementById('navSearchForm');
  const input = document.getElementById('navSearch');
  if (!form || !input) return;
  if (state.query) input.value = state.query;
  let t = 0;
  function apply() {
    state.query = (input.value || '').trim();
    renderModelSelect();
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    apply();
  });
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(apply, 180);
  });
})();

renderTypeSelect();
renderModelSelect();
renderVariants();
renderColors();
renderAddons();
renderWarranty();
updateSummary();
expandPlatformPanel();
renderSpecsForCurrent();
renderCart();
