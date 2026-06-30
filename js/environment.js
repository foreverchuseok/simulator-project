// 움직이지 않는 배경 및 정적 객체 생성 함수를 정의한다.
    function buildLighting() {
      // 주변광(HemisphereLight) 강도를 높여 어두운 부분을 밝혀줌
      scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 2.0));

      const sun = new THREE.DirectionalLight(0xfffae8, 2.5);
      // 빡의 각도를 정면에 가꺝게 수정하여 승강장 도어에 집은 그림자가 지지 않도록 함
      sun.position.set(10, 30, 40);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.0005;
      scene.add(sun);

      const carLight = new THREE.PointLight(0xfffbe8, 2.5, 6);
      carLight.name = 'carLight';
      carLight.position.set(0, FLOOR_Y[0] + S.CAR_H * 0.8, 0);
      scene.add(carLight);
    }

    function buildMountainRange(parent) {
      const layers = [
        { z: -40, color: 0x5c7850, peaks: [[-32, 10], [-18, 14], [-4, 16], [10, 13], [24, 11], [36, 9]] },
        { z: -44, color: 0x486040, peaks: [[-28, 12], [-12, 17], [4, 19], [18, 14], [32, 10]] },
        { z: -48, color: 0x384c30, peaks: [[-22, 9], [0, 15], [22, 11]] }
      ];
      layers.forEach((layer) => {
        layer.peaks.forEach(([x, h]) => {
          const mesh = new THREE.Mesh(
            new THREE.ConeGeometry(h * 0.58, h, 6),
            M.paint(layer.color)
          );
          mesh.position.set(x, Y0 + h / 2, layer.z);
          mesh.userData = { type: 'bg-mountain' };
          parent.add(mesh);
        });
      });
    }

    // koelsa2 참고 — 승강기 시험탑 캠퍼스 (왼쪽 -X)
    function buildKoelsaTowerCampus(parent) {
      const grp = new THREE.Group();
      grp.name = 'koelsa2-campus';
      grp.position.set(-17, 0, -28);

      const white = M.ss(0x7a8088);
      const grey = M.conc(0x686c70);
      const blueRoof = M.paint(0x3b6ea5);

      const towerR = 1.1;
      const towerH = 22;
      createCylinder(towerR, towerR, towerH, white, 0, Y0 + towerH / 2, 0, grp);
      createBox(3.2, 1.8, 3.2, M.ss(0x787c82), 0, Y0 + towerH + 0.9, 0, grp);
      createBox(3.6, 0.3, 3.6, white, 0, Y0 + towerH + 1.9, 0, grp);
      createCylinder(0.04, 0.04, 1.2, M.ss(0x888888), 0, Y0 + towerH + 2.6, 0, grp);

      // t_front.png — 타워 원통 중앙 둘레 감김 (승강기안전기술원)
      new THREE.TextureLoader().load('assets/bg/t_front.png', (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        const bandH = 0.74;
        const bandW = bandH * (tex.image.width / tex.image.height);
        const thetaSpan = Math.min(Math.PI * 0.92, bandW / towerR);
        const thetaStart = -(thetaSpan / 2); // 0 = +Z 정면 기준 중앙 정렬
        const labelY = Y0 + towerH * 0.72;
        const label = new THREE.Mesh(
          new THREE.CylinderGeometry(towerR + 0.012, towerR + 0.012, bandH, 64, 1, true, thetaStart, thetaSpan),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
        );
        label.position.set(0, labelY, 0);
        label.userData = { type: 'tower-label' };
        grp.add(label);
      });

      createBox(6, 2.5, 4, grey, -5, Y0 + 1.25, -2, grp);
      createBox(6, 0.15, 4.2, blueRoof, -5, Y0 + 2.55, -2, grp);
      createBox(4, 2, 3, grey, -5, Y0 + 1, 3, grp);
      createBox(4, 0.12, 3.2, blueRoof, -5, Y0 + 2.06, 3, grp);
      createBox(5, 2.8, 4, white, 4, Y0 + 1.4, 1, grp);
      createBox(4.5, 1.8, 0.08, M.glass(), 4, Y0 + 1.6, 3.05, grp);

      // Z-fighting 방지: 글로벌 ground top(Y0+0.05)보다 명확히 위로 띄움
      createBox(14, 0.06, 10, M.paint(0x555a60), 0, Y0 + 0.10, 0, grp);
      createBox(10, 0.05, 6, M.paint(0x507a42), -1, Y0 + 0.12, -4, grp);

      grp.userData = { type: 'bg-koelsa2' };
      parent.add(grp);
    }

    // koelsa.png 참고 — 한국승강기안전공단 본관 정밀 3D 모델 (오른쪽 +X)
    function buildKoelsaHQ(parent) {
      const grp = new THREE.Group();
      grp.name = 'koelsa-hq';
      grp.position.set(17, 0, -26);

      // ── 공용 재질 ──
      const panelW   = M.ss(0x828080);     // 크림화이트 알루미늄 패널 (외벽)
      const panelBnd = M.ss(0x706e68);     // 스팬드럴 밴드 (층간 솔리드)
      const mulliMat = M.ss(0x606468);     // 알루미늄 뮬리언 (유리 격자)
      const colMat   = M.paint(0x9e6420);  // 브론즈/목재 원형 기둥
      const paveConc = M.conc(0x96928c);   // 콘크리트 포장
      const parkMat  = M.conc(0x50545a);   // 주차장 아스팔트
      const grassMat = M.conc(0x4a7338);   // 잔디
      const leafMat  = M.conc(0x528838);   // 나뭇잎
      const trunkMat = M.conc(0x6b4420);   // 나무 줄기

      // 파란 커튼월 유리 (공용 인스턴스)
      const glassBlue = new THREE.MeshPhysicalMaterial({
        color: 0x3a6ea8, transmission: 0.65, opacity: 1, transparent: true,
        roughness: 0.08, ior: 1.52, metalness: 0.1, side: THREE.DoubleSide
      });

      const FH = 3.3;          // 층고 (m)
      const NF = 7;            // 층수
      const MH = FH * NF;     // 타워 전체 높이 = 23.1m
      const MW = 15.0;         // 타워 폭
      const MD = 8.0;          // 타워 깊이
      const FZ = MD / 2;       // 타워 전면 로컬 Z

      // ════════════════════════════════════════════════
      //  1. 메인 타워 코어 (Main Tower)
      // ════════════════════════════════════════════════
      createBox(MW, MH, 0.3, panelW, 0, Y0 + MH / 2, -MD / 2, grp);         // 후면벽
      createBox(0.3, MH, MD, panelW, -MW / 2, Y0 + MH / 2, 0, grp);          // 좌측벽
      createBox(0.3, MH, MD, panelW,  MW / 2, Y0 + MH / 2, 0, grp);          // 우측벽

      // 전면 커튼월 — 층별 유리 패널 + 스팬드럴 밴드
      for (let f = 0; f < NF; f++) {
        const fy  = Y0 + f * FH;
        const spH = f === 0 ? 0.7 : 0.5;  // 1층 스팬드럴 두께
        const glH = FH - spH - 0.05;
        const glY = fy + spH + glH / 2;

        // 수평 스팬드럴 밴드 (슬래브 엣지)
        createBox(MW + 0.2, spH, 0.28, panelBnd, 0, fy + spH / 2, FZ + 0.1, grp);

        // 유리 패널
        createBox(MW - 0.7, glH, 0.06, glassBlue, 0, glY, FZ + 0.04, grp);

        // 수직 뮬리언 — 5 베이 × 6선
        for (let v = 0; v <= 5; v++) {
          const vx = -MW / 2 + 0.35 + v * (MW - 0.7) / 5;
          createBox(0.065, glH + 0.12, 0.10, mulliMat, vx, glY, FZ + 0.07, grp);
        }
      }

      // 최상층 처마 코니스
      createBox(MW + 0.4, 0.35, 0.38, panelW, 0, Y0 + MH + 0.18, FZ + 0.14, grp);

      // ════════════════════════════════════════════════
      //  2. 파라펫 & 옥상
      // ════════════════════════════════════════════════
      const PH = 1.1;
      createBox(MW + 0.5, PH, 0.28, panelW, 0, Y0 + MH + PH / 2, FZ, grp);          // 전면
      createBox(0.28, PH, MD + 0.5, panelW, -MW / 2, Y0 + MH + PH / 2, 0, grp);     // 좌측
      createBox(0.28, PH, MD + 0.5, panelW,  MW / 2, Y0 + MH + PH / 2, 0, grp);     // 우측
      createBox(MW + 0.5, PH, 0.28, panelW, 0, Y0 + MH + PH / 2, -MD / 2, grp);     // 후면
      // 옥상 슬래브
      createBox(MW + 0.5, 0.18, MD + 0.5, M.conc(0x7d7a76), 0, Y0 + MH + 0.09, 0, grp);

      // k_front.png — 파라펫 위 독립 간판 (가림 없는 최상단)
      const signTopY = Y0 + MH + PH + 1.2; // 파라펫 상단보다 1.2m 위
      // 흰색 배경판
      createBox(9.8, 2.5, 0.22, M.ss(0x888888), 0, signTopY, FZ + 0.06, grp);
      // 지지 기둥 2개
      createBox(0.18, 1.2, 0.18, M.ss(0xa8adb2), -2.8, Y0 + MH + PH + 0.6, FZ + 0.06, grp);
      createBox(0.18, 1.2, 0.18, M.ss(0xa8adb2),  2.8, Y0 + MH + PH + 0.6, FZ + 0.06, grp);
      new THREE.TextureLoader().load('assets/bg/k_front.png', (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        const asp = tex.image.width / tex.image.height;
        const sH = 2.1;
        const sW = Math.min(sH * asp, 9.4);
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(sW, sH),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
        );
        plane.position.set(0, signTopY, FZ + 0.20);
        plane.userData = { type: 'hq-label' };
        grp.add(plane);
      });

      // 옥상 기계 설비 (에어컨 실외기, 덕트)
      createBox(3.5, 1.1, 2.0, M.ss(0xc8ccd2), 3.0, Y0 + MH + 0.65, -2.5, grp);
      createBox(2.0, 0.75, 1.5, M.ss(0xbfc4ca), -4.0, Y0 + MH + 0.47, -3.0, grp);
      for (let i = 0; i < 3; i++) {
        createBox(0.6, 0.25, 0.6, M.ss(0xb0b5bc), 2.0 + i * 1.1, Y0 + MH + 0.27, -3.5, grp);
      }

      // ════════════════════════════════════════════════
      //  3. 입구 로비 윙 (Curved Entrance Wing)
      //  사진 특징: 타워보다 넓게 펼쳐지는 곡선 지붕 + 브론즈 기둥
      // ════════════════════════════════════════════════
      const LW  = MW + 10;         // 로비 윙 폭 (타워보다 넓음)
      const LH  = 5.2;             // 로비 높이 (~1.5층)
      const LD  = 6.5;             // 로비 전방 돌출 깊이
      const LMZ = FZ + LD / 2;     // 로비 중심 Z
      const LFZ = FZ + LD;         // 로비 전면 Z

      // 로비 후면벽 (타워 전면에 연결)
      createBox(LW, LH, 0.25, panelW, 0, Y0 + LH / 2, FZ + 0.12, grp);
      // 로비 측벽
      createBox(0.25, LH, LD, panelW, -LW / 2, Y0 + LH / 2, LMZ, grp);
      createBox(0.25, LH, LD, panelW,  LW / 2, Y0 + LH / 2, LMZ, grp);

      // 로비 지붕 메인 슬래브
      createBox(LW + 0.6, 0.3, LD + 0.6, panelW, 0, Y0 + LH + 0.15, LMZ, grp);

      // 곡선 지붕 엣지 — 전면 위로 들림 (사진 웨이브 라인)
      const fe = createBox(LW + 1.4, 0.22, 1.1, panelW, 0, Y0 + LH + 0.52, LFZ + 0.3, grp);
      fe.rotation.x = -0.3;
      // 좌우 날개 들림 엣지
      const leW = createBox(1.1, 0.2, LD + 1.0, panelW, -LW / 2 - 0.35, Y0 + LH + 0.52, LMZ, grp);
      leW.rotation.z = 0.22;
      const reW = createBox(1.1, 0.2, LD + 1.0, panelW,  LW / 2 + 0.35, Y0 + LH + 0.52, LMZ, grp);
      reW.rotation.z = -0.22;

      // 로비 전면 유리
      createBox(LW - 3.2, LH - 0.45, 0.06, glassBlue, 0, Y0 + (LH - 0.45) / 2 + 0.22, LFZ + 0.03, grp);
      // 수평 유리 분할 레일
      for (let r = 0; r < 3; r++) {
        createBox(LW - 3.2, 0.08, 0.09, mulliMat, 0, Y0 + 1.0 + r * 1.4, LFZ + 0.06, grp);
      }

      // ── 브론즈 원형 기둥 8개 (로비 정면) ──
      const numP = 8;
      const pillarSpan = LW - 2.5;
      for (let p = 0; p < numP; p++) {
        const px = -pillarSpan / 2 + p * pillarSpan / (numP - 1);
        createCylinder(0.26, 0.26, LH, colMat, px, Y0 + LH / 2, LFZ, grp);
        createBox(0.60, 0.09, 0.60, M.ss(0x8a8e94), px, Y0 + 0.045, LFZ, grp);   // 베이스 플레이트
        createBox(0.55, 0.07, 0.55, M.ss(0x9a9ea4), px, Y0 + LH - 0.03, LFZ, grp); // 캐피탈
      }

      // 중앙 정문 캐노피 (돌출 차양)
      createBox(5.5, 0.18, 2.8, panelW, 0, Y0 + LH + 0.1, LFZ + 1.3, grp);
      // 캐노피 지지 슬림 기둥 2개
      createCylinder(0.07, 0.07, LH - 0.28, M.ss(0xcdd2d8), -2.0, Y0 + (LH - 0.28) / 2 + 0.14, LFZ + 2.6, grp);
      createCylinder(0.07, 0.07, LH - 0.28, M.ss(0xcdd2d8),  2.0, Y0 + (LH - 0.28) / 2 + 0.14, LFZ + 2.6, grp);

      // ════════════════════════════════════════════════
      //  4. 부지 (Site)
      // ════════════════════════════════════════════════
      // Z-fighting 방지: 글로벌 ground top(Y0+0.05)보다 명확히 위로 띄움
      // 전면 콘크리트 포장
      createBox(LW + 14, 0.06, 12, paveConc, 0, Y0 + 0.08, LFZ + 4.5, grp);
      // 주차장 아스팔트
      createBox(LW + 14, 0.05, 9,  parkMat,  0, Y0 + 0.075, LFZ + 11.5, grp);
      // 측면 잔디
      createBox(7, 0.05, LD + 4, grassMat, -LW / 2 - 3.5, Y0 + 0.075, FZ + LD / 2, grp);
      createBox(7, 0.05, LD + 4, grassMat,  LW / 2 + 3.5, Y0 + 0.075, FZ + LD / 2, grp);

      // ── 가로수 ──
      // 로비 정면 가로수
      [-11, -8, -5, 5, 8, 11].forEach(tx => {
        createCylinder(0.10, 0.12, 2.3, trunkMat, tx, Y0 + 1.15, LFZ + 2.5, grp);
        createCylinder(1.25, 0.85, 2.6, leafMat,  tx, Y0 + 3.15, LFZ + 2.5, grp);
      });
      // 측면 가로수
      [-LW / 2 - 1, LW / 2 + 1].forEach(tx => {
        [2, 6, 10].forEach(tz => {
          createCylinder(0.09, 0.11, 2.0, trunkMat, tx, Y0 + 1.0, FZ + tz, grp);
          createCylinder(1.10, 0.70, 2.2, leafMat,  tx, Y0 + 2.9, FZ + tz, grp);
        });
      });

      grp.userData = { type: 'bg-koelsa' };
      parent.add(grp);
    }

    const BG_SKY = 0x5a8cd9;
    const BG_GROUND = 'rgba(74,69,63,1)';

    function createBgGradientTexture(w, h, drawFn) {
      const cvs = document.createElement('canvas');
      cvs.width = w;
      cvs.height = h;
      const ctx = cvs.getContext('2d');
      drawFn(ctx, w, h);
      return new THREE.CanvasTexture(cvs);
    }

    function createSoftPhotoTexture(img) {
      const targetW = 1024;
      const scale = Math.min(1, targetW / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cvs = document.createElement('canvas');
      cvs.width = w;
      cvs.height = h;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;
      const dim = 0.8;
      for (let i = 0; i < px.length; i += 4) {
        px[i] *= dim;
        px[i + 1] *= dim;
        px[i + 2] *= dim;
      }
      ctx.putImageData(data, 0, 0);

      const tex = new THREE.CanvasTexture(cvs);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

    function addPhotoSidePanel(parent, path, side, bgZ, onLoaded, onError) {
      new THREE.TextureLoader().load(path, (tex) => {
        const softTex = createSoftPhotoTexture(tex.image);
        softTex.wrapS = THREE.ClampToEdgeWrapping;
        softTex.wrapT = THREE.ClampToEdgeWrapping;
        softTex.repeat.set(1, 0.58);
        softTex.offset.set(0, 0.42);

        const viewH = 52;
        const aspect = tex.image.width / tex.image.height;
        const viewW = Math.max(viewH * aspect, 62);
        const x = side === 'left' ? -viewW * 0.36 : viewW * 0.36;
        const bgY = Y0 + TOTAL_H * 0.55 + viewH * 0.22;

        const panel = new THREE.Mesh(
          new THREE.PlaneGeometry(viewW, viewH),
          new THREE.MeshBasicMaterial({
            map: softTex,
            fog: false,
            depthWrite: false,
            side: THREE.DoubleSide
          })
        );
        panel.position.set(x, bgY, bgZ);
        panel.renderOrder = -10;
        panel.userData = { type: side === 'left' ? 'bg-koelsa2-photo' : 'bg-koelsa-photo' };
        parent.add(panel);

        if (onLoaded) onLoaded();
      }, undefined, (err) => {
        console.error('Background photo load error:', path, err);
        if (onError) onError(err);
      });
    }

    function buildSplitPhotoBackdrop(parent, bg3dGrp) {
      let loaded = 0;
      let failed = false;
      const tryHide3d = () => {
        loaded++;
        if (loaded >= 2 && !failed && bg3dGrp) bg3dGrp.visible = false;
      };
      const onFail = () => {
        failed = true;
        if (bg3dGrp) bg3dGrp.visible = true;
        scene.background = new THREE.Color(0x5a8cd9);
        scene.fog = new THREE.FogExp2(0x5a8cd9, 0.015);
      };

      const bgZ = -36;
      addPhotoSidePanel(parent, 'assets/bg/koelsa2.png', 'left', bgZ, tryHide3d, onFail);
      addPhotoSidePanel(parent, 'assets/bg/koelsa.png', 'right', bgZ, tryHide3d, onFail);
    }

    function buildGrassPatch(parent, cx, cz, w, d) {
      const patch = new THREE.Group();
      patch.userData = { type: 'grass-patch' };
      const grassA = M.paint(0x426838);
      const grassB = M.paint(0x385430);

      createBox(w, 0.03, d, M.paint(0x3a5c30), cx, Y0 + 0.045, cz, patch);

      const count = Math.min(2200, Math.floor(w * d * 0.14));
      for (let i = 0; i < count; i++) {
        const lx = (Math.random() - 0.5) * w * 0.94;
        const lz = (Math.random() - 0.5) * d * 0.94;
        const h = 0.14 + Math.random() * 0.32;
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, h, 0.035),
          Math.random() > 0.45 ? grassA : grassB
        );
        blade.position.set(cx + lx, Y0 + 0.06 + h / 2, cz + lz);
        blade.rotation.y = Math.random() * Math.PI;
        blade.rotation.x = (Math.random() - 0.5) * 0.25;
        blade.rotation.z = (Math.random() - 0.5) * 0.15;
        blade.userData = { type: 'grass-blade' };
        patch.add(blade);
      }
      parent.add(patch);
    }

    function buildOutdoorGround(parent) {
      const g = new THREE.Group();
      g.name = 'outdoorGround';
      g.userData = { type: 'outdoor-ground' };

      const span = 280;
      createBox(span, 0.25, span, M.conc(0x3d3a36), 0, Y0 - 0.125, 0, g);
      createBox(span, 0.05, span, M.paint(0x3c4147), 0, Y0 + 0.025, 0, g);

      buildGrassPatch(g, -58, 0, 95, span * 0.88);
      buildGrassPatch(g, 58, 0, 95, span * 0.88);
      buildGrassPatch(g, 0, -55, span * 0.55, 45);

      createBox(S.SHAFT_W + S.WALL_T * 2 + 2.4, 0.03, 3.2, M.ss(0x787c82), 0, Y0 + 0.04, S.SHAFT_D / 2 + 2.2, g);

      parent.add(g);
    }

    function buildBackground() {
      if (typeof USE_PHOTO_BG_PREVIEW !== 'undefined' && USE_PHOTO_BG_PREVIEW) {
        scene.background = new THREE.Color(BG_SKY);
        scene.fog = new THREE.FogExp2(BG_SKY, 0.005);
      }

      buildOutdoorGround(scene);

      const bgGrp = new THREE.Group();
      bgGrp.name = 'outdoorBackground';

      const bg3dGrp = new THREE.Group();
      bg3dGrp.name = 'bg3d';
      if (!(typeof USE_PHOTO_BG_PREVIEW !== 'undefined' && USE_PHOTO_BG_PREVIEW)) {
        buildMountainRange(bg3dGrp);
      }
      buildKoelsaTowerCampus(bg3dGrp);
      buildKoelsaHQ(bg3dGrp);
      bgGrp.add(bg3dGrp);

      if (typeof USE_PHOTO_BG_PREVIEW !== 'undefined' && USE_PHOTO_BG_PREVIEW) {
        buildSplitPhotoBackdrop(bgGrp, bg3dGrp);
      }

      scene.add(bgGrp);
    }

    function buildFrontWallAndLobby() {
      if (wallGrp) scene.remove(wallGrp);
      wallGrp = new THREE.Group();
      const wallMat = M.conc(0x787d82);
      const wallZ = S.SHAFT_D / 2 + S.WALL_T / 2;
      const doorHoleW = S.DOOR_W + 0.1;
      const totalWallW = S.SHAFT_W + S.WALL_T * 2;
      const sideW = (totalWallW - doorHoleW) / 2;

      for (let i = 0; i < FLOORS; i++) {
        const fy = FLOOR_Y[i];
        const fh = (i === 0) ? 4.0 : (i === 1 ? 3.65 : 3.7);

        // 좌우 벽체
        createBox(sideW, fh, S.WALL_T, wallMat, -doorHoleW / 2 - sideW / 2, fy + fh / 2, wallZ, wallGrp);
        createBox(sideW, fh, S.WALL_T, wallMat, doorHoleW / 2 + sideW / 2, fy + fh / 2, wallZ, wallGrp);

        // 상부 마감벽 틈새 완벽 차단 (도어+문틀+막판 높이 계산)
        const transomTopY = 2.56;
        const topH = fh - transomTopY;
        createBox(doorHoleW, topH, S.WALL_T, wallMat, 0, fy + transomTopY + topH / 2, wallZ, wallGrp);

        // 로비 대리석 바닥
        createBox(totalWallW, 0.12, 1.5, M.ss(0x686e74), 0, fy - 0.06, wallZ + S.WALL_T / 2 + 0.75, wallGrp);

        // 천장 Y 좌표 (해당 층 바닥 + 층고)
        const ceilingY = fy + fh;

        // 4층(최상층) 천장 캐노피 슬래브 추가
        if (i === FLOORS - 1) {
          createBox(totalWallW, 0.12, 1.5, M.conc(0xaeb3b9), 0, ceilingY + 0.06, wallZ + S.WALL_T / 2 + 0.75, wallGrp);
        }

        // 전 층 승강장 앞 LED 다운라이트 (천장에 부착)
        const ledMat = M.emit(0xfffbe8, 2.0);
        const ledCasing = M.ss(0xffffff);
        const lightZ = wallZ + S.WALL_T / 2 + 0.6;
        const lightY = ceilingY - 0.12; // 윗층 바닥/캐노피 하단면
        createCylinder(0.12, 0.12, 0.02, ledCasing, 0, lightY - 0.01, lightZ, wallGrp);
        createCylinder(0.09, 0.09, 0.025, ledMat, 0, lightY - 0.012, lightZ, wallGrp);

        // 실버 홀버튼 및 점자 블록
        const btnBoxX = doorHoleW / 2 + 0.25;
        createBox(0.1, 0.28, 0.02, M.ss(0xd8e0e8), btnBoxX, fy + 1.2, wallZ + S.WALL_T / 2 + 0.01, wallGrp);
        const btnUp = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 16), M.emit(0xffffff, 0.8));
        btnUp.rotation.x = Math.PI / 2; btnUp.position.set(btnBoxX, fy + 1.25, wallZ + S.WALL_T / 2 + 0.02); wallGrp.add(btnUp);
        const btnDn = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 16), M.emit(0xffffff, 0.8));
        btnDn.rotation.x = Math.PI / 2; btnDn.position.set(btnBoxX, fy + 1.15, wallZ + S.WALL_T / 2 + 0.02); wallGrp.add(btnDn);
        createBox(0.3, 0.005, 0.3, M.tactile(), btnBoxX, fy + 0.0025, wallZ + S.WALL_T / 2 + 0.3, wallGrp);
      }

      // 피트 전면벽 추가
      createBox(totalWallW, PIT, S.WALL_T, wallMat, 0, Y0 + PIT / 2, wallZ, wallGrp);

      // [수정] 좌측 벽면 생성 및 로비 바닥 색상 적용
      const sideWallD = S.SHAFT_D + S.WALL_T;
      const sideWallH = TOTAL_H + 2.2;
      const sideWallX = -(S.SHAFT_W / 2 + S.WALL_T / 2);

      createBox(S.WALL_T, sideWallH, sideWallD, wallMat, sideWallX, Y0 + sideWallH / 2, S.WALL_T / 2, wallGrp);

      // --- 세로형 지사 로고 현판 (assets/bg/logo.png) ---
      const logoTex = new THREE.TextureLoader().load('assets/bg/logo.png',
        undefined,
        undefined,
        (err) => {
          alert("⚠️ [오류] logo.png 파일을 불러올 수 없습니다!\n\n1. simmul/assets/bg/ 폴더 안에 'logo.png'가 있는지 확인하세요.\n2. Live Server로 index.html을 열어주세요.");
          console.error("Texture Load Error:", err);
        }
      );
      logoTex.encoding = THREE.sRGBEncoding;
      const logoMat = new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, side: THREE.DoubleSide });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 8.8), logoMat);
      sign.rotation.y = -Math.PI / 2;
      sign.position.set(sideWallX - 0.15, Y0 + 7.8, S.WALL_T / 2);
      sign.userData = { type: 'branch-logo' };
      scene.add(sign);

      scene.add(wallGrp);
    }

    function buildGuideRails() {
      railGrp = new THREE.Group();
      const rMat = M.ss(0x4a5a6a);

      const chH = 0.1;
      const baseMat = M.paint(0x374151);
      // 카 레일 지지 채널
      createBox(S.CAR_BG + 0.3, chH, 0.2, baseMat, 0, Y0 + chH / 2, 0.04, railGrp);
      // 균형추 레일 지지 채널
      createBox(S.CWT_W + 0.3, chH, 0.2, baseMat, 0, Y0 + chH / 2, CWT_CENTER_Z, railGrp);

      const rh = TOTAL_H - 0.1 - chH;
      const rY = Y0 + chH + rh / 2;

      function drawRail(px, pz, isCwt, rotY) {
        const g = new THREE.Group();
        g.add(createBox(isCwt ? 0.03 : 0.034, rh, isCwt ? 0.07 : 0.082, rMat, 0, 0, 0, g)); // web
        g.add(createBox(isCwt ? 0.1 : 0.118, rh, 0.014, rMat, 0, 0, isCwt ? 0.041 : 0.048, g)); // flange
        g.position.set(px, rY, pz);
        g.rotation.y = rotY;
        return g;
      }

      // [수정] 카 측 레일 방향 90도 회전 (웹이 안쪽을 바라보도록)
      // 좌측 레일(-Math.PI / 2): 웹이 +X 방향을 향함
      railGrp.add(drawRail(-S.CAR_BG / 2, 0.04, false, -Math.PI / 2));
      // 우측 레일(Math.PI / 2): 웹이 -X 방향을 향함
      railGrp.add(drawRail(S.CAR_BG / 2, 0.04, false, Math.PI / 2));

      // 균형추 측 레일 (후면, 마주보게 회전)
      railGrp.add(
        drawRail(-S.CWT_W / 2, CWT_CENTER_Z, true, -Math.PI / 2),
        drawRail(S.CWT_W / 2, CWT_CENTER_Z, true, Math.PI / 2)
      );

      scene.add(railGrp);
    }

    function buildShaftLandingDevices() {
      const landingDeviceGrp = new THREE.Group();
      // 레일 좌표 기준 (buildGuideRails 동일)
      const rightRailX = S.CAR_BG / 2;   // +0.975
      const railZ      = 0.04;            // 레일 중심 Z
      const sensorZ    = 0.10;            // 센서/베인 Z — 나중에 카 차폐판 Z와 맞춤
      const bracketMat = M.ss(0x5a6575);

      landingDevices.length = 0;

      for (let fIdx = 0; fIdx < FLOORS; fIdx++) {
        const triggerY = FLOOR_Y[fIdx];
        const deviceY  = triggerY + S.CAR_H / 2; // 카 정위치 시 차폐판 중심 Y

        /* ────────────────────────────────────────────
           우측 레일: ㄱ자 브라켓 + ㄷ자 Landing Switch
           브라켓 arm1: 레일 외면(X) → +X방향 (카 경로 밖으로)
           브라켓 arm2: arm1 끝 → +Z방향 (railZ→sensorZ 꺾임)
           센서 ㄷ: 개구부가 카(-X 방향)를 바라봄, Y갭에 차폐판 수직 진입
        ──────────────────────────────────────────── */
        const rOuterX  = rightRailX + 0.017; // 레일 웹 우측 외면
        const rSensorX = rightRailX + 0.18;  // 센서 감지점 X (카 외벽 대비 +24cm clearance)

        // arm1 (X방향)
        const arm1L    = rSensorX - rOuterX;
        const arm1mesh = createBox(arm1L, 0.035, 0.035, bracketMat,
          rOuterX + arm1L / 2, deviceY, railZ, landingDeviceGrp);
        arm1mesh.userData = { type: 'bracket', floor: fIdx, side: 'right', arm: 1 };

        // arm2 (Z방향 꺾임)
        const arm2L    = sensorZ - railZ;
        const arm2mesh = createBox(0.035, 0.035, arm2L, bracketMat,
          rSensorX, deviceY, railZ + arm2L / 2, landingDeviceGrp);
        arm2mesh.userData = { type: 'bracket', floor: fIdx, side: 'right', arm: 2 };

        // ㄷ자 센서 블록 — 개구부(-X)가 카를 정면으로 바라봄
        const sg      = new THREE.Group();
        const sMat    = DEBUG_SENSOR ? M.emit(0x00ff44, 1.6) : M.paint(0x5c3a1e); // 갈색
        const aLen    = 0.08;   // 암 길이 (X방향, 카 쪽으로 뻗음)
        const gHalf   = 0.065;  // 갭 반경 (Y방향, 차폐판 두께 12mm 여유 충분)
        const aThick  = 0.014;  // 암 두께
        const sDepth  = 0.06;   // 센서 Z방향 깊이
        // 뒷판: +X쪽 (카 반대방향 끝)
        createBox(aThick, gHalf * 2 + aThick * 2, sDepth, sMat,
          aLen + aThick / 2, 0, 0, sg);
        // 상부 암
        createBox(aLen, aThick, sDepth, sMat,  aLen / 2,  gHalf + aThick / 2, 0, sg);
        // 하부 암
        createBox(aLen, aThick, sDepth, sMat,  aLen / 2, -gHalf - aThick / 2, 0, sg);
        sg.userData = { type: 'landing-switch', floor: fIdx, side: 'right' };
        sg.position.set(rSensorX, deviceY, sensorZ);
        landingDeviceGrp.add(sg);

        if (DEBUG_SENSOR) {
          landingDeviceGrp.add(new THREE.BoxHelper(sg, 0x00ff44));
          const axes = new THREE.AxesHelper(0.1); // 감지 방향 시각화
          axes.position.set(rSensorX, deviceY, sensorZ);
          landingDeviceGrp.add(axes);
        }

        landingDevices.push({ floor: fIdx, type: 'landing', mesh: sg, triggerY: triggerY });

      }

      railGrp.add(landingDeviceGrp);
    }

    /* ==========================================================================
       buildLimitSwitches — 안전용 물리 리미트 스위치 뭉치 (디자인 업그레이드)
       위치: 승강로 좌측 레일 최상단·최하단
       구성: 감속(Slowdown) → 리미트(Limit) → 파이널(Final) 3종 × 2개소
       ========================================================================== */
    function buildLimitSwitches() {
      const limGrp    = new THREE.Group();
      const leftRailX = -S.CAR_BG / 2;         // -0.975
      const lOuterX   = leftRailX - 0.017;      // -0.992
      const lSwitchX  = leftRailX - 0.18;       // -1.155 (스위치 본체 X)
      const railZ     = 0.04;
      const sensorZ   = 0.10;
      const bktMat    = M.ss(0x5a6575);
      const swSp      = 0.22;                   // 스위치 수직 간격 220mm
      const camH      = S.CAR_H * 0.85;

      // 사진 기반 디자인 제원
      const rLocX     = 0.075;    // 본체 중심에서 롤러까지 X 거리 (카 방향)
      const rLocYBase = 0.04;     // 롤러 암의 Y축 상승/하강 폭
      const bodyMat   = M.ss(0x7a8494); // 회색 금속 본체
      const armMat    = M.ss(0x9ca3af);
      const boltMat   = M.ss(0xb8c0cc);
      const rollerR   = 0.015;
      const rollerThk = 0.012;

      // 상/하부 종단 정위치 시 캠의 타격 면 모서리 Y 좌표 산출
      // 하부: 캠 하단 모서리 / 상부: 캠 상단 모서리
      [
        { dir:  1, label: 'top',    edgeY: FLOOR_Y[FLOORS - 1] + S.CAR_H / 2 + camH / 2 },
        { dir: -1, label: 'bottom', edgeY: FLOOR_Y[0] + S.CAR_H / 2 - camH / 2 },
      ].forEach(({ dir, label, edgeY }) => {

        // 사진 구조 반영: 상부는 암이 위로 뻗고, 하부는 암이 아래로 뻗음
        const rLocY = rLocYBase * dir;

        // ★ 역산: 리미트(중앙) 롤러 중심 World Y = edgeY → swY + rLocY = edgeY, swY=cy
        const cy = edgeY - rLocY;

        // ── ㄱ자 마운팅 브라켓 2쌍 (상/하 ±0.30m) ──────────────────────────
        const arm1L = lOuterX - lSwitchX;
        const arm2L = sensorZ - railZ;
        [-0.30, 0.30].forEach(yOff => {
          createBox(arm1L, 0.025, 0.025, bktMat,
            lSwitchX + arm1L / 2, cy + yOff, railZ, limGrp)
            .userData = { type: 'limit-bracket', floor: label };
          createBox(0.025, 0.025, arm2L, bktMat,
            lSwitchX, cy + yOff, railZ + arm2L / 2, limGrp)
            .userData = { type: 'limit-bracket', floor: label };
        });

        // ── 수직 마운팅 레일 ────────────────────────────────────────────────
        createBox(0.025, 0.70, 0.025, bktMat, lSwitchX, cy, sensorZ, limGrp)
          .userData = { type: 'limit-mount-rail', floor: label };

        // ── 스위치 3개 (dir=+1: 아래→위 감속·리미트·파이널) ───────────────
        [
          { yOff: -dir * swSp, func: 'slowdown',    col: 0xff8800 },
          { yOff: 0,           func: 'limit',        col: 0xff2200 },
          { yOff:  dir * swSp, func: 'final-limit',  col: 0xaa0000 },
        ].forEach(sw => {
          const swY = cy + sw.yOff;
          const sg  = new THREE.Group();

          // ① 본체: 회색 금속 하우징
          createBox(0.042, 0.092, 0.052, bodyMat, 0, 0, 0, sg)
            .userData = { type: 'switch-body' };

          // 전면 커버 볼트 4개 (+X 면 모서리 근처)
          const bx = 0.022, by = 0.034, bz = 0.020;
          [[bx, by, bz], [bx, by, -bz], [bx, -by, bz], [bx, -by, -bz]].forEach(p => {
            const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 6), boltMat);
            bolt.position.set(p[0], p[1], p[2]);
            bolt.userData = { type: 'cover-bolt' };
            sg.add(bolt);
          });

          // 역할 표시 버튼 (전면 하단)
          const btn = new THREE.Mesh(
            new THREE.CylinderGeometry(0.006, 0.006, 0.011, 10), M.paint(sw.col));
          btn.rotation.z = Math.PI / 2;
          btn.position.set(0.023, -0.040, 0);
          btn.userData = { type: 'indicator-button', function: sw.func };
          sg.add(btn);

          // ② 대각선 롤러 암 (피봇 → 롤러 방향, 상·하 대칭)
          const pivotX = 0.018;
          const pivotY = 0.006 * dir;
          const dx     = rLocX - pivotX;
          const dy     = rLocY - pivotY;
          const armLen = Math.max(0.04, Math.hypot(dx, dy) - rollerR);
          const ang    = Math.atan2(dy, dx);
          const arm    = createBox(armLen, 0.006, 0.010, armMat,
            pivotX + Math.cos(ang) * armLen * 0.5,
            pivotY + Math.sin(ang) * armLen * 0.5,
            0, sg);
          arm.rotation.z = ang;
          arm.userData = { type: 'roller-arm-diagonal' };

          // ③ 검은 우레탄 롤러 (Z축 관통 — 카 상·하 이동 시 회전)
          const roller = new THREE.Mesh(
            new THREE.CylinderGeometry(rollerR, rollerR, rollerThk, 16), M.paint(0x151515));
          roller.rotation.x = Math.PI / 2;
          roller.position.set(rLocX, rLocY, 0);
          roller.userData = { type: 'roller', function: sw.func };
          sg.add(roller);

          const axle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.003, 0.003, rollerThk + 0.004, 8), M.ss(0x9ca3af));
          axle.rotation.x = Math.PI / 2;
          axle.position.set(rLocX, rLocY, 0);
          axle.userData = { type: 'roller-axle' };
          sg.add(axle);

          sg.userData = { type: 'limit-switch', floor: label, function: sw.func };
          sg.position.set(lSwitchX, swY, sensorZ);
          limGrp.add(sg);

          const rollerWorldX = lSwitchX + rLocX;
          const rollerWorldY = swY + rLocY;

          if (DEBUG_SENSOR) {
            limGrp.add(new THREE.BoxHelper(sg, sw.col));
            const rSph = new THREE.Mesh(
              new THREE.SphereGeometry(0.007, 8, 6),
              new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true }));
            rSph.position.set(rollerWorldX, rollerWorldY, sensorZ);
            limGrp.add(rSph);
            const rAx = new THREE.AxesHelper(0.1);
            rAx.position.set(rollerWorldX, rollerWorldY, sensorZ);
            limGrp.add(rAx);
          }

          landingDevices.push({ floor: label, type: sw.func, mesh: sg, triggerY: swY });
        });
      });

      railGrp.add(limGrp);
    }

    function buildMachineRoom() {
      mrGrp = new THREE.Group();
      const my = Y0 + TOTAL_H;

      // 기계실 바닥 (초록색 계열로 변경)
      createBox(S.SHAFT_W + 0.4, 0.25, S.SHAFT_D + 0.4, M.conc(), 0, my - 0.12, 0, mrGrp);
      createBox(S.SHAFT_W + 0.2, 0.02, S.SHAFT_D + 0.2, M.paint(0x2e7d32), 0, my + 0.01, 0, mrGrp); // 진한 초록색 (우레탄 도장 느낌)

      /* 4. 제어반(Control Panel) 및 덕트 (좌측 벽면에 밀착, 전면부로 이동) */
      const cpMat = M.paint(0xd1d5db); // 밝은 회색 (본체)
      const doorMat = M.paint(0x4b5563); // 짙은 쑥색/회색 (문)
      const baseMat = M.paint(0x374151); // 어두운 회색 (하부 받침대)
      const topMat = M.paint(0x9ca3af); // 짙은 회색 (상단 환기 박스)
      
      // 좌측 벽면(-(S.SHAFT_W/2))에 붙임. 전면부 방향으로 이동(0.8m)
      const panelX = -(S.SHAFT_W / 2) + 0.15; 
      const panelZ = 0.8; // 전면부(앞벽 쪽)
      
      // 하부 받침대 (Plinth)
      createBox(0.3, 0.1, 0.6, baseMat, panelX, my + 0.06, panelZ, mrGrp);
      // 메인 캐비닛 본체
      createBox(0.3, 1.3, 0.6, cpMat, panelX, my + 0.76, panelZ, mrGrp);
      // 상단 환기 박스
      createBox(0.25, 0.2, 0.55, topMat, panelX, my + 1.51, panelZ, mrGrp);
      // 상단 환기구 슬릿(Slit) 디테일
      for (let i = 0; i < 4; i++) {
        createBox(0.01, 0.02, 0.4, M.paint(0x111111), panelX + 0.125, my + 1.45 + i * 0.04, panelZ, mrGrp);
      }

      // 양개형 문 (+X 즉 중앙을 바라보게)
      createBox(0.02, 1.25, 0.28, doorMat, panelX + 0.16, my + 0.76, panelZ - 0.145, mrGrp); // 좌측 문
      createBox(0.02, 1.25, 0.28, doorMat, panelX + 0.16, my + 0.76, panelZ + 0.145, mrGrp); // 우측 문
      // 손잡이
      createBox(0.02, 0.1, 0.01, M.paint(0x111111), panelX + 0.17, my + 0.76, panelZ - 0.02, mrGrp);
      createBox(0.02, 0.1, 0.01, M.paint(0x111111), panelX + 0.17, my + 0.76, panelZ + 0.02, mrGrp);

      // 제어반 덕트 (하부 빔 쪽으로 다시 연결)
      const ductMat = M.paint(0x9ca3af);
      const ductL = Math.abs(-0.4 - (panelX + 0.15)); // 하부빔 시작점(-0.4)까지
      createBox(ductL, 0.1, 0.3, ductMat, panelX + 0.15 + ductL / 2, my + 0.06, 0.45, mrGrp);

      /* ══════════════════════════════════════════════════════════════
         1. 머신 빔 (Machine Beam) + 써포트 빔 (Support Beam)
         PDF 5/31 참고: H형강 I빔 단면 2방향 배치
         ══════════════════════════════════════════════════════════════ */
      const beamMat = M.paint(0x1c2833);
      const beamWH = 0.18, beamFW = 0.15, beamTk = 0.014;
      const lowerY  = my + 0.09;
      const lowerZc = -0.10;
      const lowerL  = 2.05;

      // 주 I-빔 2개 (X=±0.4, Z축 방향)
      [-0.4, 0.4].forEach(bx => {
        createBox(beamTk, beamWH - beamTk * 2, lowerL, beamMat, bx, lowerY, lowerZc, mrGrp);
        createBox(beamFW, beamTk, lowerL, beamMat, bx, lowerY + (beamWH - beamTk) / 2, lowerZc, mrGrp);
        createBox(beamFW, beamTk, lowerL, beamMat, bx, lowerY - (beamWH - beamTk) / 2, lowerZc, mrGrp);
      });

      // 써포트 빔 (Support Beam) 2개 - X축 방향 가로 I-빔
      [0.84, -0.92].forEach(sz => {
        const sLen = 0.96;
        createBox(sLen, beamWH - beamTk * 2, beamTk, beamMat, 0, lowerY, sz, mrGrp);
        createBox(sLen, beamTk, beamFW, beamMat, 0, lowerY + (beamWH - beamTk) / 2, sz, mrGrp);
        createBox(sLen, beamTk, beamFW, beamMat, 0, lowerY - (beamWH - beamTk) / 2, sz, mrGrp);
      });

      // 써포트 앵글 (Support Angle) - ㄱ형강 코너 보강 4개소
      const angleMat = M.paint(0x2c3e50);
      [[-0.4, 0.84], [-0.4, -0.92], [0.4, 0.84], [0.4, -0.92]].forEach(([ax, az]) => {
        createBox(0.016, 0.14, 0.07, angleMat, ax, lowerY + 0.05, az, mrGrp);
        createBox(0.07, 0.016, 0.07, angleMat, ax, lowerY + 0.09, az, mrGrp);
      });

      /* ══════════════════════════════════════════════════════════════
         2. 방진고무 (Shock Absorber)
         PDF 5/31 참고: 원통형 방진고무 + 상하 스틸 플레이트 + 스터드 볼트
         ══════════════════════════════════════════════════════════════ */
      const padMat    = M.paint(0x111111);
      const padStkMat = M.ss(0xd0d0d0);
      const padBaseY  = lowerY + (beamWH - beamTk) / 2 + beamTk;
      const padH      = 0.065;
      const pxs = [-0.4, 0.4], pzs = [-0.78, 0.38];

      pxs.forEach(x => {
        pzs.forEach(z => {
          createBox(0.17, 0.012, 0.17, padStkMat, x, padBaseY + 0.006, z, mrGrp);
          const padBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.054, 0.062, padH, 18), padMat);
          padBody.position.set(x, padBaseY + 0.012 + padH / 2, z);
          mrGrp.add(padBody);
          createCylinder(0.010, 0.010, 0.085, padStkMat, x, padBaseY + 0.012 + padH * 0.55, z, mrGrp);
          createBox(0.15, 0.012, 0.15, padStkMat, x, padBaseY + 0.012 + padH + 0.006, z, mrGrp);
          [[-0.05, -0.05], [-0.05, 0.05], [0.05, -0.05], [0.05, 0.05]].forEach(([bx, bz]) => {
            createCylinder(0.005, 0.005, 0.016, M.ss(0x888888),
              x + bx, padBaseY + 0.012 + padH + 0.012, z + bz, mrGrp);
          });
        });
      });

      const padTopY = padBaseY + 0.012 + padH + 0.012;

      /* ══════════════════════════════════════════════════════════════
         3. 머신 베드 (Machine Bed) - 채널강 직사각형 용접 프레임
         PDF 5/31 참고: 4면 채널빔 직사각형 베드 + 내부 보강재
         ══════════════════════════════════════════════════════════════ */
      const bedMat = M.paint(0x4a5a6a);
      const bedY   = padTopY + 0.004;
      const bedFH  = 0.11, bedFW = 0.09, bedFT = 0.013;
      const bedX1 = -0.44, bedX2 = 0.44;
      const bedZ1 =  0.38, bedZ2 = -0.93;
      const bedXC = (bedX1 + bedX2) / 2;
      const bedZC = (bedZ1 + bedZ2) / 2;
      const bedXL = bedX2 - bedX1;
      const bedZL = bedZ1 - bedZ2;

      // 좌우 세로 채널 빔 (Z축 방향)
      [bedX1 + bedFW / 2, bedX2 - bedFW / 2].forEach(bx => {
        createBox(bedFT, bedFH, bedZL, bedMat, bx, bedY + bedFH / 2, bedZC, mrGrp);
        createBox(bedFW, bedFT, bedZL, bedMat, bx, bedY + bedFH, bedZC, mrGrp);
        createBox(bedFW, bedFT, bedZL, bedMat, bx, bedY, bedZC, mrGrp);
      });

      // 전후 가로 채널 빔 (X축 방향)
      [bedZ1 - bedFW / 2, bedZ2 + bedFW / 2].forEach(bz => {
        createBox(bedXL, bedFH, bedFT, bedMat, bedXC, bedY + bedFH / 2, bz, mrGrp);
        createBox(bedXL, bedFT, bedFW, bedMat, bedXC, bedY + bedFH, bz, mrGrp);
        createBox(bedXL, bedFT, bedFW, bedMat, bedXC, bedY, bz, mrGrp);
      });

      // 중간 내부 보강재 2개
      [-0.28, 0.08].forEach(bz => {
        createBox(bedXL - 0.10, 0.07, bedFT, bedMat, bedXC, bedY + 0.035, bz, mrGrp);
      });

      // 대각 보강재 (베드 내부 X자 가새)
      const diagA = createBox(0.68, 0.038, 0.038, bedMat, bedXC - 0.11, bedY + 0.055, -0.10, mrGrp);
      diagA.rotation.y = 0.44;
      const diagB = createBox(0.68, 0.038, 0.038, bedMat, bedXC + 0.11, bedY + 0.055, -0.10, mrGrp);
      diagB.rotation.y = -0.44;

      /* ══════════════════════════════════════════════════════════════
         4. 디플렉터 시브 (Deflector Sheave) - 보조 도르래
         PDF 5/31 참고: 6스포크 주조 휠, 5개 V-홈, 림 플랜지
         ══════════════════════════════════════════════════════════════ */
      const defRadius = 0.18;
      const defY = bedY + bedFH + 0.04;
      const defMat = M.paint(0xd8dde0);
      const defGrp = new THREE.Group();

      const defDrum = new THREE.Mesh(
        new THREE.CylinderGeometry(defRadius, defRadius, 0.13, 36), defMat);
      defDrum.rotation.x = Math.PI / 2;
      defGrp.add(defDrum);

      for (let i = 0; i < 5; i++) {
        const gx = -0.04 + i * 0.02;
        const defGrv = new THREE.Mesh(
          new THREE.TorusGeometry(defRadius + 0.002, 0.006, 10, 36), M.paint(0x111111));
        defGrv.position.set(0, 0, gx);
        defGrp.add(defGrv);
      }

      const defHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.15, 18), M.ss(0x8a9298));
      defHub.rotation.x = Math.PI / 2;
      defGrp.add(defHub);

      for (let i = 0; i < 6; i++) {
        const defSpk = createBox(defRadius * 1.7 - 0.04, 0.030, 0.030, defMat, 0, 0, 0, defGrp);
        defSpk.rotation.z = i * Math.PI / 3;
      }

      [-0.058, 0.058].forEach(dx => {
        const defRimF = new THREE.Mesh(
          new THREE.TorusGeometry(defRadius - 0.012, 0.013, 10, 36), M.ss(0xb0b8c0));
        defRimF.position.set(0, 0, dx);
        defGrp.add(defRimF);
      });

      defGrp.rotation.y = Math.PI / 2;
      defGrp.position.set(0, defY, CWT_CENTER_Z);
      mrGrp.add(defGrp);

      // 디플렉터 시브 축 & 베어링 하우징
      const defAxle = createCylinder(0.022, 0.022, 0.72, M.ss(0xb8bcc4), 0, defY, CWT_CENTER_Z, mrGrp);
      defAxle.rotation.z = Math.PI / 2;
      [-0.27, 0.27].forEach(dx => {
        createCylinder(0.042, 0.042, 0.055, M.ss(0x9ca3af), dx, defY, CWT_CENTER_Z, mrGrp);
      });

      // 베어링 하우징 아래 pillow-block 받침 (체대 상면 → defY)
      const bedTopY = bedY + bedFH;
      const pillowH = defY - bedTopY;
      const pillowMat = M.ss(0x9ca3af);
      [-0.27, 0.27].forEach(dx => {
        createBox(0.07, pillowH, 0.07, pillowMat, dx, bedTopY + pillowH / 2, CWT_CENTER_Z, mrGrp);
      });

      /* ⑤ 개방 레버 + ⑥ 수동 핸들 — 제어반 반대편(-Z) 좌측벽, 같은 높이·걸쇠 각각 (PDF 4·6p) */
      const wallInnerX = -(S.SHAFT_W / 2 + S.WALL_T / 2) + S.WALL_T / 2 + 0.01;
      const hookY = my + 0.92;
      const hookShiftZ = -0.30;
      const levHookZ = panelZ - 0.52 + hookShiftZ;
      const hndHookZ = panelZ - 0.34 + hookShiftZ;
      const hookMat = M.paint(0x333333);
      const hookSteel = M.ss(0x777777);
      const levMat = M.ss(0xa8b0b8);
      const hndMat = M.ss(0x9ca3af);
      const pegX = wallInnerX + 0.045;

      function addWallHook(hy, hz, udType) {
        createBox(0.012, 0.075, 0.055, hookMat, wallInnerX, hy, hz, mrGrp);
        createBox(0.055, 0.012, 0.012, hookSteel, pegX, hy + 0.018, hz, mrGrp)
          .userData = { type: udType };
      }

      addWallHook(hookY, levHookZ, 'release-lever-hook');
      addWallHook(hookY, hndHookZ, 'turning-handle-hook');

      // ⑤ Release Lever — 긴 로드 + 끝의 묵직한 U자(포크) 헤드 (PDF 4p ⑥)
      // 현실 거치: 로드 상단 고리를 수평 걸쇠에 걸어 수직으로 내려오고, 포크 헤드가 맨 아래.
      const relLevGrp = new THREE.Group();
      relLevGrp.userData = { type: 'release-lever' };

      // 상단 걸이 고리 — 보어 축을 X로 두어 수평 걸쇠에 끼움
      const relRing = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 8, 18), levMat);
      relRing.rotation.y = Math.PI / 2;
      relRing.position.set(0, 0.006, 0);
      relLevGrp.add(relRing);

      // 긴 로드 (가늘고 김)
      const rodH = 0.34;
      const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, rodH, 12), levMat);
      rodMesh.position.set(0, -rodH / 2, 0);
      relLevGrp.add(rodMesh);

      // 로드 → 포크 전환 넥 (테이퍼: 가는 로드에서 굵은 헤드로 벌어짐)
      const relNeckY = -rodH - 0.026;
      const relNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.024, 0.052, 14), levMat);
      relNeck.position.set(0, relNeckY, 0);
      relLevGrp.add(relNeck);

      // 묵직한 포크 베이스 (납작한 평판 블록 — U자 윗부분 솔리드)
      const relPlateTh = 0.014;                // 평판 두께(X) — 납작함
      const relBaseY = relNeckY - 0.034;
      createBox(relPlateTh, 0.045, 0.046, levMat, 0, relBaseY, 0, relLevGrp);

      // U자 포크 — 두 갈래(Z축으로 벌어짐). 납작한 평철 두 갈래, 끝단 30° 절곡(ㄷ자 갈고리)으로 브레이크에 끼움
      // 절곡 방향: 벽(-X) 반대편 정면(+X, 체대 쪽)으로 휘어짐
      const relStraightLen = 0.05;             // 곧게 내려오는 부분 (짧게)
      const relTipLen = 0.038;                 // 절곡된 끝단
      const relTineW = 0.016;                  // 갈래 폭(Z)
      const relBend = Math.PI / 6;             // 30° 휘어짐
      const relProngTopY = relBaseY - 0.0225;  // 베이스 블록 하단에서 시작
      const cb = Math.cos(relBend), sb = Math.sin(relBend);
      [-0.014, 0.014].forEach(dz => {
        // 직선부 (납작한 평철)
        createBox(relPlateTh, relStraightLen, relTineW, levMat,
          0, relProngTopY - relStraightLen / 2, dz, relLevGrp);

        // 절곡 끝단 — 직선부 하단을 피벗으로 정면(+X) 방향 30° 절곡
        const pivotY = relProngTopY - relStraightLen;
        const tipSeg = new THREE.Mesh(
          new THREE.BoxGeometry(relPlateTh, relTipLen, relTineW), levMat);
        tipSeg.rotation.z = relBend;
        tipSeg.position.set((relTipLen / 2) * sb, pivotY - (relTipLen / 2) * cb, dz);
        relLevGrp.add(tipSeg);
      });

      relLevGrp.position.set(pegX, hookY + 0.018, levHookZ);
      mrGrp.add(relLevGrp);

      // ⑥ Turning Handle — 콜라(소켓)를 수평 걸쇠에 끼워 수직으로 걸린 크랭크 핸들 (PDF 4p ⑦)
      // 현실 거치: 콜라 보어가 수평 걸쇠(+X축)에 끼워지고, 무거운 크랭크 팔은 중력으로 곧장 아래로 늘어짐.
      // 손잡이(grip)는 팔 끝에서 좌우(Z축)로 뻗어, 벽에 평행하게 레버처럼 보임.
      const turnHndGrp = new THREE.Group();
      turnHndGrp.userData = { type: 'turning-handle' };

      // 콜라(소켓) — 보어 축을 X로 두어 수평 걸쇠에 끼움
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.052, 18), hndMat);
      collar.rotation.z = Math.PI / 2; // 축을 X 방향으로 (걸쇠 방향)
      turnHndGrp.add(collar);
      // 보어 구멍(걸쇠가 들어가는 어두운 안쪽)
      const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.056, 14), M.paint(0x2a2a2a));
      bore.rotation.z = Math.PI / 2;
      turnHndGrp.add(bore);

      // 고정 나사 (콜라 위쪽)
      const hexBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.016, 6), M.ss(0x555555));
      hexBolt.position.set(0, 0.030, 0);
      turnHndGrp.add(hexBolt);

      // 크랭크 팔 — 콜라에서 아래(-Y)로 곧장 늘어짐, 벽과 평행(Y-Z 평면)
      const thArmLen = 0.26;
      createBox(0.014, thArmLen, 0.034, hndMat, 0, -thArmLen / 2 - 0.020, 0, turnHndGrp);
      // 팔-손잡이 연결 허브
      createCylinder(0.020, 0.020, 0.018, hndMat, 0, -thArmLen - 0.010, 0, turnHndGrp)
        .rotation.x = Math.PI / 2;

      // 손잡이(grip) — 팔 끝에서 +Z 한쪽만 (중심 기준 왼쪽 제거)
      const gripLen = 0.10;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, gripLen, 16), M.paint(0x2a2a2a));
      grip.rotation.x = Math.PI / 2;
      grip.position.set(0, -thArmLen - 0.010, gripLen / 2);
      turnHndGrp.add(grip);
      createCylinder(0.016, 0.016, 0.012, hndMat, 0, -thArmLen - 0.010, gripLen + 0.006, turnHndGrp)
        .rotation.x = Math.PI / 2;

      turnHndGrp.position.set(pegX, hookY + 0.018, hndHookZ);
      mrGrp.add(turnHndGrp);

      /* 6. 조속기 받침대 (Governor Stand) */
      // 소장님 지시: 카 가이드 레일과 완벽히 수직선상에 오도록 정렬 & 높이는 절반
      const govStandMat = M.paint(0x1c2833); // 하부 빔과 동일한 짙은 남색 철골
      const govX = GOV_TENS_X; // 피트 인장추·가이드 브라켓과 동일 축 (레일에서 외측 이격)
      const govZ = 0.22; // 피트 인장추 tensBaseZ와 동일 — 조속기 로프 Z 정렬
      const govY = my; // 기계실 바닥면
      
      const govGrp = new THREE.Group();
      govGrp.position.set(govX, govY + 0.05, govZ);
      
      // 하판 (Bottom Plate)
      createBox(0.15, 0.02, 0.4, govStandMat, 0, 0.01, 0, govGrp);
      
      // 기둥 (Pillars) - 기존 0.3에서 0.15로 높이 절반 감소
      const pHeight = 0.15;
      const pillar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, pHeight, 16), govStandMat);
      pillar1.position.set(0, pHeight/2 + 0.02, 0.12);
      govGrp.add(pillar1);
      
      const pillar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, pHeight, 16), govStandMat);
      pillar2.position.set(0, pHeight/2 + 0.02, -0.12);
      govGrp.add(pillar2);
      
      // 상판 (Top Plate)
      createBox(0.15, 0.02, 0.4, govStandMat, 0, pHeight + 0.03, 0, govGrp);
      
      // 디테일: 상판 중앙 관통 구멍 (기둥과 연결되는 느낌) 및 모서리 볼트 구멍
      const holeMat = M.paint(0x050505);
      createCylinder(0.025, 0.025, 0.022, holeMat, 0, pHeight + 0.03, 0.12, govGrp);
      createCylinder(0.025, 0.025, 0.022, holeMat, 0, pHeight + 0.03, -0.12, govGrp);
      
      const boltHoleZ = 0.17;
      const boltHoleX = 0.05;
      createCylinder(0.005, 0.005, 0.022, holeMat, boltHoleX, pHeight + 0.03, boltHoleZ, govGrp);
      createCylinder(0.005, 0.005, 0.022, holeMat, -boltHoleX, pHeight + 0.03, boltHoleZ, govGrp);
      createCylinder(0.005, 0.005, 0.022, holeMat, boltHoleX, pHeight + 0.03, -boltHoleZ, govGrp);
      createCylinder(0.005, 0.005, 0.022, holeMat, -boltHoleX, pHeight + 0.03, -boltHoleZ, govGrp);
      
      mrGrp.add(govGrp);

      /* 7. 조속기 본체 (Overspeed Governor) */
      // 소장님 지시: 올려주신 이미지 그대로 반듯하게 얹기 (Z축 정렬)
      const govYBase = pHeight + 0.04; // 조속기 받침대 상판(0.02) 위
      // 핵심: 시뮬레이터 뷰포인트(우측 앞에서 바라봄) 기준으로
      // 조속기 휠 면(바퀴 정면)이 보이려면 휠 축이 Z방향(앞뒤)이어야 함
      const govBodyGrp = new THREE.Group();
      govBodyGrp.position.set(0, govYBase, 0);
      govBodyGrp.rotation.y = Math.PI / 2; // 소장님 지시: 180도 추가 회전

      const sheetMat = M.ss(0x8898a8);   // 짙은 은회색 철판 (U자형 브라켓)
      const brassMat = M.paint(0xc8930a); // 황동색 - 휠, 레버 암
      const goldMat  = M.paint(0xd4af37); // 금색 - 축, 볼트
      const darkMat2 = M.paint(0x111111); // 검은색 - 스프링

      // ─── 7-1. U자형 브라켓 (휠 윗부분 시원하게 노출) ───
      const bW = 0.38;    // 브라켓 전체 X 폭
      const bD = 0.13;    // 브라켓 앞뒤 깊이 (Z방향)
      const bHbot = 0.17; // 앞뒤 측판 높이 (휠 중심축 바로 아래까지 덮도록 상향)
      const bHtop = 0.22; // 스위치쪽 좌측 측판은 더 높음
      
      // 하판 (바닥)
      createBox(bW, 0.01, bD, sheetMat, 0, 0.005, 0, govBodyGrp);
      // 앞쪽 측면판 (+ Z, 우리를 향하는 면) - 낮게
      createBox(bW, bHbot, 0.01, sheetMat, 0, bHbot/2, bD/2, govBodyGrp);
      // 뒤쪽 측면판 (- Z) - 낮게
      createBox(bW, bHbot, 0.01, sheetMat, 0, bHbot/2, -bD/2, govBodyGrp);
      // 좌측 끝판 (-X) - 스위치박스가 붙는 면, 더 높음
      createBox(0.01, bHtop, bD, sheetMat, -bW/2, bHtop/2, 0, govBodyGrp);
      // 우측 끝판 (+X) - 스프링 쪽, 낮게
      createBox(0.01, bHbot, bD, sheetMat, bW/2, bHbot/2, 0, govBodyGrp);

      // ─── 7-2. 메인 휠 (스포크 타입) ───
      // 휠 중심 위치: 브라켓 중앙 X=0, 브라켓 상단 위로 적당히 노출
      const gR = 0.14;  // 외곽 테두리 반지름
      const gWX = 0;    // X 중심
      const gWY = 0.18; // 브라켓 측판 높이(0.10)보다 높아서 절반 이상 노출됨

      // 외곽 테두리 (Rim) - TorusGeometry
      const govWheelSpinGrp = new THREE.Group();
      govWheelSpinGrp.position.set(gWX, gWY, 0);
      govBodyGrp.add(govWheelSpinGrp);
      governorWheelGrp = govWheelSpinGrp;
      const rimMat = brassMat;
      const rimGeo = new THREE.TorusGeometry(gR, 0.012, 10, 40);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      govWheelSpinGrp.add(rim);

      // 중심 허브 (Hub)
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 16), goldMat);
      hub.rotation.x = Math.PI / 2;
      govWheelSpinGrp.add(hub);

      // 6개 살대 (Spoke) - 중심 → 테두리 방향으로 뻗는 얇은 막대
      for (let i = 0; i < 6; i++) {
        const ang = i * Math.PI / 3;
        const sx = gWX + Math.cos(ang) * gR / 2;
        const sy = gWY + Math.sin(ang) * gR / 2;
        const spoke = new THREE.Mesh(
          new THREE.CylinderGeometry(0.007, 0.007, gR, 8),
          brassMat
        );
        // 살대를 바퀴 평면(XY plane) 위에 방사형으로 배치
        spoke.position.set(sx - gWX, sy - gWY, 0);
        spoke.rotation.z = ang + Math.PI / 2;
        govWheelSpinGrp.add(spoke);
      }

      // 로프 홈 (V홈 - 테두리 위에 검은색 고무홈)
      const grooveGeo = new THREE.TorusGeometry(gR, 0.006, 8, 40);
      const groove = new THREE.Mesh(grooveGeo, M.paint(0x222222));
      govWheelSpinGrp.add(groove);

      // 중심 회전축 (Z축 방향으로 브라켓 앞뒤 관통)
      const axle = createCylinder(0.016, 0.016, bD + 0.04, goldMat, gWX, gWY, 0, govBodyGrp);
      axle.rotation.x = Math.PI / 2;

      // ─── 7-3. 레버 암 & 텐션 스프링 메커니즘 ───
      // 피벗 포인트: 휠 중심 근처 (X = -0.05, 약간 위)
      const pivX = -0.02, pivY = gWY + 0.02;
      // 레버 암 전체 (좌측 -X → 우측 +X 으로 길게, 살짝 대각선)
      const leverLen = 0.34;
      const leverMat = M.ss(0xb8a060); // 황동빛 광택 레버
      const leverArm = new THREE.Mesh(
        new THREE.BoxGeometry(leverLen, 0.018, 0.022), leverMat
      );
      leverArm.position.set(pivX + leverLen/2 * 0.2, pivY, 0); // 중심에서 살짝 우측으로 치우침
      leverArm.rotation.z = -Math.PI / 22; // 우측이 살짝 내려오는 대각선
      govBodyGrp.add(leverArm);

      // 피벗 핀 (레버 지지 지점)
      const govPivPin = createCylinder(0.018, 0.018, bD+0.02, M.ss(0xaaaaaa), pivX, pivY, 0, govBodyGrp);
      govPivPin.rotation.x = Math.PI / 2;

      // 우측 텐션 스프링 어셈블리 (레버 우측 끝에 대각선으로 매달림)
      const spX = bW/2 - 0.02;
      const spTopY = pivY - 0.01;
      const spBotY = spTopY - 0.12;
      // 스프링 마운트 상단 핀
      createCylinder(0.012, 0.012, bD+0.02, goldMat, spX, spTopY, 0, govBodyGrp);
      // 스프링 본체 (Z방향 회전 - 수직)
      const springGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.10, 12);
      const springMesh = new THREE.Mesh(springGeo, darkMat2);
      springMesh.position.set(spX, (spTopY + spBotY)/2, 0);
      govBodyGrp.add(springMesh);
      // 스프링 코일 느낌 (TorusGeometry 3개 겹치기)
      for (let si = 0; si < 4; si++) {
        const coil = new THREE.Mesh(
          new THREE.TorusGeometry(0.014, 0.003, 6, 14),
          darkMat2
        );
        coil.rotation.x = Math.PI / 2;
        coil.position.set(spX, spTopY - 0.018 - si*0.022, 0);
        govBodyGrp.add(coil);
      }
      // 스프링 마운트 하단 브라켓
      createBox(0.04, 0.01, bD, M.ss(0x888888), spX, spBotY, 0, govBodyGrp);
      createCylinder(0.012, 0.012, bD+0.02, goldMat, spX, spBotY, 0, govBodyGrp);

      // ─── 7-4. 안전 스위치 박스 (좌측 외벽에 부착) ───
      const swGrp = new THREE.Group();
      // 좌측(-X) 브라켓 외벽 바깥에 부착
      swGrp.position.set(-bW/2 - 0.025, bHtop/2 + 0.01, 0);
      govBodyGrp.add(swGrp);

      // 스위치 박스 본체 (짙은 갈색/검은색)
      const swBoxMat = M.paint(0x2a1a0a); // 짙은 갈색
      createBox(0.05, 0.09, bD * 0.8, swBoxMat, 0, 0, 0, swGrp);
      // 박스 커버 테두리 (약간 밝은 갈색)
      createBox(0.052, 0.092, bD * 0.82, M.paint(0x3a2a1a), 0.01, 0, 0, swGrp);

      // 빨간색 리셋 레버 - 쐐기(쐐기형 ConeGeometry) 형태
      // 밑면(두꺼운 쪽)이 박스에 붙고, 뾰족한 끝이 휠(+X) 방향을 향함
      const resetLev = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0, 0.018, 0.055, 10), // 끝이 뾰족한 원뿔
        M.paint(0xdd0000)
      );
      // 원뿔 기본 축은 Y → X축 방향(휠 쪽, +X)을 향하도록 Z축 기준 -90도 회전
      resetLev.rotation.z = -Math.PI / 2;
      // 박스 우측면(+X, 브라켓 내부 방향)에 밑면 붙이고 뾰족한 끝이 휠 쪽으로 나옴
      resetLev.position.set(0.04, 0.04, 0);
      swGrp.add(resetLev);

      // 배선 (박스 하단에서 내려감)
      createCylinder(0.004, 0.004, 0.07, M.paint(0x111111),  0.01, -0.08, 0, swGrp);
      createCylinder(0.004, 0.004, 0.07, M.paint(0x0000cc), -0.01, -0.08, 0, swGrp);

      govGrp.add(govBodyGrp);

      const govWheelWorldY = govGrp.position.y + govYBase + gWY;
      mrGrp.userData = {
        defY: defY,
        defZ: CWT_CENTER_Z,
        govX: govX,
        govZ: govZ,
        govWheelY: govWheelWorldY,
        govR: gR
      };
      scene.add(mrGrp);
    }

    function buildPitFoundation() {
      pitGrp = new THREE.Group();
      createBox(S.SHAFT_W + S.WALL_T * 2, 0.2, S.SHAFT_D + S.WALL_T * 2, M.conc(), 0, Y0 - 0.1, 0, pitGrp);
      createBox(S.SHAFT_W - 0.1, 0.02, S.SHAFT_D - 0.1, M.paint(0x4b5563), 0, Y0 + 0.01, 0, pitGrp);
      
      // [추가] 1. 피트 사다리 (승강로 좌측 벽면 안쪽)
      const ladderH = FLOOR_Y[0] + 1.1; 
      const ladderZ = S.SHAFT_D / 2 - 0.3; // 문 쪽에서 약간 안쪽
      const ladderX = -(S.SHAFT_W / 2) + 0.15; // 좌측 벽면에 딱 15cm 이격 (발 디딜 공간)
      const rungCount = Math.floor(ladderH / 0.3); // 30cm 간격
      const lMat = M.paint(0xf1c40f); // 안전 노란색

      const ladderGrp = new THREE.Group();

      // 수직 파이프 2개 (Z축 방향으로 벌어지도록 세팅)
      createCylinder(0.02, 0.02, ladderH, lMat, -0.15, Y0 + ladderH / 2, 0, ladderGrp);
      createCylinder(0.02, 0.02, ladderH, lMat, 0.15, Y0 + ladderH / 2, 0, ladderGrp);
      
      // 가로 발판(Rung)
      for (let i = 1; i <= rungCount; i++) {
        const ry = Y0 + i * 0.3;
        const rung = createCylinder(0.015, 0.015, 0.3, lMat, 0, ry, 0, ladderGrp);
        rung.rotation.z = Math.PI / 2;
      }

      // Y축 기준 90도 회전시켜 좌측 벽면과 완벽히 평행하게 배치
      ladderGrp.position.set(ladderX, 0, ladderZ);
      ladderGrp.rotation.y = Math.PI / 2;
      pitGrp.add(ladderGrp);

      // ─── 조속기 인장추 어셈블리 (Governor Tension Weight Assembly) ───
      // 조속기 휠 축 = Z축 방향(표현 기준) | X는 조속기와 GOV_TENS_X로 정렬
      const tensGovX = GOV_TENS_X;               // buildMachineRoom govX와 동일 축
      const tensBaseZ = 0.22;                    // 가이드 레일 파묻힘 방지 — Z축으로 전방 이격
      const tensionerY = Y0 + 0.5;               // 피트 바닥 +500mm

      // ── 1. 가이드 레일 고정 브라켓 (베이스/연장암 분리)
      const bracketMat = M.ss(0x4b5563);

      // 수직 베이스판 (가이드 레일 웹/플랜지 측면에 체결되는 지지대)
      createBox(0.04, 0.45, 0.08, bracketMat,
        S.CAR_BG / 2 - 0.02, tensionerY + 0.15, 0.04, pitGrp);

      // 수평 연장 암 (수직 베이스에서 풀리 축 쪽으로 Z축 방향 연장)
      // Z 중심 (레일 0.04 + 풀리 0.22) / 2 = 0.13, 길이 약 0.22
      createBox(0.06, 0.06, 0.22, bracketMat,
        tensGovX, tensionerY + 0.30, 0.13, pitGrp);

      // ── 2. 인장추 하부 풀리 (Tension Sheave) ──
      // 조속기와 동일하게 휠 축을 X축으로 맞춤
      const tensionWheelSpinGrp = new THREE.Group();
      tensionWheelSpinGrp.position.set(tensGovX, tensionerY + 0.30, tensBaseZ);
      pitGrp.add(tensionWheelSpinGrp);
      tensionSheaveGrp = tensionWheelSpinGrp;

      const tensionSheave = createCylinder(
        0.15, 0.15, 0.10,
        M.gold(),
        0, 0, 0, tensionWheelSpinGrp
      );
      tensionSheave.rotation.z = Math.PI / 2;   // 실린더 기본 Y축 -> X축

      // 허브
      const tensHub = createCylinder(
        0.03, 0.03, 0.14, M.ss(0xcccccc),
        0, 0, 0, tensionWheelSpinGrp
      );
      tensHub.rotation.z = Math.PI / 2;

      // V-홈 (TorusGeometry 기본 축=Z축 → X축 정렬로 변경)
      const tensGroove = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.011, 8, 32),
        M.paint(0x222222)
      );
      tensGroove.position.set(0, 0, 0);
      tensGroove.rotation.y = Math.PI / 2;
      tensionWheelSpinGrp.add(tensGroove);

      // 로프 가드 느낌 스포크 (YZ 평면, 짧게 — 레일 쪽 돌출 최소화)
      const spRad = 0.038;
      const spLen = 0.13;
      const spTh = 0.016;
      for (let sp = 0; sp < 6; sp++) {
        const ang = sp * Math.PI / 3;
        const spk = createBox(spLen, spTh, spTh, M.paint(0xd4af37),
          0,
          Math.sin(ang) * spRad,
          Math.cos(ang) * spRad,
          tensionWheelSpinGrp);
        spk.rotation.y = Math.PI / 2;
        spk.rotation.x = ang;
      }
      // 인장시브 회전 확인용 표식: 회전체 면에 인쇄된 초승달형 양방향 화살표 1개
      const tensSpinSymbol = new THREE.Group();
      const crescentOuter = 0.108;
      const crescentInner = 0.078;
      const crescentStart = -2.35;
      const crescentEnd = 0.85;
      const crescentShape = new THREE.Shape();
      for (let i = 0; i <= 28; i++) {
        const a = crescentStart + (crescentEnd - crescentStart) * (i / 28);
        const x = Math.cos(a) * crescentOuter;
        const y = Math.sin(a) * crescentOuter;
        if (i === 0) crescentShape.moveTo(x, y);
        else crescentShape.lineTo(x, y);
      }
      for (let i = 28; i >= 0; i--) {
        const a = crescentStart + (crescentEnd - crescentStart) * (i / 28);
        crescentShape.lineTo(Math.cos(a) * crescentInner, Math.sin(a) * crescentInner);
      }
      const symbolMat = M.emit(0xffffff, 1.5);
      tensSpinSymbol.add(new THREE.Mesh(new THREE.ShapeGeometry(crescentShape), symbolMat));

      [crescentStart, crescentEnd].forEach((a, idx) => {
        const dir = idx === 0 ? -1 : 1;
        const r = (crescentOuter + crescentInner) / 2;
        const head = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([
          new THREE.Vector2(0.030 * dir, 0),
          new THREE.Vector2(-0.018 * dir, 0.022),
          new THREE.Vector2(-0.012 * dir, -0.026)
        ])), symbolMat);
        head.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
        head.rotation.z = a + Math.PI / 2;
        tensSpinSymbol.add(head);
      });
      tensSpinSymbol.position.set(0.056, 0, 0);
      tensSpinSymbol.rotation.y = Math.PI / 2;
      tensionWheelSpinGrp.add(tensSpinSymbol);

      const tensGuardMat = new THREE.MeshStandardMaterial({
        color: 0xf1c40f,
        roughness: 0.5,
        metalness: 0.25,
        side: THREE.DoubleSide
      });
      const tensGuard = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.16, 32, 1, true, Math.PI, Math.PI),
        tensGuardMat
      );
      tensGuard.rotation.z = Math.PI / 2;
      tensGuard.position.set(tensGovX, tensionerY + 0.30, tensBaseZ);
      pitGrp.add(tensGuard);
      const guardFaceShape = new THREE.Shape();
      guardFaceShape.moveTo(-0.18, 0);
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI + Math.PI * (i / 24);
        guardFaceShape.lineTo(Math.cos(a) * 0.18, Math.sin(a) * 0.18);
      }
      guardFaceShape.lineTo(0.18, 0);
      [-0.085, 0.085].forEach(dx => {
        const face = new THREE.Mesh(new THREE.ShapeGeometry(guardFaceShape), tensGuardMat);
        face.position.set(tensGovX + dx, tensionerY + 0.30, tensBaseZ);
        face.rotation.y = Math.PI / 2;
        pitGrp.add(face);
      });
      createBox(0.18, 0.018, 0.035, M.paint(0x333333),
        tensGovX, tensionerY + 0.12, tensBaseZ - 0.09, pitGrp);
      createBox(0.18, 0.018, 0.035, M.paint(0x333333),
        tensGovX, tensionerY + 0.12, tensBaseZ + 0.09, pitGrp);

      // ── 3. 인장추 본체 ──
      // 풀리 축 연결 금구
      createBox(0.06, 0.12, 0.12, M.ss(0x7a8290),
        tensGovX, tensionerY + 0.15, tensBaseZ, pitGrp);
      // 주물 추 (2단)
      createBox(0.28, 0.22, 0.14, M.paint(0x777777),
        tensGovX, tensionerY - 0.01, tensBaseZ, pitGrp);
      createBox(0.26, 0.22, 0.12, M.paint(0x666666),
        tensGovX, tensionerY - 0.23, tensBaseZ, pitGrp);
      // 하단 마감판
      createBox(0.30, 0.025, 0.16, M.ss(0x555555),
        tensGovX, tensionerY - 0.35, tensBaseZ, pitGrp);

      // ── 4. 조속기 로프 루프(기계실 조속기 ↔ 피트 인장시브) ──
      const gRopeMat = M.rope();
      const govData = mrGrp.userData || {};
      const govWheelY = govData.govWheelY || (Y0 + TOTAL_H + 0.42);
      const govWheelR = govData.govR || 0.14;
      const ropeOffsetZ = Math.max(govWheelR, 0.15);
      [-ropeOffsetZ, ropeOffsetZ].forEach(dz => {
        const pts = [
          new THREE.Vector3(tensGovX, tensionerY + 0.30, tensBaseZ + dz),
          new THREE.Vector3(tensGovX, govWheelY, tensBaseZ + dz)
        ];
        pitGrp.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts), gRopeMat
        ));
      });

      scene.add(pitGrp);
    }

    function updateBuffers() {
      if (bufferGrp) scene.remove(bufferGrp);
      bufferGrp = new THREE.Group();

      // 위치: [x좌표, z좌표, 지지대 높이 비율(1.0=기본, 0.33=균형추용)]
      const pos = [
        [0, 0, 1.0],                 // 카 하부 (기본 높이)
        [0, CWT_CENTER_Z, 0.35]      // 균형추 하부 (약 1/3 높이)
      ];

      pos.forEach(([px, pz, heightScale]) => {
        // 1. 완충기 지지대 (철재 기둥)
        const baseH = 0.4 * heightScale; // 카 측은 0.4m, 균형추 측은 약 0.14m
        createBox(0.2, baseH, 0.2, M.ss(0x8a929a), px, Y0 + baseH / 2, pz, bufferGrp);
        // 지지대 상판 (베이스 플레이트)
        const plateY = Y0 + baseH;
        createBox(0.28, 0.02, 0.28, M.ss(0x6b7280), px, plateY + 0.01, pz, bufferGrp);

        if (targetSpeed === 90) {
          // [고속] 유입식 완충기 (에너지 분산형 - 유압 실린더)
          createCylinder(0.08, 0.09, 0.4, M.paint(0x111827), px, plateY + 0.22, pz, bufferGrp);
          createCylinder(0.035, 0.035, 0.25, M.ss(0xd8e0e8), px, plateY + 0.55, pz, bufferGrp);
        } else {
          // [저속] 에너지 축적형 완충기
          // 비선형 (폴리우레탄 - 실물 반영: 검은색 우레탄 질감)
          // 우레탄 특유의 약간 거칠고 빛 반사가 적은 고무 질감 구현
          const urethaneMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a, // 진한 검은색
            roughness: 0.85,
            metalness: 0.0
          });
          // 둥근 원통형 우레탄 형태
          createCylinder(0.09, 0.09, 0.15, urethaneMat, px, plateY + 0.095, pz, bufferGrp);
          // 상단 모따기 부분 (우레탄 헤드)
          createCylinder(0.08, 0.09, 0.04, urethaneMat, px, plateY + 0.19, pz, bufferGrp);
        }
      });
      scene.add(bufferGrp);
    }
