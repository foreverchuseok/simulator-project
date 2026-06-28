// 엘리베이터 카, 도어, 균형추, 로프 등 동적 객체 생성 함수를 정의한다.
    function buildCarCabin() {
      carGrp = new THREE.Group();
      const W = S.CAR_W, D = S.CAR_D, H = S.CAR_H;
      const extMat = M.ss(0xa8aeb5);
      const intMat = M.ss(0xe5e7eb);

      createBox(0.025, H, D, extMat, -W / 2, 0, 0, carGrp);
      createBox(0.025, H, D, extMat, W / 2, 0, 0, carGrp);
      createBox(W + 0.05, H, 0.025, extMat, 0, 0, -D / 2, carGrp);
      createBox(W + 0.05, 0.05, D + 0.05, extMat, 0, H / 2 + 0.025, 0, carGrp);

      // 후면 거울
      const mirMat = M.ss(0xf3f4f6); mirMat.roughness = 0.0; mirMat.metalness = 1.0;
      createBox(W - 0.06, H - 0.05, 0.01, mirMat, 0, 0, -D / 2 + 0.03, carGrp);
      createBox(W - 0.02, 0.07, D - 0.02, M.marble(), 0, -H / 2 + 0.035, 0, carGrp); // 바닥

      // 골드 핸드레일
      const gMat = M.gold();
      const hr = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, W * 0.72, 14), gMat);
      hr.rotation.z = Math.PI / 2; hr.position.set(0, -0.32, -D / 2 + 0.075); carGrp.add(hr);

      // 크로스헤드 & 서스펜션 쉬브
      createBox(W + 0.1, 0.12, 0.16, M.ss(0x2a3a50), 0, H / 2 + 0.06, 0, carGrp);
      const susp = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 10, 28), M.ss(0x2a3a50));
      susp.position.set(0, H / 2 + 0.28, 0); carGrp.add(susp);

      // 조작반 (OPB)
      createBox(0.12, 0.55, 0.015, M.paint(0x111827), W / 2 - 0.04, -0.15, D / 2 - 0.03, carGrp);

      // === 카 측 센서 모듈 ===
      const carSensorGrp = new THREE.Group();

      // 승강로 센서 기준 좌표 (buildShaftLandingDevices 동일)
      const rSensorX   = S.CAR_BG / 2 + 0.18;         // +1.155
      const lSensorX   = -(S.CAR_BG / 2 + 0.18);      // -1.155
      const cSensorZ   = 0.10;
      const rWallOuter = W / 2 + 0.0125;               // +0.9125 (카 우측벽 외면)
      const lWallOuter = -(W / 2 + 0.0125);            // -0.9125 (카 좌측벽 외면)

      /* ──────────────────────────────────────────────────────────────
         1. 우측 Landing Vane — 레일 ㄷ자 센서 Y갭을 수직 관통하는 차폐판
            vaneX = rSensorX + aLen/2 = 1.155 + 0.04 = 1.195 (ㄷ 암 중간)
      ────────────────────────────────────────────────────────────── */
      const vaneX = rSensorX + 0.04;
      const bktLR = vaneX - rWallOuter;                // 0.2825 m

      const bktR  = createBox(bktLR, 0.018, 0.018, M.ss(0x5a6575),
        rWallOuter + bktLR / 2, 0, cSensorZ, carSensorGrp);
      bktR.userData = { type: 'car-vane-bracket' };

      const vane  = createBox(0.006, 0.10, 0.050, M.ss(0x9ca3af),
        vaneX, 0, cSensorZ, carSensorGrp);
      vane.userData = { type: 'car-vane' };
      if (DEBUG_SENSOR) carSensorGrp.add(new THREE.BoxHelper(vane, 0x00ff44));
      carSensors.landingVane = vane;

      /* ──────────────────────────────────────────────────────────────
         2. 좌측 수직 캠 막대 (buildLimitSwitches 롤러 타격용)
            롤러 중심 X = lSensorX + rLocX(0.075) = -1.080
            롤러 +X 끝   = -1.065  →  캠 좌면 ≈ -1.070 (약 5mm 간극)
            캠 중심 X    = lSensorX + 0.095 = -1.060
      ────────────────────────────────────────────────────────────── */
      const camX      = lSensorX + 0.095;              // -1.060
      const camRFace  = camX + 0.010;                  // -1.020 (캠 우면, 20mm 폭)
      const camArmLen = lWallOuter - camRFace;          // 0.1075m
      const camArmCx  = (lWallOuter + camRFace) / 2;   // -0.966
      const camH      = H * 0.85;                      // 2.125m (거의 전체 카 높이)

      // 상/하단 마운팅 암 (카 좌측벽 ↔ 캠, 2개)
      [camH / 2 - 0.08, -(camH / 2 - 0.08)].forEach(y => {
        createBox(camArmLen, 0.012, 0.012, M.ss(0x5a6575),
          camArmCx, y, cSensorZ, carSensorGrp)
          .userData = { type: 'cam-bracket' };
      });

      // 수직 캠 막대 (스테인리스, 롤러 접촉면)
      const camBar = createBox(0.020, camH, 0.035, M.ss(0xc0c8d8),
        camX, 0, cSensorZ, carSensorGrp);
      camBar.userData = { type: 'car-cam' };
      carSensors.cam = camBar;

      if (DEBUG_SENSOR) {
        // 캠 전체 바운딩박스 (형광 주황)
        carSensorGrp.add(new THREE.BoxHelper(camBar, 0xff8800));
        // 캠 기하 중심(롤러 도킹 높이 비교 기준)
        const camAx = new THREE.AxesHelper(0.1);
        camAx.position.set(camX, 0, cSensorZ);
        carSensorGrp.add(camAx);
        // 캠 접촉면 구형 헬퍼 3개 (형광 녹색, 롤러 맞물림 확인용)
        const sGeo = new THREE.SphereGeometry(0.007, 8, 6);
        const sMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });
        [-camH / 3, 0, camH / 3].forEach(y => {
          const s = new THREE.Mesh(sGeo, sMat);
          s.position.set(camX - 0.010, y, cSensorZ);
          carSensorGrp.add(s);
        });
      }

      carGrp.add(carSensorGrp);

      /* ──────────────────────────────────────────────────────────────
         [수정] 카 상/하부 가이드 롤러 어셈블리 (High-Detail 3-Roller Guide Shoe)
      ────────────────────────────────────────────────────────────── */
      // 1. 하부 체대 (Safety Plank) 빔 추가
      createBox(W + 0.1, 0.12, 0.16, M.ss(0x2a3a50), 0, -H / 2 - 0.06, 0, carGrp);

      const rollerGuideGrp = new THREE.Group();

      const rMat = M.paint(0x1a1a1a); // 우레탄 롤러 (무광 블랙)
      const bMat = M.paint(0x3a4a5a); // 짙은 스틸 블루 브라켓 (기계 느낌)
      const axMat = M.ss(0xb0b5bb);   // 금속 축 및 로드 (은색)
      const spMat = M.paint(0xf1c40f); // 텐션 스프링 (아연 도금 옐로우)

      const railX = S.CAR_BG / 2;     // 0.975 (레일 중심 X)
      const railZ = 0.04;             // 레일 웹 중심 Z

      // 개별 가이드 슈 생성 함수 (방향이 바뀐 레일에 완벽 도킹)
      function createGuideShoe(xSign, isTop) {
        const shoe = new THREE.Group();
        const rX = railX * xSign;     // 레일 중심 X 좌표 (±0.975)

        // ① 베이스 플레이트
        createBox(0.20, 0.02, 0.26, bMat, rX - (0.05 * xSign), 0, railZ, shoe);

        // ② 메인 롤러 (레일 웹 끝단 X축 면에 수직으로 접촉)
        // 레일 웹 끝단 X = 레일중심(±0.975) ∓ 절반(0.041)
        const mR = 0.060, mT = 0.026;
        const mX = rX - (0.041 + mR) * xSign; // 웹 끝단과 맞물림
        const mY = 0.065;

        const mRoller = new THREE.Mesh(new THREE.CylinderGeometry(mR, mR, mT, 24), rMat);
        // Z축을 중심축으로 위아래로 구름
        mRoller.rotation.x = Math.PI / 2;
        mRoller.position.set(mX, mY, railZ);
        shoe.add(mRoller);

        // 메인 롤러 지지 브라켓
        createBox(0.05, 0.07, mT + 0.02, bMat, mX + (0.02 * xSign), 0.035, railZ, shoe);
        createCylinder(0.008, 0.008, mT + 0.03, axMat, mX, mY, railZ, shoe).rotation.x = Math.PI / 2;

        // ③ 사이드 롤러 2개 (레일 웹 좌우 Z면 측면에 접촉)
        const sR = 0.050, sT = 0.020;
        const sY = 0.055;
        const sX = rX - (0.02 * xSign); // 레일 웹 중간 지점

        // 레일 웹 폭(0.034)을 고려한 앞뒤 타격점 Z
        const frontZ = railZ - 0.017 - sR;
        const backZ  = railZ + 0.017 + sR;

        [frontZ, backZ].forEach(rz => {
          const sRoller = new THREE.Mesh(new THREE.CylinderGeometry(sR, sR, sT, 24), rMat);
          // X축을 중심축으로 수직면을 따라 구름
          sRoller.rotation.z = Math.PI / 2;
          sRoller.position.set(sX, sY, rz);
          shoe.add(sRoller);

          // 피봇 암 (집게 형태)
          const offsetDir = Math.sign(rz - railZ);
          createBox(0.08, 0.08, 0.016, bMat, sX + (0.02 * xSign), 0.04, rz + offsetDir * 0.022, shoe);
          // 사이드 롤러 축
          createCylinder(0.006, 0.006, 0.05, axMat, sX, sY, rz + offsetDir * 0.01, shoe).rotation.z = Math.PI / 2;
        });

        // ④ 텐션 스프링 메커니즘
        const rodY = 0.075;
        // 레일 웹을 가로지르도록 X축 방향으로 로드 설치
        const rodX = rX - (0.02 * xSign);
        const rodLen = Math.abs(backZ - frontZ) + 0.06;

        createCylinder(0.004, 0.004, rodLen, axMat, rodX, rodY, railZ, shoe).rotation.x = Math.PI / 2;

        for (let i = 0; i < 7; i++) {
          const coil = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.003, 8, 16), spMat);
          coil.rotation.x = Math.PI / 2;
          coil.position.set(rodX, rodY, railZ + 0.015 + i * 0.012);
          shoe.add(coil);
        }

        shoe.position.set(0, isTop ? (H / 2 + 0.12 + 0.01) : (-H / 2 - 0.12 - 0.01), 0);
        if (!isTop) shoe.scale.y = -1;
        return shoe;
      }

      // 상/하, 좌/우 4세트의 고정밀 3롤러 장착
      rollerGuideGrp.add(
        createGuideShoe(1, true),   // 상단 우측
        createGuideShoe(-1, true),  // 상단 좌측
        createGuideShoe(1, false),  // 하단 우측
        createGuideShoe(-1, false)  // 하단 좌측
      );

      carGrp.add(rollerGuideGrp);

      carGrp.position.y = FLOOR_Y[0] + H / 2;
      scene.add(carGrp);
    }

    /* ==========================================================================
       [추가] 도어 안전 스티커 텍스처 (Canvas API로 픽토그램 자동 생성)
       ========================================================================== */
    let stickerMats = null;
    function getStickerMats() {
      if (stickerMats) return stickerMats;
      function make(type) {
        const c = document.createElement('canvas'); c.width = 128; c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,128,128); // 기본 배경

        if (type === 'L') {
          // [좌측] 손대지 마시오 픽토그램
          ctx.fillStyle = '#111'; ctx.fillRect(35,45,45,40); // 손바닥
          [25, 40, 55, 70].forEach((x, i) => ctx.fillRect(x, 25 + (i%2)*10, 12, 30)); // 손가락
          ctx.strokeStyle = '#e11d48'; ctx.lineWidth = 14; 
          ctx.beginPath(); ctx.moveTo(10,10); ctx.lineTo(118,118); ctx.stroke(); // 사선
        } else {
          // [우측] 기대면 추락위험 픽토그램
          ctx.fillStyle = '#facc15'; ctx.fillRect(64,0,64,128); // 우측 노란배경
          // 기대는 사람 (좌)
          ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(35,40,8,0,7); ctx.fill(); 
          ctx.fillRect(45,30,4,60); // 벽
          ctx.lineWidth = 6; ctx.strokeStyle = '#111';
          ctx.beginPath(); ctx.moveTo(35,48); ctx.lineTo(20,80); ctx.stroke();
          // 추락하는 사람 (우)
          ctx.beginPath(); ctx.arc(95,80,8,0,7); ctx.fill();
          ctx.beginPath(); ctx.moveTo(95,72); ctx.lineTo(80,30); ctx.stroke();
          // 사선 2개
          ctx.strokeStyle = '#e11d48'; ctx.lineWidth = 10;
          ctx.beginPath(); ctx.moveTo(5,5); ctx.lineTo(59,123); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(69,5); ctx.lineTo(123,123); ctx.stroke();
        }
        ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 8; ctx.strokeRect(0,0,128,128); // 테두리
        return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true });
      }
      stickerMats = { L: make('L'), R: make('R') };
      return stickerMats;
    }

    function buildCarDoors() {
      const dw = S.DOOR_W / 2 + 0.02, dh = S.DOOR_H * 0.9, dt = 0.04;
      const dz = S.CAR_D / 2 + dt / 2;
      const mats = getStickerMats();

      function makeDoor(xSign) {
        const g = new THREE.Group();
        createBox(dw, dh, dt, M.ss(0xa8aeb5), 0, 0, 0, g);
        createBox(dw * 0.55, dh * 0.26, dt + 0.005, M.glass(), 0, dh * 0.3, 0, g); 
        
        const isLeftFromInside = xSign > 0;
        const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), isLeftFromInside ? mats.L : mats.R);
        
        // [수정] 스티커 위치를 눈높이(+0.45) 및 중앙 분리대 쪽으로 이동
        const stickerX = -xSign * 0.18;
        sticker.position.set(stickerX, 0.45, -dt / 2 - 0.002); 
        sticker.rotation.y = Math.PI; 
        g.add(sticker);

        return g;
      }
      carDoorL = makeDoor(-1); carDoorR = makeDoor(1);

      const cx = dw / 2 + 0.006, ox = dw * 1.5 - 0.01;
      const dy = S.CAR_H / 2 - dh / 2 - 0.055;
      carDoorL.position.set(-cx, dy, dz); carDoorR.position.set(cx, dy, dz);
      carDoorL.userData = { cx: -cx, ox: -ox }; carDoorR.userData = { cx: cx, ox: ox };
      carGrp.add(carDoorL, carDoorR);
    }

    /**
     * 인디케이터 동기화: 전 층의 Canvas 텍스쳐를 실시간으로 업데이트
     */
    function syncAllIndicators(floorStr, dirStr) {
      indicators.forEach(ind => {
        const ctx = ind.ctx;
        // 블랙 베젤 배경
        ctx.fillStyle = '#0a0c0e';
        ctx.fillRect(0, 0, 256, 64);
        // 주황색 LED 텍스트 (방향 화살표 + 층수)
        ctx.fillStyle = '#f0883e';
        ctx.font = 'bold 36px "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = dirStr ? `${dirStr}   ${floorStr}` : `${floorStr}`;
        ctx.fillText(text, 128, 36);
        ind.texture.needsUpdate = true;
      });
    }

    function buildHatchDoors() {
      hatchDoors.forEach(h => { scene.remove(h.left); scene.remove(h.right); });
      hatchDoors = [];
      indicators = [];

      const dw = S.DOOR_W / 2 + 0.02, dh = S.DOOR_H * 0.9, dt = 0.04;
      const hz = S.SHAFT_D / 2 + S.WALL_T * 0.3 + dt / 2;
      const jambZ = S.SHAFT_D / 2 + S.WALL_T / 2 + 0.04;
      const cx = dw / 2 + 0.006, ox = dw * 1.5 - 0.01;
      const panMat = M.ss(0x868c94), jambMat = M.ss(0x989ea6);
      const mats = getStickerMats(); // 스티커 로드

      for (let i = 0; i < FLOORS; i++) {
        const fy = FLOOR_Y[i];
        const dy = fy + dh / 2 + 0.06;

        function makeHatchDoor(xSign) {
          const g = new THREE.Group();
          createBox(dw, dh, dt, panMat, 0, 0, 0, g);
          for (let s = -1; s <= 1; s++) {
            createBox(0.006, dh - 0.04, dt + 0.003, M.ss(0x7a8290), s * (dw * 0.25), 0, 0, g);
          }
          
          const isLeftFromLobby = xSign < 0;
          const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), isLeftFromLobby ? mats.L : mats.R);
          
          // [수정] 외부 도어 스티커 역시 눈높이 및 중앙 분리대 쪽으로 이동
          const stickerX = -xSign * 0.18;
          sticker.position.set(stickerX, 0.45, dt / 2 + 0.002); 
          g.add(sticker);

          return g;
        }

        const hl = makeHatchDoor(-1), hr = makeHatchDoor(1);
        hl.position.set(-cx, dy, hz); hr.position.set(cx, dy, hz);
        hl.userData = { cx: -cx, ox: -ox }; hr.userData = { cx: cx, ox: ox };
        hatchDoors.push({ left: hl, right: hr });
        scene.add(hl, hr);

        const jambW = 0.18;
        createBox(jambW, dh + 0.05, 0.06, jambMat, -(S.DOOR_W / 2 + jambW / 2 + 0.01), dy, jambZ, scene);
        createBox(jambW, dh + 0.05, 0.06, jambMat, (S.DOOR_W / 2 + jambW / 2 + 0.01), dy, jambZ, scene);
        const topW = S.DOOR_W + jambW * 2 + 0.02;
        createBox(topW, 0.06, 0.06, jambMat, 0, fy + dh + 0.09, jambZ, scene);

        const transH = 0.55;
        const transY = fy + dh + 0.09 + 0.03 + transH / 2;
        createBox(topW, transH, 0.055, jambMat, 0, transY, jambZ, scene);

        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const tex = new THREE.CanvasTexture(canvas);
        const ledMat = new THREE.MeshStandardMaterial({ color: 0x0a0c0e, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 2.5 });
        createBox(0.45, 0.12, 0.01, ledMat, 0, transY, jambZ + 0.03, scene);
        indicators.push({ ctx: ctx, texture: tex });
      }
      syncAllIndicators('1', '');
    }


    function buildCounterWeight() {
      cwtGrp = new THREE.Group();
      const fMat = M.ss(0x1f2937);
      createBox(S.CWT_W, S.CWT_H, 0.04, fMat, 0, 0, -S.CWT_D / 2 - 0.01, cwtGrp);
      createBox(S.CWT_W, S.CWT_H, 0.04, fMat, 0, 0, S.CWT_D / 2 + 0.01, cwtGrp);
      for (let i = 0; i < 20; i++) {
        createBox(S.CWT_W - 0.01, (S.CWT_H - 0.1) / 20 - 0.01, S.CWT_D - 0.02, M.paint(0x374151), 0, -S.CWT_H / 2 + 0.05 + (i + 0.5) * ((S.CWT_H - 0.1) / 20), 0, cwtGrp);
      }
      const shv = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 28), fMat);
      shv.rotation.y = Math.PI / 2; shv.position.y = S.CWT_H / 2 + 0.12; cwtGrp.add(shv);

      // 카가 1층일 때 균형추는 상부에 있어야 하며, 카가 4층까지 올라가도 피트 아래로 내려가지 않게 기준을 맞춤
      const cwtBottomClearance = 0.35;
      const carTravel = FLOOR_Y[FLOORS - 1] - FLOOR_Y[0];
      const cwtTopStartY = Y0 + cwtBottomClearance + S.CWT_H / 2 + carTravel;
      cwtGrp.position.set(0, cwtTopStartY, CWT_CENTER_Z);
      scene.add(cwtGrp);
    }

    function buildWireRopes() {
      const shvY = mrGrp.userData.shvY, defY = mrGrp.userData.defY, defZ = mrGrp.userData.defZ;
      const rMat = M.rope();
      // [수정] 3. 로프 5가닥 동기화
      for (let i = 0; i < 5; i++) {
        const rx = -0.04 + i * 0.02; // 메인 쉬브/보조 시브 홈과 동일한 간격
        const line = new THREE.Line(new THREE.BufferGeometry(), rMat);
        ropeObjs.push({ line: line, shvY: shvY, defY: defY, defZ: defZ, rx: rx });
        scene.add(line);
      }
    }

    function refreshRopes() {
      const cy = carGrp.position.y + S.CAR_H / 2 + 0.28;
      const wy = cwtGrp.position.y + S.CWT_H / 2 + 0.12;
      ropeObjs.forEach(r => {
        // [수정] 카 중앙 -> 메인 쉬브 -> 보조 시브(하향 조정) -> 균형추 로핑 궤적 동기화
        const pts = [
          new THREE.Vector3(r.rx, cy, 0),
          new THREE.Vector3(r.rx, r.shvY, 0),
          new THREE.Vector3(r.rx, r.defY, r.defZ),
          new THREE.Vector3(r.rx, wy, r.defZ),
        ];
        r.line.geometry.setFromPoints(pts);
      });
    }
