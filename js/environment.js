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

    function buildBackground() {
      // 1. 어두운 땅바닥 생성 (기존 유지)
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(150, 150),
        new THREE.MeshStandardMaterial({ color: 0x4a453f, roughness: 0.95 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = Y0 - 0.01;
      ground.receiveShadow = true;
      scene.add(ground);

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

      // --- 세로형 지사 로고 현판 (사용자가 직접 디자인한 통이미지 사용) ---
      const logoTex = new THREE.TextureLoader().load('logo.png', 
        undefined, // onProgress
        undefined, 
        (err) => {
          alert("⚠️ [오류] logo.png 파일을 불러올 수 없습니다!\n\n1. 바탕화면 simmul 폴더 안에 'logo.png' 파일이 있는지 확인하세요.\n2. 웹 브라우저 보안(CORS) 문제일 수 있습니다. 파일을 더블클릭해서 열지 마시고, VS Code의 'Live Server'를 이용해 열어주세요!");
          console.error("Texture Load Error:", err);
        }
      );
      // 양면 렌더링(DoubleSide)을 추가하여 카메라 각도와 무관하게 무조건 보이도록 설정
      const logoMat = new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, side: THREE.DoubleSide });

      // 벽면에 현판 부착 (약간 띄워서 Z-fighting 방지)
      // 넓이를 기존 2.2에서 80%인 1.76으로 축소, 길이는 8.8 유지
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 8.8), logoMat);
      sign.rotation.y = -Math.PI / 2;
      // [수정] 현판 중심 높이(Y 좌표)를 9.5 -> 7.8로 낮춤
      // (현판 상단이 3층 캐노피 라인과 정렬되도록 조정)
      sign.position.set(sideWallX - 0.15, Y0 + 7.8, S.WALL_T / 2);
      scene.add(sign);

      scene.add(wallGrp);
    }

    function buildGuideRails() {
      railGrp = new THREE.Group();
      const rMat = M.ss(0x4a5a6a);

      // [추가] 2. 하부 베이스 채널(Foot Plate) - 카 및 균형추 레일용 (높이 0.1m)
      const chH = 0.1;
      const baseMat = M.paint(0x374151); // 짙은 회색
      // 카 레일 지지 채널
      createBox(S.CAR_BG + 0.3, chH, 0.2, baseMat, 0, Y0 + chH / 2, 0.04, railGrp);
      // 균형추 레일 지지 채널
      createBox(S.CWT_W + 0.3, chH, 0.2, baseMat, 0, Y0 + chH / 2, CWT_CENTER_Z, railGrp);

      // 가이드 레일이 기계실 바닥을 뚫고 나오지 않게 높이 조정
      const rh = TOTAL_H - 0.1 - chH;
      const rY = Y0 + chH + rh / 2;

      function drawRail(px, pz, isCwt, rotY) {
        const g = new THREE.Group();
        g.add(createBox(isCwt ? 0.03 : 0.034, rh, isCwt ? 0.07 : 0.082, rMat, 0, 0, 0, g)); // web
        g.add(createBox(isCwt ? 0.1 : 0.118, rh, 0.014, rMat, 0, 0, isCwt ? 0.041 : 0.048, g)); // flange
        g.position.set(px, rY, pz); g.rotation.y = rotY; return g;
      }

      // 카 측 레일
      railGrp.add(drawRail(-S.CAR_BG / 2, 0.04, false, 0), drawRail(S.CAR_BG / 2, 0.04, false, 0));

      // 균형추 측 레일 (후면)
      railGrp.add(
        drawRail(-S.CWT_W / 2, CWT_CENTER_Z, true, Math.PI),
        drawRail(S.CWT_W / 2, CWT_CENTER_Z, true, 0)
      );

      // Final Cam 작동용 상/하 한계 스위치류(레일측 고정)
      const switchRailX = S.CAR_BG / 2;
      const switchX = switchRailX - 0.22;
      const switchZ = 0.10;
      const switchMat = M.paint(0x7c3f12);
      const bracketMat = M.paint(0x5b6b84);
      const rollerMat = M.gold();

      function addRollerSwitch(y, kind = 'limit') {
        const sw = new THREE.Group();
        const bodyColor = kind === 'final' ? 0x7f1d1d : (kind === 'limit' ? 0xf59e0b : 0x8b4513);
        createBox(0.12, 0.38, 0.055, M.paint(bodyColor), 0, 0, 0, sw);
        createBox(0.22, 0.035, 0.045, bracketMat, -0.15, 0.14, 0, sw);
        createBox(0.22, 0.035, 0.045, bracketMat, -0.15, -0.14, 0, sw);
        createBox(0.035, 0.42, 0.04, M.paint(0x3b1f0f), 0.055, 0, -0.052, sw);

        const arm = createBox(0.12, 0.018, 0.018, switchMat, 0.09, 0, 0, sw);
        arm.rotation.z = -Math.PI / 12;
        const roller = createCylinder(0.018, 0.018, 0.035, rollerMat, 0.16, 0.012, 0, sw);
        roller.rotation.x = Math.PI / 2;

        sw.position.set(switchX, y, switchZ);
        railGrp.add(sw);
        return sw;
      }

      // 층 고정 Landing Switch: 자석식이 아닌 기계식 롤러형 3단 스위치
      function addLandingSwitch(y) {
        const landingSwGrp = new THREE.Group();
        const bodyMat = M.paint(0x3b2313);
        const supportMat = M.paint(0x4b5563);
        const landingBracketMat = M.paint(0x6b7280);
        const railFaceX = switchRailX - 0.017;
        const switchCenterX = switchRailX - 0.07;
        const bracketLen = Math.max(0.06, railFaceX - switchCenterX);

        // 레일에서 카 쪽으로 뻗는 가로 브라켓 + 지지 마스트
        createBox(bracketLen, 0.032, 0.05, landingBracketMat, (railFaceX + switchCenterX) / 2, y, switchZ, railGrp);
        createBox(0.042, 0.34, 0.055, supportMat, switchCenterX, y, switchZ, railGrp);

        const stagePitch = 0.12;

        // 3단 롤러 레버: 카측 베인이 지나가며 롤러를 누르는 구조
        for (let i = 0; i < 3; i++) {
          const sy = (i - 1) * stagePitch;
          createBox(0.085, 0.055, 0.045, bodyMat, 0.0, sy, 0, landingSwGrp);
          const arm = createBox(0.08, 0.014, 0.014, M.paint(0x7c3f12), 0.06, sy + 0.005, 0, landingSwGrp);
          arm.rotation.z = -Math.PI / 16;
          const roller = createCylinder(0.012, 0.012, 0.028, M.gold(), 0.102, sy + 0.008, 0, landingSwGrp);
          roller.rotation.x = Math.PI / 2;
          createBox(0.02, 0.022, 0.012, M.emit(0xfacc15, 0.7), -0.038, sy, 0.026, landingSwGrp);
        }
        createBox(0.02, 0.34, 0.028, supportMat, -0.058, 0, 0, landingSwGrp);

        landingSwGrp.position.set(switchCenterX, y, switchZ);
        railGrp.add(landingSwGrp);
      }

      FLOOR_Y.forEach(fy => addLandingSwitch(fy + S.CAR_H - 0.35));

      const topLimitY = FLOOR_Y[FLOORS - 1] + S.CAR_H + 0.25;
      const topFinalY = topLimitY + 0.45;
      const bottomLimitY = FLOOR_Y[0] + 0.55;
      const bottomFinalY = FLOOR_Y[0] - 0.15;
      [
        [topLimitY, 'limit'], [topFinalY, 'final'],
        [bottomLimitY, 'limit'], [bottomFinalY, 'final']
      ].forEach(([y, kind]) => addRollerSwitch(y, kind));

      scene.add(railGrp);
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

      // ── 1. 가이드 레일 고정 브라켓 (실사 반영: 적색, 베이스/연장암 분리)
      const bracketMat = M.paint(0xd32f2f);     // 강한 붉은 방청·우레탄 도장 느낌

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
