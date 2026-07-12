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
      /* ──────────────────────────────────────────────────────────────
         B. 추락방지 비상정지장치 (Safety Gear) & 하부 가이드 슈 (이설 렌더링 복원)
      ────────────────────────────────────────────────────────────── */
      const safetyGearGrp = new THREE.Group();
      const sgMat = M.paint(0xb8860b);
      const wedgeMat = M.paint(0x4a3520);
      const bShoeMat = M.paint(0x6b3a1f);
      
      const cShaftGrp = new THREE.Group();
      cShaftGrp.position.set(0, -H/2 - 0.16, -0.15); // 수평 작동 샤프트 Z 위치
      safetyGearGrp.add(cShaftGrp);
      const cShaft = createCylinder(0.012, 0.012, S.CAR_BG - 0.10, silvMat, 0, 0, 0, cShaftGrp);
      cShaft.rotation.z = Math.PI / 2;

      // 조속기 로프 연동 암 및 클램프 (샤프트 우측 단부 부근)
      createBox(0.175, 0.018, 0.26, silvMat, GOV_TENS_X - 0.0875, 0, -0.10, cShaftGrp);
      const safetyClampMesh = createBox(0.025, 0.09, 0.025, silvMat, GOV_TENS_X, 0, -0.22, cShaftGrp);

      const liftGrpL = new THREE.Group(); liftGrpL.position.set(0, 0, 0); safetyGearGrp.add(liftGrpL);
      const liftGrpR = new THREE.Group(); liftGrpR.position.set(0, 0, 0); safetyGearGrp.add(liftGrpR);
      const uSprings = [];

      const sgUprightX = S.CAR_BG / 2 - 0.06;
      [-sgUprightX, sgUprightX].forEach(sx => {
        const xs = sx > 0 ? 1 : -1;
        const rodX = sx + xs*0.015;
        const sgY  = -H/2 - 0.16;
        const liftGrp = sx < 0 ? liftGrpL : liftGrpR;

        // 하우징
        createBox(0.20, 0.022, 0.20, sgMat, sx, -H/2-0.055, 0.04, safetyGearGrp);
        createBox(0.20, 0.022, 0.20, sgMat, sx, -H/2-0.265, 0.04, safetyGearGrp);
        createBox(0.16, 0.188, 0.062, sgMat, sx, sgY, 0.04-0.069, safetyGearGrp);
        createBox(0.16, 0.188, 0.062, sgMat, sx, sgY, 0.04+0.069, safetyGearGrp);

        // 쐐기 및 리프트 구조물
        createBox(0.030, 0.16, 0.024, wedgeMat, rodX, sgY, 0.04-0.030, liftGrp);
        createBox(0.030, 0.16, 0.024, wedgeMat, rodX, sgY, 0.04+0.030, liftGrp);

        [0.04-0.093, 0.04+0.093].forEach(zf => {
          const uSpring = new THREE.Mesh(new THREE.TorusGeometry(0.070, 0.012, 8, 14, Math.PI), M.paint(0xc46a1e));
          uSpring.position.set(sx, sgY + 0.06, zf);
          safetyGearGrp.add(uSpring);
          uSprings.push(uSpring);
          createCylinder(0.010, 0.010, 0.13, M.paint(0xc46a1e), sx - 0.070, sgY - 0.005, zf, safetyGearGrp);
          createCylinder(0.010, 0.010, 0.13, M.paint(0xc46a1e), sx + 0.070, sgY - 0.005, zf, safetyGearGrp);
        });

        // 샤프트 양단 쐐기 상승 크랭크 암
        const crankArm = createBox(0.02, 0.02, 0.07, M.paint(0x4a3566), sx, 0, 0.035, cShaftGrp);
        const linkRod = createCylinder(0.008, 0.008, 0.12, silvMat, rodX, sgY + 0.12, -0.08, liftGrp);
        
        // 하부 가이드 슈 (세이프티 하우징 하단)
        const bottomShoeY = -H/2 - 0.32;
        createBox(0.14, 0.08, 0.06, bShoeMat, sx, bottomShoeY, 0.04, safetyGearGrp);
        createBox(0.024, 0.08, 0.06, bShoeMat, sx - xs*0.025, bottomShoeY, 0.04, safetyGearGrp);
        createBox(0.018, 0.08, 0.01, bShoeMat, sx - xs*0.025, bottomShoeY, 0.04 - 0.032, safetyGearGrp);
        createBox(0.018, 0.08, 0.01, bShoeMat, sx - xs*0.025, bottomShoeY, 0.04 + 0.032, safetyGearGrp);
      });

      carGrp.add(safetyGearGrp);

      // 외부 연동용
      carGrp.userData.safetyGear = {
        shaft: cShaftGrp,
        liftL: liftGrpL,
        liftR: liftGrpR,
        uSprings: uSprings,
        clamp: safetyClampMesh
      };

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
      scene.add(carGrp);
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
      // 2. 카 도어 클러치 메커니즘 (도어 베인) - 우측 문(carDoorR)에 중앙 부착
      // ──────────────────────────────────────────────────────────────
      const clutchGrp = new THREE.Group();
      clutchGrp.position.set(-cx, 0.35, dt / 2); // 정중앙 맞물림 위치
      const clutchBlk = M.paint(0x15181c);
      
      // 벌림형 클러치 블레이드 2개
      [-0.085, 0.085].forEach(vx => {
        createBox(0.024, 0.58, 0.024, clutchBlk, vx, 0, 0.016, clutchGrp); 
        // 롤러가 물릴 피벗 축
        [0.24, -0.20].forEach(py => { 
          const pb = createCylinder(0.010, 0.010, 0.008, M.ss(0xb8bec6), vx, py, 0.022, clutchGrp);
          pb.rotation.x = Math.PI / 2;
        });
      });
      // 평행 암(Arm) 2개
      [0.22, -0.18].forEach(ly => {
        const arm = createBox(0.185, 0.020, 0.008, M.ss(0x9aa2aa), 0, ly, 0.024, clutchGrp);
        arm.rotation.z = -0.28;
      });
      carDoorR.add(clutchGrp);

      // ──────────────────────────────────────────────────────────────
      // 3. 카 도어 오퍼레이터 (스크린샷 153043: 노란 구동 풀리와 타이밍 벨트)
      // ──────────────────────────────────────────────────────────────
      const doorHangerGrp = new THREE.Group();
      const opBlk = M.paint(0x15181c); // 흑색 구조재
      const opSil = M.ss(0xb8bec6);    // 은색 가이드
      const dhZ = S.CAR_D / 2;         // Z축 도어 라인
      const zP = dhZ - 0.060;          // 풀리, 벨트 Z 평면

      // 3-1. 메인 흑색 베이스 플레이트 및 리니어 가이드 레일
      createBox(S.CAR_W + 0.10, 0.44, 0.016, opBlk, 0, S.CAR_H / 2 + 0.28, dhZ + 0.002, doorHangerGrp);
      createBox(S.CAR_W + 0.02, 0.034, 0.028, opSil, 0, S.CAR_H / 2 + 0.115, dhZ - 0.026, doorHangerGrp); // 은색 리니어 레일

      // 3-2. 우측단: 노란색 거대 구동 풀리와 상단 도어 모터 연결
      const pX = S.CAR_W / 2 - 0.15, pY = S.CAR_H / 2 + 0.26;
      const drvPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.048, 28), M.paint(0xf1c40f));
      drvPulley.rotation.x = Math.PI / 2;
      drvPulley.position.set(pX, pY, zP);
      doorHangerGrp.add(drvPulley);
      
      const drvHub = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.058, 16), M.ss(0x8a929a));
      drvHub.rotation.x = Math.PI / 2;
      drvHub.position.set(pX, pY, zP);
      doorHangerGrp.add(drvHub);

      const mY = pY + 0.21;
      const dmMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.13, 16), M.paint(0x2b3138));
      dmMotor.rotation.x = Math.PI / 2;
      dmMotor.position.set(pX - 0.08, mY, zP - 0.04);
      doorHangerGrp.add(dmMotor);
      
      const dmPul = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.024, 14), opSil);
      dmPul.rotation.x = Math.PI / 2;
      dmPul.position.set(pX - 0.08, mY, zP);
      doorHangerGrp.add(dmPul);
      createBox(0.12, 0.016, 0.090, opBlk, pX - 0.04, mY + 0.055, zP - 0.045, doorHangerGrp); // 모터 마운트

      // 모터와 노란 풀리 연결 숏벨트 (비스듬한 사선)
      const beltLenShort = 0.22;
      const shortBelt = createBox(beltLenShort, 0.012, 0.010, M.paint(0x111111), pX - 0.04, pY + 0.10, zP, doorHangerGrp);
      shortBelt.rotation.z = Math.PI / 2.7;

      // 3-3. 좌측단: 은색 텐션 롤러(풀리)
      const tX = -S.CAR_W / 2 + 0.10;
      const tenPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.040, 24), M.ss(0xaab2ba));
      tenPulley.rotation.x = Math.PI / 2;
      tenPulley.position.set(tX, pY, zP);
      doorHangerGrp.add(tenPulley);

      // 3-4. 좌우를 잇는 가로 타이밍 벨트
      const beltLen = pX - tX;
      [1, -1].forEach(sgn => {
        const strand = createBox(beltLen, 0.014, 0.012, M.paint(0x111111), (pX + tX) / 2, pY + sgn * 0.105, zP, doorHangerGrp);
        // 타이밍 톱니 형상 (약식)
        for (let tx = tX + 0.12; tx < pX - 0.12; tx += 0.08) {
          createBox(0.016, 0.008, 0.014, M.paint(0x1c2126), tx, pY + sgn * 0.095, zP, doorHangerGrp);
        }
      });

      // 3-5. 스위치류 장식 (플레이트 배면)
      createBox(0.05, 0.07, 0.04, M.paint(0x374151), -0.05, S.CAR_H / 2 + 0.19, dhZ - 0.045, doorHangerGrp);
      createBox(0.05, 0.055, 0.04, M.paint(0x22272d), -S.CAR_W / 2 + 0.14, S.CAR_H / 2 + 0.22, dhZ - 0.048, doorHangerGrp);
      
      carGrp.add(doorHangerGrp);

      // ──────────────────────────────────────────────────────────────
      // 4. 도어 행거 (Door Hanger Boxes) - 각 패널 자식으로 동작에 연동
      // ──────────────────────────────────────────────────────────────
      [carDoorL, carDoorR].forEach((door, idx) => {
        const hangerGrp = new THREE.Group();
        const doorCx = idx === 0 ? -cx : cx;
        const side = idx === 0 ? -1 : 1;
        const hbX = -doorCx + side * 0.21; 

        // 4-1. 크고 두꺼운 흑색 행거 박스
        createBox(0.40, 0.24, 0.028, M.paint(0x15181c), hbX, 1.24, -0.090, hangerGrp);
        // 행거 박스의 롤러 볼트 4개
        [[-0.15, 1.19], [-0.15, 1.30], [0.15, 1.19], [0.15, 1.30]].forEach(([bx, by]) => {
          const hb = createCylinder(0.012, 0.012, 0.012, M.ss(0xb8bec6), hbX + bx, by, -0.108, hangerGrp);
          hb.rotation.x = Math.PI / 2;
        });

        // 4-2. LM 캐리지 블록 (리니어 레일을 뒤에서 감싸며 파지)
        [-0.13, 0.13].forEach(bxx => {
          createBox(0.08, 0.065, 0.055, M.ss(0xaab2ba), hbX + bxx, 1.115, -0.060, hangerGrp);
        });

        // 4-3. 도어 패널과 행거박스를 잇는 스트랩 브라켓
        [-0.13, 0.13].forEach(bxx => {
          createBox(0.05, 0.19, 0.020, M.paint(0x1a1e23), hbX + bxx, 1.03, -0.045, hangerGrp);
          createBox(0.06, 0.06, 0.020, M.paint(0x1a1e23), hbX + bxx, 0.90, -0.029, hangerGrp);
        });

        // 4-4. 가로 벨트를 물어주는 벨트 클램프
        const strandLocalY = idx === 0 ? 1.165 : 1.375; // 좌측은 하단 벨트, 우측은 상단 벨트
        createBox(0.08, 0.040, 0.035, M.paint(0x15181c), hbX, strandLocalY, -0.080, hangerGrp);

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
        // 헤더 케이스 볼트열 (상·하 플랜지 체결부 디테일 — PLAN)
        for (let hbX = -0.75; hbX <= 0.76; hbX += 0.30) {
          [0.135, -0.135].forEach(hbY => {
            const hcb = createCylinder(0.006, 0.006, 0.008, M.ss(0x6a7278),
              hbX, hcY + hbY, FRONT_INNER_Z - 0.038, scene);
            hcb.rotation.x = Math.PI / 2;
          });
        }

        // ─── 승장 도어 행거 및 인터록 래치 (유튜브 기반 전면 개편) ───
        [hl, hr].forEach((door, idx) => {
          const hHgGrp = new THREE.Group();
          const doorCx = idx === 0 ? -cx : cx;
          const side = idx === 0 ? -1 : 1;
          const hpX = -doorCx + side * 0.18; 

          // 1. 흑색 행거판
          createBox(S.DOOR_W * 0.26, 0.16, 0.014, M.paint(0x1a1e23), hpX, dh / 2 + 0.10, -0.08, hHgGrp);

          // 2. 행거 롤러 (상단 휠 2개)
          const hRollerSpan = S.DOOR_W * 0.09;
          [-hRollerSpan, hRollerSpan].forEach(rx => {
            const rol = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.040, 0.020, 12), M.ss(0x9aa2aa));
            rol.rotation.x = Math.PI / 2;
            rol.position.set(hpX + rx, dh / 2 + 0.155, -0.082);
            hHgGrp.add(rol);
            const tire = new THREE.Mesh(new THREE.TorusGeometry(0.040, 0.008, 8, 18), M.paint(0x14161a));
            tire.position.set(hpX + rx, dh / 2 + 0.155, -0.082);
            hHgGrp.add(tire);
            const axB = createCylinder(0.007, 0.007, 0.008, M.ss(0x5a6068), hpX + rx, dh / 2 + 0.155, -0.068, hHgGrp);
            axB.rotation.x = Math.PI / 2;
          });

          // 3. 편심 업스러스트 롤러 (하단 이탈 방지)
          [-hRollerSpan - 0.05, hRollerSpan + 0.05].forEach(rx => {
            const uRol = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.016, 10), M.paint(0x14161a));
            uRol.rotation.x = Math.PI / 2;
            uRol.position.set(hpX + rx, dh / 2 + 0.065, -0.082);
            hHgGrp.add(uRol);
          });

          // 4. 도어 인터록 장치 (스크린샷 152838 기반) — 우측 패널(hr, idx=1)에 부착
          if (idx === 1) {
            // 인터록 베이스 브라켓 (튼튼한 흑색 L자형 판넬)
            createBox(0.12, 0.14, 0.012, M.paint(0x15181c), -doorCx, dh / 2 + 0.06, -0.05, hHgGrp);

            // 클러치가 물리는 은색 롤러 2개 (상하 배치)
            [-0.04, 0.04].forEach(ry => {
              const ilRol = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 12), M.ss(0xc4cad2));
              ilRol.rotation.x = Math.PI / 2;
              ilRol.position.set(-doorCx - 0.02, dh / 2 + 0.06 + ry, -0.035);
              hHgGrp.add(ilRol);
            });

            // 갈고리형 래치 (후크) - 롤러 축에서 피벗되어 반대편으로 뻗어나감
            const lkGrp = new THREE.Group();
            lkGrp.position.set(-doorCx - 0.02, dh / 2 + 0.02, -0.04);
            const lkArm = createBox(0.12, 0.024, 0.012, M.ss(0xb0b6be), -0.06, 0, 0, lkGrp);
            lkArm.rotation.z = 0.15; // 살짝 꺾여 내려감
            createBox(0.024, 0.050, 0.012, M.ss(0xb0b6be), -0.11, -0.025, 0, lkGrp); // 갈고리 하단 팁
            hHgGrp.add(lkGrp);
          }

          // 5. 걸쇠 핀 (캐치) — 좌측 패널(hl, idx=0)에 부착되어 우측의 후크가 걸림
          if (idx === 0) {
            createBox(0.020, 0.016, 0.012, M.ss(0x8a929a), -doorCx - 0.15, dh / 2 + 0.04, -0.04, hHgGrp);
            createCylinder(0.009, 0.009, 0.030, M.ss(0xc4cad2), -doorCx - 0.15, dh / 2 + 0.05, -0.04, hHgGrp); // 수직 핀
          }

          door.add(hHgGrp);
        });

        // 6. Interlock Switch (헤더 고정측 스위치 박스 및 접점 단자)
        // 갈고리 래치가 닫히면서 접점을 누르는 스크린샷 152838 구조 반영
        const ilSwGrp = new THREE.Group();
        // 닫혔을 때 우측 후크 팁과 좌측 걸쇠 핀이 만나는 중앙부(월드 X = -0.12, Y = dy + dh/2 + 0.04 부근) 헤더 프레임
        ilSwGrp.position.set(-0.13, dy + dh/2 + 0.05, FRONT_INNER_Z - 0.045);
        
        // 스위치 박스 (검은색 튼튼한 케이스)
        const swBox = createBox(0.04, 0.06, 0.035, M.paint(0x1a1a1a), 0, 0, 0, ilSwGrp);
        swBox.userData = { type: 'interlock' }; // 로직용 태그
        // 노출된 은색 접점 단자 (래치가 닿는 부분)
        createBox(0.015, 0.005, 0.020, M.ss(0xc4cad2), 0.015, -0.015, 0.01, ilSwGrp);
        createBox(0.015, 0.005, 0.020, M.ss(0xc4cad2), 0.015, 0.005, 0.01, ilSwGrp);

        scene.add(ilSwGrp);

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
        const pts = [new THREE.Vector3(r.rx, cy, 0)]; // 카 히치 → 메인시브 전면 접점(Z=0) 수직 상승
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

    function refreshGovernorRope() {
      if (!govRopeLine || !govRopeData) return;
      
      let clampY = carGrp.position.y - S.CAR_H / 2 - 0.16;
      let clampZ = govRopeData.z; // 기본값 -0.37

      if (carGrp.userData.safetyGear && carGrp.userData.safetyGear.shaft) {
        const theta = carGrp.userData.safetyGear.shaft.rotation.x;
        clampY = carGrp.position.y - S.CAR_H / 2 - 0.16 + 0.22 * Math.sin(theta);
        clampZ = -0.15 - 0.22 * Math.cos(theta);
      }

      const pts = [
        new THREE.Vector3(govRopeData.x, govRopeData.topY, govRopeData.z),
        new THREE.Vector3(govRopeData.x, clampY, clampZ),
        new THREE.Vector3(govRopeData.x, govRopeData.botY, govRopeData.z)
      ];
      govRopeLine.geometry.setFromPoints(pts);
    }

    /* ==========================================================================
       조속기 트립/복귀 — CAD형 상단암·라체트 걸림 (environment.js §7)
       호출: ui.js startOverspeedFault() → governorTrip() / governorReset()
       ========================================================================== */
    let governorPhase = 'rest'; // rest | tripping | tripped | resetting
    let govSpinDir = 1;         // 트립 직전 휠 회전 부호 (+1 = rotation.z 증가 = 카 하강)

    function govHandles() { return (mrGrp && mrGrp.userData && mrGrp.userData.governor) || null; }

    /* 과속 트립 (CAD 시퀀스)
       ① 진자 원심 개방 → ② 스위치 레버 제낌 → ③ 휠 관성 감속
       ④ 상단암 하향(훅→라체트 걸림) + 스프링 압축 → ⑤ 라체트·휠 동반 견인 후 정지 */
    function governorTrip(spinDir, onLocked) {
      const gov = govHandles(); if (!gov || governorPhase !== 'rest') return null;
      governorPhase = 'tripping';
      govSpinDir = spinDir;
      const pose = gov.pose.trip, wheel = gov.wheel, g = gov.geom;
      const arm = gov.topArm || gov.catcherArm;
      const W = wheel.rotation.z;
      const coast = Math.PI * 2 * 1.15;
      // 톱니 정렬 — 관성 주행 후 toothStep 격자 스냅
      let rem = (-(W + spinDir * coast)) % g.toothStep;
      if (spinDir > 0 && rem < 0) rem += g.toothStep;
      if (spinDir < 0 && rem > 0) rem -= g.toothStep;
      const Wstop = W + spinDir * coast + rem;
      const drag = spinDir * Math.abs(pose.ratchet);
      const armTrip = g.armRot0 + pose.topArm;
      const sprTrip = pose.spring;

      const tl = gsap.timeline();
      tl.to(gov.pendulums[0].rotation, { z: g.pendRot0[0] + pose.pendulum, duration: 0.35, ease: 'power2.out' }, 0);
      tl.to(gov.pendulums[1].rotation, { z: g.pendRot0[1] + pose.pendulum, duration: 0.35, ease: 'power2.out' }, 0);
      tl.to(gov.switchLever.rotation,
        { z: -spinDir * Math.abs(pose.switchLever), duration: 0.12, ease: 'back.out(2.5)' }, 0.28);
      tl.to(wheel.rotation, { z: Wstop, duration: 0.60, ease: 'power2.out' }, 0);
      // 훅 걸림 — 제동자 진입 + 상단암 하향 + 스프링 압축
      tl.to(gov.pawl.rotation, { z: g.pawlRot0 + (pose.pawl || 0), duration: 0.14, ease: 'power4.in' }, 0.46);
      tl.to(arm.rotation, { z: armTrip, duration: 0.18, ease: 'power4.in' }, 0.48);
      if (gov.spring) tl.to(gov.spring.scale, { y: sprTrip, duration: 0.18, ease: 'power2.in' }, 0.48);
      tl.add(() => { if (onLocked) onLocked(); }, 0.58);
      // 걸린 채 짧게 끌림
      const rat0 = gov.ratchet.rotation.z;
      tl.to(gov.ratchet.rotation, { z: rat0 + drag, duration: 0.40, ease: 'power3.out' }, 0.58);
      tl.to(wheel.rotation, { z: Wstop + drag, duration: 0.40, ease: 'power3.out' }, 0.58);
      tl.add(() => { governorPhase = 'tripped'; });
      return tl;
    }

    /* 복귀: 암·스프링 대기각 → 라체트·휠 역회전 → 진자 복귀 → 스위치 솔레노이드 복귀 */
    function governorReset(onDone) {
      const gov = govHandles(); if (!gov || governorPhase !== 'tripped') return null;
      governorPhase = 'resetting';
      const wheel = gov.wheel;
      const arm = gov.topArm || gov.catcherArm;
      const ratRot = gov.ratchet.rotation.z;
      const w1 = wheel.rotation.z - ratRot;
      const w2 = w1 - govSpinDir * 0.55;

      const tl = gsap.timeline();
      tl.to(arm.rotation, { z: gov.geom.armRot0, duration: 0.55, ease: 'power2.inOut' }, 0);
      if (gov.spring) tl.to(gov.spring.scale, { y: gov.geom.sprScale0 || 1, duration: 0.55, ease: 'power2.inOut' }, 0);
      tl.to(gov.pawl.rotation, { z: gov.geom.pawlRot0, duration: 0.50, ease: 'power2.inOut' }, 0.15);
      tl.to(gov.ratchet.rotation, { z: 0, duration: 0.55, ease: 'power2.inOut' }, 0);
      tl.to(wheel.rotation, { z: w1, duration: 0.55, ease: 'power2.inOut' }, 0);
      tl.to(wheel.rotation, { z: w2, duration: 0.80, ease: 'power1.inOut' }, 0.55);
      tl.to(gov.pendulums[0].rotation, { z: gov.geom.pendRot0[0], duration: 0.80, ease: 'power2.inOut' }, 0.55);
      tl.to(gov.pendulums[1].rotation, { z: gov.geom.pendRot0[1], duration: 0.80, ease: 'power2.inOut' }, 0.55);
      
      // 세이프티 기어 복귀 애니메이션 (하부 수평 샤프트)
      const sg = carGrp.userData.safetyGear;
      if (sg) {
        tl.to(sg.shaft.rotation, { x: 0, duration: 0.65, ease: 'power2.inOut' }, 0);
        tl.to([sg.liftL.position, sg.liftR.position], { y: 0, duration: 0.65, ease: 'power2.inOut' }, 0);
        sg.uSprings.forEach(spr => {
          tl.to(spr.scale, { z: 1.0, duration: 0.55, ease: 'power2.inOut' }, 0);
        });
      }
      tl.eventCallback("onUpdate", () => { refreshGovernorRope(); });

      tl.to(gov.resetPin.position, { x: '+=0.018', duration: 0.22, ease: 'power3.out' }, 1.35);
      tl.to(gov.resetBracket.position, { x: '+=0.018', duration: 0.22, ease: 'power3.out' }, 1.37);
      tl.to(gov.switchLever.rotation, { z: 0, duration: 0.28, ease: 'power2.inOut' }, 1.45);
      tl.to(gov.resetPin.position, { x: '-=0.018', duration: 0.28, ease: 'power2.in' }, 1.80);
      tl.to(gov.resetBracket.position, { x: '-=0.018', duration: 0.28, ease: 'power2.in' }, 1.80);
      tl.add(() => { governorPhase = 'rest'; if (onDone) onDone(); });
      return tl;
    }
