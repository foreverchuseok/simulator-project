/* =============================================================================
   ARCHIVE ONLY — index.html does not load this file.
   2026-08-17 도어 재공사: 화면에서 카문·승장문·헤더·페시아·토가드·오퍼레이터를
   제거하기 전에 js/elevator.js 에서 복사한 원본이다.

   사용법
   - 부품을 다시 올릴 때 해당 구간만 js/elevator.js 의 스텁 함수로 옮긴다.
   - 스티커 PNG 는 assets/bg/hand.png, assets/bg/lean.png 에 그대로 있다. 삭제 금지.
   - 카 에이프런은 카 재공사로 js/archive/car.js 에 옮겼다.
   - 안내서: docs/DOOR-REBUILD.md

   의존 전역: S, M, THREE, scene, carGrp, FLOORS, FLOOR_Y, FRONT_INNER_Z,
   FRONT_WALL_INNER_Z, HALL_SHIFT, carDoorL/R, hatchDoors, indicators,
   createBox, createCylinder
   ============================================================================= */

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
      // 1. 카 도어 패널 본체 생성 (샴페인 그래파이트 PVD 티타늄 브러시드 메탈)
      // ──────────────────────────────────────────────────────────────
      const doorTitaniumMat = M.pvdTitanium();
      const doorBezelMat = M.pvdTitanium(0xb8ad9e);

      function makeDoor(xSign) {
        const g = new THREE.Group();
        // 기본 문짝 (샴페인 그래파이트 수직 브러시드 PVD 티타늄)
        createBox(dw, dh, dt, doorTitaniumMat, 0, 0, 0, g);
        // 슬림 글래스 윈도우 & 티타늄 베젤
        createBox(dw * 0.55, dh * 0.26, dt + 0.005, M.glass(), 0, dh * 0.3, 0, g); 
        createBox(dw * 0.57, 0.015, dt + 0.008, doorBezelMat, 0, dh * 0.3 + dh * 0.13, 0, g); // 상단 베젤
        createBox(dw * 0.57, 0.015, dt + 0.008, doorBezelMat, 0, dh * 0.3 - dh * 0.13, 0, g); // 하단 베젤
        
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
        [-0.15, 0.15].forEach(gx => createBox(0.05, 0.035, 0.025, M.pvdTitanium(0xa89f92), gx, -dh / 2 - 0.02, 0, g));

        // 패널 후면 세로 보강 리브 2줄 (샴페인 티타늄)
        [-dw * 0.22, dw * 0.22].forEach(rbx => {
          createBox(0.05, dh * 0.94, 0.012, doorBezelMat, rbx, 0, dt / 2 + 0.006, g);
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
      // 승강장 문 및 삼방틀 — 프리미엄 실버 헤어라인 스테인리스 스틸 (고급 은색 메탈)
      const panMat = M.silverHairline(0xdfe4ec, 0.28);
      const jambMat = M.silverHairline(0xc5cdd6, 0.35);
      const ribMat = M.silverHairline(0xa2acb8, 0.40);
      const sillMat = M.ss(0xc0c8d0);
      const mats = getStickerMats();

      for (let i = 0; i < FLOORS; i++) {
        const fy = FLOOR_Y[i];
        const dy = fy + dh / 2 + 0.06;

        function makeHatchDoor(xSign) {
          const g = new THREE.Group();
          // 승장 도어 패널 (프리미엄 실버 헤어라인 스테인리스)
          createBox(dw, dh, dt, panMat, 0, 0, 0, g);
          // 세로 장식 인레이 슬릿 (은색 메탈 포인트)
          for (let s = -1; s <= 1; s++) {
            createBox(0.006, dh - 0.04, dt + 0.003, ribMat, s * (dw * 0.25), 0, 0, g);
          }
          
          const isLeftFromLobby = xSign < 0;
          const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.132, 0.132), isLeftFromLobby ? mats.L : mats.R);
          const stickerX = -xSign * 0.189;
          sticker.position.set(stickerX, 0.45 + dh * 0.1, dt / 2 + 0.002);
          g.add(sticker);

          // Door Guide Shoe: 패널 하단 블록 (홀 실 홈 삽입)
          [-0.12, 0.12].forEach(gx => createBox(0.045, 0.030, 0.022, ribMat, gx, -dh/2-0.015, 0, g));

          // 패널 후면(승강로 쪽) 세로 보강 리브 2줄 — PLAN 152901
          [-dw * 0.22, dw * 0.22].forEach(rbx => {
            createBox(0.05, dh * 0.94, 0.012, ribMat, rbx, 0, -dt / 2 - 0.006, g);
          });

          return g;
        }

        const hl = makeHatchDoor(-1), hr = makeHatchDoor(1);
        hl.position.set(-cx, dy, hz); hr.position.set(cx, dy, hz);
        hl.userData = { cx: -cx, ox: -ox }; hr.userData = { cx: cx, ox: ox };
        hatchDoors.push({ left: hl, right: hr });
        scene.add(hl, hr);

        // ─── 삼방틀 (Jamb & Transom) — 프리미엄 실버 헤어라인 스테인리스 ───
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
