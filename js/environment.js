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

    // 정점 해시 — 시임(seam) 중복 정점이 같은 방향으로 움직이도록 위치 기반 난수
    function vertHash(x, y, z, seed) {
      const s = Math.sin(x * 12.9898 + y * 37.719 + z * 78.233 + seed) * 43758.5453;
      return s - Math.floor(s);
    }

    // 산 지형 — 다층 노이즈 변위 + 초록→바위→설산 (procedural.eu 느낌의 실사 톤)
    function createMountainGeometry(r, h, seed, snowy) {
      let geo = new THREE.ConeGeometry(r, h, 16, 10);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const t = (y + h / 2) / h;
        const n1 = vertHash(x * 0.4, y * 0.2, z * 0.4, seed);
        const n2 = vertHash(x * 1.1, y * 0.5, z * 1.1, seed + 11);
        const n3 = vertHash(x * 2.4, y, z * 2.4, seed + 29);
        const amp = r * (0.28 * (1 - t * 0.55) * (0.55 + n1) + 0.08 * n2 + 0.04 * n3);
        const ang = Math.atan2(z, x);
        pos.setX(i, x + Math.cos(ang) * amp * (n1 - 0.35));
        pos.setZ(i, z + Math.sin(ang) * amp * (n2 - 0.35));
        if (t > 0.02 && t < 0.97) {
          pos.setY(i, y + (n3 - 0.5) * h * 0.08 * (1 - t));
        }
      }
      geo = geo.toNonIndexed();
      const p2 = geo.attributes.position;
      const colors = new Float32Array(p2.count * 3);
      const cBase = new THREE.Color(0x3d6b28);
      const cMid  = new THREE.Color(0x5a7a48);
      const cRock = new THREE.Color(0x7a8580);
      const cSnow = new THREE.Color(0xf2f6fa);
      const cTop  = new THREE.Color(0x2f5224);
      const tmp = new THREE.Color();
      for (let i = 0; i < p2.count; i++) {
        const t = Math.max(0, Math.min(1, (p2.getY(i) + h / 2) / h));
        const shade = 0.88 + 0.14 * vertHash(p2.getX(i), p2.getY(i), p2.getZ(i), seed + 3);
        if (snowy) {
          if (t < 0.38) tmp.copy(cBase).lerp(cMid, t / 0.38);
          else if (t < 0.62) tmp.copy(cMid).lerp(cRock, (t - 0.38) / 0.24);
          else tmp.copy(cRock).lerp(cSnow, Math.min(1, (t - 0.62) / 0.22));
        } else {
          tmp.copy(cBase).lerp(cTop, t * 0.85);
          if (t > 0.75) tmp.lerp(cRock, (t - 0.75) / 0.25 * 0.45);
        }
        tmp.multiplyScalar(shade);
        colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      return geo;
    }

    // 원거리 연속 능선 (콘 나열 대신 실사 지형 실루엣)
    function buildMountainRidge(parent, z, width, depth, peakH, seed) {
      const segX = 80, segZ = 16;
      let geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const cBase = new THREE.Color(0x3a6228);
      const cRock = new THREE.Color(0x6e7872);
      const cSnow = new THREE.Color(0xeef3f7);
      const tmp = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), zz = pos.getZ(i);
        const nx = x / (width * 0.5);
        const nz = zz / (depth * 0.5);
        const ridge = Math.exp(-nx * nx * 0.55) * (0.55 + 0.45 * Math.cos(nx * 4.2 + seed));
        const n1 = vertHash(x * 0.08, 0, zz * 0.12, seed);
        const n2 = vertHash(x * 0.22, 1, zz * 0.3, seed + 5);
        const h = peakH * ridge * (0.65 + 0.35 * n1) * (0.85 + 0.2 * n2) * (1 - Math.abs(nz) * 0.35);
        pos.setY(i, Math.max(0.05, h));
        const t = Math.min(1, h / peakH);
        if (t < 0.45) tmp.copy(cBase).lerp(cRock, t / 0.45 * 0.4);
        else if (t < 0.72) tmp.copy(cBase).lerp(cRock, 0.4 + (t - 0.45) / 0.27 * 0.5);
        else tmp.copy(cRock).lerp(cSnow, (t - 0.72) / 0.28);
        const shade = 0.9 + 0.12 * n2;
        colors[i * 3] = tmp.r * shade;
        colors[i * 3 + 1] = tmp.g * shade;
        colors[i * 3 + 2] = tmp.b * shade;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, stylizedMat(0.68, 0.45));
      mesh.position.set(0, Y0 - 0.2, z);
      mesh.userData = { type: 'bg-mountain-ridge' };
      parent.add(mesh);
    }

    // 스타일라이즈드 언릿 재질 (정점 컬러 + 하프램버트 + 안개) — 지형 셰이더 공용
    function stylizedMat(amb, gain) {
      return new THREE.ShaderMaterial({
        vertexShader: TERRAIN_VERT,
        fragmentShader: TERRAIN_FRAG,
        uniforms: {
          uAmb: { value: amb != null ? amb : 0.72 },
          uGain: { value: gain != null ? gain : 0.4 },
          uFogColor: { value: new THREE.Color(BG_HORIZON) },
          uFogDensity: { value: BG_FOG_D }
        },
        vertexColors: true
      });
    }

    // ── 보도블록(벽돌) 포장 재질 — 프로시저럴 캔버스 텍스처 ──
    let paverCanvas = null;
    function makePaverMaterial(w, d) {
      if (!paverCanvas) {
        // 2m × 2m 타일 (벽돌 0.5m × 0.25m, 러닝본드)
        paverCanvas = document.createElement('canvas');
        paverCanvas.width = 256;
        paverCanvas.height = 256;
        const ctx = paverCanvas.getContext('2d');
        ctx.fillStyle = '#877e70'; // 줄눈
        ctx.fillRect(0, 0, 256, 256);
        const shades = ['#b6ad9e', '#aaa093', '#c2b8a9', '#a99f8e', '#b1a698', '#bcb2a2'];
        const BW = 64, BH = 32;
        for (let row = 0; row < 8; row++) {
          const off = (row % 2) * (BW / 2);
          for (let col = -1; col < 4; col++) {
            const x = col * BW + off;
            const y = row * BH;
            const h = Math.abs(Math.sin(row * 12.9898 + col * 78.233) * 43758.5453) % 1;
            ctx.fillStyle = h < 0.08 ? '#a5836f' : shades[Math.floor(h * shades.length) % shades.length];
            ctx.fillRect(x + 1.5, y + 1.5, BW - 3, BH - 3);
            // 윗변 하이라이트 (블록 입체감)
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.fillRect(x + 1.5, y + 1.5, BW - 3, 3);
          }
        }
      }
      const tex = new THREE.CanvasTexture(paverCanvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(w / 2, d / 2);
      tex.anisotropy = 4;
      return new THREE.MeshBasicMaterial({ map: tex });
    }

    // ── 수풀형 가로수 — 줄기 + 불규칙 블롭 수관 (정점 컬러 로우폴리) ──
    let TREE_MAT = null;
    function buildTree(parent, x, z, s) {
      if (!TREE_MAT) TREE_MAT = stylizedMat();
      const grpT = new THREE.Group();

      // 줄기 — 위로 갈수록 가늘고 살짝 기움
      const th = (1.0 + Math.random() * 0.4) * s;
      const trunkGeo = new THREE.CylinderGeometry(0.06 * s, 0.12 * s, th, 6, 2).toNonIndexed();
      const tp = trunkGeo.attributes.position;
      const tCols = new Float32Array(tp.count * 3);
      const cTrunk = new THREE.Color(0x6b4a2a);
      for (let i = 0; i < tp.count; i++) {
        const j = 0.82 + vertHash(tp.getX(i), tp.getY(i), tp.getZ(i), 3) * 0.3;
        tCols[i * 3] = cTrunk.r * j;
        tCols[i * 3 + 1] = cTrunk.g * j;
        tCols[i * 3 + 2] = cTrunk.b * j;
      }
      trunkGeo.setAttribute('color', new THREE.BufferAttribute(tCols, 3));
      trunkGeo.computeVertexNormals();
      const trunk = new THREE.Mesh(trunkGeo, TREE_MAT);
      trunk.position.set(0, th / 2, 0);
      trunk.rotation.z = (Math.random() - 0.5) * 0.14;
      grpT.add(trunk);

      // 수관 — 울퉁불퉁한 이코사 블롭 4~6개 병합
      const blobN = 4 + Math.floor(Math.random() * 3);
      const parts = [];
      for (let b = 0; b < blobN; b++) {
        const r = (0.45 + Math.random() * 0.4) * s;
        const bx = (Math.random() - 0.5) * 1.1 * s;
        const by = th + (0.35 + Math.random() * 0.8) * s;
        const bz = (Math.random() - 0.5) * 1.1 * s;
        const g = new THREE.IcosahedronGeometry(r, 1); // 비인덱스 지오메트리
        const gp = g.attributes.position;
        for (let i = 0; i < gp.count; i++) {
          const m = 0.8 + vertHash(gp.getX(i), gp.getY(i), gp.getZ(i), b) * 0.4;
          gp.setXYZ(i, gp.getX(i) * m, gp.getY(i) * m * 0.88, gp.getZ(i) * m);
        }
        g.applyMatrix4(new THREE.Matrix4().makeTranslation(bx, by, bz));
        parts.push(g);
      }
      let total = 0;
      parts.forEach(g => { total += g.attributes.position.count; });
      const posArr = new Float32Array(total * 3);
      let off = 0;
      parts.forEach(g => {
        posArr.set(g.attributes.position.array, off);
        off += g.attributes.position.array.length;
      });
      const canopyGeo = new THREE.BufferGeometry();
      canopyGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      // 정점 색 — 아래 짙은 초록, 위 밝은 초록 + 나무마다 색조 변주
      const cp = canopyGeo.attributes.position;
      let minY = 1e9, maxY = -1e9;
      for (let i = 0; i < cp.count; i++) {
        minY = Math.min(minY, cp.getY(i));
        maxY = Math.max(maxY, cp.getY(i));
      }
      const warm = Math.random() * 0.1;
      const cBot = new THREE.Color(0x2e5c1e);
      const cTop = new THREE.Color(0x5fa835);
      const cCols = new Float32Array(cp.count * 3);
      const tmpC = new THREE.Color();
      for (let i = 0; i < cp.count; i++) {
        const t = (cp.getY(i) - minY) / Math.max(0.001, maxY - minY);
        const j = 0.9 + vertHash(cp.getX(i), cp.getY(i), cp.getZ(i), 9) * 0.2;
        tmpC.copy(cBot).lerp(cTop, Math.pow(t, 0.8));
        cCols[i * 3] = (tmpC.r + warm * 0.6) * j;
        cCols[i * 3 + 1] = tmpC.g * j;
        cCols[i * 3 + 2] = tmpC.b * j;
      }
      canopyGeo.setAttribute('color', new THREE.BufferAttribute(cCols, 3));
      canopyGeo.computeVertexNormals();
      const canopy = new THREE.Mesh(canopyGeo, TREE_MAT);
      canopy.rotation.y = Math.random() * Math.PI * 2;
      grpT.add(canopy);

      grpT.position.set(x, Y0, z);
      grpT.userData = { type: 'tree' };
      parent.add(grpT);
    }

    function buildMountainRange(parent) {
      // 원거리 능선 2층
      buildMountainRidge(parent, -58, 160, 28, 22, 3);
      buildMountainRidge(parent, -48, 140, 22, 16, 9);

      const mat = stylizedMat(0.7, 0.42);
      // 건물 뒤 겹침 방지: 중앙 봉우리는 z≤-50 (전면 도달 z≈-37, 캠퍼스 후면 -35 밖),
      // 근경 봉우리는 건물이 없는 좌우 측면(|x|≥44)에만 배치
      const layers = [
        { z: -50, peaks: [[-48, 12], [-28, 15], [-10, 18], [8, 16], [26, 14], [44, 12]] },
        { z: -40, peaks: [[-58, 12], [-44, 13], [46, 12], [60, 11]] }
      ];
      layers.forEach((layer, li) => {
        layer.peaks.forEach(([x, h], pi) => {
          const snowy = h >= 13;
          const geo = createMountainGeometry(h * 0.72, h, li * 31 + pi * 7 + 3, snowy);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(x, Y0 + h / 2 - 0.5, layer.z);
          mesh.rotation.y = vertHash(x, h, layer.z, 5) * Math.PI * 0.4;
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

      // t_length.png — 세로형 배너, 타워 높이의 약 2/3 감김 (승강기안전기술원)
      new THREE.TextureLoader().load('assets/bg/t_length.png', (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = 8;
        const bandH = towerH * (2 / 3); // ≈ 14.7m
        const aspect = tex.image.width / tex.image.height; // ≈ 0.179
        const bandW = bandH * aspect;
        // 가로 비율 유지 — 원통 정면(+Z)에 세로 배너로 감김
        const thetaSpan = Math.min(Math.PI * 0.95, bandW / towerR);
        const thetaStart = -(thetaSpan / 2);
        const labelY = Y0 + towerH / 2;
        const label = new THREE.Mesh(
          new THREE.CylinderGeometry(towerR + 0.012, towerR + 0.012, bandH, 72, 1, true, thetaStart, thetaSpan),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
        );
        label.position.set(0, labelY, 0);
        label.userData = { type: 'tower-label' };
        grp.add(label);
      });

      // ── 부속 건물 3동 — 사무동 스타일 (기단·리본창·멀리언·파라펫) ──
      const wallMat = M.ss(0x8f959b);
      const bandMat = M.ss(0x6d7278);
      const frameMat = M.ss(0x565b60);
      const officeGlass = new THREE.MeshPhysicalMaterial({
        color: 0x3a6ea8, transmission: 0.55, opacity: 1, transparent: true,
        roughness: 0.12, ior: 1.5, metalness: 0.1, side: THREE.DoubleSide
      });

      // 리본 창 헬퍼 — axis 'z': 전후면(폭=X방향), 'x': 측면(폭=Z방향)
      function ribbonWindow(cx, cy, cz, w, h, axis) {
        const n = Math.max(2, Math.round(w / 0.75));
        if (axis === 'z') {
          createBox(w, h, 0.05, officeGlass, cx, cy, cz, grp);
          for (let i = 0; i <= n; i++) {
            createBox(0.045, h + 0.06, 0.07, frameMat, cx - w / 2 + (w / n) * i, cy, cz, grp);
          }
          createBox(w + 0.08, 0.06, 0.07, frameMat, cx, cy + h / 2, cz, grp);
          createBox(w + 0.08, 0.06, 0.07, frameMat, cx, cy - h / 2, cz, grp);
        } else {
          createBox(0.05, h, w, officeGlass, cx, cy, cz, grp);
          for (let i = 0; i <= n; i++) {
            createBox(0.07, h + 0.06, 0.045, frameMat, cx, cy, cz - w / 2 + (w / n) * i, grp);
          }
          createBox(0.07, 0.06, w + 0.08, frameMat, cx, cy + h / 2, cz, grp);
          createBox(0.07, 0.06, w + 0.08, frameMat, cx, cy - h / 2, cz, grp);
        }
      }

      // [A동] 연구사무동 2층 — 리본창 + 층간 밴드 + 옥상 설비
      const aX = -5, aZ = -2, aW = 6, aD = 4, AF = 2.1;
      const aH = 0.3 + AF * 2 + 0.4;
      createBox(aW, aH, aD, wallMat, aX, Y0 + aH / 2, aZ, grp);
      createBox(aW + 0.15, 0.3, aD + 0.15, bandMat, aX, Y0 + 0.15, aZ, grp); // 기단
      for (let f = 0; f < 2; f++) {
        const wy = Y0 + 0.3 + AF * f + AF * 0.58;
        ribbonWindow(aX, wy, aZ + aD / 2 + 0.04, aW - 0.9, 1.05, 'z'); // 전면
        ribbonWindow(aX, wy, aZ - aD / 2 - 0.04, aW - 0.9, 1.05, 'z'); // 후면
        ribbonWindow(aX - aW / 2 - 0.04, wy, aZ, aD - 0.9, 1.05, 'x'); // 좌측면
      }
      createBox(aW + 0.1, 0.26, aD + 0.1, bandMat, aX, Y0 + 0.3 + AF, aZ, grp);   // 층간 밴드
      createBox(aW + 0.2, 0.16, aD + 0.2, bandMat, aX, Y0 + aH + 0.08, aZ, grp);  // 파라펫 캡
      createBox(aW + 0.22, 0.24, 0.1, blueRoof, aX, Y0 + aH - 0.18, aZ + aD / 2 + 0.1, grp); // 블루 어센트
      createBox(1.6, 0.55, 1.1, M.ss(0xc0c6cc), aX - 1.2, Y0 + aH + 0.36, aZ - 0.6, grp);    // 옥상 실외기

      // [B동] 안내동 1층 — 스토어프론트 유리 + 출입문 + 오버행 지붕
      const bX = -5, bZ = 3, bW = 4, bD = 3, bH = 3.0;
      createBox(bW, bH, bD, wallMat, bX, Y0 + bH / 2, bZ, grp);
      createBox(bW + 0.12, 0.25, bD + 0.12, bandMat, bX, Y0 + 0.125, bZ, grp);
      // 전면 스토어프론트 (문 우측 + 유리 좌측)
      createBox(bW - 1.9, 1.55, 0.05, officeGlass, bX - 0.75, Y0 + 1.1, bZ + bD / 2 + 0.04, grp);
      createBox(0.05, 1.55 + 0.06, 0.07, frameMat, bX - 1.55, Y0 + 1.1, bZ + bD / 2 + 0.04, grp);
      createBox(0.05, 1.55 + 0.06, 0.07, frameMat, bX + 0.05, Y0 + 1.1, bZ + bD / 2 + 0.04, grp);
      createBox(bW - 1.8, 0.06, 0.07, frameMat, bX - 0.75, Y0 + 1.88, bZ + bD / 2 + 0.04, grp);
      // 양개 유리문
      createBox(0.72, 1.8, 0.05, officeGlass, bX + 0.85, Y0 + 0.95, bZ + bD / 2 + 0.05, grp);
      createBox(0.8, 0.08, 0.09, frameMat, bX + 0.85, Y0 + 1.88, bZ + bD / 2 + 0.05, grp);
      createBox(0.05, 1.8, 0.08, frameMat, bX + 0.85, Y0 + 0.95, bZ + bD / 2 + 0.05, grp);
      // 측면 창 + 오버행 지붕 + 블루 파샤
      ribbonWindow(bX - bW / 2 - 0.04, Y0 + 1.55, bZ, bD - 0.8, 0.9, 'x');
      createBox(bW + 0.5, 0.14, bD + 0.5, white, bX, Y0 + bH + 0.07, bZ, grp);
      createBox(bW + 0.54, 0.28, 0.1, blueRoof, bX, Y0 + bH - 0.1, bZ + bD / 2 + 0.28, grp);

      // [C동] 인증시험동 2층 — 전면 커튼월 + 출입 캐노피
      const cX = 4, cZ = 1, cW = 5, cD = 4, cH = 5.2;
      createBox(cW, cH, cD, wallMat, cX, Y0 + cH / 2, cZ, grp);
      createBox(cW + 0.15, 0.3, cD + 0.15, bandMat, cX, Y0 + 0.15, cZ, grp);
      // 전면 커튼월 그리드
      const cgW = cW - 0.8, cgH = cH - 1.5;
      createBox(cgW, cgH, 0.06, officeGlass, cX, Y0 + cgH / 2 + 0.35, cZ + cD / 2 + 0.05, grp);
      for (let i = 0; i <= 6; i++) {
        createBox(0.05, cgH + 0.08, 0.08, frameMat, cX - cgW / 2 + (cgW / 6) * i, Y0 + cgH / 2 + 0.35, cZ + cD / 2 + 0.06, grp);
      }
      for (let r = 0; r <= 3; r++) {
        createBox(cgW + 0.08, 0.06, 0.08, frameMat, cX, Y0 + 0.35 + (cgH / 3) * r, cZ + cD / 2 + 0.06, grp);
      }
      // 출입 캐노피 + 슬림 기둥
      createBox(2.2, 0.12, 1.2, white, cX - 0.9, Y0 + 2.25, cZ + cD / 2 + 0.62, grp);
      createCylinder(0.05, 0.05, 2.2, M.ss(0xcdd2d8), cX - 1.75, Y0 + 1.1, cZ + cD / 2 + 1.05, grp);
      createCylinder(0.05, 0.05, 2.2, M.ss(0xcdd2d8), cX - 0.05, Y0 + 1.1, cZ + cD / 2 + 1.05, grp);
      // 측면·후면 리본창 (2층)
      for (let f = 0; f < 2; f++) {
        const wy = Y0 + 0.3 + 2.25 * f + 1.35;
        ribbonWindow(cX + cW / 2 + 0.04, wy, cZ, cD - 0.9, 1.0, 'x');
        ribbonWindow(cX, wy, cZ - cD / 2 - 0.04, cW - 0.9, 1.0, 'z');
      }
      createBox(cW + 0.2, 0.16, cD + 0.2, bandMat, cX, Y0 + cH + 0.08, cZ, grp);   // 파라펫 캡
      createBox(cW + 0.22, 0.24, 0.1, blueRoof, cX, Y0 + cH - 0.18, cZ + cD / 2 + 0.1, grp);
      createBox(1.4, 0.5, 1.0, M.ss(0xc0c6cc), cX + 1.3, Y0 + cH + 0.33, cZ - 1.0, grp); // 옥상 실외기

      // 캠퍼스 조경수
      buildTree(grp, 7.2, 4.2, 0.9);
      buildTree(grp, -8.4, 4.9, 0.95);

      // Z-fighting 방지: 글로벌 ground top(Y0+0.05)보다 명확히 위로 띄움
      createBox(14, 0.06, 10, makePaverMaterial(14, 10), 0, Y0 + 0.10, 0, grp);
      createBox(10, 0.05, 6, new THREE.MeshBasicMaterial({ color: 0x4a7a30 }), -1, Y0 + 0.12, -4, grp);

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
      const grassMat = new THREE.MeshBasicMaterial({ color: 0x4a8a2e }); // 잔디 (언릿)
      const leafMat  = new THREE.MeshBasicMaterial({ color: 0x4d8c30 }); // 나뭇잎 (언릿 플랫)
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
      // 전면 보도블록 포장
      createBox(LW + 14, 0.06, 12, makePaverMaterial(LW + 14, 12), 0, Y0 + 0.08, LFZ + 4.5, grp);
      // 측면 잔디
      createBox(7, 0.05, LD + 4, grassMat, -LW / 2 - 3.5, Y0 + 0.075, FZ + LD / 2, grp);
      createBox(7, 0.05, LD + 4, grassMat,  LW / 2 + 3.5, Y0 + 0.075, FZ + LD / 2, grp);

      // ── 가로수 (수풀형 블롭 수관) ──
      // 로비 정면 가로수
      [-11, -8, -5, 5, 8, 11].forEach(tx => {
        buildTree(grp, tx, LFZ + 2.5, 1.15);
      });
      // 측면 가로수
      [-LW / 2 - 1, LW / 2 + 1].forEach(tx => {
        [2, 6, 10].forEach(tz => {
          buildTree(grp, tx, FZ + tz, 1.0);
        });
      });

      grp.userData = { type: 'bg-koelsa' };
      parent.add(grp);
    }

    const BG_SKY = 0x7ec8f0;       // 상단 시안
    const BG_HORIZON = 0xe8f4fc;   // 수평선 거의 흰색
    const BG_GROUND = 'rgba(74,69,63,1)';
    const BG_FOG_D = 0.0050;       // 지형 가장자리가 horizon 색에 녹아드는 안개 밀도

    function createBgGradientTexture(w, h, drawFn) {
      const cvs = document.createElement('canvas');
      cvs.width = w;
      cvs.height = h;
      const ctx = cvs.getContext('2d');
      drawFn(ctx, w, h);
      return new THREE.CanvasTexture(cvs);
    }

    function applyStylizedSky() {
      // 화면 고정 background 대신 하늘 돔 — 저각도에서도 지평선 아래가 horizon 색으로 이어짐
      const skyTex = createBgGradientTexture(4, 256, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0.00, '#3f9fe8');
        g.addColorStop(0.45, '#7fc4f2');
        g.addColorStop(0.62, '#c8e8fa');
        g.addColorStop(0.72, '#eef7fc');
        g.addColorStop(1.00, '#eef7fc'); // 하부 반구 = horizon (안개색과 연속)
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });
      skyTex.magFilter = THREE.LinearFilter;
      skyTex.minFilter = THREE.LinearFilter;

      const skyDome = new THREE.Mesh(
        new THREE.SphereGeometry(95, 32, 24),
        new THREE.MeshBasicMaterial({
          map: skyTex,
          side: THREE.BackSide,
          fog: false,
          depthWrite: false
        })
      );
      skyDome.name = 'skyDome';
      skyDome.renderOrder = -1;
      scene.add(skyDome);

      scene.background = new THREE.Color(BG_HORIZON); // far 밖 fallback
      scene.fog = new THREE.FogExp2(BG_HORIZON, BG_FOG_D);
    }

    // 로우폴리 뭉게구름 — 구 블롭 병합 + 평평한 밑면 + 아랫면 음영 정점 컬러
    function createCloudGeometry(seed) {
      const blobN = 5 + Math.floor(vertHash(seed, 1, 2, 0) * 3);
      const parts = [];
      for (let b = 0; b < blobN; b++) {
        const r = 0.55 + vertHash(seed, b, 3, 1) * 0.6;
        const bx = (vertHash(seed, b, 5, 2) - 0.5) * 3.2;
        const by = vertHash(seed, b, 7, 3) * 0.55;
        const bz = (vertHash(seed, b, 11, 4) - 0.5) * 1.3;
        const g = new THREE.SphereGeometry(r, 7, 5).toNonIndexed();
        g.applyMatrix4(new THREE.Matrix4().makeScale(1.15, 0.72, 1));
        g.applyMatrix4(new THREE.Matrix4().makeTranslation(bx, by, bz));
        parts.push(g);
      }
      let total = 0;
      parts.forEach(g => { total += g.attributes.position.count; });
      const posArr = new Float32Array(total * 3);
      let off = 0;
      parts.forEach(g => {
        posArr.set(g.attributes.position.array, off);
        off += g.attributes.position.array.length;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      // 평평한 밑면
      const p = geo.attributes.position;
      let minY = 1e9, maxY = -1e9;
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) < -0.12) p.setY(i, -0.12 - (p.getY(i) + 0.12) * 0.18);
        minY = Math.min(minY, p.getY(i));
        maxY = Math.max(maxY, p.getY(i));
      }
      // 아래는 청회색, 위는 흰색
      const cBot = new THREE.Color(0xc9d8e6);
      const cTop = new THREE.Color(0xffffff);
      const colors = new Float32Array(p.count * 3);
      const tmp = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const t = (p.getY(i) - minY) / (maxY - minY);
        tmp.copy(cBot).lerp(cTop, Math.pow(t, 0.7));
        colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      return geo;
    }

    function buildSoftClouds(parent) {
      const cloudGrp = new THREE.Group();
      cloudGrp.name = 'softClouds';
      cloudGrp.userData = { type: 'bg-clouds' };

      const mat = stylizedMat(0.9, 0.22); // 구름은 밝고 음영 약하게
      // [각도(도), 반경, 높이, 스케일] — 어느 방향에서 봐도 구름이 보이도록 링 배치
      const placements = [
        [15, 70, 30, 7], [55, 85, 36, 9], [100, 75, 28, 6.5],
        [150, 90, 38, 10], [195, 80, 32, 8], [240, 72, 27, 6],
        [285, 88, 40, 9.5], [330, 78, 33, 7.5]
      ];
      placements.forEach(([deg, rad, y, s], i) => {
        const a = deg * Math.PI / 180;
        const geo = createCloudGeometry(i * 17 + 4);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(Math.cos(a) * rad, Y0 + y, Math.sin(a) * rad);
        mesh.rotation.y = vertHash(i, deg, rad, 9) * Math.PI * 2;
        mesh.scale.set(s, s * 0.85, s);
        mesh.userData = { type: 'bg-cloud' };
        cloudGrp.add(mesh);
      });
      parent.add(cloudGrp);
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
        applyStylizedSky();
      };

      const bgZ = -36;
      addPhotoSidePanel(parent, 'assets/bg/koelsa2.png', 'left', bgZ, tryHide3d, onFail);
      addPhotoSidePanel(parent, 'assets/bg/koelsa.png', 'right', bgZ, tryHide3d, onFail);
    }

    /* ── 자연 지형 + 풀밭 시스템 (스타일라이즈드) ──────────────────────
       terrainHeight(x,z) : 완만한 구릉 높이. 시설물 부지는 flattenMask로 0 수렴.
       buildTerrain()     : 정점 컬러 구릉 지형 메시.
       buildGrassField()  : InstancedMesh + 커스텀 셰이더 풀잎 (바람 애니메이션).
       buildFlowerField() : 들꽃 + 씨앗 줄기 포인트.
    ------------------------------------------------------------------ */
    const FLAT_ZONES = [ // 지형 평탄화 부지 {cx, cz, hw, hd, blend}
      { cx: 0,   cz: 1.2,   hw: 4.2,  hd: 5.2,  blend: 7 },   // 승강로 + 전면 포장
      { cx: -17, cz: -28,   hw: 8.6,  hd: 6.4,  blend: 9 },   // koelsa2 캠퍼스 부지
      { cx: 17,  cz: -24.5, hw: 14.0, hd: 10.5, blend: 10 },  // 본관 타워 + 로비
      { cx: 17,  cz: -11,   hw: 20.0, hd: 6.2,  blend: 9 }    // 본관 전면 보도블록 광장
    ];
    const NO_GRASS_RECTS = [ // 풀잎 산포 제외 footprint {cx, cz, hw, hd}
      { cx: 0,   cz: -0.2,  hw: 3.6,  hd: 3.4 },   // 승강로 벽체
      { cx: 0,   cz: 3.4,   hw: 3.6,  hd: 2.2 },   // 승강로 전면 포장
      { cx: -17, cz: -28,   hw: 7.6,  hd: 5.6 },   // 캠퍼스 패드
      { cx: 17,  cz: -24.5, hw: 13.0, hd: 10.2 },  // 본관 건물
      { cx: 17,  cz: -11,   hw: 19.7, hd: 6.1 }    // 본관 전면 보도블록 광장
    ];
    const STREAM_PATH = [
      [38, -20], [40, -8], [42, 4], [44, 16], [43, 28], [40, 40]
    ];

    function distToStream(x, z) {
      let best = 1e9;
      for (let i = 0; i < STREAM_PATH.length - 1; i++) {
        const [x1, z1] = STREAM_PATH[i];
        const [x2, z2] = STREAM_PATH[i + 1];
        const dx = x2 - x1, dz = z2 - z1;
        const len2 = dx * dx + dz * dz;
        let t = ((x - x1) * dx + (z - z1) * dz) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = x1 + dx * t - x, pz = z1 + dz * t - z;
        const d = Math.sqrt(px * px + pz * pz);
        if (d < best) best = d;
      }
      return best;
    }

    function smooth01(t) {
      const c = Math.max(0, Math.min(1, t));
      return c * c * (3 - 2 * c);
    }

    function flattenMask(x, z) {
      let m = 1;
      for (let i = 0; i < FLAT_ZONES.length; i++) {
        const zn = FLAT_ZONES[i];
        const dx = Math.max(Math.abs(x - zn.cx) - zn.hw, 0);
        const dz = Math.max(Math.abs(z - zn.cz) - zn.hd, 0);
        m *= smooth01(Math.sqrt(dx * dx + dz * dz) / zn.blend);
      }
      m *= smooth01((distToStream(x, z) - 2.2) / 6);
      return m;
    }

    function terrainHeight(x, z) {
      // 옥타브 사인 노이즈 (0..1) — 완만한 구릉
      const n1 = 0.5 + 0.5 * Math.sin(x * 0.021 - 0.8) * Math.cos(z * 0.018 + 1.1);
      const n2 = 0.5 + 0.5 * Math.sin(x * 0.045 + 1.7) * Math.cos(z * 0.052 + 0.4);
      const n3 = 0.5 + 0.5 * Math.sin(x * 0.11 + 4.1) * Math.cos(z * 0.09 + 2.3);
      let h = (n1 * 0.55 + n2 * 0.33 + n3 * 0.12) * 3.6;
      // 원거리 스웰 — 지평선 방향으로 풀 언덕이 솟도록
      const r = Math.sqrt(x * x + z * z);
      h += smooth01((r - 32) / 95) * 3.2;
      return h * flattenMask(x, z);
    }

    function isInNoGrassZone(x, z) {
      for (let i = 0; i < NO_GRASS_RECTS.length; i++) {
        const rc = NO_GRASS_RECTS[i];
        if (Math.abs(x - rc.cx) < rc.hw && Math.abs(z - rc.cz) < rc.hd) return true;
      }
      return distToStream(x, z) < 1.7;
    }

    const TERRAIN_VERT = `
      uniform float uAmb;
      uniform float uGain;
      varying vec3 vColor;
      varying float vFog;
      varying float vLight;
      void main() {
        vColor = color;
        // 언릿 스타일라이즈드 — 완만한 하프램버트 음영만 적용
        float nd = max(dot(normalize(vec3(0.35, 0.8, 0.45)), normalize(normal)), 0.0);
        vLight = uAmb + uGain * nd;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFog = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `;

    const TERRAIN_FRAG = `
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec3 vColor;
      varying float vFog;
      varying float vLight;
      void main() {
        gl_FragColor = vec4(vColor * vLight, 1.0);
        #include <tonemapping_fragment>
        float f = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, clamp(f, 0.0, 1.0));
      }
    `;

    function buildTerrain(parent) {
      const span = 280;
      const seg = 140;
      const geo = new THREE.PlaneGeometry(span, span, seg, seg);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const cLow = new THREE.Color(0x2b5c1a);
      const cHigh = new THREE.Color(0x4a8c2c);
      const tmp = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const h = terrainHeight(x, z);
        pos.setY(i, h);
        // 높이 + 노이즈 혼합 틴트 (평탄 부지 경계가 색 경계로 드러나지 않도록)
        const n = 0.5 + 0.5 * Math.sin(x * 0.13 + 2.0) * Math.cos(z * 0.11 - 0.7);
        const t = Math.min(1, h / 7) * 0.55 + n * 0.45;
        const jitter = 0.92 + 0.1 * (0.5 + 0.5 * Math.sin(x * 0.9 + z * 1.3));
        tmp.copy(cLow).lerp(cHigh, t).multiplyScalar(jitter);
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        vertexShader: TERRAIN_VERT,
        fragmentShader: TERRAIN_FRAG,
        uniforms: {
          uAmb: { value: 0.72 },
          uGain: { value: 0.4 },
          uFogColor: { value: new THREE.Color(BG_HORIZON) },
          uFogDensity: { value: BG_FOG_D }
        },
        vertexColors: true
      }));
      mesh.position.set(0, Y0 + 0.01, 0);
      mesh.userData = { type: 'terrain' };
      parent.add(mesh);
    }

    const windTime = { value: 0 }; // 풀·꽃 셰이더 공유 시간 uniform

    const GRASS_VERT = `
      uniform float uTime;
      varying float vT;
      varying float vFog;
      varying vec3 vTint;
      void main() {
        vT = position.y;
        #ifdef USE_INSTANCING
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          vec4 wp = modelMatrix * vec4(position, 1.0);
        #endif
        float ph = wp.x * 0.32 + wp.z * 0.27;
        float sway = sin(uTime * 1.7 + ph) * 0.65 + sin(uTime * 3.1 + ph * 2.7) * 0.35;
        float amp = vT * vT * 0.16;
        wp.x += sway * amp;
        wp.z += cos(uTime * 1.3 + ph * 1.4) * amp * 0.6;
        vTint = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vTint = instanceColor;
        #endif
        vec4 mvPosition = viewMatrix * wp;
        vFog = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const GRASS_FRAG = `
      uniform vec3 uBase;
      uniform vec3 uTip;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying float vT;
      varying float vFog;
      varying vec3 vTint;
      void main() {
        float k = pow(clamp(vT, 0.0, 1.0), 1.35);
        vec3 col = mix(uBase, uTip, k) * vTint;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        float f = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, clamp(f, 0.0, 1.0));
      }
    `;

    function createBladeGeometry() {
      // 끝이 뾰족하고 앞으로 휘어진 풀잎 (폭 0.075, 높이 1)
      const geo = new THREE.PlaneGeometry(0.075, 1, 1, 4);
      geo.translate(0, 0.5, 0);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const t = p.getY(i);
        p.setX(i, p.getX(i) * Math.pow(1 - t, 0.85));
        p.setZ(i, t * t * 0.25);
      }
      return geo;
    }

    function scatterOnGrass(n, rMin, rMax) {
      // 시설물·개울을 피해 지형 위 산포 좌표 생성
      const pts = [];
      let guard = n * 6;
      while (pts.length < n && guard-- > 0) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(rMin * rMin + (rMax * rMax - rMin * rMin) * Math.random());
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (isInNoGrassZone(x, z)) continue;
        pts.push([x, z]);
      }
      return pts;
    }

    function buildGrassField(parent) {
      const grassMat = new THREE.ShaderMaterial({
        vertexShader: GRASS_VERT,
        fragmentShader: GRASS_FRAG,
        uniforms: {
          uTime: windTime,
          uBase: { value: new THREE.Color(0x1f5416) },
          uTip: { value: new THREE.Color(0x6fb23a) },
          uFogColor: { value: new THREE.Color(BG_HORIZON) },
          uFogDensity: { value: BG_FOG_D }
        },
        side: THREE.DoubleSide
      });

      const bladeGeo = createBladeGeometry();
      const dummy = new THREE.Object3D();
      const tint = new THREE.Color();

      // [개수, 반경 min/max, 스케일 배율] — 근경 밀집 / 원경 큰 잎으로 커버
      const tiers = [
        [78000, 0, 45, 1.0],
        [40000, 45, 115, 1.8]
      ];
      tiers.forEach(([count, rMin, rMax, sMul], ti) => {
        const pts = scatterOnGrass(count, rMin, rMax);
        const inst = new THREE.InstancedMesh(bladeGeo, grassMat, pts.length);
        inst.userData = { type: 'grass-blade-inst' };
        inst.frustumCulled = false;
        for (let i = 0; i < pts.length; i++) {
          const [x, z] = pts[i];
          const y = Y0 + terrainHeight(x, z);
          dummy.position.set(x, y - 0.02, z);
          dummy.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.4);
          const h = (0.34 + Math.random() * 0.48) * sMul;
          dummy.scale.set((0.75 + Math.random() * 0.6) * sMul, h, 1);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
          // 잎마다 미세 색 변주 (가끔 노란기 도는 잎)
          const warm = Math.random() < 0.1 ? 0.14 : 0;
          tint.setRGB(
            0.72 + Math.random() * 0.26 + warm,
            0.76 + Math.random() * 0.26,
            0.7 + Math.random() * 0.22
          );
          inst.setColorAt(i, tint);
        }
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        if (ti === 0) {
          inst.onBeforeRender = () => { windTime.value = performance.now() * 0.001; };
        }
        parent.add(inst);
      });
    }

    function createFlowerGeometry(headSize) {
      // 줄기 판 1장 + 교차 꽃잎 판 2장 병합 (non-indexed 수동 병합)
      const parts = [];
      const stem = new THREE.PlaneGeometry(0.042, 1, 1, 2);
      stem.translate(0, 0.5, 0);
      parts.push(stem.toNonIndexed());
      const h1 = new THREE.PlaneGeometry(headSize, headSize);
      h1.translate(0, 1.02 + headSize * 0.3, 0);
      parts.push(h1.toNonIndexed());
      const h2 = h1.clone();
      h2.rotateY(Math.PI / 2);
      parts.push(h2);
      let total = 0;
      parts.forEach(g => { total += g.attributes.position.count; });
      const posArr = new Float32Array(total * 3);
      let off = 0;
      parts.forEach(g => {
        posArr.set(g.attributes.position.array, off);
        off += g.attributes.position.array.length;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      return geo;
    }

    const FLOWER_FRAG = `
      uniform vec3 uStem;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying float vT;
      varying float vFog;
      varying vec3 vTint;
      void main() {
        // 줄기(vT<1)는 진녹색, 꽃 머리(vT>=1)는 인스턴스 색
        vec3 col = mix(uStem, vTint, step(0.98, vT));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        float f = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, clamp(f, 0.0, 1.0));
      }
    `;

    function buildFlowerField(parent) {
      const palettes = [
        [0xffffff, 0xf2b8c6, 0xe8795a, 0x8fb8e8, 0xf5d76e], // 들꽃
        [0xfdf6e8, 0xf0e6d2] // 씨앗 줄기 (밝은 이삭)
      ];
      const specs = [
        { clusters: 80, per: 9, spread: 1.3, head: 0.2, hMin: 0.62, hMax: 1.0, pal: 0 },  // 들꽃 군락
        { clusters: 55, per: 5, spread: 1.6, head: 0.09, hMin: 1.0, hMax: 1.55, pal: 1 }  // 이삭 줄기 군락
      ];
      const tint = new THREE.Color();
      const dummy = new THREE.Object3D();
      specs.forEach(spec => {
        const mat = new THREE.ShaderMaterial({
          vertexShader: GRASS_VERT,
          fragmentShader: FLOWER_FRAG,
          uniforms: {
            uTime: windTime,
            uStem: { value: new THREE.Color(0x275219) },
            uFogColor: { value: new THREE.Color(BG_HORIZON) },
            uFogDensity: { value: BG_FOG_D }
          },
          side: THREE.DoubleSide
        });
        const geo = createFlowerGeometry(spec.head);
        // 군락 중심 산포 → 중심마다 같은 색 꽃 여러 송이 (색종이처럼 흩어져 보이지 않도록)
        const centers = scatterOnGrass(spec.clusters, 0, 55);
        const pal = palettes[spec.pal];
        const pts = [];
        centers.forEach(([cx, cz]) => {
          const col = pal[Math.floor(Math.random() * pal.length)];
          const n = Math.max(3, Math.round(spec.per * (0.6 + Math.random() * 0.8)));
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * spec.spread;
            const x = cx + Math.cos(a) * r;
            const z = cz + Math.sin(a) * r;
            if (isInNoGrassZone(x, z)) continue;
            pts.push([x, z, col]);
          }
        });
        const inst = new THREE.InstancedMesh(geo, mat, pts.length);
        inst.userData = { type: 'flower-inst' };
        inst.frustumCulled = false;
        for (let i = 0; i < pts.length; i++) {
          const [x, z, col] = pts[i];
          dummy.position.set(x, Y0 + terrainHeight(x, z) - 0.02, z);
          dummy.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.16);
          const h = spec.hMin + Math.random() * (spec.hMax - spec.hMin);
          dummy.scale.set(1, h, 1);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
          tint.set(col);
          inst.setColorAt(i, tint);
        }
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        parent.add(inst);
      });
    }

    function buildStreamAndRocks(parent) {
      const streamGrp = new THREE.Group();
      streamGrp.name = 'natureStream';
      streamGrp.userData = { type: 'nature-stream' };

      // ── 곡선 리본 개울 (세그먼트 이음새 없이 연속) ──
      const curve = new THREE.CatmullRomCurve3(
        STREAM_PATH.map(([x, z]) => new THREE.Vector3(x, 0, z))
      );
      const SEG = 64;
      const centers = curve.getSpacedPoints(SEG);
      const normals = [];
      for (let i = 0; i <= SEG; i++) {
        const tan = curve.getTangentAt(i / SEG);
        normals.push(new THREE.Vector3(-tan.z, 0, tan.x).normalize());
      }

      // width(t) 가변 폭 리본 + UV (V=흐름방향, U=폭)
      function buildRibbon(halfW, y, wobbleSeed) {
        const posArr = new Float32Array((SEG + 1) * 2 * 3);
        const uvArr = new Float32Array((SEG + 1) * 2 * 2);
        let dist = 0;
        const dists = [0];
        for (let i = 1; i <= SEG; i++) {
          dist += centers[i].distanceTo(centers[i - 1]);
          dists.push(dist);
        }
        const total = Math.max(0.001, dist);
        for (let i = 0; i <= SEG; i++) {
          const c = centers[i], n = normals[i];
          const w = halfW * (0.85 + 0.3 * vertHash(i, wobbleSeed, 3, 0));
          posArr.set([c.x - n.x * w, y, c.z - n.z * w], i * 6);
          posArr.set([c.x + n.x * w, y, c.z + n.z * w], i * 6 + 3);
          const v = dists[i] / total * 6.0; // 흐름 방향 타일
          uvArr.set([0, v], i * 4);
          uvArr.set([1, v], i * 4 + 2);
        }
        const idx = [];
        for (let i = 0; i < SEG; i++) {
          const a = i * 2, b = a + 1, c2 = a + 2, d = a + 3;
          idx.push(a, b, c2, b, d, c2);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        return geo;
      }

      const waterTime = { value: 0 };
      const WATER_VERT = `
        varying vec2 vUv;
        varying float vFog;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFog = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `;
      // 주기 패턴 없이 fBm 노이즈를 흐름 방향으로 이류(advection)시켜
      // 실제 개울처럼 불규칙한 물살·포말·반짝임을 만든다.
      const WATER_FRAG = `
        uniform float uTime;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uFoam;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        uniform vec2 uRocks[9]; // 징검돌 (u, v) — 주위 포말 링
        varying vec2 vUv;
        varying float vFog;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          return vnoise(p) * 0.55 + vnoise(p * 2.17 + 11.3) * 0.28 + vnoise(p * 4.31 + 27.7) * 0.17;
        }

        void main() {
          float u = vUv.x;            // 0(좌안)..1(우안)
          float v = vUv.y * 9.0;      // 흐름 방향
          float t = uTime;

          // 물줄기 좌우 살랑임 — 흐름 무늬가 직선으로 미끄러지지 않게 왜곡
          float sway = (fbm(vec2(u * 1.5, v * 0.22 - t * 0.28)) - 0.5) * 1.2;

          // 속도가 다른 노이즈 3겹 (느린 큰 물결 / 중간 잔물결 / 빠른 미세 무늬)
          float n1 = fbm(vec2(u * 2.6 + sway, v * 0.55 - t * 0.9));
          float n2 = fbm(vec2(u * 4.2 - sway * 0.7, v * 1.1 - t * 1.6) + 31.7);
          float n3 = vnoise(vec2(u * 9.0 + sway * 0.4, v * 2.6 - t * 2.6) + 7.3);

          // 깊이 색 — 가장자리 얕고 중심 깊게, 노이즈로 일렁임
          float edge = abs(u - 0.5) * 2.0;
          float shallow = edge * edge * 0.7 + n1 * 0.5;
          vec3 col = mix(uDeep, uShallow, clamp(shallow, 0.0, 1.0));
          col *= 0.9 + n2 * 0.2;

          // 징검돌 주위 포말 링 (물이 바위를 감싸며 흐르는 느낌)
          float rockFoam = 0.0;
          for (int i = 0; i < 9; i++) {
            vec2 d = vec2((u - uRocks[i].x) * 2.3, (v - uRocks[i].y) * 1.1);
            float dist = length(d) + (n3 - 0.5) * 0.25;
            rockFoam += smoothstep(0.5, 0.18, dist) * 0.8;
          }

          // 가장자리 포말 — 노이즈로 불규칙하게 들쭉날쭉
          float foamEdge = smoothstep(0.78, 1.0, edge + (n3 - 0.5) * 0.4);
          // 물살 위 드문드문 흰 거품 조각
          float foamStreak = smoothstep(0.83, 0.95, n2) * smoothstep(0.45, 0.8, n3) * 0.6;
          float foam = clamp(foamEdge + foamStreak + rockFoam, 0.0, 1.0);
          col = mix(col, uFoam, foam * 0.8);

          // 햇빛 반짝임
          float sparkle = smoothstep(0.93, 1.0, vnoise(vec2(u * 22.0, v * 5.0 - t * 3.4)));
          col += sparkle * 0.35;

          gl_FragColor = vec4(col, 0.88);
          #include <tonemapping_fragment>
          float f = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, clamp(f, 0.0, 1.0));
        }
      `;

      // 모래 바닥
      const sandMesh = new THREE.Mesh(buildRibbon(1.55, Y0 + 0.035, 5),
        new THREE.MeshBasicMaterial({ color: 0x9d8f74 }));
      sandMesh.userData = { type: 'stream-bed' };
      streamGrp.add(sandMesh);

      // 징검돌 (u,v) — 배치 시 채워짐. 셰이더 v스케일(vUv.y*9, vUv.y=t*6)에 맞춤
      const rockUVs = [];
      for (let i = 0; i < 9; i++) rockUVs.push(new THREE.Vector2(-10, -10));

      const waterMat = new THREE.ShaderMaterial({
        vertexShader: WATER_VERT,
        fragmentShader: WATER_FRAG,
        uniforms: {
          uTime: waterTime,
          uDeep: { value: new THREE.Color(0x1e5a82) },
          uShallow: { value: new THREE.Color(0x6eb8e0) },
          uFoam: { value: new THREE.Color(0xe8f4fa) },
          uRocks: { value: rockUVs },
          uFogColor: { value: new THREE.Color(BG_HORIZON) },
          uFogDensity: { value: BG_FOG_D }
        },
        transparent: true,
        depthWrite: false
      });
      const waterMesh = new THREE.Mesh(buildRibbon(1.15, Y0 + 0.062, 11), waterMat);
      waterMesh.userData = { type: 'stream-water' };
      waterMesh.onBeforeRender = () => { waterTime.value = performance.now() * 0.001; };
      streamGrp.add(waterMesh);

      // ── 로우폴리 바위 — 물가 양옆 + 물속 징검돌 ──
      const rockMat = stylizedMat();
      const rockGeos = [0x9aa4ab, 0x7e8890, 0xb4bcc2].map((col, gi) => {
        const g = new THREE.DodecahedronGeometry(1, 0).toNonIndexed();
        const p = g.attributes.position;
        const cols = new Float32Array(p.count * 3);
        const base = new THREE.Color(col);
        for (let i = 0; i < p.count; i++) {
          const j = 0.92 + vertHash(p.getX(i), p.getY(i), p.getZ(i), gi) * 0.16;
          cols[i * 3] = base.r * j; cols[i * 3 + 1] = base.g * j; cols[i * 3 + 2] = base.b * j;
        }
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        g.computeVertexNormals();
        return g;
      });

      function placeRock(x, z, s, gi, sink) {
        const rock = new THREE.Mesh(rockGeos[gi], rockMat);
        rock.position.set(x, Y0 + s * (0.55 - sink), z);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        rock.scale.set(s, s * (0.6 + Math.random() * 0.3), s * (0.8 + Math.random() * 0.35));
        rock.userData = { type: 'stream-rock' };
        streamGrp.add(rock);
      }

      // 물가 양옆 바위 (군데군데 2~3개씩 뭉침)
      for (let i = 0; i < 26; i++) {
        const t = (i + 0.5) / 26;
        const c = curve.getPointAt(t);
        const n = normals[Math.round(t * SEG)];
        const side = i % 2 === 0 ? 1 : -1;
        const cnt = Math.random() < 0.4 ? 2 : 1;
        for (let k = 0; k < cnt; k++) {
          const off = 1.25 + Math.random() * 0.7 + k * 0.45;
          placeRock(
            c.x + n.x * off * side + (Math.random() - 0.5) * 0.3,
            c.z + n.z * off * side + (Math.random() - 0.5) * 0.3,
            0.16 + Math.random() * 0.3, i % 2, 0.25
          );
        }
      }
      // 물속 징검돌 (밝은 색, 반쯤 잠김) — 위치를 물 셰이더에 전달해 주위 포말 생성
      for (let i = 0; i < 9; i++) {
        const t = (i + Math.random() * 0.6) / 9;
        const c = curve.getPointAt(t);
        const n = normals[Math.round(t * SEG)];
        const off = (Math.random() - 0.5) * 0.9;
        placeRock(c.x + n.x * off, c.z + n.z * off, 0.14 + Math.random() * 0.18, 2, 0.45);
        rockUVs[i].set(0.5 + off / 2.3, t * 54.0);
      }

      parent.add(streamGrp);
    }

    function buildOutdoorGround(parent) {
      const g = new THREE.Group();
      g.name = 'outdoorGround';
      g.userData = { type: 'outdoor-ground' };

      const span = 280;
      createBox(span, 0.25, span, M.conc(0x3d3a36), 0, Y0 - 0.125, 0, g);

      // 구릉 지형 + 풀밭 + 들꽃 (스타일라이즈드 자연 배경)
      buildTerrain(g);
      buildGrassField(g);
      buildFlowerField(g);

      buildStreamAndRocks(g);

      // 승강로 전면 포장 — 보도블록
      createBox(S.SHAFT_W + S.WALL_T * 2 + 2.4, 0.03, 3.2, makePaverMaterial(5.2, 3.2), 0, Y0 + 0.04, S.SHAFT_D / 2 + 2.2, g);

      parent.add(g);
    }

    function buildBackground() {
      applyStylizedSky();

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
        buildSoftClouds(bg3dGrp);
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
      // 이탈리아 팔라초 팔레트: 트라버틴 석재 + 테라코타 밴드 + 딥 올리브 문틀 (형태는 기존 유지, 색만)
      const wallMat = M.conc(0xb8956a);
      const terracottaMat = M.paint(0xa95032);
      const oliveMat = M.paint(0x3f4a36);
      const wallZ = FRONT_INNER_Z + S.WALL_T / 2;
      const doorHoleW = S.DOOR_W + 0.1;
      const totalWallW = S.SHAFT_W + S.WALL_T * 2;
      const sideW = (totalWallW - doorHoleW) / 2;
      const facadeZ = wallZ + S.WALL_T / 2 + 0.012;

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

        // 팔라초식 출입구 프레임 — 딥 올리브 세로선과 테라코타 상인방
        const portalX = doorHoleW / 2 + 0.045;
        createBox(0.09, 2.56, 0.025, oliveMat, -portalX, fy + 1.28, facadeZ, wallGrp);
        createBox(0.09, 2.56, 0.025, oliveMat,  portalX, fy + 1.28, facadeZ, wallGrp);
        createBox(doorHoleW + 0.18, 0.10, 0.028, terracottaMat, 0, fy + 2.56, facadeZ + 0.002, wallGrp);

        // 층별 수평 코니스 — 단조로운 흰 수직면을 분절하는 따뜻한 테라코타 띠
        createBox(totalWallW + 0.08, 0.11, 0.035, terracottaMat,
          0, fy + fh - 0.055, facadeZ + 0.004, wallGrp);

        // 로비 대리석 바닥 (전면벽 이동에 맞춰 깊이 보정, 외부 끝 위치 유지)
        const lobbyDepth = 1.5 + (S.SHAFT_D / 2 - FRONT_INNER_Z);
        createBox(totalWallW, 0.12, lobbyDepth, M.ss(0x8b7962), 0, fy - 0.06, wallZ + S.WALL_T / 2 + lobbyDepth / 2, wallGrp);

        // 천장 Y 좌표 (해당 층 바닥 + 층고)
        const ceilingY = fy + fh;

        // 4층(최상층) 천장 캐노피 슬래브 추가
        if (i === FLOORS - 1) {
          createBox(totalWallW, 0.12, lobbyDepth, M.conc(0xb9a783), 0, ceilingY + 0.06, wallZ + S.WALL_T / 2 + lobbyDepth / 2, wallGrp);
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

      // [수정] 좌측 벽면 — 전면벽 이동에 맞춰 깊이/Z 중심 보정
      const sideWallD = S.SHAFT_D / 2 + FRONT_INNER_Z + S.WALL_T;
      const sideWallH = TOTAL_H + 2.2;
      const sideWallX = -(S.SHAFT_W / 2 + S.WALL_T / 2);
      const sideWallCZ = (FRONT_INNER_Z + S.WALL_T - S.SHAFT_D / 2) / 2;

      createBox(S.WALL_T, sideWallH, sideWallD, wallMat, sideWallX, Y0 + sideWallH / 2, sideWallCZ, wallGrp);

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
      // 폭 1.5배 확장 후 좌측벽 중심에 맞춤, 크기 20% 상향 (원본 1.76×8.8)
      const signW = 1.76 * 1.2, signH = 8.8 * 1.2;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), logoMat);
      sign.rotation.y = -Math.PI / 2;
      sign.position.set(sideWallX - 0.15, Y0 + 7.8 * 1.3, sideWallCZ);
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
      const rightRailX = S.CAR_BG / 2;   // +0.875
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
      const leftRailX = -S.CAR_BG / 2;         // -0.875
      const lOuterX   = leftRailX - 0.017;      // -0.892
      const lSwitchX  = leftRailX - 0.18;       // -1.055 (스위치 본체 X)
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
      const panelGrp = new THREE.Group();
      panelGrp.position.set(panelX, my, panelZ);
      
      // 하부 받침대 (Plinth)
      createBox(0.3, 0.1, 0.6, baseMat, 0, 0.06, 0, panelGrp);
      // 메인 캐비닛 본체
      createBox(0.3, 1.3, 0.6, cpMat, 0, 0.76, 0, panelGrp);
      // 상단 환기 박스
      createBox(0.25, 0.2, 0.55, topMat, 0, 1.51, 0, panelGrp);
      // 상단 환기구 슬릿(Slit) 디테일
      for (let i = 0; i < 4; i++) {
        createBox(0.01, 0.02, 0.4, M.paint(0x111111), 0.125, 1.45 + i * 0.04, 0, panelGrp);
      }

      // 양개형 문 (+X 즉 중앙을 바라보게)
      createBox(0.02, 1.25, 0.28, doorMat, 0.16, 0.76, -0.145, panelGrp); // 좌측 문
      createBox(0.02, 1.25, 0.28, doorMat, 0.16, 0.76,  0.145, panelGrp); // 우측 문
      // 손잡이
      createBox(0.02, 0.1, 0.01, M.paint(0x111111), 0.17, 0.76, -0.02, panelGrp);
      createBox(0.02, 0.1, 0.01, M.paint(0x111111), 0.17, 0.76,  0.02, panelGrp);

      panelGrp.scale.setScalar(1.5);
      mrGrp.add(panelGrp);

      // 제어반 덕트 (하부 빔 쪽으로 다시 연결)
      const ductMat = M.paint(0x9ca3af);
      const ductL = Math.abs(-0.6 - (panelX + 0.15)); // 하부빔 시작점(-0.6)까지
      createBox(ductL, 0.1, 0.3, ductMat, panelX + 0.15 + ductL / 2, my + 0.06, 0.45, mrGrp);

      /* ══════════════════════════════════════════════════════════════
         1. 머신 빔 (Machine Beam) + 써포트 빔 (Support Beam)
         PDF 5/31 참고: H형강 I빔 단면 2방향 배치
         ══════════════════════════════════════════════════════════════ */
      const beamMat = M.paint(0x1c2833);
      const beamWH = 0.18, beamFW = 0.15, beamTk = 0.014;
      const lowerY  = my + 0.09;
      const lowerZc = -0.10;
      const lowerL  = S.SHAFT_W - 0.28;

      // 주 I-빔 2개 (X=±0.6, Z축 방향)
      [-0.6, 0.6].forEach(bx => {
        createBox(beamTk, beamWH - beamTk * 2, lowerL, beamMat, bx, lowerY, lowerZc, mrGrp);
        createBox(beamFW, beamTk, lowerL, beamMat, bx, lowerY + (beamWH - beamTk) / 2, lowerZc, mrGrp);
        createBox(beamFW, beamTk, lowerL, beamMat, bx, lowerY - (beamWH - beamTk) / 2, lowerZc, mrGrp);
      });

      // 써포트 빔 (Support Beam) 2개 - X축 방향 가로 I-빔
      [1.26, -1.38].forEach(sz => {
        const sLen = 1.44;
        createBox(sLen, beamWH - beamTk * 2, beamTk, beamMat, 0, lowerY, sz, mrGrp);
        createBox(sLen, beamTk, beamFW, beamMat, 0, lowerY + (beamWH - beamTk) / 2, sz, mrGrp);
        createBox(sLen, beamTk, beamFW, beamMat, 0, lowerY - (beamWH - beamTk) / 2, sz, mrGrp);
      });

      // 써포트 앵글 (Support Angle) - ㄱ형강 코너 보강 4개소
      const angleMat = M.paint(0x2c3e50);
      [[-0.6, 1.26], [-0.6, -1.38], [0.6, 1.26], [0.6, -1.38]].forEach(([ax, az]) => {
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
      const pxs = [-0.6, 0.6], pzs = [-1.17, 0.57];

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
      const bedX1 = -0.66, bedX2 = 0.66;
      const bedZ1 =  0.57, bedZ2 = -1.395;
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
      [-0.42, 0.12].forEach(bz => {
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
        const gx = -0.06 + i * 0.03;
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

      // 디플렉터 시브 축 & 클레비스 브라켓 (PDF 5p ②: 시브 양옆을 감싸는 좁은 은색 브라켓)
      const bedTopY = bedY + bedFH;
      const defAxle = createCylinder(0.022, 0.022, 0.22, M.ss(0xb8bcc4), 0, defY, CWT_CENTER_Z, mrGrp);
      defAxle.rotation.z = Math.PI / 2;
      const pillowMat = M.ss(0x9ca3af);
      // 좌우 클레비스 측판 (허브 바로 바깥, 베드 프레임 안쪽으로 내려감)
      [-0.085, 0.085].forEach(dx => {
        createBox(0.014, 0.19, 0.16, pillowMat, dx, bedTopY + 0.035, CWT_CENTER_Z, mrGrp);
        createCylinder(0.035, 0.035, 0.018, pillowMat, dx * (0.10 / 0.085), defY, CWT_CENTER_Z, mrGrp)
          .rotation.z = Math.PI / 2;
      });
      // 클레비스 → 베드 연결 베이스 플레이트 (시브 양옆, 베드 후단 채널에 캔틸레버 거치)
      [-0.16, 0.16].forEach(dx => {
        createBox(0.16, 0.014, 0.22, pillowMat, dx, bedTopY + 0.007, CWT_CENTER_Z, mrGrp);
      });

      /* ══════════════════════════════════════════════════════════════
         5. 권상기 (Geared Traction Machine) — Machine Room Part 기준
         구동 일렬(Z축, 베드 장축): ④→①→드럼→⑤→웜박스  /  ②③시브 웜박스 +X 측면 90°
         tmGrp: 시브 world x≈0, 스핀축 X (mainSheaveGrp)
         ══════════════════════════════════════════════════════════════ */
      const tmGrp = new THREE.Group();
      tmGrp.name = 'TractionMachine';
      const tmR        = 0.22;
      const tmAxisY    = bedTopY + 0.30;
      const tmShvX     = 0.24;
      const tmCenterZ  = -0.20;
      tmGrp.position.set(-tmShvX * 1.5, tmAxisY, tmCenterZ);
      tmGrp.scale.setScalar(1.5);
      const tmBaseY    = bedTopY - tmAxisY;
      const tmPlateY   = tmBaseY + 0.045;

      const tmCastMat   = new THREE.MeshStandardMaterial({ color: 0x4d535c, metalness: 0.55, roughness: 0.75 });
      const tmDarkCast  = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.55, roughness: 0.85 });
      const tmSheaveMat = new THREE.MeshStandardMaterial({ color: 0x7c848e, metalness: 0.5, roughness: 0.65 });
      const tmBrkMat    = M.ss(0xbfc6ce);
      const tmDarkMat   = M.paint(0x181c20);
      const tmCoverMat  = M.paint(0xB08A20);

      const tmMotR   = 0.145;
      const tmGboxZ  = 0;
      const tmBrkZ   = 0.14;
      const tmMotorZ = 0.32;
      const tmEncZ   = 0.52;

      const tmDriveGrp = new THREE.Group();
      tmDriveGrp.name = 'TMDriveLine';
      tmGrp.add(tmDriveGrp);

      // tmBaseGrp — 베이스 플레이트 (Z 길이 방향)
      const tmBaseGrp = new THREE.Group();
      tmBaseGrp.name = 'TMBase';
      const tmBaseCZ = (tmGboxZ + tmEncZ) / 2;
      createBox(0.34, 0.03, 0.82, tmDarkCast, 0, tmPlateY, tmBaseCZ, tmBaseGrp);
      createBox(0.14, 0.03, 0.20, tmDarkCast, tmShvX + 0.02, tmPlateY, tmGboxZ, tmBaseGrp);
      [-0.18, 0.14].forEach(cx => {
        createBox(0.10, 0.05, 0.90, bedMat, cx, tmBaseY + 0.025, tmBaseCZ, tmBaseGrp);
      });
      tmGrp.add(tmBaseGrp);

      // tmEncGrp — ④ 엔코더 (PDF 4p ④: 짙은 챠콜 납작 원반 + 중앙 관통 보어)
      const tmEncMat = new THREE.MeshStandardMaterial({ color: 0x26292e, metalness: 0.15, roughness: 0.85 });
      const tmEncGrp = new THREE.Group();
      tmEncGrp.name = 'TMEncoder';
      tmEncGrp.position.set(0, 0, tmEncZ);
      // 모터축 스터브 (모터 전면 → 엔코더 연결)
      createCylinder(0.017, 0.017, 0.040, M.ss(0x9aa0a8), 0, 0, -0.015, tmEncGrp).rotation.x = Math.PI / 2;
      // 본체 원반 (지름 대비 납작한 퍽 형상)
      createCylinder(0.047, 0.047, 0.052, tmEncMat, 0, 0, 0.028, tmEncGrp).rotation.x = Math.PI / 2;
      // 중앙 보어 (전후면 3mm 돌출 흑색 실린더로 구멍 표현)
      createCylinder(0.015, 0.015, 0.058, M.paint(0x14161a), 0, 0, 0.028, tmEncGrp).rotation.x = Math.PI / 2;
      tmDriveGrp.add(tmEncGrp);

      // tmMotorGrp — ① 전동기 (PDF 4p ①: 매끈한 원통 몸체 + 전면 1/3 흑색 축방향 핀 드럼 + 후면 대형 사각 플랜지)
      const tmMotorGrp = new THREE.Group();
      tmMotorGrp.name = 'TMMotor';
      tmMotorGrp.position.set(0, 0, tmMotorZ);
      // 몸체 — 리브 없는 매끈한 주물 원통 (z −0.13 ~ +0.055)
      createCylinder(tmMotR, tmMotR, 0.185, tmCastMat, 0, 0, -0.0375, tmMotorGrp).rotation.x = Math.PI / 2;
      // 전면(+Z, 엔코더측) 흑색 핀 드럼 — 원통 둘레 축방향 냉각핀 (z +0.055 ~ +0.165)
      const tmFaceMat = new THREE.MeshStandardMaterial({ color: 0x141619, metalness: 0.1, roughness: 0.9 });
      const tmFanCoverMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.05, roughness: 0.8 });
      const tmVentMat = new THREE.MeshStandardMaterial({ color: 0x33383e, metalness: 0.1, roughness: 0.85 });
      const tmShaftMat = new THREE.MeshStandardMaterial({ color: 0xcfd5dc, metalness: 0.9, roughness: 0.25 });
      createCylinder(0.140, 0.140, 0.110, tmFaceMat, 0, 0, 0.110, tmMotorGrp).rotation.x = Math.PI / 2;
      for (let i = 0; i < 28; i++) {
        const finA = i * Math.PI / 14;
        const fin = createBox(0.006, 0.011, 0.110, tmVentMat,
          Math.cos(finA) * 0.1435, Math.sin(finA) * 0.1435, 0.110, tmMotorGrp);
        fin.rotation.z = finA + Math.PI / 2;
      }
      // Fan Cover — PDF ① 정면: 흑색 림 + 이중 링 슬롯 그릴 + 은색 중앙 허브
      const tmSlotMat = new THREE.MeshStandardMaterial({ color: 0x060606, metalness: 0.0, roughness: 0.95 });
      const tmHubMat  = new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 1.0, roughness: 0.18 });
      const tmPcbMat  = new THREE.MeshStandardMaterial({ color: 0x2d5a32, metalness: 0.1, roughness: 0.7 });
      const tmFanZ    = 0.168;
      const tmFaceZ   = 0.176;
      // 외곽 두꺼운 림 + 면판
      createCylinder(0.152, 0.152, 0.012, tmFanCoverMat, 0, 0, tmFanZ, tmMotorGrp).rotation.x = Math.PI / 2;
      createCylinder(0.138, 0.138, 0.006, tmFanCoverMat, 0, 0, tmFaceZ, tmMotorGrp).rotation.x = Math.PI / 2;
      // 림 둘레 8개 육각 볼트
      for (let i = 0; i < 8; i++) {
        const boltA = i * Math.PI / 4 + Math.PI / 8;
        createCylinder(0.007, 0.007, 0.010, M.ss(0xb8bcc4),
          Math.cos(boltA) * 0.132, Math.sin(boltA) * 0.132, tmFaceZ + 0.002, tmMotorGrp).rotation.x = Math.PI / 2;
        createCylinder(0.004, 0.004, 0.004, M.paint(0x888888),
          Math.cos(boltA) * 0.132, Math.sin(boltA) * 0.132, tmFaceZ + 0.007, tmMotorGrp).rotation.x = Math.PI / 2;
      }
      // 하단 좌측 커넥터 포트
      createBox(0.022, 0.012, 0.008, tmFanCoverMat,
        Math.cos(-Math.PI * 0.72) * 0.142, Math.sin(-Math.PI * 0.72) * 0.142, tmFaceZ + 0.001, tmMotorGrp);
      // 외곽 링 — 긴 방사형 슬롯 (48개, pill형 착시)
      for (let i = 0; i < 48; i++) {
        const slotA = i * Math.PI / 24;
        const rMid = 0.098;
        const slot = createBox(0.078, 0.011, 0.005, tmSlotMat,
          Math.cos(slotA) * rMid, Math.sin(slotA) * rMid, tmFaceZ + 0.001, tmMotorGrp);
        slot.rotation.z = slotA;
      }
      // 내곽 링 — 짧은 방사형 슬롯 (24개, 외곽과 정렬)
      for (let i = 0; i < 24; i++) {
        const slotA = i * Math.PI / 12;
        const slot = createBox(0.034, 0.009, 0.005, tmSlotMat,
          Math.cos(slotA) * 0.048, Math.sin(slotA) * 0.048, tmFaceZ + 0.001, tmMotorGrp);
        slot.rotation.z = slotA;
      }
      // 중앙 허브 — 다층 은색 플랜지 + 보어 + 키웨이
      createCylinder(0.048, 0.048, 0.006, tmHubMat, 0, 0, tmFaceZ + 0.004, tmMotorGrp).rotation.x = Math.PI / 2;
      createCylinder(0.030, 0.030, 0.010, tmHubMat, 0, 0, tmFaceZ + 0.009, tmMotorGrp).rotation.x = Math.PI / 2;
      createCylinder(0.014, 0.014, 0.012, M.paint(0x0a0c0e), 0, 0, tmFaceZ + 0.007, tmMotorGrp).rotation.x = Math.PI / 2;
      createBox(0.004, 0.008, 0.008, M.paint(0x1a1a1a), 0, 0.012, tmFaceZ + 0.007, tmMotorGrp);
      [0, Math.PI * 2 / 3, Math.PI * 4 / 3].forEach(scA => {
        createCylinder(0.0025, 0.0025, 0.004, M.ss(0x555555),
          Math.cos(scA) * 0.024, Math.sin(scA) * 0.024, tmFaceZ + 0.014, tmMotorGrp).rotation.x = Math.PI / 2;
      });
      // 허브 뒤 엔코더 PCB 힌트
      createCylinder(0.026, 0.026, 0.004, tmPcbMat, 0, 0, tmFaceZ - 0.001, tmMotorGrp).rotation.x = Math.PI / 2;
      // Center Shaft — 엔코더 결합용 얇은 은색 금속축
      createCylinder(0.006, 0.006, 0.088, tmShaftMat, 0, 0, tmFaceZ + 0.052, tmMotorGrp).rotation.x = Math.PI / 2;
      // 후면(−Z, 브레이크측) 나팔형 확관 + 대형 사각 플랜지 판 + 모서리 볼트 4개
      createCylinder(tmMotR, 0.165, 0.024, tmCastMat, 0, 0, -0.138, tmMotorGrp).rotation.x = Math.PI / 2;
      createBox(0.35, 0.35, 0.014, tmCastMat, 0, 0, -0.157, tmMotorGrp);
      [[-0.145, -0.145], [0.145, -0.145], [-0.145, 0.145], [0.145, 0.145]].forEach(([bx, by]) => {
        createCylinder(0.009, 0.009, 0.020, M.ss(0x888e96), bx, by, -0.157, tmMotorGrp).rotation.x = Math.PI / 2;
      });
      // 상부 단자함 (후단 쪽) + 케이블 글랜드
      createBox(0.09, 0.06, 0.10, tmDarkCast, 0, tmMotR + 0.028, -0.06, tmMotorGrp);
      createCylinder(0.010, 0.010, 0.030, tmDarkCast, 0, tmMotR + 0.028, -0.125, tmMotorGrp).rotation.x = Math.PI / 2;
      // 하부 주물 받침 페데스탈 (모터 몸체 → 베이스)
      createBox(0.20, 0.115, 0.26, tmDarkCast, 0, -0.198, -0.02, tmMotorGrp);
      tmDriveGrp.add(tmMotorGrp);

      // tmBrkDrumGrp — 브레이크 드럼 (⑤ 암에 가려짐)
      const tmBrkDrumGrp = new THREE.Group();
      tmBrkDrumGrp.name = 'TMBrakeDrum';
      tmBrkDrumGrp.position.set(0, 0, tmBrkZ);
      createCylinder(0.10, 0.10, 0.044, tmDarkMat, 0, 0, 0, tmBrkDrumGrp).rotation.x = Math.PI / 2;
      tmDriveGrp.add(tmBrkDrumGrp);

      // tmBrakeGrp — ⑤ 브레이크 (드럼 r=0.10 감싸는 양측 슈, 스프링 −X, 솔레노이드 +X)
      const tmBrakeGrp = new THREE.Group();
      tmBrakeGrp.name = 'TMBrake';
      tmBrakeGrp.position.set(0, 0, tmBrkZ);
      const tmDrumR   = 0.10;
      const tmArmX    = 0.145;
      const tmPivotY  = -0.125;
      const tmTopY    = 0.175;
      const tmPadMat  = M.paint(0x1a1a1a);

      // 양측 곡면 브레이크 슈 — 드럼 좌/우(±X)를 감쌈 (PDF 4p ⑤: 암이 옆에서 조이는 구조)
      [[Math.PI / 2 - 0.62, 1.24], [-Math.PI / 2 - 0.62, 1.24]].forEach(([tStart, tLen]) => {
        const tmShoeBk = new THREE.Mesh(
          new THREE.CylinderGeometry(tmDrumR + 0.004, tmDrumR + 0.004, 0.052, 24, 1, false, tStart, tLen),
          tmBrkMat);
        tmShoeBk.rotation.x = Math.PI / 2;
        tmBrakeGrp.add(tmShoeBk);
        const tmShoePad = new THREE.Mesh(
          new THREE.CylinderGeometry(tmDrumR + 0.022, tmDrumR + 0.022, 0.046, 24, 1, false, tStart, tLen),
          tmPadMat);
        tmShoePad.rotation.x = Math.PI / 2;
        tmBrakeGrp.add(tmShoePad);
      });

      // 좌·우 수직 암 (하단 피벗, I형 리브)
      [-1, 1].forEach(s => {
        const ax = tmArmX * s;
        createBox(0.042, 0.028, 0.055, tmBrkMat, ax, tmPivotY, 0, tmBrakeGrp);
        createCylinder(0.013, 0.013, 0.048, M.ss(0x888888), ax, tmPivotY + 0.018, 0, tmBrakeGrp).rotation.x = Math.PI / 2;
        createBox(0.022, 0.24, 0.042, tmBrkMat, ax, 0.02, 0, tmBrakeGrp);
        createBox(0.008, 0.22, 0.052, tmBrkMat, ax + 0.014 * s, 0.02, 0, tmBrakeGrp);
        createBox(0.008, 0.22, 0.052, tmBrkMat, ax - 0.006 * s, 0.02, 0, tmBrakeGrp);
        createBox(0.038, 0.028, 0.038, tmBrkMat, ax, tmTopY, 0, tmBrakeGrp);
        createCylinder(0.008, 0.008, 0.042, M.ss(0x666666), ax, tmTopY, 0, tmBrakeGrp).rotation.z = Math.PI / 2;
      });

      // 상부 관통 로드 (양 암 상부 → 좌측 스프링/우측 조정너트까지 연장)
      createCylinder(0.007, 0.007, 0.47, M.ss(0x999999), 0, tmTopY, 0, tmBrakeGrp).rotation.z = Math.PI / 2;

      // 압축 스프링 (−X, 좌측 암 외측 — 로드 축 X방향으로 코일 적층, PDF 4p ⑤ 좌상단)
      createCylinder(0.024, 0.024, 0.006, M.ss(0xb8bdc4), -0.162, tmTopY, 0, tmBrakeGrp).rotation.z = Math.PI / 2;
      for (let i = 0; i < 7; i++) {
        const tmCoil = new THREE.Mesh(new THREE.TorusGeometry(0.020, 0.0045, 8, 18), tmPadMat);
        tmCoil.rotation.y = Math.PI / 2;
        tmCoil.position.set(-0.212 + i * 0.0075, tmTopY, 0);
        tmBrakeGrp.add(tmCoil);
      }
      createCylinder(0.024, 0.024, 0.006, M.ss(0xb8bdc4), -0.220, tmTopY, 0, tmBrakeGrp).rotation.z = Math.PI / 2;
      createCylinder(0.012, 0.012, 0.016, M.ss(0x878d95), -0.230, tmTopY, 0, tmBrakeGrp).rotation.z = Math.PI / 2;

      // 우측(+X) 로드 조정 너트 2개
      createCylinder(0.013, 0.013, 0.012, M.ss(0x878d95), 0.180, tmTopY, 0, tmBrakeGrp).rotation.z = Math.PI / 2;
      createCylinder(0.013, 0.013, 0.012, M.ss(0x878d95), 0.196, tmTopY, 0, tmBrakeGrp).rotation.z = Math.PI / 2;

      // 전자석 솔레노이드 (PDF 4p ⑤: 올리브색 원통 하우징 — 상단 중앙, 축은 드럼축(Z) 방향)
      const tmSolMat = M.paint(0x77732f);
      // 거치 브라켓 (암 상단 로드 위에 얹힘)
      createBox(0.105, 0.014, 0.075, tmSolMat, 0, tmTopY + 0.014, 0.005, tmBrakeGrp);
      // 본체 원통 — 축 Z방향, 시브 쪽으로 살짝 돌출
      createCylinder(0.047, 0.047, 0.105, tmSolMat, 0, tmTopY + 0.066, 0.012, tmBrakeGrp).rotation.x = Math.PI / 2;
      // 전후 엔드캡
      createCylinder(0.048, 0.048, 0.010, M.paint(0x5f5a28), 0, tmTopY + 0.066, 0.068, tmBrakeGrp).rotation.x = Math.PI / 2;
      createCylinder(0.048, 0.048, 0.010, M.paint(0x5f5a28), 0, tmTopY + 0.066, -0.044, tmBrakeGrp).rotation.x = Math.PI / 2;
      // 상부 소형 볼트 2개
      [-0.02, 0.02].forEach(bz => {
        createCylinder(0.006, 0.006, 0.014, M.ss(0xb8a84a), 0, tmTopY + 0.118, bz, tmBrakeGrp);
      });
      // 흑색 링크 플레이트 — 솔레노이드 → 좌우 암 상단 연결
      [-1, 1].forEach(s => {
        const tmLink = createBox(0.115, 0.009, 0.026, tmPadMat, s * 0.072, tmTopY + 0.032, 0, tmBrakeGrp);
        tmLink.rotation.z = -s * 0.42;
      });

      tmDriveGrp.add(tmBrakeGrp);

      // tmGboxGrp — 웜기어박스 (웜 Z축 입력, +X 시브 출력)
      const tmGboxGrp = new THREE.Group();
      tmGboxGrp.name = 'TMGearbox';
      tmGboxGrp.position.set(0, 0, tmGboxZ);
      createBox(0.22, 0.34, 0.28, tmCastMat, 0, -0.01, 0, tmGboxGrp);
      createBox(0.24, 0.05, 0.30, tmCastMat, 0, 0.165, 0, tmGboxGrp);
      createCylinder(0.022, 0.022, 0.12, M.ss(0xb0b6be), 0, -0.02, 0.08, tmGboxGrp).rotation.x = Math.PI / 2;
      createCylinder(0.026, 0.026, 0.08, M.ss(0xb8bcc4), 0.08, 0, 0, tmGboxGrp).rotation.z = Math.PI / 2;
      tmDriveGrp.add(tmGboxGrp);

      // tmSheaveGrp — ②③ 메인 시브 (웜박스 +X 측면)
      const tmSheaveGrp = new THREE.Group();
      tmSheaveGrp.name = 'MainSheave';
      tmSheaveGrp.position.set(tmShvX, 0, tmGboxZ);
      const tmShvMount = new THREE.Group();
      tmShvMount.rotation.y = Math.PI / 2;
      tmSheaveGrp.add(tmShvMount);
      const tmShvSpin = new THREE.Group();
      tmShvMount.add(tmShvSpin);
      mainSheaveGrp = tmShvSpin;

      // 림 — 로프 홈 밴드 (환형 링, 스핀축 Z 압출)
      const tmRimShape = new THREE.Shape();
      tmRimShape.absarc(0, 0, tmR, 0, Math.PI * 2, false);
      const tmRimHolePath = new THREE.Path();
      tmRimHolePath.absarc(0, 0, tmR - 0.045, 0, Math.PI * 2, true);
      tmRimShape.holes.push(tmRimHolePath);
      const tmRimGeo = new THREE.ExtrudeGeometry(tmRimShape,
        { depth: 0.13, bevelEnabled: false, curveSegments: 40 });
      tmRimGeo.translate(0, 0, -0.065);
      tmShvSpin.add(new THREE.Mesh(tmRimGeo, tmSheaveMat));

      for (let i = 0; i < 5; i++) {
        const tmGrv = new THREE.Mesh(
          new THREE.TorusGeometry(tmR + 0.003, 0.007, 10, 40), M.paint(0x111111));
        tmGrv.position.set(0, 0, -0.04 + i * 0.02);
        tmShvSpin.add(tmGrv);
      }

      // 웹 디스크 — 대형 원형 경량홀 6개 관통 (PDF 4p ②)
      const tmWebShape = new THREE.Shape();
      tmWebShape.absarc(0, 0, tmR - 0.040, 0, Math.PI * 2, false);
      for (let i = 0; i < 6; i++) {
        const holeA = i * Math.PI / 3 + Math.PI / 6;
        const tmWebHole = new THREE.Path();
        tmWebHole.absarc(Math.cos(holeA) * 0.112, Math.sin(holeA) * 0.112, 0.048, 0, Math.PI * 2, true);
        tmWebShape.holes.push(tmWebHole);
      }
      const tmWebGeo = new THREE.ExtrudeGeometry(tmWebShape,
        { depth: 0.040, bevelEnabled: false, curveSegments: 36 });
      tmWebGeo.translate(0, 0, -0.020);
      tmShvSpin.add(new THREE.Mesh(tmWebGeo, tmSheaveMat));

      // 방사형 리브 스포크 3줄 (홀 사이, 웹 면보다 돌출)
      for (let i = 0; i < 3; i++) {
        const tmSpk = createBox((tmR - 0.045) * 2, 0.034, 0.056, tmSheaveMat, 0, 0, 0, tmShvSpin);
        tmSpk.rotation.z = i * Math.PI / 3;
      }

      // 허브 + 중앙 흑색 보어
      const tmHub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.17, 20), M.ss(0x8a9298));
      tmHub.rotation.x = Math.PI / 2;
      tmShvSpin.add(tmHub);
      const tmBore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.176, 16), M.paint(0x14161a));
      tmBore.rotation.x = Math.PI / 2;
      tmShvSpin.add(tmBore);

      tmGrp.add(tmSheaveGrp);

      // ③ Sheave Cover — 골드 타공 아치 가드 (PDF 4p ③: 수직→45°경사→수평 밴드 + 후방 삼각판, 비회전)
      const tmCoverGrp = new THREE.Group();
      tmCoverGrp.name = 'SheaveCover';
      tmCoverGrp.position.set(tmShvX, 0, tmGboxZ);
      tmGrp.add(tmCoverGrp);
      const cw = 0.17;
      const covHoleMat = M.paint(0x241d06);
      const covHoleCols = [-0.04, 0.01, 0.06];   // 밴드 폭방향(X) 타공 3열

      // ① 수직 레그 (+Z 모터측) + 타공 3×5
      createBox(cw, 0.28, 0.012, tmCoverMat, 0.01, 0.0, 0.265, tmCoverGrp);
      covHoleCols.forEach(hx => {
        for (let r = 0; r < 5; r++) {
          createBox(0.02, 0.02, 0.016, covHoleMat, hx, -0.10 + r * 0.05, 0.265, tmCoverGrp);
        }
      });

      // ② 45° 경사 세그먼트 + 타공 3×3
      const covSlope = createBox(cw, 0.20, 0.012, tmCoverMat, 0.01, 0.205, 0.20, tmCoverGrp);
      covSlope.rotation.x = -Math.PI / 4;
      const covC45 = Math.cos(Math.PI / 4);
      covHoleCols.forEach(hx => {
        [-0.055, 0, 0.055].forEach(t => {
          const sHole = createBox(0.02, 0.02, 0.016, covHoleMat,
            hx, 0.205 + t * covC45, 0.20 - t * covC45, tmCoverGrp);
          sHole.rotation.x = -Math.PI / 4;
        });
      });

      // ③ 수평 톱 세그먼트 + 타공 3×4
      createBox(cw, 0.012, 0.25, tmCoverMat, 0.01, 0.275, 0.01, tmCoverGrp);
      covHoleCols.forEach(hx => {
        for (let r = 0; r < 4; r++) {
          createBox(0.02, 0.016, 0.02, covHoleMat, hx, 0.275, -0.065 + r * 0.05, tmCoverGrp);
        }
      });

      // ④ 후방 삼각판 — 톱 끝에서 디플렉터 쪽으로 45° 하강 (타공 없음)
      const covTriShape = new THREE.Shape();
      covTriShape.moveTo(-cw / 2, 0);
      covTriShape.lineTo(cw / 2, 0);
      covTriShape.lineTo(cw / 2, -0.30);
      covTriShape.closePath();
      const covTriGeo = new THREE.ExtrudeGeometry(covTriShape,
        { depth: 0.012, bevelEnabled: false });
      covTriGeo.translate(0, 0, -0.006);
      const covTri = new THREE.Mesh(covTriGeo, tmCoverMat);
      covTri.rotation.x = Math.PI / 4;
      covTri.position.set(0.01, 0.275, -0.115);
      tmCoverGrp.add(covTri);

      // 상부 골드 앵글 레일 2줄 (모터측으로 돌출 — 거치 암) + 전면 수직 지지 앵글/발판
      [-0.06, 0.08].forEach(rx => createBox(0.014, 0.014, 0.34, tmCoverMat, rx, 0.288, 0.02, tmCoverGrp));
      createBox(0.016, 0.10, 0.016, tmCoverMat, -0.06, -0.19, 0.285, tmCoverGrp);
      createBox(0.055, 0.010, 0.055, tmCoverMat, -0.06, -0.245, 0.285, tmCoverGrp);

      // 시브 ±X 베어링 필로우 블록
      createBox(0.06, 0.20, 0.12, tmCastMat, tmShvX + 0.115, -0.128, tmGboxZ, tmGrp);
      createCylinder(0.055, 0.055, 0.06, M.ss(0x9ca3af), tmShvX + 0.115, 0, tmGboxZ, tmGrp).rotation.z = Math.PI / 2;
      createBox(0.06, 0.20, 0.12, tmCastMat, tmShvX - 0.115, -0.128, tmGboxZ, tmGrp);
      createCylinder(0.055, 0.055, 0.06, M.ss(0x9ca3af), tmShvX - 0.115, 0, tmGboxZ, tmGrp).rotation.z = Math.PI / 2;

      mrGrp.add(tmGrp);

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
      const govZ = GOV_TENS_Z; // 피트 인장추 tensBaseZ와 동일 — 조속기 로프 Z 정렬 (카 후면측 배치)
      const govY = my; // 기계실 바닥면
      
      const govGrp = new THREE.Group();
      govGrp.position.set(govX, govY + 0.05, govZ);
      govGrp.scale.setScalar(1.5);
      
      // 하판 (Bottom Plate) — 두꺼운 네이비 판
      createBox(0.16, 0.035, 0.50, govStandMat, 0, 0.018, 0, govGrp);

      // 기둥 (Pillars) — 굵은 파이프 스페이서 2개 (낮게)
      const pHeight = 0.10;
      const pillar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, pHeight, 16), govStandMat);
      pillar1.position.set(0, pHeight / 2 + 0.035, 0.10);
      govGrp.add(pillar1);

      const pillar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, pHeight, 16), govStandMat);
      pillar2.position.set(0, pHeight / 2 + 0.035, -0.10);
      govGrp.add(pillar2);

      // 상판 (Top Plate)
      createBox(0.16, 0.025, 0.36, govStandMat, 0, pHeight + 0.047, 0, govGrp);

      // 디테일: 상판 로프 관통 홀 2개 — 로컬 ±0.10 × 스케일 1.5 = 월드 ±0.15 (로프 가닥 정렬)
      const holeMat = M.paint(0x050505);
      createCylinder(0.020, 0.020, 0.024, holeMat, 0, pHeight + 0.047, 0.10, govGrp);
      createCylinder(0.020, 0.020, 0.024, holeMat, 0, pHeight + 0.047, -0.10, govGrp);

      const boltHoleZ = 0.22;
      const boltHoleX = 0.05;
      createCylinder(0.005, 0.005, 0.022, holeMat, boltHoleX, 0.01, boltHoleZ, govGrp);
      createCylinder(0.005, 0.005, 0.022, holeMat, -boltHoleX, 0.01, boltHoleZ, govGrp);
      createCylinder(0.005, 0.005, 0.022, holeMat, boltHoleX, 0.01, -boltHoleZ, govGrp);
      createCylinder(0.005, 0.005, 0.022, holeMat, -boltHoleX, 0.01, -boltHoleZ, govGrp);
      
      mrGrp.add(govGrp);

      /* 7. 조속기 본체 (Overspeed Governor) — KR10-0839584 B1 도면 재구현
         근거: 도2·도3(사시) / 도4~도6(정면, 제동 전·후) / 도7·도8a~8c(스위치 복귀장치)
         부품 번호 = 특허 도면 부호.
           100 베이스 | 110 프레임(후면판+전면 베어링판) | 130 조속기휠 | 131 중심축
           140/140' 진자 | 141 트립볼트 | 143 지지편
           12 제동자(120 바디·122 연장부·123 첨예부·127 돌출턱·121a/b 복귀레버) | 13 스프링
           15 트립레버(151 힌지축·152 돌출부·153 연장편·154 속도조정볼트)
           170 라체트(171 걸림홈부 3개 @120°·177 절개공) | 180 로프고정체(182 링크·183 로프캐쳐)
           190 과속스위치 | 192 레버(평상시 수평) | 50 복귀장치(51 솔레노이드·52 작동핀·53 브라켓·530 안내홈)
           200 보조휠(200a 절개부) | 220 광센서 | 제어회로부(후면판 배면)
         ── 로프 정렬: 홈반경 로컬 0.10 × govGrp 스케일 1.5 = 월드 0.15
            → 로프 가닥(z = govZ ± 0.15)·피트 인장시브 홈(0.15)과 정확히 일치.
         ── 가동부는 전부 "피벗 원점 Group"으로 만들고 rotation.z = 0 을 대기 자세로 한다.
            추후 트립 시퀀스(elevator.js 연동 예정):
            ① 과속 → 진자(140) 원심 회동(+z) → 트립볼트(141) 회전반경 증가
            ② 141이 스위치 레버(192)를 상/하로 제낌 → 전동기 전원 차단 (1차 동작)
            ③ 동시에 트립레버(15) 회동 → 돌출부(152)가 돌출턱(127)에서 이탈
            ④ 스프링(13)이 제동자(12)를 당겨 첨예부(123)가 라체트(170) 걸림홈부(171)에 걸림
            ⑤ 휠 관성으로 라체트가 끌려 돌며 링크(182)를 당김 → 로프캐쳐(183)가
               조속기로프(135)를 휠 홈에 압착 → 로프 정지
            ⑥ 카 상부 safetyClamp(elevator.js 'safety-link')가 당겨져 비상정지장치 작동 (2차 동작)
            ⑦ 복귀: 솔레노이드(51) 작동핀(52) → 브라켓(53) 전진 → 안내홈(530)이 지지핀(54)을
               타고 레버(192)를 수평 복귀
            모든 가동부 참조는 mrGrp.userData.governor 에 노출. */
      const govYBase = pHeight + 0.04;
      const govBodyGrp = new THREE.Group();
      govBodyGrp.position.set(0, govYBase, 0);
      govBodyGrp.rotation.y = Math.PI / 2; // 로컬 +X=월드 -Z(카측 가닥·로프고정체측), 로컬 +Z=월드 +X(기계실 카메라측)

      const govBaseMat = M.paint(0x6f7780);
      const govFrmMat  = M.paint(0x2f78bd);
      const govFrmDark = M.paint(0x1f5b96);
      const silverMat  = M.ss(0xb6bcc4);
      const leverMat   = M.ss(0x9fa7b0);
      const springMat  = M.ss(0xc6ccd3);
      const goldBolt   = M.paint(0xd8c818);
      const weightMat  = M.paint(0x8a9098);
      const ratchetMat = M.ss(0x596069);
      const darkSteel  = M.ss(0x454b52);
      const holeDark   = M.paint(0x14171a);
      const swCaseMat  = M.paint(0x565c63);

      const gR  = 0.10;   // 홈반경(로컬) — ×1.5 = 월드 0.15
      const gWY = 0.225;  // 휠 중심 높이 (govWheelY 유지)

      // ─── 100 베이스 + 110 프레임 ───
      createBox(0.46, 0.036, 0.20, govBaseMat, 0, 0.018, 0, govBodyGrp);
      createBox(0.42, 0.020, 0.17, govBaseMat, 0, 0.046, 0, govBodyGrp);
      // 로프 관통 슬롯 (가닥 x = ±gR)
      createBox(0.040, 0.006, 0.055, holeDark,  gR, 0.057, 0, govBodyGrp);
      createBox(0.040, 0.006, 0.055, holeDark, -gR, 0.057, 0, govBodyGrp);
      // 베이스 앵커볼트 4개
      [[-0.20, 0.075], [0.20, 0.075], [-0.20, -0.075], [0.20, -0.075]].forEach(([bx, bz]) => {
        createCylinder(0.007, 0.007, 0.014, silverMat, bx, 0.042, bz, govBodyGrp);
      });
      // 후면판 (제어회로부 장착면) + 하부 리브
      createBox(0.32, 0.34, 0.012, govFrmMat, 0, 0.21, -0.062, govBodyGrp);
      createBox(0.34, 0.028, 0.060, govFrmDark, 0, 0.050, -0.048, govBodyGrp);
      // 전면 베어링판 (도2의 우측 지지벽 상당) + 우측 플랜지 + 축 보스
      createBox(0.085, 0.31, 0.012, govFrmMat, 0.010, 0.195, 0.072, govBodyGrp);
      createBox(0.014, 0.31, 0.026, govFrmDark, 0.058, 0.195, 0.080, govBodyGrp);
      createCylinder(0.030, 0.030, 0.016, govFrmDark, 0, gWY, 0.074, govBodyGrp).rotation.x = Math.PI / 2;
      [[-0.018, 0.062], [0.038, 0.062], [-0.018, 0.330], [0.038, 0.330]].forEach(([bx, by]) => {
        createCylinder(0.005, 0.005, 0.010, silverMat, bx, by, 0.080, govBodyGrp).rotation.x = Math.PI / 2;
      });
      // 131 중심축 (후면판 → 전면 베어링판 관통) + 전면 고정너트
      const govAxle = createCylinder(0.014, 0.014, 0.155, silverMat, 0, gWY, 0.013, govBodyGrp);
      govAxle.rotation.x = Math.PI / 2;
      createCylinder(0.021, 0.021, 0.014, M.gold(), 0, gWY, 0.093, govBodyGrp).rotation.x = Math.PI / 2;

      // ─── 130 조속기휠 (로프 구동 회전부 — 진자·제동자·트립레버 탑재) ───
      const govWheelGrpL = new THREE.Group();
      govWheelGrpL.position.set(0, gWY, 0);
      govBodyGrp.add(govWheelGrpL);
      governorWheelGrp = govWheelGrpL;

      // 림 — V홈 플랜지 2겹 + 홈 바닥(r = gR, 로프 안착선)
      [-0.011, 0.011].forEach(fz => {
        const flange = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.011, 12, 56), M.gold());
        flange.position.z = fz;
        govWheelGrpL.add(flange);
      });
      govWheelGrpL.add(new THREE.Mesh(new THREE.TorusGeometry(gR, 0.006, 8, 56), M.paint(0x2c2c2c)));
      govWheelGrpL.add(new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.008, 10, 56), M.gold()));
      for (let i = 0; i < 6; i++) {
        const ang = i * Math.PI / 3;
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0105, 0.056, 10), M.gold());
        spoke.position.set(Math.cos(ang) * 0.053, Math.sin(ang) * 0.053, 0);
        spoke.rotation.z = ang + Math.PI / 2;
        govWheelGrpL.add(spoke);
      }
      const govHub = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.055, 20), M.gold());
      govHub.rotation.x = Math.PI / 2;
      govWheelGrpL.add(govHub);

      // 200 보조휠 + 200a 절개부 — 휠 후면 동축 회전, 220 광센서가 회전속도 검출
      const auxWheel = createCylinder(0.072, 0.072, 0.010, darkSteel, 0, 0, -0.040, govWheelGrpL);
      auxWheel.rotation.x = Math.PI / 2;
      for (let i = 0; i < 8; i++) {
        const sa = i * Math.PI / 4 + 0.2;
        const slot = createBox(0.020, 0.013, 0.012, holeDark,
          Math.cos(sa) * 0.060, Math.sin(sa) * 0.060, -0.040, govWheelGrpL);
        slot.rotation.z = sa;
      }

      // 140/140' 진자 ×2 — 휠 전면에 힌지. rotation.z += 가 원심 벌어짐(트립볼트 반경 증가)
      function buildGovPendulum(mountAng) {
        const pg = new THREE.Group();
        pg.position.set(Math.cos(mountAng) * 0.070, Math.sin(mountAng) * 0.070, 0.042);
        pg.rotation.z = mountAng - Math.PI / 2; // 로컬 +x = 접선 방향
        createCylinder(0.0075, 0.0075, 0.024, silverMat, 0, 0, -0.008, pg).rotation.x = Math.PI / 2; // 힌지핀
        createBox(0.060, 0.026, 0.013, weightMat, 0.038, -0.002, 0, pg);  // 중량체 몸통
        createBox(0.030, 0.036, 0.015, weightMat, 0.078, 0.002, 0, pg);   // 선단 중량부
        // 141 트립볼트 — 전방(+z) 돌출. 과속 회동 시 회전반경 0.104→0.121로 커져 192 타격
        createCylinder(0.0055, 0.0055, 0.020, goldBolt, 0.062, 0.008, 0.016, pg).rotation.x = Math.PI / 2;
        govWheelGrpL.add(pg);
        return pg;
      }
      const govPendA = buildGovPendulum(-0.26);           // 도4의 140 — 143·15·12 연동측
      const govPendB = buildGovPendulum(-0.26 + Math.PI); // 140' — 대칭 밸런스
      // 143 지지편 — 진자 상부, 트립레버 속도조정볼트(154)와 접지
      createBox(0.030, 0.007, 0.012, leverMat, 0.018, 0.017, 0.004, govPendA);

      // 12 제동자 — 휠 전면 힌지. 스프링(13)이 중심측으로 당겨 123을 라체트에 걸리게 함
      const govPawlGrp = new THREE.Group();
      govPawlGrp.position.set(0.068, 0.030, 0.042);
      govPawlGrp.rotation.z = 2.374; // 연장부(122)가 라체트 상부 홈 방향을 향함
      govWheelGrpL.add(govPawlGrp);
      createBox(0.026, 0.022, 0.012, weightMat, 0, 0, 0, govPawlGrp);                              // 120 바디
      createCylinder(0.006, 0.006, 0.020, silverMat, 0, 0, -0.006, govPawlGrp).rotation.x = Math.PI / 2;
      createBox(0.044, 0.012, 0.010, weightMat, 0.026, 0, 0, govPawlGrp);                          // 122 연장부
      createBox(0.015, 0.016, 0.011, weightMat, 0.048, 0.002, -0.016, govPawlGrp);                 // 123 첨예부(라체트 평면 단차)
      const pawlTooth = createBox(0.013, 0.010, 0.011, weightMat, 0.054, 0.010, -0.016, govPawlGrp);
      pawlTooth.rotation.z = 0.55;                                                                 // 제1/제2 경사면(125/126)
      createBox(0.013, 0.010, 0.010, weightMat, -0.015, 0.005, 0, govPawlGrp);                     // 127 돌출턱
      const govRet1 = createCylinder(0.0035, 0.0035, 0.034, silverMat, -0.008, 0.020, 0.005, govPawlGrp);
      govRet1.rotation.z = 0.45;                                                                   // 121a 복귀레버
      const govRet2 = createCylinder(0.0035, 0.0035, 0.030, silverMat, 0.006, -0.017, 0.005, govPawlGrp);
      govRet2.rotation.z = -0.40;                                                                  // 121b 복귀레버
      // 13 인장스프링 — 연장부(122)를 휠 중심측으로 당김 (제동 예압)
      createCylinder(0.004, 0.004, 0.016, silverMat, 0.012, 0.030, 0.042, govWheelGrpL).rotation.x = Math.PI / 2;
      const govSpr13 = createCylinder(0.0028, 0.0028, 0.043, springMat, 0.032, 0.038, 0.042, govWheelGrpL);
      govSpr13.rotation.z = -1.212;

      // 15 트립레버 — 151 힌지. 평상시 152가 127을 눌러 제동자를 대기 위치에 구속
      const govTripGrp = new THREE.Group();
      govTripGrp.position.set(0.085, 0.010, 0.042);
      govWheelGrpL.add(govTripGrp);
      createCylinder(0.006, 0.006, 0.020, silverMat, 0, 0, -0.006, govTripGrp).rotation.x = Math.PI / 2; // 151 힌지축
      createBox(0.020, 0.022, 0.010, leverMat, 0, 0, 0, govTripGrp);
      createBox(0.010, 0.020, 0.008, leverMat, -0.013, 0.010, 0, govTripGrp);   // 152 돌출부 → 127 상면 가압
      createBox(0.012, 0.040, 0.008, leverMat, -0.004, -0.028, 0, govTripGrp);  // 153 연장편 → 143 방향
      createCylinder(0.004, 0.004, 0.016, goldBolt, -0.006, -0.048, 0, govTripGrp); // 154 속도조정볼트(143 접지)

      // ─── 170 라체트 — 휠과 동축·독립 회전. 걸림홈부(171) 3개 @120°, 절개공(177) ───
      const govRatchetGrp = new THREE.Group();
      govRatchetGrp.position.set(0, gWY, 0.026);
      govBodyGrp.add(govRatchetGrp);
      const ratShape = new THREE.Shape();
      const ratR = 0.068, notchD = 0.016, notchHalf = 0.10; // 홈 깊이·개구 반각(rad)
      for (let s = 0; s < 3; s++) {
        const aN = s * 2 * Math.PI / 3 + Math.PI / 2;
        const aStart = aN + notchHalf;
        const aEnd = aN + 2 * Math.PI / 3 - notchHalf;
        if (s === 0) ratShape.moveTo(Math.cos(aStart) * ratR, Math.sin(aStart) * ratR);
        ratShape.absarc(0, 0, ratR, aStart, aEnd, false);
        const aN2 = aN + 2 * Math.PI / 3;
        ratShape.lineTo(Math.cos(aN2) * (ratR - notchD), Math.sin(aN2) * (ratR - notchD)); // 173/174 경사면+172 홈
        ratShape.lineTo(Math.cos(aN2 + notchHalf) * ratR, Math.sin(aN2 + notchHalf) * ratR);
      }
      const ratMesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(ratShape, { depth: 0.012, bevelEnabled: false }), ratchetMat);
      ratMesh.position.z = -0.006;
      govRatchetGrp.add(ratMesh);
      for (let s = 0; s < 3; s++) { // 177 절개공 (충격 흡수)
        const aN = s * 2 * Math.PI / 3 + Math.PI / 2;
        const cutHole = createCylinder(0.004, 0.004, 0.014, holeDark,
          Math.cos(aN) * (ratR - notchD - 0.007), Math.sin(aN) * (ratR - notchD - 0.007), 0, govRatchetGrp);
        cutHole.rotation.x = Math.PI / 2;
      }
      createCylinder(0.030, 0.030, 0.016, ratchetMat, 0, 0, 0, govRatchetGrp).rotation.x = Math.PI / 2; // 축 칼라
      const govRatPin = createCylinder(0.005, 0.005, 0.030, silverMat,
        Math.cos(-1.05) * 0.052, Math.sin(-1.05) * 0.052, 0.014, govRatchetGrp); // 182 링크 연결핀
      govRatPin.rotation.x = Math.PI / 2;

      // ─── 180 로프고정체 — 휠 상부 우측. 암·스프링 ≈ 수평 대비 35°
      const armAng = Math.PI * 35 / 180; // 35°
      const armLen = 0.118;
      const pivX = 0.028;
      const pivY = gWY - 0.008;

      // 프레임측 피벗 러그 (암 기부)
      createBox(0.014, 0.036, 0.012, govFrmDark, pivX, pivY - 0.004, 0.022, govBodyGrp);
      createBox(0.014, 0.036, 0.012, govFrmDark, pivX, pivY - 0.004, 0.046, govBodyGrp);
      createCylinder(0.006, 0.006, 0.038, silverMat, pivX, pivY, 0.034, govBodyGrp).rotation.x = Math.PI / 2;

      // 작동암 그룹 — 피벗 원점, rotation.z += 가 로프 압착
      const govCatcherGrp = new THREE.Group();
      govCatcherGrp.position.set(pivX, pivY, 0.034);
      govBodyGrp.add(govCatcherGrp);
      // 182 링크 암 (우상향 35°)
      const catArm = createBox(armLen, 0.016, 0.012, leverMat, armLen * 0.5, 0, -0.010, govCatcherGrp);
      catArm.rotation.z = armAng;
      // 181 누름판(캐치슈) — 암 선단, 림에 면한 직사각 판
      const shoeX = Math.cos(armAng) * armLen;
      const shoeY = Math.sin(armAng) * armLen;
      createBox(0.026, 0.052, 0.022, darkSteel, shoeX, shoeY, -0.018, govCatcherGrp);
      createBox(0.005, 0.052, 0.012, holeDark, shoeX + Math.cos(armAng) * 0.014, shoeY + Math.sin(armAng) * 0.014, -0.018, govCatcherGrp);
      // 183 로프캐쳐 쐐기 — 림 홈 쪽
      createBox(0.018, 0.028, 0.016, darkSteel,
        shoeX - Math.cos(armAng) * 0.020, shoeY - Math.sin(armAng) * 0.020, -0.024, govCatcherGrp);
      createCylinder(0.004, 0.004, 0.018, silverMat, shoeX * 0.92, shoeY * 0.92, 0.004, govCatcherGrp).rotation.x = Math.PI / 2;

      // 182 보조 링크 — 라체트 핀 ↔ 암 중간 (정지 자세)
      const ratPinX = Math.cos(-1.05) * 0.052;
      const ratPinY = gWY + Math.sin(-1.05) * 0.052;
      const midX = pivX + Math.cos(armAng) * armLen * 0.45;
      const midY = pivY + Math.sin(armAng) * armLen * 0.45;
      const linkDx = midX - ratPinX;
      const linkDy = midY - ratPinY;
      const linkLen = Math.sqrt(linkDx * linkDx + linkDy * linkDy) || 0.055;
      const govLink = createBox(linkLen, 0.009, 0.006, leverMat,
        (ratPinX + midX) * 0.5, (ratPinY + midY) * 0.5, 0.040, govBodyGrp);
      govLink.rotation.z = Math.atan2(linkDy, linkDx);

      // 스프링 로드 조립체 — 181 뒤, 동일 60° 축으로 외측 연장
      const govSprGrp = new THREE.Group();
      govSprGrp.position.set(
        pivX + Math.cos(armAng) * (armLen + 0.012),
        pivY + Math.sin(armAng) * (armLen + 0.012),
        0.034);
      govSprGrp.rotation.z = armAng - Math.PI / 2; // 로컬 +Y = 35° 우상향
      govBodyGrp.add(govSprGrp);
      createCylinder(0.0045, 0.0045, 0.120, silverMat, 0, 0.060, 0, govSprGrp); // 로드
      createBox(0.022, 0.010, 0.028, darkSteel, 0, 0.004, 0, govSprGrp);       // 181 배면 누름판 받침
      createBox(0.036, 0.008, 0.032, govFrmDark, 0, 0.028, 0, govSprGrp);       // 반력 브라켓
      for (let i = 0; i < 8; i++) {
        const govCoil = new THREE.Mesh(new THREE.TorusGeometry(0.0135, 0.0035, 8, 18), springMat);
        govCoil.rotation.x = Math.PI / 2;
        govCoil.position.set(0, 0.038 + i * 0.009, 0);
        govSprGrp.add(govCoil);
      }
      createCylinder(0.016, 0.016, 0.005, silverMat, 0, 0.034, 0, govSprGrp);
      createCylinder(0.016, 0.016, 0.005, silverMat, 0, 0.106, 0, govSprGrp);
      createCylinder(0.008, 0.008, 0.007, silverMat, 0, 0.114, 0, govSprGrp);
      createCylinder(0.008, 0.008, 0.007, silverMat, 0, 0.122, 0, govSprGrp);
      // 상부 거싯 (프레임↔스프링 브라켓)
      createBox(0.014, 0.028, 0.020, govFrmDark,
        pivX + Math.cos(armAng) * (armLen + 0.02),
        pivY + Math.sin(armAng) * (armLen + 0.02) - 0.02,
        0.034, govBodyGrp);

      // ─── 190 과속스위치 + 192 레버(평상시 수평) + 50 복귀장치 (도7·도8a~8c) ───
      const govSwitchGrp = new THREE.Group();
      govSwitchGrp.name = 'govOverspeedSwitch';
      govBodyGrp.add(govSwitchGrp);
      createBox(0.026, 0.150, 0.050, govFrmDark, -0.218, 0.115, 0.030, govSwitchGrp); // 장착 채널
      createBox(0.050, 0.016, 0.050, govFrmDark, -0.206, 0.048, 0.030, govSwitchGrp); // 하부 거싯
      createBox(0.055, 0.092, 0.048, swCaseMat, -0.205, 0.225, 0.038, govSwitchGrp);  // 190 스위치 박스
      createBox(0.057, 0.0025, 0.050, holeDark, -0.205, 0.246, 0.038, govSwitchGrp);  // 커버 절개선
      [[-0.226, 0.190], [-0.184, 0.190], [-0.226, 0.260], [-0.184, 0.260]].forEach(([sx, sy]) => {
        createCylinder(0.003, 0.003, 0.005, silverMat, sx, sy, 0.063, govSwitchGrp).rotation.x = Math.PI / 2;
      });
      [0.024, 0.038, 0.052].forEach(pz => { // 전선관 포트 3개 (하면)
        createCylinder(0.0065, 0.0065, 0.010, holeDark, -0.205, 0.176, pz, govSwitchGrp);
      });
      createCylinder(0.003, 0.003, 0.115, darkSteel, -0.205, 0.118, 0.038, govSwitchGrp); // 인입 케이블
      // 192 레버 — 평상시 수평. 진자 볼트(141) 타격 시 상/하로 제껴짐 (rotation.z = ±0.55)
      const govLeverGrp = new THREE.Group();
      govLeverGrp.position.set(-0.176, 0.218, 0.056);
      govSwitchGrp.add(govLeverGrp);
      createCylinder(0.008, 0.008, 0.012, darkSteel, 0, 0, 0, govLeverGrp).rotation.x = Math.PI / 2; // 레버축
      createBox(0.046, 0.013, 0.005, leverMat, 0.026, 0, 0.004, govLeverGrp);   // 블레이드
      createBox(0.018, 0.009, 0.005, leverMat, 0.055, 0, 0.004, govLeverGrp);   // 선단(타격면, 반경≈0.114)
      createBox(0.016, 0.010, 0.005, leverMat, -0.012, 0, 0.004, govLeverGrp);  // 후단 꼬리
      const govPin54 = createCylinder(0.0035, 0.0035, 0.018, silverMat, 0.014, 0, 0.010, govLeverGrp);
      govPin54.rotation.x = Math.PI / 2;                                        // 54 지지핀 → 530 안내홈 삽입
      // 50 복귀장치 — 51 솔레노이드 → 52 작동핀 → 53 브라켓 전진 → 530(<형 홈, 531/532 경사면)이
      //               54를 안내해 레버를 수평 복귀 (도8b: 하향 제낌 / 도8c: 상향 제낌 복귀)
      createBox(0.026, 0.032, 0.026, darkSteel, -0.252, 0.218, 0.068, govSwitchGrp);       // 51 솔레노이드
      const govSolCoil = createCylinder(0.011, 0.011, 0.018, silverMat, -0.235, 0.218, 0.068, govSwitchGrp);
      govSolCoil.rotation.z = Math.PI / 2;
      const govPin52 = createCylinder(0.0035, 0.0035, 0.050, silverMat, -0.201, 0.218, 0.068, govSwitchGrp);
      govPin52.rotation.z = Math.PI / 2;                                                   // 52 작동핀
      createBox(0.008, 0.042, 0.007, leverMat, -0.173, 0.218, 0.068, govSwitchGrp);        // 53 브라켓
      const govFin531 = createBox(0.022, 0.006, 0.007, leverMat, -0.161, 0.2255, 0.068, govSwitchGrp);
      govFin531.rotation.z = -0.55;                                                        // 531 상부경사면
      const govFin532 = createBox(0.022, 0.006, 0.007, leverMat, -0.161, 0.2105, 0.068, govSwitchGrp);
      govFin532.rotation.z = 0.55;                                                         // 532 하부경사면

      // ─── 220 광센서 (U포크, 후면판 장착 — 보조휠 절개부 통과광 검출) ───
      createBox(0.022, 0.018, 0.005, darkSteel, -0.062, 0.261, -0.030, govBodyGrp);
      createBox(0.022, 0.018, 0.005, darkSteel, -0.062, 0.261, -0.052, govBodyGrp);
      createBox(0.008, 0.018, 0.030, darkSteel, -0.076, 0.261, -0.041, govBodyGrp);
      createBox(0.006, 0.010, 0.012, darkSteel, -0.076, 0.261, -0.058, govBodyGrp);

      // ─── 제어회로부 — 후면판 배면 (광센서 신호로 속도 산출·OVER/EMER 판정) ───
      createBox(0.10, 0.13, 0.008, M.paint(0x1f4d2a), 0.03, 0.20, -0.073, govBodyGrp);
      createBox(0.030, 0.020, 0.006, holeDark, 0.010, 0.23, -0.078, govBodyGrp);
      createBox(0.016, 0.012, 0.005, silverMat, 0.055, 0.17, -0.078, govBodyGrp);

      // 사양 라벨·제조 명판 (후면판 전면 상부 코너)
      createBox(0.052, 0.036, 0.004, M.paint(0xf0d64a), -0.115, 0.315, -0.054, govBodyGrp);
      createBox(0.046, 0.028, 0.004, M.ss(0xe9e9e5), 0.115, 0.315, -0.054, govBodyGrp);

      govGrp.add(govBodyGrp);

      const govScale = govGrp.scale.x;
      const govWheelWorldY = govGrp.position.y + (govYBase + gWY) * govScale;
      mrGrp.userData = {
        defY: defY,
        defZ: CWT_CENTER_Z,
        govX: govX,
        govZ: govZ,
        govWheelY: govWheelWorldY,
        govR: gR * govScale, // 월드 홈반경 0.15 — 로프 가닥 z=govZ±0.15·ui.js 회전 환산 공통
        // ── 추후 트립/복귀 애니메이션용 가동부 핸들 (rotation.z = 0 이 대기 자세) ──
        governor: {
          wheel: govWheelGrpL,          // 로프 구동 회전 (ui.js에서 사용 중)
          ratchet: govRatchetGrp,       // 제동 시 끌려 도는 라체트
          pendulums: [govPendA, govPendB], // 진자 — +z 회전이 원심 벌어짐
          pawl: govPawlGrp,             // 제동자 — +z 회전이 라체트 걸림
          tripLever: govTripGrp,        // 트립레버 — -z 회전이 구속 해제
          switchLever: govLeverGrp,     // 과속스위치 레버 — ±z 제낌 (0 = 수평 대기)
          catcherArm: govCatcherGrp,    // 로프고정체 작동암 — +z 회전이 로프 압착
          link: govLink,                // 라체트↔작동암 링크 (재배치 시 양단 핀 참조)
          resetPin: govPin52,           // 복귀 솔레노이드 작동핀 — +x(로컬) 전진
          pose: {                       // 근사 초기값 — 실제 연동 구현 시 미세조정
            rest: { pendulum: 0, pawl: 0, tripLever: 0, switchLever: 0, catcherArm: 0, ratchet: 0 },
            trip: { pendulum: 0.5, pawl: 0.22, tripLever: -0.30, switchLever: -0.55, catcherArm: 0.12, ratchet: -0.35 }
          }
        }
      };
      scene.add(mrGrp);
    }

    function buildPitFoundation() {
      pitGrp = new THREE.Group();
      createBox(S.SHAFT_W + S.WALL_T * 2, 0.2, S.SHAFT_D + S.WALL_T * 2, M.conc(), 0, Y0 - 0.1, 0, pitGrp);
      createBox(S.SHAFT_W - 0.1, 0.02, S.SHAFT_D - 0.1, M.paint(0x4b5563), 0, Y0 + 0.01, 0, pitGrp);
      
      // [추가] 1. 피트 사다리 (승강로 좌측 벽면 안쪽 — 전면벽 관통 방지)
      const ladderH = FLOOR_Y[0] + 1.1;
      // 폭 확장 후 SHAFT_D/2 기준이면 전면벽을 뚫음 → FRONT_INNER_Z 안쪽으로 배치
      const ladderZ = FRONT_INNER_Z - 0.40;
      const ladderX = -(S.SHAFT_W / 2) + 0.18; // 좌측 벽 내면에서 안쪽 이격
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
      const tensBaseZ = GOV_TENS_Z;                   // 가이드 레일 파묻힘 방지 — Z축으로 카 후면측 이격
      const tensionerY = Y0 + 0.5;               // 피트 바닥 +500mm

      // ── 1. 가이드 레일 고정 브라켓 + 피벗 암 (PDF 6p ③: 상하 요동 가능한 플랫 암)
      const bracketMat = M.ss(0x4b5563);
      const armMat = M.paint(0x8a5a28);   // 적동색 플랫 암

      // 수직 베이스판 (가이드 레일 웹/플랜지 측면에 체결되는 지지대)
      createBox(0.04, 0.45, 0.08, bracketMat,
        S.CAR_BG / 2 - 0.02, tensionerY + 0.15, 0.04, pitGrp);

      // 레일측 피벗 클레비스 + 핀 (로프 늘어짐 시 암이 회전하며 시브가 하강)
      createBox(0.035, 0.050, 0.050, bracketMat,
        tensGovX + 0.030, tensionerY + 0.40, 0.055, pitGrp);
      const tensPivPin = createCylinder(0.008, 0.008, 0.055, M.ss(0xb6bcc4),
        tensGovX + 0.030, tensionerY + 0.40, 0.055, pitGrp);
      tensPivPin.rotation.z = Math.PI / 2;

      // 적동색 플랫 암 — 피벗(레일측 상단)에서 시브 허브까지 하향 경사
      const tensArm = createBox(0.012, 0.045, 0.20, armMat,
        tensGovX + 0.030, tensionerY + 0.35, 0.1375, pitGrp);
      tensArm.rotation.x = -0.545;

      // ── 2. 인장추 하부 풀리 (Tension Sheave) ──
      // 조속기와 동일하게 휠 축을 X축으로 맞춤
      const tensionWheelSpinGrp = new THREE.Group();
      tensionWheelSpinGrp.position.set(tensGovX, tensionerY + 0.30, tensBaseZ);
      pitGrp.add(tensionWheelSpinGrp);
      tensionSheaveGrp = tensionWheelSpinGrp;

      // 금색 솔리드 디스크 시브 (PDF 6p ③) — 림 부근 장공 슬롯이 회전 확인 표식 겸용
      const tensDisc = createCylinder(0.140, 0.140, 0.035, M.gold(), 0, 0, 0, tensionWheelSpinGrp);
      tensDisc.rotation.z = Math.PI / 2;

      // 둥근 단면 림 + 외곽 로프 홈
      const tensRim = new THREE.Mesh(new THREE.TorusGeometry(0.140, 0.012, 10, 40), M.gold());
      tensRim.rotation.y = Math.PI / 2;
      tensionWheelSpinGrp.add(tensRim);
      const tensGroove = new THREE.Mesh(new THREE.TorusGeometry(0.150, 0.005, 8, 40), M.paint(0x222222));
      tensGroove.rotation.y = Math.PI / 2;
      tensionWheelSpinGrp.add(tensGroove);

      // 장공 슬롯 (디스크 관통 표현)
      createBox(0.045, 0.028, 0.065, M.paint(0x1a1508), 0, 0.098, 0, tensionWheelSpinGrp);

      // 허브 + 감청색 축 너트
      const tensHub = createCylinder(0.026, 0.026, 0.055, M.gold(), 0, 0, 0, tensionWheelSpinGrp);
      tensHub.rotation.z = Math.PI / 2;
      const tensNut = createCylinder(0.011, 0.011, 0.062, M.paint(0x223377), 0, 0, 0, tensionWheelSpinGrp);
      tensNut.rotation.z = Math.PI / 2;

      // 고정축 (허브 뒤 → 전면 피벗 암 연결)
      const tensAxle = createCylinder(0.011, 0.011, 0.075, M.ss(0xb6bcc4),
        tensGovX + 0.020, tensionerY + 0.30, tensBaseZ, pitGrp);
      tensAxle.rotation.z = Math.PI / 2;

      // ── 3. 인장추 본체 (시브 요크 → 적색 클레비스 → 슬래브형 주철 추) ──
      // 축 요크 스트랩 (시브 양옆에서 하부로)
      [-0.028, 0.028].forEach(dx => {
        createBox(0.012, 0.17, 0.05, M.ss(0x7a8290),
          tensGovX + dx, tensionerY + 0.225, tensBaseZ, pitGrp);
      });
      // 적색 클레비스 블록
      createBox(0.045, 0.075, 0.045, M.paint(0x8a1f1f),
        tensGovX, tensionerY + 0.135, tensBaseZ, pitGrp);
      // 슬래브형 인장추 (시브 면과 평행한 판형 주철 추) + 상단 마감판
      createBox(0.10, 0.34, 0.30, M.paint(0x6e737a),
        tensGovX, tensionerY - 0.06, tensBaseZ, pitGrp);
      createBox(0.11, 0.015, 0.31, M.ss(0x555555),
        tensGovX, tensionerY + 0.115, tensBaseZ, pitGrp);

      // ── 4. 조속기 로프 루프(기계실 조속기 ↔ 카 세이프티 링크 ↔ 피트 인장시브) ──
      // 조속기 휠·인장시브 모두 회전축이 X방향이므로 로프 두 가닥은 Z = tensBaseZ ± 홈반경에 걸린다.
      const gRopeMat = M.rope();
      const govData = mrGrp.userData || {};
      const govWheelY = govData.govWheelY || (Y0 + TOTAL_H + 0.42);
      const govWheelR = govData.govR || 0.14;
      const ropeR = Math.max(govWheelR, 0.15); // 풀리 홈 반경 = 가닥 Z 오프셋
      const tensShvY = tensionerY + 0.30;

      // 귀환측(자유측) 로프 — 전면(Z+) 탄젠트, 카와 무관하게 고정
      const returnPts = [
        new THREE.Vector3(tensGovX, tensShvY, tensBaseZ + ropeR),
        new THREE.Vector3(tensGovX, govWheelY, tensBaseZ + ropeR)
      ];
      pitGrp.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(returnPts), gRopeMat
      ));

      // 조속기 휠 상부 반원 + 인장시브 하부 반원 — 로프가 풀리 홈에 감기는 표현
      const wrapArc = (cy, sign) => {
        const pts = [];
        for (let i = 0; i <= 16; i++) {
          const th = Math.PI * i / 16;
          pts.push(new THREE.Vector3(
            tensGovX, cy + sign * ropeR * Math.sin(th), tensBaseZ - ropeR * Math.cos(th)));
        }
        return pts;
      };
      pitGrp.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(wrapArc(govWheelY, 1)), gRopeMat));
      pitGrp.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(wrapArc(tensShvY, -1)), gRopeMat));

      // 카 연동측(작동) 로프 — 후면(Z-) 탄젠트, 카상부 safetyClamp를 관통
      // 카 이동 시 refreshGovernorRope()가 매 프레임 갱신
      govRopeLine = new THREE.Line(new THREE.BufferGeometry(), gRopeMat);
      pitGrp.add(govRopeLine);
      govRopeData = { x: tensGovX, z: tensBaseZ - ropeR, topY: govWheelY, botY: tensShvY };
      refreshGovernorRope();

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
