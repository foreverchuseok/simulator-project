// 엘리베이터 카, 도어, 균형추, 로프 등 동적 객체 생성 함수를 정의한다.
    function buildCarCabin() {
      carGrp = new THREE.Group();
      const W = S.CAR_W, D = S.CAR_D, H = S.CAR_H;
      const extMat = M.ss(0xa8aeb5);
      const intMat = M.ss(0xe5e7eb);

      // 케이지 벽 4장 (좌/우/후/천장) - 투명 파란 유리 디자인 적용
      const transparentBlueGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0x1e3a8a, // 로얄 블루
        transmission: 0.9,
        opacity: 0.8,
        transparent: true,
        roughness: 0.1,
        ior: 1.5,
        side: THREE.DoubleSide
      });
      createBox(0.025, H, D, transparentBlueGlassMat, -W / 2, 0, 0, carGrp);
      createBox(0.025, H, D, transparentBlueGlassMat, W / 2, 0, 0, carGrp);
      createBox(W + 0.05, H, 0.025, transparentBlueGlassMat, 0, 0, -D / 2, carGrp);
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

      // Cross Head: 채널빔 2본 (체대 높이 상향: 기존 H/2+0.06 -> H/2+0.35)
      const chLen = S.CAR_BG - 0.05;
      const chY = H / 2 + 0.35;
      createBox(chLen, 0.12, 0.05, frmMat, 0, chY, -0.055, carFrameGrp);
      createBox(chLen, 0.12, 0.05, frmMat, 0, chY,  0.055, carFrameGrp);
      // Cross Head 양단 엔드플레이트
      createBox(0.03, 0.20, 0.16, frmMat, -chLen / 2, chY, 0, carFrameGrp);
      createBox(0.03, 0.20, 0.16, frmMat,  chLen / 2, chY, 0, carFrameGrp);

      // 1:1 바빗식 로프 히치 (Babbitt Socket / Wedge Socket 방식)
      const hitchPlateY = chY + 0.07;
      createBox(0.36, 0.02, 0.16, M.paint(0xb8680a), 0, hitchPlateY, 0, carFrameGrp);
      const babbittMat = M.paint(0x334455);
      const springMat = M.ss(0xd0d5da);
      for (let i = 0; i < 5; i++) {
        const rx = -0.06 + i * 0.03;
        // 히치 로드
        createCylinder(0.007, 0.007, 0.25, silvMat, rx, hitchPlateY + 0.12, 0, carFrameGrp);
        // 완충 스프링 (로드 중간)
        createCylinder(0.015, 0.015, 0.10, springMat, rx, hitchPlateY + 0.06, 0, carFrameGrp);
        // 고정 너트 (스프링 위아래)
        createCylinder(0.018, 0.018, 0.01, silvMat, rx, hitchPlateY + 0.01, 0, carFrameGrp);
        createCylinder(0.018, 0.018, 0.01, silvMat, rx, hitchPlateY + 0.11, 0, carFrameGrp);
        
        // 바빗 소켓 몸통 (원뿔형, 상단 로프 구멍이 좁음)
        const socketGeo = new THREE.CylinderGeometry(0.012, 0.025, 0.12, 16);
        const socketMesh = new THREE.Mesh(socketGeo, babbittMat);
        socketMesh.position.set(rx, hitchPlateY + 0.20, 0);
        carFrameGrp.add(socketMesh);
      }

      // Arm: 크로스헤드 양단 ↔ 업라이트 상부 경사 보강재 2본
      const armX = S.CAR_BG / 2 - 0.045;
      const armL = createBox(0.07, 0.45, 0.05, frmMat, -armX, H / 2 + 0.18, 0, carFrameGrp);
      armL.rotation.z = -0.3;
      const armR = createBox(0.07, 0.45, 0.05, frmMat,  armX, H / 2 + 0.18, 0, carFrameGrp);
      armR.rotation.z =  0.3;

      // Upright: 좌우 ㄷ자 채널 (웹 + 플랜지 2장, 높이 상향)
      const uprightX = S.CAR_BG / 2 - 0.06;
      [-uprightX, uprightX].forEach(ux => {
        const xs = ux > 0 ? 1 : -1;
        const fxc = ux - xs * 0.031; 
        createBox(0.012, H + 0.50, 0.10, frmMat, ux,  0.13, 0.04, carFrameGrp); // 웹
        createBox(0.05,  H + 0.50, 0.012, frmMat, fxc, 0.13, 0.04 - 0.044, carFrameGrp); // 앞 플랜지
        createBox(0.05,  H + 0.50, 0.012, frmMat, fxc, 0.13, 0.04 + 0.044, carFrameGrp); // 뒤 플랜지
      });

      // Plank: 하부 채널빔 2본
      createBox(chLen, 0.12, 0.05, frmMat, 0, -H / 2 - 0.06, -0.055, carFrameGrp);
      createBox(chLen, 0.12, 0.05, frmMat, 0, -H / 2 - 0.06,  0.055, carFrameGrp);

      // Brace Rod: 4본 경사 스테이 (PDF 11p ④)
      // 업라이트 중부 외측 → 플랫폼 네 모서리. 카 바깥 옆면(동일 |X|)을 따라 전장 연결.
      const brUX = S.CAR_BG / 2 + 0.005; // 업라이트·카 벽 바깥
      const brUY = 0.05;           // 업라이트 중부 (PDF: midway)
      const brUZ = 0.04;           // 업라이트 웹 Z
      const brLX = W / 2 + 0.08;   // 플랫폼 모서리 바깥
      const brLY = -H / 2 - 0.02;  // 플랭크/플랫폼 상단
      const brLZ = D / 2 - 0.06;   // 전·후 모서리
      const braceEnds = [
        [[ brLX, brLY,  brLZ], [ brUX, brUY, brUZ]], // 우전
        [[-brLX, brLY,  brLZ], [-brUX, brUY, brUZ]], // 좌전
        [[ brLX, brLY, -brLZ], [ brUX, brUY, brUZ]], // 우후
        [[-brLX, brLY, -brLZ], [-brUX, brUY, brUZ]], // 좌후
      ];
      braceEnds.forEach(([[x1,y1,z1],[x2,y2,z2]]) => {
        const dx=x2-x1, dy=y2-y1, dz=z2-z1;
        const len = Math.sqrt(dx*dx+dy*dy+dz*dz);
        const rod = createBox(0.028, len, 0.028, frmMat,
          (x1+x2)/2, (y1+y2)/2, (z1+z2)/2, carFrameGrp);
        rod.quaternion.setFromUnitVectors(
          new THREE.Vector3(0,1,0), new THREE.Vector3(dx,dy,dz).normalize());
        createBox(0.055, 0.055, 0.055, M.paint(0xb8860b), x1, y1, z1, carFrameGrp); // 하단 클레비스
        createBox(0.055, 0.055, 0.055, M.paint(0xb8860b), x2, y2, z2, carFrameGrp); // 상단 클레비스
        // 하부 인장 조절 슬리브 (PDF 11p ④ 검은 조절부)
        const sleeve = createCylinder(0.014, 0.014, 0.28, M.paint(0x1a1a1a),
          x1 + dx*0.22, y1 + dy*0.22, z1 + dz*0.22, carFrameGrp);
        sleeve.quaternion.copy(rod.quaternion);
      });

      // Car Back Angle: 후면 좌·우 수직 L앵글 (PDF 11p ⑤)
      [-W / 2 + 0.04, W / 2 - 0.04].forEach(bx => {
        createBox(0.04, H - 0.20, 0.04, frmMat, bx, 0, -D / 2 - 0.04, carFrameGrp); // 수직
        createBox(0.04, H - 0.20, 0.04, frmMat, bx, 0, -D / 2 - 0.08, carFrameGrp); // L 플랜지
      });

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
      [-0.9375, -0.5625, -0.1875, 0.1875, 0.5625, 0.9375].forEach(jx => {
        createBox(0.05, 0.06, D-0.08, navyMat, jx, -H/2-0.042, 0, platformGrp);
      });
      createBox(W+0.06, 0.10, 0.015, redMat, 0, -H/2-0.062, D/2+0.020, platformGrp);
      [-0.90, -0.45, 0, 0.45, 0.90].forEach(rx => {
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
      // 카 문턱 코 = 카 전면 +70mm (승장 문턱과 SILL_GAP 이격되도록 돌출 축소, 기존 +0.06→+0.02)
      createBox(S.DOOR_W+0.25, 0.05, 0.10, M.paint(0xb56060), 0, -H/2-0.025, D/2+0.02, platformGrp);
      createBox(S.DOOR_W+0.25, 0.004, 0.012, M.paint(0x111111), 0, -H/2+0.002, D/2-0.005, platformGrp);
      createBox(S.DOOR_W+0.25, 0.004, 0.012, M.paint(0x111111), 0, -H/2+0.002, D/2+0.045, platformGrp);

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
         C. 세이프티 기어 (Safety Gear) — device_china.mp4 27~43초 물림 장치 기반
         assets/safety_gear.glb 로드 (트윈 폴리시드 웨지 + 정적 테이퍼 가이드 +
         U-스프링 + 리프트 로드 + 수평 작동 샤프트 + 조속기 로프 클램프 + 하부 슈).
         카-로컬 좌표로 제작되어 carGrp 원점에 부착. 스케일 함정 없음(1:1).
         명명 노드: shaft / liftL / liftR / wedge{L,R}{0,1} / spring{L,R}{0,1} / clamp
      ────────────────────────────────────────────────────────────── */
      const safetyGearGrp = new THREE.Group();
      carGrp.add(safetyGearGrp);
      carGrp.userData.safetyGear = null; // .glb 로드 완료 시 채워짐 (비동기)

      new THREE.GLTFLoader().load('assets/safety_gear.glb', (gltf) => {
        const g = gltf.scene;
        g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        safetyGearGrp.add(g);
        const pick = n => g.getObjectByName(n);
        carGrp.userData.safetyGear = {
          shaft:   pick('shaft'),
          liftL:   pick('liftL'),
          liftR:   pick('liftR'),
          springs: ['springL0', 'springL1', 'springR0', 'springR1'].map(pick).filter(Boolean),
          wedges:  ['wedgeL0', 'wedgeL1', 'wedgeR0', 'wedgeR1'].map(pick).filter(Boolean),
          clamp:   pick('clamp')
        };
        // 웨지 기준 Z 저장 (물림 시 핀 쪽으로 파고드는 그립 애니메이션·복귀용)
        carGrp.userData.safetyGear.wedges.forEach(w => { w.userData.z0 = w.position.z; });
        if (typeof refreshGovernorRope === 'function') refreshGovernorRope();
      }, undefined, (err) => console.error('[safety_gear.glb] 로드 실패:', err));

      /* ──────────────────────────────────────────────────────────────
         가이드 슈/롤러 + 급유기 (PDF 13p) — 2롤러 + 슈 타입, 상단 오일통
         카 상부 좌·우 각 1세트
      ────────────────────────────────────────────────────────────── */
      const rollerGuideGrp = new THREE.Group();

      const rMat    = M.paint(0x1a1a1a); // 우레탄 롤러
      const baseYel = M.paint(0xc4a574); // PDF 베이지 베이스
      const brktBrn = M.paint(0x8a5a2b); // 갈색 브라켓
      const shoeMat = M.paint(0x6b3a1f); // 슈 라이너 (적갈)
      const axMat   = M.ss(0xb0b5bb);
      const lubBody = M.paint(0x5a7a3a); // 녹색 오일통
      const lubLid  = M.paint(0x2f4a22); // 뚜껑

      const railX = S.CAR_BG / 2; // ±0.875
      const railZ = 0.04;

      // PDF 13p: ① 2롤러+슈 ② 상단 급유기 — 좌우 대칭
      function createGuideShoe(xSign) {
        const shoe = new THREE.Group();
        const rX = railX * xSign;
        // 레일 웹 끝단(카쪽) X — 웹 반폭 ≈ 0.041
        const webTipX = rX - 0.041 * xSign;

        // ① L형 베이스 플레이트 (카 상부에 볼트 고정)
        createBox(0.22, 0.018, 0.28, baseYel, rX - 0.06 * xSign, 0.010, railZ, shoe);
        createBox(0.018, 0.10, 0.28, baseYel, rX - 0.16 * xSign, 0.050, railZ, shoe);
        [-0.08, 0, 0.08].forEach(dz => {
          createCylinder(0.012, 0.012, 0.006, axMat,
            rX - 0.06 * xSign, 0.020, railZ + dz, shoe);
        });

        // ② 슈 본체 — 레일 웹 끝단을 감싸는 U채널 (면 롤러 대신)
        const shoeX = webTipX - 0.018 * xSign;
        createBox(0.028, 0.12, 0.070, shoeMat, shoeX, 0.085, railZ, shoe);
        createBox(0.022, 0.12, 0.012, shoeMat, shoeX, 0.085, railZ - 0.041, shoe);
        createBox(0.022, 0.12, 0.012, shoeMat, shoeX, 0.085, railZ + 0.041, shoe);
        createBox(0.06, 0.10, 0.016, brktBrn, shoeX - 0.035 * xSign, 0.080, railZ - 0.055, shoe);
        createBox(0.06, 0.10, 0.016, brktBrn, shoeX - 0.035 * xSign, 0.080, railZ + 0.055, shoe);
        createBox(0.014, 0.10, 0.12, brktBrn, shoeX - 0.055 * xSign, 0.080, railZ, shoe);

        // ③ 사이드 롤러 2개 — 레일 블레이드 앞·뒤(±Z) 접촉
        const sR = 0.042, sT = 0.018;
        const sY = 0.070;
        const sX = rX - 0.015 * xSign;
        const frontZ = railZ - 0.017 - sR;
        const backZ  = railZ + 0.017 + sR;
        [frontZ, backZ].forEach(rz => {
          const sRoller = new THREE.Mesh(new THREE.CylinderGeometry(sR, sR, sT, 20), rMat);
          sRoller.rotation.z = Math.PI / 2;
          sRoller.position.set(sX, sY, rz);
          shoe.add(sRoller);
          const offsetDir = Math.sign(rz - railZ);
          createBox(0.055, 0.055, 0.014, brktBrn,
            sX - 0.02 * xSign, 0.055, rz + offsetDir * 0.020, shoe);
          createCylinder(0.006, 0.006, 0.045, axMat,
            sX, sY, rz + offsetDir * 0.008, shoe).rotation.z = Math.PI / 2;
        });
        createBox(0.012, 0.012, Math.abs(backZ - frontZ) + 0.02, axMat,
          sX - 0.025 * xSign, 0.095, railZ, shoe);

        // ④ 급유기 — 슈 위 녹색 오일통 + 뚜껑 (PDF 13p ②)
        const lubX = shoeX - 0.01 * xSign;
        const lubY = 0.175;
        createBox(0.070, 0.085, 0.055, lubBody, lubX, lubY, railZ, shoe);
        createBox(0.074, 0.012, 0.059, lubLid,  lubX, lubY + 0.048, railZ, shoe);
        createBox(0.010, 0.016, 0.008, axMat, lubX + 0.030 * xSign, lubY + 0.048, railZ + 0.028, shoe);
        createCylinder(0.006, 0.006, 0.035, axMat, lubX, lubY - 0.055, railZ, shoe);

        shoe.position.set(0, H / 2 + 0.13, 0);
        return shoe;
      }

      rollerGuideGrp.add(
        createGuideShoe(1),
        createGuideShoe(-1)
      );
      carGrp.add(rollerGuideGrp);

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
      const lfW = S.CAR_W * 0.59;
      const lfX = S.CAR_W * 0.22;
      createBox(lfW, 0.020, 0.020, frmMat, 0, lfY,  0.20, ceilingGrp);
      createBox(lfW, 0.020, 0.020, frmMat, 0, lfY,  0,    ceilingGrp);
      createBox(lfW, 0.020, 0.020, frmMat, 0, lfY, -0.20, ceilingGrp);
      createBox(0.020, 0.020, 0.70, frmMat, -lfX, lfY, 0, ceilingGrp);
      createBox(0.020, 0.020, 0.70, frmMat,  lfX, lfY, 0, ceilingGrp);
      // 반투명 커버
      createBox(lfW, 0.010, 0.70, M.glass(), 0, lfY-0.012, 0, ceilingGrp);

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
      // 카 깊이 확장: 전면(도어) 고정을 위해 카 전체를 후방(CAR_CTR_Z)으로 이동.
      // 도어·도어오퍼레이터(로컬 +D/2)는 월드 CAR_FRONT_Z 에 그대로 남고,
      // 히치플레이트·크로스헤드·센서·거울 등 중심/후면 요소만 뒤로 이동한다.
      carGrp.position.z = CAR_CTR_Z;
      scene.add(carGrp);
    }

    /* ==========================================================================
       탑승자 (실사형 일반 성인 남성, 30~40대·일반 체형)
       프리미티브(원기둥·구·박스) 조합으로 인체 비율을 구성한다. carGrp의
       자식이므로 카와 함께 승강한다. 기본 숨김 → 버튼으로 승/하차 토글.
       ========================================================================== */
    function buildPassenger() {
      passengerGrp = new THREE.Group();
      const fig = passengerGrp;

      const matSkin  = new THREE.MeshStandardMaterial({ color: 0xd7a684, roughness: 0.72, metalness: 0.0 });
      const matHair  = new THREE.MeshStandardMaterial({ color: 0x24190f, roughness: 0.85, metalness: 0.05 });
      const matShirt = new THREE.MeshStandardMaterial({ color: 0x3f5c7a, roughness: 0.7,  metalness: 0.02 }); // 세미캐주얼 셔츠
      const matPants = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.82, metalness: 0.02 }); // 차콜 슬랙스
      const matShoe  = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.5,  metalness: 0.1 });
      const matBelt  = new THREE.MeshStandardMaterial({ color: 0x1c140d, roughness: 0.6,  metalness: 0.1 });
      const matEye   = new THREE.MeshStandardMaterial({ color: 0x201a15, roughness: 0.3,  metalness: 0.0 });
      const matBrow  = new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: 0.8,  metalness: 0.0 });
      const matMouth = new THREE.MeshStandardMaterial({ color: 0x9c5b50, roughness: 0.6,  metalness: 0.0 });

      function limb(rT, rB, len, mat, x, yc, z = 0) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, len, 16), mat);
        m.position.set(x, yc, z); m.castShadow = true; fig.add(m); return m;
      }
      function ball(r, mat, x, y, z = 0) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), mat);
        m.position.set(x, y, z); m.castShadow = true; fig.add(m); return m;
      }
      function slab(w, h, d, mat, x, y, z = 0) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z); m.castShadow = true; fig.add(m); return m;
      }

      // ── 다리·발 (양측 x=±0.10, +Z=도어 방향) ──
      [-0.10, 0.10].forEach(x => {
        slab(0.115, 0.07, 0.28, matShoe, x, 0.035, 0.055);       // 구두 (앞코 전방)
        limb(0.052, 0.075, 0.42, matPants, x, 0.28, 0);          // 정강이
        ball(0.075, matPants, x, 0.49);                          // 무릎
        limb(0.078, 0.11, 0.40, matPants, x, 0.69, 0);           // 허벅지
      });

      // ── 골반·벨트 (front-back 납작) ──
      limb(0.155, 0.185, 0.20, matPants, 0, 0.90).scale.z = 0.72;
      const belt = limb(0.19, 0.19, 0.05, matBelt, 0, 1.005); belt.scale.z = 0.72;

      // ── 몸통 (셔츠, 어깨>허리 테이퍼) ──
      const torso = limb(0.20, 0.155, 0.46, matShirt, 0, 1.24);
      torso.scale.set(1.05, 1, 0.66);
      ball(0.106, matShirt, -0.185, 1.45); // 어깨
      ball(0.106, matShirt,  0.185, 1.45);

      // ── 팔 (양측, 몸통 바깥으로 하강) ──
      [-1, 1].forEach(s => {
        const x = s * 0.225;
        limb(0.062, 0.05, 0.30, matShirt, x, 1.30);   // 상완 (소매)
        ball(0.05, matShirt, x, 1.15);                // 팔꿈치
        limb(0.05, 0.042, 0.28, matShirt, s * 0.235, 1.01); // 전완
        ball(0.055, matSkin, s * 0.24, 0.85);         // 손
      });

      // ── 목·머리 ──
      limb(0.053, 0.057, 0.12, matSkin, 0, 1.52);     // 목
      const head = ball(0.107, matSkin, 0, 1.66); head.scale.set(1.0, 1.08, 1.02); // 약간 세로 타원(남성 두상)
      // 머리카락 — 후방·상단 캡 (전방으로 밀지 않아 얼굴면 노출)
      const hair = ball(0.115, matHair, 0, 1.705, -0.03); hair.scale.set(1.05, 0.98, 1.05);
      ball(0.028, matSkin, -0.10, 1.655, -0.006); // 귀
      ball(0.028, matSkin,  0.10, 1.655, -0.006);
      const nose = ball(0.02, matSkin, 0, 1.636, 0.104); nose.scale.set(0.8, 1.15, 1.25); // 코 (돌출)
      ball(0.013, matEye, -0.038, 1.672, 0.100);  // 눈 (작게)
      ball(0.013, matEye,  0.038, 1.672, 0.100);
      slab(0.030, 0.008, 0.02, matBrow, -0.038, 1.694, 0.099); // 눈썹
      slab(0.030, 0.008, 0.02, matBrow,  0.038, 1.694, 0.099);
      slab(0.042, 0.009, 0.015, matMouth, 0, 1.601, 0.102);    // 입

      // 발끝(=얼굴)이 도어(+Z)를 향하도록 서 있음. 카 바닥면에 발을 올린다.
      passengerGrp.position.set(0.22, -S.CAR_H / 2 + 0.07, 0.10);
      passengerGrp.visible = false;
      carGrp.add(passengerGrp);
    }

    // 탑승자 승/하차 토글 — 승차 시 발밑에서 서서히 일어서는 연출
    function togglePassenger() {
      if (!passengerGrp) return false;
      const show = !passengerGrp.visible;
      passengerGrp.visible = show;
      if (show) {
        gsap.killTweensOf(passengerGrp.scale);
        passengerGrp.scale.set(1, 0.02, 1);
        gsap.to(passengerGrp.scale, { y: 1, duration: 0.5, ease: 'back.out(1.5)' });
      }
      return show;
    }

    /* ==========================================================================
       [추가] 도어 안전 스티커 텍스처 (실사 PNG)
       hand.png = 손대지 마시오 / lean.png = 기대면 추락 위험
       ========================================================================== */
    let stickerMats = null;
    function getStickerMats() {
      if (stickerMats) return stickerMats;
      const loader = new THREE.TextureLoader();
      function makeMat(path) {
        const tex = loader.load(path);
        tex.encoding = THREE.sRGBEncoding;
        return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      }
      stickerMats = {
        L: makeMat('assets/bg/hand.png'),
        R: makeMat('assets/bg/lean.png')
      };
      return stickerMats;
    }

    function buildCarDoors() {
      const dw = S.DOOR_W / 2 + 0.02, dh = S.DOOR_H * 0.9, dt = 0.04;
      const dz = S.CAR_D / 2 + dt / 2;
      const mats = getStickerMats();

      // ──────────────────────────────────────────────────────────────
      // 1. 카 도어 패널 본체 생성 (승강로 쪽 세로 리브 2개 포함)
      // ──────────────────────────────────────────────────────────────
      function makeDoor(xSign) {
        const g = new THREE.Group();
        // 기본 문짝
        createBox(dw, dh, dt, M.ss(0xa8aeb5), 0, 0, 0, g);
        // 유리창
        createBox(dw * 0.55, dh * 0.26, dt + 0.005, M.glass(), 0, dh * 0.3, 0, g); 
        
        // 주의 스티커
        const isLeftFromInside = xSign > 0;
        const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.132, 0.132), isLeftFromInside ? mats.L : mats.R);
        const stickerX = -xSign * 0.189;
        sticker.position.set(stickerX, 0.45 + dh * 0.1, -dt / 2 - 0.002);
        sticker.rotation.y = Math.PI; 
        g.add(sticker);

        // Safety Shoe (문 선단 고무 바)
        createBox(0.015, dh * 0.96, 0.05, M.paint(0x1a1a1a), -xSign * (dw / 2 + 0.012), 0, 0, g);

        // Door Guide Shoe (카실 홈을 타는 가이드)
        [-0.15, 0.15].forEach(gx => createBox(0.05, 0.035, 0.025, M.ss(0x7a828a), gx, -dh / 2 - 0.02, 0, g));

        // 패널 후면 세로 보강 리브 2줄 (스크린샷 152901 참조)
        [-dw * 0.22, dw * 0.22].forEach(rbx => {
          createBox(0.05, dh * 0.94, 0.012, M.ss(0x8f979e), rbx, 0, dt / 2 + 0.006, g);
        });

        return g;
      }
      carDoorL = makeDoor(-1); carDoorR = makeDoor(1);

      const cx = dw / 2 + 0.006, ox = dw * 1.5 - 0.01;
      const dy = S.CAR_H / 2 - dh / 2 - 0.055;
      carDoorL.position.set(-cx, dy, dz); carDoorR.position.set(cx, dy, dz);
      carDoorL.userData = { cx: -cx, ox: -ox }; carDoorR.userData = { cx: cx, ox: ox };
      carGrp.add(carDoorL, carDoorR);

      // ──────────────────────────────────────────────────────────────
      // 2. 카 도어 클러치 (벌림형 도어 베인) — device_china.mp4 t123.4/t125
      //    우측 문(carDoorR) 도어라인 중앙: 수직 블레이드 2 + 평행 링크 암
      //    승장 인터록 적층 롤러(월드 x≈0.015~0.045)를 사이에 두고 맞물림
      // ──────────────────────────────────────────────────────────────
      const clutchGrp = new THREE.Group();
      // 승장 어셈블리가 앞으로(HALL_SHIFT) 이동한 만큼 클러치도 전방 연장 → 인터록 적층 롤러 물림
      // Z: 승장 롤러 월드 ≈ FRONT_INNER_Z-0.025 에 블레이드 중심이 오도록 +0.004 보정
      clutchGrp.position.set(-cx, 0.42, dt / 2 + HALL_SHIFT + 0.004);
      const clutchBlk = M.paint(0x15181c);

      // 벌림형 클러치 블레이드 2개 — 승장 적층 롤러(월드 x≈0.02)를 사이에 두고 물림
      // 간격 ±0.078: 롤러 직경(~0.06) + 여유, 헤더 판과 간섭 없이 얕은 Z
      [-0.078, 0.078].forEach(vx => {
        createBox(0.028, 0.62, 0.014, clutchBlk, vx, 0, 0.006, clutchGrp);
        [0.25, -0.21].forEach(py => {
          const pb = createCylinder(0.010, 0.010, 0.010, M.ss(0xb8bec6), vx, py, 0.010, clutchGrp);
          pb.rotation.x = Math.PI / 2;
        });
      });
      // 중앙 피벗 플레이트 + 평행 링크 암 2 + 캠 롤러
      createBox(0.055, 0.32, 0.010, clutchBlk, 0.015, 0.02, 0.010, clutchGrp);
      [0.23, -0.19].forEach(ly => {
        const arm = createBox(0.185, 0.020, 0.008, M.ss(0x9aa2aa), 0, ly, 0.008, clutchGrp);
        arm.rotation.z = -0.28;
        const cr = createCylinder(0.016, 0.016, 0.012, M.ss(0xc4cad2), 0.015, ly + 0.015, 0.008, clutchGrp);
        cr.rotation.x = Math.PI / 2;
      });
      carDoorR.add(clutchGrp);

      // ──────────────────────────────────────────────────────────────
      // 3. 카 도어 오퍼레이터 — device_china.mp4 t139.4 (스크린샷 153043)
      //    흑색 헤더 + 상부 데크(모터·제어함) + 우측 대형 노란 구동 풀리
      //    + 좌측 리턴 아이들러 + 장·단 타이밍 벨트 (개폐 시 회전 연동)
      // ──────────────────────────────────────────────────────────────
      const doorHangerGrp = new THREE.Group();
      const opBlk = M.paint(0x17191d); // 흑색 구조재
      const opDark = M.paint(0x0e1013);
      const opSil = M.ss(0xb8bec6);    // 은색 가이드
      const beltMat = M.paint(0x111111);
      const dhZ = S.CAR_D / 2;         // Z축 도어 라인
      const zP = dhZ - 0.060;          // 풀리, 벨트 Z 평면

      // 3-1. 메인 흑색 헤더 플레이트 + 상부 데크 + 은색 리니어 레일
      createBox(S.CAR_W + 0.10, 0.46, 0.016, opBlk, 0, S.CAR_H / 2 + 0.30, dhZ + 0.002, doorHangerGrp);
      createBox(S.CAR_W + 0.10, 0.016, 0.17, opBlk, 0, S.CAR_H / 2 + 0.532, dhZ - 0.075, doorHangerGrp); // 상부 데크
      createBox(S.CAR_W + 0.02, 0.034, 0.028, opSil, 0, S.CAR_H / 2 + 0.115, dhZ - 0.026, doorHangerGrp); // 리니어 레일

      // 3-2. 우측단: 대형 노란 구동 풀리 (스핀 그룹 — 개폐 연동 회전)
      const pX = S.CAR_W / 2 - 0.12, pY = S.CAR_H / 2 + 0.30;
      const rBig = 0.16, rIdl = 0.055, rMot = 0.030;
      const drvGrp = new THREE.Group();
      drvGrp.position.set(pX, pY, zP);
      doorHangerGrp.add(drvGrp);
      const drvDisc = new THREE.Mesh(new THREE.CylinderGeometry(rBig, rBig, 0.046, 32), M.paint(0xf1c40f));
      drvDisc.rotation.x = Math.PI / 2;
      drvGrp.add(drvDisc);
      const drvRim = new THREE.Mesh(new THREE.TorusGeometry(rBig - 0.004, 0.010, 8, 32), M.paint(0xd9a90d));
      drvGrp.add(drvRim);
      // 방사형 스포크 홈 5줄 + 허브
      for (let si = 0; si < 5; si++) {
        const sa = si * Math.PI * 2 / 5;
        const spk = createBox(0.17, 0.020, 0.006, M.paint(0xd9a90d),
          Math.cos(sa) * 0.075, Math.sin(sa) * 0.075, -0.026, drvGrp);
        spk.rotation.z = sa;
      }
      const drvHub = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.062, 18), M.ss(0x8a929a));
      drvHub.rotation.x = Math.PI / 2;
      drvGrp.add(drvHub);
      const drvBore = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.066, 12), opDark);
      drvBore.rotation.x = Math.PI / 2;
      drvGrp.add(drvBore);

      // 3-3. 상부 데크: 도어 모터 (흑색 원통, 축 Z) + 마운트 + 모터 풀리
      const mX = pX - 0.28, mY = S.CAR_H / 2 + 0.60;
      const dmMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.15, 18), M.paint(0x1c2126));
      dmMotor.rotation.x = Math.PI / 2;
      dmMotor.position.set(mX, mY, zP - 0.075);
      doorHangerGrp.add(dmMotor);
      // 모터 후면 냉각핀 캡 + 전면 감속부
      const dmCap = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.060, 0.020, 18), opDark);
      dmCap.rotation.x = Math.PI / 2;
      dmCap.position.set(mX, mY, zP - 0.16);
      doorHangerGrp.add(dmCap);
      createBox(0.10, 0.055, 0.075, opBlk, mX, mY - 0.062, zP - 0.09, doorHangerGrp);  // 모터 받침
      createBox(0.13, 0.014, 0.11, opBlk, mX, mY - 0.092, zP - 0.085, doorHangerGrp);  // 마운트 판
      const motGrp = new THREE.Group();
      motGrp.position.set(mX, mY, zP);
      doorHangerGrp.add(motGrp);
      const dmPul = new THREE.Mesh(new THREE.CylinderGeometry(rMot, rMot, 0.026, 16), opSil);
      dmPul.rotation.x = Math.PI / 2;
      motGrp.add(dmPul);
      const dmBolt = createCylinder(0.008, 0.008, 0.012, opDark, 0, 0, -0.018, motGrp);
      dmBolt.rotation.x = Math.PI / 2;

      // 3-4. 모터 → 노란 풀리 사선 숏 타이밍 벨트 (양쪽 런)
      {
        const bdx = pX - mX, bdy = pY - mY;
        const bAng = Math.atan2(bdy, bdx);
        const bLen = Math.hypot(bdx, bdy) - rBig * 0.3;
        const px90 = -Math.sin(bAng), py90 = Math.cos(bAng); // 벨트 폭 방향
        [1, -1].forEach(sgn => {
          const off = sgn * (rMot + 0.004);
          const run = createBox(bLen, 0.010, 0.012, beltMat,
            (mX + pX) / 2 + px90 * off, (mY + pY) / 2 + py90 * off, zP, doorHangerGrp);
          run.rotation.z = bAng;
        });
      }

      // 3-5. 좌측단: 리턴 아이들러 풀리 + 흑색 단부 브라켓
      const tX = -S.CAR_W / 2 + 0.14;
      const idlGrp = new THREE.Group();
      idlGrp.position.set(tX, pY, zP);
      doorHangerGrp.add(idlGrp);
      const tenPulley = new THREE.Mesh(new THREE.CylinderGeometry(rIdl, rIdl, 0.038, 24), M.ss(0xaab2ba));
      tenPulley.rotation.x = Math.PI / 2;
      idlGrp.add(tenPulley);
      const tenRim = new THREE.Mesh(new THREE.TorusGeometry(rIdl - 0.003, 0.006, 8, 24), M.ss(0x8f979f));
      idlGrp.add(tenRim);
      createBox(0.11, 0.17, 0.012, opBlk, tX - 0.02, pY, zP - 0.030, doorHangerGrp); // 브라켓 후판
      createBox(0.11, 0.17, 0.012, opBlk, tX - 0.02, pY, zP + 0.026, doorHangerGrp); // 브라켓 전판
      const tenAx = createCylinder(0.010, 0.010, 0.070, opSil, tX, pY, zP, doorHangerGrp);
      tenAx.rotation.x = Math.PI / 2;

      // 3-6. 좌우를 잇는 장 타이밍 벨트 — 수평 런 + 노란 풀리 접선 경사 런
      const bendX = pX - 0.14;
      [1, -1].forEach(sgn => {
        const runY = pY + sgn * rIdl;
        const runLen = bendX - tX;
        createBox(runLen, 0.013, 0.012, beltMat, (tX + bendX) / 2, runY, zP, doorHangerGrp);
        // 타이밍 톱니 (약식 — 벨트 안쪽면)
        for (let tx = tX + 0.10; tx < bendX - 0.06; tx += 0.075) {
          createBox(0.014, 0.007, 0.014, M.paint(0x1c2126), tx, runY - sgn * 0.007, zP, doorHangerGrp);
        }
        // 경사 런: 수평 런 끝 → 노란 풀리 상/하 접선
        const edx = pX - bendX, edy = sgn * (rBig - rIdl);
        const eAng = Math.atan2(edy, edx);
        const eLen = Math.hypot(edx, edy);
        const seg = createBox(eLen, 0.013, 0.012, beltMat,
          (bendX + pX) / 2, runY + edy / 2, zP, doorHangerGrp);
        seg.rotation.z = eAng;
      });

      // 3-7. 상부 데크: 제어함 (흑색 박스) + 모터 케이블
      createBox(0.20, 0.14, 0.11, M.paint(0x22272d), -0.30, S.CAR_H / 2 + 0.61, dhZ - 0.075, doorHangerGrp);
      createBox(0.16, 0.012, 0.08, opDark, -0.30, S.CAR_H / 2 + 0.685, dhZ - 0.075, doorHangerGrp);
      const opCabPts = [
        new THREE.Vector3(-0.20, S.CAR_H / 2 + 0.62, dhZ - 0.11),
        new THREE.Vector3(mX - 0.35, S.CAR_H / 2 + 0.66, dhZ - 0.13),
        new THREE.Vector3(mX - 0.08, mY + 0.02, dhZ - 0.13),
        new THREE.Vector3(mX, mY, zP - 0.155)
      ];
      const opCab = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(opCabPts), 20, 0.007, 6, false),
        M.paint(0x0c0e10));
      doorHangerGrp.add(opCab);

      // 3-8. 스위치류 장식 (플레이트 배면)
      createBox(0.05, 0.07, 0.04, M.paint(0x374151), -0.05, S.CAR_H / 2 + 0.19, dhZ - 0.045, doorHangerGrp);
      createBox(0.05, 0.055, 0.04, M.paint(0x22272d), -S.CAR_W / 2 + 0.14, S.CAR_H / 2 + 0.22, dhZ - 0.048, doorHangerGrp);

      carGrp.add(doorHangerGrp);

      // 개폐 연동 회전 핸들 (ui.js openDoors/closeDoors onUpdate → spinDoorDrive)
      carGrp.userData.doorDrive = {
        pulley: drvGrp, idler: idlGrp, motorPul: motGrp,
        rBig: rBig, rIdl: rIdl, rMot: rMot, lastX: cx
      };

      // ──────────────────────────────────────────────────────────────
      // 4. 도어 행거 (Door Hanger) - 각 패널 자식, LM 캐리지 + 벨트 클램프
      // ──────────────────────────────────────────────────────────────
      [carDoorL, carDoorR].forEach((door, idx) => {
        const hangerGrp = new THREE.Group();
        const doorCx = idx === 0 ? -cx : cx;
        const side = idx === 0 ? -1 : 1;
        const hbX = -doorCx + side * 0.21;

        // 4-1. 크고 두꺼운 흑색 행거 판
        createBox(0.42, 0.24, 0.028, M.paint(0x17191d), hbX, 1.24, -0.090, hangerGrp);
        // 행거 판 볼트 4개
        [[-0.16, 1.19], [-0.16, 1.30], [0.16, 1.19], [0.16, 1.30]].forEach(([bx, by]) => {
          const hb = createCylinder(0.012, 0.012, 0.012, M.ss(0xb8bec6), hbX + bx, by, -0.108, hangerGrp);
          hb.rotation.x = Math.PI / 2;
        });

        // 4-2. LM 캐리지 블록 (리니어 레일을 뒤에서 감싸며 파지)
        [-0.13, 0.13].forEach(bxx => {
          createBox(0.08, 0.065, 0.055, M.ss(0xaab2ba), hbX + bxx, 1.115, -0.060, hangerGrp);
        });

        // 4-3. 도어 패널과 행거판을 잇는 스트랩 브라켓
        [-0.13, 0.13].forEach(bxx => {
          createBox(0.05, 0.19, 0.020, M.paint(0x1a1e23), hbX + bxx, 1.03, -0.045, hangerGrp);
          createBox(0.06, 0.06, 0.020, M.paint(0x1a1e23), hbX + bxx, 0.90, -0.029, hangerGrp);
        });

        // 4-4. 벨트 클램프 — 좌측 문 하단 런 / 우측 문 상단 런 (센터오프닝 역방향)
        const strandLocalY = (idx === 0 ? pY - rIdl : pY + rIdl) - dy; // 월드 벨트 런 → 도어 로컬
        createBox(0.09, 0.048, 0.036, M.paint(0x17191d), hbX, strandLocalY, -0.080, hangerGrp);
        [-0.025, 0.025].forEach(bxx => {
          const cb2 = createCylinder(0.007, 0.007, 0.010, M.ss(0x9aa2aa), hbX + bxx, strandLocalY, -0.100, hangerGrp);
          cb2.rotation.x = Math.PI / 2;
        });

        door.add(hangerGrp);
      });
    }

    /* 도어 개폐 ↔ 오퍼레이터 벨트·풀리·승장 연동로프·도어추 연동 (ui.js gsap onUpdate) */
    function spinDoorDrive(h) {
      const dd = carGrp && carGrp.userData.doorDrive;
      if (!dd) return;
      const x = carDoorR.position.x;
      const dx = x - dd.lastX;
      dd.lastX = x;
      if (!dx) return;
      dd.pulley.rotation.z -= dx / dd.rBig;
      dd.idler.rotation.z -= dx / dd.rIdl;
      dd.motorPul.rotation.z -= dx / dd.rMot;
      if (h && h.relPulley) h.relPulley.rotation.z -= dx / 0.085; // 좌단 연동 풀리
      if (h && h.relEndPulley) h.relEndPulley.rotation.z += dx / 0.055; // 우단 종단 풀리 (반대)
      // 도어추: 개도율에 따라 상승(스프링 인장) — 폐문력 표현
      if (h && h.doorWeight && h.doorWeight.userData.baseY != null) {
        const span = carDoorR.userData.ox - carDoorR.userData.cx;
        const openAmt = span ? (x - carDoorR.userData.cx) / span : 0;
        h.doorWeight.position.y = h.doorWeight.userData.baseY + openAmt * 0.09;
      }
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
      // 삼방틀(JAMB)은 승강로 전면벽 개구부에 정렬 (승장문보다 로비측, ~200mm 지점)
      const jambZ = FRONT_WALL_INNER_Z + S.WALL_T / 2 + 0.04;
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
          const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.132, 0.132), isLeftFromLobby ? mats.L : mats.R);
          const stickerX = -xSign * 0.189;
          sticker.position.set(stickerX, 0.45 + dh * 0.1, dt / 2 + 0.002);
          g.add(sticker);

          // Door Guide Shoe: 패널 하단 블록 (홀 실 홈 삽입)
          [-0.12, 0.12].forEach(gx => createBox(0.045, 0.030, 0.022, M.ss(0x7a828a), gx, -dh/2-0.015, 0, g));

          // 패널 후면(승강로 쪽) 세로 보강 리브 2줄 — PLAN 152901
          [-dw * 0.22, dw * 0.22].forEach(rbx => {
            createBox(0.05, dh * 0.94, 0.012, M.ss(0x777f88), rbx, 0, -dt / 2 - 0.006, g);
          });

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

        // ═══ H. 승장 도어 헤더 어셈블리 — device_china.mp4 1:57~2:20 전면 재구현 ═══
        //  흑색 헤더 플레이트(상부 슬롯 마운팅 브라켓) + 하단 각형 행거 레일
        //  + 좌측단 연동 로프 풀리(스포크 디스크) + 릴레이팅 케이블·턴버클
        //  + 행거판(대형 베어링 롤러 2 + 편심 업스러스트 롤러 2)
        //  + 우측 행거 인터록: 후크 록 레버 + 적층 롤러(클러치 물림) + 스프링 리프 접점
        const hdBlk = M.paint(0x17191d);
        const hdDark = M.paint(0x0e1013);
        const hdSil = M.ss(0xc4cad2);
        const hdSteel = M.ss(0x8f979f);
        const railY = fy + dh + 0.145;        // 행거 레일 중심
        const hdY = railY + 0.10;             // 헤더 판 중심
        // z 레이어링: 헤더 판은 승장도어 직전(뒤), 기구부는 판 앞(승강로 쪽)에 노출
        // — 영상처럼 승강로에서 인터록·행거·케이블이 모두 보이고 클러치와 간섭 없음
        const hdZ = FRONT_INNER_Z - 0.008;    // 헤더 판 Z (두께 0.010)
        const mechZ = FRONT_INNER_Z - 0.039;  // 풀리·케이블 Z 평면
        const hdW = S.DOOR_W + 0.40;

        // 베어링 롤러 헬퍼 (은색 외륜 + 암색 궤도 + 허브) — 영상 인터록 롤러 질감
        function addBearingRoller(parent, x, y, z, r) {
          const g = new THREE.Group();
          g.position.set(x, y, z);
          const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.022, 18), hdSil);
          disc.rotation.x = Math.PI / 2;
          g.add(disc);
          const race = new THREE.Mesh(new THREE.TorusGeometry(r * 0.68, 0.004, 6, 18), M.paint(0x14161a));
          race.position.z = -0.0115;
          g.add(race);
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.32, 0.028, 12), hdSteel);
          hub.rotation.x = Math.PI / 2;
          g.add(hub);
          parent.add(g);
          return g;
        }

        // 1. 헤더 플레이트 + 상부 절곡 플랜지 + 상부 슬롯 마운팅 브라켓 (t137.8)
        createBox(hdW, 0.30, 0.010, hdBlk, 0, hdY, hdZ, scene);
        createBox(hdW, 0.020, 0.070, hdBlk, 0, hdY + 0.16, hdZ - 0.030, scene);
        [-(S.DOOR_W / 2 - 0.10), S.DOOR_W / 2 - 0.10].forEach(bx => {
          createBox(0.13, 0.15, 0.012, hdBlk, bx, hdY + 0.245, hdZ - 0.02, scene);
          [-0.035, 0, 0.035].forEach(sx => {
            createBox(0.014, 0.10, 0.016, hdDark, bx + sx, hdY + 0.245, hdZ - 0.02, scene);
          });
        });
        // 헤더 판 볼트열 (승강로측 전면)
        for (let hbX = -hdW / 2 + 0.12; hbX <= hdW / 2 - 0.11; hbX += 0.35) {
          const hcb = createCylinder(0.006, 0.006, 0.010, M.ss(0x6a7278), hbX, hdY + 0.115, hdZ - 0.008, scene);
          hcb.rotation.x = Math.PI / 2;
        }

        // 2. 각형 행거 레일 (도어 행거 롤러가 타는 레일 — 클러치 블레이드보다 승강로 쪽)
        createBox(S.DOOR_W + 0.30, 0.030, 0.020, hdSteel, 0, railY, hz - 0.066, scene);

        // 3. 연동로프 풀리 — 좌단(구동) → 횡단 → 우단(종단 아이들러)에서 끝남 (현장 해설)
        const cabX0 = -(S.DOOR_W / 2 + 0.03), cabX1 = S.DOOR_W / 2 + 0.12;
        const ropeY = hdY + 0.02;
        const ropeR = 0.085;
        function makeRelPulley(r) {
          const g = new THREE.Group();
          const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.018, 24), hdSil);
          disc.rotation.x = Math.PI / 2;
          g.add(disc);
          const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.003, 0.006, 8, 24), hdSteel);
          g.add(rim);
          for (let bi = 0; bi < 6; bi++) {
            const ba = bi * Math.PI / 3;
            const rb2 = createCylinder(0.006, 0.006, 0.010, hdSteel,
              Math.cos(ba) * r * 0.58, Math.sin(ba) * r * 0.58, -0.012, g);
            rb2.rotation.x = Math.PI / 2;
          }
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.20, r * 0.20, 0.030, 12), hdDark);
          hub.rotation.x = Math.PI / 2;
          g.add(hub);
          return g;
        }
        const relGrp = makeRelPulley(ropeR);
        relGrp.position.set(cabX0, ropeY, mechZ);
        scene.add(relGrp);
        hatchDoors[i].relPulley = relGrp;
        // 우단 종단 롤러 — 연동로프가 여기서 끝남
        const relEndGrp = makeRelPulley(0.055);
        relEndGrp.position.set(cabX1, ropeY, mechZ);
        scene.add(relEndGrp);
        hatchDoors[i].relEndPulley = relEndGrp;
        createBox(0.034, 0.12, 0.014, hdBlk, cabX1 + 0.028, ropeY, mechZ - 0.012, scene);

        // 4. 릴레이팅 케이블: 좌 풀리 감김 → 상·하행 횡단 → 우 풀리에서 종단
        const ropeMat = M.paint(0xb8bec6);
        [ropeR, -ropeR].forEach(cy => {
          const span = cabX1 - cabX0 - 0.02;
          const cab = createCylinder(0.0022, 0.0022, span, ropeMat,
            (cabX0 + cabX1) / 2, ropeY + cy, mechZ, scene);
          cab.rotation.z = Math.PI / 2;
        });
        // 좌 풀리 반원 감김(상·하 연결) + 우 풀리 종단 루프
        [-1, 1].forEach(sgn => {
          const wrap = createCylinder(0.0020, 0.0020, ropeR * 1.15, ropeMat,
            cabX0 - ropeR * 0.55, ropeY, mechZ, scene);
          wrap.rotation.z = Math.PI / 2;
          wrap.rotation.y = sgn * 0.55;
        });
        createCylinder(0.0020, 0.0020, 0.07, ropeMat, cabX1 + 0.01, ropeY, mechZ, scene)
          .rotation.z = Math.PI / 2;
        // 턴버클 (상행 중앙)
        const tbY = ropeY + ropeR;
        const tbRod = createCylinder(0.005, 0.005, 0.11, hdSil, 0.05, tbY, mechZ, scene);
        tbRod.rotation.z = Math.PI / 2;
        [-0.045, 0.045].forEach(tx => {
          createBox(0.022, 0.018, 0.016, hdDark, 0.05 + tx, tbY, mechZ, scene);
        });

        // 4b. 도어추(웨이트) + 폐문 스프링 — 헤더 우측 하단 (자동 폐문력)
        const wtGrp = new THREE.Group();
        wtGrp.position.set(cabX1 - 0.02, fy + dh + 0.02, mechZ + 0.008);
        createCylinder(0.003, 0.003, 0.18, ropeMat, 0, 0.10, 0, wtGrp); // 현수 로프
        for (let si = 0; si < 5; si++) {
          const sc = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0035, 6, 12), hdSteel);
          sc.rotation.x = Math.PI / 2;
          sc.position.set(0, 0.16 + si * 0.012, 0);
          wtGrp.add(sc);
        }
        createBox(0.055, 0.09, 0.040, hdBlk, 0, 0, 0, wtGrp);       // 웨이트 블록
        createBox(0.048, 0.012, 0.034, hdSteel, 0, -0.052, 0, wtGrp);
        wtGrp.userData.baseY = wtGrp.position.y;
        scene.add(wtGrp);
        hatchDoors[i].doorWeight = wtGrp;

        // 4c. 삼각키 비상해정 — 로비측 키홀·레버 (시각만, 애니메이션 최소)
        const triKeyGrp = new THREE.Group();
        triKeyGrp.position.set(-S.DOOR_W / 2 + 0.08, fy + dh + 0.18, jambZ + 0.028);
        createBox(0.055, 0.070, 0.014, hdBlk, 0, 0, 0, triKeyGrp);
        const keyHole = createCylinder(0.010, 0.010, 0.016, hdDark, 0, 0.008, 0.008, triKeyGrp);
        keyHole.rotation.x = Math.PI / 2;
        // 삼각 슬롯 표시
        createBox(0.016, 0.004, 0.004, hdSil, 0, 0.008, 0.016, triKeyGrp);
        createBox(0.004, 0.014, 0.004, hdSil, 0, 0.002, 0.016, triKeyGrp);
        createBox(0.028, 0.006, 0.008, hdSteel, 0.022, -0.018, 0.006, triKeyGrp); // 연동 레버
        scene.add(triKeyGrp);
        hatchDoors[i].triKey = triKeyGrp;

        // ─── 승장 도어 행거 + 인터록 (각 패널 자식 — 개폐 연동) ───
        [hl, hr].forEach((door, idx) => {
          const hHgGrp = new THREE.Group();
          const railLy = dh / 2 + 0.085; // 도어 로컬 레일 중심 (railY - dy)

          // 1. 흑색 행거판 (패널 상부 중앙)
          createBox(0.40, 0.17, 0.014, hdBlk, 0, dh / 2 + 0.065, -0.080, hHgGrp);
          [[-0.16, 0.03], [-0.16, 0.115], [0.16, 0.03], [0.16, 0.115]].forEach(([bx, by]) => {
            const hb2 = createCylinder(0.010, 0.010, 0.010, M.ss(0xb8bec6), bx, dh / 2 + by, -0.068, hHgGrp);
            hb2.rotation.x = Math.PI / 2;
          });

          // 2. 가이드 롤러 4곳 (레일 상·하) — 덮개판으로 대부분 가림 (실사처럼 조금만 노출)
          [-0.14, 0.14].forEach(rx => {
            // 상면 주행 롤러 (소형)
            const rolG = new THREE.Group();
            rolG.position.set(rx, railLy + 0.048, -0.066);
            const rol = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.016, 16), M.ss(0x9aa2aa));
            rol.rotation.x = Math.PI / 2;
            rolG.add(rol);
            const tire = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 16), M.paint(0x14161a));
            rolG.add(tire);
            hHgGrp.add(rolG);
            // 하면 업스러스트 소형 롤러
            const uRol = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.014, 12), M.paint(0x14161a));
            uRol.rotation.x = Math.PI / 2;
            uRol.position.set(rx, railLy - 0.030, -0.066);
            hHgGrp.add(uRol);
            // 가림 덮개 (승강로측) — 롤러 상·하 대부분 숨김, 하단/틈만 노출
            createBox(0.095, 0.11, 0.010, hdBlk, rx, railLy + 0.010, -0.052, hHgGrp);
            createBox(0.078, 0.022, 0.008, hdSteel, rx, railLy + 0.062, -0.048, hHgGrp); // 상단 슬롯 립
          });

          // 4. 릴레이팅 케이블 클램프 (행거판 상단 — 좌우 도어가 상·하행에 교차 체결)
          createBox(0.055, 0.030, 0.020, hdDark, idx === 0 ? 0.10 : -0.10,
            (ropeY + (idx === 0 ? ropeR : -ropeR)) - dy, -0.062, hHgGrp);

          // 5. 도어 인터록 (우측 패널 hr) — 후크 록 + 적층 롤러 + 돼지발(이중) 보조접점
          //    카 베인(클러치)이 적층 롤러를 물고 레버를 젖혀 해정
          if (idx === 1) {
            const ilX = 0.02 - cx; // 닫힘 기준 월드 X≈+0.02 — 클러치 블레이드 사이

            // 인터록 베이스 브라켓
            createBox(0.13, 0.17, 0.012, hdBlk, ilX + 0.035, dh / 2 + 0.10, -0.030, hHgGrp);
            // 상단 고정 롤러 (적층 상단 — 클러치 맞물림)
            addBearingRoller(hHgGrp, ilX, dh / 2 + 0.115, -0.045, 0.030);
            // 수직 조정 스터드 + 코일 스프링
            createCylinder(0.004, 0.004, 0.095, hdSil, ilX + 0.090, dh / 2 + 0.185, -0.040, hHgGrp);
            for (let si = 0; si < 4; si++) {
              const sc = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0035, 6, 12), hdSteel);
              sc.rotation.x = Math.PI / 2;
              sc.position.set(ilX + 0.090, dh / 2 + 0.150 + si * 0.014, -0.040);
              hHgGrp.add(sc);
            }

            // ── 가동 록 레버: 하부 롤러 + 후크 암 + 접점 브리지 ──
            const hookGrp = new THREE.Group();
            hookGrp.position.set(ilX, dh / 2 + 0.115, -0.062);
            createBox(0.052, 0.115, 0.012, hdDark, 0.014, -0.052, 0, hookGrp);
            // 하부 적층 롤러 (클러치 물림 짝)
            addBearingRoller(hookGrp, 0.012, -0.070, 0.017, 0.030);
            // 후크 암 → -x로 뻗어 키퍼 핀을 감쌈
            const hkArm = createBox(0.155, 0.026, 0.012, hdDark, -0.078, -0.036, 0, hookGrp);
            hkArm.rotation.z = 0.12;
            createBox(0.026, 0.058, 0.012, hdDark, -0.150, -0.068, 0, hookGrp);
            createBox(0.034, 0.018, 0.012, hdDark, -0.146, -0.094, 0, hookGrp);
            // 접점 브리지 (메인)
            const brg = createBox(0.080, 0.045, 0.010, hdSil, 0.022, 0.052, 0, hookGrp);
            brg.rotation.z = -0.15;
            [0, 0.036].forEach(bxx => {
              createCylinder(0.008, 0.008, 0.022, hdSil, 0.004 + bxx, 0.082, 0, hookGrp);
            });
            hHgGrp.add(hookGrp);
            hatchDoors[i].hook = hookGrp;
          }

          door.add(hHgGrp);
        });

        // ─── 인터록 고정부 (헤더측) — 키퍼 핀 + 돼지발(이중) 접점 + 보조접점 ───
        const keepGrp = new THREE.Group();
        keepGrp.position.set(-0.095, fy + dh + 0.085, FRONT_INNER_Z - 0.042);
        createBox(0.045, 0.095, 0.012, hdBlk, 0, 0.045, -0.004, keepGrp);
        const keepPin = createCylinder(0.010, 0.010, 0.045, hdSil, 0, 0, 0.004, keepGrp);
        keepPin.rotation.x = Math.PI / 2;
        scene.add(keepGrp);

        // 돼지발 이중 접점 하우징 (메인 2열 리프)
        const ilSwGrp = new THREE.Group();
        ilSwGrp.position.set(0.042, fy + dh + 0.225, FRONT_INNER_Z - 0.042);
        const swBox = createBox(0.090, 0.055, 0.048, M.paint(0x1a1a1a), 0, 0, 0, ilSwGrp);
        swBox.userData = { type: 'interlock' };
        // 이중 리프(돼지발) — 좌·우 쌍
        [-0.022, 0.022].forEach(sx => {
          [-0.012, 0.012].forEach(sz => {
            const leaf = createBox(0.005, 0.048, 0.014, hdSil, sx, -0.048, sz, ilSwGrp);
            leaf.rotation.z = sx > 0 ? -0.10 : 0.10;
            leaf.userData = { type: 'interlockLeaf' };
          });
        });
        createBox(0.055, 0.012, 0.036, hdSteel, 0, 0.033, 0, ilSwGrp);
        // 보조접점 박스 (옆)
        const auxBox = createBox(0.040, 0.038, 0.032, M.paint(0x22272d), 0.070, -0.010, 0, ilSwGrp);
        auxBox.userData = { type: 'interlockAux' };
        [-0.008, 0.008].forEach(sx => {
          createBox(0.004, 0.028, 0.012, hdSil, 0.070 + sx, -0.040, 0, ilSwGrp);
        });
        scene.add(ilSwGrp);
        hatchDoors[i].ilSwitch = ilSwGrp;

        // Hall Sill + Support: 층별 문턱
        // 승장 문턱은 승장문 바로 앞(로비측)에 위치 — 카 문턱과 SILL_GAP 이격 (관통 방지)
        const hallSillZ = FRONT_INNER_Z + 0.04;   // 코(−Z) ≈ 카 문턱 코 + 30mm
        createBox(S.DOOR_W+0.25, 0.05, 0.10, sillMat, 0, fy - 0.025, hallSillZ, scene);
        // 경사 리브 브래킷 3개
        [-0.30, 0, 0.30].forEach(bx => {
          const rib = createBox(0.012, 0.12, 0.10, M.ss(0x7a828a), bx, fy - 0.09, hallSillZ, scene);
          rib.rotation.x = -0.25;
        });

        // Toe Guard: 실 직하 수직판 (승장 문턱 −Z 코 아래로 하강)
        createBox(S.DOOR_W+0.15, 0.40, 0.012, M.ss(0x868e96),
          0, fy - 0.225, hallSillZ - 0.05, scene);
      }

      // Fascia Plate (벽보호판): 층간 전면 수직판 (1↔2, 2↔3, 3↔4)
      // 하단 기준을 "그 층 도어 헤더 어셈블리 상단"으로 올림. (기존 fy+0.90은 아래층
      // 도어 개구부 상반부까지 내려와 문을 열어도 사람이 못 타고 머리를 부딪는 구조였음)
      // 헤더 상단 = fy + dh(=DOOR_H*0.9) + 0.565(레일 0.145 + 헤더판 0.10 + 슬롯브라켓 0.32)
      const fasciaBotOff = S.DOOR_H * 0.9 + 0.60; // 헤더 상단 + 소폭 여유 ≈ fy + 2.49
      for (let i = 0; i < FLOORS - 1; i++) {
        const fasciaBot = FLOOR_Y[i] + fasciaBotOff; // 아래층 헤더 위에서 시작
        const fasciaTop = FLOOR_Y[i+1];              // 윗층 실 하단(토가드)과 연결
        const fasciaH = fasciaTop - fasciaBot;
        if (fasciaH > 0) {
          createBox(S.DOOR_W+0.30, fasciaH, 0.010, M.ss(0x9aa2aa),
            0, fasciaBot + fasciaH / 2, FRONT_INNER_Z - 0.035, scene);
        }
      }

      syncAllIndicators('1', '');
    }


    function buildCounterWeight() {
      cwtGrp = new THREE.Group();
      const fMat = M.ss(0x1f2937); // 프레임
      const blkMat = M.paint(0x374151); // 웨이트 블록
      const yH = S.CWT_H / 2;
      
      // 수직 프레임 채널 (업라이트)
      createBox(0.05, S.CWT_H, 0.10, fMat, -S.CWT_W/2 + 0.025, 0, 0, cwtGrp);
      createBox(0.05, S.CWT_H, 0.10, fMat,  S.CWT_W/2 - 0.025, 0, 0, cwtGrp);
      // 상하 크로스헤드 (플랭크)
      createBox(S.CWT_W, 0.08, 0.10, fMat, 0, -yH + 0.04, 0, cwtGrp);
      createBox(S.CWT_W, 0.08, 0.10, fMat, 0,  yH - 0.04, 0, cwtGrp);

      // 앞뒤 커버 프레임 대신 웨이트 블록들이 사이에 쌓인 형태
      for (let i = 0; i < 20; i++) {
        const blkW = S.CWT_W - 0.12; 
        const blkH = (S.CWT_H - 0.2) / 20;
        createBox(blkW, blkH - 0.01, S.CWT_D - 0.02, blkMat, 0, -yH + 0.08 + (i + 0.5) * blkH, 0, cwtGrp);
      }

      // 가이드 슈 (상/하 2쌍)
      const shoeMat = M.paint(0x2a2a2a);
      [-S.CWT_W/2, S.CWT_W/2].forEach(sx => {
        createBox(0.06, 0.10, 0.06, shoeMat, sx,  yH, 0, cwtGrp); // 상부 슈
        createBox(0.06, 0.10, 0.06, shoeMat, sx, -yH, 0, cwtGrp); // 하부 슈
      });

      // 1:1 바빗식 로프 히치 (균형추 상부)
      const hitchPlateY = yH + 0.05;
      createBox(0.36, 0.02, 0.16, M.paint(0xb8680a), 0, hitchPlateY, 0, cwtGrp);
      
      const babbittMat = M.paint(0x334455);
      const springMat = M.ss(0xd0d5da);
      const silvMat = M.ss(0xb0b5bb);
      for (let i = 0; i < 5; i++) {
        const rx = -0.06 + i * 0.03;
        // 히치 로드
        createCylinder(0.007, 0.007, 0.25, silvMat, rx, hitchPlateY + 0.12, 0, cwtGrp);
        // 완충 스프링
        createCylinder(0.015, 0.015, 0.10, springMat, rx, hitchPlateY + 0.06, 0, cwtGrp);
        // 너트
        createCylinder(0.018, 0.018, 0.01, silvMat, rx, hitchPlateY + 0.01, 0, cwtGrp);
        createCylinder(0.018, 0.018, 0.01, silvMat, rx, hitchPlateY + 0.11, 0, cwtGrp);
        
        // 바빗 소켓 몸통 (원뿔형)
        const socketGeo = new THREE.CylinderGeometry(0.012, 0.025, 0.12, 16);
        const socketMesh = new THREE.Mesh(socketGeo, babbittMat);
        socketMesh.position.set(rx, hitchPlateY + 0.20, 0);
        cwtGrp.add(socketMesh);
      }

      // 카가 1층일 때 균형추는 상부에 있어야 하며, 카가 4층까지 올라가도 피트 아래로 내려가지 않게 기준을 맞춤
      const cwtBottomClearance = 0.35;
      const carTravel = FLOOR_Y[FLOORS - 1] - FLOOR_Y[0];
      const cwtTopStartY = Y0 + cwtBottomClearance + S.CWT_H / 2 + carTravel;
      cwtGrp.position.set(0, cwtTopStartY, CWT_CENTER_Z);
      scene.add(cwtGrp);
    }

    // 와이어로프 12mm — 꼬임 무늬 텍스처 (공유)
    let _wireRopeMat = null;
    function getWireRopeMat() {
      if (_wireRopeMat) return _wireRopeMat;
      const c = document.createElement('canvas');
      c.width = 128; c.height = 32;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2e3236';
      ctx.fillRect(0, 0, 128, 32);
      for (let i = -40; i < 160; i += 7) {
        ctx.strokeStyle = '#121416';
        ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 40, 32); ctx.stroke();
        ctx.strokeStyle = '#6a727a';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(i + 2.5, 0); ctx.lineTo(i + 42.5, 32); ctx.stroke();
        ctx.strokeStyle = '#454c52';
        ctx.lineWidth = 1.0;
        ctx.beginPath(); ctx.moveTo(i + 5, 0); ctx.lineTo(i + 45, 32); ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(24, 1);
      tex.anisotropy = 4;
      _wireRopeMat = new THREE.MeshStandardMaterial({
        map: tex, color: 0xffffff, roughness: 0.72, metalness: 0.55
      });
      return _wireRopeMat;
    }

    function buildWireRopes() {
      const ud = mrGrp.userData;
      const rMat = getWireRopeMat();
      const ropeR = 0.006; // Ø12mm
      // 5가닥: 카 수직 → 메인시브 감김 호 → 공통 외접선 → 현수도르래 감김 호 → 균형추 수직
      for (let i = 0; i < 5; i++) {
        const rx = -0.06 + i * 0.03;
        const mesh = new THREE.Mesh(new THREE.BufferGeometry(), rMat);
        mesh.castShadow = true;
        ropeObjs.push({
          line: mesh,
          defY: ud.defY, defZ: ud.defZ, defCenterZ: ud.defCenterZ, defR: ud.defRadius,
          mainY: ud.mainY, mainZ: ud.mainZ, mainR: ud.mainR,
          rx: rx, ropeR: ropeR
        });
        scene.add(mesh);
      }
      refreshRopes();
      refreshGovernorRope();
    }

    function refreshRopes() {
      const cy = carGrp.position.y + S.CAR_H / 2 + 0.68;
      const wy = cwtGrp.position.y + S.CWT_H / 2 + 0.31;
      ropeObjs.forEach(r => {
        const Rm = r.mainR, Rd = r.defR;
        // (z,y) 평면 기하 — 각도 a 기준: 점 = 중심 + R(cos a, sin a), a=0 전면(+Z) / π/2 상단 / π 후면(-Z)
        const dz = r.defCenterZ - r.mainZ, dy = r.defY - r.mainY;
        const D = Math.hypot(dz, dy);
        // 메인시브·현수도르래 두 원의 상부 공통 외접선 법선각 — 로프가 두 시브 위를 감고 넘어감
        let tanA = Math.atan2(dy, dz) - Math.acos((Rm - Rd) / D);
        if (tanA < 0) tanA += Math.PI * 2;
        const pts = [new THREE.Vector3(r.rx, cy, CAR_CTR_Z)]; // 카 히치 → 메인시브 전면 접점(Z=CAR_CTR_Z) 수직 상승
        const arc = (cz, cyc, R, a0, a1, n) => {
          for (let i = 0; i <= n; i++) {
            const a = a0 + (a1 - a0) * i / n;
            pts.push(new THREE.Vector3(r.rx, cyc + R * Math.sin(a), cz + R * Math.cos(a)));
          }
        };
        arc(r.mainZ, r.mainY, Rm, 0, tanA, 22);           // 메인시브 감김 호 (전면 접점 → 접선 이탈점)
        arc(r.defCenterZ, r.defY, Rd, tanA, Math.PI, 12); // 접선 직선 후 현수도르래 감김 호 (→ 후면 수직 이탈)
        pts.push(new THREE.Vector3(r.rx, wy, cwtGrp.position.z)); // 후면 접점에서 균형추 히치로 수직 하강
        const path = new THREE.CurvePath();
        for (let i = 0; i < pts.length - 1; i++) {
          path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
        }
        const geo = new THREE.TubeGeometry(path, 96, r.ropeR, 7, false);
        if (r.line.geometry) r.line.geometry.dispose();
        r.line.geometry = geo;
      });
    }

    // 실사 와이어로프 2구간(조속기휠→클램프, 클램프→인장시브)의 위치·길이·기울기만 갱신한다.
    // 메시·지오메트리는 environment.js에서 이미 만들어 두었다 (렌더 루프 생성 금지).
    const _ropeUp = new THREE.Vector3(0, 1, 0);
    const _ropeA = new THREE.Vector3(), _ropeB = new THREE.Vector3(), _ropeDir = new THREE.Vector3();

    function refreshGovernorRope() {
      if (!govRopeSegs || !govRopeData) return;

      let clampY = carGrp.position.y - S.CAR_H / 2 - 0.16;
      let clampZ = govRopeData.z; // 기본값 -0.37

      if (carGrp.userData.safetyGear && carGrp.userData.safetyGear.shaft) {
        const theta = carGrp.userData.safetyGear.shaft.rotation.x;
        clampY = carGrp.position.y - S.CAR_H / 2 - 0.16 + 0.22 * Math.sin(theta);
        clampZ = (CAR_CTR_Z - 0.15) - 0.22 * Math.cos(theta); // 카 중심 추종 (base -0.15)
      }

      const ends = [
        [govRopeData.topY, govRopeData.z, clampY, clampZ],   // 상부 구간
        [clampY, clampZ, govRopeData.botY, govRopeData.z]    // 하부 구간
      ];
      ends.forEach(([y0, z0, y1, z1], i) => {
        const seg = govRopeSegs[i];
        _ropeA.set(govRopeData.x, y0, z0);
        _ropeB.set(govRopeData.x, y1, z1);
        _ropeDir.subVectors(_ropeB, _ropeA);
        const len = _ropeDir.length();
        if (len < 1e-5) { seg.visible = false; return; }
        seg.visible = true;
        seg.position.addVectors(_ropeA, _ropeB).multiplyScalar(0.5);
        seg.quaternion.setFromUnitVectors(_ropeUp, _ropeDir.divideScalar(len));
        seg.scale.set(1, len, 1);
      });
    }

    /* ==========================================================================
       조속기 트립/복귀 — CAD형 상단암·라체트 걸림 (environment.js §7)
       호출: ui.js startOverspeedFault() → governorTrip() / governorReset()
       ========================================================================== */
    let governorPhase = 'rest'; // rest | tripping | tripped | resetting
    let govSpinDir = 1;         // 트립 직전 휠 회전 부호 (+1 = rotation.z 증가 = 카 하강)

    function govHandles() { return (mrGrp && mrGrp.userData && mrGrp.userData.governor) || null; }

    /* 과속 트립 — 2단계 (16:10 육성 지시: "떡판이 로프를 홈에 눌러 잡아준다")
       ① 진자 원심 개방과 휠 관성 주행을 시작
       ② 낙하: 쇄기 물림 + 캐치 암(+CCW) + 스위치 플런저 타격 = 같은 시각
       ③ 파지: 물린 발톱을 휠이 끌고 가며 레버를 반대(-CW)로 돌린다 →
              레버 우단에서 내려온 떡판(캐치슈)이 로프를 시브 홈에 눌러 잡는다.
              이때 휠·라체트가 함께 끌리다 멈춘다 = 로프 정지. */
    function governorTrip(spinDir, onLocked) {
      const gov = govHandles(); if (!gov || governorPhase !== 'rest') return null;
      governorPhase = 'tripping';
      govSpinDir = spinDir;
      const pose = gov.pose.trip, wheel = gov.wheel, g = gov.geom;
      const arm = gov.topArm || gov.catcherArm;
      const W = wheel.rotation.z;
      const coast = Math.PI * 2 * 1.15;
      let rem = (-(W + spinDir * coast)) % g.toothStep;
      if (spinDir > 0 && rem < 0) rem += g.toothStep;
      if (spinDir < 0 && rem > 0) rem -= g.toothStep;
      const Wstop = W + spinDir * coast + rem;
      const drag = spinDir * Math.abs(pose.ratchet);
      const armTrip = g.armRot0 + pose.topArm;
      const sprTrip = pose.spring;
      const plungerHit = (g.plungerX0 || 0) + Math.abs(pose.switchLever || 0.010);

      const tl = gsap.timeline();
      // 진자 개방 — 물림 시각에 맞춰 끝남
      const lockT = 0.38;
      tl.to(gov.pendulums[0].rotation, { z: g.pendRot0[0] + pose.pendulum, duration: lockT, ease: 'power2.out' }, 0);
      tl.to(gov.pendulums[1].rotation, { z: g.pendRot0[1] + pose.pendulum, duration: lockT, ease: 'power2.out' }, 0);
      // 뒷면 연동 링크(타이바·인장 스프링)도 같은 개방각으로 따라간다
      if (gov.setLinkage) {
        const lk = { v: gov.pendulums[0].rotation.z - g.pendRot0[0] };
        tl.to(lk, { v: pose.pendulum, duration: lockT, ease: 'power2.out',
                    onUpdate: () => gov.setLinkage(lk.v) }, 0);
      }
      tl.to(wheel.rotation, { z: Wstop, duration: 0.55, ease: 'power2.out' }, 0);
      // ★동시 물림: 쇄기(캐치 일체)·암·스프링·스위치
      tl.to(gov.pawl.rotation, { z: g.pawlRot0 + (pose.pawl || 0), duration: 0.14, ease: 'power4.in' }, lockT);
      tl.to(arm.rotation, { z: armTrip, duration: 0.14, ease: 'power4.in' }, lockT);
      if (gov.spring) tl.to(gov.spring.scale, { y: sprTrip, duration: 0.14, ease: 'power2.in' }, lockT);
      if (gov.switchLever) tl.to(gov.switchLever.position, { x: plungerHit, duration: 0.14, ease: 'back.out(2.0)' }, lockT);
      // ③ 파지 — 휠이 물린 발톱을 끌고 가며 레버를 반대로 돌린다 → 떡판이 로프를 문다
      //    ★gripT 를 물림 완료(lockT+0.14) 뒤로 충분히 떼어 놓아야 스위치 타격이 보인다.
      //      붙여 놓으면 플런저가 눌리자마자 되돌아가 한 프레임도 안 남는다.
      const grip = gov.pose.grip;
      const rat0 = gov.ratchet.rotation.z;
      const gripT = lockT + 0.24;
      tl.add(() => { if (onLocked) onLocked(); }, gripT + 0.10);  // 로프 파지 → 카 급정지
      tl.to(gov.ratchet.rotation, { z: rat0 + drag, duration: 0.40, ease: 'power3.out' }, gripT);
      tl.to(wheel.rotation, { z: Wstop + drag, duration: 0.40, ease: 'power3.out' }, gripT);
      if (grip) {
        tl.to(arm.rotation, { z: g.armRot0 + grip.topArm, duration: 0.40, ease: 'power3.out' }, gripT);
        if (gov.spring) tl.to(gov.spring.scale, { y: grip.spring, duration: 0.40, ease: 'power2.out' }, gripT);
        if (gov.switchLever) tl.to(gov.switchLever.position,
          { x: (g.plungerX0 || 0) + grip.switchLever, duration: 0.40, ease: 'power2.out' }, gripT);
      }
      tl.add(() => { governorPhase = 'tripped'; });
      return tl;
    }

    /* 복귀: 암·스프링 대기각 → 라체트·휠 역회전 → 진자 복귀 → 스위치 플런저 복귀 */
    function governorReset(onDone) {
      const gov = govHandles(); if (!gov || governorPhase !== 'tripped') return null;
      governorPhase = 'resetting';
      const wheel = gov.wheel;
      const arm = gov.topArm || gov.catcherArm;
      const ratRot = gov.ratchet.rotation.z;
      const w1 = wheel.rotation.z - ratRot;
      const w2 = w1 - govSpinDir * 0.55;
      const plunger0 = (gov.geom && gov.geom.plungerX0 != null) ? gov.geom.plungerX0 : 0;

      const tl = gsap.timeline();
      tl.to(arm.rotation, { z: gov.geom.armRot0, duration: 0.55, ease: 'power2.inOut' }, 0);
      if (gov.spring) tl.to(gov.spring.scale, { y: gov.geom.sprScale0 || 1, duration: 0.55, ease: 'power2.inOut' }, 0);
      if (gov.switchLever) tl.to(gov.switchLever.position, { x: plunger0, duration: 0.35, ease: 'power2.inOut' }, 0.05);
      tl.to(gov.pawl.rotation, { z: gov.geom.pawlRot0, duration: 0.50, ease: 'power2.inOut' }, 0.15);
      tl.to(gov.ratchet.rotation, { z: 0, duration: 0.55, ease: 'power2.inOut' }, 0);
      tl.to(wheel.rotation, { z: w1, duration: 0.55, ease: 'power2.inOut' }, 0);
      tl.to(wheel.rotation, { z: w2, duration: 0.80, ease: 'power1.inOut' }, 0.55);
      tl.to(gov.pendulums[0].rotation, { z: gov.geom.pendRot0[0], duration: 0.80, ease: 'power2.inOut' }, 0.55);
      tl.to(gov.pendulums[1].rotation, { z: gov.geom.pendRot0[1], duration: 0.80, ease: 'power2.inOut' }, 0.55);
      if (gov.setLinkage) {
        const lk = { v: gov.pendulums[0].rotation.z - gov.geom.pendRot0[0] };
        tl.to(lk, { v: 0, duration: 0.80, ease: 'power2.inOut',
                    onUpdate: () => gov.setLinkage(lk.v) }, 0.55);
      }
      
      // 세이프티 기어 복귀 애니메이션 (웨지 하강·샤프트 복원·스프링 신장)
      const sg = carGrp.userData.safetyGear;
      if (sg && sg.shaft) {
        tl.to(sg.shaft.rotation, { x: 0, duration: 0.65, ease: 'power2.inOut' }, 0);
        tl.to([sg.liftL.position, sg.liftR.position], { y: 0, duration: 0.65, ease: 'power2.inOut' }, 0);
        (sg.wedges || []).forEach(w => tl.to(w.position, { z: w.userData.z0 !== undefined ? w.userData.z0 : w.position.z, duration: 0.65, ease: 'power2.inOut' }, 0));
        (sg.springs || []).forEach(spr => tl.to(spr.scale, { y: 1.0, duration: 0.55, ease: 'power2.inOut' }, 0));
      }
      tl.eventCallback("onUpdate", () => { refreshGovernorRope(); });

      tl.add(() => { governorPhase = 'rest'; if (onDone) onDone(); });
      return tl;
    }
