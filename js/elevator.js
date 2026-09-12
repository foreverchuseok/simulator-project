// 엘리베이터 카, 도어 스텁, 균형추, 로프 등 동적 객체 생성 함수를 정의한다.
    /* 안전기 작동 샤프트의 트립 각 (rotation.x). 이 값이 트립 진행률의 분모다.
       ui.js engageDeviceStop 과 refreshCarSafetyLinkage 가 같이 읽는 단일 원본이므로
       한쪽만 바꾸면 상부 크로스헤드 연동부가 웨지와 어긋난다. */
    const SG_TRIP_ROT = -0.38;

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

        /* 상부 크로스헤드 체결 거싯 플레이트 & M16 볼트 (도면 92p)
           ★Z 깊이 0.12 — 크로스헤드 전면 웹(Z 0.083~0.097)과 후면 웹을 물리는 체결판이라
             이만큼이면 충분하다. 예전 0.19 는 앞면이 Z 0.135 까지 튀어나와,
             §4-B 크로스헤드 연동부가 이걸 피하려고 빔에서 55mm 나 떠야 했다
             (사용자 지적 "우리 건 이게 떨어져있지"). 여기를 줄여야 연동부가 빔에 붙는다. */
        createBox(0.016, 0.22, 0.12, frmDkMat, sx - sign * 0.008, chY, railBladeZ, carFrameGrp);
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

        // 천장 임시 앵글은 판넬 조립 완료 후 철거(부품설계 210p).
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
         assets/safety_gear.glb — 현대 SAFETY (CAR) 스타일 (tools/build_safety_glb.mjs).
         민트그레이 하우징·골드 트립 레버·복귀 스프링 로드·Honeywell 안전 스위치를 포함하며
         하부 가이드슈는 models/gltf/car_guide_shoe.glb 가 담당한다 (GLB 안에 슈 없음).
         ========================================================================= */
      const safetyGearGrp = new THREE.Group();
      safetyGearGrp.name = 'carSafetyGear';
      carGrp.add(safetyGearGrp);

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
          wedges:  ['wedgeL0', 'wedgeL1', 'wedgeR0', 'wedgeR1'].map(pick).filter(Boolean)
          /* clamp 노드는 없다(2026-09-12). 조속기 로프는 실물처럼 카 상부 크로스헤드
             트립 레버의 후방 크랭크가 문다 — §4-B `safetyGovCrank`, carGrp.userData.govClamp. */
        };
        carGrp.userData.safetyGear.wedges.forEach(w => { w.userData.z0 = w.position.z; });
        if (typeof refreshGovernorRope === 'function') refreshGovernorRope();
      }, undefined, (err) => console.error('[safety_gear.glb] 로드 실패:', err));

      /* 조속기 로프 가이드 브라켓 (도면 96p-1) — 로프 수직선 위 톱빔 상단.
         예전에는 하부 플랭크에 풀 바·심블·와이어 클립을 두어 로프가 카 하부에서
         끝나는 것처럼 보였는데, 실제 연결점은 크로스헤드 트립 레버다(§4-B).
         모순되는 하부 철물은 걷어내고 로프가 지나가는 가이드만 남긴다. */
      createBox(0.05, 0.04, 0.10, frmMat, GOV_TENS_X - 0.04, chY + chH / 2 + 0.020, GOV_CLAMP_Z - CAR_CTR_Z, carFrameGrp);
      createCylinder(0.013, 0.013, 0.05, silvMat, GOV_TENS_X, chY + chH / 2 + 0.025, GOV_CLAMP_Z - CAR_CTR_Z, carFrameGrp);

      /* =========================================================================
         4-B. 카 상부 크로스헤드 비상정지 연동부
              (장죽 · 흑색 복귀 스프링 · 골드 캠 플레이트 · Honeywell 리미트 스위치
               · 조속기 로프 직결 토크 튜브 + 후방 크랭크)
         참고: docs/safety_switch_device/frames.md, temporary/safety_switch_frames/,
               사용자 육성 지시(2026-09-12). 제작도면 복제가 아닌 교육용 재구성이다.

         ★좌우 반전 계약 — 영상 현장은 좌측(-X) 거버너지만 우리 승강로는 조속기·피트
           인장추가 우측(GOV_TENS_X = +1.4275)이다. 조작 뭉치(스프링·너트·클레비스·캠·
           스위치)는 전부 우측(+X). 스위치 글랜드는 카 중심(-X), 롤러 레버는 외측(+X).

         ★기구학 — 아래 상수에서 전부 파생한다. 각도·행정을 딴 데 또 적지 않는다.
           · 양쪽 트립 레버는 거울상이 아니라 같은 부호로 rotation.z 를 돈다.
             장죽 하나가 두 레버를 같은 각도로 끌어올려야 하기 때문이다(frames.md 06).
           · 클레비스 핀은 회전축 "위"(로컬 0,+R). 레버가 + 로 돌면 핀이 -X 로 가므로
             장죽은 카 중심 쪽으로 끌려오고, 그래야 브라켓↔너트 사이 스프링이 압축된다.
           · 대기 -SL_HALF ↔ 트립 +SL_HALF 대칭이라 핀 Y 가 양 끝에서 같다
             → 장죽은 순수 X 이동(2·R·sin11° ≈ 22mm)만 하고 위아래로 튀지 않는다.
             같은 트릭을 후방 크랭크에도 써서 로프 클램프의 X 를 양 끝에서 일치시킨다.

         ★Z 레이어 (사용자 지적 "우리 건 이게 떨어져있지" 교정)
             빔 전면 웹 앞면        0.097
             스타일 전면 플랜지 앞면 0.120
             상부 거싯 앞면          0.100  ← 깊이를 0.19→0.12 로 줄여 확보한 여유
             가동부 평면 SL_ROD_Z   0.135  ← 웹면에서 38mm. 예전 0.152(55mm)는 난간처럼 떴다.

         ★조속기 로프 직결 — Z 축 토크 튜브 + 후방 크랭크
           레버(Z≈+0.13)와 로프 평면(Z=-0.37)은 0.5m 떨어져 있다. 빔 끝을 도는 절곡
           링크는 레일 Z 밴드를 가로질러 불가하고, 후면에 X축 로커를 두는 방식은
           전면 레버가 Z축 회전이라 Z 방향 변위를 2차항(<1mm)밖에 못 만들어 불가하다.
           그래서 회전축을 그대로 튜브로 연장해 전·후 웹을 관통시키고 후단에 크랭크를
           물린다. Z축 회전은 점의 Z 를 보존하므로 클램프가 로프 평면에 정확히 머문다.
           ※ engageDeviceStop 에서 카는 250mm 낙하하는데 클램프는 카 상대 83mm 만
             올라간다. 엄밀히는 로프가 잡혔으니 월드 Y 가 고정이어야 하지만 그러려면
             크랭크 반경이 0.65m 여야 해서 불가능하다. "로프가 클램프를 미끄러진다"로
             본 근사이며, 예전(하부 샤프트 클램프)보다는 오차가 줄었다.
         ========================================================================= */
      const slGrp = new THREE.Group();
      slGrp.name = 'carSafetyLinkage';
      carFrameGrp.add(slGrp);

      // ── 재질 (기존 M.* 팔레트) ──
      const swBlueMat = M.paint(0x17457a);  // Honeywell SZL-VL-S 청색 수지 하우징
      const swLabMat  = M.paint(0xeef1f4);  // 전면 규격/회로도 백색 라벨
      const glandMat  = M.paint(0xdcdcd6);  // 회색 방수 케이블 글랜드
      const cableMat  = M.paint(0x14171a);  // 안전회로 제어선
      /* 흑색 압축 스프링 — M.paint 는 clearcoat 0.8 이라 밝은 장면에서 회청색으로 뜬다.
         현장 부품은 흑색이므로 광택이 낮은 M.ss 의 어두운 색으로 잡는다. */
      const blkSprMat = M.ss(0x1c2024);

      /* ── 경계 원본 (새 하드코딩 금지 — 전부 기존 프레임 상수에서 파생) ── */
      const SL_WEB_Z   = chFwdZ + 0.027;                 // 0.097 전면 C채널 웹 앞면
      const SL_WEB_TOP = chY + chH / 2;                  // 1.6075 빔 상단 = 황색 가드 밑면
      const SL_WEB_BOT = chY - chH / 2;                  // 1.4675 빔 하단

      // ── 치수 원본 ──
      const SL_PLATE_T = 0.007;                          // 캠/레버 강판 두께 7mm
      const SL_ROD_R   = 0.007;                          // 장죽 Ø14 환봉
      /* 장죽 축 Y — 빔 상단 모서리에서 20mm 아래. 더 올리면 스프링 외경(Ø32) 윗면이
         황색 베이스 가드 밑면(SL_WEB_TOP)을 파고든다. */
      const SL_ROD_Y   = SL_WEB_TOP - 0.020;             // 1.5875
      /* 클레비스가 스타일 전면 플랜지(앞면 0.120) 위를 지나므로, 포크 바깥면이 그보다
         앞서야 한다. 포크 반폭 0.012 → 평면 0.135 에서 바깥면 0.123 (3mm 여유). */
      const SL_ROD_Z   = chFwdZ + 0.065;                 // 0.135 (웹면에서 38mm)
      const SL_PIN_R   = 0.058;                          // 회전축 → 클레비스 핀 (핀이 축 위)
      const SL_HALF    = 11 * Math.PI / 180;             // 대기 -11° ↔ 트립 +11° (총 22°)
      const SL_TRAVEL  = 2 * SL_PIN_R * Math.sin(SL_HALF);            // 0.0221 장죽 행정
      const SL_PIV_Y   = SL_ROD_Y - SL_PIN_R * Math.cos(SL_HALF);     // 1.5306 레버 회전축 Y
      const SL_PIV_XR  = 1.214;                          // 우측(조작 뭉치) 회전축 X
      const SL_PIV_XL  = -stileX;                        // 좌측(반대편) 회전축 X
      const SL_LNK_DX  = 0.055, SL_LNK_DY = 0.055;       // 회전축 → 수직 타이로드 핀 (로컬 +X, 아래)
      const SL_TIE_R   = 0.008;                          // 수직 연동 타이로드 Ø16
      const SL_TIE_BOT = plankY + 0.200;                 // 타이로드 하단 (안전기 캡 볼트 머리 위)

      // 레버 각도 / 로컬점 회전 (p = 0 대기, 1 트립)
      const slRot = p => -SL_HALF + 2 * SL_HALF * p;
      const slSpin = (lx, ly, a) => [lx * Math.cos(a) - ly * Math.sin(a), lx * Math.sin(a) + ly * Math.cos(a)];

      // 클레비스 핀(로컬 0,+R)과 타이로드 핀(로컬 +DX,-DY)의 대기/트립 위치
      const SL_PINC0 = slSpin(0, SL_PIN_R, slRot(0));
      const SL_PINL0 = slSpin(SL_LNK_DX, -SL_LNK_DY, slRot(0));
      const SL_PINL1 = slSpin(SL_LNK_DX, -SL_LNK_DY, slRot(1));
      const SL_PIN_XR0 = SL_PIV_XR + SL_PINC0[0];        // 우측 클레비스 핀 대기 X
      const SL_PIN_XL0 = SL_PIV_XL + SL_PINC0[0];        // 좌측 클레비스 핀 대기 X
      const SL_LNK_Y0  = SL_PIV_Y + SL_PINL0[1];         // 타이로드 핀 대기 Y
      const SL_LNK_DUP = SL_PINL1[1] - SL_PINL0[1];      // 트립 시 타이로드 상승량 (≈21mm)
      const SL_LNK_DOU = SL_PINL1[0] - SL_PINL0[0];      // 트립 시 타이로드 핀 X 이동

      /* ── 조속기 로프 직결부 (후방 크랭크) ──
         크랭크 반경을 cos(SL_HALF) 로 나눠 두면 대기·트립 양 끝에서 클램프 X 가
         정확히 로프 수직선(GOV_TENS_X)에 일치한다 → 양 끝에서 로프 횡꺾임 0. */
      const SL_ROPE_Z = GOV_CLAMP_Z - CAR_CTR_Z;                       // -0.37 (카 로컬)
      const SL_CRK_R  = (GOV_TENS_X - SL_PIV_XR) / Math.cos(SL_HALF);  // 0.2175
      const SL_CRK_UP = 2 * SL_CRK_R * Math.sin(SL_HALF);              // 0.0830 클램프 상승량
      const SL_TUBE_R = 0.011;                                         // Ø22 토크 튜브

      /* ── 장죽 축선 부품 배치 (우측 끝단에서 카 중심 쪽으로) ──
         클레비스 → 잼 너트 → 조절 더블 너트 → 시트 와셔 → 흑색 스프링 → 관통 브라켓 */
      const SL_CLV_L  = 0.032;                           // U 클레비스 몸통 (핀 ~ 나사 결합면)
      const SL_JAM_X  = SL_PIN_XR0 - SL_CLV_L - 0.006;   // 클레비스 잼 너트
      const SL_NUT1_X = SL_JAM_X - 0.020;                // 장력 조절 너트 1
      const SL_NUT2_X = SL_NUT1_X - 0.012;               // 장력 조절 너트 2 (풀림 방지)
      const SL_WSH_X  = SL_NUT2_X - 0.008;               // 스프링 시트 와셔
      const SL_SPR_R  = 0.016;                           // 스프링 외경 32mm
      const SL_SPR_W  = 0.0025;                          // 선경 5mm
      const SL_SPR_L0 = 0.062;                           // 자유장 62mm (실물처럼 짧고 굵게)
      const SL_SPR_X0 = SL_WSH_X - 0.002 - SL_SPR_L0;    // 스프링 고정단 = 브라켓 바깥면
      const SL_BRK_X  = SL_SPR_X0 - 0.005;               // 관통 브라켓 판 중심 (두께 10mm)
      /* 수나사 구간은 스프링 고정단에서 행정만큼 안쪽에서 시작한다. 브라켓보다 왼쪽에서
         시작하면 트립 때 나사산이 브라켓 밖으로 빠져나와 또 하나의 코일처럼 보인다. */
      const SL_THR_X0 = SL_SPR_X0 + SL_TRAVEL;           // 수나사 가공 구간 시작
      const SL_THR_X1 = SL_PIN_XR0 - SL_CLV_L + 0.004;   // 수나사 구간 끝 (클레비스 결합)

      /* ── Honeywell SZL-VL-S 리미트 스위치 ──
         ★사용자 지적 "현실을 보면 스위치가 최대 아래 요런 식으로 붙어있고" →
           빔 웹면에 납작하게(두께 18mm + 심 4mm), 위치는 웹 하단 바로 위. */
      const SL_SW_W  = 0.068, SL_SW_H = 0.030, SL_SW_D = 0.018;
      const SL_SW_CY = SL_WEB_BOT + 0.008 + SL_SW_H / 2; // 1.4905 몸체 밑면이 빔 하단 +8mm
      const SL_SW_CZ = SL_WEB_Z + 0.004 + SL_SW_D / 2;   // 0.110 웹면 + 취부 심
      const SL_SW_PY = SL_SW_CY + SL_SW_H / 2 + 0.001;   // 1.5065 롤러 레버 축 = 몸체 상단
      const SL_ARM_L = 0.040, SL_ROLLER_R = 0.009;
      const SL_ARM_A0 = -13 * Math.PI / 180;             // 대기 롤러 레버 각 (로브에 눌려 내려감)
      const SL_ARM_SW = 15 * Math.PI / 180;              // 트립 시 로브에서 떨어지며 튀어 오름

      /* 롤러 축 X 는 "원하는 대기 캠 반경"에서 역산한다.
         스위치가 회전축보다 아래에 있으므로 롤러는 캠을 아래에서 받친다 →
         대기(로브 위)가 큰 반경, 트립(기초원)이 작은 반경이다. frames.md 03 의
         "캠이 회전하면 롤러가 튀어 올라가며 NC 접점이 열린다"와 같은 동작이다. */
      const SL_CAM_AIM = 0.050;                          // 대기 시 캠 로브 반경
      const SL_SW_PX = (() => {
        const dy = SL_SW_PY + SL_ARM_L * Math.sin(SL_ARM_A0) - SL_PIV_Y;
        const d  = SL_CAM_AIM + SL_ROLLER_R;
        return SL_PIV_XR - Math.sqrt(d * d - dy * dy) - SL_ARM_L * Math.cos(SL_ARM_A0);
      })();
      const SL_SW_CX = SL_SW_PX - SL_SW_W / 2 - 0.006;   // 몸체 중심 X (축이 외측 끝)

      // 롤러 중심(월드 XY) → 우측 레버 로컬 극좌표. 캠 엣지 반경을 여기서 역산한다.
      const slRoller = a => [SL_SW_PX + SL_ARM_L * Math.cos(a), SL_SW_PY + SL_ARM_L * Math.sin(a)];
      function slCamContact(armA, leverA) {
        const r = slRoller(armA);
        const l = slSpin(r[0] - SL_PIV_XR, r[1] - SL_PIV_Y, -leverA);
        return [Math.hypot(l[0], l[1]) - SL_ROLLER_R, Math.atan2(l[1], l[0])];
      }
      const SL_CAM_LO = slCamContact(SL_ARM_A0, slRot(0));             // 대기 — 높은 로브
      const SL_CAM_HI = slCamContact(SL_ARM_A0 + SL_ARM_SW, slRot(1)); // 트립 — 기초원
      const SL_CAM_RH = SL_CAM_LO[0], SL_CAM_AH = SL_CAM_LO[1];        // 로브 반경·각
      const SL_CAM_RB = SL_CAM_HI[0], SL_CAM_AB = SL_CAM_HI[1];        // 기초원 반경·각

      // 원점에서 +X 로 뻗는 압축 코일 (실제 자유장으로 만들고 scale.x 로만 압축한다)
      function makeCoilX(turns, coilR, wireR, len, segPerTurn = 12) {
        const pts = [], n = turns * segPerTurn;
        for (let i = 0; i <= n; i++) {
          const t = i / n, a = t * turns * Math.PI * 2;
          pts.push(new THREE.Vector3(t * len, Math.cos(a) * coilR, Math.sin(a) * coilR));
        }
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wireR, 8, false);
      }
      function hexNut(r, h, mat, x, y, z, parent) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), mat);
        m.position.set(x, y, z); m.rotation.z = Math.PI / 2;
        m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
      }

      /* ── (1) 트립 레버 / 캠 플레이트 (좌·우 동일 형상, 같은 부호로 회전) ── */
      function buildTripLever(px, withCam) {
        const g = new THREE.Group();
        g.name = withCam ? 'safetyCamLeverR' : 'safetyTripLeverL';
        g.position.set(px, SL_PIV_Y, SL_ROD_Z);
        g.rotation.z = slRot(0);
        slGrp.add(g);

        // 기초원 판 (트립 시 롤러가 내려앉는 원호)
        createCylinder(SL_CAM_RB, SL_CAM_RB, SL_PLATE_T, goldMat, 0, 0, 0, g).rotation.x = Math.PI / 2;
        // 클레비스 암 (회전축 위) + 라운드 노즈 + 핀
        createBox(0.024, SL_PIN_R, SL_PLATE_T, goldMat, 0, SL_PIN_R / 2, 0, g);
        createCylinder(0.014, 0.014, SL_PLATE_T, goldMat, 0, SL_PIN_R, 0, g).rotation.x = Math.PI / 2;
        createCylinder(0.005, 0.005, 0.026, boltMat, 0, SL_PIN_R, 0, g).rotation.x = Math.PI / 2;
        // 타이로드 암 (회전축 로컬 +X 아래) + 노즈 + 핀
        const armLen = Math.hypot(SL_LNK_DX, SL_LNK_DY);
        const arm = createBox(0.024, armLen, SL_PLATE_T, goldMat, SL_LNK_DX / 2, -SL_LNK_DY / 2, 0, g);
        arm.rotation.z = Math.atan2(-SL_LNK_DX, -SL_LNK_DY);
        createCylinder(0.014, 0.014, SL_PLATE_T, goldMat, SL_LNK_DX, -SL_LNK_DY, 0, g).rotation.x = Math.PI / 2;
        createCylinder(0.005, 0.005, 0.026, boltMat, SL_LNK_DX, -SL_LNK_DY, 0, g).rotation.x = Math.PI / 2;

        if (withCam) {
          /* 캠 로브 — 대기 각(SL_CAM_AH)에서 롤러를 눌러 두고, 트립 각(SL_CAM_AB)으로
             돌아가면 기초원이 와서 롤러가 튀어 오른다. 두 접점 반경은 위에서 역산했다. */
          const shape = new THREE.Shape();
          const aS = SL_CAM_AB, aRamp = SL_CAM_AH - 0.05, aE = SL_CAM_AH + 0.40;
          shape.moveTo(0, 0);
          for (let i = 0; i <= 24; i++) {
            const a = aS + (aE - aS) * i / 24;
            const t = a <= aRamp ? (a - aS) / (aRamp - aS) : 1;
            const r = SL_CAM_RB + (SL_CAM_RH - SL_CAM_RB) * (t * t * (3 - 2 * t));
            shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          shape.lineTo(0, 0);
          const lobe = new THREE.Mesh(
            new THREE.ExtrudeGeometry(shape, { depth: SL_PLATE_T, bevelEnabled: false }), goldMat);
          lobe.position.z = -SL_PLATE_T / 2;
          lobe.castShadow = true; lobe.receiveShadow = true;
          g.add(lobe);
        }

        // 중심 대형 육각 보스 + 풀림 방지 분할 핀 (frames.md 05)
        hexNut(0.020, 0.026, goldMat, 0, 0, SL_PLATE_T / 2 + 0.013, g);
        createCylinder(0.0022, 0.0022, 0.040, boltMat, 0, 0.010, SL_PLATE_T / 2 + 0.013, g).rotation.x = Math.PI / 2;
        createCylinder(0.0022, 0.0022, 0.012, boltMat, 0, 0.016, SL_PLATE_T / 2 + 0.032, g).rotation.z = Math.PI / 2;
        return g;
      }
      const slLeverR = buildTripLever(SL_PIV_XR, true);
      const slLeverL = buildTripLever(SL_PIV_XL, false);

      /* 레버 회전축 필로블록 (빔 웹 앞면에 직결, 정지부).
         거싯을 0.12 로 줄인 덕분에 스타일 플랜지가 아니라 웹면에서 바로 세울 수 있다. */
      [SL_PIV_XR, SL_PIV_XL].forEach(px => {
        createBox(0.054, 0.076, SL_ROD_Z - SL_PLATE_T / 2 - SL_WEB_Z, frmDkMat,
          px, SL_PIV_Y, (SL_WEB_Z + SL_ROD_Z - SL_PLATE_T / 2) / 2, slGrp);
        [-0.028, 0.028].forEach(dy => {
          createCylinder(0.006, 0.006, 0.020, boltMat, px, SL_PIV_Y + dy, SL_WEB_Z + 0.008, slGrp)
            .rotation.x = Math.PI / 2;
        });
      });

      /* ── (2) 조속기 로프 직결 토크 튜브 + 후방 크랭크 (가동) ── */
      const slCrank = new THREE.Group();
      slCrank.name = 'safetyGovCrank';
      slCrank.position.set(SL_PIV_XR, SL_PIV_Y, SL_ROPE_Z);
      slCrank.rotation.z = slRot(0);
      slGrp.add(slCrank);
      {
        // 크랭크 암 + 끝단 보스
        createBox(SL_CRK_R, 0.030, 0.010, silvMat, SL_CRK_R / 2, 0, 0, slCrank);
        createCylinder(0.020, 0.020, 0.014, silvMat, SL_CRK_R, 0, 0, slCrank).rotation.x = Math.PI / 2;
        createCylinder(0.022, 0.022, 0.018, goldMat, 0, 0, 0, slCrank).rotation.x = Math.PI / 2;
        // 로프 히치 요크 — 크랭크 끝에서 아래로 매달린 클램프 (심블 + 3구 와이어 클립)
        createBox(0.026, 0.034, 0.030, M.ss(0xccd2d9), SL_CRK_R, -0.026, 0, slCrank);
        [-0.048, -0.066, -0.084].forEach(dy => {
          createBox(0.020, 0.010, 0.024, boltMat, SL_CRK_R, dy, 0, slCrank);
          createCylinder(0.0028, 0.0028, 0.028, boltMat, SL_CRK_R, dy, 0, slCrank).rotation.x = Math.PI / 2;
        });
      }
      // 토크 튜브 — 전면 레버 판 뒤에서 후면 웹을 지나 크랭크까지 (정지부처럼 보이되 회전)
      const slTube = new THREE.Group();
      slTube.name = 'safetyTorqueTube';
      slTube.position.set(SL_PIV_XR, SL_PIV_Y, 0);
      slGrp.add(slTube);
      {
        const z0 = SL_ROPE_Z, z1 = SL_ROD_Z - SL_PLATE_T / 2;
        createCylinder(SL_TUBE_R, SL_TUBE_R, z1 - z0, silvMat, 0, 0, (z0 + z1) / 2, slTube)
          .rotation.x = Math.PI / 2;
      }
      // 토크 튜브 지지 필로블록 2개소 (후면 웹 뒷면, 아웃리거 행거)
      [chAftZ - 0.027 - 0.020, SL_ROPE_Z + 0.045].forEach(bz => {
        createBox(0.052, 0.058, 0.014, frmDkMat, SL_PIV_XR, SL_PIV_Y, bz, slGrp);
        createCylinder(SL_TUBE_R + 0.006, SL_TUBE_R + 0.006, 0.016, silvMat, SL_PIV_XR, SL_PIV_Y, bz, slGrp)
          .rotation.x = Math.PI / 2;
      });
      // 후면 웹에서 아웃리거 행거를 매다는 브레이스
      createBox(0.016, 0.040, Math.abs(SL_ROPE_Z + 0.045 - (chAftZ - 0.027)), frmMat,
        SL_PIV_XR, SL_PIV_Y + 0.045, (SL_ROPE_Z + 0.045 + chAftZ - 0.027) / 2, slGrp);

      /* ── (3) 장죽 (Actuating Cross-Rod) — 축방향으로만 움직이는 가동 그룹 ── */
      const slRod = new THREE.Group();
      slRod.name = 'safetyCrossRod';
      slGrp.add(slRod);
      {
        const plainX0 = SL_PIN_XL0 + SL_CLV_L, plainX1 = SL_THR_X0;
        // 은색 환봉 본선 — 중앙 턴버클을 사이에 두고 좌·우 2본
        const tbHalf = 0.030;
        createCylinder(SL_ROD_R, SL_ROD_R, -tbHalf - plainX0, silvMat,
          (plainX0 - tbHalf) / 2, SL_ROD_Y, SL_ROD_Z, slRod).rotation.z = Math.PI / 2;
        createCylinder(SL_ROD_R, SL_ROD_R, plainX1 - tbHalf, silvMat,
          (tbHalf + plainX1) / 2, SL_ROD_Y, SL_ROD_Z, slRod).rotation.z = Math.PI / 2;
        // 중앙 턴버클(길이 조절 커플러) + 양측 잼 너트
        createCylinder(0.013, 0.013, 2 * tbHalf - 0.016, silvMat, 0, SL_ROD_Y, SL_ROD_Z, slRod)
          .rotation.z = Math.PI / 2;
        createBox(0.030, 0.008, 0.026, silvMat, 0, SL_ROD_Y, SL_ROD_Z, slRod);
        [-tbHalf + 0.006, tbHalf - 0.006].forEach(nx => hexNut(0.011, 0.008, goldMat, nx, SL_ROD_Y, SL_ROD_Z, slRod));
        // 수나사 가공 구간 (M14 — 나사산은 링으로 표현)
        createCylinder(SL_ROD_R + 0.0006, SL_ROD_R + 0.0006, SL_THR_X1 - SL_THR_X0, boltMat,
          (SL_THR_X0 + SL_THR_X1) / 2, SL_ROD_Y, SL_ROD_Z, slRod).rotation.z = Math.PI / 2;
        for (let x = SL_THR_X0 + 0.003; x < SL_THR_X1; x += 0.0035) {
          createCylinder(SL_ROD_R + 0.0011, SL_ROD_R + 0.0011, 0.0013, boltMat,
            x, SL_ROD_Y, SL_ROD_Z, slRod).rotation.z = Math.PI / 2;
        }
        // 시트 와셔 + 장력 조절 더블 너트 + 클레비스 잼 너트
        createCylinder(0.018, 0.018, 0.004, goldMat, SL_WSH_X, SL_ROD_Y, SL_ROD_Z, slRod)
          .rotation.z = Math.PI / 2;
        [SL_NUT2_X, SL_NUT1_X, SL_JAM_X].forEach(nx => hexNut(0.013, 0.010, goldMat, nx, SL_ROD_Y, SL_ROD_Z, slRod));

        // U 자 클레비스 (요크) — 좌·우 양단. 두 볼이 레버 판을 물고 핀이 관통한다.
        [[SL_PIN_XR0, -1], [SL_PIN_XL0, 1]].forEach(end => {
          const pinX = end[0], dir = end[1];
          const bodyX = pinX + dir * SL_CLV_L / 2;
          createBox(SL_CLV_L * 0.42, 0.026, 0.030, silvMat, pinX + dir * SL_CLV_L * 0.79, SL_ROD_Y, SL_ROD_Z, slRod);
          [-1, 1].forEach(zs => {
            createBox(SL_CLV_L * 0.80, 0.026, 0.008, silvMat, bodyX, SL_ROD_Y, SL_ROD_Z + zs * 0.008, slRod);
          });
          [-0.008, 0.008].forEach(dz => {
            createCylinder(0.013, 0.013, 0.008, silvMat, pinX, SL_ROD_Y, SL_ROD_Z + dz, slRod).rotation.x = Math.PI / 2;
          });
        });
      }

      /* ── (4) 흑색 압축 복귀 스프링 — 고정단은 관통 브라켓 바깥면, scale.x 로만 압축 ── */
      const slSpring = new THREE.Mesh(makeCoilX(7, SL_SPR_R - SL_SPR_W, SL_SPR_W, SL_SPR_L0), blkSprMat);
      slSpring.name = 'safetyReturnSpring';
      slSpring.position.set(SL_SPR_X0, SL_ROD_Y, SL_ROD_Z);
      slSpring.castShadow = true; slSpring.receiveShadow = true;
      slGrp.add(slSpring);

      /* ── (5) 관통 ㄷ자 브라켓 + 중간 가이드 브라켓 6개소 ──
         ★사용자 지적 "일자야" 교정 — 빔에 바짝 붙인 진짜 ㄷ자 브라켓을 촘촘히 박아
           장죽이 빔에 눌려 붙은 인상을 준다. 발이 웹면(SL_WEB_Z)에서 바로 올라온다. */
      function slRodBracket(bx, plateH, webW) {
        const footY = SL_ROD_Y - plateH + 0.024;
        createBox(0.010, plateH, 0.050, frmMat, bx, SL_ROD_Y - plateH / 2 + 0.020, SL_ROD_Z, slGrp); // 관통 판
        createBox(webW, 0.011, SL_ROD_Z - SL_WEB_Z, frmMat, bx, footY, (SL_WEB_Z + SL_ROD_Z) / 2, slGrp); // 빔 쪽 발
        createBox(webW + 0.012, 0.026, 0.008, frmMat, bx, footY + 0.008, SL_WEB_Z + 0.004, slGrp);        // 웹 밀착 플랜지
        [-0.009, 0.009].forEach(dy => {
          createCylinder(0.004, 0.004, 0.016, boltMat, bx, footY + 0.008 + dy, SL_WEB_Z + 0.006, slGrp)
            .rotation.x = Math.PI / 2;
        });
      }
      slRodBracket(SL_BRK_X, 0.086, 0.036);
      [-0.95, -0.62, -0.30, 0.30, 0.62, 0.95].forEach(gx => slRodBracket(gx, 0.064, 0.028));

      /* ── (6) Honeywell 리미트 스위치 — 웹면 하단에 납작하게 ── */
      const slSwGrp = new THREE.Group();
      slSwGrp.name = 'safetyLimitSwitch';
      slGrp.add(slSwGrp);
      {
        // 취부 심 플레이트 (웹면 밀착)
        createBox(SL_SW_W + 0.014, SL_SW_H + 0.012, 0.004, frmDkMat,
          SL_SW_CX, SL_SW_CY, SL_WEB_Z + 0.002, slSwGrp);
        // 청색 바디 + 전면 백색 라벨
        createBox(SL_SW_W, SL_SW_H, SL_SW_D, swBlueMat, SL_SW_CX, SL_SW_CY, SL_SW_CZ, slSwGrp);
        createBox(SL_SW_W - 0.020, SL_SW_H - 0.011, 0.0012, swLabMat,
          SL_SW_CX - 0.002, SL_SW_CY, SL_SW_CZ + SL_SW_D / 2 + 0.0007, slSwGrp);
        // 취부 나사 2개
        [-1, 1].forEach(s => createCylinder(0.0035, 0.0035, 0.024, boltMat,
          SL_SW_CX + s * (SL_SW_W / 2 - 0.006), SL_SW_CY, SL_SW_CZ, slSwGrp).rotation.x = Math.PI / 2);
        // 롤러 레버 회전축 보스 (몸체 상단 외측 → 캠 평면으로 나옴)
        createCylinder(0.008, 0.008, SL_ROD_Z - SL_SW_CZ + 0.008, silvMat,
          SL_SW_PX, SL_SW_PY, (SL_SW_CZ + SL_ROD_Z) / 2, slSwGrp).rotation.x = Math.PI / 2;
        // 안쪽(-X) 회색 방수 케이블 글랜드
        createCylinder(0.009, 0.009, 0.022, glandMat,
          SL_SW_CX - SL_SW_W / 2 - 0.011, SL_SW_CY, SL_SW_CZ, slSwGrp).rotation.z = Math.PI / 2;
        /* 흑색 제어선 — 글랜드에서 일단 아래로 늘어졌다가 빔 웹 하단을 따라 카 중심으로.
           (실물 frame_012 의 늘어진 곡선. 곧장 수평으로 가면 붙은 느낌이 안 난다.) */
        const cabY = SL_WEB_BOT + 0.016, cabZ = SL_WEB_Z + 0.007;
        const cablePts = [
          new THREE.Vector3(SL_SW_CX - SL_SW_W / 2 - 0.022, SL_SW_CY, SL_SW_CZ),
          new THREE.Vector3(SL_SW_CX - SL_SW_W / 2 - 0.052, SL_SW_CY - 0.024, SL_SW_CZ - 0.004),
          new THREE.Vector3(SL_SW_CX - SL_SW_W / 2 - 0.082, cabY, cabZ),
          new THREE.Vector3(0.62, cabY, cabZ),
          new THREE.Vector3(0.22, cabY, cabZ)
        ];
        const cable = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts, false, 'centripetal'), 56, 0.0035, 8, false),
          cableMat);
        cable.castShadow = true; slSwGrp.add(cable);
        // 새들 클립 — 케이블을 빔에 물려 둔다
        [0.90, 0.74, 0.58, 0.42, 0.28].forEach(cx => {
          createBox(0.010, 0.014, 0.010, frmMat, cx, cabY, cabZ, slSwGrp);
          createCylinder(0.003, 0.003, 0.014, boltMat, cx, cabY - 0.009, cabZ, slSwGrp);
        });
      }
      // 롤러 레버 암 (가동) — 캠 엣지에 상시 접촉
      const slSwArm = new THREE.Group();
      slSwArm.name = 'safetySwitchArm';
      slSwArm.position.set(SL_SW_PX, SL_SW_PY, SL_ROD_Z);
      slSwArm.rotation.z = SL_ARM_A0;
      slGrp.add(slSwArm);
      createBox(SL_ARM_L, 0.008, 0.005, cableMat, SL_ARM_L / 2, 0, 0, slSwArm);
      createCylinder(SL_ROLLER_R, SL_ROLLER_R, 0.011, silvMat, SL_ARM_L, 0, 0, slSwArm)
        .rotation.x = Math.PI / 2;

      /* ── (7) 수직 연동 타이 로드 — 레버 축 → 카 측면 프레임 → 하부 세이프티 플랭크 ── */
      function buildTieRod(pinX) {
        const g = new THREE.Group();
        g.name = 'safetyTieRod';
        g.position.set(pinX, SL_LNK_Y0, SL_ROD_Z);
        slGrp.add(g);
        const len = SL_LNK_Y0 - SL_TIE_BOT;
        // 상단 클레비스 (레버 노즈를 물림)
        [-1, 1].forEach(zs => createBox(0.012, 0.040, 0.008, silvMat, 0, -0.014, zs * 0.008, g));
        hexNut(0.012, 0.010, goldMat, 0, -0.040, 0, g);
        // 본체 환봉 + 하단 아이 엔드
        createCylinder(SL_TIE_R, SL_TIE_R, len - 0.056, silvMat, 0, -0.046 - (len - 0.056) / 2, 0, g);
        createCylinder(0.016, 0.016, 0.010, goldMat, 0, -len + 0.010, 0, g).rotation.x = Math.PI / 2;
        return g;
      }
      const slTieR = buildTieRod(SL_PIV_XR + SL_PINL0[0]);
      const slTieL = buildTieRod(SL_PIV_XL + SL_PINL0[0]);
      [slTieR, slTieL].forEach(tie => { tie.userData.x0 = tie.position.x; });
      // 스타일 고정 가이드 브라켓 (타이로드 처짐·횡유격 방지, 정지부)
      [slTieR.position.x, slTieL.position.x].forEach(tx => {
        [H / 2 - 0.20, 0, -H / 2 + 0.30].forEach(by => {
          createBox(0.030, 0.020, SL_ROD_Z - (railBladeZ + 0.080), frmMat,
            tx, by, (railBladeZ + 0.080 + SL_ROD_Z) / 2, slGrp);
          createCylinder(0.013, 0.013, 0.020, silvMat, tx, by, SL_ROD_Z, slGrp);
        });
      });

      /* ── (8) 트립/복귀 포즈 — p = 0(대기) ~ 1(트립). 단일 진입점. ──
         ★매 프레임 호출된다. 지오메트리 생성·dispose 금지, transform 대입만. */
      const SL_TIE_LEN = SL_LNK_Y0 - SL_TIE_BOT;
      // 조속기 로프가 읽는 클램프 좌표(카 로컬). 프레임마다 새로 만들지 않고 갱신만 한다.
      const slClampOut = { x: 0, y: 0, z: SL_ROPE_Z };
      carGrp.userData.govClamp = slClampOut;
      carGrp.userData.safetyLinkage = {
        rod: slRod, spring: slSpring, leverR: slLeverR, leverL: slLeverL,
        swArm: slSwArm, tieR: slTieR, tieL: slTieL, crank: slCrank, tube: slTube,
        travel: SL_TRAVEL, lift: SL_LNK_DUP, swing: 2 * SL_HALF, clampLift: SL_CRK_UP,
        set(p) {
          const t = Math.min(Math.max(p, 0), 1);
          const a = slRot(t);
          slRod.position.x = -SL_TRAVEL * t;                       // 장죽이 카 중심 쪽으로 끌려온다
          slSpring.scale.x = (SL_SPR_L0 - SL_TRAVEL * t) / SL_SPR_L0;
          slLeverR.rotation.z = a;
          slLeverL.rotation.z = a;
          slTube.rotation.z = a;
          slCrank.rotation.z = a;
          slSwArm.rotation.z = SL_ARM_A0 + SL_ARM_SW * t;          // 로브에서 떨어지며 튀어 오름
          [slTieR, slTieL].forEach(tie => {
            tie.position.y = SL_LNK_Y0 + SL_LNK_DUP * t;
            tie.position.x = tie.userData.x0 + SL_LNK_DOU * t;
            tie.rotation.z = -Math.asin(SL_LNK_DOU * t / SL_TIE_LEN); // 하단은 제자리, 위만 끌린다
          });
          // 조속기 로프 클램프 (후방 크랭크 끝) — X 는 대기·트립 양 끝에서 로프선과 일치
          slClampOut.x = SL_PIV_XR + SL_CRK_R * Math.cos(a);
          slClampOut.y = SL_PIV_Y + SL_CRK_R * Math.sin(a);
        }
      };
      carGrp.userData.safetyLinkage.set(0);

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
      handrailGrp.name = 'carHandrail'; // 카 상부 부품 확인용 — 검증 스크립트가 잠시 숨긴다
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

      /* =========================================================================
         7. 카측 종단 안전장치 + 이동케이블 취부 (MR_설계.pdf 16.8, 부품설계.pdf 16.4)
            · CAM ASSY — 좌측 카 스타일에 붙는 파이프 3본(감속·리미트·파이널). 길이·Z가 달라 자기 스위치만 밟는다.
            · 카 케이블 행거 + T-CABLE 카측 배선 + 카 천장 고정 브라켓 (188p)
            좌표 원본은 index.html 계약 상수. 승강로측(리미트 스위치·해치 행거)은
            environment.js buildLimitSwitches() / buildTravelCable() 가 만든다.
         ========================================================================= */
      const zL = wz => wz - CAR_CTR_Z;   // 월드 Z → 카 로컬 Z
      const brkMat    = M.ss(0x98a1ab);

      /* ── (1) CAM ASSY — 카 스타일 고정, 파이프 3본(감속·리미트·파이널) ── */
      const camGrp = new THREE.Group();
      camGrp.name = 'terminalCamAssy';
      carFrameGrp.add(camGrp);
      const camT    = 0.006;
      const vaneW   = CAM_VANE_W;
      const camX    = FLS_CAM_FACE_X + camT / 2;               // 타격면 중심 X (면이 −X, 레일 쪽)
      const pipeX   = camX + 0.011;                            // 타격면 뒤 원형 파이프 중심
      const rise    = FLS_LEVER_L - FLS_LEVER_L * Math.cos(FLS_TRIP_ANGLE);
      const rampLen = Math.hypot(rise, FLS_LEAD);
      const pipeMat = {
        slowdown: M.ss(0x9aa3ad),
        limit:    M.ss(0xb0b8c0),
        final:    M.ss(0x7e868f)
      };
      const faceMat = {
        slowdown: M.ss(0x8f98a3),
        limit:    M.ss(0xa4adb6),
        final:    M.ss(0x747c86)
      };

      function addCamVane(vane) {
        const z = zL(FLS_Z + vane.dz);
        const len = vane.topLY - vane.botLY;
        const midY = (vane.topLY + vane.botLY) / 2;
        const straight = Math.max(0.02, len - 2 * FLS_LEAD);
        const face = faceMat[vane.kind], pipe = pipeMat[vane.kind];
        createBox(camT, straight, vaneW, face, camX, midY, z, camGrp);
        createCylinder(0.009, 0.009, straight, pipe, pipeX, midY, z, camGrp);
        [[vane.botLY, +1], [vane.topLY, -1]].forEach(([endY, inward]) => {
          const ramp = createBox(camT, rampLen, vaneW, face,
            camX + rise / 2, endY + inward * FLS_LEAD / 2, z, camGrp);
          ramp.rotation.z = inward * Math.atan2(rise, FLS_LEAD);
          createBox(0.018, camT, vaneW, face, camX + rise + 0.006, endY, z, camGrp);
        });
      }
      addCamVane(CAM_VANES.slowdown);
      addCamVane(CAM_VANES.limit);
      addCamVane(CAM_VANES.final);

      // 스타일 −Z 플랜지 → 세 가닥을 묶는 취부 암. 짧은 파이널 가닥과 겹치는 높이에만 둔다.
      const flangeZ = railBladeZ - 0.073;
      const bundleZ0 = flangeZ - 0.007;
      const bundleZ1 = zL(FLS_Z) + FLS_PAIR_DZ + vaneW / 2;
      [CAM_VANES.final.botLY + 0.12, CAM_MID_LY, CAM_VANES.final.topLY - 0.12].forEach(ay => {
        createBox(0.040, 0.028, Math.abs(bundleZ1 - bundleZ0), brkMat,
          camX + camT / 2 + 0.020, ay, (bundleZ0 + bundleZ1) / 2, camGrp);
        Object.values(CAM_VANES).forEach(v => {
          createBox(0.010, 0.028, CAM_VANE_W + 0.008, brkMat,
            pipeX + 0.006, ay, zL(FLS_Z + v.dz), camGrp);
        });
        [-0.012, 0.012].forEach(dx => {
          createCylinder(0.0045, 0.0045, 0.024, boltMat, camX + camT / 2 + 0.020 + dx, ay, flangeZ - 0.010, camGrp)
            .rotation.x = Math.PI / 2;
        });
      });
      terminalDevices.cam = { node: camGrp, lead: FLS_LEAD, faceX: FLS_CAM_FACE_X, vanes: CAM_VANES };

      /* 카 하부 인입 → 카 외판 측면 → 상부 정션박스. */
      const tcGrp = new THREE.Group();
      tcGrp.name = 'carTravelCable'; carGrp.add(tcGrp);
      const tcZL = zL(TC_CAR_Z), endY = TC_CAR_HANGER_LY;
      const sideZ = tcZL + 0.10, topY = TC_CAR_TOP_LY;
      // 플랫폼 외곽 채널 아래의 짧은 접힌 취부판. 주행 구간 중간에는 암을 두지 않는다.
      const floorEdgeX = -S.CAR_W / 2;
      createBox(Math.abs(TC_X-floorEdgeX)+0.02,0.008,0.10,brkMat,
        (TC_X+floorEdgeX)/2,endY+0.115,tcZL,tcGrp);
      createBox(0.008,0.12,0.10,brkMat,floorEdgeX,endY+0.17,tcZL,tcGrp);
      addTravelCableGrip(tcGrp,TC_X,endY+0.040,tcZL,'carCableGrip');
      const route = createTravelCableRun([
        [TC_X,endY,tcZL],[TC_X,endY+0.085,tcZL],
        [TC_X+0.06,endY+0.13,tcZL+0.045],
        [TC_SIDE_X,endY+0.16,sideZ],
        [TC_SIDE_X,endY+0.36,sideZ],
        [TC_SIDE_X,topY-0.26,sideZ],[TC_SIDE_X,topY-0.16,sideZ]
      ],tcGrp,'carCableRun');
      // 카에 밀착한 좁은 검정 밴드: 긴 금속 새들·돌출 볼트 제거.
      for(let y=endY+0.45;y<topY-0.20;y+=0.45)
        addTravelCableBand(tcGrp,TC_SIDE_X,y,sideZ);
      const jb = new THREE.Group(); jb.name='carCableJunction';
      jb.position.set(TC_SIDE_X+0.035,topY-0.04,sideZ); tcGrp.add(jb);
      createBox(0.10,0.22,0.16,M.paint(0x42484b),0,0,0,jb);
      createBox(0.004,0.20,0.14,M.ss(0x737b80),-0.053,0,0,jb);
      [-0.08,0.08].forEach(y=>[-0.05,0.05].forEach(z=>{
        createCylinder(0.003,0.003,0.006,boltMat,-0.057,y,z,jb).rotation.z=Math.PI/2;
      }));
      createBox(TC_W+0.008,0.018,TC_T+0.01,M.paint(0x101214),TC_SIDE_X,topY-0.155,sideZ,tcGrp);
      route.userData = { type:'car-cable-run', end:[TC_SIDE_X,topY-0.16,sideZ] };
      buildCarPanels(carGrp);
      buildCarLevelingSensors(carGrp);

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
      const ax = h.right.position.x + k.aOff; // 상부 가닥 클램프 (월드 +X 행거판)

      // 상부 가닥: 좌풀리 ↔ 좌측 패널 클램프 ↔ 우풀리 (헤더 상단 전면 가시 주행)
      setRopeSpan(k.seg.upL, k.pulLX, ax - k.aHalf, k.upY, k.upZ);
      setRopeSpan(k.seg.upR, ax + k.aHalf, k.pulRX, k.upY, k.upZ);

      /* 하부 본선: 양단 풀리 ↔ −X판의 고정 리드 시작점.
         본선 Y/Z는 유지하고 관통창의 높이·앞뒤 전환은 고정 리드가 담당한다. */
      const bx = h.left.position.x;
      setRopeSpan(k.seg.loL, k.pulLX, bx + k.bL, k.loY, k.loZ);
      setRopeSpan(k.seg.loR, bx + k.bR, k.pulRX, k.loY, k.loZ);

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
      const SILL_SHAFT_EDGE = HALL_SILL_SHAFT_Z - SILL_Z;  // 카 실과 공용 끝면
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

      // 2026-09-11 현장 교체 영상: 양단 반환 풀리 + 직접 전산볼트 종단.
      // 본선은 행거판 뒤, -X판 종단 주변만 두 관통창을 통해 앞쪽으로 나온다.
      const CASE_LIP_Z = -(CASE_D / 2) + 0.002;
      const HP_PLATE_Z = CASE_LIP_Z - 0.005;
      const ROPE_PLANE_Z = HP_PLATE_Z + 0.012;
      const ROPE_UP_Z = ROPE_PLANE_Z, ROPE_LO_Z = ROPE_PLANE_Z, ROPE_Z = ROPE_PLANE_Z;
      const ROPE_R = 0.022, PUL_R = 0.030;
      const ROPE_RD = 0.0018; // 현장처럼 가는 연선, 시각 재구성 Ø3.6mm.
      const RA_OFF = 0.020, RA_HALF = 0.022;
      const RB_OFF = 0, RB_L = -0.125, RB_R = 0.125;
      const END_DY = 0.013, END_Z = HP_PLATE_Z - 0.025, END_ENTRY = 0.058;
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
          createCylinder(ROPE_R-ROPE_RD, ROPE_R-ROPE_RD, 0.014, hcDarkMat, 0, 0, 0, pg).rotation.x = Math.PI / 2;
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
            aOff: RA_OFF, aHalf: RA_HALF, terminalType: 'opposed-threaded-studs',
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
          // 직접 종단용 관통창 2개. 가운데는 세로 취부 브라켓의 체결 면이다.
          const pShape = new THREE.Shape();
          pShape.moveTo(-0.190,-0.080);pShape.lineTo(0.190,-0.080);
          pShape.lineTo(0.190,0.080);pShape.lineTo(-0.190,0.080);pShape.closePath();
          grp.userData.windows=[];
          for(const sign of [-1,1]) {
            const x=sign*0.099,y=0.040-ROPE_R-sign*END_DY;
            const w={x0:x-0.024,x1:x+0.024,y0:y-0.012,y1:y+0.012};
            const hole=new THREE.Path();hole.moveTo(w.x0,w.y0);hole.lineTo(w.x1,w.y0);
            hole.lineTo(w.x1,w.y1);hole.lineTo(w.x0,w.y1);hole.closePath();
            pShape.holes.push(hole);grp.userData.windows.push(w);
          }

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

          // 상부 연속 로프를 단순 2볼트 클램프로 고정한다. 종단용 코일 스프링은 없다.
          const clampY=g.caseCY+ROPE_R,rZ=ROPE_UP_Z;
          const clamp=new THREE.Group();clamp.name='relayUpperClamp';grp.add(clamp);
          createBox(0.054,0.026,0.003,hpSteelMat,RA_OFF,clampY,plateZ-0.003,clamp);
          createBox(RA_HALF*2,0.012,0.014,hpSteelMat,RA_OFF,clampY,rZ,clamp);
          for(const dx of [-0.015,0.015])
            createCylinder(0.004,0.004,0.025,hpBoltMat,RA_OFF+dx,clampY,plateZ+0.003,clamp).rotation.x=Math.PI/2;

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

          // 현장 영상 55~85초/660초: 위·아래 로프가 반대 방향에서 오는 나사식 종단 2개.
          const ends=new THREE.Group();ends.name='relayThreadedTerminals';grp.add(ends);
          createBox(0.036,0.068,0.004,hpSteelMat,RB_OFF,tensY,plateZ-0.003,ends);
          createBox(0.004,0.064,plateZ-END_Z+0.014,hpSteelMat,RB_OFF,tensY,(plateZ+END_Z-0.014)/2,ends);
          for(const dy of [-0.026,0.026])
            createCylinder(0.004,0.004,0.007,hpBoltMat,RB_OFF+0.011,tensY+dy,plateZ-0.007,ends).rotation.x=Math.PI/2;
          for(const sign of [-1,1]) {
            const y=tensY-sign*END_DY;
            const end=new THREE.Group();end.name=sign<0?'relayTerminalUpper':'relayTerminalLower';ends.add(end);
            const entry=RB_OFF+sign*END_ENTRY,tip=RB_OFF-sign*0.026;
            createCylinder(0.0035,0.0035,Math.abs(entry-tip),hpBoltMat,(entry+tip)/2,y,END_Z,end).rotation.z=Math.PI/2;
            const sleeve=createCylinder(0.0055,0.0055,0.019,M.ss(0xaa914e),entry-sign*0.0095,y,END_Z,end);
            sleeve.name='relaySwageSleeve';sleeve.rotation.z=Math.PI/2;
            // 와셔와 더블 너트는 수직 브라켓 양면에 놓는다.
            for(const x of [-0.008,0.008,0.016].map(v=>RB_OFF-sign*v)) {
              const nut=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.005,6),hpBoltMat);
              nut.position.set(x,y,END_Z);nut.rotation.z=Math.PI/2;end.add(nut);
            }
            for(let x=-0.024;x<=0.024;x+=0.003)
              createCylinder(0.0039,0.0039,0.0007,hpBoltMat,RB_OFF+x,y,END_Z,end).rotation.z=Math.PI/2;
            const start=RB_OFF+(sign<0?RB_L:RB_R);
            // 짧은 전환부는 이동판에 고정하며 본선 높이는 유지하고 창 안에서 앞으로 나온다.
            const points=[new THREE.Vector3(start,tensY,ROPE_Z),
              new THREE.Vector3(RB_OFF+sign*0.114,y,ROPE_Z),
              new THREE.Vector3(RB_OFF+sign*0.099,y,(ROPE_Z+END_Z)/2),
              new THREE.Vector3(RB_OFF+sign*0.081,y,END_Z),new THREE.Vector3(entry,y,END_Z)];
            const lead=makeRopeTube(end,points);lead.name='relayTerminalLead';
            lead.userData.start=points[0].toArray();lead.userData.end=points.at(-1).toArray();
          }
          grp.userData.relayTerminalType='opposed-threaded-studs';

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
        // 문짝 폭의 약 1/4·3/4. 키홀 쪽만 바깥으로 50mm 더 비운다.
        [side * (0.05 - dw * 0.26), side * dw * 0.26].forEach(rbx => {
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
          // Parent to the cam shaft so lobby-side triangle turns with the key.

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

          // Joint marker at the cam tip. HallInterlock stretches this pin in −Z
          // until it sits in the GLB LinkFoot slot after the model loads.
          const drivePin = new THREE.Group();
          drivePin.name = 'CamPinJoint';
          drivePin.position.set(camLen, 0, 0);
          camPivot.add(drivePin);
          const pinMesh = createCylinder(0.0035, 0.0035, 0.010, hpBoltMat, camLen, 0, 0, camPivot);
          pinMesh.rotation.x = Math.PI / 2;
          const pinCap = createCylinder(0.006, 0.006, 0.003, hpBoltMat, camLen, 0, -0.005, camPivot);
          pinCap.rotation.x = Math.PI / 2;

          camPivot.add(triCore);
          triCore.position.set(0, 0, (zHall + 0.0008) - (zHoist - 0.008));
          triCore.rotation.z = -camRad;

          triKeyGrp.add(camPivot);
          grp.add(triKeyGrp);
          grp.userData.triKey = {
            group: triKeyGrp, camPivot, drivePin, pinMesh, pinCap,
            pinRest: 0.010, camLen, triX, triY, pinY, barX
          };
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
        if (right.userData.triKey) right.userData.triKey.floorIdx = i;
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
      const h = hatchDoors[fIdx];
      const rGrp = h.right;
      const tri  = rGrp.userData.triKey;
      const hp   = rGrp.userData.hookPivot;
      if (!tri || !tri.camPivot || !h.interlock?.ready) return;

      const clampedRatio = Math.max(0, Math.min(1, ratio));
      h.keyRatio = clampedRatio;
      // (1) 삼각키 캠 레버 회전: 35° ~ 85°
      const initAng = 35 * Math.PI / 180;
      const maxDelta = 50 * Math.PI / 180;
      tri.camPivot.rotation.z = initAng + clampedRatio * maxDelta;

      /* (2) GLB에 기록된 정확한 회전각으로 사각 턱을 해정한다. */
      if (hp) {
        const lr = h.latch.liftRad;
        hp.rotation.z = -clampedRatio * lr;
        HallInterlock.update(h);
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

    /* ==========================================================================
       buildTravelCable — 이동케이블(T-Cable) 승강로 고정단 + U 곡면 본체
       부품설계.pdf 16.4 (186~188p)

       ① 해치 케이블 행거: "카운터웨이트 프레임 충돌판과 카 바닥이 같은 높이인
          상태(B 지점)에서 1,000mm 상부" 카 히치측 카 레일에 설치한다(187p 2항).
          B 지점은 상수로 박지 않고 실제 카·균형추 그룹 위치에서 역산한다.
            카 바닥(carY − CAR_H/2) = 균형추 충돌판(cwtY − CWT_H/2)
            균형추는 카와 반대로 같은 양만큼 움직이므로 carY 에 대해 1차식이 된다.
       ② 케이블 총 길이: "카가 최하층일 때 곡면 최하단부가 피트 바닥 +300±50mm"
          (188p 5항) 조건으로 역산한다. 길이가 정해지면 곡면 중심 높이는
          두 끝점 높이의 함수라 카가 움직일 때마다 refreshTravelCable() 이 푼다.

       메시는 단면이 편평한 리본이다. 샘플 수를 고정해 두고 위치 속성만 갱신하므로
       렌더 루프에서 지오메트리를 새로 만들지 않는다(AGENTS.md).
       ========================================================================== */
    // Shared rounded PVC profile: broad flat faces, softly rounded edges.
    function travelCableJacket() {
      if (!travelCableJacket.cached) {
        const material=M.paint(TC_COLOR);
        material.clearcoat=0; material.metalness=0; material.roughness=0.88;
        travelCableJacket.cached=material;
      }
      return travelCableJacket.cached;
    }
    function travelCableProfile() {
      if (travelCableProfile.cached) return travelCableProfile.cached;
      const points=[], r=TC_T/2;
      for(let side of [1,-1]) for(let j=0;j<=6;j++) {
        const a=-Math.PI/2+j*Math.PI/6+(side===1?0:Math.PI);
        points.push([side*(TC_W/2-r)+r*Math.cos(a),r*Math.sin(a)]);
      }
      travelCableProfile.cached=points;
      return points;
    }
    function createTravelCableGeometry(count) {
      const n=travelCableProfile().length, idx=[];
      for(let i=0;i<count-1;i++) for(let k=0;k<n;k++) {
        const a=i*n+k,b=i*n+(k+1)%n,c=b+n,d=a+n;
        idx.push(a,b,c,a,c,d);
      }
      for(let k=1;k<n-1;k++) { idx.push(0,k+1,k); const a=(count-1)*n; idx.push(a,a+k,a+k+1); }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*n*3),3));
      g.setIndex(idx); return g;
    }
    function createTravelCableRun(points,parent,name) {
      const pts=points.map(p=>new THREE.Vector3(...p)), curve=new THREE.CurvePath();
      let last=pts[0];
      for(let i=1;i<pts.length-1;i++) {
        const p=pts[i], before=pts[i-1], after=pts[i+1];
        const radius=Math.min(0.08,p.distanceTo(before)*0.25,p.distanceTo(after)*0.25);
        const entry=p.clone().addScaledVector(before.clone().sub(p).normalize(),radius);
        const exit=p.clone().addScaledVector(after.clone().sub(p).normalize(),radius);
        curve.add(new THREE.LineCurve3(last,entry));
        curve.add(new THREE.QuadraticBezierCurve3(entry,p,exit)); last=exit;
      }
      curve.add(new THREE.LineCurve3(last,pts[pts.length-1]));
      const count=Math.max(160,Math.ceil(curve.getLength()/0.012)), profile=travelCableProfile(), geo=createTravelCableGeometry(count);
      const positions=geo.attributes.position.array;
      let tangent=curve.getTangent(0), width=new THREE.Vector3(1,0,0);
      width.addScaledVector(tangent,-width.dot(tangent)).normalize();
      for(let i=0;i<count;i++) {
        const t=i/(count-1), next=curve.getTangent(t), p=curve.getPoint(t);
        width.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(tangent,next)).normalize();
        const normal=new THREE.Vector3().crossVectors(next,width).normalize(); tangent=next;
        for(let k=0;k<profile.length;k++) {
          const q=p.clone().addScaledVector(width,profile[k][0]).addScaledVector(normal,profile[k][1]);
          q.toArray(positions,(i*profile.length+k)*3);
        }
      }
      geo.computeVertexNormals();
      const m=new THREE.Mesh(geo,travelCableJacket()); m.name=name; m.castShadow=true; parent.add(m); return m;
    }
    function addTravelCableBand(parent,x,y,z) {
      const m=M.paint(0x121416), g=new THREE.Group(); g.name='cableBand';
      m.clearcoat=0; m.roughness=0.9; m.metalness=0;
      g.position.set(x,y,z); parent.add(g);
      const h=0.004, t=0.0012;
      for(const side of [-1,1]) {
        createBox(TC_W+2*t,h,t,m,0,0,side*(TC_T+t)/2,g);
        createBox(t,h,TC_T,m,side*(TC_W+t)/2,0,0,g);
      }
      // Flush-cut locking head, no pointed tail.
      createBox(0.006,0.006,0.003,m,TC_W/2-0.004,0,TC_T/2+0.002,g);
      return g;
    }
    function addTravelCableGrip(parent,x,y,z,name) {
      const g=new THREE.Group(); g.name=name; g.position.set(x,y,z); parent.add(g);
      const shell=M.ss(0x50585c), rubber=M.paint(0x171a1c);
      createBox(TC_W+0.016,0.075,TC_T+0.014,shell,0,0,0,g);
      createBox(TC_W,0.07,0.003,rubber,0,0,-TC_T/2-0.008,g);
      for(const sx of [-1,1]) {
        createCylinder(0.003,0.003,0.004,shell,sx*(TC_W/2+0.004),0,-TC_T/2-0.01,g).rotation.x=Math.PI/2;
      }
      return g;
    }

    const TC_SEGS = 240; // 곡선 샘플 수 (고정)

    function buildTravelCable() {
      travelCableGrp = new THREE.Group();
      travelCableGrp.name = 'travelCableGrp';

      const brkMat  = M.ss(0x98a1ab);
      const boltMat = M.ss(0xb8bec6);
      const clipMat = M.gold();
      const tcJacket = travelCableJacket();

      /* ── B 지점과 해치 케이블 행거 높이 역산 ──
         carY − CAR_H/2 = (cwtY0 − (carY − carY0)) − CWT_H/2  →  carY 에 대해 풀면 다음. */
      const carY0 = carGrp.position.y, cwtY0 = cwtGrp.position.y;
      const carYb = (cwtY0 + carY0 + (S.CAR_H - S.CWT_H) / 2) / 2;
      const hangerY = carYb - S.CAR_H / 2 + TC_HANGER_UP;

      /* ── 총 길이 역산 (최하층 기준) ── */
      const pitTopY = Y0 + 0.02;                       // 피트 마감 바닥 상면 (buildPitFoundation)
      const ycBottom = pitTopY + TC_PIT_CLEAR + TC_LOOP_R;
      const carEndY0 = FLOOR_Y[0] + S.CAR_H / 2 + TC_CAR_HANGER_LY;
      const totalLen = (hangerY - ycBottom) + Math.PI * TC_LOOP_R + (carEndY0 - ycBottom);

      // 작은 고정 행거만 벽에 취부. 레일에서 길게 나온 드럼/암은 사용하지 않는다.
      const hangerGrp=new THREE.Group(); hangerGrp.name='travelCableHanger';
      travelCableGrp.add(hangerGrp);
      const wallX=-S.SHAFT_W/2;
      createBox(0.006,0.15,0.11,brkMat,wallX+0.003,hangerY+0.055,TC_FIX_Z,hangerGrp);
      createBox(Math.abs(TC_X-wallX),0.008,0.09,brkMat,(wallX+TC_X)/2,hangerY+0.11,TC_FIX_Z,hangerGrp);
      addTravelCableGrip(hangerGrp,TC_X,hangerY+0.045,TC_FIX_Z,'shaftCableGrip');
      const upTop=CEIL_RUN_Y, mrCableY=Y0+TOTAL_H+0.07;
      createTravelCableRun([
        [TC_X,hangerY,TC_FIX_Z],[TC_X,hangerY+0.14,TC_FIX_Z],
        [TC_WALL_X,hangerY+0.45,TC_FIX_Z],
        [TC_WALL_X,upTop-0.20,TC_FIX_Z],
        [TC_WALL_X,upTop,HARNESS_Z-0.12],
        [MR_CABLE_HOLE_X,upTop+0.04,HARNESS_Z],
        [MR_CABLE_HOLE_X,mrCableY-0.06,HARNESS_Z],
        [MR_CABLE_HOLE_X-0.16,mrCableY,HARNESS_Z]
      ],travelCableGrp,'fixedCableRun');
      for(let y=hangerY+0.65;y<upTop-0.30;y+=0.65){
        addTravelCableBand(travelCableGrp,TC_WALL_X,y,TC_FIX_Z);
        createBox(0.018,0.018,0.014,brkMat,wallX+0.012,y,TC_FIX_Z,travelCableGrp);
      }

      /* ── 편평 케이블 리본 메시 (단면 TC_W × TC_T, 샘플 TC_SEGS 고정) ── */
      const geo = createTravelCableGeometry(TC_SEGS);
      const ribbon = new THREE.Mesh(geo, tcJacket);
      ribbon.name = 'travelCableRibbon';
      ribbon.castShadow = true; ribbon.receiveShadow = true;
      ribbon.frustumCulled = false;
      travelCableGrp.add(ribbon);

      travelCable.ready = true;
      travelCable.hangerY = hangerY;
      travelCable.bY = carYb - S.CAR_H / 2;   // B 지점(카 바닥) 높이 — 검증용
      travelCable.totalLen = totalLen;
      travelCable.ribbon = ribbon;
      travelCable.pitTopY = pitTopY;

      scene.add(travelCableGrp);
      refreshTravelCable();
    }

    /* 카가 움직일 때마다 U 곡면 중심 높이를 다시 풀고 리본 정점을 갱신한다.
       길이 보존:  (yTop − yc) + πR + (yCar − yc) = totalLen  →  yc = (yTop + yCar + πR − L) / 2 */
    function refreshTravelCable() {
      if (!travelCable.ready) return;
      const R = TC_LOOP_R;
      const yTop = travelCable.hangerY;
      const yCar = carGrp.position.y + TC_CAR_HANGER_LY;
      let yc = (yTop + yCar + Math.PI * R - travelCable.totalLen) / 2;
      // 안전 클램프 — 피트 바닥을 뚫거나 고정단 위로 올라가지 않게 한다
      yc = Math.max(travelCable.pitTopY + R + 0.02, Math.min(yc, yTop - 0.02));

      const zc = (TC_FIX_Z + TC_CAR_Z) / 2;
      const straightTop = yTop - yc;
      const arcLen = Math.PI * R;
      const straightCar = yCar - yc;
      const total = straightTop + arcLen + straightCar;

      const pos = travelCable.ribbon.geometry.attributes.position;
      const arr = pos.array;
      const profile = travelCableProfile();
      for (let i = 0; i < TC_SEGS; i++) {
        const t = total * i / (TC_SEGS - 1);
        let y, z, dz, dy;
        if (t <= straightTop) {                      // 고정단 하강
          z = TC_FIX_Z; y = yTop - t; dz = 0; dy = -1;
        } else if (t <= straightTop + arcLen) {      // U 곡면
          const phi = (t - straightTop) / R;
          z = zc + R * Math.cos(phi); y = yc - R * Math.sin(phi);
          dz = -Math.sin(phi); dy = -Math.cos(phi);
        } else {                                     // 카측 상승
          z = TC_CAR_Z; y = yc + (t - straightTop - arcLen); dz = 0; dy = 1;
        }
        // 진행방향에 수직인 단면 법선 (ZY 평면) — 폭은 항상 월드 X 축이다
        const nz = -dy, ny = dz;
        for(let k=0;k<profile.length;k++) {
          const [w,h]=profile[k], o=(i*profile.length+k)*3;
          arr[o]=TC_X+w; arr[o+1]=y+ny*h; arr[o+2]=z+nz*h;
        }
      }
      pos.needsUpdate = true;
      travelCable.ribbon.geometry.computeVertexNormals();
      travelCable.ribbon.geometry.computeBoundingBox();
      travelCable.loopBottomY = yc - R;
    }

    /* 카 캠 가닥 3본이 자기 레인 스위치만 밟는 상태 갱신 (MR_설계 16.8).
       스위치 롤러축 Y 가 해당 종류 가닥 범위 안이면 눌린다. 양 끝 FLS_LEAD 는 리드인.
       운행 FSM 은 건드리지 않는다. elevatorState 플래그만 반영한다. */
    function refreshTerminalDevices() {
      const cam = terminalDevices.cam;
      if (!cam || !terminalDevices.switches.length) return;
      const active = { slowdown: false, limit: false, final: false };
      terminalDevices.switches.forEach(sw => {
        const vane = cam.vanes[sw.kind];
        const camBot = carGrp.position.y + vane.botLY;
        const camTop = carGrp.position.y + vane.topLY;
        let r = 0;
        if (sw.y >= camBot && sw.y <= camTop) {
          r = Math.min(1, (sw.y - camBot) / cam.lead, (camTop - sw.y) / cam.lead);
        }
        sw.ratio = r;
        sw.lever.rotation.z = sw.dir * FLS_TRIP_ANGLE * r;
        if (r > 0.98) active[sw.kind] = true;
      });
      elevatorState.slowdownActive   = active.slowdown;
      elevatorState.limitActive      = active.limit;
      elevatorState.finalLimitActive = active.final;
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
      // 카 위치가 바뀌면 이동케이블 곡면과 종단 리미트 레버도 같이 따라간다.
      // (운행·점검·과속 낙하 모든 경로가 refreshRopes 를 거치므로 호출점은 여기 하나다)
      refreshTravelCable();
      refreshTerminalDevices();
      refreshLevelingSensors();
      refreshCarSafetyLinkage();
    }

    /* 카 상부 크로스헤드 연동부는 하부 안전기 샤프트 각도 하나만 읽어 따라간다.
       ui.js engageDeviceStop 이 shaft.rotation.x 를 SG_TRIP_ROT 까지 돌리므로
       장죽·스프링·캠·스위치 롤러·타이로드가 웨지 물림과 같은 진행률로 움직인다.
       트립(engageDeviceStop)·복귀(governorReset) 양쪽 경로가 여기를 거친다. */
    function refreshCarSafetyLinkage() {
      if (!carGrp || !carGrp.userData.safetyLinkage) return;
      const sg = carGrp.userData.safetyGear;
      if (!sg || !sg.shaft) return;
      carGrp.userData.safetyLinkage.set(sg.shaft.rotation.x / SG_TRIP_ROT);
    }

    // 실사 와이어로프 2구간(조속기휠→클램프, 클램프→인장시브)의 위치·길이·기울기만 갱신한다.
    // 메시·지오메트리는 environment.js에서 이미 만들어 두었다 (렌더 루프 생성 금지).
    const _ropeUp = new THREE.Vector3(0, 1, 0);
    const _ropeA = new THREE.Vector3(), _ropeB = new THREE.Vector3(), _ropeDir = new THREE.Vector3();

    function refreshGovernorRope() {
      if (!govRopeSegs || !govRopeData) return;

      /* 클램프 좌표의 단일 원본은 카 상부 크로스헤드 연동부다(§4-B `set(p)` 가 발행).
         후방 크랭크가 Z 축으로 돌기 때문에 클램프 Z 는 로프 평면(GOV_CLAMP_Z)에 고정이고
         X 는 대기·트립 양단에서 같다(±SL_HALF 대칭). 그 사이에서만 살짝 볼록해진다.
         ★ environment.js buildPit() 이 카를 만들기 전에 한 번 부르므로
           govClamp 가 아직 없으면 꺾임 없는 직선 로프로 그린다. */
      const gc = carGrp && carGrp.userData.govClamp;
      if (!gc) {
        const seg = govRopeSegs[0];
        _ropeA.set(govRopeData.x, govRopeData.topY, govRopeData.z);
        _ropeB.set(govRopeData.x, govRopeData.botY, govRopeData.z);
        _ropeDir.subVectors(_ropeB, _ropeA);
        const len0 = _ropeDir.length();
        seg.visible = len0 > 1e-5;
        if (seg.visible) {
          seg.position.addVectors(_ropeA, _ropeB).multiplyScalar(0.5);
          seg.quaternion.setFromUnitVectors(_ropeUp, _ropeDir.divideScalar(len0));
          setGovRopeLen(seg, len0);
        }
        govRopeSegs[1].visible = false;
        return;
      }

      const clampX = gc.x;                       // 카 로컬 X = 월드 X (carGrp 회전 없음)
      const clampY = carGrp.position.y + gc.y;
      const clampZ = CAR_CTR_Z + gc.z;

      const ends = [
        [govRopeData.x, govRopeData.topY, govRopeData.z, clampX, clampY, clampZ], // 상부 구간
        [clampX, clampY, clampZ, govRopeData.x, govRopeData.botY, govRopeData.z]  // 하부 구간
      ];
      ends.forEach(([x0, y0, z0, x1, y1, z1], i) => {
        const seg = govRopeSegs[i];
        _ropeA.set(x0, y0, z0);
        _ropeB.set(x1, y1, z1);
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
      /* ★순서 주의: 링키지가 먼저 carGrp.userData.govClamp 를 갱신해야
         refreshGovernorRope() 가 같은 프레임의 클램프 위치를 읽는다. 뒤집으면 로프가
         한 프레임 늦게 따라와 복귀 애니메이션에서 로프만 덜컥거린다. */
      tl.eventCallback("onUpdate", () => { refreshCarSafetyLinkage(); refreshGovernorRope(); });

      tl.add(() => { governorPhase = 'rest'; if (onDone) onDone(); });
      return tl;
    }
