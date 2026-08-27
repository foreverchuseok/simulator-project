/* =============================================================================
   ARCHIVE ONLY — index.html does not load this file.
   2026-08-17 카 재공사: 화면에서 카 본체·실내·체대·에이프런·세이프티기어·탑승자를
   제거하기 전에 js/elevator.js 에서 복사한 원본이다.

   사용법
   - 부품을 다시 올릴 때 해당 구간만 js/elevator.js 의 스텁 함수로 옮긴다.
   - 카 그룹(carGrp) 위치·주 로프·조속기 로프·균형추 움직임은 앱에 남아 있다.
   - 세이프티기어 GLB: assets/safety_gear.glb (삭제 금지)
   - 안내서: docs/CAR-REBUILD.md

   의존 전역: S, M, THREE, scene, carGrp, passengerGrp, FLOOR_Y, CAR_CTR_Z,
   createBox, createCylinder, gsap
   ============================================================================= */

    function buildCarCabin() {
      carGrp = new THREE.Group();
      const W = S.CAR_W, D = S.CAR_D, H = S.CAR_H;
      const titaniumMat = M.pvdTitanium();
      const titaniumDk  = M.pvdTitanium(0xb8ad9e);

      // ──────────────────────────────────────────────────────────────
      // 1. 전망용 좌/우 측면 유리벽 (사용자 요청: 전망용 좌우 투명 유리 유지)
      // ──────────────────────────────────────────────────────────────
      const transparentBlueGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0xc5d8ec, // 밝은 샴페인 블루 틴트
        transmission: 0.92,
        opacity: 0.55,
        transparent: true,
        roughness: 0.04,
        ior: 1.52,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        side: THREE.DoubleSide
      });
      // 좌측/우측 전망 유리벽
      createBox(0.025, H, D, transparentBlueGlassMat, -W / 2, 0, 0, carGrp);
      createBox(0.025, H, D, transparentBlueGlassMat,  W / 2, 0, 0, carGrp);

      // 유리벽 상하단 슬림 티타늄 글래스 서포트 몰딩
      [-W / 2, W / 2].forEach(gx => {
        createBox(0.04, 0.04, D, titaniumDk, gx,  H / 2 - 0.02, 0, carGrp); // 상단 몰딩
        createBox(0.04, 0.05, D, titaniumDk, gx, -H / 2 + 0.025, 0, carGrp); // 하단 몰딩
      });

      // ──────────────────────────────────────────────────────────────
      // 2. 카 후면 럭셔리 인테리어 월 (수직 슬릿 플루티드 티타늄 패널 + 샴페인 메탈)
      //    참조: grok_image_1786678132161.jpg (Vertical Slit / Fluted Champagne Titanium)
      // ──────────────────────────────────────────────────────────────
      const rearZ = -D / 2 + 0.02;
      // 후면 베이스 백월
      createBox(W + 0.04, H, 0.025, titaniumDk, 0, 0, -D / 2, carGrp);
      createBox(W - 0.04, H - 0.08, 0.015, titaniumMat, 0, 0, rearZ, carGrp);

      // 수직 플루티드(Vertical Slit Flutes) 스트립 배열 (3D 음영과 프리미엄 선형 입체감 연출)
      const fluteCount = 28;
      const fluteW = 0.024, fluteDepth = 0.008;
      const fluteSpacing = (W - 0.20) / fluteCount;
      const fluteMat = M.pvdTitanium(0xe4dbd0);
      for (let i = 0; i <= fluteCount; i++) {
        const fx = -(W - 0.20) / 2 + i * fluteSpacing;
        createBox(fluteW, H - 0.12, fluteDepth, fluteMat, fx, 0, rearZ + 0.010, carGrp);
      }

      // 후면 중앙 포인트 세로 인레이 및 상하 간접광 섀도우 몰딩
      createBox(W - 0.06, 0.015, 0.025, M.pvdTitanium(0xeee6da), 0,  H / 2 - 0.06, rearZ + 0.015, carGrp);
      createBox(W - 0.06, 0.015, 0.025, M.pvdTitanium(0xeee6da), 0, -H / 2 + 0.06, rearZ + 0.015, carGrp);

      // ──────────────────────────────────────────────────────────────
      // 3. 카 바닥 (대리석 네로 마르퀴나 보더 인레이 & 티타늄 걸레받이)
      // ──────────────────────────────────────────────────────────────
      createBox(W - 0.02, 0.07, D - 0.02, M.luxuryMarble(), 0, -H / 2 + 0.035, 0, carGrp);
      // 바닥 코너 샴페인 티타늄 스커팅(걸레받이)
      createBox(W - 0.04, 0.035, 0.012, titaniumDk, 0, -H / 2 + 0.085, -D / 2 + 0.025, carGrp); // 후면

      // ──────────────────────────────────────────────────────────────
      // 4. 카 천장 & 코브 간접조명 (Perimeter Cove Indirect Lighting)
      //    참조: grok_image_1786678132161.jpg (상단 3000K 샴페인 웜화이트 간접조명 라인)
      // ──────────────────────────────────────────────────────────────
      const ceilY = H / 2 - 0.03;
      // 천장 외장 구조 슬래브
      createBox(W + 0.05, 0.05, D + 0.05, titaniumDk, 0, H / 2 + 0.025, 0, carGrp);
      // 천장 리세스 패널 (다크 샴페인 그래파이트)
      createBox(W - 0.16, 0.02, D - 0.16, titaniumMat, 0, ceilY, 0, carGrp);

      // 천장 4면 둘레(Perimeter) 코브 간접조명 발광 스트립 (3000K 웜화이트)
      const coveMat = M.coveLight(2.8);
      const cThk = 0.020, cDrop = 0.015;
      // 전/후 코브 조명 라인
      createBox(W - 0.18, cDrop, cThk, coveMat, 0, ceilY - 0.005,  (D - 0.18) / 2, carGrp);
      createBox(W - 0.18, cDrop, cThk, coveMat, 0, ceilY - 0.005, -(D - 0.18) / 2, carGrp);
      // 좌/우 코브 조명 라인
      createBox(cThk, cDrop, D - 0.18, coveMat,  (W - 0.18) / 2, ceilY - 0.005, 0, carGrp);
      createBox(cThk, cDrop, D - 0.18, coveMat, -(W - 0.18) / 2, ceilY - 0.005, 0, carGrp);

      // 중앙 슬림 다운라이트 스팟 4개
      const spotMat = M.emit(0xfff8ee, 3.0);
      const spotZ = D * 0.22, spotX = W * 0.22;
      [[-spotX, -spotZ], [spotX, -spotZ], [-spotX, spotZ], [spotX, spotZ]].forEach(([sx, sz]) => {
        const spot = createCylinder(0.022, 0.022, 0.006, spotMat, sx, ceilY - 0.008, sz, carGrp);
        createCylinder(0.032, 0.032, 0.004, titaniumDk, sx, ceilY - 0.007, sz, carGrp); // 베젤
      });

      // ──────────────────────────────────────────────────────────────
      // 5. 샴페인 브론즈 원통형 핸드레일 & 조작반 (OPB)
      // ──────────────────────────────────────────────────────────────
      const hrMat = new THREE.MeshPhysicalMaterial({
        color: 0xd4b07a, metalness: 0.85, roughness: 0.12,
        clearcoat: 0.85, clearcoatRoughness: 0.08
      });
      const hr = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, W * 0.78, 16), hrMat);
      hr.rotation.z = Math.PI / 2;
      hr.position.set(0, -0.28, rearZ + 0.065);
      carGrp.add(hr);
      // 핸드레일 체결 브라켓 3개
      [-W * 0.32, 0, W * 0.32].forEach(bx => {
        const bkt = createCylinder(0.012, 0.012, 0.045, hrMat, bx, -0.28, rearZ + 0.035, carGrp);
        bkt.rotation.x = Math.PI / 2;
      });

      // 조작반 (OPB) — 샴페인 티타늄 프레임 + 블랙 글래스 인레이
      const opbX = W / 2 - 0.04, opbY = -0.10, opbZ = D / 2 - 0.06;
      createBox(0.13, 0.65, 0.020, titaniumDk, opbX, opbY, opbZ, carGrp);
      createBox(0.10, 0.60, 0.022, M.paint(0x101216), opbX, opbY, opbZ, carGrp);

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

      const railX = S.CAR_BG / 2; // ±1.3125 (CAR_BG 2.625 = 원본 1.75 × 1.5)
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
