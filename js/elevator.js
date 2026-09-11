// 엘리베이터 카, 도어 스텁, 균형추, 로프 등 동적 객체 생성 함수를 정의한다.
    /* ==========================================================================
       카 재공사 (2026-08-17): 형상은 화면에서 제거.
       원본: js/archive/car.js   안내: docs/CAR-REBUILD.md
       carGrp 위치·주 로프·조속기 로프·균형추 움직임은 유지한다.
       ========================================================================== */
    function buildCarCabin() {
      carGrp = new THREE.Group();
      carGrp.name = 'carGrp';
      carGrp.userData.safetyGear = null;
      carGrp.position.y = FLOOR_Y[0] + S.CAR_H / 2;
      carGrp.position.z = CAR_CTR_Z;
      scene.add(carGrp);

      const W = S.CAR_W;   // 2.40m
      const D = S.CAR_D;   // 2.53125m
      const H = S.CAR_H;   // 2.355m
      const BG = S.CAR_BG; // 2.625m

      // ── 공통 재질 ──
      const frmMat     = M.paint(0x2c3e50); // 고장력 구조용 강재 (다크 인더스트리얼 슬레이트 블루)
      const frmDkMat   = M.paint(0x1a252f); // 고하중 베이스 플레이트 / 브라켓 강재
      const silvMat    = M.ss(0xc4cbd4);    // 가공 금속 (타이로드, 가이드 베이스)
      const boltMat    = M.ss(0x8a939e);    // M16/M8 볼트·너트
      const goldMat    = M.gold();          // 아연도금/황동 와셔·핀
      const springMat  = M.ss(0xe2e8f0);    // 고장력 스프링강
      const babbittMat = M.paint(0x212d3b); // 단조강 바빗 소켓 바디
      const zincMat    = M.ss(0xd6dade);    // 바빗합금 주입면

      // 안전 난간대 재질 (도면 103~104p & 124932.png 고시인성 황색)
      const yelGuardMat = M.paint(0xf5b800); // 베이스 가드 성형 강판
      const yelPipeMat  = M.paint(0xe6a800); // 안전 핸드레일 파이프


      // 플랫폼 구조재 (도면 93~94p)
      const pltMat         = M.paint(0x374151); // 플랫폼 사각 채널빔
      const subFloorMat    = M.paint(0x71717a); // 하부 아연도금 강판

      /* =========================================================================
         1. 카 프레임 체대 (Car Sling / Stile & Crosshead & Safety Plank)
         부품설계.pdf 89~92p, 99p
         ========================================================================= */
      const carFrameGrp = new THREE.Group();
      carFrameGrp.name = 'carFrameGrp';
      carGrp.add(carFrameGrp);

      const railBladeZ = 0.04;               // 카 로컬 가이드레일 날(블레이드) 중심 Z
      const stileX = BG / 2 - 0.055;         // ±1.2575 (레일 날 바로 안쪽)
      const chLen  = BG - 0.04;              // 2.585m (크로스헤드 및 플랭크 빔 길이)
      const chY    = H / 2 + 0.36;           // 톱빔 중심 Y (+1.5375)
      const chH    = 0.14;                   // ㄷ자 채널 높이 140mm
      const plankY = -H / 2 - 0.16;          // 하부 세이프티 플랭크 중심 Y (-1.3375)

      // ── (1) 좌/우 수직 기둥 (Car Stiles / 종형 세로 ㄷ자 채널) ──
      const stileH = (chY + chH / 2) - (plankY - 0.08); // 약 2.995m
      const stileMidY = (chY + chH / 2 + plankY - 0.08) / 2;

      [-1, 1].forEach(sign => {
        const sx = sign * stileX;
        const fxc = sign * (stileX - 0.035);

        // ㄷ자 채널: 웹(Web) + 전·후 플랜지(Flanges)
        createBox(0.014, stileH, 0.16, frmMat, sx, stileMidY, railBladeZ, carFrameGrp); // 웹
        createBox(0.06,  stileH, 0.014, frmMat, fxc, stileMidY, railBladeZ - 0.073, carFrameGrp); // 전면 플랜지
        createBox(0.06,  stileH, 0.014, frmMat, fxc, stileMidY, railBladeZ + 0.073, carFrameGrp); // 후면 플랜지

        // 상부 크로스헤드 체결 거싯 플레이트 & M16 볼트 (도면 92p)
        createBox(0.016, 0.22, 0.19, frmDkMat, sx - sign * 0.008, chY, railBladeZ, carFrameGrp);
        [-0.05, 0.05].forEach(dy => {
          [-0.06, 0, 0.06].forEach(dz => {
            const b = createCylinder(0.012, 0.012, 0.024, boltMat, sx - sign * 0.018, chY + dy, railBladeZ + dz, carFrameGrp);
            b.rotation.z = Math.PI / 2;
          });
        });

        // 하부 세이프티 디바이스 체결 거싯 플레이트 & 12개 M16 볼트 (도면 91p)
        createBox(0.016, 0.28, 0.19, frmDkMat, sx - sign * 0.008, plankY, railBladeZ, carFrameGrp);
        [-0.09, -0.03, 0.03, 0.09].forEach(dy => {
          [-0.05, 0, 0.05].forEach(dz => {
            const b = createCylinder(0.012, 0.012, 0.024, boltMat, sx - sign * 0.018, plankY + dy, railBladeZ + dz, carFrameGrp);
            b.rotation.z = Math.PI / 2;
          });
        });

        // 카 천장 임시 고정 앵글 (도면 100~101p)
        createBox(0.05, 0.04, 0.28, frmMat, sx - sign * 0.025, H / 2 - 0.04, railBladeZ, carFrameGrp);
      });

      // ── (2) 상부 크로스헤드 빔 (Top Beam / Double C-Channels - 도면 92p) ──
      // 1:1 권상 로프(Z=0)를 가운데 두고 전·후 2본의 평행 C채널 배치
      const chFwdZ = 0.070, chAftZ = -0.070;
      // 전면 C채널
      createBox(chLen, chH, 0.014, frmMat, 0, chY, chFwdZ + 0.020, carFrameGrp); // 웹
      createBox(chLen, 0.014, 0.045, frmMat, 0, chY + chH / 2 - 0.007, chFwdZ - 0.005, carFrameGrp); // 상단 플랜지
      createBox(chLen, 0.014, 0.045, frmMat, 0, chY - chH / 2 + 0.007, chFwdZ - 0.005, carFrameGrp); // 하단 플랜지
      // 후면 C채널
      createBox(chLen, chH, 0.014, frmMat, 0, chY, chAftZ - 0.020, carFrameGrp); // 웹
      createBox(chLen, 0.014, 0.045, frmMat, 0, chY + chH / 2 - 0.007, chAftZ + 0.005, carFrameGrp); // 상단 플랜지
      createBox(chLen, 0.014, 0.045, frmMat, 0, chY - chH / 2 + 0.007, chAftZ + 0.005, carFrameGrp); // 하단 플랜지

      // 크로스헤드 양단 엔드플레이트
      createBox(0.020, chH + 0.06, 0.22, frmDkMat, -chLen / 2, chY, 0, carFrameGrp);
      createBox(0.020, chH + 0.06, 0.22, frmDkMat,  chLen / 2, chY, 0, carFrameGrp);

      // 크로스헤드 경사 보강 브레이스 암 (Arms)
      [-1, 1].forEach(sign => {
        const arm = createBox(0.06, 0.42, 0.04, frmMat, sign * (stileX - 0.16), chY - 0.16, 0, carFrameGrp);
        arm.rotation.z = -sign * 0.45;
      });

      // ── (3) 하부 세이프티 플랭크 빔 (Safety Plank / Bottom Channel Beam - 도면 91p) ──
      createBox(chLen, 0.16, 0.10, frmMat, 0, plankY, railBladeZ, carFrameGrp);
      createBox(chLen, 0.016, 0.16, frmDkMat, 0, plankY - 0.08, railBladeZ, carFrameGrp); // 하단 완충 타격 플레이트

      /* =========================================================================
         2. 1:1 주 로프 바빗 로프 소켓 어셈블리 (5개소 직결 히치 - 도면 104p 마킹 응용)
         refreshRopes() 접점: local Y = H / 2 + 0.68, Z = 0, X = -0.06 + i * 0.03
         ========================================================================= */
      const hitchBedY = chY + chH / 2 + 0.012; // H / 2 + 0.442

      // 히치 베드 마운트 플레이트 (ㄷ자 채널 상부 가로질러 결속)
      createBox(0.42, 0.024, 0.22, frmDkMat, 0, hitchBedY, 0, carFrameGrp);
      [-0.17, 0.17].forEach(bx => {
        [-0.07, 0.07].forEach(bz => {
          createCylinder(0.011, 0.011, 0.035, boltMat, bx, hitchBedY + 0.01, bz, carFrameGrp);
          createCylinder(0.015, 0.015, 0.005, goldMat, bx, hitchBedY + 0.013, bz, carFrameGrp);
        });
      });

      // 5개 1:1 바빗 소켓 및 스프링 타이로드 어셈블리
      const socketMat = M.ss(0x232d38); // 단조강 건메탈 소켓
      const springCoilMat = M.paint(0x1e293b); // 스프링 코일 블랙/스틸

      for (let i = 0; i < 5; i++) {
        const rx = -0.06 + i * 0.03;

        // (a) M20 고장력 인장 타이로드 볼트 (히치 베드 관통 ~ 소켓 하단)
        createCylinder(0.007, 0.007, 0.20, silvMat, rx, hitchBedY + 0.09, 0, carFrameGrp);

        // (b) 하부 스프링 시트 와셔 & 너트
        createCylinder(0.018, 0.018, 0.008, goldMat, rx, hitchBedY + 0.016, 0, carFrameGrp);
        createCylinder(0.014, 0.014, 0.014, boltMat, rx, hitchBedY + 0.027, 0, carFrameGrp);

        // (c) 진동 완충용 고장력 코일 스프링 (Damper Spring - 입체 코일 링 표현)
        createCylinder(0.013, 0.013, 0.070, silvMat, rx, hitchBedY + 0.070, 0, carFrameGrp); // 내부 로드 가이드
        for (let s = 0; s < 5; s++) {
          const sy = hitchBedY + 0.040 + s * 0.014;
          createCylinder(0.018, 0.018, 0.007, springMat, rx, sy, 0, carFrameGrp); // 코일 와인딩 링
        }

        // (d) 상부 스프링 시트 와셔 & 더블 록 너트 (Double Jam Nuts)
        createCylinder(0.019, 0.019, 0.008, goldMat, rx, hitchBedY + 0.112, 0, carFrameGrp);
        createCylinder(0.014, 0.014, 0.012, boltMat, rx, hitchBedY + 0.122, 0, carFrameGrp);
        createCylinder(0.014, 0.014, 0.012, boltMat, rx, hitchBedY + 0.134, 0, carFrameGrp);

        // (e) 단조 바빗 소켓 몸통 (Babbitt Socket Body - 원뿔형 테이퍼 주물 바디)
        // 하단 폭 36mm → 상단 폭 22mm 테이퍼 주물 바디. 상단 칼라 끝이 정확히 H / 2 + 0.68에 접촉
        const socketH = 0.100;
        const socketY = (H / 2 + 0.68) - socketH / 2; // H / 2 + 0.63
        createCylinder(0.011, 0.018, socketH, socketMat, rx, socketY, 0, carFrameGrp);

        // 소켓 상단 리세스 림 & 바빗합금(Zinc alloy) 충진 마감
        createCylinder(0.012, 0.012, 0.012, socketMat, rx, H / 2 + 0.674, 0, carFrameGrp);
        createCylinder(0.009, 0.009, 0.004, zincMat, rx, H / 2 + 0.680, 0, carFrameGrp);

        // 소켓 상부 안전 와이어 클립 (Rope Clip / U-Bolt Clamp)
        createBox(0.018, 0.014, 0.016, silvMat, rx, H / 2 + 0.702, 0, carFrameGrp);
        createCylinder(0.003, 0.003, 0.024, silvMat, rx, H / 2 + 0.702, 0, carFrameGrp);
      }

      /* =========================================================================
         3. 상·하부 가이드 슈 4개소 (도면 95p, 99p)
         레일 뒷면 기준 X = ±BG / 2, Z = +0.04. 날 단면은 레일 GLB에서 파생.
         ========================================================================= */
      carGrp.userData.guideShoes = [];
      new THREE.GLTFLoader().load('models/gltf/car_guide_shoe.glb', gltf => {
        [-1, 1].forEach(side => {
          [true, false].forEach(isUpper => {
            const mount = new THREE.Group();
            mount.name = `CarGuideShoe_${side < 0 ? 'L' : 'R'}_${isUpper ? 'Upper' : 'Lower'}`;
            // Lower mounting face: safety housing bottom cap (build_safety_glb.mjs).
            mount.position.set(side * BG / 2, isUpper ? chY + chH / 2 : plankY - 0.145, railBladeZ);
            mount.rotation.y = side > 0 ? Math.PI : 0;
            mount.userData.type = 'carGuideShoe';
            mount.userData.isUpper = isUpper;
            const model = gltf.scene.clone(true);
            model.rotation.x = isUpper ? 0 : Math.PI;
            if (!isUpper) model.getObjectByName('Oiler').visible = false;
            model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            mount.add(model);
            carFrameGrp.add(mount);
            carGrp.userData.guideShoes.push(mount);
          });
        });
      }, undefined, err => console.error('[car_guide_shoe.glb] 로드 실패:', err));

      /* =========================================================================
         4. 하부 세이프티 기어 및 조속기 연동 (Safety Gear GLB 로드 - 도면 91p, 96~98p)
         assets/safety_gear.glb
         ========================================================================= */
      const safetyGearGrp = new THREE.Group();
      carGrp.add(safetyGearGrp);

      new THREE.GLTFLoader().load('assets/safety_gear.glb', (gltf) => {
        const g = gltf.scene;
        g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        // Hide only the four unnamed legacy shoe boxes, not safety-gear mechanisms.
        // Dimensions/centres mirror tools/build_safety_glb.mjs; retain the source GLB.
        g.updateMatrixWorld(true);
        const legacyShoes = [];
        const box = new THREE.Box3(), size = new THREE.Vector3(), center = new THREE.Vector3();
        g.traverse(o => {
          if (!o.isMesh) return;
          box.setFromObject(o).getSize(size);
          box.getCenter(center);
          const near = (a, b) => Math.abs(a - b) < 1e-5;
          const body = near(size.x, 0.13) && near(size.y, 0.075) && near(size.z, 0.10) && near(Math.abs(center.x), stileX);
          const liner = near(size.x, 0.04) && near(size.y, 0.075) && near(size.z, 0.05) && near(Math.abs(center.x), stileX - 0.04);
          if ((body || liner) && near(center.y, plankY - 0.175) && near(center.z, railBladeZ)) legacyShoes.push(o);
        });
        if (legacyShoes.length === 4) legacyShoes.forEach(o => { o.visible = false; o.userData.legacyGuideShoe = true; });
        else console.warn('[safety_gear.glb] Legacy guide-shoe geometry contract changed:', legacyShoes.length);
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
        carGrp.userData.safetyGear.wedges.forEach(w => { w.userData.z0 = w.position.z; });
        if (typeof refreshGovernorRope === 'function') refreshGovernorRope();
      }, undefined, (err) => console.error('[safety_gear.glb] 로드 실패:', err));

      // 조속기 로프 카 상부 고정 브라켓 (우측 톱빔 상단 홀 관통 - 도면 96p-1)
      createBox(0.06, 0.05, 0.12, frmMat, stileX + 0.07, chY + chH / 2 + 0.025, -0.15, carFrameGrp);
      createCylinder(0.014, 0.014, 0.06, silvMat, stileX + 0.07, chY + chH / 2 + 0.03, -0.15, carFrameGrp);

      // 액츄에이터 레버 풀 바 (Actuator Lever Pull Bar - 도면 96p-2)
      createBox(0.015, 0.40, 0.025, silvMat, stileX + 0.07, plankY + 0.12, -0.15, carFrameGrp);
      // 조속기 로프 연결 심블 & 와이어 클립 (도면 98p)
      createCylinder(0.016, 0.016, 0.035, goldMat, stileX + 0.07, plankY - 0.02, -0.15, carFrameGrp);
      [-0.05, -0.08].forEach(dy => {
        createBox(0.022, 0.014, 0.018, silvMat, stileX + 0.07, plankY + dy, -0.15, carFrameGrp);
      });

      /* =========================================================================
         5. 카 플랫폼 베이스 프레임 (Platform Frame - 도면 93~94p)
         세이프티 플랭크 상부에 안착, 향후 바닥 판재·도어 실(Sill)·에이프런의 기준면 형성
         ========================================================================= */
      const platformGrp = new THREE.Group();
      carGrp.add(platformGrp);

      const pltFloorY = -H / 2; // -1.1775 (카 바닥 기준면)
      const pltH = 0.085;       // 플랫폼 채널 높이 85mm
      const pltMidY = pltFloorY - pltH / 2;

      // 외곽 C채널 프레임 (전·후·좌·우 4변)
      createBox(W, pltH, 0.04, pltMat, 0, pltMidY,  D / 2 - 0.02, platformGrp); // 전면
      createBox(W, pltH, 0.04, pltMat, 0, pltMidY, -D / 2 + 0.02, platformGrp); // 후면
      createBox(0.04, pltH, D - 0.08, pltMat, -W / 2 + 0.02, pltMidY, 0, platformGrp); // 좌측
      createBox(0.04, pltH, D - 0.08, pltMat,  W / 2 - 0.02, pltMidY, 0, platformGrp); // 우측

      // Z방향 하부 종통 보강 채널 6본 (도면 93p)
      const stringerX = [-0.85, -0.51, -0.17, 0.17, 0.51, 0.85];
      stringerX.forEach(sx => {
        createBox(0.045, pltH - 0.01, D - 0.08, pltMat, sx, pltMidY, 0, platformGrp);
      });

      // 하부 아연도금 강판 서브팬 (Sub-floor Pan Plate - 도면 94p)
      createBox(W - 0.02, 0.010, D - 0.02, subFloorMat, 0, pltFloorY - 0.005, 0, platformGrp);

      // 전면 실(Sill) 서포트 채널 (향후 도어 실 장착면)
      createBox(S.DOOR_W + 0.20, 0.05, 0.05, frmDkMat, 0, pltFloorY - 0.03, D / 2 + 0.015, platformGrp);

      // 대각 무릎 브레이스 (Knee Braces — 플랫폼 모서리 하부 ↔ 스타일 하단 결속)
      const braceTopY = pltFloorY - pltH; // 플랫폼 채널 하단면에 부착 (바닥 상단 노출 방지)
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
        const px = sx * (W / 2 - 0.15), pz = sz * (D / 2 - 0.15);
        const bx = sx * (stileX - 0.03), bz = railBladeZ;
        const by = plankY + 0.08;
        const dx = bx - px, dy = by - braceTopY, dz = bz - pz;
        const len = Math.hypot(dx, dy, dz);
        const strut = createBox(0.032, len, 0.032, frmMat, (px + bx) / 2, (braceTopY + by) / 2, (pz + bz) / 2, platformGrp);
        strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
      });

      /* =========================================================================
         6. 카 상부 추락방지 안전 난간대 (Top Safety Handrail)
         도면 103~104p & 사용자 스크린샷 124932.png, 1249321.png
         ========================================================================= */
      const handrailGrp = new THREE.Group();
      carGrp.add(handrailGrp);

      // ── (1) 황색 베이스 가드 (Base Guard - 도면 103p, M16 볼트 고정) ──
      const bgTopY = chY + chH / 2; // H / 2 + 0.43
      // 톱빔 상단 고정 베이스 가드 브라켓
      createBox(chLen - 0.20, 0.10, 0.025, yelGuardMat, 0, bgTopY + 0.05, -0.10, handrailGrp); // 후면 베이스
      createBox(0.025, 0.10, 0.50, yelGuardMat, -(stileX - 0.10), bgTopY + 0.05, 0.15, handrailGrp); // 좌측 베이스
      createBox(0.025, 0.10, 0.50, yelGuardMat,  (stileX - 0.10), bgTopY + 0.05, 0.15, handrailGrp); // 우측 베이스

      // 베이스 가드 M16 볼트 체결열 (도면 103p)
      [-0.70, -0.35, 0.35, 0.70].forEach(bx => {
        createCylinder(0.014, 0.014, 0.02, boltMat, bx, bgTopY + 0.10, -0.10, handrailGrp);
      });

      // ── (2) 안전 파이프 난간 구조 (Safety Pipe Handrails - 도면 104p & 124932.png) ──
      // 상부 탑레일(+0.90m), 중간 미드레일(+0.48m), 발끝막이판 토보드(+0.06m)
      const railH = 0.90;                                // 상단 난간 높이
      const midH  = 0.48;                                // 중간 바 높이
      const railTopY = H / 2 + railH;                    // 카 천장 기준 +0.90m
      const railMidY = H / 2 + midH;
      const toeBoardY = H / 2 + 0.05;

      const hrW = W - 0.30;                              // 난간 폭 2.10m
      const hrD = D - 0.40;                              // 난간 깊이 2.13m
      const hrRearZ = -D / 2 + 0.18;                     // 후면 난간 Z
      const hrLeftX = -W / 2 + 0.15, hrRightX = W / 2 - 0.15; // 좌/우 난간 X
      const hrFrontZ = hrRearZ + hrD;                    // 전면 개구부 측 Z

      // (a) 수직 지주 포스트 (Vertical Posts - 7개소)
      const postLocations = [
        [hrLeftX,  hrRearZ],          // 후면 좌측 모서리
        [hrRightX, hrRearZ],          // 후면 우측 모서리
        [0,        hrRearZ],          // 후면 중앙
        [hrLeftX,  (hrRearZ + hrFrontZ) / 2], // 좌측 중간
        [hrRightX, (hrRearZ + hrFrontZ) / 2], // 우측 중간
        [hrLeftX,  hrFrontZ],         // 좌측 전면 끝단
        [hrRightX, hrFrontZ]          // 우측 전면 끝단
      ];

      postLocations.forEach(([px, pz]) => {
        // 사각 파이프 지주 (40x40)
        createBox(0.038, railH, 0.038, yelPipeMat, px, H / 2 + railH / 2, pz, handrailGrp);
        // 하단 마운트 플랜지 & 볼트
        createBox(0.08, 0.012, 0.08, yelGuardMat, px, H / 2 + 0.006, pz, handrailGrp);
      });

      // (b) 상부 핸드레일 (Top Rails - 후면, 좌측, 우측 3면)
      createBox(hrW, 0.038, 0.038, yelPipeMat, 0, railTopY, hrRearZ, handrailGrp); // 후면
      createBox(0.038, 0.038, hrD, yelPipeMat, hrLeftX,  railTopY, (hrRearZ + hrFrontZ) / 2, handrailGrp); // 좌측
      createBox(0.038, 0.038, hrD, yelPipeMat, hrRightX, railTopY, (hrRearZ + hrFrontZ) / 2, handrailGrp); // 우측

      // (c) 중간 가로대 (Mid Rails - 후면, 좌측, 우측 & M8 볼트 결합 - 도면 104p)
      createBox(hrW, 0.032, 0.032, yelPipeMat, 0, railMidY, hrRearZ, handrailGrp); // 후면
      createBox(0.032, 0.032, hrD, yelPipeMat, hrLeftX,  railMidY, (hrRearZ + hrFrontZ) / 2, handrailGrp); // 좌측
      createBox(0.032, 0.032, hrD, yelPipeMat, hrRightX, railMidY, (hrRearZ + hrFrontZ) / 2, handrailGrp); // 우측

      // M8 볼트 조립 디테일 (도면 104p 상세도)
      postLocations.forEach(([px, pz]) => {
        createCylinder(0.008, 0.008, 0.046, boltMat, px, railMidY, pz, handrailGrp);
        createCylinder(0.008, 0.008, 0.046, boltMat, px, railTopY, pz, handrailGrp);
      });

      // (d) 발끝막이판 (Toe Boards / Kick Plates - 100mm 고시인성 황색 판재)
      createBox(hrW, 0.10, 0.014, yelGuardMat, 0, toeBoardY, hrRearZ, handrailGrp); // 후면
      createBox(0.014, 0.10, hrD, yelGuardMat, hrLeftX,  toeBoardY, (hrRearZ + hrFrontZ) / 2, handrailGrp); // 좌측
      createBox(0.014, 0.10, hrD, yelGuardMat, hrRightX, toeBoardY, (hrRearZ + hrFrontZ) / 2, handrailGrp); // 우측
    }

    function buildPassenger() {
      passengerGrp = new THREE.Group();
      passengerGrp.name = 'passenger_stub';
      passengerGrp.visible = false;
      carGrp.add(passengerGrp);
    }

    function togglePassenger() {
      return false;
    }

    /* ==========================================================================
       도어 재공사 (2026-08-17): 형상은 화면에서 제거.
       원본: js/archive/doors.js   안내: docs/DOOR-REBUILD.md
       카 에이프런은 카 재공사로 `js/archive/car.js` 에 옮겼다.
       스티커 PNG: assets/bg/hand.png, assets/bg/lean.png (삭제 금지)
       운행 FSM(openDoors/closeDoors)이 참조하는 빈 그룹만 유지한다.
       ========================================================================== */
    function buildCarDoors() {
      const dw = S.DOOR_W / 2 + 0.02;
      const cx = dw / 2 + 0.006, ox = dw * 1.5 - 0.01;
      carDoorL = new THREE.Group();
      carDoorR = new THREE.Group();
      carDoorL.name = 'carDoorL_stub';
      carDoorR.name = 'carDoorR_stub';
      carDoorL.userData = { cx: -cx, ox: -ox, archived: true };
      carDoorR.userData = { cx: cx, ox: ox, archived: true };
      carDoorL.position.set(-cx, 0, 0);
      carDoorR.position.set(cx, 0, 0);
      carGrp.add(carDoorL, carDoorR);
      carGrp.userData.doorDrive = null;
    }

    /* ──────────────────────────────────────────────────────────────
       승장 헤더 연동(릴레이팅) 로프 동기
       2짝 중앙개폐: 상부 가닥에 월드 +X 행거판(스프링 고정단), 하부 가닥에
       월드 -X 행거판(롤러 고정단)이 물려 있다. 로프는 헤더 양단 풀리를 180°
       감고 도는 한 바퀴짜리 회로라, 한쪽이 +X 로 가면 반대쪽은 같은 양만큼
       -X 로 끌려간다. 그래서 두 문짝이 엉키지 않고 항상 대칭으로 개폐된다.
       도어 행정만으로 마디 길이·풀리각·클로저 스프링 길이를 역산한다.
       텐셔너 창에서 바깥으로 나오는 짧은 감김은 행거판 고정 튜브다.
       카 도어 오퍼레이터는 미설치. 원본: js/archive/doors.js
       ────────────────────────────────────────────────────────────── */
    function setRopeSpan(mesh, x0, x1, y, z) {
      const len = x1 - x0;
      if (len <= 0.006) { mesh.visible = false; return; }
      mesh.visible = true;
      setGovRopeLen(mesh, len);
      mesh.position.set((x0 + x1) / 2, y, z);
    }

    function spinDoorDrive(h) {
      if (!h || !h.link) return;
      const k = h.link;
      const ax = h.right.position.x + k.aOff; // 상부 가닥 스프링 고정단 (월드 +X 행거판)

      // 상부 가닥: 좌풀리 ↔ 좌측 패널 클램프 ↔ 우풀리 (헤더 상단 전면 가시 주행)
      setRopeSpan(k.seg.upL, k.pulLX, ax - k.aHalf, k.upY, k.upZ);
      setRopeSpan(k.seg.upR, ax + k.aHalf, k.pulRX, k.upY, k.upZ);

      /* 하부 가닥 본선: 우단 풀리 ↔ 텐셔너 풀리 우측 뒤 접선 /
         텐셔너 풀리 좌측 뒤 접선 ↔ 좌단 풀리. 본선 Y·Z 는 k.loY / k.loZ 그대로.
         창으로 나와 스프링에 물리는 짧은 구간·상단홈↔하단홈 높이차는 행거판 고정 튜브. */
      const bx = h.left.position.x;
      setRopeSpan(k.seg.loL, k.pulLX, bx + k.bL, k.loY, k.loZ); // 화면 오른쪽 본선 → 풀리 뒤 상단 홈
      setRopeSpan(k.seg.loR, bx + k.bR, k.pulRX, k.loY, k.loZ); // 풀리 뒤 하단 홈 → 화면 왼쪽 본선

      // 풀리 회전 = 로프가 지나간 거리 / 홈 반지름 (상부 가닥이 +X 로 가면 시계방향)
      const spin = -(h.right.position.x - h.right.userData.cx) / k.ropeR;
      k.pulL.rotation.z = spin;
      k.pulR.rotation.z = spin;

      // 폐문 스프링 — 고정 브라켓과 -X 행거판 SPRING HANGER 러그 사이에서 늘어난다
      const c = k.closer;
      const x0 = h.left.position.x + c.lugDX + 0.006;
      c.coil.position.x = x0;                                  // 헬릭스 원점 = 러그 쪽 끝
      c.coil.scale.x = Math.max(0.05, c.anchorX - x0);          // 늘어난 만큼 코일 피치가 벌어진다
    }

    /**
     * 인디케이터 동기화: 전 층의 Canvas 텍스쳐를 실시간으로 업데이트
     */
    function syncAllIndicators(floorStr, dirStr) {
      indicators.forEach(ind => {
        const ctx = ind.ctx;
        ctx.fillStyle = '#0a0c0e';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#f0883e';
        ctx.font = 'bold 36px "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = dirStr ? `${dirStr}   ${floorStr}` : `${floorStr}`;
        ctx.fillText(text, 128, 36);
        ind.texture.needsUpdate = true;
      });
    }

    /* ── 도어 안전 스티커 텍스처 (실사 PNG) ──
       hand.png = 손대지 마시오 / lean.png = 기대면 추락 위험 */
    let _hatchStickerMats = null;
    function getStickerMats() {
      if (_hatchStickerMats) return _hatchStickerMats;
      const loader = new THREE.TextureLoader();
      function makeMat(path) {
        const tex = loader.load(path);
        tex.encoding = THREE.sRGBEncoding;
        return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      }
      _hatchStickerMats = {
        L: makeMat('assets/bg/hand.png'),
        R: makeMat('assets/bg/lean.png')
      };
      return _hatchStickerMats;
    }

    let sillSupportGrp = null;

    function buildHatchDoors() {
      hatchDoors.forEach(h => {
        if (h.left && h.left.parent) h.left.parent.remove(h.left);
        if (h.right && h.right.parent) h.right.parent.remove(h.right);
      });
      hatchDoors = [];
      indicators = [];

      // 기존 실 서포트 그룹 청소 및 재생성
      if (sillSupportGrp && sillSupportGrp.parent) {
        sillSupportGrp.parent.remove(sillSupportGrp);
      }
      sillSupportGrp = new THREE.Group();

      // ── 재질 설정 (실사 구조용 스틸 / 아연도금 강판) ──
      const ssMat     = new THREE.MeshStandardMaterial({ color: 0x757f8c, metalness: 0.72, roughness: 0.38 });  // 스틸 브라켓 본체
      const darkSsMat = new THREE.MeshStandardMaterial({ color: 0x363d47, metalness: 0.50, roughness: 0.65 });  // 슬롯 홈 및 내부 음영
      const boltMat   = new THREE.MeshStandardMaterial({ color: 0xb0b9c6, metalness: 0.85, roughness: 0.28 });  // 아연도금/스틸 볼트·너트

      // ── 개별 실 서포트 브라켓 어셈블리 생성 함수 (도면 15.2, 15.3 반영) ──
      function createSillSupport(bx, fy, parent) {
        const brkGrp = new THREE.Group();
        const wallFaceZ = FRONT_WALL_INNER_Z; // 승강로 전면 콘크리트 벽체 표면 Z

        // 1. 1차 브라켓 (승강로 벽체 부착 L자형 브라켓)
        // 1-1. 벽면 밀착 플랜지 (Backplate: 75mm x 110mm x 3.5mm)
        createBox(0.075, 0.110, 0.0035, ssMat, 0, -0.075, -0.00175, brkGrp);

        // 1-2. 상하 2단 장공 슬롯 (음영 대비)
        [-0.050, -0.090].forEach(sy => {
          createBox(0.040, 0.012, 0.001, darkSsMat, -0.010, sy, -0.0036, brkGrp);
          // 앙카 볼트 + 대형 평와셔 (벽체 고정 앵커)
          const anc = createCylinder(0.0075, 0.0075, 0.005, boltMat, -0.010, sy, -0.005, brkGrp);
          anc.rotation.x = Math.PI / 2;
          createBox(0.008, 0.008, 0.004, boltMat, -0.010, sy, -0.008, brkGrp);
        });

        // 1-3. 1차 브라켓 직각 돌출 플랜지 (전방으로 뻗어 2차 브라켓과 맞물림: 3.5mm x 110mm x 46mm)
        const flangeX = 0.0355;
        const flangeZ = -0.025;
        createBox(0.0035, 0.110, 0.046, ssMat, flangeX, -0.075, flangeZ, brkGrp);

        // 2. 2차 브라켓 (상하 조절 및 실 받침대, Z/L자형)
        // 2-1. 수직 결합판 (1차 플랜지와 밀착: 3.5mm x 95mm x 44mm)
        const supX = flangeX + 0.0045;
        createBox(0.0035, 0.095, 0.044, ssMat, supX, -0.055, flangeZ, brkGrp);

        // 2-2. 상단 수평 실 안착 플랜지 (승장 실을 얹는 상단 받침면: 44mm x 4.0mm x 46mm)
        createBox(0.044, 0.004, 0.046, ssMat, flangeX - 0.018, -0.007, flangeZ, brkGrp);
        // 상단 체결 볼트 홀 표현
        createBox(0.010, 0.001, 0.010, darkSsMat, flangeX - 0.018, -0.005, flangeZ, brkGrp);

        // 3. 결합 볼트 어셈블리 (M12 볼트 + 평와셔 + 스프링와셔 + 육각너트 2세트)
        [-0.045, -0.080].forEach(by => {
          // 가로 관통 볼트 축
          const bPin = createCylinder(0.0045, 0.0045, 0.022, boltMat, flangeX + 0.002, by, flangeZ, brkGrp);
          bPin.rotation.z = Math.PI / 2;
          // 외측 너트 및 와셔
          createBox(0.004, 0.012, 0.012, boltMat, flangeX + 0.011, by, flangeZ, brkGrp);
          // 내측 볼트 헤드
          createBox(0.004, 0.012, 0.012, boltMat, flangeX - 0.007, by, flangeZ, brkGrp);
        });

        // 위치 설정 및 부모 그룹에 추가
        brkGrp.position.set(bx, fy, wallFaceZ);
        parent.add(brkGrp);
      }

      // ── 승장 이중실 + 도어 Z 계약 ──
      /* 1번 홈: 기존 승장 실 (문짝 아래). 2번 홈: 승강로 쪽 보강실.
         일반 슈는 1번, 문짝당 보강슈 1개는 2번을 탄다 (450J 이탈 방지).
         홀 쪽 가장자리는 그대로 두고 승강로(−Z)로만 살짝 넓힌다. */
      const HATCH_DT      = 0.032;
      const DOOR_MEET_GAP = 0.005;
      const sillH         = 0.022;
      const sillLen       = S.DOOR_W + 0.22;
      const SILL_GROOVE_W = 0.014;
      const SILL_GROOVE_D = 0.016;
      const DOOR_HALL_Z   = FRONT_WALL_INNER_Z - 0.022;
      const SILL_Z        = DOOR_HALL_Z - HATCH_DT / 2;
      // 도면 174p: C레일 트랙 중심 = 행거판 플랜지 = 도어 패널 = 승장 실 1번 홈 단일 수직 PLUMB 축
      const HATCH_PLUMB_Z = SILL_Z;
      const hatchPanelZ   = (trackCtrZ) => SILL_Z - trackCtrZ;
      const SILL_HALL_EDGE  = 0.0275;  // 홀 쪽 — 기존 55mm 실과 동일
      const SILL_GROOVE1_Z  = 0;       // 1번 홈 (문짝 아래)
      const SILL_GROOVE2_Z  = -0.026;  // 2번 홈 (승강로 쪽 보강)
      const SILL_SHAFT_EDGE = -0.048;  // 승강로로 살짝 확장
      const ribMat = new THREE.MeshStandardMaterial({ color: 0xc4cdd8, metalness: 0.70, roughness: 0.28 });
      const sillAlum = new THREE.MeshStandardMaterial({ color: 0xc8d0d8, metalness: 0.78, roughness: 0.26 });
      const grooveMat = new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.40, roughness: 0.70 });

      function createHallSill(fy, parent) {
        const g = new THREE.Group();
        const gw = SILL_GROOVE_W;
        const gd = SILL_GROOVE_D;
        const hallEdge = SILL_HALL_EDGE;
        const shaftEdge = SILL_SHAFT_EDGE;
        const bodyD = hallEdge - shaftEdge;
        const bodyZ = (hallEdge + shaftEdge) / 2;

        const bodyH = sillH - gd;
        createBox(sillLen, bodyH, bodyD, sillAlum, 0, -gd - bodyH / 2, bodyZ, g);

        function addGroove(gz) {
          createBox(sillLen, 0.0025, gw, grooveMat, 0, -gd + 0.00125, gz, g);
        }
        function addFlange(z0, z1) {
          const d = z1 - z0;
          if (d < 0.003) return;
          createBox(sillLen, gd, d, sillAlum, 0, -gd / 2, (z0 + z1) / 2, g);
        }

        const g1h = SILL_GROOVE1_Z + gw / 2, g1s = SILL_GROOVE1_Z - gw / 2;
        const g2h = SILL_GROOVE2_Z + gw / 2, g2s = SILL_GROOVE2_Z - gw / 2;
        addFlange(g1h, hallEdge);
        addFlange(g2h, g1s);
        addFlange(shaftEdge, g2s);
        addGroove(SILL_GROOVE1_Z);
        addGroove(SILL_GROOVE2_Z);

        const ribZ0 = g1h + 0.004;
        for (let i = 0; i < 4; i++) {
          createBox(sillLen, 0.0010, 0.0016, ribMat, 0, 0.0005, ribZ0 + i * 0.0045, g);
        }

        g.position.set(0, fy, SILL_Z);
        parent.add(g);

        const lobbyInnerZ = FRONT_WALL_INNER_Z + S.WALL_T;
        const sillHallWorld = SILL_Z + SILL_HALL_EDGE;
        const fillD = lobbyInnerZ - sillHallWorld;
        if (fillD > 0.02) {
          createBox(sillLen, 0.12, fillD, M.conc(0xd2cbc0), 0, fy - 0.06, sillHallWorld + fillD / 2, parent);
        }
      }

      /* ── 승장 토가드(실 커버) ──
         실 서포트 5곳 앞에 결합. 수직 270mm, 하단은 벽(+Z) 쪽으로 굽힘.
         검사기준 에이프런과 같은 디테일: 수평면 대비 60° 이상 아랫방향, 굽힘 길이 ≥20mm. */
      const TOE_H = 0.270;
      const TOE_T = 0.0024;
      const TOE_BEND = 0.035;
      const toeMat = M.ss(0xb6bec6);

      function createToeGuard(fy, parent) {
        const g = new THREE.Group();
        const plateZ = 0;
        const topY = 0;
        createBox(sillLen, TOE_H, TOE_T, toeMat, 0, topY - TOE_H / 2, plateZ, g);
        [-1, 1].forEach(s => {
          createBox(0.012, TOE_H, 0.016, toeMat, s * (sillLen / 2 - 0.006), topY - TOE_H / 2, plateZ + 0.008, g);
        });
        const tilt = Math.PI / 6;
        const bend = createBox(sillLen, TOE_BEND, TOE_T, toeMat, 0, 0, 0, g);
        bend.rotation.x = -tilt;
        const botY = topY - TOE_H;
        bend.position.set(
          0,
          botY - (TOE_BEND / 2) * Math.cos(tilt),
          plateZ + (TOE_BEND / 2) * Math.sin(tilt)
        );
        bracketPositions.forEach(bx => {
          [-0.055, -0.095].forEach(dy => {
            const b = createCylinder(0.0042, 0.0042, 0.008, boltMat, bx, dy, plateZ - 0.0035, g);
            b.rotation.x = Math.PI / 2;
            createBox(0.011, 0.011, 0.002, boltMat, bx, dy, plateZ - 0.007, g);
          });
        });
        g.position.set(0, fy - 0.004, SILL_Z + SILL_SHAFT_EDGE - TOE_T / 2);
        parent.add(g);
      }

      // ── 삼방틀(Jamb / 잠) 및 트랜섬 어셈블리 생성 함수 (도면 171, 172, 173페이지 15.5 잠 설치 반영) ──
      const jambMat  = M.silverHairline(0xc8d0d8, 0.28); // 고급 헤어라인 스테인리스
      const rebarMat = new THREE.MeshStandardMaterial({ color: 0x626c78, metalness: 0.60, roughness: 0.50 }); // 벽체 고정용 철근
      const jambW    = 0.160;             // 사이드 프레임 폭 160mm
      const jambD    = 0.085;             // 프레임 전후 깊이 85mm
      const topH     = 0.085;             // 톱 프레임 높이 85mm
      const topW     = S.DOOR_W + jambW * 2; // 삼방틀 전체 폭 1.82m
      const transH   = 0.520;             // 상부 트랜섬(막판) 높이 520mm
      const jambZ    = FRONT_WALL_INNER_Z + jambD / 2 - 0.010; // 전면 벽체와 결합되는 Z 중심

      function createJambAssembly(fy, parent) {
        const jGrp = new THREE.Group();
        const doorW = S.DOOR_W;
        const doorH = S.DOOR_H;

        // 1. 좌/우 사이드 프레임 (사이드 잠 기둥)
        [-1, 1].forEach(side => {
          const jx = side * (doorW / 2 + jambW / 2);
          // 메인 스테인리스 기둥
          createBox(jambW, doorH, jambD, jambMat, jx, doorH / 2, 0, jGrp);

          // 안쪽 도어 가이드 립 (단면 절곡 디테일)
          createBox(0.012, doorH, 0.025, ribMat, jx - side * (jambW / 2 - 0.006), doorH / 2, -jambD / 2 + 0.0125, jGrp);

          // 하단 실 보강(Sill Reinforcement) 결합 브라켓 & M8 볼트 2개소 (도면 172p)
          createBox(0.055, 0.035, 0.045, darkSsMat, jx, 0.018, -jambD / 2 + 0.022, jGrp);
          [-0.015, 0.015].forEach(bx => {
            const sb = createCylinder(0.0045, 0.0045, 0.010, boltMat, jx + bx, 0.018, -jambD / 2 + 0.045, jGrp);
            sb.rotation.x = Math.PI / 2;
          });

          // 벽체 고정용 핀 앵커(M8) 및 고정 철근 용접부 3개소 (도면 171p, 173p: 상/중/하)
          [0.45, 1.15, 1.85].forEach(ay => {
            // 핀 앵커볼트 (M8)
            const pAnc = createCylinder(0.005, 0.005, 0.035, boltMat, jx + side * (jambW / 2 + 0.015), ay, 0, jGrp);
            pAnc.rotation.z = Math.PI / 2;
            // 고정용 철근 (앵커와 프레임 보강대 사이 용접)
            const rBar = createCylinder(0.006, 0.006, 0.050, rebarMat, jx + side * (jambW / 2 + 0.005), ay, 0.015, jGrp);
            rBar.rotation.x = Math.PI / 4;
          });
        });

        // 2. 톱 프레임 (상부 헤드 잠 수평틀)
        createBox(topW, topH, jambD, jambMat, 0, doorH + topH / 2, 0, jGrp);

        // 상부 코너 조립 볼트 (도면 171p M8x25 볼트 2개소씩)
        [-topW / 2 + 0.045, -topW / 2 + 0.115, topW / 2 - 0.115, topW / 2 - 0.045].forEach(tx => {
          const tBolt = createCylinder(0.005, 0.005, 0.008, boltMat, tx, doorH + topH + 0.004, 0, jGrp);
        });

        // 3. 상부 트랜섬 (Transom / 막판)
        const transY = doorH + topH + transH / 2;
        createBox(topW, transH, 0.045, jambMat, 0, transY, -0.015, jGrp);

        // 4. 층표시기(인디케이터) LED 패널
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const tex = new THREE.CanvasTexture(canvas);
        const ledMat = new THREE.MeshStandardMaterial({
          color: 0x0a0c0e,
          emissive: 0xffffff,
          emissiveMap: tex,
          emissiveIntensity: 2.2
        });
        createBox(0.42, 0.11, 0.008, ledMat, 0, transY, jambD / 2 + 0.004, jGrp);
        indicators.push({ ctx: ctx, texture: tex });

        // 위치 설정 및 부모 그룹에 추가
        jGrp.position.set(0, fy, jambZ);
        parent.add(jGrp);
      }

      /* ── 도어 행정(2짝 중앙개폐) — 헤더 폭·연동로프 배치의 단일 원본 ──
         dw 도어 1짝 폭, cx 닫힘 시 행거판 중심, ox 열림 시 행거판 중심.
         헤더(행거 케이스) 폭은 "활짝 열린 행거판이 아직 레일 위에 있는" 조건에서 역산한다.
         예전 값 S.DOOR_W + 0.40 = 1.90m 는 행정 ±1.145m 보다 좁아, 문을 열면
         행거판과 연동로프 고정단이 레일 밖 허공으로 튀어나갔다. */
      const dw = S.DOOR_W / 2 + 0.02;
      const cx = dw / 2 + 0.006, ox = dw * 1.5 - 0.01;
      const HP_W = 0.380; // 행거 플레이트 폭 (buildHangerAssembly 베이스판과 동일 원본)

      // ── 승장 도어 오퍼레이터 (행거 케이스 + 양단 브라켓 + C레일 속 롤러) ──
      const hcGalvMat = new THREE.MeshStandardMaterial({ color: 0xbac3cd, metalness: 0.65, roughness: 0.38 });
      const hcRailMat = new THREE.MeshStandardMaterial({ color: 0xd8e0e8, metalness: 0.75, roughness: 0.25 });
      const hcDarkMat = new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.50, roughness: 0.60 });
      const ropeMat   = new THREE.MeshStandardMaterial({ color: 0x8a929c, metalness: 0.80, roughness: 0.30 });

      // Existing key body and door-closer spring still use these materials.
      const ilContactMat = M.gold();
      const ilSpringMat = M.ss(0xd0d5da);

      const hcW = 2 * (ox + HP_W / 2 + 0.075); // 행거 케이스 전폭 ≈ 2.82m (도어 행정에서 역산)
      const CASE_H = 0.104;       // 174p C형 케이스 높이 (104mm)
      const CASE_D = 0.035;       // 174p C형 케이스 깊이 (35mm)
      const TRACK_OFF = 0.069;    // 174p 피아노선 → 트랙센터 수직거리 (69mm)

      /* ── Z 레이어 원본: 연동 로프 본선은 "행거판 뒤"에서 달린다 ──
         양단 풀리를 작게 잡으면 상·하 가닥이 행거판 높이 안쪽(inboard)으로 들어온다.
         그래서 행거판 솔리드 금속면 앞에서는 상·하 본선이 보이면 안 된다.
         로프가 눈에 드러나는 곳은 세 군데다.
           (a) 두 행거판 사이·바깥의 열린 헤더 구간 (C레일 웹을 배경으로 노출)
           (b) 화면 우측 행거판 가운데 풀리창 — 안쪽 본선이 2열 홈 롤러를 타고 바깥으로 나옴
           (c) 같은 판의 좌·우 고정 구멍 — 바깥으로 나온 끝이 스프링 고정대에 물림
         상·하 본선은 같은 평면을 쓴다. 바깥으로 나오는 짧은 구간만 판 앞에 있다. */
      const CASE_LIP_Z = -(CASE_D / 2) + 0.002;  // C형 케이스 전면 립
      const HP_PLATE_Z = CASE_LIP_Z - 0.005;     // 행거 플레이트 전면 중심 Z (승강로에서 보이는 면)
      /* 로프 주행면은 행거판 뒤 12mm. 8mm 로 잡으면 활짝 열렸을 때 행거판 바깥변이
         풀리를 덮는데도 풀리 앞 플랜지(반두께 11mm)가 판 앞면을 1.25mm 뚫고 나온다.
         "판 반두께 1.75mm + 풀리 반두께 11mm" 보다 깊게 물려야 완전히 가려진다. */
      const ROPE_PLANE_Z = HP_PLATE_Z + 0.012;   // 로프 주행면 = 행거판 뒤 12mm (판이 앞을 가린다)
      const ROPE_UP_Z  = ROPE_PLANE_Z;           // 상부 가닥
      const ROPE_LO_Z  = ROPE_PLANE_Z;           // 하부 가닥
      const ROPE_Z     = ROPE_PLANE_Z;

      /* ── 연동(릴레이팅) 로프 제원 — 2짝 중앙개폐 동기 링크 ──
         상부 가닥에 월드 +X 행거판, 하부 가닥에 월드 -X 행거판이 물린다.
         한쪽이 열림 방향으로 가면 로프가 양단 풀리를 돌아 반대쪽을 같은 양만큼 끌어간다. */
      /* 풀리 홈 반지름이 상·하 가닥 간격(2·ROPE_R)을 그대로 정한다 — 단일 원본.
         행거판은 높이 160mm, 중심 caseCY-40mm 이므로 윗변이 caseCY+40mm 다.
         ROPE_R=0.022 → 상부 가닥 caseCY+22mm 로 윗변보다 18mm 아래 = 판 안쪽.
         (예전 0.040 은 상부 가닥이 판 윗변에 정확히 올라타서 판 밖으로 튀어나왔고,
          플랜지 46mm 는 C레일 상·하 립(±38mm)을 뚫고 지나갔다.) */
      const ROPE_R  = 0.022;   // 풀리 홈 반지름 — 상·하 가닥 간격 44mm, 행거판 안쪽으로 진입
      const PUL_R   = 0.030;   // 풀리 플랜지 바깥 반지름 — C레일 상·하 립 사이에 들어간다
      const ROPE_RD = 0.0035;  // 연동로프 Ø7
      const RA_OFF  = 0.020;   // 월드 +X 행거판 로컬 x — 상부 가닥 클램프 고정단 중심
      const RA_HALF = 0.052;   // 클램프 고정단 어셈블리 반길이 (로프 가닥이 끊기는 구간)
      const RB_OFF  = -0.020;  // 월드 -X 행거판 로컬 x — 타공창 롤러 텐셔너 중심
      /* 하부 가닥 본선이 끊기는 두 점 (월드 -X 행거판 로컬 x).
         본선은 풀리 뒤(안쪽) 접선에서 끊긴다. 창으로 나와 스프링에 물리는 짧은 구간은
         행거판에 붙인 고정 튜브다. 예전 ±0.082/0.095 는 본선을 고정대까지 끌어
         롤러를 안 쓰고 판 뒤를 가로지르는 것처럼 보였다. */
      const RB_L    =  0.000;  // 풀리 뒤(안쪽) 접선 — 상단 홈으로 진입
      const RB_R    = +0.002;  // 풀리 뒤 접선에서 2mm — 하단 홈으로 진입 (마디 겹침 방지)

      /* ── 텐셔너(2열 홈 수평 풀리) 제원 — 행거판 타공창 위치의 단일 원본 ──
         행거판 메쉬 중심이 월드 caseCY-0.040 이므로 로컬 Y = 월드Y - caseCY + 0.040.
         하부 가닥/상단 홈의 로컬 Y 가 TP_LY = 0.040 - ROPE_R = 18mm 다. */
      /* ★로프 중심이 앉는 피치 반지름(TP_GR)과 홈 바닥(TP_HR)·플랜지(TP_FR)를 분리한다.
         셋을 한 값으로 뭉뚱그리면 플랜지가 로프보다 커져서 감김이 원판 속에 파묻혀
         "끊긴 엘보" 처럼 보인다. TP_HR = 피치 - 로프반지름, TP_FR = 로프 바깥면 + 1mm. */
      const TP_GR    = 0.008;            // 로프 중심 피치 반지름
      const TP_HR    = 0.0048;           // 홈 바닥(허브) 반지름
      const TP_FR    = 0.0122;           // 플랜지 반지름
      const TP_DY    = 0.012;            // 상단 홈 ↔ 하단 홈 높이차
      const TP_LY    = 0.040 - ROPE_R;   // 행거판 로컬 좌표계에서의 상단 홈 높이
      const TP_ROD_X = RB_OFF - 0.039;   // 화면 오른쪽 고정 구멍 중심 (로컬 −X)
      const TP_SPR_X = RB_OFF + 0.039;   // 화면 왼쪽 고정 구멍 중심 (로컬 +X)
      const doorRopeGeo = makeRopeGeometry(ROPE_RD, GOV_ROPE_PITCH, 12, 12); // 단위길이 1m 공유

      /* 폐문 스프링용 헬릭스 튜브 — 원점에서 +X 로 단위길이 1m.
         mesh.scale.x 로 늘리면 코일 피치가 같이 벌어져서 실제 인장 스프링처럼 보인다.
         전 층이 같은 지오메트리를 공유한다(렌더 루프에서 새로 만들지 않는다). */
      function makeCoilGeometry(turns, coilR, wireR, segPerTurn = 10) {
        const pts = [], n = turns * segPerTurn;
        for (let i = 0; i <= n; i++) {
          const t = i / n, a = t * turns * Math.PI * 2;
          pts.push(new THREE.Vector3(t, Math.cos(a) * coilR, Math.sin(a) * coilR));
        }
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wireR, 6, false);
      }
      const closerCoilGeo = makeCoilGeometry(100, 0.0075, 0.0021);

      function createHangerCaseAssembly(fy, parent) {
        const hcGrp = new THREE.Group();
        const doorH = S.DOOR_H;

        // 도면 174p: C레일 트랙 중심 = 승장 도어 및 승장 실 단일 PLUMB 축 (HATCH_PLUMB_Z)
        const trackCtrZ = HATCH_PLUMB_Z;
        const wallLocalZ = FRONT_WALL_INNER_Z - trackCtrZ;

        const railY = doorH + 0.145;
        const caseCY = railY + 0.040;
        const caseTopY = caseCY + CASE_H / 2;
        const caseBotY = caseCY - CASE_H / 2;
        const topRailY = caseTopY - 0.0035;
        const botRailY = caseBotY + 0.009;
        const webZ = CASE_D / 2 - 0.002;
        const lipZ = CASE_LIP_Z;

        // 1. 행거 케이스 브라켓 양단 (173p L브라켓). 벽 앙카 + 리턴으로 C레일을 받침.
        const hcBrkMat = new THREE.MeshStandardMaterial({ color: 0x8e97a3, metalness: 0.62, roughness: 0.42 });
        const brkX = hcW / 2 - 0.05;
        const brW = 0.130;
        const brH = CASE_H + 0.086;
        const brY = caseCY;
        const spanZ = wallLocalZ - webZ;
        const spanCtrZ = (wallLocalZ + webZ) / 2;
        [-brkX, brkX].forEach(bx => {
          const side = bx > 0 ? 1 : -1;
          createBox(brW, brH, 0.008, hcBrkMat, bx, brY, wallLocalZ - 0.004, hcGrp);
          [-0.055, 0, 0.055].forEach(ay => {
            createBox(0.048, 0.014, 0.002, hcDarkMat, bx + side * 0.012, brY + ay, wallLocalZ - 0.0085, hcGrp);
            const anc = createCylinder(0.007, 0.007, 0.028, boltMat, bx + side * 0.012, brY + ay, wallLocalZ + 0.012, hcGrp);
            anc.rotation.x = Math.PI / 2;
          });
          createBox(brW, 0.012, spanZ, hcBrkMat, bx, caseTopY + 0.006, spanCtrZ, hcGrp);
          createBox(brW, 0.010, spanZ, hcBrkMat, bx, caseBotY - 0.005, spanCtrZ, hcGrp);
          createBox(0.010, brH, spanZ - 0.004, hcBrkMat,
            bx + side * (brW / 2 - 0.005), brY, spanCtrZ, hcGrp);
          [-0.028, 0.028].forEach(by => {
            const m10 = createCylinder(0.006, 0.006, 0.022, boltMat, bx, caseCY + by, webZ + 0.012, hcGrp);
            m10.rotation.x = Math.PI / 2;
            createBox(0.014, 0.014, 0.004, boltMat, bx, caseCY + by, webZ + 0.003, hcGrp);
          });
        });

        // 2. C형 행거 케이스 104×35mm + 상·하 궤도 (브라켓 사이에 걸침)
        createBox(hcW - 0.02, CASE_H, 0.003, hcGalvMat, 0, caseCY, webZ, hcGrp);
        createBox(hcW - 0.02, 0.003, CASE_D, hcGalvMat, 0, caseTopY - 0.0015, 0, hcGrp);
        createBox(hcW - 0.02, 0.003, CASE_D, hcGalvMat, 0, caseBotY + 0.0015, 0, hcGrp);
        createBox(hcW - 0.02, 0.012, 0.003, hcGalvMat, 0, caseTopY - 0.008, lipZ, hcGrp);
        createBox(hcW - 0.02, 0.012, 0.003, hcGalvMat, 0, caseBotY + 0.008, lipZ, hcGrp);
        createBox(hcW - 0.04, 0.006, 0.016, hcRailMat, 0, topRailY, 0, hcGrp);
        createBox(hcW - 0.04, 0.006, 0.016, hcRailMat, 0, botRailY, 0, hcGrp);

        /* 3. 연동 풀리 — 케이스 양단, C레일 높이.
           홈 반지름 ROPE_R 에 로프가 앉고 바깥 플랜지 PUL_R 가 이탈을 막는다.
           회전각은 도어 행정에서 역산한다(spinDoorDrive). 시간 기반 연출이 아니다. */
        const pulY  = caseCY;
        const pulLX = -(hcW / 2 - 0.115);
        const pulRX = +(hcW / 2 - 0.115);

        function makeRelayPulley(px, sg) {
          /* 축 브라켓(고정) — C레일 립에서 승강로 전면 가시 평면(ROPE_Z)으로 뻗어 풀리 축을 잡는다. */
          createBox(0.028, 0.070, Math.abs(lipZ - ROPE_Z) + 0.012, hcGalvMat,
            px + sg * 0.034, pulY, (lipZ + ROPE_Z) / 2, hcGrp);
          createBox(0.028, 0.070, 0.004, hcGalvMat, px + sg * 0.034, pulY, ROPE_Z - 0.006, hcGrp);
          const pg = new THREE.Group();
          pg.position.set(px, pulY, ROPE_Z);
          // 홈 바닥 + 양측 이탈방지 플랜지
          createCylinder(ROPE_R, ROPE_R, 0.014, hcDarkMat, 0, 0, 0, pg).rotation.x = Math.PI / 2;
          [-0.009, 0.009].forEach(fz => {
            createCylinder(PUL_R, PUL_R, 0.004, hcDarkMat, 0, 0, fz, pg).rotation.x = Math.PI / 2;
          });
          // 허브·축
          createCylinder(0.011, 0.011, 0.026, boltMat, 0, 0, 0, pg).rotation.x = Math.PI / 2;
          // 살빼기 구멍 4개 — 회전이 눈으로 보이게 하는 기준점
          for (let s = 0; s < 4; s++) {
            const a = s * Math.PI / 2 + Math.PI / 4;
            createCylinder(0.0045, 0.0045, 0.005, hcGalvMat,
              Math.cos(a) * PUL_R * 0.60, Math.sin(a) * PUL_R * 0.60, -0.0095, pg).rotation.x = Math.PI / 2;
          }
          hcGrp.add(pg);
          return pg;
        }
        const pulL = makeRelayPulley(pulLX, -1);
        const pulR = makeRelayPulley(pulRX, +1);

        /* 3-1. 연동 로프 — 상·하 2가닥 + 양단 180° 감김.
           가닥은 두 고정단에서 끊기므로 마디 4개로 만들고 길이만 갱신한다.
           (렌더 루프에서 지오메트리를 새로 만들지 않는다 — AGENTS.md) */
        const ropeGrp = new THREE.Group();
        ropeGrp.name = 'hallRelayRope';
        hcGrp.add(ropeGrp);
        function makeRopeSpan() {
          const m = new THREE.Mesh(doorRopeGeo, makeGovRopeMat());
          m.rotation.z = Math.PI / 2; // 로프 축(로컬 Y) → 월드 X
          m.castShadow = false;
          ropeGrp.add(m);
          return m;
        }
        const ropeSeg = {
          upL: makeRopeSpan(), upR: makeRopeSpan(),  // 상부 가닥: 좌풀리~고정단A, 고정단A~우풀리
          loL: makeRopeSpan(), loR: makeRopeSpan()   // 하부 가닥: 좌풀리~고정단B, 고정단B~우풀리
        };
        // 양단 180° 감김 — 상부 가닥이 풀리 홈을 타고 하부 가닥으로 넘어가는 구간
        [[pulLX, +Math.PI / 2], [pulRX, -Math.PI / 2]].forEach(([px, rz]) => {
          const wrap = new THREE.Mesh(
            new THREE.TorusGeometry(ROPE_R, ROPE_RD, 8, 20, Math.PI), ropeMat);
          wrap.position.set(px, pulY, ROPE_Z);
          wrap.rotation.z = rz;
          wrap.castShadow = false;
          ropeGrp.add(wrap);
        });

        /* ── 3-2. 승장 도어 스프링 도어 클로저 어셈블리 (도면 181p: SPRING CLOSER BRKT + COVER + SPRING) ──
           브라켓은 헤더 +X 끝단 고정, 스프링 좌단은 -X 행거판의 SPRING HANGER 러그에 걸린다.
           문이 열리면 러그가 멀어지며 스프링이 늘어난다(도면 181p 적색 양방향 화살표). */
        // (1) SPRING CLOSER BRKT (C레일 상단 +X 끝단 스프링 고정 브라켓)
        const scbX = hcW / 2 - 0.16;
        const scbY = caseTopY + 0.025;
        // C레일 상단 안착 수평 베이스 플랜지 & 체결 M6 볼트 2개
        createBox(0.065, 0.0035, 0.034, hcGalvMat, scbX, caseTopY + 0.0018, 0, hcGrp);
        [scbX - 0.020, scbX + 0.020].forEach(bx => {
          createCylinder(0.0035, 0.0035, 0.008, boltMat, bx, caseTopY + 0.005, 0, hcGrp);
        });
        // 수직 스프링 앵커 기둥 & 스프링 결합 핀
        createBox(0.004, 0.048, 0.028, hcGalvMat, scbX, scbY, 0, hcGrp);
        const sPin = createCylinder(0.004, 0.004, 0.014, boltMat, scbX - 0.006, scbY, 0, hcGrp);
        sPin.rotation.z = Math.PI / 2;

        // (2) COVER (스프링 보호 커버 / ㄷ자형 아연도금 판금 덕트 — 도면 181p)
        //     스프링이 활짝 열림까지 늘어나는 전 구간을 덮되, 전면(승강로 쪽)은
        //     짧은 립만 두어 스프링이 보이게 한다.
        const covRightX = scbX;
        const covLeftX  = -ox - 0.075;
        const covLen    = covRightX - covLeftX;
        const covMidX   = (covRightX + covLeftX) / 2;
        const covTopY   = caseTopY + 0.046;
        createBox(covLen, 0.0025, 0.034, hcGalvMat, covMidX, covTopY, 0, hcGrp);          // 상면
        createBox(covLen, 0.012, 0.0025, hcGalvMat, covMidX, covTopY - 0.007, lipZ + 0.006, hcGrp); // 전면 립
        createBox(covLen, 0.038, 0.0025, hcGalvMat, covMidX, caseTopY + 0.027, webZ - 0.006, hcGrp); // 후면 측벽
        // 커버 상단 고정 나사 (도면 181p) — 340mm 간격
        for (let sx = covLeftX + 0.12; sx < covRightX - 0.05; sx += 0.34) {
          createCylinder(0.0025, 0.0025, 0.004, boltMat, sx, covTopY + 0.002, 0, hcGrp);
        }

        // (3) SPRING (수평 롱 인장 코일 스프링 — 도면 181p). 길이는 spinDoorDrive 가 갱신한다.
        const sprCoil = new THREE.Mesh(closerCoilGeo, ilSpringMat);
        sprCoil.position.set(0, scbY, 0); // x 와 scale.x 는 spinDoorDrive 가 잡는다
        sprCoil.castShadow = false;
        hcGrp.add(sprCoil);

        // 4. 행거판·롤러는 문짝과 함께 올린다. 이번엔 C레일만 둔다.

        // Field-reference GLB: fixed switch, +X hook, -X long slotted keeper.
        const ilMount = new THREE.Group();
        ilMount.name = 'hallInterlockMount';
        hcGrp.add(ilMount);
        const latchSpec = {}; // Populated from Blender GLB extras by HallInterlock.

        hcGrp.position.set(0, fy, trackCtrZ);
        parent.add(hcGrp);

        return {
          relPulley: pulL, endPulley: pulR, ilMount,
          geom: { trackCtrZ, caseCY, topRailY, botRailY, lipZ, plateZ: HP_PLATE_Z, latch: latchSpec },
          /* 연동 링크 핸들 — spinDoorDrive(h) 가 도어 행정만 보고 갱신한다.
             hcGrp.position.x = 0 이므로 여기 x 값은 월드 x 와 같다. */
          link: {
            seg: ropeSeg, pulL, pulR, pulLX, pulRX,
            upZ: ROPE_UP_Z, loZ: ROPE_LO_Z, ropeZ: ROPE_Z,
            upY: pulY + ROPE_R, loY: pulY - ROPE_R, ropeR: ROPE_R,
            aOff: RA_OFF, aHalf: RA_HALF,
            bL: RB_OFF + RB_L, bR: RB_OFF + RB_R,
            closer: { anchorX: scbX - 0.010, lugDX: -0.060, coil: sprCoil }
          }
        };
      }

      // ── 전 층 실 서포트 · 승장 실 · 삼방틀 · 행거 케이스 ──
      const bracketPositions = [-0.60, -0.30, 0.0, 0.30, 0.60];
      const headerByFloor = [];
      for (let i = 0; i < FLOORS; i++) {
        const fy = FLOOR_Y[i];
        bracketPositions.forEach(bx => {
          createSillSupport(bx, fy, sillSupportGrp);
        });
        createHallSill(fy, sillSupportGrp);
        createToeGuard(fy, sillSupportGrp);
        createJambAssembly(fy, sillSupportGrp);
        headerByFloor.push(createHangerCaseAssembly(fy, sillSupportGrp));
      }
      scene.add(sillSupportGrp);

      // ── 행거 플레이트 공통 재질 ──
      const hpPlateMat   = new THREE.MeshStandardMaterial({ color: 0xbaa870, metalness: 0.65, roughness: 0.40 }); // 크로메이트 아연도금 강판
      const ilGoldZincMat= new THREE.MeshStandardMaterial({ color: 0xaa8c32, metalness: 0.80, roughness: 0.30 }); // 인터록 모듈 전용 진한 골드 크로메이트
      const hpSteelMat   = new THREE.MeshStandardMaterial({ color: 0x8e97a3, metalness: 0.70, roughness: 0.35 }); // 구조용 스틸
      const hpRollerMat  = new THREE.MeshStandardMaterial({ color: 0x1f242b, metalness: 0.30, roughness: 0.60 }); // 블랙 고무/우레탄 롤러
      const hpBoltMat    = new THREE.MeshStandardMaterial({ color: 0xc8d2dc, metalness: 0.80, roughness: 0.25 }); // 아연도금 볼트/너트
      const hpSpringMat  = new THREE.MeshStandardMaterial({ color: 0xd0d5da, metalness: 0.75, roughness: 0.25 }); // 인장 스프링 스틸
      const hpDarkMat    = new THREE.MeshStandardMaterial({ color: 0x1f2329, roughness: 0.80 }); // 슬롯/음영 매트 블랙

      /* 텐셔너 감김 — 본선과 같은 makeGovRopeMat (은색 연선 텍스처).
         좁은 홈에서 6연선 로브를 밀어 넣으면 회색 덩어리로 보이므로 단면은 원통이다. */
      function makeRopeTube(grp, pts) {
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        const tg = new THREE.TubeGeometry(curve, 48, ROPE_RD * 0.9, 12, false);
        const mat = makeGovRopeMat();
        const len = curve.getLength();
        mat.userData.ropeLen = len;
        mat.userData.ropeUvAlongU = true;
        const n = Math.max(0.4, len / GOV_ROPE_PITCH);
        if (mat.map) mat.map.repeat.set(n, 1);
        if (mat.normalMap) mat.normalMap.repeat.set(n, 1);
        const tube = new THREE.Mesh(tg, mat);
        tube.castShadow = true;
        grp.add(tube);
        return tube;
      }

      /* ── 실물 7계열 행거 플레이트 어셈블리 (side: +1 = 화면 좌측 패널/right 그룹/걸쇠측, -1 = 화면 우측 패널/left 그룹/수놈핀측) ── */
      function buildHangerAssembly(grp, side, cx, g) {
        const plateZ = HP_PLATE_Z;
        const isHookSide = side > 0; // side > 0: 화면 왼쪽 패널 (right 그룹, 월드 +X) = 걸쇠/2열롤러/하단연장바
        const tensY = g.caseCY - ROPE_R; // 하부 연동 로프 및 텐셔너 높이

        // 1. 메인 행거 플레이트 베이스판 (폭 380mm x 높이 160mm x 두께 3.5mm)
        if (isHookSide) {
          // 화면 좌측 패널 (right 그룹): 솔리드 플레이트 (후면 로프 차폐)
          createBox(0.380, 0.160, 0.0035, hpPlateMat, 0, g.caseCY - 0.040, plateZ, grp);
        } else {
          /* 화면 우측 패널 (left 그룹): 타공창 3개.
             가운데 = 2열 홈 롤러, 좌·우 = 연동로프 스프링 고정대 (설치도면·실사 202356).
             본선은 판 뒤, 롤러를 타고 판 앞(승강로 쪽)으로 나와 고정된다. */
          const pShape = new THREE.Shape();
          pShape.moveTo(-0.190, -0.080);
          pShape.lineTo(0.190, -0.080);
          pShape.lineTo(0.190, 0.080);
          pShape.lineTo(-0.190, 0.080);
          pShape.closePath();

          /* 창 사각형(행거판 로컬 좌표)을 userData 에 남긴다 — tools/verify_relay_rope.mjs 가
             하드코딩 대신 이 값을 읽어서 "상부 가닥이 어느 창에도 안 걸리는지" 를 검사한다. */
          grp.userData.windows = [];
          grp.userData.tens = {
            rbOff: RB_OFF, gr: TP_GR, fr: TP_FR, dy: TP_DY, ly: TP_LY,
            rodX: TP_ROD_X, sprX: TP_SPR_X
          };
          const addWin = (x0, x1, y0, y1) => {
            const hole = new THREE.Path();
            hole.moveTo(x0, y0);
            hole.lineTo(x1, y0);
            hole.lineTo(x1, y1);
            hole.lineTo(x0, y1);
            hole.closePath();
            pShape.holes.push(hole);
            grp.userData.windows.push({ x0, x1, y0, y1 });
          };
          const wUpY = TP_LY;          // 상단 홈 로컬 Y
          const wLoY = TP_LY - TP_DY;  // 하단 홈 로컬 Y
          const wMidY = (wLoY + wUpY) / 2;
          /* 설치도면: 가로로 구멍 3개. 가운데가 조금 크고 좌·우 고정 구멍이 바로 옆. */
          addWin(RB_OFF - 0.021, RB_OFF + 0.021, wLoY - 0.014, wUpY + 0.020);
          addWin(TP_ROD_X - 0.012, TP_ROD_X + 0.012, wMidY - 0.018, wMidY + 0.018);
          addWin(TP_SPR_X - 0.012, TP_SPR_X + 0.012, wMidY - 0.018, wMidY + 0.018);

          const pGeom = new THREE.ExtrudeGeometry(pShape, { depth: 0.0035, bevelEnabled: false });
          const pMesh = new THREE.Mesh(pGeom, hpPlateMat);
          pMesh.position.set(0, g.caseCY - 0.040, plateZ - 0.00175);
          grp.add(pMesh);
        }

        // 2. 도면 174p 하단 일체형 34mm L-플랜지 & M8 직결 볼트 2세트 (도어 상단과 완벽 일체화)
        const flapZ = hatchPanelZ(g.trackCtrZ); // 0 (단일 PLUMB 축)
        const flapY = g.caseCY - 0.120 - 0.0035 / 2;
        // 도어 상단을 덮는 34mm 수평 플랜지
        createBox(0.380, 0.0035, 0.034, hpPlateMat, 0, flapY, flapZ, grp);
        // 수직 행거판과 하단 플랜지를 잇는 절곡 코너 연결부
        if (Math.abs(plateZ - flapZ) > 0.002) {
          createBox(0.380, 0.0035, Math.abs(plateZ - flapZ), hpPlateMat, 0, flapY, (plateZ + flapZ) / 2, grp);
        }
        // 상단 M8 체결 볼트 머리 & 하단 사각 너트 2세트
        [-0.120, 0.120].forEach(bx => {
          createCylinder(0.006, 0.006, 0.004, hpBoltMat, bx, flapY + 0.0035, flapZ, grp);
          createBox(0.013, 0.005, 0.013, hpBoltMat, bx, flapY - 0.0045, flapZ, grp);
        });

        if (isHookSide) {
          // ── 화면 좌측 행거판 (right 그룹, 월드 +X): 상단 연동 로프 클램프 + 실물 7계열 인터록 롤러/걸쇠/하단 긴 바 ──
          // 도어 중앙 방향은 로컬 -X 방향임!

          /* (1) 연동 로프 스프링 고정단 — 실사 2026-08-18 000627 / 000712 좌측
             상부 가닥이 이 판에서 끊긴다. 중앙(-X) 쪽 로프는 인장 코일 스프링을 거쳐
             전산볼트·육각너트로 물리고, 바깥(+X) 쪽 로프는 같은 볼트에 직결된다. */
          const clampY = g.caseCY + ROPE_R;   // 상부 가닥 높이 — 행거판 윗변(caseCY+0.040)보다 18mm 아래
          const rZ = ROPE_UP_Z;               // 로프면은 행거판 뒤
          /* 이 판은 타공창이 없는 솔리드 판이다. 로프가 판 뒤로 지나가므로 앞면에서는
             좌면 패드와 조임 볼트 머리만 보이고 로프·스프링은 한 가닥도 드러나지 않는다. */
          // 전면 좌면 패드 + M8 조임 볼트 머리 2개 (판 앞에서 보이는 유일한 흔적)
          createBox(0.058, 0.030, 0.003, hpSteelMat, RA_OFF, clampY, plateZ - 0.0025, grp);
          [-0.019, 0.019].forEach(cb => {
            createCylinder(0.005, 0.005, 0.004, hpBoltMat, RA_OFF + cb, clampY, plateZ - 0.006, grp)
              .rotation.x = Math.PI / 2;
          });
          // 판을 관통해 뒤쪽 로프면까지 가는 스페이서
          createBox(0.046, 0.014, Math.abs(rZ - plateZ), hpSteelMat, RA_OFF, clampY, (plateZ + rZ) / 2, grp);
          // 로프를 무는 크로메이트 클램프 블록 + 조임 볼트 2개 (판 뒤)
          createBox(0.024, 0.020, 0.013, hpSteelMat, RA_OFF, clampY, rZ, grp);
          [-0.007, 0.007].forEach(cb => {
            createCylinder(0.0035, 0.0035, 0.015, hpBoltMat, RA_OFF + cb, clampY, rZ + 0.0065, grp)
              .rotation.x = Math.PI / 2;
          });
          // 인장 코일 스프링 (중앙 -X 쪽 로프 끝) — 스웨이지 슬리브 → 코일 → 육각너트
          const spA0 = RA_OFF - RA_HALF + 0.004; // 코일 시작
          const spA1 = RA_OFF - 0.014;           // 코일 끝(클램프 앞)
          createCylinder(0.0022, 0.0022, spA1 - spA0, hpBoltMat, (spA0 + spA1) / 2, clampY, rZ, grp)
            .rotation.z = Math.PI / 2;
          for (let ci = 0; ci < 9; ci++) {
            createCylinder(0.0058, 0.0058, 0.0032, hpSpringMat,
              spA0 + (ci + 0.5) * (spA1 - spA0) / 9, clampY, rZ, grp).rotation.z = Math.PI / 2;
          }
          createBox(0.008, 0.011, 0.011, hpBoltMat, spA0 - 0.005, clampY, rZ, grp); // 스웨이지 슬리브
          createBox(0.006, 0.010, 0.010, hpBoltMat, RA_OFF - 0.016, clampY, rZ, grp); // 육각너트
          // 바깥(+X) 쪽 전산볼트 + 육각너트 2개 — 실사에서 로프 끝이 밖으로 빠져나온 부분
          createCylinder(0.0022, 0.0022, RA_HALF - 0.010, hpBoltMat,
            RA_OFF + (RA_HALF + 0.010) / 2, clampY, rZ, grp).rotation.z = Math.PI / 2;
          [0.015, 0.026].forEach(nx => {
            createBox(0.006, 0.011, 0.011, hpBoltMat, RA_OFF + nx, clampY, rZ, grp);
          });

          // Roller base, hook, compression spring and link are supplied by the GLB.
        } else {
          // ── 화면 우측 행거판 (left 그룹, 월드 -X): SPRING HANGER + 연동 로프 텐셔너 + 실물 7계열 보조접점 수놈 핀 L브라켓 ──
          // 도어 중앙 방향은 로컬 +X 방향임!

          // (0) SPRING HANGER (상단 스프링 행거 체결 브라켓 — 도면 181p)
          const shY = g.caseCY + 0.077;
          createBox(0.035, 0.045, 0.0035, hpSteelMat, -0.060, shY, plateZ, grp);
          createBox(0.035, 0.0035, -plateZ, hpSteelMat, -0.060, shY + 0.021, plateZ / 2, grp);
          // 스프링 우단 결합 러그 핀
          const shLug = createCylinder(0.004, 0.004, 0.014, boltMat, -0.060, shY + 0.021, 0, grp);
          shLug.rotation.z = Math.PI / 2;

          /* (1) 연동 로프 텐셔너 — 2열 홈 수평 풀리 + 판 앞 좌·우 스프링 고정대.
             본선은 판 뒤(안쪽). 롤러를 타고 승강로 쪽(판 앞)으로 나와 고정된다.
             상단 홈 → 화면 오른쪽 구멍, 하단 홈 → 화면 왼쪽 구멍. */
          const upGY = tensY;               // 상단 홈 = 하부 본선 높이
          const loGY = tensY - TP_DY;       // 하단 홈 = 12mm 아래
          const pulZ = plateZ - 0.008;      // 롤러 중심 Z (타공창 안)
          const zFace = plateZ - 0.0035 / 2 - 0.001; // 판 앞면 바깥

          /* 스프링 고정대(육각 스터드 + 슬리브)를 판 앞면에 박는다.
             outerSign: 판 바깥쪽 방향 (+1 은 우측 로컬 +X, -1 은 좌측 로컬 -X) */
          function addFaceTensioner(sleeveX, y, outerSign) {
            createBox(0.016, 0.028, 0.0035, hpSteelMat, sleeveX, y, plateZ - 0.002, grp);
            const slv = createCylinder(0.004, 0.004, 0.012, hpBoltMat, sleeveX, y, zFace, grp);
            slv.rotation.x = Math.PI / 2;
            const nutX = sleeveX + outerSign * 0.010;
            [0, outerSign * 0.005].forEach(dx => {
              const hx = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.0045, 6), hpBoltMat);
              hx.position.set(nutX + outerSign * dx, y, zFace);
              hx.rotation.z = Math.PI / 2;
              grp.add(hx);
            });
            return sleeveX;
          }
          const rodSleeveX = addFaceTensioner(TP_ROD_X, upGY, -1);
          const sprSleeveX = addFaceTensioner(TP_SPR_X, loGY, +1);

          /* 홈 원주만 찍는다. 끝점을 고정대까지 한 스플라인에 넣으면
             CatmullRom 이 원을 벗어나 롤러 옆을 가로지른다. */
          function wrapGroove(yA, yB, a0, a1, sleeveX, sleeveY) {
            const n = 32;
            const arc = [];
            for (let i = 0; i <= n; i++) {
              const t = i / n;
              const a = a0 + (a1 - a0) * t;
              const y = yA + (yB - yA) * Math.min(1, t / 0.18);
              arc.push(new THREE.Vector3(
                RB_OFF + TP_GR * Math.cos(a), y, pulZ + TP_GR * Math.sin(a)));
            }
            makeRopeTube(grp, arc);
            const end = arc[n];
            makeRopeTube(grp, [
              end,
              new THREE.Vector3(
                end.x * 0.55 + sleeveX * 0.45,
                end.y * 0.55 + sleeveY * 0.45,
                end.z * 0.55 + zFace * 0.45),
              new THREE.Vector3(sleeveX, sleeveY, zFace)
            ]);
          }
          /* 상단 홈: 뒤 → 좌 → 앞(카메라) → 우. 정면에서 홈이 와이어로 덮인다. */
          wrapGroove(upGY, upGY, Math.PI / 2, -Math.PI, rodSleeveX, upGY);
          /* 하단 홈: 뒤 → 우 → 앞 → 좌. 뒤쪽에서 높이만 내린다. */
          wrapGroove(upGY, loGY, Math.PI / 2, Math.PI * 2, sprSleeveX, loGY);

          // The opposite-door slotted keeper is supplied by the GLB.
        }
      }

      /* ── 승장 도어 패널 어셈블리 (도면 175p, 176p) ──
         - 상단: 행거 플레이트 하단 L자 플랜지에 탭 플레이트 & 조절 심 라이너(Liner)로 M8 체결
         - 본체: 프리미엄 실버 헤어라인 스테인리스 도어 패널 (폭 775mm x 높이 dh x 두께 32mm)
         - 중앙 에지: 닫힘 시 손끼임 방지 5mm 간격 및 흑색 고무 완충 스트립
         - 후면(승강로 측): 세로 보강 C채널 2줄 (폭 50mm, 높이 dh * 0.94)
         - 하단: 1번 실 가이드 슈 2개소 + 2번 실 보강슈(문짝당 1개, 승강로 쪽으로 돌출)
         - 의장면(홀 쪽): 손대지 마시오 / 기대면 추락 위험 안전 스티커 */
      function buildHatchDoorPanel(grp, side, cx, g) {
        const dw = S.DOOR_W / 2 + 0.025; // 패널 폭 775mm (유효 개구폭 1500mm + 중앙 오버랩)
        const dt = HATCH_DT;
        const halfGap = DOOR_MEET_GAP / 2;
        /* 홀 의장면 = +Z (DOOR_HALL_Z). 승강로 후면 = −Z (DOOR_HALL_Z - dt). */
        const zCtr = hatchPanelZ(g.trackCtrZ);
        const zHall = zCtr + dt / 2;
        const zHoist = zCtr - dt / 2;
        const zShoe = (SILL_Z + SILL_GROOVE1_Z) - g.trackCtrZ;
        const zReinf = (SILL_Z + SILL_GROOVE2_Z) - g.trackCtrZ;

        // 높이: 도어 하단은 실 상면에서 5mm(0.005) 위, 도어 상단은 행거 플랜지 바로 아래
        const topY = g.caseCY - 0.120 - 0.0035;
        const botY = 0.005;
        const dh = topY - botY;
        const yCtr = (topY + botY) / 2;

        const isHookSide = side > 0; // side > 0: 화면 왼쪽 패널 (right 그룹, 월드 +X) = 로비에서 왼쪽
        const pX = side < 0
          ? (cx - halfGap - dw / 2)
          : (-cx + halfGap + dw / 2);

        const panMat = M.ss(0xdfe4ec);
        const ribMat = M.ss(0x9aa2aa);
        const linerMat = hpPlateMat;
        const rubberMat = M.paint(0x181a1d);

        // 1. 메인 도어 패널 본체
        createBox(dw, dh, dt, panMat, pX, yCtr, zCtr, grp);

        // 2. 상단 탭 플레이트 & 조절 심 라이너 2개소 (도면 175p 3번)
        [-0.120, 0.120].forEach(bx => {
          createBox(0.048, 0.0030, 0.030, linerMat, bx, g.caseCY - 0.1218, zCtr, grp);
          createBox(0.040, 0.0080, 0.024, hpBoltMat, bx, g.caseCY - 0.1275, zCtr, grp);
        });

        // 3. 중앙 맞물림 에지 & 흑색 고무 완충 스트립
        if (isHookSide) {
          createBox(0.004, dh - 0.020, 0.008, rubberMat, -cx + halfGap, yCtr, zCtr, grp);
        }

        // 4. 패널 후면(승강로 측, −Z) 세로 보강 C채널 2줄
        [-dw * 0.35, dw * 0.35].forEach(rbx => {
          createBox(0.050, dh * 0.94, 0.014, ribMat, pX + rbx, yCtr, zHoist - 0.007, grp);
        });

        // 5. 하단 가이드 슈 — 1번 실 홈
        [-dw * 0.30, dw * 0.30].forEach(gx => {
          createBox(0.045, 0.022, SILL_GROOVE_W - 0.002, ribMat, pX + gx, botY - 0.012, zShoe, grp);
        });

        // 6. 가이드 보강슈 (문짝당 1개) — 문에서 승강로로 살짝 빼서 2번 실 홈을 탄다
        const shoeMat = M.ss(0x6a727c);
        const neckZ = (zHoist + zReinf) / 2;
        const neckD = Math.abs(zHoist - zReinf);
        createBox(0.050, 0.028, 0.0035, shoeMat, pX, botY + 0.012, zHoist - 0.0018, grp);
        createBox(0.038, 0.008, neckD, shoeMat, pX, botY + 0.002, neckZ, grp);
        createBox(0.038, 0.022, SILL_GROOVE_W - 0.002, shoeMat, pX, botY - 0.012, zReinf, grp);
        [-0.012, 0.012].forEach(bx => {
          const b = createCylinder(0.0028, 0.0028, 0.007, hpBoltMat, pX + bx, botY + 0.012, zHoist - 0.005, grp);
          b.rotation.x = Math.PI / 2;
        });

        // 7. 승강장 홀 의장면(+Z) 안전 스티커 — 로비에서 왼쪽=손대지마시오, 오른쪽=기대지마시오
        const mats = getStickerMats();
        const stickerMat = isHookSide ? mats.L : mats.R;
        const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.130, 0.130), stickerMat);
        const stickerX = pX + (isHookSide ? -0.16 : 0.16);
        sticker.position.set(stickerX, 1.45, zHall + 0.001);
        grp.add(sticker);

        // 8. 비상 삼각키 어셈블리 (승강장 바닥 기준 약 2.0m 높이 법정 검사기준 준수, 도면 177p, 실사 112754.png/112837.png)
        if (isHookSide) {
          const triY = 2.000; // 법정 검사기준 설치 높이 2.0m
          // Temporary X; HallInterlock aligns it to the exported link pin after load.
          const barX = -0.098;
          const camRad = 35 * Math.PI / 180;
          const camLen = 0.045;
          const triX = barX - camLen * Math.cos(camRad);
          const pinY = triY + camLen * Math.sin(camRad);

          const triKeyGrp = new THREE.Group();
          triKeyGrp.name = 'EmergencyTriangleKey';
          triKeyGrp.position.set(triX, triY, 0);

          // (1) 승강장 외측 크롬 메탈 베젤 & 비상 삼각키 홀 (zHall 의장면 고대비 실물 리빌드)
          // 1-1. 고광택 크롬 메탈 및 딥 블랙 리세스 포켓 재질
          const chromeMat = new THREE.MeshStandardMaterial({
            color: 0x909caa, metalness: 0.92, roughness: 0.16
          });
          const darkPocketMat = new THREE.MeshStandardMaterial({
            color: 0x101215, roughness: 0.96
          });

          // 1-2. 외측 크롬 베젤 링 (외경 Ø28mm, 내경 Ø17mm, 돌출 2.2mm)
          const rOut = 0.014;
          const rIn  = 0.0085;
          const bezelShape = new THREE.Shape();
          bezelShape.absarc(0, 0, rOut, 0, Math.PI * 2, false);
          const bezelHole = new THREE.Path();
          bezelHole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
          bezelShape.holes.push(bezelHole);

          const bezelGeom = new THREE.ExtrudeGeometry(bezelShape, {
            depth: 0.0022, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0006, bevelSegments: 3
          });
          const bezelMesh = new THREE.Mesh(bezelGeom, chromeMat);
          bezelMesh.position.set(0, 0, zHall + 0.0002);
          triKeyGrp.add(bezelMesh);

          // 외곽 미세 음영 림 (도어 판과의 외곽 테두리 경계 콘트라스트 강화)
          const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(rOut, 0.0007, 6, 32), darkPocketMat);
          rimTorus.position.set(0, 0, zHall + 0.0003);
          triKeyGrp.add(rimTorus);

          // 1-3. 깊이감 있는 내부 원형 블랙 리세스 포켓 (Ø17mm, 열쇠 삽입 홈)
          const pocket = createCylinder(rIn, rIn, 0.0020, darkPocketMat, 0, 0, zHall + 0.0010, triKeyGrp);
          pocket.rotation.x = Math.PI / 2;

          // 1-4. 3D 입체 정삼각 황동 키 코어 스핀들 (변 9mm, 높이 2.4mm 골드 프리즘)
          const triR = 0.0052; // 외접원 반경 (한 변 약 9.0mm)
          const triShape = new THREE.Shape();
          for (let i = 0; i < 3; i++) {
            const ang = Math.PI / 2 + i * (Math.PI * 2 / 3);
            const tx = Math.cos(ang) * triR;
            const ty = Math.sin(ang) * triR;
            if (i === 0) triShape.moveTo(tx, ty);
            else triShape.lineTo(tx, ty);
          }
          triShape.closePath();

          const triGeom = new THREE.ExtrudeGeometry(triShape, {
            depth: 0.0024, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0004, bevelSegments: 2
          });
          const triCore = new THREE.Mesh(triGeom, ilContactMat);
          triCore.position.set(0, 0, zHall + 0.0008);
          triKeyGrp.add(triCore);

          // (2) 도어 패널 관통 황동 바디 (두께 32mm 관통)
          const bodyLen = dt + 0.004;
          const body = createCylinder(0.008, 0.008, bodyLen, ilContactMat, 0, 0, zCtr, triKeyGrp);
          body.rotation.x = Math.PI / 2;

          // (3) 승강로 측 고무 와셔 & 체결 육각 너트 2개 (도면 177p)
          const nutZ = zHoist - 0.004;
          const rubberW = createCylinder(0.012, 0.012, 0.0025, rubberMat, 0, 0, zHoist - 0.0015, triKeyGrp);
          rubberW.rotation.x = Math.PI / 2;
          const hexNut1 = createCylinder(0.011, 0.011, 0.004, hpBoltMat, 0, 0, nutZ, triKeyGrp);
          hexNut1.rotation.x = Math.PI / 2;
          const hexNut2 = createCylinder(0.0105, 0.0105, 0.003, hpBoltMat, 0, 0, nutZ - 0.004, triKeyGrp);
          hexNut2.rotation.x = Math.PI / 2;

          // (4) 승강로 측 회전 캠 레버 (Cam Lever, pX+0.075 수직 링크 바와 연결)
          const camPivot = new THREE.Group();
          camPivot.name = 'CamPivot';
          camPivot.position.set(0, 0, zHoist - 0.008);
          camPivot.rotation.z = camRad;

          // 캠 레버 바 (황동/골드 크로메이트)
          createBox(camLen, 0.014, 0.004, ilGoldZincMat, camLen / 2, 0, 0, camPivot);
          const camHub = createCylinder(0.009, 0.009, 0.0045, ilGoldZincMat, 0, 0, 0, camPivot);
          camHub.rotation.x = Math.PI / 2;
          const camTip = createCylinder(0.007, 0.007, 0.0045, ilGoldZincMat, camLen, 0, 0, camPivot);
          camTip.rotation.x = Math.PI / 2;

          // 캠 끝단 드라이브 핀 (수직 링크 바의 장공 슬롯에 결합)
          const drivePin = createCylinder(0.0035, 0.0035, 0.010, hpBoltMat, camLen, 0, 0, camPivot);
          drivePin.rotation.x = Math.PI / 2;
          const pinCap = createCylinder(0.006, 0.006, 0.003, hpBoltMat, camLen, 0, -0.005, camPivot);
          pinCap.rotation.x = Math.PI / 2;

          triKeyGrp.add(camPivot);
          grp.add(triKeyGrp);
          grp.userData.triKey = { group: triKeyGrp, camPivot, drivePin, triX, triY, pinY, barX };
        }
      }

      for (let i = 0; i < FLOORS; i++) {
        const fy = FLOOR_Y[i];
        const left = new THREE.Group();
        const right = new THREE.Group();
        left.userData = { cx: -cx, ox: -ox, archived: true };
        right.userData = { cx: cx, ox: ox, archived: true };

        const g = headerByFloor[i].geom;
        left.position.set(-cx, fy, g.trackCtrZ);
        right.position.set(cx, fy, g.trackCtrZ);

        // 좌측 패널(화면 우측, 월드 -X, left 그룹, side = -1) 및 우측 패널(화면 좌측, 월드 +X, right 그룹, side = +1)
        buildHangerAssembly(left,  -1, cx, g);
        buildHangerAssembly(right, +1, cx, g);

        // 승장 도어 패널 장착 (도면 175p, 176p)
        buildHatchDoorPanel(left,  -1, cx, g);
        buildHatchDoorPanel(right, +1, cx, g);

        scene.add(left);
        scene.add(right);

        const h = {
          left,
          right,
          hook: null, // HallInterlock.attach supplies the stable GSAP pivot wrapper.
          latch: g.latch,                 // 래치 계약 (ui.js 가 해정 각도 liftRad 를 여기서 읽는다)
          triKey: right.userData.triKey ? right.userData.triKey.camPivot : null,
          relPulley: headerByFloor[i].relPulley,
          endPulley: headerByFloor[i].endPulley,
          link: headerByFloor[i].link
        };
        HallInterlock.attach(h, headerByFloor[i], g);
        hatchDoors.push(h);
        spinDoorDrive(h); // 닫힘 상태의 로프 마디·풀리각·클로저 스프링 길이 초기화
      }

    }

    /* ── 비상 삼각키 회전 및 승장 인터록 해정 연동 제어 함수 ──
       - fIdx: 대상 층 인덱스 (0: 1층, 1: 2층 ...)
       - ratio: 0.0 (완전 잠김) ~ 1.0 (비상 해정 완료)
       - 부품설계.pdf 177p~179p 규격 반영:
         1) 도어 배면 캠 레버 회전: 35° -> 85° (+50° 회전)
         2) 수직 평철 링크 바 연동 -> 대각선 암 틸트 -> 후크 래치 4~5mm 상승 및 접점 브리지 분리 */
    function setEmergencyKey(fIdx = 0, ratio = 0) {
      if (!hatchDoors || !hatchDoors[fIdx] || !hatchDoors[fIdx].right) return;
      const rGrp = hatchDoors[fIdx].right;
      const tri  = rGrp.userData.triKey;
      const hp   = rGrp.userData.hookPivot;
      if (!tri || !tri.camPivot || !hatchDoors[fIdx].interlock?.ready) return;

      const clampedRatio = Math.max(0, Math.min(1, ratio));
      // (1) 삼각키 캠 레버 회전: 35° ~ 85°
      const initAng = 35 * Math.PI / 180;
      const maxDelta = 50 * Math.PI / 180;
      tri.camPivot.rotation.z = initAng + clampedRatio * maxDelta;

      /* (2) GLB에 기록된 정확한 회전각으로 사각 턱을 해정한다. */
      if (hp) {
        const lr = hatchDoors[fIdx].latch.liftRad;
        hp.rotation.z = -clampedRatio * lr;
        HallInterlock.update(hatchDoors[fIdx]);
      }
    }
    window.setEmergencyKey = setEmergencyKey;


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
        setGovRopeLen(seg, len);
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
    /* 과속 트립 — 실사 4단계 정밀 물리 연동 시퀀스
       Step 1 (0.0s ~ 0.50s): 원심 진자(Flyweights) 서서히 개방 + 쐐기(Pawl)가 캠 톱날 홈에 '철컥!' 깊숙이 결착
       Step 2 (0.50s ~ 1.00s): 쐐기가 물린 채 휠 관성 회전(드래그) → 일체형 캐치 레버를 앞으로 힘차게 밀어올림
       Step 3 (0.90s ~ 1.25s): 캐치 레버 좌단이 스위치를 강하게 타격 → 스위치 레버가 아래로 '툭!' 떨어지며 래칭(OFF)
       Step 4 (1.00s ~ 1.35s): 캐치슈(떡판)가 조속기 로프를 시브 홈에 강하게 압착하여 휠 및 로프 완전 정지 → 카 ESTOP */
    function governorTrip(spinDir, onLocked) {
      const gov = govHandles(); if (!gov || governorPhase !== 'rest') return null;
      governorPhase = 'tripping';
      govSpinDir = spinDir;
      const pose = gov.pose.trip, wheel = gov.wheel, g = gov.geom;
      const arm = gov.topArm || gov.catcherArm;
      const W = wheel.rotation.z;
      // 쐐기와 톱날은 둘 다 휠 자식이라 정지 각을 360°로 스냅해도 상대 물림은 안 바뀐다.
      const Wstop = W + spinDir * Math.PI * 2 * 1.25;

      const drag = spinDir * Math.abs(pose.ratchet || 0.22);
      const armTrip = g.armRot0 + (pose.topArm || 0.14);
      const sprTrip = pose.spring || 0.95;
      const rat0 = gov.ratchet.rotation.z;

      const tl = gsap.timeline();

      // ── Step 1 (t = 0.0s ~ 0.50s): 원심 진자 개방 & 쐐기(Pawl) 톱날 홈 깊숙이 박힘 ──
      const tOpen = 0.50;
      tl.to(gov.pendulums[0].rotation, { z: g.pendRot0[0] + pose.pendulum, duration: tOpen, ease: 'power2.out' }, 0);
      tl.to(gov.pendulums[1].rotation, { z: g.pendRot0[1] + pose.pendulum, duration: tOpen, ease: 'power2.out' }, 0);
      if (gov.setLinkage) {
        const lk = { v: gov.pendulums[0].rotation.z - g.pendRot0[0] };
        tl.to(lk, { v: pose.pendulum, duration: tOpen, ease: 'power2.out',
                    onUpdate: () => gov.setLinkage(lk.v) }, 0);
      }
      tl.to(wheel.rotation, { z: Wstop, duration: tOpen + 0.10, ease: 'power1.out' }, 0);

      // 쐐기: +z 로 부리가 골 안으로. 음수는 톱니 등면 위로 들어 올림.
      if (gov.pawl && gov.pawl.rotation) {
        const pawlBite = (g.pawlRot0 || 0) + (pose.pawl != null ? pose.pawl : 0.60);
        tl.to(gov.pawl.rotation, { z: pawlBite, duration: 0.28, ease: 'power4.in' }, 0.20);
      }

      // ── Step 2 (t = 0.50s ~ 1.00s): 쐐기 물림 상태로 휠 관성 드래그 & 캐치 레버 전방 밀림 ──
      const tDrag = tOpen;
      tl.to(gov.ratchet.rotation, { z: rat0 + drag, duration: 0.50, ease: 'power2.out' }, tDrag);
      tl.to(wheel.rotation, { z: Wstop + drag, duration: 0.50, ease: 'power2.out' }, tDrag);
      tl.to(arm.rotation, { z: armTrip, duration: 0.45, ease: 'power2.inOut' }, tDrag + 0.05);
      if (gov.spring) tl.to(gov.spring.scale, { y: sprTrip, duration: 0.45, ease: 'power2.inOut' }, tDrag + 0.05);

      // ── Step 3 (t = 0.90s ~ 1.25s): 캐치 레버 좌단이 스위치를 강하게 타격 → 스위치 레버가 아래로 '툭!' 떨어져 래칭 ──
      const tHit = tDrag + 0.38;
      if (gov.switchLever) {
        // 스위치 작동대/플런저가 순간적으로 강하게 젖혀지며 반동과 함께 아래로 뚝 떨어짐
        tl.to(gov.switchLever.rotation, { z: pose.switchRot || -0.52, duration: 0.14, ease: 'back.out(3.8)' }, tHit);
        tl.to(gov.switchLever.position, { x: pose.switchLever || 0.016, duration: 0.14, ease: 'power3.out' }, tHit);
      }

      // ── Step 4 (t = 1.15s): 로프 완전 파지 및 카 비상정지 — 쐐기·캐치레버·스위치는 트립 상태로 100% 영구 고정 ──
      const tLock = tDrag + 0.50;
      tl.add(() => {
        governorPhase = 'tripped';
        if (onLocked) onLocked();
      }, tLock);

      return tl;
    }

    /* 복귀: 암·스프링 대기각 → 라체트·휠 역회전 → 진자 복귀 → 스위치 레버 위로 '딸깍!' 복귀 */
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
      // 스위치 레버 원상 복귀 (위로 '딸깍!')
      if (gov.switchLever) {
        tl.to(gov.switchLever.rotation, { z: 0, duration: 0.35, ease: 'back.out(1.8)' }, 0.05);
        tl.to(gov.switchLever.position, { x: plunger0, duration: 0.35, ease: 'power2.inOut' }, 0.05);
      }
      tl.to(arm.rotation, { z: gov.geom.armRot0, duration: 0.55, ease: 'power2.inOut' }, 0);
      if (gov.spring) tl.to(gov.spring.scale, { y: gov.geom.sprScale0 || 1, duration: 0.55, ease: 'power2.inOut' }, 0);
      if (gov.pawl && gov.pawl.rotation) tl.to(gov.pawl.rotation, { z: gov.geom.pawlRot0 || 0, duration: 0.50, ease: 'power2.inOut' }, 0.15);
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
