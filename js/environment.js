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
        { z: -40, color: 0x7a9470, peaks: [[-32, 10], [-18, 14], [-4, 16], [10, 13], [24, 11], [36, 9]] },
        { z: -44, color: 0x5f7d58, peaks: [[-28, 12], [-12, 17], [4, 19], [18, 14], [32, 10]] },
        { z: -48, color: 0x4a6348, peaks: [[-22, 9], [0, 15], [22, 11]] }
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

      const white = M.ss(0xf0f2f5);
      const grey = M.conc(0xc5cad0);
      const blueRoof = M.paint(0x3b6ea5);

      const towerH = 22;
      createCylinder(1.1, 1.1, towerH, white, 0, Y0 + towerH / 2, 0, grp);
      createBox(3.2, 1.8, 3.2, M.glass(), 0, Y0 + towerH + 0.9, 0, grp);
      createBox(3.6, 0.3, 3.6, white, 0, Y0 + towerH + 1.9, 0, grp);
      createCylinder(0.04, 0.04, 1.2, M.ss(0x888888), 0, Y0 + towerH + 2.6, 0, grp);

      createBox(2.0, 0.8, 0.05, M.paint(0xffffff), 0, Y0 + towerH * 0.72, 1.15, grp);
      createBox(0.45, 0.45, 0.06, M.paint(0xf08820), -0.45, Y0 + towerH * 0.72, 1.16, grp);
      createBox(0.45, 0.45, 0.06, M.paint(0x2080d0), 0.15, Y0 + towerH * 0.72, 1.16, grp);

      createBox(6, 2.5, 4, grey, -5, Y0 + 1.25, -2, grp);
      createBox(6, 0.15, 4.2, blueRoof, -5, Y0 + 2.55, -2, grp);
      createBox(4, 2, 3, grey, -5, Y0 + 1, 3, grp);
      createBox(4, 0.12, 3.2, blueRoof, -5, Y0 + 2.06, 3, grp);
      createBox(5, 2.8, 4, white, 4, Y0 + 1.4, 1, grp);
      createBox(4.5, 1.8, 0.08, M.glass(), 4, Y0 + 1.6, 3.05, grp);

      createBox(14, 0.05, 10, M.paint(0x555a60), 0, Y0 + 0.025, 0, grp);
      createBox(10, 0.04, 6, M.paint(0x5a8a48), -1, Y0 + 0.03, -4, grp);

      grp.userData = { type: 'bg-koelsa2' };
      parent.add(grp);
    }

    // koelsa 참고 — 한국승강기안전공단 본관 (오른쪽 +X)
    function buildKoelsaHQ(parent) {
      const grp = new THREE.Group();
      grp.name = 'koelsa-hq';
      grp.position.set(17, 0, -28);

      const wall = M.ss(0xe8eaed);
      const glass = M.glass();
      const floorH = 2.8;
      const floors = 6;
      const mainH = floors * floorH;
      const mainW = 10;
      const mainD = 7;

      createBox(mainW, mainH, mainD, wall, 0, Y0 + mainH / 2, 0, grp);
      createBox(2.2, mainH - 1, 0.08, glass, 0, Y0 + mainH / 2, mainD / 2 + 0.02, grp);
      for (let f = 0; f < floors; f++) {
        createBox(mainW - 3, 1.6, 0.05, glass, 0, Y0 + floorH * f + floorH * 0.55, mainD / 2 + 0.03, grp);
      }

      const pilotH = 3.2;
      for (let i = -3; i <= 3; i += 2) {
        createCylinder(0.22, 0.22, pilotH, M.paint(0xd4842a), i * 1.1, Y0 + pilotH / 2, mainD / 2 + 1.2, grp);
      }
      createBox(mainW + 1, 0.15, 2.5, wall, 0, Y0 + pilotH, mainD / 2 + 1.2, grp);

      createBox(4, 0.6, 0.08, M.paint(0xffffff), -1, Y0 + mainH + 0.3, mainD / 2 + 0.05, grp);
      createBox(0.55, 0.55, 0.09, M.paint(0xe84040), -2.2, Y0 + mainH + 0.3, mainD / 2 + 0.06, grp);
      createBox(0.55, 0.55, 0.09, M.paint(0x2080d0), -1.5, Y0 + mainH + 0.3, mainD / 2 + 0.06, grp);
      createBox(0.55, 0.55, 0.09, M.paint(0x58a832), -0.8, Y0 + mainH + 0.3, mainD / 2 + 0.06, grp);

      createBox(12, 0.05, 8, M.paint(0x5a5f66), 0, Y0 + 0.025, 6, grp);

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
        const viewH = 58;
        const aspect = tex.image.width / tex.image.height;
        const viewW = Math.max(viewH * aspect, 62);
        const x = side === 'left' ? -viewW * 0.44 : viewW * 0.44;
        const bgY = Y0 + viewH * 0.52;

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

        const fadeH = viewH * 0.22;
        const bottomFade = createBgGradientTexture(4, 128, (ctx, cw, ch) => {
          const g = ctx.createLinearGradient(0, 0, 0, ch);
          g.addColorStop(0, 'rgba(74,69,63,0)');
          g.addColorStop(0.65, 'rgba(74,69,63,0.55)');
          g.addColorStop(1, BG_GROUND);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, cw, ch);
        });
        const bottomMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(viewW, fadeH),
          new THREE.MeshBasicMaterial({ map: bottomFade, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide })
        );
        bottomMesh.position.set(x, Y0 + fadeH * 0.42, bgZ + 0.4);
        bottomMesh.renderOrder = -9;
        parent.add(bottomMesh);

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
      const grassA = M.paint(0x5a8a48);
      const grassB = M.paint(0x4a7340);

      createBox(w, 0.03, d, M.paint(0x567a46), cx, Y0 + 0.045, cz, patch);

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
      createBox(span, 0.05, span, M.paint(0x52575e), 0, Y0 + 0.025, 0, g);

      buildGrassPatch(g, -58, 0, 95, span * 0.88);
      buildGrassPatch(g, 58, 0, 95, span * 0.88);
      buildGrassPatch(g, 0, -55, span * 0.55, 45);

      createBox(S.SHAFT_W + S.WALL_T * 2 + 2.4, 0.03, 3.2, M.ss(0xb0b5bb), 0, Y0 + 0.04, S.SHAFT_D / 2 + 2.2, g);

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
      const wallMat = M.conc(0xd5dadf);
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
        createBox(totalWallW, 0.12, 1.5, M.ss(0xb0b5bb), 0, fy - 0.06, wallZ + S.WALL_T / 2 + 0.75, wallGrp);

        // 천장 Y 좌표 (해당 층 바닥 + 층고)
        const ceilingY = fy + fh;

        // 4층(최상층) 천장 캐노피 슬래브 추가
        if (i === FLOORS - 1) {
          createBox(totalWallW, 0.12, 1.5, M.conc(0xd5dadf), 0, ceilingY + 0.06, wallZ + S.WALL_T / 2 + 0.75, wallGrp);
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

      /* 1. 하부 빔 (Machine Lower Beams) - 전면부로 길게 튀어나오도록 수정 */
      const beamMat = M.paint(0x1c2833); // 짙은 남색
      const lowerZ = -0.1; // 중심
      const lowerL = 2.0; // 길이 (0.9 ~ -1.1)
      createBox(0.14, 0.15, lowerL, beamMat, -0.4, my + 0.095, lowerZ, mrGrp);
      createBox(0.14, 0.15, lowerL, beamMat, 0.4, my + 0.095, lowerZ, mrGrp);
      // 하부 가로 지지대
      createBox(0.94, 0.1, 0.14, beamMat, 0, my + 0.07, 0.8, mrGrp);
      createBox(0.94, 0.1, 0.14, beamMat, 0, my + 0.07, -1.0, mrGrp);

      /* 2. 방진고무 (Vibration Pads) - 상부 베드 길이에 맞춰 재배치 */
      const padMat = M.paint(0x111111);
      const padTopMat = M.ss(0xc0c0c0);
      const padY = my + 0.17 + 0.025; 
      const pxs = [-0.4, 0.4], pzs = [-0.9, 0.2]; // 상부 베드 하단에 맞춤
      pxs.forEach(x => {
        pzs.forEach(z => {
          createCylinder(0.08, 0.08, 0.05, padMat, x, padY, z, mrGrp);
          createCylinder(0.085, 0.085, 0.02, padTopMat, x, padY + 0.035, z, mrGrp);
        });
      });

      /* 3. 상부 베드 (Machine Upper Bed) - 보조 시브를 덮도록 후면으로 연장 */
      const bedMat = M.paint(0x4a5a6a); // 청회색
      const bedY = padY + 0.045 + 0.05; // 0.29
      
      const upperZ = -0.35; // 중심
      const upperL = 1.4; // 길이 (0.35 ~ -1.05)
      
      // 베이스 플레이트
      createBox(1.0, 0.02, 0.2, bedMat, 0, bedY, 0.2, mrGrp);
      createBox(1.0, 0.02, 0.2, bedMat, 0, bedY, -0.9, mrGrp);
      
      // 상부 세로 빔 (보조 시브가 들어갈 공간을 위해 충분히 길게)
      createBox(0.08, 0.15, upperL, bedMat, -0.25, bedY + 0.085, upperZ, mrGrp);
      createBox(0.08, 0.15, upperL, bedMat, 0.25, bedY + 0.085, upperZ, mrGrp);
      
      // 지그재그 보강대 (보조 시브 앞쪽으로 배치)
      function addBrace(x1, z1, x2, z2) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.sqrt(dx*dx + dz*dz);
        const cx = (x1 + x2) / 2;
        const cz = (z1 + z2) / 2;
        const brace = createBox(len, 0.04, 0.04, bedMat, cx, bedY + 0.085, cz, mrGrp);
        brace.rotation.y = -Math.atan2(dz, dx);
      }
      addBrace(-0.25, 0.2, 0.25, -0.1);
      addBrace(0.25, -0.1, -0.25, -0.4);
      addBrace(-0.25, -0.4, 0.25, -0.7);

      /* 4. 보조 시브 (Deflector Sheave) - 상부 베드 후면 내부에 결합 */
      const defRadius = 0.18;
      const defY = bedY + 0.02; // 상부 빔 사이에 위치
      const defMat = M.paint(0xe0e0e0); 
      const defGrp = new THREE.Group();
      
      const defDrum = new THREE.Mesh(new THREE.CylinderGeometry(defRadius, defRadius, 0.12, 32), defMat);
      defDrum.rotation.x = Math.PI / 2;
      defGrp.add(defDrum);

      const grooveMat = M.paint(0x111111);
      for (let i = 0; i < 5; i++) {
        const gx = -0.04 + i * 0.02;
        const groove = new THREE.Mesh(new THREE.TorusGeometry(defRadius + 0.002, 0.005, 8, 32), grooveMat);
        groove.position.set(0, 0, gx);
        defGrp.add(groove);
      }
      for (let i = 0; i < 6; i++) {
        const sp = createBox(0.04, defRadius * 2 - 0.04, 0.04, defMat, 0, 0, 0, defGrp);
        sp.rotation.z = i * Math.PI / 3;
      }
      defGrp.rotation.y = Math.PI / 2;
      defGrp.position.set(0, defY, CWT_CENTER_Z);
      mrGrp.add(defGrp);
      
      // 시브 축 (상부 빔을 관통하여 결합되는 베어링 축)
      createBox(0.6, 0.04, 0.04, M.paint(0x111111), 0, defY, CWT_CENTER_Z, mrGrp);

      /* 5. 권상기 (Traction Machine) - 웜기어 방식 (세로 모터 배치) */
      const tmBaseMat = M.paint(0x2c3e50); // 권상기 웜기어 하부 캐스팅
      const motorMat = M.ss(0x88929b); // 은회색 모터 본체
      const darkMat = M.paint(0x111111); // 검은색 부품
      const shvY = bedY + 0.16 + 0.35; // 메인 시브 중심축 높이
      
      const tmX = -0.25; // 웜기어 박스와 모터가 위치할 중심 X좌표 (좌측 상부 빔 위)

      // 5-0. 웜기어 박스 (Worm Gear Box) - 중심 캐스팅
      // 시브(X=0)의 왼쪽에 위치하며, 모터의 회전을 90도 꺾어 시브로 전달
      createBox(0.25, 0.35, 0.4, tmBaseMat, tmX, shvY - 0.1, 0, mrGrp);
      // 기어박스 내부 웜휠 축 커버 (시브와 연결되는 부분)
      const gearCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 32), tmBaseMat);
      gearCylinder.rotation.z = Math.PI / 2; // X축 방향 (시브와 축 공유)
      gearCylinder.position.set(tmX, shvY, 0);
      mrGrp.add(gearCylinder);
      
      // 5-1. 모터 (Motor) - 웜기어 박스 앞쪽(+Z)에 결합 (세로 방향)
      const motorZ = 0.55; 
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.4, 32), motorMat);
      motor.rotation.x = Math.PI / 2; // 축이 Z축 방향
      motor.position.set(tmX, shvY, motorZ);
      mrGrp.add(motor);
      // 모터 앞쪽 검은색 통풍구 캡
      const motorCap = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.05, 32), darkMat);
      motorCap.rotation.x = Math.PI / 2;
      motorCap.position.set(tmX, shvY, motorZ + 0.2);
      mrGrp.add(motorCap);

      // 5-2. 엔코더 (Encoder) - 모터 끝단(+Z)에 돌출
      const encMat = M.paint(0x555555);
      const encoder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16), encMat);
      encoder.rotation.x = Math.PI / 2;
      encoder.position.set(tmX, shvY, motorZ + 0.25);
      mrGrp.add(encoder);
      // 엔코더 중심 회전 축
      createBox(0.02, 0.02, 0.04, darkMat, tmX, shvY, motorZ + 0.3, mrGrp);

      // 5-3. 브레이크 (Brake) - 모터와 기어박스 사이 (Z축 상)
      const brkZ = 0.25;
      // 브레이크 드럼 (Z축 회전)
      const brkDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 32), darkMat);
      brkDrum.rotation.x = Math.PI / 2; // 축이 Z축
      brkDrum.position.set(tmX, shvY, brkZ);
      mrGrp.add(brkDrum);
      
      // 캘리퍼 암 (좌/우로 드럼을 감싸는 지지대)
      const caliperMat = M.ss(0xd0d0d0);
      createBox(0.06, 0.45, 0.04, caliperMat, tmX - 0.2, shvY + 0.05, brkZ, mrGrp); // 좌측 암
      createBox(0.06, 0.45, 0.04, caliperMat, tmX + 0.2, shvY + 0.05, brkZ, mrGrp); // 우측 암
      // 브레이크 패드 (드럼 쪽으로 밀착)
      createBox(0.02, 0.15, 0.08, M.paint(0x333333), tmX - 0.16, shvY, brkZ, mrGrp);
      createBox(0.02, 0.15, 0.08, M.paint(0x333333), tmX + 0.16, shvY, brkZ, mrGrp);
      
      // 상단 스프링 & 엑추에이터 (X축 방향으로 가로지르는 로드)
      const rodY = shvY + 0.25;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 8), darkMat);
      rod.rotation.z = Math.PI / 2; // 축이 X축
      rod.position.set(tmX, rodY, brkZ);
      mrGrp.add(rod);
      // 텐션 스프링 (좌측 암을 누름)
      const springMat = M.paint(0x111111);
      const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 16), springMat);
      spring.rotation.z = Math.PI / 2;
      spring.position.set(tmX - 0.25, rodY, brkZ);
      mrGrp.add(spring);
      // 솔레노이드 엑추에이터 (우측 노란색 원통 부품)
      const solenoidMat = M.paint(0xf1c40f);
      const solenoid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16), solenoidMat);
      solenoid.rotation.z = Math.PI / 2;
      solenoid.position.set(tmX + 0.25, rodY, brkZ);
      mrGrp.add(solenoid);

      // 5-4. 메인 시브 (Main Sheave) - 웜기어 우측(X=0, Z=0)에 결합
      const mainShvRadius = 0.28;
      const shvMat = M.ss(0xa0a8b0);
      const mainGrp = new THREE.Group();
      
      const mainDrum = new THREE.Mesh(new THREE.CylinderGeometry(mainShvRadius, mainShvRadius, 0.12, 32), shvMat);
      mainDrum.rotation.x = Math.PI / 2;
      mainGrp.add(mainDrum);

      for (let i = 0; i < 5; i++) {
        const gx = -0.04 + i * 0.02;
        const groove = new THREE.Mesh(new THREE.TorusGeometry(mainShvRadius + 0.002, 0.005, 8, 32), darkMat);
        groove.position.set(0, 0, gx);
        mainGrp.add(groove);
      }
      for (let i = 0; i < 6; i++) {
        const sp = createBox(0.04, mainShvRadius * 2 - 0.04, 0.04, shvMat, 0, 0, 0, mainGrp);
        sp.rotation.z = i * Math.PI / 3;
      }
      mainGrp.rotation.y = Math.PI / 2; // 축이 X축 방향
      mainGrp.position.set(0, shvY, 0); // 메인 축(X=0, Z=0)
      mrGrp.add(mainGrp);
      mainSheaveGrp = mainGrp;

      // ③ 시브 커버 (Sheave Cover) - 도르래를 감싸는 반원/C자형 쉘 구조 (소장님 지침 적용)
      const coverRadius = mainShvRadius + 0.02; // 도르래 회전 간섭이 없도록 살짝 띄움
      const coverWidth = 0.16; // 도르래 폭을 충분히 덮음
      
      const coverGeom = new THREE.CylinderGeometry(
        coverRadius, coverRadius, coverWidth, 32, 1, true,
        -Math.PI * 0.15,  // 앞쪽 살짝 아래에서 덮기 시작
        Math.PI * 1.3     // 위를 지나 뒤쪽 아래까지 깊숙하게 덮음
      );
      
      const coverMat = new THREE.MeshStandardMaterial({
        color: 0xf1c40f,
        roughness: 0.5,
        metalness: 0.3,
        side: THREE.DoubleSide
      });
      
      const sheaveCover = new THREE.Mesh(coverGeom, coverMat);
      sheaveCover.rotation.z = Math.PI / 2; 
      sheaveCover.position.set(0, shvY, 0);
      mrGrp.add(sheaveCover);

      // 커버 고정용 브라켓 & 볼트 디테일
      const bracketMat = M.paint(0x333333);
      const boltMat = M.ss(0xffffff);
      
      const fZ = Math.cos(-Math.PI * 0.15) * coverRadius;
      const fY = Math.sin(-Math.PI * 0.15) * coverRadius;
      const fBracket = createBox(coverWidth + 0.02, 0.02, 0.04, bracketMat, 0, shvY + fY, fZ, mrGrp);
      fBracket.rotation.x = -Math.PI * 0.15;
      
      const b1 = createCylinder(0.005, 0.005, 0.03, boltMat, -0.05, shvY + fY, fZ, mrGrp);
      b1.rotation.x = -Math.PI * 0.15;
      const b2 = createCylinder(0.005, 0.005, 0.03, boltMat, 0.05, shvY + fY, fZ, mrGrp);
      b2.rotation.x = -Math.PI * 0.15;

      const bZ = Math.cos(Math.PI * 1.15) * coverRadius;
      const bY = Math.sin(Math.PI * 1.15) * coverRadius;
      const bBracket = createBox(coverWidth + 0.02, 0.02, 0.04, bracketMat, 0, shvY + bY, bZ, mrGrp);
      bBracket.rotation.x = Math.PI * 1.15;

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
      const pivPin = createCylinder(0.018, 0.018, bD+0.02, M.ss(0xaaaaaa), pivX, pivY, 0, govBodyGrp);
      pivPin.rotation.x = Math.PI / 2;

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
        shvY: shvY,
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
