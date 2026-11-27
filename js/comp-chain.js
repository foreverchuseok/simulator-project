/* 균형체인(보상체인) · 이중체결 어셈블리 (2026-11-27)
   - 형상 원본: blender/scripts/comp_chain_hitch.py → models/gltf/comp_chain_hitch.glb (extras contractVersion 2)
   - 검사기준: [별표22] 엘리베이터 안전기준 9.6.3 · 9.6.4 (추가적인 보호조치 — 체인 연결부와 다른 부재에 연결, 완충기 충돌판 연결 불가)
   - 배치: 완충기 충돌판(±0.12m)을 피해 좌/우 X = ±0.34m 2본 대칭.
     카 하부(플랫폼 후방 보상체인 횡빔 z_local = -0.78m) ↔ 균형추 하부 빔(CWT_CENTER_Z).
     피트 스크린 하단 아래 개구부로 통과하며 피트 마감 바닥(Y0 + 0.02m)과 여유 간극 유지.
   - 체결 계약: 1번 링크는 U-볼트 바닥 봉(X 방향)에 걸려 YZ 면, 2번 링크는 XY 면이며 안전 와이어로프가
     2번 링크 개구를 Z 방향으로 지난다. 와이어는 빔 웹을 앞→뒤 일직선으로 관통한다(프레임 속에 갇히지 않음).
   - 파단(용접부): 브라켓 + U-볼트 + 1번 링크가 한 덩어리로 이탈한다(U-볼트가 1번 링크를 꿰고 있으므로 따로 떨어지지 않는다).
     이중체결이면 2번 링크가 팽팽해진 와이어(셰이프 키 Taut)에 걸리고 이탈 덩어리는 2번 링크에 매달려 옆으로 넘어간다.
     미설치면 이탈 덩어리가 체인 끝에 달린 채 함께 추락해 더미 맨 위에 얹힌다.
   - 성능: 2본 약 700링크 전체를 단일 THREE.InstancedMesh(드로우콜 +1회)로 렌더링하며 렌더 루프 내 생성 0. */
const CompChain = (() => {
  const SPEC = Object.freeze({
    contractVersion: 2,
    chainXOffset: 0.34,       // GLB extras.chainXOffset 와 대조
    carBeamZLocal: -0.78,     // 카 중심 기준 후방 (-0.253 - 0.78 = -1.033m, 플랭크·장죽·피트스크린 간섭 없음)
    loopBottomY: 0.095,       // 피트 마감 바닥(+0.020) 위 +75mm, 피트 스크린 하단 아래 통과
    cwtBeamInset: 0.004,      // counterweight.py Bottom beam 깊이 = CWT_D - 0.004 (GLB extras.cwtBeamD 와 대조)
    // environment.js buildGuideRails() 균형추 레일 지지 채널(폭 CWT_W+0.3 · 높이 chH 0.1 · 깊이 0.2)과 동기 — 추락 체인이 얹히는 면
    cwtRailBaseTop: 0.10,
    cwtRailBaseHalfD: 0.10,
    cwtRailBaseExtraW: 0.30,
    dropTime: 0.12,           // 파단 → 2번 링크가 와이어에 걸릴 때까지(약 66mm 자유낙하)
    hangLean: 0.62            // 매달린 이탈 덩어리가 체인에 기대는 각(연직에서, rad)
  });

  let ready = false;
  let rootGrp = null;
  let carBeam = null;
  let instMesh = null;
  let spec = null;
  let totalLen = 0;
  let linksNominal = 0;       // 정상 체인 링크 수 N0 (전 행정 일정)
  let linksPerStrand = 0;
  let twistTotal = 0;         // N0 짝수일 때 양끝 1번 링크를 모두 YZ 면에 맞추는 전체 비틀림
  let pitTopY = 0.02;
  let carBeamBotYLocal = -1.3375;
  let cwtBeamBotYLocal = -0.80;

  // 4개 체결 어셈블리: carL, carR, cwtL, cwtR
  const hitches = { carL: null, carR: null, cwtL: null, cwtR: null };
  // 균형추 우측(cwtR) 파단 시 이탈 덩어리: 브라켓 + U-볼트 + 1번 링크 (world 행렬 직접 지정)
  let brokenGrp = null;
  let brokenLink = null;
  // 클릭/발광 히트 영역용 경량 프록시
  let cwtGlowTarget = null;
  let carGlowTarget = null;

  // 시연/상태 제어
  let dualProtection = true;
  const sim = {
    mode: 'normal',       // 'normal' | 'stress' | 'caught' | 'falling'
    time: 0,              // 현재 단계 경과 시간(초)
    stressAmt: 0,         // 0~1 응력 진동 및 발광 강도
    highlightWire: false  // 이중체결 지지 시 안전 와이어로프 강조
  };

  // 임시 수학 객체 (렌더 루프 메모리 할당 방지)
  const _m = new THREE.Matrix4();
  const _m2 = new THREE.Matrix4();
  const _invL = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _qFlip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const _qDown = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  const _qSpin = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3(1, 1, 1);
  const _t = new THREE.Vector3();
  const _v = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _yAxis = new THREE.Vector3(0, 1, 0);
  const _zAxis = new THREE.Vector3(0, 0, 1);
  const _box = new THREE.Box3();
  const _zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
  const _endMat = new THREE.Matrix4();   // 우측 본 균형추측 끝 링크 행렬(추락 시 이탈 덩어리 추종)

  // 원본 재질 캐시 (응력/안전 강조 후 정확히 복원)
  const savedMats = new Map();

  // GLB 노드는 `_Cwt`/`_Car` 접미어가 붙는다(Blender 고유 이름) — 접두어로 찾는다.
  const part = (grp, base) => grp.children.find(c => c.name.startsWith(base)) || null;

  function cloneHitch(template, parent, x, y, z, name, side, endKind) {
    const grp = template.clone(true);
    grp.name = name;
    grp.position.set(x, y, z);
    grp.scale.x = side;   // 좌측은 거울상 — 와이어 꼬리·클립이 바깥쪽에 온다
    grp.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      // 재질 독립화: 시연 중 우측 균형추 체결부만 응력·안전 강조할 수 있도록 복제
      if (endKind === 'cwt' && side > 0 && o.material) {
        o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
      }
    });
    const safetyWire = part(grp, 'SafetyWire');
    const wireMeshes = [];
    // 모프 타깃 메시가 그림자를 드리우면 그림자 캐시(environment.js installShadowCache)가 매 프레임 그림자를 다시 그린다.
    // Ø8.4 와이어·클립 그림자는 거의 보이지 않으므로 그림자만 끈다(받는 그림자는 유지).
    safetyWire?.traverse(o => { if (o.isMesh && o.morphTargetInfluences) { wireMeshes.push(o); o.castShadow = false; } });
    parent.add(grp);
    return {
      root: grp,
      mountPlate: part(grp, 'MountPlate'),
      breakBracket: part(grp, 'BreakBracket'),
      wireSleeves: part(grp, 'WireSleeves'),
      safetyWire,
      wireMeshes,
      side,
      endKind,
      restPos: new THREE.Vector3(),
      restRot: new THREE.Euler()
    };
  }

  function setWireTaut(h, k) {
    for (const o of h.wireMeshes) o.morphTargetInfluences[0] = k;
  }

  function rememberMatEmissive(obj) {
    if (!obj) return;
    obj.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!savedMats.has(m)) {
          savedMats.set(m, {
            emissive: m.emissive ? m.emissive.clone() : null,
            emissiveIntensity: m.emissiveIntensity || 0
          });
        }
      }
    });
  }

  function setEmissiveTint(obj, hex, intensity) {
    if (!obj) return;
    obj.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m.emissive) continue;
        if (intensity > 0) {
          m.emissive.setHex(hex);
          m.emissiveIntensity = intensity;
        } else {
          const orig = savedMats.get(m);
          if (orig && orig.emissive) {
            m.emissive.copy(orig.emissive);
            m.emissiveIntensity = orig.emissiveIntensity;
          } else {
            m.emissive.setHex(0x000000);
            m.emissiveIntensity = 0;
          }
        }
      }
    });
  }

  function build() {
    if (rootGrp) return;
    rootGrp = new THREE.Group();
    rootGrp.name = 'compChainGrp';
    scene.add(rootGrp);

    pitTopY = Y0 + 0.02;
    cwtBeamBotYLocal = -S.CWT_H / 2;

    const pf = carGrp.getObjectByName('carPlatform');
    const pfBotY = pf?.userData?.bottomY ?? (-S.CAR_H / 2 - 0.08);

    new THREE.GLTFLoader().load('models/gltf/comp_chain_hitch.glb', gltf => {
      const glbRoot = gltf.scene.getObjectByName('CompChainRoot');
      const extras = glbRoot?.userData || {};
      if (extras.contractVersion !== SPEC.contractVersion || Math.abs((extras.chainXOffset ?? 0) - SPEC.chainXOffset) > 1e-4 ||
          Math.abs((extras.cwtBeamD ?? 0) - (S.CWT_D - SPEC.cwtBeamInset)) > 1e-6) {
        console.error('[CompChain] 치수 계약 불일치: comp_chain_hitch.py를 다시 내보내세요.', extras);
        return;
      }
      spec = extras;
      carBeamBotYLocal = pfBotY - spec.carBeamH;

      // 1. 카 하부 보상체인 전용 횡빔 장착 (플랫폼 종통 보강 채널 하면에 볼트 체결)
      const beamTpl = glbRoot.getObjectByName('CarCrossBeam');
      if (beamTpl) {
        carBeam = beamTpl.clone(true);
        carBeam.name = 'compChainCarBeam';
        carBeam.position.set(0, pfBotY, SPEC.carBeamZLocal);
        carBeam.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        carGrp.add(carBeam);
      }

      // 2. 체인 링크 형상
      let linkMesh = null;
      glbRoot.getObjectByName('ChainLinkUnit')?.traverse(o => { if (o.isMesh && !linkMesh) linkMesh = o; });

      // 3. 체결부 4개소 장착 (카 하부 좌/우 + 균형추 하부 좌/우)
      const carTpl = glbRoot.getObjectByName('HitchAssembly_Car');
      const cwtTpl = glbRoot.getObjectByName('HitchAssembly_Cwt');
      if (carTpl && cwtTpl) {
        const cx = spec.chainXOffset;
        hitches.carL = cloneHitch(carTpl, carGrp, -cx, carBeamBotYLocal, SPEC.carBeamZLocal, 'compChainCarHitch_L', -1, 'car');
        hitches.carR = cloneHitch(carTpl, carGrp, +cx, carBeamBotYLocal, SPEC.carBeamZLocal, 'compChainCarHitch_R', +1, 'car');
        hitches.cwtL = cloneHitch(cwtTpl, cwtGrp, -cx, cwtBeamBotYLocal, 0, 'compChainCwtHitch_L', -1, 'cwt');
        hitches.cwtR = cloneHitch(cwtTpl, cwtGrp, +cx, cwtBeamBotYLocal, 0, 'compChainCwtHitch_R', +1, 'cwt');

        const hR = hitches.cwtR;
        hR.restPos.copy(hR.breakBracket.position);
        hR.restRot.copy(hR.breakBracket.rotation);
        rememberMatEmissive(hR.breakBracket);
        rememberMatEmissive(hR.safetyWire);

        // 이탈 덩어리 = 브라켓 복제 + 1번 링크 (체결부 로컬 좌표 그대로, 그룹 행렬로 통째 이동)
        brokenGrp = new THREE.Group();
        brokenGrp.name = 'compChainBrokenHitch';
        brokenGrp.matrixAutoUpdate = false;
        brokenGrp.visible = false;
        brokenGrp.add(hR.breakBracket.clone(true));
        if (linkMesh) {
          brokenLink = new THREE.Mesh(linkMesh.geometry, linkMesh.material);
          brokenLink.name = 'compChainBrokenLink1';
          brokenLink.position.set(0, spec.link1Y, 0);
          brokenLink.quaternion.copy(_qFlip);   // U-볼트 바닥 봉에 걸린 YZ 면
          brokenLink.castShadow = true;
          brokenGrp.add(brokenLink);
        }
        rootGrp.add(brokenGrp);
        _invL.compose(_v.set(0, spec.link1Y, 0), _qFlip, _s).invert();

        cwtGlowTarget = hR.root;
        carGlowTarget = hitches.carR.root;
      }

      // 4. 체인 총 길이 역산 (카 1층 정위치 + 균형추 최상층 기준). 카·균형추가 1:1로 반대 이동하므로
      //    U-루프 중심 높이는 전 행정 일정하고 링크 수 N0 도 변하지 않는다.
      const carY0 = (FLOOR_Y[0] + S.CAR_H / 2) + carBeamBotYLocal + spec.link1Y;
      const carTravel = FLOOR_Y[FLOORS - 1] - FLOOR_Y[0];
      const cwtTopStartY = Y0 + counterweightBottomHeight() + S.CWT_H / 2 + carTravel;
      const cwtY0 = cwtTopStartY + cwtBeamBotYLocal + spec.link1Y;
      const R = (CAR_CTR_Z + SPEC.carBeamZLocal - CWT_CENTER_Z) / 2;
      const yc0 = Y0 + SPEC.loopBottomY + R;
      totalLen = (carY0 - yc0) + Math.PI * R + (cwtY0 - yc0);
      linksNominal = Math.round(totalLen / spec.linkPitch) + 1;
      linksPerStrand = linksNominal;
      // 1번 링크(i=0, N0-1)는 YZ 면이어야 U-볼트에 걸린다. 홀짝 교차로 안 맞는 끝은 전 길이에 걸친 90° 비틀림으로 맞춘다.
      twistTotal = linksNominal % 2 === 0 ? Math.PI / 2 : 0;

      // 5. 단일 InstancedMesh 생성 (좌·우 2본 전체 = 드로우콜 +1회)
      if (linkMesh) {
        instMesh = new THREE.InstancedMesh(linkMesh.geometry.clone(), linkMesh.material.clone(), linksPerStrand * 2);
        instMesh.name = 'compChainLinks';
        instMesh.castShadow = true;
        instMesh.receiveShadow = true;
        instMesh.frustumCulled = false;
        instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        rootGrp.add(instMesh);
      }

      ready = true;
      setDualProtection(dualProtection);
      refresh();
    }, undefined, err => console.error('[comp_chain_hitch.glb] 로드 실패:', err));
  }

  function setDualProtection(on) {
    dualProtection = !!on;
    for (const h of Object.values(hitches)) {
      if (!h) continue;
      if (h.safetyWire) h.safetyWire.visible = dualProtection;
      if (h.wireSleeves) h.wireSleeves.visible = dualProtection;
      setWireTaut(h, 0);
    }
  }

  // 정상 U-곡선 위의 호 길이 s(0 = 카 하부 체결점 → len = 균형추 하부 체결점) 위치·접선
  function sampleNormalU(s, yCar, zCar, zCwt, yc, R, outPos, outTan) {
    const straightCar = Math.max(0.01, yCar - yc);
    const arcLen = Math.PI * R;
    const zMid = (zCar + zCwt) / 2;
    if (s <= straightCar) {
      outPos.set(0, yCar - s, zCar);
      outTan.set(0, -1, 0);
    } else if (s <= straightCar + arcLen) {
      const phi = (s - straightCar) / R; // 0(카측 +R) → π(균형추측 -R)
      outPos.set(0, yc - R * Math.sin(phi), zMid + R * Math.cos(phi));
      outTan.set(0, -Math.cos(phi), -Math.sin(phi));
    } else {
      outPos.set(0, yc + (s - straightCar - arcLen), zCwt);
      outTan.set(0, 1, 0);
    }
  }

  // 추락 체인이 얹히는 면: 균형추 레일 지지 채널 윗면 또는 피트 마감 바닥
  function supportY(x, z) {
    const onBase = Math.abs(z - CWT_CENTER_Z) <= SPEC.cwtRailBaseHalfD && Math.abs(x) <= (S.CWT_W + SPEC.cwtRailBaseExtraW) / 2;
    return onBase ? Y0 + SPEC.cwtRailBaseTop : pitTopY;
  }

  // 사고(미설치) 자유 낙하 곡선:
  // s=0(카 하부 고정)은 유지되고, s=len(이탈한 균형추측 끝)이 중력으로 추락하며
  // 바닥(레일 지지 채널 윗면 또는 피트 바닥)에 닿은 링크는 채널 위와 뒤쪽 바닥에 쇠사슬 더미로 쌓인다.
  function sampleFallingStrand(s, idx, step, yCar, zCar, zCwt, yc0, R, t, xBase, outPos, outTan) {
    const g = 13.5; // 교육용 체감 중력가속도 (1.4초 이내 12m 전 구간 착지)
    const rest = 0.008; // 눕거나 선 링크 반두께 평균
    const straightCar0 = Math.max(0.01, yCar - yc0);
    const arcLen = Math.PI * R;
    const dropStartS = straightCar0 + arcLen; // 균형추측 수직 구간 시작

    // 1. 카측 직선 + 하부 루프는 떨어지기 시작하면서 바닥으로 주저앉음
    const settle = Math.min(1, t / 0.50);
    const settleEase = settle * settle * (3 - 2 * settle);
    if (s <= dropStartS) {
      sampleNormalU(s, yCar, zCar, zCwt, yc0, R, outPos, outTan);
      outPos.x = xBase;
      if (s > straightCar0) {
        // 카측 절반은 카에 매달린 채 바닥으로 늘어지고, 균형추측 절반은 끝이 풀렸으므로 통째로 바닥에 눕는다
        const floor = supportY(outPos.x, outPos.z) + rest;
        const phi = (s - straightCar0) / R;
        const k = (phi < Math.PI / 2 ? Math.sin(phi) : 1) * settleEase;
        outPos.y = Math.max(floor, outPos.y - (outPos.y - floor) * k);
        outTan.set(0, outTan.y * (1 - k), outTan.z - 0.5 * k);
      }
      return;
    }

    // 2. 균형추측 수직 구간(11m+): 상단 끝이 풀리면서 중력으로 추락
    const h0 = yc0 + (s - dropStartS);
    const fracFromTop = Math.max(0, Math.min(1, (totalLen - s) / Math.max(1, totalLen - dropStartS)));
    const tLocal = Math.max(0, t - fracFromTop * 0.12);
    const yFree = h0 - 0.5 * g * tLocal * tLocal;

    const fallProgress = Math.max(0, Math.min(1, (h0 - Math.max(pitTopY, yFree)) / Math.max(0.5, h0 - pitTopY)));
    const whipAmp = Math.sin(fallProgress * Math.PI) * (0.14 + 0.18 * (1 - fracFromTop));
    // 앞쪽은 피트 스크린(균형추 +0.15) 뒤에, 뒤쪽은 승강로 뒷벽 앞에 머문다
    const whipZ = Math.max(-0.40, Math.min(0.08, Math.sin(idx * 0.09 - t * 9.5) * whipAmp - 0.06 * Math.sin(fallProgress * Math.PI)));
    const whipX = Math.cos(idx * 0.07 - t * 8.2) * whipAmp * 0.55;
    const fx = xBase + whipX, fz = zCwt + whipZ;

    if (yFree > supportY(fx, fz) + rest + 0.01) {
      outPos.set(fx, yFree, fz);
      outTan.set(whipX * 0.6, 1, whipZ * 0.8).normalize();
    } else {
      // 레일 지지 채널 위에서 뒤쪽 바닥으로 흘러내린 쇠사슬 더미
      const pileIdx = Math.max(0, idx - Math.floor(dropStartS / step));
      const layer = Math.floor(pileIdx / 38);
      const ang = pileIdx * 0.44;
      const rad = 0.045 + (pileIdx % 38) * 0.0040;
      const px = xBase + 0.03 + Math.cos(ang) * rad;
      const pz = Math.max(SHAFT_BACK_Z + 0.06, Math.min(zCwt + 0.09, zCwt - 0.16 + Math.sin(ang) * rad * 0.9));
      const py = supportY(px, pz) + rest + Math.min(0.11, layer * 0.014 + (pileIdx % 3) * 0.003);
      outPos.set(px, py, pz);
      outTan.set(-Math.sin(ang), 0.12, Math.cos(ang)).normalize();
    }
  }

  // 체결부 로컬 원점의 world 행렬 (우측 균형추 체결부는 거울상 아님)
  function hitchWorld(h, out) {
    h.root.updateWorldMatrix(true, false);
    return out.copy(h.root.matrixWorld);
  }

  // 이중체결 지지 진행: 0→1 (2번 링크가 와이어에 걸림), 이후 작은 반동
  function caughtState(t) {
    const k = Math.min(1, t / SPEC.dropTime);
    const after = t - SPEC.dropTime;
    const bounce = after > 0 ? Math.exp(-after * 4.5) * Math.sin(after * 24) * 0.006 : 0;
    return { k: k * k, bounce };
  }

  function refresh() {
    if (!ready || !instMesh || !spec) return;
    const pitch = spec.linkPitch;
    const cx = spec.chainXOffset;
    const N0 = linksNominal;

    const yCar = carGrp.position.y + carBeamBotYLocal + spec.link1Y;
    const yCwtBase = cwtGrp.position.y + cwtBeamBotYLocal + spec.link1Y;
    const zCar = CAR_CTR_Z + SPEC.carBeamZLocal;
    const zCwt = CWT_CENTER_Z;
    const R = (zCar - zCwt) / 2;

    // 우측(side = +1) 균형추 체결부 시연 상태 적용
    const hR = hitches.cwtR;
    const caught = sim.mode === 'caught';
    const cs = caught ? caughtState(sim.time) : null;
    if (hR && hR.breakBracket) {
      if (sim.mode === 'normal' || sim.mode === 'stress') {
        hR.breakBracket.visible = true;
        if (brokenGrp) brokenGrp.visible = false;
        if (hR.safetyWire) hR.safetyWire.visible = dualProtection;
        setWireTaut(hR, 0);
        setEmissiveTint(hR.safetyWire, 0x000000, 0);
        if (sim.mode === 'normal') {
          hR.breakBracket.position.copy(hR.restPos);
          hR.breakBracket.rotation.copy(hR.restRot);
          setEmissiveTint(hR.breakBracket, 0x000000, 0);
        } else {
          const j = sim.stressAmt * 0.0035;
          const w = sim.time * 42;
          hR.breakBracket.position.set(
            hR.restPos.x + Math.sin(w) * j,
            hR.restPos.y - sim.stressAmt * 0.004,
            hR.restPos.z + Math.cos(w * 1.3) * j
          );
          hR.breakBracket.rotation.set(sim.stressAmt * 0.06, 0, Math.sin(w * 0.7) * sim.stressAmt * 0.08);
          const pulse = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(sim.time * 14));
          setEmissiveTint(hR.breakBracket, 0xff2b1a, sim.stressAmt * pulse);
        }
      } else {
        // 용접부 파단: 프레임에는 용접 패드만 남고 브라켓·U-볼트·1번 링크가 한 덩어리로 이탈
        hR.breakBracket.visible = false;
        setEmissiveTint(hR.breakBracket, 0x000000, 0);
        if (brokenGrp) brokenGrp.visible = true;
        if (brokenLink) brokenLink.visible = caught;   // 추락 시 1번 링크는 체인 끝에 그대로 있다
        if (caught) {
          if (hR.safetyWire) hR.safetyWire.visible = true;
          setWireTaut(hR, cs.k);
          const glow = sim.highlightWire ? (0.45 + 0.35 * Math.sin(sim.time * 6)) : 0;
          setEmissiveTint(hR.safetyWire, 0x22d3aa, glow);
        } else if (hR.safetyWire) {
          hR.safetyWire.visible = false;
        }
      }
    }

    // 두 본(좌 side=-1, 우 side=+1) 링크 행렬 갱신
    for (let strand = 0; strand < 2; strand++) {
      const side = strand === 0 ? -1 : 1;
      const xBase = side * cx;
      const isRight = side > 0;
      const baseIndex = strand * linksPerStrand;
      const falling = isRight && sim.mode === 'falling';
      const caughtStrand = isRight && caught;

      // 균형추측 끝 링크 중심 Y와 체인 길이(지지 상태에서는 1번 링크가 이탈 덩어리로 빠진다)
      let yCwt = yCwtBase;
      let len = totalLen;
      let count = N0;
      let swayAmp = 0;
      if (caughtStrand) {
        const a2 = spec.link2Y + (spec.link2CaughtYCwt - spec.link2Y) * cs.k + cs.bounce;
        yCwt = cwtGrp.position.y + cwtBeamBotYLocal + a2;
        len = totalLen - pitch;
        count = N0 - 1;
        swayAmp = Math.exp(-sim.time * 1.8) * Math.sin(sim.time * 14) * 0.018;
      } else if (isRight && sim.mode === 'stress') {
        yCwt = yCwtBase - sim.stressAmt * 0.004;
        swayAmp = sim.stressAmt * 0.005 * Math.sin(sim.time * 28);
      }

      let yc = (yCar + yCwt + Math.PI * R - len) / 2;
      yc = Math.max(pitTopY + R + 0.020, Math.min(yc, Math.min(yCar, yCwt) - 0.04));
      const actualLen = Math.max(0.01, yCar - yc) + Math.PI * R + Math.max(0.01, yCwt - yc);
      const step = actualLen / (count - 1);

      for (let i = 0; i < linksPerStrand; i++) {
        if (i >= count) {
          instMesh.setMatrixAt(baseIndex + i, _zeroMat);
          continue;
        }
        const s = i * step;
        if (falling) {
          sampleFallingStrand(s, i, step, yCar, zCar, zCwt, yc, R, sim.time, xBase, _p, _t);
        } else {
          sampleNormalU(Math.min(s, actualLen), yCar, zCar, zCwt, yc, R, _p, _t);
          _p.x = xBase;
          if (swayAmp) {
            const env = Math.sin(Math.min(1, s / actualLen) * Math.PI);
            _p.x += swayAmp * env;
            _p.z += swayAmp * 0.6 * env;
          }
        }
        _t.normalize();
        // 링크 장축(로컬 +Y)을 곡선 접선에 정렬, 양끝 1번 링크가 YZ 면이 되도록 홀짝 90° 교차 + 비틀림
        if (Math.abs(_t.y) > 0.9999) {
          if (_t.y < 0) _q.copy(_qDown); else _q.identity();
        } else {
          _q.setFromUnitVectors(_up, _t);
        }
        if (!(i & 1)) _q.multiply(_qFlip);
        if (twistTotal) {
          _qSpin.setFromAxisAngle(_yAxis, twistTotal * i / (N0 - 1));
          _q.multiply(_qSpin);
        }
        if (falling && _p.y < pitTopY + 0.20) {
          _qSpin.setFromAxisAngle(_yAxis, (i % 7) * 0.45);
          _q.multiply(_qSpin);
        }
        _m.compose(_p, _q, _s);
        instMesh.setMatrixAt(baseIndex + i, _m);
        if (isRight && i === count - 1) _endMat.copy(_m);
      }
    }
    instMesh.instanceMatrix.needsUpdate = true;

    // 이탈 덩어리 배치
    if (brokenGrp && brokenGrp.visible && hR) {
      if (caught) {
        // 2번 링크 윗 굽힘부(=1번 링크 아랫 굽힘부)를 축으로 +X 쪽으로 넘어가 체인에 기대어 매달린다
        const a2 = spec.link2Y + (spec.link2CaughtYCwt - spec.link2Y) * cs.k + cs.bounce;
        const pivotRest = spec.link1Y - spec.linkBendC;
        const pivotNow = a2 + pitch - spec.linkBendC;
        const tt = sim.time;
        const swing = tt < 0.42 ? (tt / 0.42) * (tt / 0.42)
          : 1 + Math.exp(-(tt - 0.42) * 3.2) * Math.sin((tt - 0.42) * 10) * 0.10;
        const theta = -(Math.PI - SPEC.hangLean) * swing;
        hitchWorld(hR, brokenGrp.matrix);
        brokenGrp.matrix.multiply(_m2.makeTranslation(0, pivotNow, 0));
        brokenGrp.matrix.multiply(_m2.makeRotationAxis(_zAxis, theta));
        brokenGrp.matrix.multiply(_m2.makeTranslation(0, -pivotRest, 0));
      } else {
        // 미설치: 체인 끝 1번 링크에 U-볼트로 꿰인 채 함께 추락 → 더미 맨 위
        brokenGrp.matrix.multiplyMatrices(_endMat, _invL);
        if (_endMat.elements[13] < pitTopY + 0.30) {
          // 더미 위에 눕힐 때 바닥·채널을 뚫지 않도록 띄운다
          brokenGrp.matrixWorldNeedsUpdate = true;
          brokenGrp.updateMatrixWorld(true);
          _box.setFromObject(brokenGrp);
          const floor = supportY(_endMat.elements[12], _endMat.elements[14]) + 0.002;
          if (_box.min.y < floor) brokenGrp.matrix.elements[13] += floor - _box.min.y;
        }
      }
      brokenGrp.matrixWorldNeedsUpdate = true;
    }
  }

  function setSim(patch) {
    Object.assign(sim, patch);
    refresh();
  }

  function resetSim() {
    Object.assign(sim, { mode: 'normal', time: 0, stressAmt: 0, highlightWire: false });
    setDualProtection(true);
    refresh();
  }

  // 측정·검증용 좌표 진단 정보
  function diagnostics() {
    if (!ready || !spec) return { ready: false };
    const yCar = carGrp.position.y + carBeamBotYLocal + spec.link1Y;
    const yCwt = cwtGrp.position.y + cwtBeamBotYLocal + spec.link1Y;
    const zCar = CAR_CTR_Z + SPEC.carBeamZLocal;
    const zCwt = CWT_CENTER_Z;
    const R = (zCar - zCwt) / 2;
    const zMid = (zCar + zCwt) / 2;
    let yc = (yCar + yCwt + Math.PI * R - totalLen) / 2;
    yc = Math.max(pitTopY + R + 0.020, Math.min(yc, Math.min(yCar, yCwt) - 0.04));
    const loopBottom = yc - R;
    const screen = scene.getObjectByName('pitScreenAssembly')?.userData?.spec;
    const zScreen = CWT_CENTER_Z + (screen?.frontOffset ?? 0.15);
    const screenBotY = Y0 + (screen?.floorGap ?? 0.20);
    const dzScreen = zScreen - zMid;
    const yAtScreen = Math.abs(dzScreen) < R ? yc - Math.sqrt(R * R - dzScreen * dzScreen) : Infinity;
    return {
      ready: true,
      dualProtection,
      simMode: sim.mode,
      linksPerStrand,
      linksNominal,
      twistTotal,
      totalInstances: instMesh ? instMesh.count : 0,
      yCar, yCwt, zCar, zCwt, R, yc,
      loopBottom,
      pitFloorClearance: loopBottom - pitTopY - spec.linkOuterW / 2,
      yAtScreen,
      pitScreenClearance: screenBotY - (yAtScreen + spec.linkOuterW / 2),
      hitchesReady: Object.values(hitches).every(Boolean)
    };
  }

  return {
    spec: SPEC,
    build,
    refresh,
    setDualProtection,
    setSim,
    resetSim,
    diagnostics,
    get ready() { return ready; },
    get glb() { return spec; },
    get root() { return rootGrp; },
    get hitches() { return hitches; },
    get brokenHitch() { return brokenGrp; },
    get glowTargets() {
      return [cwtGlowTarget, carGlowTarget, carBeam].filter(Boolean);
    },
    get cwtGlowTarget() { return cwtGlowTarget; },
    get carGlowTarget() { return carGlowTarget; },
    get dualProtection() { return dualProtection; }
  };
})();
