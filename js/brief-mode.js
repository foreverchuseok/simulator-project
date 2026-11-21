// 저사양 태블릿(갤럭시탭 S7 FE 등)용 「브리핑 모드」(2026-11-22).
// 기본은 꺼짐(?brief=1 켜고 기억, ?brief=0 끄고 기억, 그 외 localStorage 기억값).
// 켜졌을 때만 장면 생성 전에 Standard/Physical 재질을 Lambert 하위 클래스로 교체해
// 조명 스위치·비상등·ARD 정전·과속 절개(clone)가 같은 재질 참조로 동작하면서 가볍게 렌더링된다.
const BriefMode = (() => {
  const STORE = 'briefModeEnabled';
  const DPR = 0.75;
  const CAP_MS = 33;
  const param = new URLSearchParams(location.search).get('brief');
  let active = false;
  if (param === '1') {
    active = true;
    try { localStorage.setItem(STORE, '1'); } catch (e) {}
  } else if (param === '0') {
    active = false;
    try { localStorage.setItem(STORE, '0'); } catch (e) {}
  } else {
    try { active = localStorage.getItem(STORE) === '1'; } catch (e) { active = false; }
  }

  // Standard/Physical 전용 속성은 경고 없이 보관·무시한다(Lambert 셰이더에서 비싼 PBR 샘플링 생략).
  const IGNORED_KEYS = new Set([
    'roughness', 'metalness', 'bumpMap', 'bumpScale', 'normalMap', 'normalMapType', 'normalScale',
    'displacementMap', 'displacementScale', 'displacementBias', 'roughnessMap', 'metalnessMap',
    'envMap', 'envMapIntensity', 'flatShading',
    'clearcoat', 'clearcoatMap', 'clearcoatRoughness', 'clearcoatRoughnessMap', 'clearcoatNormalScale', 'clearcoatNormalMap',
    'ior', 'transmission', 'transmissionMap', 'thickness', 'thicknessMap', 'attenuationDistance', 'attenuationColor',
    'sheen', 'sheenRoughness', 'sheenRoughnessMap', 'sheenColor', 'sheenColorMap',
    'specularIntensity', 'specularIntensityMap', 'specularColor', 'specularColorMap', 'defines'
  ]);

  if (active && typeof THREE !== 'undefined' && THREE.MeshLambertMaterial) {
    document.documentElement.classList.add('brief-mode');
    class BriefStandardMaterial extends THREE.MeshLambertMaterial {
      constructor(parameters) {
        super();
        this.roughness = 1;
        this.metalness = 0;
        this.bumpScale = 1;
        this.normalScale = new THREE.Vector2(1, 1);
        this.displacementScale = 1;
        this.displacementBias = 0;
        this.envMapIntensity = 1;
        this.flatShading = false;
        this.clearcoat = 0;
        this.clearcoatRoughness = 0;
        this.clearcoatNormalScale = new THREE.Vector2(1, 1);
        this.ior = 1.5;
        this.transmission = 0;
        this.thickness = 0;
        this.attenuationDistance = Infinity;
        this.attenuationColor = new THREE.Color(0xffffff);
        this.sheenRoughness = 1;
        this.sheenColor = new THREE.Color(0x000000);
        this.specularIntensity = 1;
        this.specularColor = new THREE.Color(0xffffff);
        if (parameters) this.setValues(parameters);
      }
      setValues(values) {
        if (!values) return;
        const lambert = {};
        for (const key in values) {
          const v = values[key];
          if (v === undefined) continue;
          if (IGNORED_KEYS.has(key)) {
            if (key === 'normalScale' || key === 'clearcoatNormalScale') {
              if (v && v.isVector2) this[key].copy(v);
            } else if (key === 'attenuationColor' || key === 'sheenColor' || key === 'specularColor') {
              if (v && v.isColor) this[key].copy(v);
              else if (v != null) this[key].set(v);
            } else {
              this[key] = v;
            }
          } else {
            lambert[key] = v;
          }
        }
        // Physical 유리(transmission>0, opacity≈1)가 Lambert에서 불투명해지지 않도록 반투명으로 보정한다.
        if (values.transmission > 0 && (values.opacity === undefined || values.opacity >= 0.95)) {
          lambert.opacity = Math.max(0.18, +(1 - values.transmission * 0.78).toFixed(2));
          lambert.transparent = true;
        }
        super.setValues(lambert);
      }
      copy(source) {
        super.copy(source);
        if (!source) return this;
        this.roughness = source.roughness ?? 1;
        this.metalness = source.metalness ?? 0;
        this.envMapIntensity = source.envMapIntensity ?? 1;
        this.clearcoat = source.clearcoat ?? 0;
        this.clearcoatRoughness = source.clearcoatRoughness ?? 0;
        this.transmission = source.transmission ?? 0;
        this.ior = source.ior ?? 1.5;
        if (source.normalScale?.isVector2) this.normalScale.copy(source.normalScale);
        if (source.clearcoatNormalScale?.isVector2) this.clearcoatNormalScale.copy(source.clearcoatNormalScale);
        return this;
      }
    }
    // WebGLPrograms.getParameters()가 Lambert에서도 읽는 PBR 전용 맵·속성을 모두 비워
    // 셰이더 프로그램 분기·전환과 PMREM(검게 렌더) 오버헤드를 차단한다.
    for (const key of ['envMap', 'normalMap', 'bumpMap', 'displacementMap', 'roughnessMap', 'metalnessMap',
      'clearcoatMap', 'clearcoatRoughnessMap', 'clearcoatNormalMap', 'transmissionMap', 'thicknessMap',
      'sheen', 'sheenColorMap', 'sheenRoughnessMap', 'specularIntensityMap', 'specularColorMap']) {
      Object.defineProperty(BriefStandardMaterial.prototype, key, {
        configurable: true,
        get() { return null; },
        set() {}
      });
    }
    Object.defineProperty(BriefStandardMaterial.prototype, 'normalMapType', {
      configurable: true,
      get() { return undefined; },
      set() {}
    });
    class BriefPhysicalMaterial extends BriefStandardMaterial {}
    THREE.MeshStandardMaterial = BriefStandardMaterial;
    THREE.MeshPhysicalMaterial = BriefPhysicalMaterial;
  }

  function set(on) {
    const next = !!on;
    let stored = false;
    try { localStorage.setItem(STORE, next ? '1' : '0'); stored = true; } catch (e) {}
    const url = new URL(location.href);
    if (url.searchParams.has('brief') || !stored) {
      if (next) url.searchParams.set('brief', '1');
      else if (stored) url.searchParams.delete('brief');
      else url.searchParams.set('brief', '0');
      location.replace(url.toString());
    } else {
      location.reload();
    }
  }

  function initUI() {
    const toggle = document.getElementById('brief-mode-toggle');
    if (toggle) {
      toggle.classList.toggle('active', active);
      toggle.setAttribute('aria-pressed', String(active));
      toggle.addEventListener('click', () => set(!active));
    }
    if (!active || document.getElementById('brief-badge')) return;
    const style = document.createElement('style');
    style.textContent = `
      #brief-badge{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:90;
        display:inline-flex;align-items:center;gap:5px;min-height:30px;padding:4px 10px;border:1px solid #cbd5e199;border-radius:999px;
        background:#0f172ad4;color:#e2e8f0;font:600 11px/1 var(--ui-font,sans-serif);cursor:pointer;box-shadow:0 2px 10px #0003;touch-action:manipulation}
      #brief-badge span{font-size:13px;opacity:.85}
      #brief-badge:active{background:#1e293bf0}
      #brief-badge:focus-visible{outline:2px solid #fbbf24;outline-offset:2px}
      body.m-hud #brief-badge{right:auto;left:var(--edge,10px);bottom:calc(var(--m-above,68px) + 6px)}
      body.m-hud.m-demo-compact #brief-badge{bottom:calc(var(--m-above,68px) + 74px)}
      body.m-hud[data-m-mode="walk"] #brief-badge{top:calc(var(--edge-t,10px) + 60px);bottom:auto}
      body.m-hud.portrait-tools-hidden #brief-badge{visibility:hidden;pointer-events:none}
    `;
    document.head.append(style);
    const badge = document.createElement('button');
    badge.id = 'brief-badge'; badge.type = 'button';
    badge.innerHTML = '브리핑 <span aria-hidden="true">×</span>';
    badge.title = '브리핑 모드(가벼운 화면) 켜짐 — 누르면 일반 화질로 전환';
    badge.setAttribute('aria-label', '브리핑 모드 끄기');
    badge.addEventListener('click', () => set(false));
    document.body.append(badge);
  }

  return { active, DPR, CAP_MS, set, initUI };
})();
