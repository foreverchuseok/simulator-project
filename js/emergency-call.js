/* 비상통화장치(인터폰 방식) — 카 주조작반 · 카 측면조작반 · 카탑 · 피트 4곳 + 기계실 인터폰.
   형상: blender/scripts/emergency_call_unit.py → models/gltf/emergency_call_unit.glb (카탑·피트, 영상 검사기법/IMG_8002)
   ▪ 4곳 중 한 곳의 작은 전화 아이콘을 누르면 그 자리 버튼 LED 가 노랑(연결 중) → 초록(통화)으로 바뀐다(기준의 표시등).
     나머지 3곳은 꺼진 채(스테인리스), 기계실 인터폰은 연결 중 빨간 LED 깜박임 → 통화 중 초록 점등 → 종료 시 소등.
   ▪ 소리: 호출 삐 → 안내 음성(연결 중) → 자동 다이얼 DTMF → 호출음 → 상담원 "코엘사 엘리베이터…" 대화 → 종료.
     상담원 음성은 전화선 대역(300–3400Hz) 필터를 거친다. 음성 파일은 sound/ec_*.mp3 (edge-tts 신경망 음성).
   ▪ 통화 중 아무 아이콘이나 다시 누르거나 자막의 「통화 종료」를 누르면 끊는다. 시연이 시작돼도 끊는다. */
const EmergencyCall = (() => {
  const LOC = {
    carMain: { label: '카 주조작반', passenger: true },
    carSide: { label: '카 측면조작반', passenger: true },
    carTop: { label: '카탑', passenger: false },
    pit: { label: '피트', passenger: false }
  };
  const COLOR = { yellow: 0xff9a00, green: 0x00d23c, red: 0xff1400 };   // sRGB 출력에서 옅어지므로 채도를 높게
  let built = false, active = null, phase = 'idle', seq = 0, blinkT = 0, manualLink=false;
  let mrLed = null, caption = null, captionText = null, endBtn = null, audioCtx = null, filterIn = null;
  const leds = {}, anchors = {}, buttons = {}, playing = new Set();
  const v = new THREE.Vector3();
  const ICON = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>') + '")';

  function ledMaterial() {
    return new THREE.MeshStandardMaterial({ color: 0xb9bdc1, metalness: 0.8, roughness: 0.25, emissive: 0x000000 });
  }
  function setLed(mat, color) {
    if (!mat) return;
    if (color == null) { mat.color.setHex(0xb9bdc1); mat.metalness = 0.8; mat.emissive.setHex(0x000000); mat.emissiveIntensity = 1; mat.toneMapped = true; }
    else { mat.color.setHex(0x0a0a0a); mat.metalness = 0; mat.emissive.setHex(color); mat.emissiveIntensity = 1.0; mat.toneMapped = false; }   // 채도 유지(흰색으로 날지 않게)
  }
  function ringOn(parent, r, z, name) {
    const mat = ledMaterial();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0034, 10, 40), mat);
    ring.name = name; ring.position.z = z; parent.add(ring);
    return mat;
  }

  function build() {
    if (built) return; built = true;
    const loader = new THREE.GLTFLoader();
    const place = (key, parent, setup) => {
      const g = new THREE.Group(); g.name = 'emergencyCall_' + key; g.userData = { type: 'emergency-call-unit', location: key };
      const mount = setup(g) || g; parent.add(g); anchors[key] = g;
      loader.load('models/gltf/emergency_call_unit.glb', gltf => {
        const unit = gltf.scene;
        unit.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        const mat = ledMaterial();
        unit.getObjectByName('CallLedRing')?.traverse(o => { if (o.isMesh) o.material = mat; });
        // 카탑은 사람이 드나들며 걸려 베일 수 있으므로 돌출 고정 탭·볼트를 없앤다(양면테이프·안쪽 피스 고정 가정). 피트는 벽 피스 고정이라 탭 유지.
        if (key === 'carTop') unit.traverse(o => { if (o.isMesh && o.material?.name === 'EcBracket') o.visible = false; });
        leds[key] = mat; mount.add(unit); g.userData.ready = true;
        const bc = unit.getObjectByName('EmergencyCallUnit')?.userData.buttonCenter;
        if (bc) g.userData.button = new THREE.Vector3(...bc);
        refresh();
      }, undefined, e => console.error('[emergency call] GLB load failed', e));
    };
    // 피트: 점검운전 스위치 +Z 옆(사용자 표시 1537381), 같은 높이. 벽면 부착, 앞면 +X.
    const pitZ = SHAFT_LIGHT_Z - 0.205 + 0.26, pitY = Y0 + 0.60;
    place('pit', shaftCableGrp, g => { g.position.set(-S.SHAFT_W / 2, pitY, pitZ); g.rotation.y = Math.PI / 2; });
    // 카탑: 카탑 박스 윗면 −Z 쪽(사용자 표시 1538051)에 눕혀 버튼이 위를 본다(영상과 같은 설치).
    const topBox = carGrp.getObjectByName('carTopBox');
    if (topBox) place('carTop', topBox, g => {
      g.position.set(0, 0.312, -0.09); g.rotation.y = Math.PI / 2;
      const inner = new THREE.Group(); inner.rotation.x = -Math.PI / 2; g.add(inner);
      return inner;                                                  // 로드된 모델은 눕힌 inner 에 붙는다
    });
    // 피트 장치 케이블: 위 글랜드 → 조명 아래 점검 스위치 케이블 수평부와 합류(같은 다발로 상승).
    {
      const black = M.paint(0x141619), wallX = -S.SHAFT_W / 2, runY = Y0 + 0.02 + 0.80;
      const gx = wallX + 0.018, gy = pitY + 0.0965, gz = pitZ + 0.05;   // GLB 윗면 글랜드(로컬 x −0.05 → 월드 +Z)
      const pts = [[gx, gy, gz], [gx, runY, gz], [wallX + 0.033, runY, gz - 0.03], [wallX + 0.033, runY, SHAFT_LIGHT_Z - 0.235]];
      for (let i = 1; i < pts.length; i++) {
        const a = new THREE.Vector3(...pts[i - 1]), b = new THREE.Vector3(...pts[i]), d = b.clone().sub(a);
        const m = createCylinder(0.005, 0.005, d.length(), black, ...a.clone().add(b).multiplyScalar(0.5).toArray(), shaftCableGrp);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.name = 'emergencyCallPitCable';
      }
    }
    // 카 안: 기존 통화 버튼 둘레에 표시등 링을 두른다.
    const main = carGrp.getObjectByName('opbEmergencyCall'), side = carGrp.getObjectByName('accessibleButton_call');
    if (main) { leds.carMain = ringOn(main, 0.0255, 0.004, 'opbEmergencyCallLed'); anchors.carMain = main; }
    if (side) { leds.carSide = ringOn(side, 0.0265, 0.004, 'accessibleCallLed'); anchors.carSide = side; }
    // 아이콘 버튼 4개
    for (const key of Object.keys(LOC)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'part-action'; b.id = 'ec-action-' + key; b.hidden = true;
      b.style.setProperty('--part-icon', ICON); b.style.width = b.style.height = '36px';
      b.setAttribute('aria-label', LOC[key].label + ' 비상통화');
      b.title = LOC[key].label + ' 비상통화 버튼';
      b.addEventListener('click', () => press(key));
      document.getElementById('part-actions').appendChild(b); buttons[key] = b;
      PartGlow.bind(b, () => anchors[key], LOC[key].label + ' 비상통화장치', () => '비상통화 버튼 누르기', { direct: true });
    }
    caption = document.createElement('div');
    caption.id = 'ec-caption'; caption.className = 'glass'; caption.hidden = true;
    caption.style.cssText = 'position:fixed;left:50%;top:96px;transform:translateX(-50%);z-index:95;width:max-content;max-width:min(560px,calc(100vw - 24px));box-sizing:border-box;padding:10px 14px;border-radius:14px;font:500 14px/1.5 var(--ui-font,sans-serif);color:var(--ui-text,#fff);text-align:center;pointer-events:none;';
    captionText = document.createElement('div');
    // 통화는 30초 넘게 이어진다 — 다른 기능으로 넘어가도 자막이 남지 않게 언제든 끊는 버튼(사용자 2026-10-05).
    endBtn = document.createElement('button');
    endBtn.type = 'button'; endBtn.id = 'ec-hangup'; endBtn.textContent = '통화 종료';
    endBtn.setAttribute('aria-label', '비상통화 종료');
    endBtn.style.cssText = 'pointer-events:auto;margin-top:8px;min-height:44px;padding:0 22px;border-radius:999px;border:1px solid #ff6b5e;background:#d93a2b;color:#fff;font:700 14px/1 var(--ui-font,sans-serif);cursor:pointer;';
    caption.append(captionText, endBtn);
    document.body.appendChild(caption);
    // 시연 모듈은 document 캡처 단계에서 허용목록 밖 클릭을 막는다 — window 캡처에서 먼저 받는다.
    window.addEventListener('click', e => {
      if (!e.target.closest?.('#ec-hangup')) return;
      e.stopImmediatePropagation();
      if (active) { hangUp(); tone([480, 620], 0.35); }
    }, true);
  }

  // ── 소리 ──────────────────────────────────────────────────────────
  function ctx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320;
      const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3300;
      const gain = audioCtx.createGain(); gain.gain.value = 1.3;
      hp.connect(lp); lp.connect(gain); gain.connect(audioCtx.destination); filterIn = hp;
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }
  function tone(freqs, dur, when = 0, vol = 0.12) {
    const c = ctx(), t = c.currentTime + when, g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + dur - 0.02); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    g.connect(c.destination);
    for (const f of freqs) { const o = c.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + dur + 0.02); playing.add(o); o.onended = () => playing.delete(o); }
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function voice(name, phoneLine) {
    return new Promise(resolve => {
      const a = new Audio('sound/' + name + '.mp3'); a.preload = 'auto';
      if (phoneLine) { try { ctx().createMediaElementSource(a).connect(filterIn); } catch (e) { /* 필터 없이 재생 */ } }
      playing.add(a);
      const done = () => { playing.delete(a); resolve(); };
      a.onended = done; a.onerror = done; a.onpause = () => { if (!a.ended) done(); };
      a.play().catch(done);
    });
  }
  const DTMF = { 1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], 0: [941, 1336] };
  function stopAudio() {
    for (const p of playing) { try { p.pause ? p.pause() : p.stop(); } catch (e) { /* 이미 끝남 */ } }
    playing.clear();
  }
  function say(who, text) {
    if (!caption) return;
    caption.hidden = !text;
    captionText.innerHTML = text ? `<b style="opacity:.75">${who}</b>&nbsp; ${text}` : '';
  }

  // ── 상태 ──────────────────────────────────────────────────────────
  function refresh() {
    for (const key of Object.keys(LOC)) {
      const on = key === active;
      setLed(leds[key], on ? (phase === 'connected' ? COLOR.green : phase === 'connecting' ? COLOR.yellow : null) : null);
      if (buttons[key]) { buttons[key].classList.toggle('active', on); buttons[key].setAttribute('aria-pressed', String(on)); }
    }
    if (mrLed) setLed(mrLed, phase === 'connected' ? COLOR.green : null);
  }
  function hangUp() {
    seq++; stopAudio(); active = null; phase = 'idle'; say(); refresh();
  }
  function press(key) {
    ctx();
    if (active) { hangUp(); tone([480, 620], 0.35); return; }
    run(key);
  }
  async function run(key) {
    const my = ++seq, ok = () => my === seq;
    active = key; phase = 'connecting'; refresh();
    const L = LOC[key];
    tone([1000], 0.18);
    say('비상통화장치', '비상통화장치 연결 중입니다. 관리자와 연결 중이오니 잠시만 기다려 주십시오.');
    await wait(300); if (!ok()) return;
    await voice('ec_device_connecting'); if (!ok()) return;
    say('비상통화장치', '관리실(코엘사 비상통화 센터)로 자동 발신 중…');
    [...'15881234'].forEach((d, i) => tone(DTMF[d], 0.08, i * 0.14, 0.08));
    await wait(1400); if (!ok()) return;
    for (let r = 0; r < 2; r++) {                           // 호출음(링백): 1초 울림 · 2초 쉼
      say('비상통화장치', '호출 중… ' + '☎'.repeat(r + 1));
      tone([440, 480], 1.0, 0, 0.07); await wait(3000); if (!ok()) return;
    }
    tone([1400], 0.05, 0, 0.05);                            // 수화기 드는 소리
    phase = 'connected'; refresh();
    say('상담원', '네, 코엘사 엘리베이터 비상통화 센터입니다. 지금 어떤 상황이신가요?');
    await voice('ec_op_hello', true); if (!ok()) return;
    const lines = L.passenger ? [
      ['(승객)', '엘리베이터가 멈췄어요. 문이 안 열려요.', 2600],
      ['상담원', '승강기 안에 갇히신 거군요. 많이 놀라셨죠. 혹시 다치신 분은 안 계신가요?', 'ec_op_p1'],
      ['(승객)', '다친 사람은 없어요.', 2000],
      ['상담원', '승강기 번호 0001-001, 현재 위치 확인했습니다. 가장 가까운 기술자에게 바로 출동을 요청했고, 약 20분 안에 도착할 예정입니다.', 'ec_op_p2'],
      ['상담원', '문을 억지로 열거나 밖으로 나오려고 하지 마시고, 승강기 안에서 안전하게 기다려 주십시오. 승강기 안은 환기가 되고 있으니 안심하셔도 됩니다.', 'ec_op_p3']
    ] : [
      ['(작업자)', L.label + '에서 점검 중입니다. 통화 테스트합니다.', 2600],
      ['상담원', '점검 작업 중이신가요? 작업 위치와 현재 상황을 말씀해 주세요.', 'ec_op_t1'],
      ['(작업자)', L.label + ' 비상통화 정상 확인했습니다.', 2400],
      ['상담원', '네, 확인했습니다. 기계실과 관리실에 점검 작업 중인 것을 전달하겠습니다. 작업 중 이상이 있으면 다시 비상통화 버튼을 눌러 주십시오.', 'ec_op_t2']
    ];
    for (const [who, text, act] of lines) {
      say(who, text);
      if (typeof act === 'number') await wait(act); else await voice(act, true);
      if (!ok()) return;
    }
    say('상담원', '통화를 종료합니다. 도움이 더 필요하시면 비상통화 버튼을 다시 눌러 주십시오.');
    await voice('ec_op_bye', true); if (!ok()) return;
    tone([480, 620], 0.35); await wait(500); tone([480, 620], 0.35, 0);
    await wait(600); if (!ok()) return;
    hangUp();
  }

  // ── 매 프레임: 기계실 LED 깜박임 · 아이콘 위치 ──────────────────────────
  // 통화 중 시연이 시작되면 끊는다 — 시연 자막·소리와 겹치지 않게(수동 구출은 스스로 끊는다).
  function demoRunning() {
    try {
      return !!(DemoPause.demo || overspeedActive || UCMDemo.state.active || BufferDemo.active || ARDDemo.active || RetentionDemo.active);
    } catch (e) { return false; }
  }
  function update(t) {
    if (!built) return;
    if (active && demoRunning()) hangUp();
    if (!mrLed) {
      const phone = scene.getObjectByName('ControlPanelIntercom');
      if (phone) {
        const mat = ledMaterial(); mat.color.setHex(0x4a1512); mat.metalness = 0;
        const led = createCylinder(0.0052, 0.0052, 0.004, mat, 0.031, -0.095, 0.0445, phone);
        led.rotation.x = Math.PI / 2; led.name = 'intercomCallLed'; mrLed = mat;
      }
    }
    if (mrLed) {
      if (manualLink) setLed(mrLed,COLOR.green);
      else if (phase === 'connecting') { const on = Math.floor(t * 2.5) % 2 === 0; setLed(mrLed, on ? COLOR.red : null); if (!on) mrLed.color.setHex(0x4a1512); }
      else if (phase === 'idle') { setLed(mrLed, null); mrLed.color.setHex(0x4a1512); mrLed.metalness = 0; }
    }
    for (const key of Object.keys(LOC)) {
      const b = buttons[key], a = anchors[key];
      if (!b || !a) continue;
      a.getWorldPosition(v);
      // 카 안 두 곳도 층 버튼(passenger-controls.js)처럼 거리로만 판정한다. 「카메라가 카 안」 조건이 있으면
      // 카 뒤 구석·문 밖(체험)에서 층 버튼은 눌리는데 통화 버튼만 안 눌렸다(사용자 2026-10-05). 벽 너머는 PartGlow 가림 판정이 막는다.
      // 3.6m = 카 뒤 구석에서 맞은편 주조작반까지(약 3.2m) + 여유.
      const car = key === 'carMain' || key === 'carSide';
      let shown = camera.position.distanceToSquared(v) < (car ? 3.6 * 3.6 : 16);
      for (let p = a; p && shown; p = p.parent) if (!p.visible) shown = false;
      if (shown) { v.project(camera); shown = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1; }
      b.hidden = !shown;
      if (shown) PartActions.positionButton(b, (v.x + 1) * innerWidth / 2 + 16, (1 - v.y) * innerHeight / 2 - 18);
    }
  }
  function setManualLink(on){manualLink=!!on;setLed(leds.carMain,on?COLOR.green:null);}
  return { build, update, press, hangUp,setManualLink, get state() { return { active, phase,manualLink }; } };
})();
