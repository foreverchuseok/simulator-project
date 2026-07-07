// 엘리베이터 카, 도어, 균형추, 로프 등 동적 객체 생성 함수를 정의한다.
    function buildCarCabin() {
      carGrp = new THREE.Group();
      const W = S.CAR_W, D = S.CAR_D, H = S.CAR_H;
      const extMat = M.ss(0xa8aeb5);
      const intMat = M.ss(0xe5e7eb);

      // 케이지 벽 4장 (좌/우/후/천장)
      createBox(0.025, H, D, extMat, -W / 2, 0, 0, carGrp);
      createBox(0.025, H, D, extMat, W / 2, 0, 0, carGrp);
      createBox(W + 0.05, H, 0.025, extMat, 0, 0, -D / 2, carGrp);
      createBox(W + 0.05, 0.05, D + 0.05, extMat, 0, H / 2 + 0.025, 0, carGrp);

      // 후면 거울
      const mirMat = M.ss(0xf3f4f6); mirMat.roughness = 0.0; mirMat.metalness = 1.0;
      createBox(W - 0.06, H - 0.05, 0.01, mirMat, 0, 0, -D / 2 + 0.03, carGrp);
      createBox(W - 0.02, 0.07, D - 0.02, M.marble(), 0, -H / 2 + 0.035, 0, carGrp); // 바닥

      // 골드 핸드레일 (카 내부)
      const gMat = M.gold();
      const hr = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, W * 0.72, 14), gMat);
      hr.rotation.z = Math.PI / 2; hr.position.set(0, -0.32, -D / 2 + 0.075); carGrp.add(hr);

      // 조작반 (OPB)
      createBox(0.12, 0.55, 0.015, M.paint(0x111827), W / 2 - 0.04, -0.15, D / 2 - 0.03, carGrp);

      // === 카 측 센서 모듈 ===
      const carSensorGrp = new THREE.Group();

      // 승강로 센서 기준 좌표 (buildShaftLandingDevices 동일)
      const rSensorX   = S.CAR_BG / 2 + 0.18;         // +1.055
      const lSensorX   = -(S.CAR_BG / 2 + 0.18);      // -1.055
      const cSensorZ   = 0.10;
      const rWallOuter = W / 2 + 0.0125;               // +0.8125 (카 우측벽 외면)
      const lWallOuter = -(W / 2 + 0.0125);            // -0.8125 (카 좌측벽 외면)

      /* ──────────────────────────────────────────────────────────────
         1. 우측 Landing Vane — 레일 ㄷ자 센서 Y갭을 수직 관통하는 차폐판
            vaneX = rSensorX + aLen/2 = 1.055 + 0.04 = 1.095 (ㄷ 암 중간)
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
            롤러 중심 X = lSensorX + rLocX(0.075) = -0.980
            롤러 +X 끝   = -0.965  →  캠 좌면 ≈ -0.970 (약 5mm 간극)
            캠 중심 X    = lSensorX + 0.095 = -0.960
      ────────────────────────────────────────────────────────────── */
      const camX      = lSensorX + 0.095;              // -0.960
      const camRFace  = camX + 0.010;                  // -0.950 (캠 우면, 20mm 폭)
      const camArmLen = lWallOuter - camRFace;          // 0.1375m
      const camArmCx  = (lWallOuter + camRFace) / 2;   // -0.881
      const camH      = H * 0.85;                      // 2.00m (거의 전체 카 높이)

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
         A. 카 프레임 (Car Frame) — PDF 11p
         carFrameGrp: Cross Head / Upright / Plank / Brace Rod /
                      Car Back Angle / Door Machine Base / Arm / 상부 안전난간
         Car Sheave 생략 — 본 시뮬레이터 1:1 직결(refreshRopes) 히치플레이트로 대체
      ────────────────────────────────────────────────────────────── */
      const carFrameGrp = new THREE.Group();
      const frmMat  = M.paint(0x1a2a44); // 프레임 강재 (PDF 11p 진한 네이비 일치)
      const silvMat = M.ss(0xb0b5bb);    // 은색 (볼트·클레비스·난간)

      // Cross Head: 채널빔 2본
      createBox(1.70, 0.12, 0.05, frmMat, 0, H / 2 + 0.06, -0.055, carFrameGrp);
      createBox(1.70, 0.12, 0.05, frmMat, 0, H / 2 + 0.06,  0.055, carFrameGrp);
      // Cross Head 양단 엔드플레이트
      createBox(0.03, 0.20, 0.16, frmMat, -0.85, H / 2 + 0.06, 0, carFrameGrp);
      createBox(0.03, 0.20, 0.16, frmMat,  0.85, H / 2 + 0.06, 0, carFrameGrp);
      // 히치플레이트 + 히치로드 5본 (refreshRopes rx=-0.04~+0.04와 동일 X축 정렬)
      createBox(0.24, 0.02, 0.16, M.paint(0xb8680a), 0, H / 2 + 0.13, 0, carFrameGrp);
      for (let i = 0; i < 5; i++) {
        const rx = -0.04 + i * 0.02;
        createCylinder(0.007, 0.007, 0.15, silvMat, rx, H / 2 + 0.205, 0, carFrameGrp);
      }

      // Arm: 크로스헤드 양단 ↔ 업라이트 상부 경사 보강재 2본
      const armL = createBox(0.07, 0.30, 0.05, frmMat, -0.83, H / 2 + 0.03, 0, carFrameGrp);
      armL.rotation.z = -0.5;
      const armR = createBox(0.07, 0.30, 0.05, frmMat,  0.83, H / 2 + 0.03, 0, carFrameGrp);
      armR.rotation.z =  0.5;

      // Upright: 좌우 ㄷ자 채널 (웹 + 플랜지 2장, 개구부 레일 반대측=내측)
      [-0.815, 0.815].forEach(ux => {
        const xs = ux > 0 ? 1 : -1;
        const fxc = ux - xs * 0.031; // 플랜지 X 중심 (웹 내면 기준 0.025 인셋)
        createBox(0.012, H + 0.24, 0.10, frmMat, ux,  0, 0.04, carFrameGrp); // 웹
        createBox(0.05,  H + 0.24, 0.012, frmMat, fxc, 0, 0.04 - 0.044, carFrameGrp); // 앞 플랜지
        createBox(0.05,  H + 0.24, 0.012, frmMat, fxc, 0, 0.04 + 0.044, carFrameGrp); // 뒤 플랜지
      });

      // Plank: 하부 채널빔 2본
      createBox(1.70, 0.12, 0.05, frmMat, 0, -H / 2 - 0.06, -0.055, carFrameGrp);
      createBox(1.70, 0.12, 0.05, frmMat, 0, -H / 2 - 0.06,  0.055, carFrameGrp);

      // Brace Rod: 4본 경사 로드 (플랫폼 모서리 → 업라이트 중단)
      const braceEnds = [
        [[ W/2-0.06, -H/2,  D/2-0.10], [ 0.815, -H/2+0.95, 0.04]],
        [[-W/2+0.06, -H/2,  D/2-0.10], [-0.815, -H/2+0.95, 0.04]],
        [[ W/2-0.06, -H/2, -D/2+0.10], [ 0.815, -H/2+0.95, 0.04]],
        [[-W/2+0.06, -H/2, -D/2+0.10], [-0.815, -H/2+0.95, 0.04]],
      ];
      braceEnds.forEach(([[x1,y1,z1],[x2,y2,z2]]) => {
        const dx=x2-x1, dy=y2-y1, dz=z2-z1;
        const len = Math.sqrt(dx*dx+dy*dy+dz*dz);
        const rod = createBox(0.04, len, 0.04, frmMat,
          (x1+x2)/2, (y1+y2)/2, (z1+z2)/2, carFrameGrp);
        rod.quaternion.setFromUnitVectors(
          new THREE.Vector3(0,1,0), new THREE.Vector3(dx,dy,dz).normalize());
        createBox(0.06, 0.06, 0.06, M.paint(0xb8860b), x1, y1, z1, carFrameGrp); // 하단 클레비스
        createBox(0.06, 0.06, 0.06, M.paint(0xb8860b), x2, y2, z2, carFrameGrp); // 상단 클레비스
      });

      // Car Back Angle: 후면 수평 앵글 2본
      createBox(W, 0.05, 0.03, frmMat, 0, -H / 2 + 0.55, -D / 2 - 0.03, carFrameGrp);
      createBox(W, 0.05, 0.03, frmMat, 0,  H / 2 - 0.55, -D / 2 - 0.03, carFrameGrp);

      // Door Machine Base: 전면 상부 황록색 채널 레일 (PDF 11p ⑥ 일치)
      const dmbMat = M.paint(0xc8c830);
      createBox(W + 0.10, 0.10, 0.15, dmbMat, 0, H / 2 + 0.065, D / 2 - 0.03, carFrameGrp);
      createBox(W + 0.10, 0.04, 0.012, dmbMat, 0, H / 2 + 0.015, D / 2 - 0.03, carFrameGrp);
      createBox(W + 0.10, 0.04, 0.012, dmbMat, 0, H / 2 + 0.120, D / 2 - 0.03, carFrameGrp);

      // Car Sheave: 크로스헤드 상부 회색 박스 하우징 (PDF 11p ⑨ — 장식용)
      const shvMat = M.ss(0x4a5568);
      createBox(0.25, 0.34, 0.22, shvMat, 0, H / 2 + 0.24, 0, carFrameGrp);
      createCylinder(0.022, 0.022, 0.012, M.ss(0x7a8899), -0.06, H / 2 + 0.13, 0.115, carFrameGrp);
      createCylinder(0.022, 0.022, 0.012, M.ss(0x7a8899), -0.06, H / 2 + 0.03, 0.115, carFrameGrp);
      createBox(0.25, 0.015, 0.012, M.paint(0xf1c40f), 0, H / 2 + 0.415, 0, carFrameGrp);

      // 상부 안전난간 (Handrail): 포스트 4본(후면+좌우 — 전면은 개방) + 상·중 가로대
      const hrY0 = H / 2 + 0.35;
      const hrPostPos = [[-W/2+0.06, hrY0, D/2-0.06], [-W/2+0.06, hrY0, -D/2+0.06], [W/2-0.06, hrY0, -D/2+0.06], [W/2-0.06, hrY0, D/2-0.06]];
      hrPostPos.forEach(([px, py, pz]) => createCylinder(0.015, 0.015, 0.70, silvMat, px, py, pz, carFrameGrp));
      createCylinder(0.012, 0.012, W-0.12, silvMat, 0, H/2+0.685, -D/2+0.06, carFrameGrp).rotation.z = Math.PI/2;
      createCylinder(0.012, 0.012, W-0.12, silvMat, 0, H/2+0.40,  -D/2+0.06, carFrameGrp).rotation.z = Math.PI/2;
      createCylinder(0.012, 0.012, D-0.12, silvMat, -W/2+0.06, H/2+0.685, 0, carFrameGrp).rotation.x = Math.PI/2;
      createCylinder(0.012, 0.012, D-0.12, silvMat, -W/2+0.06, H/2+0.40,  0, carFrameGrp).rotation.x = Math.PI/2;
      createCylinder(0.012, 0.012, D-0.12, silvMat,  W/2-0.06, H/2+0.685, 0, carFrameGrp).rotation.x = Math.PI/2;
      createCylinder(0.012, 0.012, D-0.12, silvMat,  W/2-0.06, H/2+0.40,  0, carFrameGrp).rotation.x = Math.PI/2;

      carGrp.add(carFrameGrp);

      /* ──────────────────────────────────────────────────────────────
         B. 플랫폼 (Platform) — PDF 10p
         platformGrp: Floor Base / Floor / Kick Plate / Car Sill / Apron / Load Device S/W
      ────────────────────────────────────────────────────────────── */
      const platformGrp = new THREE.Group();
      const orgMat   = M.paint(0xc46a1e); // 주황 구조재 (PDF 플랫폼 계열)
      const sillMat  = M.ss(0xc0c8d0);    // 실(문턱) — buildHatchDoors Hall Sill도 참조하므로 삭제 금지
      const navyMat  = M.paint(0x2c3e6b); // 플로어 보강 채널 (PDF 네이비)
      const redMat   = M.paint(0xc0392b); // 전면 실 서포트 채널 (PDF 레드)
      const kickMat  = M.paint(0xa8862e); // 킥플레이트 (PDF 골드/황동)
      const brownMat = M.paint(0x5a3230); // 에이프런 (PDF 브라운)

      // ② Floor Base: 외곽 프레임 4변 (유지) + 모서리 받침 발 4개
      createBox(W+0.10, 0.08, 0.05, orgMat, 0, -H/2-0.04,  D/2,  platformGrp); // 전면
      createBox(W+0.10, 0.08, 0.05, orgMat, 0, -H/2-0.04, -D/2,  platformGrp); // 후면
      createBox(0.05, 0.08, D-0.05, orgMat, -W/2, -H/2-0.04, 0,  platformGrp); // 좌
      createBox(0.05, 0.08, D-0.05, orgMat,  W/2, -H/2-0.04, 0,  platformGrp); // 우
      // 모서리 L자 받침 발 4개
      [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([fx, fz]) => {
        createBox(0.06, 0.06, 0.05, orgMat, fx*(W/2+0.02), -H/2-0.11, fz*(D/2-0.02), platformGrp);
      });

      // ① Floor: 회색 팬 상판 + 네이비 보강 채널 6본(Z방향 종통재) + 빨간 전면 채널·리브
      createBox(W+0.06, 0.012, D+0.02, M.ss(0x9aa2a9), 0, -H/2-0.006, 0, platformGrp);
      [-0.625, -0.375, -0.125, 0.125, 0.375, 0.625].forEach(jx => {
        createBox(0.05, 0.06, D-0.08, navyMat, jx, -H/2-0.042, 0, platformGrp);
      });
      createBox(W+0.06, 0.10, 0.015, redMat, 0, -H/2-0.062, D/2+0.020, platformGrp);
      [-0.60, -0.30, 0, 0.30, 0.60].forEach(rx => {
        createBox(0.012, 0.085, 0.055, redMat, rx, -H/2-0.062, D/2-0.012, platformGrp);
      });

      // ③ Kick Plate: 금색 L앵글 3본 (좌/우/후 테두리)
      [-1, 1].forEach(s => {
        createBox(0.012, 0.06, D+0.02, kickMat, s*(W/2+0.031), -H/2+0.010, 0, platformGrp);
        createBox(0.045, 0.012, D+0.02, kickMat, s*(W/2+0.014), -H/2-0.020, 0, platformGrp);
      });
      createBox(W+0.08, 0.06, 0.012, kickMat, 0, -H/2+0.010, -(D/2+0.031), platformGrp);
      createBox(W+0.08, 0.012, 0.045, kickMat, 0, -H/2-0.020, -(D/2+0.014), platformGrp);

      // ④ Car Sill: 핑크레드 압출 프로파일 + 도어 홈 2줄
      createBox(S.DOOR_W+0.25, 0.05, 0.10, M.paint(0xb56060), 0, -H/2-0.025, D/2+0.06, platformGrp);
      createBox(S.DOOR_W+0.25, 0.004, 0.012, M.paint(0x111111), 0, -H/2+0.002, D/2+0.035, platformGrp);
      createBox(S.DOOR_W+0.25, 0.004, 0.012, M.paint(0x111111), 0, -H/2+0.002, D/2+0.085, platformGrp);

      // ⑤ Apron: 갈색 수직판 + 하단 경사판 + 금색 거싯 2개
      createBox(S.DOOR_W+0.15, 0.60, 0.012, brownMat, 0, -H/2-0.35, D/2+0.05, platformGrp);
      const apronSlant = createBox(S.DOOR_W+0.15, 0.18, 0.012, brownMat, 0, -H/2-0.685, D/2+0.05, platformGrp);
      apronSlant.rotation.x = 0.3;
      [-0.30, 0.30].forEach(gx => {
        const gus = createBox(0.012, 0.42, 0.085, kickMat, gx, -H/2-0.27, D/2-0.002, platformGrp);
        gus.rotation.x = -0.08;
      });

      // ⑥ Load Device S/W: 파란 상판 + 청록 하판 + 스터드 4본 + 방진고무 블록 4개 (정중앙 Z=0)
      createBox(0.40, 0.012, 0.14, M.paint(0x1e3a8a), 0, -H/2-0.100, 0, platformGrp);
      [-0.14, -0.05, 0.05, 0.14].forEach(sx => {
        createCylinder(0.006, 0.006, 0.045, silvMat, sx, -H/2-0.128, 0, platformGrp);
      });
      createBox(0.36, 0.012, 0.12, M.paint(0x1f7a6d), 0, -H/2-0.155, 0, platformGrp);
      createBox(0.012, 0.045, 0.12, M.paint(0x1f7a6d), 0.186, -H/2-0.178, 0, platformGrp);
      [-0.135, -0.045, 0.045, 0.135].forEach(bx => {
        createBox(0.055, 0.050, 0.090, M.paint(0x141414), bx, -H/2-0.186, 0, platformGrp);
      });

      carGrp.add(platformGrp);

      /* ──────────────────────────────────────────────────────────────
         C. 세이프티 기어 (Safety Gear) — PDF 12p
         safetyGearGrp: 하우징 / Wedge / U-Spring / Lift Rod / Connecting Rod / 조속기 로프 연동 암
      ────────────────────────────────────────────────────────────── */
      const safetyGearGrp = new THREE.Group();
      const sgMat = M.paint(0xb8860b); // 세이프티 하우징 — 골드브라운

      [-0.815, 0.815].forEach(sx => {
        const xs = sx > 0 ? 1 : -1;
        // 하우징: 레일 웹(±0.875, Z=0.04)을 감싸는 위치
        createBox(0.14, 0.22, 0.16, sgMat, sx, -H/2-0.14, 0.04, safetyGearGrp);

        // Wedge 쌍 (레일 웹 양측 Z)
        createBox(0.028, 0.10, 0.022, silvMat, sx, -H/2-0.09, 0.04-0.030, safetyGearGrp);
        createBox(0.028, 0.10, 0.022, silvMat, sx, -H/2-0.09, 0.04+0.030, safetyGearGrp);

        // U-Spring: 하우징 외측면 U자
        const uSpring = new THREE.Mesh(
          new THREE.TorusGeometry(0.055, 0.010, 8, 12, Math.PI), M.paint(0xc46a1e));
        uSpring.position.set(sx, -H/2-0.14, 0.04);
        uSpring.rotation.y = xs > 0 ? -Math.PI/2 : Math.PI/2;
        safetyGearGrp.add(uSpring);
        createCylinder(0.008, 0.008, 0.11, M.paint(0xc46a1e), sx, -H/2-0.197, 0.04-0.055, safetyGearGrp);
        createCylinder(0.008, 0.008, 0.11, M.paint(0xc46a1e), sx, -H/2-0.197, 0.04+0.055, safetyGearGrp);

        // Lift Rod: 업라이트 따라 수직, 중간 가이드 브래킷 2개
        createCylinder(0.006, 0.006, H-0.04, silvMat, sx, -0.04, 0.10, safetyGearGrp);
        [-H/4, H/4].forEach(by => {
          createBox(0.06, 0.018, 0.018, M.paint(0x3a4a5a), sx - xs*0.04, by, 0.10, safetyGearGrp);
        });
      });

      // Connecting Rod: 크로스헤드 하부 수평 로드 (좌우 Lift Rod 상단 연결)
      createCylinder(0.008, 0.008, 1.63, silvMat, 0, H/2-0.04, 0.10, safetyGearGrp).rotation.z = Math.PI/2;
      // 중앙 피벗 레버 + 핀
      createBox(0.04, 0.14, 0.02, silvMat, 0, H/2-0.04, 0.10, safetyGearGrp);
      createCylinder(0.008, 0.008, 0.03, silvMat, 0, H/2-0.04, 0.10, safetyGearGrp).rotation.x = Math.PI/2;

      // 조속기 로프 연동 암 + 로프 클램프 블록
      // GOV_TENS_X = CAR_BG/2 + 0.115 = 0.875 + 0.115 = 0.99, tensBaseZ = 0.22
      createBox(0.175, 0.018, 0.120, silvMat, 0.9025, H/2-0.04, 0.16, safetyGearGrp); // 연동 암
      const safetyClamp = createBox(0.025, 0.09, 0.025, silvMat, 0.99, H/2-0.04, 0.22, safetyGearGrp);
      safetyClamp.userData = { type: 'safety-link' };

      carGrp.add(safetyGearGrp);

      /* ──────────────────────────────────────────────────────────────
         가이드 롤러 어셈블리 (High-Detail 3-Roller Guide Shoe) — PDF 13p
      ────────────────────────────────────────────────────────────── */
      const rollerGuideGrp = new THREE.Group();

      const rMat = M.paint(0x1a1a1a); // 우레탄 롤러 (무광 블랙)
      const bMat = M.paint(0x3a4a5a); // 짙은 스틸 블루 브라켓 (기계 느낌)
      const axMat = M.ss(0xb0b5bb);   // 금속 축 및 로드 (은색)
      const spMat = M.paint(0xf1c40f); // 텐션 스프링 (아연 도금 옐로우)

      const railX = S.CAR_BG / 2;     // 0.875 (레일 중심 X)
      const railZ = 0.04;             // 레일 웹 중심 Z

      // 개별 가이드 슈 생성 함수 (방향이 바뀐 레일에 완벽 도킹)
      function createGuideShoe(xSign, isTop) {
        const shoe = new THREE.Group();
        const rX = railX * xSign;     // 레일 중심 X 좌표 (±0.875)

        // ① 베이스 플레이트
        createBox(0.20, 0.02, 0.26, bMat, rX - (0.05 * xSign), 0, railZ, shoe);

        // ② 메인 롤러 (레일 웹 끝단 X축 면에 수직으로 접촉)
        // 레일 웹 끝단 X = 레일중심(±0.875) ∓ 절반(0.041)
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

      // Lubricator: 상단 가이드슈 위 급유기 (좌우 2개) — PDF 13p
      const lubMat = M.paint(0x4a6b3a); // 녹색 오일컵
      [-0.815, 0.815].forEach(lx => {
        createBox(0.06, 0.07, 0.05, lubMat, lx, H/2+0.22, 0.04, carGrp);
        createCylinder(0.008, 0.008, 0.05, silvMat, lx, H/2+0.265, 0.04, carGrp);
      });

      /* ──────────────────────────────────────────────────────────────
         F. 천장 어셈블리 (Ceiling Assembly) — PDF 17p
         ceilingGrp: Emergency Exit / Ceiling Fan / Cage Sustainer / Light Frame+Cover
      ────────────────────────────────────────────────────────────── */
      const ceilingGrp = new THREE.Group();

      // Emergency Exit 해치
      createBox(0.45, 0.015, 0.55, M.ss(0x9aa2aa), 0, H/2+0.058, -0.20, ceilingGrp);
      // 해치 테두리 4변
      createBox(0.47, 0.018, 0.012, frmMat, 0, H/2+0.065,  0.075, ceilingGrp);
      createBox(0.47, 0.018, 0.012, frmMat, 0, H/2+0.065, -0.475, ceilingGrp);
      createBox(0.012, 0.018, 0.55, frmMat, -0.235, H/2+0.065, -0.20, ceilingGrp);
      createBox(0.012, 0.018, 0.55, frmMat,  0.235, H/2+0.065, -0.20, ceilingGrp);
      // 힌지 2개
      createBox(0.04, 0.03, 0.02, silvMat, -0.20, H/2+0.070, 0.065, ceilingGrp);
      createBox(0.04, 0.03, 0.02, silvMat,  0.20, H/2+0.070, 0.065, ceilingGrp);

      // Ceiling Fan — THREE.Group으로 묶어 향후 회전 애니메이션 여지 확보
      const fanGrp = new THREE.Group();
      fanGrp.position.set(-0.45, H/2+0.10, -0.35);
      const fanBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.10, 16), M.paint(0x374151));
      fanGrp.add(fanBody);
      // 그릴 커버 (슬릿 표현)
      createBox(0.18, 0.012, 0.18, M.ss(0x8a9099), 0, 0.06, 0, fanGrp);
      createBox(0.012, 0.018, 0.18, M.paint(0x374151), -0.06, 0.065, 0, fanGrp);
      createBox(0.012, 0.018, 0.18, M.paint(0x374151),  0,    0.065, 0, fanGrp);
      createBox(0.012, 0.018, 0.18, M.paint(0x374151),  0.06, 0.065, 0, fanGrp);
      ceilingGrp.add(fanGrp);

      // Cage Sustainer: 4모서리 L앵글
      [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx, sz]) => {
        const cx = sx * (W/2-0.05), cz = sz * (D/2-0.05);
        createBox(0.06, 0.10, 0.012, frmMat, cx, H/2+0.08, cz - sz*0.030, ceilingGrp);
        createBox(0.012, 0.10, 0.06, frmMat, cx - sx*0.024, H/2+0.08, cz, ceilingGrp);
      });

      // Light Frame: 카 내부 천장 격자 + 반투명 커버
      const lfY = H/2 - 0.035;
      createBox(0.95, 0.020, 0.020, frmMat, 0, lfY,  0.20, ceilingGrp);
      createBox(0.95, 0.020, 0.020, frmMat, 0, lfY,  0,    ceilingGrp);
      createBox(0.95, 0.020, 0.020, frmMat, 0, lfY, -0.20, ceilingGrp);
      createBox(0.020, 0.020, 0.70, frmMat, -0.35, lfY, 0, ceilingGrp);
      createBox(0.020, 0.020, 0.70, frmMat,  0.35, lfY, 0, ceilingGrp);
      // 반투명 커버
      createBox(0.95, 0.010, 0.70, M.glass(), 0, lfY-0.012, 0, ceilingGrp);

      carGrp.add(ceilingGrp);

      /* ──────────────────────────────────────────────────────────────
         G. 카 패널·트랜섬·컬럼 — PDF 18p
      ────────────────────────────────────────────────────────────── */
      // Car Panel 조인트: 좌·우·후 외벽 외면 세로 스트립 (0.32 간격)
      const jntMat = M.paint(0x1e2531);
      for (let xi = 0; xi < 5; xi++) {
        const jx = -W/2*0.9 + xi * (W*0.9/4);
        createBox(0.006, H-0.10, 0.008, jntMat, -W/2-0.013, 0, jx, carGrp);
        createBox(0.006, H-0.10, 0.008, jntMat,  W/2+0.013, 0, jx, carGrp);
      }
      for (let zi = 0; zi < 4; zi++) {
        const jz = -D/2*0.85 + zi * (D*0.85/3);
        createBox(0.006, H-0.10, 0.008, jntMat, 0, 0, -D/2-0.013, carGrp).rotation.y = Math.PI/2;
      }

      // Car Transom: 도어 개구 상부 내측 빔
      const transomTopY = S.DOOR_H * 0.9 / 2 + 0.03; // ≈ +0.975
      createBox(S.DOOR_W+0.20, 0.10, 0.03, M.ss(0xa8aeb5), 0, H/2-transomTopY+0.05, D/2-0.015, carGrp);

      // Column: 출입구 양측 수직 프레임
      createBox(0.06, S.DOOR_H*0.9, 0.03, M.ss(0xb0b6be), -(S.DOOR_W/2+0.06), 0, D/2-0.015, carGrp);
      createBox(0.06, S.DOOR_H*0.9, 0.03, M.ss(0xb0b6be),  (S.DOOR_W/2+0.06), 0, D/2-0.015, carGrp);

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

      /* ──────────────────────────────────────────────────────────────
         E. 카도어 부속 (PDF 16p): Door Vane / Safety Shoe / Door Guide Shoe
         Door Vane은 xSign>0(carDoorR) 패널에만 추가 — 홀도어 인터록과 물리는 클러치 판
      ────────────────────────────────────────────────────────────── */
      function makeDoor(xSign) {
        const g = new THREE.Group();
        createBox(dw, dh, dt, M.ss(0xa8aeb5), 0, 0, 0, g);
        createBox(dw * 0.55, dh * 0.26, dt + 0.005, M.glass(), 0, dh * 0.3, 0, g);

        const isLeftFromInside = xSign > 0;
        const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), isLeftFromInside ? mats.L : mats.R);

        // 스티커 위치: 눈높이(+0.45) 및 중앙 분리대 쪽
        const stickerX = -xSign * 0.18;
        sticker.position.set(stickerX, 0.45, -dt / 2 - 0.002);
        sticker.rotation.y = Math.PI;
        g.add(sticker);

        // Safety Shoe: 패널 선단 에지 검은 고무 바
        createBox(0.015, dh*0.96, 0.05, M.paint(0x1a1a1a),
          -xSign * (dw/2 + 0.012), 0, 0, g);

        // Door Guide Shoe: 패널 하단 블록 2개 (카실 홈 삽입)
        [-0.15, 0.15].forEach(gx => createBox(0.05, 0.035, 0.025, M.ss(0x7a828a), gx, -dh/2-0.02, 0, g));

        // Door Vane: +X 패널(carDoorR, xSign>0)에만 추가
        // 홀도어 인터록 롤러가 두 판 사이에 물리는 클러치 구조
        if (xSign > 0) {
          createBox(0.025, 0.60, 0.012, M.ss(0x9ca3af), -0.05, 0.35, -dt/2-0.02, g);
          createBox(0.025, 0.60, 0.012, M.ss(0x9ca3af),  0.05, 0.35, -dt/2-0.02, g);
        }

        return g;
      }
      carDoorL = makeDoor(-1); carDoorR = makeDoor(1);

      const cx = dw / 2 + 0.006, ox = dw * 1.5 - 0.01;
      const dy = S.CAR_H / 2 - dh / 2 - 0.055;
      carDoorL.position.set(-cx, dy, dz); carDoorR.position.set(cx, dy, dz);
      carDoorL.userData = { cx: -cx, ox: -ox }; carDoorR.userData = { cx: cx, ox: ox };
      carGrp.add(carDoorL, carDoorR);

      /* ──────────────────────────────────────────────────────────────
         D. 카도어 행거 레일 어셈블리 (PDF 15p)
         doorHangerGrp(carGrp 자식): Hanger Plate / Door Rail / Door Machine / Gate S/W / Door Sensor
         Door Hanger(행거판+롤러)는 각 carDoorL/R 자식 — GSAP 이동에 자동 연동
      ────────────────────────────────────────────────────────────── */
      const doorHangerGrp = new THREE.Group();
      const hpMat  = M.paint(0xc46a1e); // 주황 행거 구조재
      const hgMat  = M.ss(0x9aa2aa);    // 행거판 스테인리스

      // Hanger Plate: Door Machine Base 위에 얹히는 가로 판
      createBox(S.CAR_W+0.10, 0.32, 0.015, hpMat, 0, S.CAR_H/2+0.26, 0.645, doorHangerGrp);

      // Door Rail: 행거 롤러가 걸리는 원봉 레일
      const railMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, S.CAR_W+0.05, 14),
        M.ss(0xc0c8d0));
      railMesh.rotation.z = Math.PI / 2;
      railMesh.position.set(0, S.CAR_H/2+0.345, 0.672);
      doorHangerGrp.add(railMesh);

      // Door Machine: 우측단 — 수직판 + 풀리 그룹
      const dmX = S.CAR_W/2 - 0.10;
      createBox(0.16, 0.40, 0.018, hpMat, dmX, S.CAR_H/2+0.27, 0.635, doorHangerGrp);
      const dmGrp = new THREE.Group(); // 풀리·모터 그룹 (향후 회전 애니메이션)
      dmGrp.position.set(dmX, S.CAR_H/2+0.27, 0.628);
      // 대풀리(하부)
      const bigPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.040, 16), M.ss(0x7a828a));
      bigPulley.rotation.x = Math.PI/2;
      bigPulley.position.set(0, -0.09, 0);
      dmGrp.add(bigPulley);
      // 소풀리(상부)
      const smPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.030, 14), M.ss(0x9aa2aa));
      smPulley.rotation.x = Math.PI/2;
      smPulley.position.set(0, 0.16, 0);
      dmGrp.add(smPulley);
      // 타이밍 벨트 2줄
      createBox(0.012, 0.26, 0.008, M.paint(0x111111), -0.06, 0.035, 0, dmGrp);
      createBox(0.012, 0.26, 0.008, M.paint(0x111111),  0.06, 0.035, 0, dmGrp);
      doorHangerGrp.add(dmGrp);
      // Door Motor: 모터 원통 + 냉각핀
      const motorGrp = new THREE.Group();
      motorGrp.position.set(S.CAR_W/2+0.01, S.CAR_H/2+0.27, 0.628);
      const motorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 14), M.paint(0x374151));
      motorBody.rotation.z = Math.PI/2;
      motorGrp.add(motorBody);
      [0.04, 0.08, 0.12].forEach(mx => {
        const fin = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.005, 6, 16), M.ss(0x5a6575));
        fin.rotation.z = Math.PI/2;
        fin.position.x = mx - 0.06;
        motorGrp.add(fin);
      });
      // Rotary Encoder: 모터 축 끝 디스크
      const encDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.030, 14), M.paint(0x111111));
      encDisk.rotation.z = Math.PI/2;
      encDisk.position.x = 0.095;
      motorGrp.add(encDisk);
      doorHangerGrp.add(motorGrp);

      // Gate Switch: 상부 중앙 도어 닫힘 검출
      const gsw = createBox(0.05, 0.07, 0.04, M.paint(0x374151),
        -0.05, S.CAR_H/2+0.16, 0.66, doorHangerGrp);
      gsw.userData = { type: 'gate-switch' };
      createBox(0.04, 0.008, 0.008, M.ss(0x9aa2aa), -0.05, S.CAR_H/2+0.13, 0.66, doorHangerGrp); // 레버

      // Door Sensor / Maintenance Switch
      createBox(0.05, 0.055, 0.04, M.paint(0x22272d), -S.CAR_W/2+0.14, S.CAR_H/2+0.22, 0.655, doorHangerGrp);
      createBox(0.04, 0.065, 0.04, M.paint(0x374151), -S.CAR_W/2+0.05, S.CAR_H/2+0.19, 0.655, doorHangerGrp);

      carGrp.add(doorHangerGrp);

      // Door Hanger: 각 carDoorL/R 자식 — GSAP 이동 자동 연동
      // 로컬좌표 = carGrp 좌표 - 도어그룹 위치(±cx, 0.1775, 0.695)
      // 행거판 carGrp Y=+H/2+0.13 → 로컬Y = 1.1775+0.13-0.1775 = 1.13
      const H = S.CAR_H;
      [carDoorL, carDoorR].forEach((door, idx) => {
        const hangerGrp = new THREE.Group();
        const doorCx = idx === 0 ? -cx : cx; // 도어그룹 X

        // 행거판
        createBox(0.30, 0.18, 0.012, hgMat, -doorCx, 1.13, -0.02, hangerGrp);

        // 상부 롤러 2개 (레일에 걸림)
        const rollerY = H/2+0.40 - 0.1775; // ≈ 0.9725+0.40=1.3725 → local 1.195
        const localRollerY = (H/2 + 0.40) - 0.1775;
        [-0.10, 0.10].forEach(rx => {
          const rol = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.045, 0.022, 14), M.ss(0x7a828a));
          rol.rotation.x = Math.PI/2;
          rol.position.set(-doorCx + rx, localRollerY, -0.023);
          hangerGrp.add(rol);
        });

        // 업스러스트 롤러 2개 (레일 하부)
        [-0.10, 0.10].forEach(rx => {
          const uRol = new THREE.Mesh(
            new THREE.CylinderGeometry(0.018, 0.018, 0.018, 12), M.paint(0x1a1a1a));
          uRol.rotation.x = Math.PI/2;
          uRol.position.set(-doorCx + rx, localRollerY - 0.065, -0.018);
          hangerGrp.add(uRol);
        });

        door.add(hangerGrp);
      });
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
      const hz = FRONT_INNER_Z + dt / 2;
      const jambZ = FRONT_INNER_Z + S.WALL_T / 2 + 0.04;
      const cx = dw / 2 + 0.006, ox = dw * 1.5 - 0.01;
      const panMat = M.ss(0x868c94), jambMat = M.ss(0x989ea6);
      const sillMat = M.ss(0xc0c8d0);
      const mats = getStickerMats();

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
          const stickerX = -xSign * 0.18;
          sticker.position.set(stickerX, 0.45, dt / 2 + 0.002);
          g.add(sticker);

          // Door Guide Shoe: 패널 하단 블록 (홀 실 홈 삽입)
          [-0.12, 0.12].forEach(gx => createBox(0.045, 0.030, 0.022, M.ss(0x7a828a), gx, -dh/2-0.015, 0, g));

          return g;
        }

        const hl = makeHatchDoor(-1), hr = makeHatchDoor(1);
        hl.position.set(-cx, dy, hz); hr.position.set(cx, dy, hz);
        hl.userData = { cx: -cx, ox: -ox }; hr.userData = { cx: cx, ox: ox };
        hatchDoors.push({ left: hl, right: hr });
        scene.add(hl, hr);

        // ─── 잠 (Jamb) — 기존 구현 유지 ───
        const jambW = 0.18;
        createBox(jambW, dh + 0.05, 0.06, jambMat, -(S.DOOR_W / 2 + jambW / 2 + 0.01), dy, jambZ, scene);
        createBox(jambW, dh + 0.05, 0.06, jambMat, (S.DOOR_W / 2 + jambW / 2 + 0.01), dy, jambZ, scene);
        const topW = S.DOOR_W + jambW * 2 + 0.02;
        createBox(topW, 0.06, 0.06, jambMat, 0, fy + dh + 0.09, jambZ, scene);

        const transH = 0.55;
        const transY = fy + dh + 0.09 + 0.03 + transH / 2;
        createBox(topW, transH, 0.055, jambMat, 0, transY, jambZ, scene);

        // Upper Jamb 보강 가로대
        createBox(topW, 0.04, 0.06, jambMat, 0, fy + dh + 0.22, jambZ, scene);

        // 층표시기 LED
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const tex = new THREE.CanvasTexture(canvas);
        const ledMat = new THREE.MeshStandardMaterial({ color: 0x0a0c0e, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 2.5 });
        createBox(0.45, 0.12, 0.01, ledMat, 0, transY, jambZ + 0.03, scene);
        indicators.push({ ctx: ctx, texture: tex });

        // ─── H. 승강장 어셈블리 — PDF 20~23p ───

        // Header Case: 도어 상부 행거 케이스
        const hcY = fy + dh + 0.06 + 0.18;
        createBox(S.DOOR_W+0.30, 0.32, 0.020, M.paint(0x9e4e1e),
          0, hcY, FRONT_INNER_Z - 0.05, scene);
        createBox(S.DOOR_W+0.30, 0.018, 0.060, M.paint(0x7a3a14),
          0, hcY + 0.169, FRONT_INNER_Z - 0.05, scene); // 상부 플랜지
        createBox(S.DOOR_W+0.30, 0.018, 0.060, M.paint(0x7a3a14),
          0, hcY - 0.169, FRONT_INNER_Z - 0.05, scene); // 하부 플랜지
        // 헤더 내부 Door Rail (원봉)
        const hRail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.010, 0.010, S.DOOR_W+0.25, 14),
          M.ss(0xc0c8d0));
        hRail.rotation.z = Math.PI/2;
        hRail.position.set(0, hcY + 0.08, FRONT_INNER_Z - 0.08);
        scene.add(hRail);
        // Door Connecting Rope 풀리 2개 + 연결 로프
        [-(S.DOOR_W/2+0.08), (S.DOOR_W/2+0.08)].forEach(px => {
          const pul = new THREE.Mesh(
            new THREE.CylinderGeometry(0.028, 0.028, 0.020, 12), M.ss(0x7a828a));
          pul.rotation.x = Math.PI/2;
          pul.position.set(px, hcY + 0.02, FRONT_INNER_Z - 0.075);
          scene.add(pul);
        });
        createBox(S.DOOR_W+0.18, 0.003, 0.003, M.paint(0x222222),
          0, hcY + 0.018, FRONT_INNER_Z - 0.075, scene); // 상부 연동 로프
        createBox(S.DOOR_W+0.18, 0.003, 0.003, M.paint(0x222222),
          0, hcY - 0.018, FRONT_INNER_Z - 0.075, scene); // 하부 연동 로프
        // Spring Closer: 좌측단 수직 스프링
        createCylinder(0.004, 0.004, 0.18, M.ss(0x9aa2aa),
          -(S.DOOR_W/2+0.10), hcY, FRONT_INNER_Z-0.075, scene);
        for (let si = 0; si < 5; si++) {
          const coil = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 14), M.ss(0x9aa2aa));
          coil.rotation.x = Math.PI/2;
          coil.position.set(-(S.DOOR_W/2+0.10), hcY - 0.05 + si * 0.022, FRONT_INNER_Z-0.075);
          scene.add(coil);
        }

        // 헤더케이스 도어 행거 2세트 — 각 hatch 도어 그룹(hl/hr) 자식
        [hl, hr].forEach((door, idx) => {
          const hHgGrp = new THREE.Group();
          const doorCx  = idx === 0 ? -cx : cx;
          // 행거판 (로컬좌표: 도어그룹 기준)
          createBox(0.26, 0.15, 0.012, M.ss(0x9aa2aa), -doorCx, dh/2+0.10, -0.08, hHgGrp);
          // 행거 롤러 2개
          [-0.09, 0.09].forEach(rx => {
            const rol = new THREE.Mesh(
              new THREE.CylinderGeometry(0.040, 0.040, 0.020, 12), M.ss(0x7a828a));
            rol.rotation.x = Math.PI/2;
            rol.position.set(-doorCx + rx, dh/2+0.155, -0.082);
            hHgGrp.add(rol);
          });
          // Door Interlock (+X 행거 = hr, idx=1에만 추가)
          if (idx === 1) {
            // 갈고리 래치 — 카 Door Vane(X≈±0.05)와 Z 정렬, Z=0.72 부근 카좌표 → local Z
            const ilLatch = createBox(0.10, 0.03, 0.015, M.ss(0xb0b6be), -doorCx, dh/2+0.08, -0.045, hHgGrp);
            ilLatch.rotation.z = 0.3;
            // 인터록 롤러 2개 (베인 판 사이에 물림)
            [-0.05, 0.05].forEach(rx => {
              const ilRol = new THREE.Mesh(
                new THREE.CylinderGeometry(0.015, 0.015, 0.018, 10), M.ss(0x9aa2aa));
              ilRol.rotation.x = Math.PI/2;
              ilRol.position.set(-doorCx + rx, dh/2+0.08, -0.048);
              hHgGrp.add(ilRol);
            });
          }
          door.add(hHgGrp);
        });

        // Interlock Switch (케이스 고정측)
        const ilSw = createBox(0.04, 0.06, 0.035, M.paint(0x22272d),
          cx + 0.12, hcY - 0.06, FRONT_INNER_Z - 0.052, scene);
        ilSw.userData = { type: 'interlock' };

        // Hall Sill + Support: 층별 문턱
        createBox(S.DOOR_W+0.25, 0.05, 0.10, sillMat, 0, fy - 0.025, FRONT_INNER_Z - 0.06, scene);
        // 경사 리브 브래킷 3개
        [-0.30, 0, 0.30].forEach(bx => {
          const rib = createBox(0.012, 0.12, 0.10, M.ss(0x7a828a), bx, fy - 0.09, FRONT_INNER_Z - 0.06, scene);
          rib.rotation.x = -0.25;
        });

        // Toe Guard: 실 직하 수직판
        createBox(S.DOOR_W+0.15, 0.40, 0.012, M.ss(0x868e96),
          0, fy - 0.225, FRONT_INNER_Z - 0.04, scene);
      }

      // Fascia Plate: 층간 전면 수직판 (1↔2, 2↔3, 3↔4)
      for (let i = 0; i < FLOORS - 1; i++) {
        const fasciaH = FLOOR_Y[i+1] - FLOOR_Y[i] - 0.90;
        const fasciaY = FLOOR_Y[i] + 0.90 + fasciaH / 2;
        if (fasciaH > 0) {
          createBox(S.DOOR_W+0.30, fasciaH, 0.010, M.ss(0x9aa2aa),
            0, fasciaY, FRONT_INNER_Z - 0.035, scene);
        }
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
      const defY = mrGrp.userData.defY, defZ = mrGrp.userData.defZ;
      const rMat = M.rope();
      // [수정] 3. 로프 5가닥 동기화
      for (let i = 0; i < 5; i++) {
        const rx = -0.04 + i * 0.02; // 보조 시브 홈과 동일한 간격
        const line = new THREE.Line(new THREE.BufferGeometry(), rMat);
        ropeObjs.push({ line: line, defY: defY, defZ: defZ, rx: rx });
        scene.add(line);
      }
    }

    function refreshRopes() {
      const cy = carGrp.position.y + S.CAR_H / 2 + 0.28;
      const wy = cwtGrp.position.y + S.CWT_H / 2 + 0.12;
      ropeObjs.forEach(r => {
        const pts = [
          new THREE.Vector3(r.rx, cy, 0),
          new THREE.Vector3(r.rx, r.defY, r.defZ),
          new THREE.Vector3(r.rx, wy, r.defZ),
        ];
        r.line.geometry.setFromPoints(pts);
      });
    }
