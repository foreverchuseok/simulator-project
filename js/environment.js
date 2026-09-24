// 움직이지 않는 배경 및 정적 객체 생성 함수를 정의한다.
    // r128 calls scene.onBeforeRender after world matrices, before its shadow pass.
    // Cache only the main view; the overspeed inset temporarily hides other meshes.
    function installShadowCache(renderScene, mainCamera, webglRenderer) {
      const values = [];
      let cursor = 0, previousLength = -1, dirty = true;
      const previousHook = renderScene.onBeforeRender;
      function remember(value) {
        if (values[cursor] !== value) { values[cursor] = value; dirty = true; }
        cursor++;
      }
      function rememberMatrix(matrix) {
        for (let i = 0; i < 16; i++) remember(matrix.elements[i]);
      }
      function rememberAttribute(attribute) {
        remember(attribute);
        remember(attribute?.isInterleavedBufferAttribute ? attribute.data.version : attribute?.version);
      }
      function rememberMaterial(material) {
        remember(material); remember(material.version); remember(material.visible);
        remember(material.side); remember(material.shadowSide); remember(material.alphaTest);
        remember(material.map); remember(material.map?.version);
        remember(material.alphaMap); remember(material.alphaMap?.version);
        remember(material.displacementMap); remember(material.displacementMap?.version);
        remember(material.displacementScale); remember(material.displacementBias);
        // Custom clipping/deformation must explicitly refresh rather than reuse a map.
        if (material.clippingPlanes?.length || material.isShaderMaterial) dirty = true;
      }
      function visit(object) {
        if (!object.castShadow || !object.layers.test(mainCamera.layers)) return;
        if (!object.isMesh && !object.isLight) return;
        remember(object.id); rememberMatrix(object.matrixWorld);
        if (object.isLight) {
          const shadow = object.shadow;
          remember(shadow); remember(shadow.mapSize.x); remember(shadow.mapSize.y);
          rememberMatrix(shadow.camera.projectionMatrix);
          if (object.target) {
            object.target.updateWorldMatrix(true, false);
            rememberMatrix(object.target.matrixWorld);
          }
          if (!shadow.map || shadow.needsUpdate) dirty = true;
          return;
        }
        const geometry = object.geometry;
        remember(geometry); rememberAttribute(geometry.attributes.position);
        rememberAttribute(geometry.index);
        remember(geometry.drawRange.start); remember(geometry.drawRange.count);
        remember(object.frustumCulled);
        if (object.isInstancedMesh) { remember(object.count); rememberAttribute(object.instanceMatrix); }
        if (Array.isArray(object.material)) {
          remember(object.material.length);
          for (const material of object.material) rememberMaterial(material);
          for (const group of geometry.groups) {
            remember(group.start); remember(group.count); remember(group.materialIndex);
          }
        } else rememberMaterial(object.material);
        if (object.isSkinnedMesh || object.morphTargetInfluences || object.customDepthMaterial || object.customDistanceMaterial) dirty = true;
      }
      webglRenderer.shadowMap.autoUpdate = false;
      webglRenderer.domElement.addEventListener('webglcontextrestored', () => { previousLength = -1; });
      renderScene.onBeforeRender = function (r, s, c, target) {
        previousHook.call(this, r, s, c, target);
        if (c !== mainCamera || !r.shadowMap.enabled || r.shadowMap.autoUpdate) return;
        cursor = 0; dirty = false;
        remember(r.shadowMap.type); remember(mainCamera.layers.mask);
        renderScene.traverseVisible(visit);
        if (cursor !== previousLength) dirty = true;
        previousLength = cursor;
        values.length = cursor;
        if (dirty) r.shadowMap.needsUpdate = true;
      };
    }

    let environmentLighting = [];
    function buildLighting() {
      // 1. 주변광(HemisphereLight) — 상부 은은한 하늘빛 / 하부 묵직한 반사광
      const ambient = new THREE.HemisphereLight(0xe8f2ff, 0x2c323b, 1.2);
      scene.add(ambient);

      // 2. 주광(Key Light) — 직광 그림자 및 주 명암
      const sun = new THREE.DirectionalLight(0xfffae8, 2.2);
      sun.position.set(10, 30, 40);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.0005;
      scene.add(sun);

      // 3. 림 라이트(Rim/Back Light) — 실사 CG 기법: 금속 외곽 에지에 눈부신 하이라이트 형성 (device_china.mp4 스타일)
      const rimLight = new THREE.DirectionalLight(0xffffff, 1.8);
      rimLight.position.set(-20, 25, -30);
      scene.add(rimLight);

      // 4. 소프트 휠 라이트(Fill Light) — 쉐도우 면에 차가운 메탈릭 아노다이징 반사 형성
      const fillLight = new THREE.DirectionalLight(0xb0c4de, 1.0);
      fillLight.position.set(-30, 10, 20);
      scene.add(fillLight);
      environmentLighting = [ambient, sun, rimLight, fillLight];

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

    // ── 승강장 대리석 — 실사 사진(assets/bg/lobby_marble.png)을 상면에 입힘 ──
    //   사진 비율 2:1 → 슬래브 1.6m × 0.8m. 승강장 폭에 약 2장 반이 들어가 우편 도장처럼 안 쪼개진다.
    // 사진은 로드가 끝난 뒤에만 map 에 붙인다. 빈 텍스처를 먼저 넣으면 r128 에서 벽이 검게 나온다.
    function loadFaceMat(path, u, v, fallback, roughness) {
      const mat = new THREE.MeshStandardMaterial({
        color: fallback, roughness: roughness, metalness: 0.0
      });
      new THREE.TextureLoader().load(path, (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(Math.max(u, 0.01), Math.max(v, 0.01));
        tex.anisotropy = 8;
        mat.map = tex;
        mat.color.setHex(0xffffff);
        mat.needsUpdate = true;
      });
      return mat;
    }
    function lobbyStoneMat(u, v) {
      return loadFaceMat('assets/bg/lobby_wall.png', u, v, 0xe8e2d6, 0.88);
    }
    /* ── 승강로 내면 — 노출 콘크리트(제물치기) 프로시저럴 타일 ────────────────
       실사 승강로 사진 기준으로 다음 네 가지가 있어야 "시멘트"로 읽힌다.
         ① 거푸집 합판 이음선   — 패널 경계의 가는 음영선 + 그라우트가 삐져나온 밝은 립
         ② 폼타이 콘 구멍       — 규칙적 격자로 뚫린 Ø28mm 구멍 + 아래로 흐른 물때
         ③ 타설 이음(lift line) — 타설 회차 경계의 수평 띠, 아래쪽이 어둡다
         ④ 누수·백화 얼룩       — 세로로 길게 흘러내린 얼룩, 일부는 녹물(주황)
       사진(shaft_concrete.png)은 미세 그레인 레이어로만 soft-light 합성하고,
       위 흔적은 캔버스에 직접 그린다. 사진만 쓰면 밋밋한 무지 벽이 된다.
       타일 1장 = CONC_TILE_W × CONC_TILE_H(m)이며 상하좌우로 이어 붙는다.
       (이음선·타설선은 타일 경계에 두고, 얼룩은 ±W/±H 로 감아 그려 심을 없앤다) */
    const CONC_TILE_W = 2.4,  CONC_TILE_H = 3.6;   // 타일 실제 크기 (m)
    const CONC_PANEL_W = 1.2, CONC_PANEL_H = 1.8;  // 거푸집 합판 1장
    const CONC_PX = 320;                           // 1m 당 픽셀 (768 × 1152)

    let _concSrc = null;        // { albedo, normal } 캔버스 (1회 생성 후 공유)
    let _concBuilding = false;
    const _concPending = [];    // 캔버스 완성 전에 만들어진 재질 대기열

    // 결정적 난수 — 새로고침해도 같은 얼룩이 나와야 스크린샷 비교가 된다.
    function _concRnd(seed) {
      let s = seed >>> 0;
      return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    function _drawConcrete(photo) {
      const W = Math.round(CONC_TILE_W * CONC_PX);
      const H = Math.round(CONC_TILE_H * CONC_PX);
      const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
      const ac = mk(), hc = mk();                    // albedo / height(높이)
      const a = ac.getContext('2d'), h = hc.getContext('2d');
      const R = _concRnd(20260813);
      const P = CONC_PX;                             // m → px

      // ① 바탕 시멘트色 + 사진 그레인
      //    ★사진이 밝은 회백색이라 soft-light 알파를 올리면 벽이 하얗게 뜬다. 0.45 고정.
      a.fillStyle = '#78756e'; a.fillRect(0, 0, W, H);
      h.fillStyle = '#808080'; h.fillRect(0, 0, W, H);
      if (photo) {
        a.save(); a.globalCompositeOperation = 'soft-light'; a.globalAlpha = 0.45;
        a.drawImage(photo, 0, 0, W, H); a.restore();
        h.save(); h.globalCompositeOperation = 'soft-light'; h.globalAlpha = 0.55;
        h.drawImage(photo, 0, 0, W, H); h.restore();
      }

      // ②' 거푸집 패널별 색조 편차 — 합판을 돌려 쓰면 판마다 물 먹은 정도가 달라
      //     사각형 단위로 톤이 갈린다. 실사에서 제일 먼저 눈에 띄는 특징이다.
      for (let px = 0; px < W; px += CONC_PANEL_W * P) {
        for (let py = 0; py < H; py += CONC_PANEL_H * P) {
          const al = 0.03 + R() * 0.06;
          a.fillStyle = R() < 0.36 ? `rgba(102,97,88,${(al * 0.8).toFixed(3)})`
                                   : `rgba(214,209,199,${(al * 1.5).toFixed(3)})`;
          a.fillRect(px, py, CONC_PANEL_W * P, CONC_PANEL_H * P);
        }
      }

      // ② 타설 얼룩 — 크고 옅은 반점으로 색 편차를 만든다
      for (let i = 0; i < 80; i++) {
        const x = R() * W, y = R() * H, r = (0.15 + R() * 0.55) * P;
        const al = 0.04 + R() * 0.07;
        const g = a.createRadialGradient(x, y, 0, x, y, r);
        // ★어두운 반점이 우세하면 벽에 곰팡이 핀 것처럼 보인다. 밝은 쪽을 다수로 둔다.
        g.addColorStop(0, R() < 0.36 ? `rgba(104,99,90,${al * 0.8})` : `rgba(206,201,192,${al * 1.6})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        a.fillStyle = g; a.beginPath(); a.arc(x, y, r, 0, Math.PI * 2); a.fill();
      }

      // ③ 누수·녹물 얼룩 — 세로로 흘러내림. ±W/±H 로 감아 그려 타일 심을 지운다.
      for (let i = 0; i < 30; i++) {
        const x = R() * W, y0 = R() * H;
        const len = (0.4 + R() * 2.4) * P;
        const wd = (0.01 + R() * 0.055) * P;
        const rust = R() < 0.20;
        const al = 0.035 + R() * 0.075;
        for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
          const g = a.createLinearGradient(0, y0 + dy, 0, y0 + dy + len);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(0.14, rust ? `rgba(138,106,68,${al * 1.1})` : `rgba(98,93,84,${al * 0.85})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          a.fillStyle = g; a.fillRect(x + dx - wd / 2, y0 + dy, wd, len);
        }
      }

      // ④ 곰보(기포 자국) — 잔점. 가까이서 봐야 보이는 거칠기.
      //    ★수가 많거나 진하면 벽이 깨 뿌린 것처럼 지저분해진다. 수·농도 모두 낮게 두고
      //      거칠기는 알베도가 아니라 높이맵(요철)이 내도록 맡긴다.
      for (let i = 0; i < 380; i++) {
        const x = R() * W, y = R() * H, r = 0.4 + R() * 1.4;
        a.fillStyle = `rgba(104,99,90,${(0.04 + R() * 0.09).toFixed(3)})`;
        a.beginPath(); a.arc(x, y, r, 0, Math.PI * 2); a.fill();
        h.fillStyle = `rgba(96,96,96,${(0.26 + R() * 0.34).toFixed(3)})`;
        h.beginPath(); h.arc(x, y, r, 0, Math.PI * 2); h.fill();
      }

      // ⑤ 타설 이음 — 타일 경계(y=0, y=H)가 회차 경계다. 아래로 물때가 흐른다.
      const pourLine = (y) => {
        // 이음 위쪽(먼저 굳은 회차)은 밝게 뜨고 아래쪽은 물때가 흘러 어둡다.
        const up = a.createLinearGradient(0, y - 0.40 * P, 0, y);
        up.addColorStop(0, 'rgba(206,201,192,0)');
        up.addColorStop(1, 'rgba(206,201,192,0.20)');
        a.fillStyle = up; a.fillRect(0, y - 0.40 * P, W, 0.40 * P);
        const g = a.createLinearGradient(0, y - 6, 0, y + 0.55 * P);
        g.addColorStop(0, 'rgba(134,128,118,0.26)');
        g.addColorStop(0.06, 'rgba(86,81,73,0.38)');
        g.addColorStop(1, 'rgba(100,95,86,0)');
        a.fillStyle = g; a.fillRect(0, y - 6, W, 0.55 * P + 6);
        a.fillStyle = 'rgba(68,64,57,0.52)'; a.fillRect(0, y - 1, W, 2);
        h.fillStyle = 'rgba(96,96,96,0.85)'; h.fillRect(0, y - 1, W, 2);
      };
      pourLine(0); pourLine(H);

      // ⑥ 거푸집 합판 이음선 — 어두운 실선 + 바로 옆 밝은 립(그라우트 누출)
      const seam = (x, y, w, hh) => {
        a.fillStyle = 'rgba(84,79,71,0.34)'; a.fillRect(x, y, w, hh);
        h.fillStyle = 'rgba(104,104,104,0.85)'; h.fillRect(x, y, w, hh);
      };
      const lip = (x, y, w, hh) => { a.fillStyle = 'rgba(198,193,184,0.16)'; a.fillRect(x, y, w, hh); };
      for (let px = 0; px <= W; px += CONC_PANEL_W * P) {          // 세로 이음
        seam(px - 1, 0, 2, H); lip(px + 1, 0, 2, H);
      }
      for (let py = CONC_PANEL_H * P; py < H; py += CONC_PANEL_H * P) {  // 가로 이음
        seam(0, py - 1, W, 2); lip(0, py + 1, W, 2);
      }

      // ⑦ 폼타이 콘 구멍 — 패널 1/4 지점 격자(0.6 × 0.9m). 이음선과 겹치지 않는다.
      const holeR = 0.011 * P;                                     // Ø22mm
      for (let cx = 0.3 * P; cx < W; cx += 0.6 * P) {
        for (let cy = 0.45 * P; cy < H; cy += 0.9 * P) {
          const g = a.createRadialGradient(cx, cy - holeR * 0.25, holeR * 0.15, cx, cy, holeR);
          g.addColorStop(0, 'rgba(56,52,46,0.88)');
          g.addColorStop(0.62, 'rgba(84,79,71,0.75)');
          g.addColorStop(1, 'rgba(130,125,116,0.18)');
          a.fillStyle = g; a.beginPath(); a.arc(cx, cy, holeR, 0, Math.PI * 2); a.fill();
          // 빛이 위에서 들어오므로 구멍 하단 테두리가 밝다
          a.strokeStyle = 'rgba(214,209,199,0.34)'; a.lineWidth = 1.6;
          a.beginPath(); a.arc(cx, cy + 0.6, holeR * 0.94, 0.15 * Math.PI, 0.85 * Math.PI); a.stroke();
          // 구멍에서 흘러내린 물때 — ★짧고 넓게. 길고 가늘면 긁힌 자국처럼 보인다.
          const dl = (0.06 + R() * 0.20) * P;
          const dg = a.createLinearGradient(0, cy, 0, cy + dl);
          dg.addColorStop(0, R() < 0.18 ? 'rgba(126,96,62,0.19)' : 'rgba(94,89,80,0.17)');
          dg.addColorStop(1, 'rgba(94,89,80,0)');
          a.fillStyle = dg; a.fillRect(cx - holeR * 0.85, cy, holeR * 1.7, dl);
          // 높이맵 — 실제로 파인 구멍
          const hg = h.createRadialGradient(cx, cy, 0, cx, cy, holeR);
          hg.addColorStop(0, 'rgba(44,44,44,1)');
          hg.addColorStop(0.70, 'rgba(70,70,70,0.9)');
          hg.addColorStop(1, 'rgba(128,128,128,0)');
          h.fillStyle = hg; h.beginPath(); h.arc(cx, cy, holeR, 0, Math.PI * 2); h.fill();
        }
      }
      return { albedo: ac, height: hc };
    }

    // 높이맵 → 노멀맵 (Sobel). bumpMap 은 스치는 각도에서 지저분해서 노멀로 굽는다.
    function _heightToNormal(hc, strength) {
      const W = hc.width, H = hc.height;
      const src = hc.getContext('2d').getImageData(0, 0, W, H).data;
      const nc = document.createElement('canvas'); nc.width = W; nc.height = H;
      const ctx = nc.getContext('2d');
      const out = ctx.createImageData(W, H);
      const at = (x, y) => src[((((y % H) + H) % H) * W + (((x % W) + W) % W)) * 4];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dx = (at(x + 1, y) - at(x - 1, y)) / 255 * strength;
          const dy = (at(x, y + 1) - at(x, y - 1)) / 255 * strength;
          // 텍스처 v축은 이미지 y와 반대라 ny 부호가 +dy 다 (구멍이 파여 보여야 정상)
          const nx = -dx, ny = dy, inv = 1 / Math.hypot(nx, ny, 1);
          const i = (y * W + x) * 4;
          out.data[i]     = (nx * inv * 0.5 + 0.5) * 255;
          out.data[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
          out.data[i + 2] = (inv * 0.5 + 0.5) * 255;
          out.data[i + 3] = 255;
        }
      }
      ctx.putImageData(out, 0, 0);
      return nc;
    }

    function _applyConc(e) {
      const tex = new THREE.CanvasTexture(_concSrc.albedo);
      tex.encoding = THREE.sRGBEncoding;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(e.u, e.v); tex.anisotropy = 8;
      const nrm = new THREE.CanvasTexture(_concSrc.normal);
      nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping;
      nrm.repeat.set(e.u, e.v); nrm.anisotropy = 8;
      e.mat.map = tex;
      e.mat.normalMap = nrm;
      e.mat.normalScale = new THREE.Vector2(0.9, 0.9);
      e.mat.color.setHex(0xffffff);
      e.mat.needsUpdate = true;
    }

    function _buildConc() {
      if (_concBuilding) return;
      _concBuilding = true;
      const finish = (photo) => {
        const { albedo, height } = _drawConcrete(photo);
        _concSrc = { albedo, normal: _heightToNormal(height, 3.2) };
        _concPending.forEach(_applyConc);
        _concPending.length = 0;
      };
      // 사진은 그레인 보조일 뿐이라 없거나 실패해도 프로시저럴만으로 완성된다.
      const img = new Image();
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      img.src = 'assets/bg/shaft_concrete.png';
    }

    function shaftConcMat(u, v) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x8d8981, roughness: 0.97, metalness: 0.0
      });
      const e = { mat, u: Math.max(u, 0.01), v: Math.max(v, 0.01) };
      if (_concSrc) _applyConc(e);
      else { _concPending.push(e); _buildConc(); }
      return mat;
    }
    /* ── 기계실 내벽 마감 — 준불연 흡음보드 라이닝 ──────────────────────────
       실사(기계실 사진): 콘크리트 위에 아이보리색 보드를 덧대 시공한다.
         ① 1m 안팎으로 나뉜 세로 이음매 — 보드 1장 폭
         ② 천장 가까이 가로로 한 줄 지나가는 이음매
         ③ 판 가운데가 볼록한 "푹신한" 쿠션 음영. 이음매 쪽은 눌려 어둡다.
         ④ 미세한 섬유결과 바닥쪽 때
       승강로 콘크리트와 달리 벽 1장에 1:1로 입히므로(repeat 없음) 실제 폭·높이
       비율 그대로 굽는다. 그래야 이음매 간격과 바닥 때 위치가 안 어긋난다. */
    const MR_LINING_T = 0.030;   // 보드 두께 30mm — 벽에 다는 부속의 X 기준점이기도 하다
    const _mrLiningCache = {};
    function mrLiningMats(wM, hM) {
      const key = `${wM.toFixed(3)}x${hM.toFixed(3)}`;
      if (!_mrLiningCache[key]) {
        const PX = 256;
        const W = Math.round(wM * PX), H = Math.round(hM * PX);
        const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
        const ac = mk(), hc = mk();
        const a = ac.getContext('2d'), h = hc.getContext('2d');
        const R = _concRnd(770421);
        // 캔버스 y=0 이 벽 윗단이다 (텍스처 v=1 = 박스 면 상단).
        // ★흰색(255)에 가까운 하이라이트를 얹으면 도장한 흰 벽처럼 채도가 날아간다.
        //   바탕은 따뜻한 아이보리로 깔고 하이라이트도 누런 기를 남긴다.
        a.fillStyle = '#d3c9b5'; a.fillRect(0, 0, W, H);
        h.fillStyle = '#606060'; h.fillRect(0, 0, W, H);

        const nPanel = Math.max(2, Math.round(wM / 1.05));   // 보드 1장 ≈ 1.0m
        const pw = W / nPanel;
        const jointY = (0.45 / hM) * H;                      // 천장에서 450mm 아래

        // ③ 판별 쿠션 음영 — 가운데 볼록, 이음매 쪽으로 눌림
        for (let i = 0; i < nPanel; i++) {
          const x0 = i * pw;
          const g = a.createLinearGradient(x0, 0, x0 + pw, 0);
          g.addColorStop(0.00, 'rgba(126,114,94,0.32)');
          g.addColorStop(0.13, 'rgba(255,248,228,0.07)');
          g.addColorStop(0.50, 'rgba(255,248,228,0.13)');
          g.addColorStop(0.87, 'rgba(255,248,228,0.07)');
          g.addColorStop(1.00, 'rgba(126,114,94,0.32)');
          a.fillStyle = g; a.fillRect(x0, 0, pw, H);
          const gh = h.createLinearGradient(x0, 0, x0 + pw, 0);
          gh.addColorStop(0.00, 'rgba(46,46,46,1)');
          gh.addColorStop(0.15, 'rgba(150,150,150,1)');
          gh.addColorStop(0.50, 'rgba(182,182,182,1)');
          gh.addColorStop(0.85, 'rgba(150,150,150,1)');
          gh.addColorStop(1.00, 'rgba(46,46,46,1)');
          h.fillStyle = gh; h.fillRect(x0, 0, pw, H);
        }
        // 위아래도 눌린다 — 세로 방향 쿠션
        const gv = a.createLinearGradient(0, 0, 0, H);
        gv.addColorStop(0.00, 'rgba(126,114,94,0.26)');
        gv.addColorStop(0.10, 'rgba(255,248,228,0.04)');
        gv.addColorStop(0.90, 'rgba(255,248,228,0.04)');
        gv.addColorStop(1.00, 'rgba(126,114,94,0.26)');
        a.fillStyle = gv; a.fillRect(0, 0, W, H);

        // ④ 섬유결 — 아주 옅은 세로 잔선
        for (let i = 0; i < 1400; i++) {
          const x = R() * W, y = R() * H, len = (0.04 + R() * 0.30) * PX;
          a.fillStyle = `rgba(156,143,120,${(0.015 + R() * 0.045).toFixed(3)})`;
          a.fillRect(x, y, 1, len);
        }
        // 얼룩 — 보드마다 미묘한 색 편차
        for (let i = 0; i < 40; i++) {
          const x = R() * W, y = R() * H, r = (0.12 + R() * 0.40) * PX;
          const g = a.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, R() < 0.5 ? 'rgba(140,128,106,0.06)' : 'rgba(255,248,228,0.06)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          a.fillStyle = g; a.beginPath(); a.arc(x, y, r, 0, Math.PI * 2); a.fill();
        }

        // ①② 이음매 — 세로(보드 경계) + 가로(천장 가까이 한 줄)
        const jointW = Math.max(2, 0.008 * PX);
        for (let i = 0; i <= nPanel; i++) {
          const x = i * pw;
          a.fillStyle = 'rgba(110,99,80,0.42)'; a.fillRect(x - jointW / 2, 0, jointW, H);
          h.fillStyle = 'rgba(24,24,24,1)';       h.fillRect(x - jointW / 2, 0, jointW, H);
        }
        a.fillStyle = 'rgba(110,99,80,0.38)'; a.fillRect(0, jointY - jointW / 2, W, jointW);
        h.fillStyle = 'rgba(28,28,28,1)';       h.fillRect(0, jointY - jointW / 2, W, jointW);

        // 바닥쪽 때
        const soilH = 0.26 * PX;
        const gs = a.createLinearGradient(0, H - soilH, 0, H);
        gs.addColorStop(0, 'rgba(108,96,78,0)');
        gs.addColorStop(1, 'rgba(108,96,78,0.26)');
        a.fillStyle = gs; a.fillRect(0, H - soilH, W, soilH);

        // 보드는 부드러워 요철이 완만하다 — 노멀 강도를 콘크리트보다 낮게 굽는다.
        _mrLiningCache[key] = { albedo: ac, normal: _heightToNormal(hc, 1.6) };
      }
      const src = _mrLiningCache[key];
      const tex = new THREE.CanvasTexture(src.albedo);
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = 8;
      const nrm = new THREE.CanvasTexture(src.normal);
      nrm.anisotropy = 8;
      const face = new THREE.MeshStandardMaterial({
        map: tex, normalMap: nrm, normalScale: new THREE.Vector2(0.7, 0.7),
        roughness: 0.96, metalness: 0.0
      });
      const edge = M.conc(0xd6cfc1);   // 보드 절단면
      return [face, edge, edge, edge, edge, edge];
    }

    // BoxGeometry 면 순서: +X -X +Y -Y +Z -Z
    function lobbyFrontWallMats(w, h, d) {
      const stone = lobbyStoneMat(w / 1.6, h / 0.8);
      const conc = shaftConcMat(w / CONC_TILE_W, h / CONC_TILE_H);
      const edge = M.conc(0xc8c2b8);
      return [edge, edge, edge, edge, stone, conc];
    }
    function lobbySideWallMats(w, h, d) {
      const stone = lobbyStoneMat(d / 1.6, h / 0.8);
      const conc = shaftConcMat(d / CONC_TILE_W, h / CONC_TILE_H);
      const edge = M.conc(0xc8c2b8);
      return [conc, stone, edge, edge, stone, edge];
    }

    let _lobbyMarbleMats = null;
    function lobbyMarbleFaceMats(w, d) {
      if (_lobbyMarbleMats) return _lobbyMarbleMats;
      const tex = new THREE.TextureLoader().load('assets/bg/lobby_marble.png');
      tex.encoding = THREE.sRGBEncoding;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(w / 1.6, d / 0.8);
      tex.anisotropy = 8;
      const top = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.34, metalness: 0.03
      });
      const edge = M.conc(0xd0cbc4);
      _lobbyMarbleMats = [edge, edge, top, edge, edge, edge];
      return _lobbyMarbleMats;
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
        // 캔버스 위=천정, 0.5=수평선, 아래=지평선 아래 하늘.
        // 천공섬이라 지평선 아래도 그대로 보이므로 흰 안개로 덮지 않고 옅은 하늘색으로 내려간다.
        g.addColorStop(0.00, '#3f9fe8');
        g.addColorStop(0.35, '#7fc4f2');
        g.addColorStop(0.47, '#cfe8fa');
        g.addColorStop(0.52, '#eef7fc'); // 수평선 밝은 띠
        g.addColorStop(0.64, '#cfe6f6');
        g.addColorStop(1.00, '#9cc8e6');
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
          depthWrite: false,
          toneMapped: false // ACES 톤매핑에 물들면 하늘이 잿빛으로 바랜다
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
      const cBot = new THREE.Color(0xeaf2f9); // 안개처럼 보이도록 아랫면 음영도 거의 없앤다
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

      // 구름은 덩어리가 아니라 엷은 안개다. 반투명 언릿 + 흐린 정점 컬러.
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.30, depthWrite: false
      });
      // [각도(도), 반경, 높이, 스케일] — 어느 방향에서 봐도 구름이 보이도록 링 배치
      const placements = [
        [15, 70, 30, 7], [55, 85, 36, 9], [100, 75, 28, 6.5],
        [150, 90, 38, 10], [195, 80, 32, 8], [240, 72, 27, 6],
        [285, 88, 40, 9.5], [330, 78, 33, 7.5],
        // 섬 아래 구름 바다 — 섬보다 작고 멀찍이 깔아 천공섬이 구름 위에 떠 보이게 한다.
        [35, 34, -11, 3.5], [95, 46, -18, 4.5], [160, 30, -8, 3], [215, 54, -23, 5.5],
        [270, 40, -14, 4], [320, 62, -27, 6], [10, 72, -31, 7], [125, 80, -36, 8]
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
      { cx: 2.1, cz: 5.8,   hw: 7.4,  hd: 7.2,  blend: 6 },   // 승강로 + 전면 계단/나선형 휠체어 램프 광장 부지 평탄화
      { cx: -17, cz: -28,   hw: 8.6,  hd: 6.4,  blend: 9 },   // koelsa2 캠퍼스 부지
      { cx: 17,  cz: -24.5, hw: 14.0, hd: 10.5, blend: 10 },  // 본관 타워 + 로비
      { cx: 17,  cz: -11,   hw: 20.0, hd: 6.2,  blend: 9 }    // 본관 전면 보도블록 광장
    ];
    const NO_GRASS_RECTS = [ // 풀잎 산포 제외 footprint {cx, cz, hw, hd}
      { cx: 0,   cz: -0.2,  hw: 3.6,  hd: 3.4 },   // 승강로 벽체
      { cx: 2.1, cz: 6.5,   hw: 7.0,  hd: 6.0 },   // 승강로 전면 계단 및 나선형 휠체어 경사로 광장 전 구역
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

    let outdoorPresentation = null;
    function setDetailedBackground(enabled) {
      if (!outdoorPresentation) return;
      const p = outdoorPresentation;
      p.detailed = Boolean(enabled);
      // 천공섬 배경에서는 지면에 서 있던 지형·주변 건물이 두 모드 모두 나오지 않는다.
      if (p.landscape) p.landscape.visible = false;
      if (p.buildings) p.buildings.visible = false;
      p.sky.visible = p.detailed;
      scene.background = p.detailed ? p.background : p.simpleBackground;
      scene.fog = p.detailed ? p.fog : p.simpleFog;
      renderer.toneMappingExposure = p.detailed ? p.exposure : p.simpleExposure;
      p.lighting.forEach(entry => { entry.light.intensity = p.detailed ? entry.original : entry.studio; });
      const button = document.getElementById('c-background');
      if (button) {
        button.setAttribute('aria-pressed', String(p.detailed));
        button.classList.toggle('active', p.detailed);
      }
    }

    /* ── 공중 지반(네모난 땅덩어리) ──────────────────────────────────
       넓은 지면 대신 승강로 + 보도블록 광장 footprint 만 남긴 사각 지반을 세운다.
       상면은 기존 외부 지면과 같은 Y0-0.03 레벨이라 보도블록·계단·램프 높이는 그대로다.
       옆면은 수직 절벽으로 곧게 내려가다 아래쪽에서 안개에 녹는다. */
    const BUILD_GROUND_SCENERY = false; // 지면이 사라졌으므로 지형·풀밭·개울·주변 건물은 만들지 않는다(코드는 보존).
    const PLINTH_MARGIN = 4.0;          // 보도블록·승강로 바깥으로 남는 흙·잔디 테두리 폭
    const PLINTH_BACK_MARGIN = 7.5;     // 승강로 후면(Z-)은 광장이 없어 좁아 보이므로 더 넓게 뺀다
    const PLINTH_STEP = 1.3;            // 절벽 정점 간격(둘레 방향)
    // [깊이(m), 수평 배율] — 거의 수직으로 내려가며 아주 조금만 좁아진다.
    const PLINTH_PROFILE = [
      [0.00, 1.000], [0.55, 0.998], [2.20, 0.987], [5.50, 0.972],
      [10.00, 0.955], [16.00, 0.935], [24.00, 0.910], [34.00, 0.890]
    ];
    const ISLAND_COLORS = {
      grass: new THREE.Color(0x6c8f4d), dirt: new THREE.Color(0x6b5540),
      rock: new THREE.Color(0x7d7870), deep: new THREE.Color(0x4e4b52),
      haze: new THREE.Color(0xc4dcec) // 아래쪽이 녹아드는 안개색
    };

    // 사각 둘레를 일정 간격으로 훑는다. 네 모서리는 반드시 정점으로 남는다.
    function rectPerimeter(hw, hd, step) {
      const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
      const pts = [];
      for (let c = 0; c < 4; c++) {
        const [x1, z1] = corners[c], [x2, z2] = corners[(c + 1) % 4];
        const n = Math.max(2, Math.round(Math.hypot(x2 - x1, z2 - z1) / step));
        for (let i = 0; i < n; i++) {
          const t = i / n;
          pts.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]);
        }
      }
      return pts;
    }

    // 깊이에 따른 잔디→흙→바위→그늘→안개 정점 컬러. 1.6m 간격 지층 얼룩을 섞는다.
    function plinthTone(target, v, seed) {
      const d = -v.y;
      if (d < 0.55) target.copy(ISLAND_COLORS.grass).lerp(ISLAND_COLORS.dirt, smooth01(d / 0.55));
      else if (d < 3.2) target.copy(ISLAND_COLORS.dirt).lerp(ISLAND_COLORS.rock, smooth01((d - 0.55) / 2.65));
      else target.copy(ISLAND_COLORS.rock).lerp(ISLAND_COLORS.deep, smooth01((d - 3.2) / 9.0));
      if (d < 0.05) target.multiplyScalar(0.93 + 0.14 * vertHash(v.x * 0.55, 2, v.z * 0.55, seed + 7)); // 잔디 얼룩
      if (d > 0.55) { // 수평 지층
        const band = Math.floor(d / 1.6);
        target.multiplyScalar(0.90 + 0.20 * vertHash(band * 3.7, 1, 2, seed + 11));
      }
      // 아래로 갈수록 안개에 잠긴다.
      return target.lerp(ISLAND_COLORS.haze, smooth01((d - 11) / 20) * 0.88);
    }

    // 사각 둘레 + 깊이 프로파일 → 상면 + 수직 절벽 + 바닥 (비인덱스, 로우폴리 음영)
    function makePlinthGeometry(hw, hd, seed) {
      const base = rectPerimeter(hw, hd, PLINTH_STEP);
      const seg = base.length;
      const rings = PLINTH_PROFILE.map(([depth, scale], k) => base.map(([bx, bz], i) => {
        // 상면은 평평해야 보도블록이 앉는다. 옆면만 살짝 깨뜨린다.
        const jig = k === 0 ? 0 : (vertHash(i * 1.7, k * 3.3, 2.2, seed + 5) - 0.5) * 0.34
          + (vertHash(i * 5.3, k * 1.9, 4.7, seed + 21) - 0.5) * 0.16;
        const f = scale + jig / Math.max(hw, hd);
        const y = k === 0 ? 0 : -depth * (1 + (vertHash(i * 2.9, k * 5.1, 1.3, seed + 9) - 0.5) * 0.06);
        return new THREE.Vector3(bx * f, y, bz * f);
      }));

      const pos = [], col = [];
      const tmp = new THREE.Color();
      let facet = 1;
      const push = v => {
        pos.push(v.x, v.y, v.z);
        plinthTone(tmp, v, seed).multiplyScalar(facet);
        col.push(tmp.r, tmp.g, tmp.b);
      };
      // 면 단위로 같은 음영을 주면 로우폴리 암반처럼 각진 반점이 생긴다.
      // 상·하면은 부채꼴 이음매가 드러나므로 면 음영을 주지 않는다.
      let faceted = true;
      const tri = (a, b, c) => {
        facet = faceted ? 0.88 + 0.24 * vertHash(a.x + b.x, a.y + c.y, b.z + c.z, seed + 3) : 1;
        push(a); push(b); push(c);
      };

      const top = rings[0];
      const topC = new THREE.Vector3(0, 0, 0);
      faceted = false;
      for (let i = 0; i < seg; i++) tri(topC, top[(i + 1) % seg], top[i]); // 상면(+Y)
      faceted = true;
      for (let k = 0; k < rings.length - 1; k++) {
        const up = rings[k], lo = rings[k + 1];
        for (let i = 0; i < seg; i++) {
          const j = (i + 1) % seg;
          tri(up[i], up[j], lo[j]);                                       // 절벽(바깥면)
          tri(up[i], lo[j], lo[i]);
        }
      }
      const last = rings[rings.length - 1];
      const botC = new THREE.Vector3(0, last[0].y, 0);
      faceted = false;
      for (let i = 0; i < seg; i++) tri(botC, last[i], last[(i + 1) % seg]); // 바닥(-Y)

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
      geo.computeVertexNormals();
      return geo;
    }

    function buildSkyIsland(parent, cover, topY) {
      const body = new THREE.Mesh(makePlinthGeometry(cover.hw, cover.hd, 17), stylizedMat(0.62, 0.5));
      body.name = 'skyIslandBody';
      body.position.set(cover.cx, topY, cover.cz);
      body.userData = { type: 'sky-island' };
      parent.add(body);
      return body;
    }

    function buildOutdoorGround(parent) {
      const g = new THREE.Group();
      g.name = 'outdoorGround';
      g.userData = { type: 'outdoor-ground' };

      const landscape = new THREE.Group();
      landscape.name = 'outdoorLandscape';
      g.add(landscape);

      if (BUILD_GROUND_SCENERY) {
        // 구릉 지형 + 풀밭 + 들꽃 (스타일라이즈드 자연 배경)
        buildTerrain(landscape);
        buildGrassField(landscape);
        buildFlowerField(landscape);
        buildStreamAndRocks(landscape);
      }

      // 승강로 전면 및 계단/나선형 휠체어 램프 진입 광장 포장 — 보도블록 확장 (폭 13.0m, 깊이 11.5m)
      const paverW = 13.0;
      const paverD = 11.5;
      const paverCX = 2.10; // 계단 및 우측 나선 램프 중심
      const paverCZ = S.SHAFT_D / 2 + paverD / 2 + 0.2;
      createBox(paverW, 0.03, paverD, makePaverMaterial(paverW, paverD), paverCX, Y0 + 0.04, paverCZ, g);

      // 섬이 받쳐야 할 지상 footprint = 보도블록 광장 ∪ 승강로 외벽 (여유 0.9m)
      const wallOut = S.SHAFT_W / 2 + S.WALL_T;
      const minX = Math.min(paverCX - paverW / 2, -wallOut);
      const maxX = Math.max(paverCX + paverW / 2, wallOut);
      const minZ = Math.min(paverCZ - paverD / 2, SHAFT_BACK_Z - S.WALL_T);
      const maxZ = Math.max(paverCZ + paverD / 2, FRONT_WALL_INNER_Z + S.WALL_T);
      // 테두리를 면마다 더한 뒤 중심·반폭을 다시 낸다(후면만 더 넓어 중심이 뒤로 간다).
      const edgeMinX = minX - PLINTH_MARGIN, edgeMaxX = maxX + PLINTH_MARGIN;
      const edgeMinZ = minZ - PLINTH_BACK_MARGIN, edgeMaxZ = maxZ + PLINTH_MARGIN;
      const cover = {
        cx: (edgeMinX + edgeMaxX) / 2, cz: (edgeMinZ + edgeMaxZ) / 2,
        hw: (edgeMaxX - edgeMinX) / 2, hd: (edgeMaxZ - edgeMinZ) / 2
      };
      // 피트 기초 상면(Y0)과 공면이 되지 않도록 섬 상면도 30mm 낮춘다(기존 지면 레벨 유지).
      buildSkyIsland(g, cover, Y0 - 0.03);

      // 구름은 두 배경 모드에서 모두 보인다(상세 배경 그룹이 아니라 여기에 붙인다).
      buildSoftClouds(g);

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
      if (BUILD_GROUND_SCENERY) {
        if (!(typeof USE_PHOTO_BG_PREVIEW !== 'undefined' && USE_PHOTO_BG_PREVIEW)) buildMountainRange(bg3dGrp);
        buildKoelsaTowerCampus(bg3dGrp);
        buildKoelsaHQ(bg3dGrp);
      }
      bgGrp.add(bg3dGrp);

      if (typeof USE_PHOTO_BG_PREVIEW !== 'undefined' && USE_PHOTO_BG_PREVIEW) {
        buildSplitPhotoBackdrop(bgGrp, bg3dGrp);
      }

      scene.add(bgGrp);
      const floor = scene.getObjectByName('skyIslandBody'); // 지면 기준면 = 섬 상면(Y0-0.03)
      const studioHorizon = '#cfe3ef';
      // 최초 한 번 그리는 하늘. 구름용 메시·애니메이션·후처리 패스는 추가하지 않는다.
      const studioBackground = createBgGradientTexture(1024, 1024, (ctx, w, h) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, '#5b93c2');
        gradient.addColorStop(0.5, '#9ac6de');
        gradient.addColorStop(0.78, studioHorizon);
        gradient.addColorStop(1, '#e6f2f8'); // 섬 아래도 먼 하늘 아지랑이로 읽히게 한다
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
        // 옅고 넓은 구름을 주변에 두어 중앙의 구조물 윤곽을 가리지 않는다.
        const clouds = [[0.08,0.24,0.25,0.065],[0.83,0.15,0.29,0.075],[0.92,0.45,0.21,0.035],[0.18,0.60,0.26,0.025]];
        for (const [x,y,rx,ry] of clouds) {
          for (let i=0;i<7;i++) {
            ctx.save();
            ctx.translate((x+(i-3)*rx*0.19)*w,(y+Math.sin(i*2.1)*ry*0.25)*h);
            ctx.scale(rx*w*0.43,ry*h*(1+Math.sin(i*1.7)*0.25));
            const glow=ctx.createRadialGradient(0,0,0,0,0,1);
            glow.addColorStop(0,'rgba(255,253,241,0.34)');
            glow.addColorStop(0.55,'rgba(255,253,241,0.19)');
            glow.addColorStop(1,'rgba(255,253,241,0)');
            ctx.fillStyle=glow;ctx.fillRect(-1,-1,2,2);ctx.restore();
          }
        }
      });
      studioBackground.encoding = THREE.sRGBEncoding;
      outdoorPresentation = {
        detailed: false, buildings: bgGrp, landscape: scene.getObjectByName('outdoorLandscape'),
        sky: scene.getObjectByName('skyDome'), floor, background: scene.background, fog: scene.fog,
        simpleBackground: studioBackground, simpleFog: new THREE.FogExp2(studioHorizon, 0.009),
        exposure: renderer.toneMappingExposure, simpleExposure: 0.95,
        lighting: environmentLighting.map((light, i) => ({ light, original: light.intensity, studio: [0.7, 1.8, 0.65, 0.45][i] }))
      };
      setDetailedBackground(false);
    }

    // 점형블록 — 실사 텍스처 (6×6 돌기 패턴)
    let _tactileMats = null;
    function getTactileFaceMats() {
      if (_tactileMats) return _tactileMats;
      const tex = new THREE.TextureLoader().load('assets/bg/tactile.png');
      tex.encoding = THREE.sRGBEncoding;
      const top = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.88, metalness: 0.05, bumpMap: tex, bumpScale: 0.015
      });
      const side = M.tactile();
      // BoxGeometry: +X -X +Y -Y +Z -Z — 상면(+Y)만 실사
      _tactileMats = [side, side, top, side, side, side];
      return _tactileMats;
    }
    function addTactileBlock(parent, x, y, z, size = 0.3) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, 0.006, size), getTactileFaceMats());
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    }

    function addTactileStrip(parent, cx, y, z, count = 4, size = 0.3) {
      const startX = cx - (count - 1) * size / 2;
      for (let k = 0; k < count; k++) {
        addTactileBlock(parent, startX + k * size, y, z, size);
      }
    }

    /**
     * 1층 승강장 단차(1.72m) 해소 어셈블리:
     * 1. 1층 로비 슬래브 하부 포디움 기초벽 (공중 뜸 차단 및 건물 대지 안착)
     * 2. 전면 보행자 직통 계단 (폭 2.2m, 10단, 양측 스테인리스 핸드레일 + 상하 점자블록)
     * 3. 우측 장애인 나선형 경사로 (전면 진입 후 로비 우측을 감아 오르는 현장형 나선 + 2단 핸드레일 + 하부 기둥)
     * 4. 1층 로비 슬래브 외곽 추락방지 안전 난간
     */
    function buildLobbyApproachRampAndStairs(parent) {
      const approachGrp = new THREE.Group();
      approachGrp.name = 'lobbyApproachRampAndStairs';

      const groundY = Y0 + 0.04;              // 지면 보도블록 상면 레벨 (≈ 0.04m)
      const slabY   = FLOOR_Y[0];             // 1층 로비 슬래브 상면 레벨 (1.76m)
      const slabBotY= slabY - 0.12;           // 1층 로비 슬래브 하면 (1.64m)
      const deltaH  = slabY - groundY;        // 전체 단차 (약 1.72m)

      const wallZ       = FRONT_WALL_INNER_Z + S.WALL_T / 2;
      const totalWallW  = S.SHAFT_W + S.WALL_T * 2; // 3.89m
      const lobbyDepth  = 1.5 + (S.SHAFT_D / 2 - FRONT_WALL_INNER_Z); // ≈ 2.02m
      const lobbyFrontZ = wallZ + S.WALL_T / 2 + lobbyDepth; // 로비 슬래브 전면단 (≈ 3.51m)
      const lobbyBackZ  = wallZ + S.WALL_T / 2;              // 로비 슬래브 후면단 (≈ 1.49m)
      const lobbyCZ     = (lobbyFrontZ + lobbyBackZ) / 2;
      const lobbyLeftX  = -totalWallW / 2;                   // -1.945m
      const lobbyRightX = totalWallW / 2;                    // +1.945m

      // 재질 — 고급형 미끄럼방지(Non-slip) 차콜/슬레이트 그레이 및 스테인리스 마감
      const podiumMat   = lobbyFrontWallMats ? lobbyFrontWallMats(totalWallW, deltaH, lobbyDepth) : M.conc(0xcad0d8);
      const concStepMat = M.conc(0x48505a); // 논슬립 슬레이트 그레이 계단 디딤판 (버너구이 석재 질감)
      const ssRailMat   = M.ss(0xd0d8e2);   // 스테인리스 핸드레일 파이프
      const ssPostMat   = M.ss(0xb0b8c2);   // 스테인리스 난간 지주
      const rampSlabMat = M.conc(0x424851); // 버너구이 화강석/MMA 엠보스 논슬립 차콜 그레이 경사로 바닥재
      const curbMat     = M.conc(0x282d33); // 휠체어 바퀴 이탈방지턱 다크 차콜 블랙 연석
      const pillarMat   = M.paint(0x4a525d);

      // ────────────────────────────────────────────────────────────────
      // 1. 1층 로비 슬래브 하부 포디움 기초 (Podium Substructure)
      //    공중에 떠 있던 1층 슬래브 아래 공간을 튼튼한 건축 기단부로 완벽 폐쇄
      // ────────────────────────────────────────────────────────────────
      const podiumH = slabBotY - groundY; // 약 1.60m
      const podiumCY = groundY + podiumH / 2;
      // 전면 기초벽
      createBox(totalWallW, podiumH, 0.25, podiumMat, 0, podiumCY, lobbyFrontZ - 0.125, approachGrp);
      // 좌측 기초벽
      createBox(0.25, podiumH, lobbyDepth, podiumMat, lobbyLeftX + 0.125, podiumCY, lobbyCZ, approachGrp);
      // 우측 기초벽 — 전면 도착부는 비워 램프가 승강장으로 들어가게 한다
      const rightWallD = lobbyDepth * 0.52;
      createBox(0.25, podiumH, rightWallD, podiumMat,
        lobbyRightX - 0.125, podiumCY, lobbyBackZ + rightWallD / 2, approachGrp);
      // 내부 기초 콘크리트 코어
      createBox(totalWallW - 0.25, podiumH, lobbyDepth - 0.25, M.conc(0x8a929b), 0, podiumCY, lobbyCZ, approachGrp);

      // ────────────────────────────────────────────────────────────────
      // 2. 전면 보행자 진입 계단 (Pedestrian Staircase)
      //    승강기 도어 중앙 정렬(X ∈ [-1.1m, +1.1m], 폭 2.2m), 10단 화강석 계단
      // ────────────────────────────────────────────────────────────────
      const stairW = 2.20;
      const stairCX = 0.00;
      const stepCount = 10;
      const stepRise = deltaH / stepCount; // 0.172m
      const stepTread = 0.30;             // 300mm

      for (let s = 0; s < stepCount; s++) {
        const stepTopY = slabY - (s + 1) * stepRise;
        const stepFrontZ = lobbyFrontZ + (s + 1) * stepTread;
        const curStepH = stepTopY - groundY + stepRise;
        createBox(stairW, stepRise, stepTread, concStepMat,
          stairCX, stepTopY + stepRise / 2, stepFrontZ - stepTread / 2, approachGrp);
        if (curStepH - stepRise > 0.01) {
          createBox(stairW, curStepH - stepRise, stepTread, M.conc(0x9aa2aa),
            stairCX, groundY + (curStepH - stepRise) / 2, stepFrontZ - stepTread / 2, approachGrp);
        }
      }

      // 계단 양측 마감 측벽 (Wing Walls)
      const stairLen = stepCount * stepTread; // 3.0m
      const stairEndZ = lobbyFrontZ + stairLen;
      [-stairW / 2 - 0.08, stairW / 2 + 0.08].forEach(wx => {
        createBox(0.16, deltaH + 0.15, stairLen, M.conc(0xcad0d8),
          stairCX + wx, groundY + (deltaH + 0.15) / 2, (lobbyFrontZ + stairEndZ) / 2, approachGrp);
      });

      // 계단 양측 스테인리스 안전 핸드레일 (높이 900mm)
      [-stairW / 2 + 0.05, stairW / 2 - 0.05].forEach(rx => {
        const postCount = 4;
        for (let p = 0; p <= postCount; p++) {
          const t = p / postCount;
          const px = stairCX + rx;
          const pz = lobbyFrontZ + t * stairLen;
          const py = slabY - t * deltaH;
          const post = createCylinder(0.020, 0.020, 0.90, ssPostMat, px, py + 0.45, pz, approachGrp);
          post.castShadow = true;
        }
        // 상단 핸드레일 파이프
        const startPt = new THREE.Vector3(stairCX + rx, slabY + 0.90, lobbyFrontZ);
        const endPt   = new THREE.Vector3(stairCX + rx, groundY + 0.90, stairEndZ);
        const railCurve = new THREE.LineCurve3(startPt, endPt);
        const railMesh = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 16, 0.022, 12, false), ssRailMat);
        approachGrp.add(railMesh);

        // 중간 레일 (높이 450mm)
        const midStart = new THREE.Vector3(stairCX + rx, slabY + 0.45, lobbyFrontZ);
        const midEnd   = new THREE.Vector3(stairCX + rx, groundY + 0.45, stairEndZ);
        const midCurve = new THREE.LineCurve3(midStart, midEnd);
        const midMesh  = new THREE.Mesh(new THREE.TubeGeometry(midCurve, 16, 0.015, 10, false), ssRailMat);
        approachGrp.add(midMesh);
      });

      // 계단 상단 및 하단 점자블록 띠
      addTactileStrip(approachGrp, stairCX, slabY + 0.002, lobbyFrontZ - 0.20, 6, 0.3);
      addTactileStrip(approachGrp, stairCX, groundY + 0.002, stairEndZ + 0.35, 6, 0.3);

      // ────────────────────────────────────────────────────────────────
      // 3. 우측 장애인 나선형 경사로 (Spiral Wheelchair Ramp)
      //    계단 오른쪽 지면에서 전면을 가로지른 뒤, 로비 우측을 시계방향으로 감아 1층에 도착.
      // ────────────────────────────────────────────────────────────────
      const rampW = 1.20;
      const rampThick = 0.12;
      const topLandW = 1.28;

      const rTop = 1.82;
      const rGround = 2.28;
      const spiralTurns = 0.76;
      const spiralCX = lobbyRightX + topLandW - 0.12 + rTop;
      const spiralCZ = lobbyFrontZ;
      const thStart = Math.PI / 2;

      function helixXZ(t) {
        const th = thStart - t * spiralTurns * Math.PI * 2;
        const r = rGround + t * (rTop - rGround);
        return { x: spiralCX + r * Math.cos(th), z: spiralCZ + r * Math.sin(th), th };
      }

      const straightStartX = stairW / 2 + 0.68;
      const helix0 = helixXZ(0);
      const join = helixXZ(0.92);

      const flatX0 = lobbyRightX - 0.20;
      const flatX1 = join.x + 0.55;
      const flatZ0 = lobbyBackZ + 0.06;
      const flatZ1 = lobbyFrontZ + 0.20;
      createBox(flatX1 - flatX0, 0.12, flatZ1 - flatZ0, lobbyMarbleFaceMats(flatX1 - flatX0, flatZ1 - flatZ0),
        (flatX0 + flatX1) / 2, slabY - 0.06, (flatZ0 + flatZ1) / 2, approachGrp);

      // 경사로 입구 방향 조정: 계단 측벽과의 협소한 간극 해소를 위해
      // 전면 보도블록(+Z 방향)을 정면으로 마주보도록 90도 완만 회전 진입로 설계
      const turnR = 1.35;
      const entryX = 2.20;
      const entryZ = helix0.z + turnR; // 약 7.14m (계단 전면단 6.51m보다 전면 오픈 플라자 위치)
      const turnCX = entryX + turnR;   // 3.55m
      const turnCZ = entryZ;

      const turnSegs = 14;
      const straightSegs = 10;
      const helixSegs = 60;
      const helixStartIdx = turnSegs + straightSegs;

      const rawPts = [];
      // (1) 전면(+Z)에서 진입하여 우측(+X)으로 완만하게 90도 회전하는 진입 곡선
      for (let i = 0; i < turnSegs; i++) {
        const t = i / turnSegs;
        rawPts.push({
          x: turnCX - turnR * Math.cos(t * Math.PI / 2),
          z: turnCZ - turnR * Math.sin(t * Math.PI / 2)
        });
      }
      // (2) 나선 진입점(helix0)으로 연결되는 접선 직선 구간
      for (let i = 0; i <= straightSegs; i++) {
        const t = i / straightSegs;
        rawPts.push({
          x: turnCX + t * (helix0.x - turnCX),
          z: helix0.z
        });
      }
      // (3) 로비 1층으로 감아 올라가는 나선형 경사로 본체
      for (let i = 1; i <= helixSegs; i++) {
        const h = helixXZ((i / helixSegs) * 0.92);
        rawPts.push({ x: h.x, z: h.z });
      }

      const arc = [0];
      for (let i = 1; i < rawPts.length; i++) {
        arc.push(arc[i - 1] + Math.hypot(rawPts[i].x - rawPts[i - 1].x, rawPts[i].z - rawPts[i - 1].z));
      }
      const flatFrom = Math.floor(rawPts.length * 0.86);
      const riseLen = arc[flatFrom] || arc[arc.length - 1];
      const samples = rawPts.map((p, i) => ({
        x: p.x,
        y: i >= flatFrom ? slabY : groundY + (arc[i] / riseLen) * deltaH,
        z: p.z
      }));

      function sweepFrames(pts) {
        const worldUp = new THREE.Vector3(0, 1, 0);
        return pts.map((p, i) => {
          const prev = pts[Math.max(0, i - 1)];
          const next = pts[Math.min(pts.length - 1, i + 1)];
          const tangent = new THREE.Vector3(next.x - prev.x, next.y - prev.y, next.z - prev.z);
          if (tangent.lengthSq() < 1e-10) tangent.set(1, 0, 0);
          tangent.normalize();
          const side = new THREE.Vector3().crossVectors(worldUp, tangent);
          if (side.lengthSq() < 1e-10) side.set(1, 0, 0);
          side.normalize();
          const up = new THREE.Vector3().crossVectors(tangent, side).normalize();
          return { p, tangent, side, up };
        });
      }

      function makeSweepGeometry(pts, width, thick) {
        const frames = sweepFrames(pts);
        const pos = [];
        const idx = [];
        const hw = width / 2;
        const ht = thick / 2;
        frames.forEach(f => {
          [[-hw, -ht], [hw, -ht], [hw, ht], [-hw, ht]].forEach(([a, b]) => {
            pos.push(
              f.p.x + f.side.x * a + f.up.x * b,
              f.p.y + f.side.y * a + f.up.y * b,
              f.p.z + f.side.z * a + f.up.z * b
            );
          });
        });
        for (let i = 0; i < frames.length - 1; i++) {
          const a = i * 4;
          const b = (i + 1) * 4;
          for (let k = 0; k < 4; k++) {
            const k1 = (k + 1) % 4;
            idx.push(a + k, a + k1, b + k1, a + k, b + k1, b + k);
          }
        }
        idx.push(0, 2, 1, 0, 3, 2);
        const e = (frames.length - 1) * 4;
        idx.push(e, e + 1, e + 2, e, e + 2, e + 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        return geo;
      }

      const rampMesh = new THREE.Mesh(makeSweepGeometry(samples, rampW, rampThick), rampSlabMat);
      rampMesh.castShadow = true;
      rampMesh.receiveShadow = true;
      approachGrp.add(rampMesh);

      const curbOff = rampW / 2 - 0.03;
      const frames = sweepFrames(samples);
      const helixLast = helixStartIdx + helixSegs;

      // ────────────────────────────────────────────────────────────────
      // 3-1. 경사로 바닥 전 구간 일정 간격 미끄럼방지 패드 (Non-slip Safety Tread Strips)
      //      (끊김 없이 전 구간 0.42m 균등 간격으로 고마찰 논슬립 스트립 설치)
      // ────────────────────────────────────────────────────────────────
      const padMat = M.conc(0x1a1d22); // 고마찰 미끄럼방지 고무/복합재 (다크 차콜 블랙)
      const padGeo = new THREE.BoxGeometry(rampW - 0.20, 0.006, 0.045);
      const PAD_SPACING = 0.42;
      let nextPadDist = 0.35;
      for (let i = 1; i < samples.length - 2; i++) {
        if (arc[i] >= nextPadDist) {
          nextPadDist += PAD_SPACING;
          const f = frames[i];
          const padMesh = new THREE.Mesh(padGeo, padMat);
          const rotMat = new THREE.Matrix4().makeBasis(f.side, f.up, f.tangent);
          padMesh.setRotationFromMatrix(rotMat);
          padMesh.position.copy(f.p).addScaledVector(f.up, rampThick / 2 + 0.003);
          padMesh.castShadow = true;
          padMesh.receiveShadow = true;
          approachGrp.add(padMesh);
        }
      }

      function addRailPts(pts, targetSpacing = 0.50) {
        if (pts.length < 2) return;
        const topPts = pts.map(p => new THREE.Vector3(p.x, p.y + 0.85, p.z));
        const botPts = pts.map(p => new THREE.Vector3(p.x, p.y + 0.65, p.z));
        const topCurve = pts.length === 2 ? new THREE.LineCurve3(topPts[0], topPts[1]) : new THREE.CatmullRomCurve3(topPts, false, 'centripetal');
        const botCurve = pts.length === 2 ? new THREE.LineCurve3(botPts[0], botPts[1]) : new THREE.CatmullRomCurve3(botPts, false, 'centripetal');
        const segs = Math.max(8, pts.length * 2);
        approachGrp.add(new THREE.Mesh(new THREE.TubeGeometry(topCurve, segs, 0.020, 10, false), ssRailMat));
        approachGrp.add(new THREE.Mesh(new THREE.TubeGeometry(botCurve, segs, 0.015, 10, false), ssRailMat));

        // 난간 지주(고정대)를 실제 3D 곡선 호 길이(Arc-length) 기준으로 완벽히 균등 분할 배치
        const totalLen = topCurve.getLength();
        const postCount = Math.max(2, Math.round(totalLen / targetSpacing));
        for (let p = 0; p <= postCount; p++) {
          const pt = topCurve.getPointAt(p / postCount);
          const floorY = pt.y - 0.85;
          createCylinder(0.016, 0.016, 0.88, ssPostMat, pt.x, floorY + 0.44, pt.z, approachGrp);
        }
      }

      const innerCurb = [];
      const outerCurb = [];
      const innerPts = [];
      const outerPts = [];
      const lobbyOpenIdx = helixStartIdx + Math.floor(helixSegs * 0.70);

      frames.forEach((f, i) => {
        if (i > helixLast) return;
        // f.side는 진행 방향 기준 항상 우측(내측, 계단/회전 중심 방향)
        // -f.side는 진행 방향 기준 항상 좌측(외측, 바깥 곡선 방향)
        innerCurb.push({
          x: f.p.x + f.side.x * curbOff,
          y: f.p.y + 0.04,
          z: f.p.z + f.side.z * curbOff
        });
        innerPts.push({
          x: f.p.x + f.side.x * curbOff,
          y: f.p.y,
          z: f.p.z + f.side.z * curbOff
        });
        if (i <= lobbyOpenIdx) {
          outerCurb.push({
            x: f.p.x - f.side.x * curbOff,
            y: f.p.y + 0.04,
            z: f.p.z - f.side.z * curbOff
          });
          outerPts.push({
            x: f.p.x - f.side.x * curbOff,
            y: f.p.y,
            z: f.p.z - f.side.z * curbOff
          });
        }
      });

      // 내측 난간 상단 도착부 로비 슬래브 정렬 연장
      innerPts.push({ x: lobbyRightX + 0.10, y: slabY, z: lobbyFrontZ + 0.12 });
      innerPts.push({ x: lobbyRightX + 0.04, y: slabY, z: lobbyFrontZ - 0.02 });

      // 1층 로비 우측 슬래브 후면 및 경사로 상단 결손 구간 안전 난간 연장 (휠체어/보행자 추락 방지)
      const extraRampEndIdx = helixStartIdx + Math.floor(helixSegs * 0.84); // ≈ 66
      for (let i = lobbyOpenIdx + 1; i <= extraRampEndIdx; i++) {
        const f = frames[i];
        const ox = f.p.x - f.side.x * curbOff;
        const oy = samples[i].y;
        const oz = f.p.z - f.side.z * curbOff;
        outerCurb.push({ x: ox, y: oy + 0.04, z: oz });
        outerPts.push({ x: ox, y: oy, z: oz });
      }
      const lastRampPt = outerPts[outerPts.length - 1];
      const flatWallZ = flatZ0;
      const flatWallX = lobbyRightX + 0.04;
      const flatSteps = 6;
      for (let s = 1; s <= flatSteps; s++) {
        const t = s / flatSteps;
        const fx = lastRampPt.x + t * (flatWallX - lastRampPt.x);
        const fz = lastRampPt.z + t * (flatWallZ - lastRampPt.z);
        outerCurb.push({ x: fx, y: slabY + 0.04, z: fz });
        outerPts.push({ x: fx, y: slabY, z: fz });
      }

      approachGrp.add(new THREE.Mesh(makeSweepGeometry(outerCurb, 0.06, 0.06), curbMat));
      approachGrp.add(new THREE.Mesh(makeSweepGeometry(innerCurb, 0.06, 0.06), curbMat));
      addRailPts(outerPts, 0.50);
      addRailPts(innerPts, 0.50);

      [0.14, 0.32, 0.50, 0.68, 0.84].forEach(t => {
        const idx = Math.round(t * helixLast);
        const f = frames[idx];
        const px = f.p.x - f.side.x * (rampW / 2 + 0.04);
        const pz = f.p.z - f.side.z * (rampW / 2 + 0.04);
        const ph = Math.max(0.18, f.p.y - groundY);
        createCylinder(0.040, 0.040, ph, pillarMat, px, groundY + ph / 2, pz, approachGrp);
      });

      const entry = samples[0];
      createBox(1.50, rampThick, 1.40, rampSlabMat, entry.x, groundY - rampThick / 2 + 0.01, entry.z + 0.70, approachGrp);
      addTactileStrip(approachGrp, entry.x, groundY + 0.002, entry.z + 0.70, 4, 0.3);

      // ────────────────────────────────────────────────────────────────
      // 4. 1층 로비 슬래브 외곽 추락방지 안전 난간
      //    (전면 좌측, 전면 우측, 좌측단 테두리에 스테인리스 난간 설치)
      // ────────────────────────────────────────────────────────────────
      // (1) 전면 좌측 난간: X ∈ [lobbyLeftX, -stairW/2]
      const frontRailLeftX0 = lobbyLeftX;
      const frontRailLeftX1 = -stairW / 2;
      for (let fx = frontRailLeftX0 + 0.1; fx <= frontRailLeftX1 - 0.05; fx += 0.40) {
        createCylinder(0.018, 0.018, 0.90, ssPostMat, fx, slabY + 0.45, lobbyFrontZ - 0.03, approachGrp);
      }
      const frontRailCurve = new THREE.LineCurve3(
        new THREE.Vector3(frontRailLeftX0, slabY + 0.90, lobbyFrontZ - 0.03),
        new THREE.Vector3(frontRailLeftX1, slabY + 0.90, lobbyFrontZ - 0.03)
      );
      approachGrp.add(new THREE.Mesh(new THREE.TubeGeometry(frontRailCurve, 8, 0.020, 10, false), ssRailMat));
      const midRailLeftCurve = new THREE.LineCurve3(
        new THREE.Vector3(frontRailLeftX0, slabY + 0.45, lobbyFrontZ - 0.03),
        new THREE.Vector3(frontRailLeftX1, slabY + 0.45, lobbyFrontZ - 0.03)
      );
      approachGrp.add(new THREE.Mesh(new THREE.TubeGeometry(midRailLeftCurve, 8, 0.015, 10, false), ssRailMat));

      // (2) 전면 우측 난간: X ∈ [stairW/2 + 0.10, lobbyRightX] (계단 우측단 ~ 승강장 슬래브 모서리 추락방지)
      const frontRailRightX0 = stairW / 2 + 0.10;
      const frontRailRightX1 = lobbyRightX;
      for (let fx = frontRailRightX0; fx <= frontRailRightX1; fx += 0.35) {
        createCylinder(0.018, 0.018, 0.90, ssPostMat, fx, slabY + 0.45, lobbyFrontZ - 0.03, approachGrp);
      }
      const frontRailRightCurve = new THREE.LineCurve3(
        new THREE.Vector3(frontRailRightX0, slabY + 0.90, lobbyFrontZ - 0.03),
        new THREE.Vector3(frontRailRightX1, slabY + 0.90, lobbyFrontZ - 0.03)
      );
      approachGrp.add(new THREE.Mesh(new THREE.TubeGeometry(frontRailRightCurve, 4, 0.020, 10, false), ssRailMat));
      const midRailRightCurve = new THREE.LineCurve3(
        new THREE.Vector3(frontRailRightX0, slabY + 0.45, lobbyFrontZ - 0.03),
        new THREE.Vector3(frontRailRightX1, slabY + 0.45, lobbyFrontZ - 0.03)
      );
      approachGrp.add(new THREE.Mesh(new THREE.TubeGeometry(midRailRightCurve, 4, 0.015, 10, false), ssRailMat));

      // (3) 좌측단 전장 난간: Z ∈ [lobbyBackZ, lobbyFrontZ]
      for (let lz = lobbyBackZ + 0.2; lz <= lobbyFrontZ - 0.05; lz += 0.55) {
        createCylinder(0.018, 0.018, 0.90, ssPostMat, lobbyLeftX + 0.03, slabY + 0.45, lz, approachGrp);
      }
      const leftRailCurve = new THREE.LineCurve3(
        new THREE.Vector3(lobbyLeftX + 0.03, slabY + 0.90, lobbyBackZ),
        new THREE.Vector3(lobbyLeftX + 0.03, slabY + 0.90, lobbyFrontZ)
      );
      approachGrp.add(new THREE.Mesh(new THREE.TubeGeometry(leftRailCurve, 10, 0.020, 10, false), ssRailMat));

      parent.add(approachGrp);
    }

    function buildFrontWallAndLobby() {
      if (wallGrp) scene.remove(wallGrp);
      wallGrp = new THREE.Group();
      // 1층 승강장 단차 해소 (포디움 기단부, 보행자 직통 계단, 우측 나선형 휠체어 경사로)
      buildLobbyApproachRampAndStairs(wallGrp);
      // 외면=석재 사진, 승강로 내면=콘크리트. 현판·코니스·문틀은 그대로 둔다.
      const terracottaMat = M.paint(0xa95032);
      const jambSs = M.silverHairline(0xc8d0d8, 0.28);
      const wallZ = FRONT_WALL_INNER_Z + S.WALL_T / 2; // 승강로 전면벽 — 카 전면에서 ~200mm (문 구역 깊이 확보)
      const doorHoleW = S.DOOR_W + 0.1;
      const totalWallW = S.SHAFT_W + S.WALL_T * 2;
      const sideW = (totalWallW - doorHoleW) / 2;
      const facadeZ = wallZ + S.WALL_T / 2 + 0.012;

      for (let i = 0; i < FLOORS; i++) {
        const fy = FLOOR_Y[i];
        const fh = (i === 0) ? 4.0 : (i === 1 ? 3.65 : 3.7);

        // 좌우 벽체
        createBox(sideW, fh, S.WALL_T, lobbyFrontWallMats(sideW, fh, S.WALL_T),
          -doorHoleW / 2 - sideW / 2, fy + fh / 2, wallZ, wallGrp);
        createBox(sideW, fh, S.WALL_T, lobbyFrontWallMats(sideW, fh, S.WALL_T),
          doorHoleW / 2 + sideW / 2, fy + fh / 2, wallZ, wallGrp);

        // 상부 마감벽 틈새 완벽 차단 (도어+문틀+막판 높이 계산)
        const transomTopY = 2.56;
        const topH = fh - transomTopY;
        createBox(doorHoleW, topH, S.WALL_T, lobbyFrontWallMats(doorHoleW, topH, S.WALL_T),
          0, fy + transomTopY + topH / 2, wallZ, wallGrp);

        // 승강장 삼방틀 — 헤어라인 스테인리스 (올리브/테라코타 장식틀 제거)
        const portalX = doorHoleW / 2 + 0.045;
        createBox(0.09, 2.56, 0.025, jambSs, -portalX, fy + 1.28, facadeZ, wallGrp);
        createBox(0.09, 2.56, 0.025, jambSs,  portalX, fy + 1.28, facadeZ, wallGrp);
        createBox(doorHoleW + 0.18, 0.10, 0.028, jambSs, 0, fy + 2.56, facadeZ + 0.002, wallGrp);

        // 층별 수평 코니스 — 단조로운 흰 수직면을 분절하는 따뜻한 테라코타 띠
        createBox(totalWallW, 0.11, 0.035, terracottaMat,
          0, fy + fh - 0.055, facadeZ + 0.004, wallGrp);

        // 로비 대리석 바닥 — 상면만 타일 텍스처 (전면벽 이동에 맞춰 깊이 보정)
        const lobbyDepth = 1.5 + (S.SHAFT_D / 2 - FRONT_WALL_INNER_Z);
        createBox(totalWallW, 0.12, lobbyDepth, lobbyMarbleFaceMats(totalWallW, lobbyDepth),
          0, fy - 0.06, wallZ + S.WALL_T / 2 + lobbyDepth / 2, wallGrp);

        // 천장 Y 좌표 (해당 층 바닥 + 층고)
        const ceilingY = fy + fh;

        // 4층(최상층) 천장 캐노피 슬래브 추가 (타 층 슬래브와 동일 레벨 및 재질로 일체화)
        if (i === FLOORS - 1) {
          createBox(totalWallW, 0.12, lobbyDepth, lobbyMarbleFaceMats(totalWallW, lobbyDepth), 0, ceilingY - 0.06, wallZ + S.WALL_T / 2 + lobbyDepth / 2, wallGrp);
          // 로비 캐노피는 원래 높이에 두고, 그 위 승강로 전면만 기계실 슬래브까지 막는다.
          const overheadWallH = SHAFT_CEIL_Y - ceilingY;
          if (overheadWallH > 0) {
            const upperWall = createBox(totalWallW, overheadWallH, S.WALL_T,
              lobbyFrontWallMats(totalWallW, overheadWallH, S.WALL_T),
              0, ceilingY + overheadWallH / 2, wallZ, wallGrp);
            upperWall.name = 'shaftOverheadFrontWall';
          }
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
        addTactileBlock(wallGrp, btnBoxX, fy + 0.0025, wallZ + S.WALL_T / 2 + 0.3, 0.3);
      }

      // 피트 전면벽 추가
      createBox(totalWallW, PIT, S.WALL_T, lobbyFrontWallMats(totalWallW, PIT, S.WALL_T),
        0, Y0 + PIT / 2, wallZ, wallGrp);

      // [수정] 좌측 벽면 — 전면(FRONT_INNER_Z) 고정, 후면은 SHAFT_BACK_Z 로 확장
      const sideWallH = TOTAL_H + 2.2;
      const sideWallX = -(S.SHAFT_W / 2 + S.WALL_T / 2);
      const sideWallFront = FRONT_WALL_INNER_Z + S.WALL_T; // 전면 외측 (전면벽 정렬)
      const sideWallD = sideWallFront - SHAFT_BACK_Z; // 깊이 확장 시 후방으로만 성장
      const sideWallCZ = (sideWallFront + SHAFT_BACK_Z) / 2;

      createBox(S.WALL_T, sideWallH, sideWallD, lobbySideWallMats(S.WALL_T, sideWallH, sideWallD),
        sideWallX, Y0 + sideWallH / 2, sideWallCZ, wallGrp);

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

    function mergeStaticMeshBucket(meshes, worldSpace = false) {
      const parts = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(worldSpace ? mesh.matrixWorld : mesh.matrix));
      const geometry = new THREE.BufferGeometry();
      for (const name of Object.keys(parts[0].attributes)) {
        const first = parts[0].getAttribute(name);
        const array = new first.array.constructor(parts.reduce((n, part) => n + part.getAttribute(name).array.length, 0));
        let offset = 0;
        for (const part of parts) {
          const values = part.getAttribute(name).array;
          array.set(values, offset); offset += values.length;
        }
        geometry.setAttribute(name, new THREE.BufferAttribute(array, first.itemSize, first.normalized));
      }
      const indices = [], sourceRanges = [];
      let vertexOffset = 0;
      parts.forEach((part, i) => {
        const count = part.index ? part.index.count : part.attributes.position.count;
        sourceRanges.push({ name: meshes[i].name, sourceId: meshes[i].id, start: indices.length, count });
        for (let j = 0; j < count; j++) indices.push(vertexOffset + (part.index ? part.index.getX(j) : j));
        vertexOffset += part.attributes.position.count;
      });
      geometry.setIndex(indices);
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, meshes[0].material);
      mesh.castShadow = meshes[0].castShadow; mesh.receiveShadow = meshes[0].receiveShadow;
      mesh.renderOrder = meshes[0].renderOrder; mesh.layers.mask = meshes[0].layers.mask;
      mesh.frustumCulled = meshes[0].frustumCulled;
      mesh.userData.sourceRanges = sourceRanges;
      parts.forEach(part => part.dispose());
      return mesh;
    }

    // 명시한 고정 조립체에만 적용한다. 이름·userData·자식이 있는 부품은 개별 유지한다.
    // 부모 로컬 좌표로 묶으므로 카 이동 및 층별 그룹의 표시/숨김을 그대로 따른다.
    function batchStaticChildren(parent, label) {
      const buckets = new Map();
      for (const mesh of parent.children) {
        if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.name ||
            mesh.children.length || Object.keys(mesh.userData).length || !mesh.visible ||
            Array.isArray(mesh.material) || mesh.material.transparent || mesh.material.opacity !== 1 ||
            Object.keys(mesh.geometry.morphAttributes).length || mesh.geometry.drawRange.start !== 0 ||
            mesh.geometry.drawRange.count !== Infinity) continue;
        const attributes = Object.entries(mesh.geometry.attributes);
        if (attributes.some(([, a]) => a.isInterleavedBufferAttribute)) continue;
        mesh.updateMatrix();
        if (mesh.matrix.determinant() <= 0) continue;
        const signature = attributes.map(([name, a]) => [name, a.itemSize, a.normalized, a.array.constructor.name]);
        const key = JSON.stringify([mesh.material.uuid, mesh.castShadow, mesh.receiveShadow,
          mesh.renderOrder, mesh.layers.mask, mesh.frustumCulled, signature]);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(mesh);
      }
      let batchIndex = 0;
      for (const meshes of buckets.values()) {
        if (meshes.length < 2) continue;
        const merged = mergeStaticMeshBucket(meshes);
        merged.name = 'staticBatch_' + label + '_' + batchIndex++;
        meshes.forEach(mesh => parent.remove(mesh));
        parent.add(merged);
      }
    }

    // 고정 브라켓 전용: GLB 원본과 각 설치 그룹의 userData는 유지한다.
    function batchRailBracket(source) {
      source.updateMatrixWorld(true);
      const buckets = new Map();
      source.traverse(mesh => {
        if (!mesh.isMesh) return;
        const key = mesh.material.uuid;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(mesh);
      });
      const result = new THREE.Group();
      result.name = source.name;
      for (const meshes of buckets.values()) {
        const mesh = mergeStaticMeshBucket(meshes, true);
        mesh.name = 'railBracketBatch_' + mesh.material.name;
        mesh.castShadow = true; mesh.receiveShadow = true;
        result.add(mesh);
      }
      return result;
    }

    // 레일 본체(T_Rail_*)는 과속 단면에서 이름으로 참조하므로 개별 유지한다.
    // 같은 부모의 고정 체결부만 묶고 FP_ 접두어로 최상단 이음부 숨김을 유지한다.
    function batchGuideRailFasteners(source) {
      const roots = [];
      source.traverse(o => { if (/^GuideRail_(13K|8K)_Root$/.test(o.name)) roots.push(o); });
      for (const parent of roots) {
        const buckets = new Map();
        for (const mesh of parent.children) {
          if (!mesh.isMesh || !/^FP_(13K|8K)_(BoltHead|Nut|Tip)_/.test(mesh.name) ||
              mesh.children.length || !mesh.visible || mesh.isSkinnedMesh || mesh.isInstancedMesh ||
              Array.isArray(mesh.material) || mesh.material.transparent || mesh.material.opacity !== 1 ||
              Object.keys(mesh.geometry.morphAttributes).length || mesh.geometry.drawRange.start !== 0 ||
              mesh.geometry.drawRange.count !== Infinity) continue;
          const attributes = Object.entries(mesh.geometry.attributes);
          if (attributes.some(([, a]) => a.isInterleavedBufferAttribute)) continue;
          mesh.updateMatrix();
          if (mesh.matrix.determinant() <= 0) continue;
          const signature = attributes.map(([name, a]) => [name, a.itemSize, a.normalized, a.array.constructor.name]);
          const key = JSON.stringify([mesh.material.uuid, mesh.castShadow, mesh.receiveShadow,
            mesh.renderOrder, mesh.layers.mask, mesh.frustumCulled, signature]);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(mesh);
        }
        let index = 0;
        for (const meshes of buckets.values()) {
          if (meshes.length < 2) continue;
          const merged = mergeStaticMeshBucket(meshes);
          merged.name = 'FP_FastenerBatch_' + index++;
          meshes.forEach(mesh => parent.remove(mesh));
          parent.add(merged);
        }
      }
    }

    function buildGuideRails() {
      railGrp = new THREE.Group();

      const chH = 0.1;
      const baseMat = M.paint(0x374151);
      // 카 레일 Z — 항상 카 중심을 따라감 (깊이 확장 시 후방 이동).
      // 종단 안전장치·이동케이블이 같은 값을 쓰므로 원본은 index.html CAR_RAIL_Z 하나다.
      const carRailZ = CAR_RAIL_Z;
      // 카 레일 지지 채널
      createBox(S.CAR_BG + 0.3, chH, 0.2, baseMat, 0, Y0 + chH / 2, carRailZ, railGrp);
      // 균형추 레일 지지 채널
      createBox(S.CWT_W + 0.3, chH, 0.2, baseMat, 0, Y0 + chH / 2, CWT_CENTER_Z, railGrp);

      const startY = Y0 + chH; // 지지 채널 상단 (0.1m)
      const rh = TOTAL_H - 0.1 - chH; // 기계실 기준 바닥보다 0.1m 아래에서 끝난다.

      const gltfLoader = new THREE.GLTFLoader();

      // 레일 세그먼트 스택 함수 (5m 단위 모듈 스택 + 상단 마감 및 5m 단위 피시플레이트 조인트)
      function createFullRail(gltfScene, posX, posZ, rotY, isCwt) {
        const railCol = new THREE.Group();
        railCol.position.set(posX, 0, posZ);
        railCol.rotation.y = rotY;

        const segLen = 5.0;
        const count = Math.ceil(rh / segLen);

        for (let i = 0; i < count; i++) {
          const segY = startY + i * segLen;
          const isTop = (i === count - 1);
          const seg = gltfScene.clone(true);

          if (isTop) {
            // 최상단 세그먼트: 남은 높이에 맞춰 레일 본체만 스케일 조정, 피시플레이트는 숨김
            const remH = rh - i * segLen;
            const sY = remH / segLen;
            seg.position.set(0, segY, 0);
            seg.traverse(child => {
              if (child.name && child.name.startsWith('FP_')) {
                child.visible = false; // 상단 슬래브 위 조인트는 불필요
              } else if (child.name && child.name.startsWith('T_Rail_')) {
                child.scale.set(1, sY, 1);
              }
            });
          } else {
            seg.position.set(0, segY, 0);
          }
          railCol.add(seg);
        }
        return railCol;
      }

      // 1. 카 가이드레일 13K 로드 및 배치 (좌/우 2개)
      gltfLoader.load('models/gltf/guide_rail_13k.glb', (gltf) => {
        const carRailScene = gltf.scene;
        carRailScene.traverse(o => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        });
        batchGuideRailFasteners(carRailScene);

        // 좌측 카 레일 (헤드가 +X 카 중심을 봄, rotation.y = 0)
        const leftCarRail = createFullRail(carRailScene, -S.CAR_BG / 2, carRailZ, 0, false);
        // 우측 카 레일 (헤드가 -X 카 중심을 봄, rotation.y = Math.PI)
        const rightCarRail = createFullRail(carRailScene, S.CAR_BG / 2, carRailZ, Math.PI, false);

        railGrp.add(leftCarRail, rightCarRail);
      }, undefined, (err) => {
        console.error('[GuideRail 13K Load Error]:', err);
      });

      // 2. 균형추 가이드레일 8K 로드 및 배치 (후면 좌/우 2개, 벽이 없어 공중에 뜸)
      gltfLoader.load('models/gltf/guide_rail_8k.glb', (gltf) => {
        const cwtRailScene = gltf.scene;
        cwtRailScene.traverse(o => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        });
        batchGuideRailFasteners(cwtRailScene);

        // 균형추 좌측 레일 (헤드가 +X 균형추 중심을 봄, rotation.y = 0)
        const leftCwtRail = createFullRail(cwtRailScene, -S.CWT_W / 2, CWT_CENTER_Z, 0, true);
        // 균형추 우측 레일 (헤드가 -X 균형추 중심을 봄, rotation.y = Math.PI)
        const rightCwtRail = createFullRail(cwtRailScene, S.CWT_W / 2, CWT_CENTER_Z, Math.PI, true);

        railGrp.add(leftCwtRail, rightCwtRail);
      }, undefined, (err) => {
        console.error('[GuideRail 8K Load Error]:', err);
      });

      // 3. 레일 브라켓 어셈블리 로드 및 배치 (현장 실무 기준 2.7m 간격, 벽이 있는 카 좌측만 설치)
      gltfLoader.load('models/gltf/rail_bracket.glb', (gltf) => {
        const bktScene = batchRailBracket(gltf.scene);
        bktScene.traverse(o => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        });

        // 기존 6단 + 연장된 상부의 지지 브라켓 — 원본은 index.html RAIL_BRACKET_Y
        // (buildLimitSwitches 의 캠·자석판 암이 같은 배열을 보고 이 단을 피한다)
        // ★역으로 브라켓이 스위치 트립 높이와 겹치는 경우(예: 최상단 14.85가 ULS/UFL 14.86~14.87과
        //   12~17mm 차) 암만 피해서는 부족하다 — 브라켓 옆리브가 넓게 뻗어 나와 스위치 위로
        //   튀어나온 것처럼 보인다. 그 단만 스위치에서 충분히 떨어뜨린다(현장에서도 브라켓
        //   피치를 국소 조정해 부속물을 피한다).
        const BKT_SWITCH_CLEAR = 0.20;
        const bktHeights = RAIL_BRACKET_Y.map(by => {
          for (const sw of TERMINAL_SWITCHES) {
            const d = by - sw.y;
            if (Math.abs(d) < BKT_SWITCH_CLEAR) return sw.y + (d < 0 ? -1 : 1) * BKT_SWITCH_CLEAR;
          }
          return by;
        });

        bktHeights.forEach(by => {
          const bkt = bktScene.clone(true);
          // 좌측 카 레일 배면(-S.CAR_BG / 2)에 부착 -> -X 방향으로 뻗어 좌측 콘크리트 벽면에 밀착
          bkt.position.set(-S.CAR_BG / 2, by, carRailZ);
          bkt.userData = { type: 'rail-bracket', side: 'left', y: by };
          railGrp.add(bkt);
        });
      }, undefined, (err) => {
        console.error('[Rail Bracket Load Error]:', err);
      });

      scene.add(railGrp);
    }

    /* ==========================================================================
       buildShaftLandingDevices — 승강로 층 인식용 착상 장치 (카 완성 후 재디자인 예정)
       ========================================================================== */
    function buildShaftLandingDevices() {
      landingDevices.length = 0;

      for (let fIdx = 0; fIdx < FLOORS; fIdx++) {
        const triggerY = FLOOR_Y[fIdx];
        // 층 감지 논리 데이터는 유지하되, 시각적 메시는 카 재공사 후 새 디자인으로 재부착
        landingDevices.push({ floor: fIdx, type: 'landing', triggerY: triggerY });
      }
    }

    /* ==========================================================================
       buildLimitSwitches — 승강로(레일 고정) 종단 리미트 스위치 6개
       MR_설계.pdf 16.8 CAM ASSY 및 FLS ASSY 설치 (파일 137~138p, 책 135~136p)

       스위치 방식: "레일 클립을 이용하여 FLS ASSY를 카 레일에 고정"(137p 2항).
       캠은 카 스타일에 붙어 함께 움직이고(elevator.js buildCarCabin §7),
       여기서는 레일에 남는 롤러 레버 리미트 스위치만 만든다.
         · 하부(피트): DFL 파이널 → DLS 리미트 → DSD 강제감속
         · 상부      : USD 강제감속 → ULS 리미트 → UFL 파이널
       각 스위치 = 레일 클립 1조 + 슬롯 암 1본 + 수직 취부판 + 스위치 본체 + 롤러 레버.
       높이 원본은 index.html TERMINAL_SWITCHES (트립점 ± 캠 끝단 로컬 Y).

       구형 일렬 배치의 모델 트립점은 index.html의 LS_TRIP/FLS_OVERTRAVEL/SLD_DIST.
       기존 MR 병렬 배치 수치를 중복 입력하지 않는다.
       ========================================================================== */
    function buildLimitSwitches() {
      limitGrp = new THREE.Group();
      limitGrp.name = 'limitGrp';
      terminalDevices.switches.length = 0;

      const railX      = -CAR_RAIL_X;            // 좌측 카 레일 배면 X (-1.3125)
      const armX       = railX - 0.017;          // 슬롯 암 중심 X (레일 배면 뒤 8t 평철)
      const armT       = 0.008;                  // 암 두께 (X)
      const armH       = 0.035;                  // 암 높이 (Y)
      const flangeHalfZ = 0.0445;                // 13K 레일 베이스 플랜지 반폭 (rail_bracket.py 원본)

      const armMat   = M.ss(0x9aa3ad);
      const clipMat  = M.gold();
      const boltMat  = M.ss(0xb8bec6);
      const swBodyMat = M.ss(0x8a9196);          // 구형 다이캐스트 몸체
      const swCapMat  = M.paint(0x972d27);       // 적갈색 회전 헤드
      const leverMat  = M.ss(0xc0c7ce);
      const rollerMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.62, metalness: 0.12 });
      function roundedOutline(w,h,r,Path=THREE.Shape) {
        const p=new Path(),x=-w/2,y=-h/2;
        p.moveTo(x+r,y);p.lineTo(x+w-r,y);p.quadraticCurveTo(x+w,y,x+w,y+r);
        p.lineTo(x+w,y+h-r);p.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        p.lineTo(x+r,y+h);p.quadraticCurveTo(x,y+h,x,y+h-r);
        p.lineTo(x,y+r);p.quadraticCurveTo(x,y,x+r,y);return p;
      }

      /* 레일 클립 1조 — 베이스 플랜지 양쪽을 물고 M12 볼트로 암에 조인다 (195p, 202p) */
      function addRailClips(y) {
        [-1, 1].forEach(sg => {
          const cz = CAR_RAIL_Z + sg * flangeHalfZ;
          createBox(0.034, 0.026, 0.020, clipMat, railX - 0.006, y, cz, limitGrp);
          const bolt = createCylinder(0.006, 0.006, 0.046, boltMat, railX - 0.010, y, cz, limitGrp);
          bolt.rotation.z = Math.PI / 2;
          createCylinder(0.010, 0.010, 0.009, clipMat, railX + 0.014, y, cz, limitGrp).rotation.z = Math.PI / 2;
        });
      }

      /* 레일 브라켓 단과 겹치는 취부 높이를 밴드 밖으로 밀어낸다.
         브라켓은 레일 배면(-X)에서 좌측 벽까지 뻗어 있어 캠·자석판 암과 같은 공간을 쓴다. */
      function clearOfBracket(y) {
        for (const by of RAIL_BRACKET_Y) {
          const d = y - by;
          if (Math.abs(d) < RAIL_BRACKET_BAND) return by + (d < 0 ? -1 : 1) * RAIL_BRACKET_BAND;
        }
        return y;
      }

      /* 슬롯 암 1본 — 레일에서 목표 Z 레인까지 뻗는 평철. 길이조절 장공 2개. */
      function addSlotArm(y, targetZ) {
        const z0 = CAR_RAIL_Z - Math.sign(targetZ - CAR_RAIL_Z) * 0.075; // 레일 반대쪽 짧은 물림부
        const zc = (z0 + targetZ) / 2;
        const len = Math.abs(targetZ - z0);
        const outline=roundedOutline(len,armH,0.002);
        // 검은 사각형 대신 실제 관통 장공을 낸 아연도금 평철.
        [0.30, 0.62].forEach(t => {
          const hole=roundedOutline(0.050,0.010,0.005,THREE.Path);
          const shift=-(z0+(targetZ-z0)*t-zc);
          hole.curves.forEach(c=>{for(const key of ['v0','v1','v2','v3'])if(c[key])c[key].x+=shift;});
          outline.holes.push(hole);
        });
        const arm=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:armT,bevelEnabled:false,curveSegments:6}),armMat);
        arm.rotation.y=Math.PI/2;arm.position.set(armX-armT/2,y,zc);arm.name='terminalRailArm';
        arm.userData.type='terminal-rail-arm';limitGrp.add(arm);
        addRailClips(y);
      }

      /* ── 롤러 레버 리미트 스위치 1개 (FLS ASSY) ──
         레버는 고정축에서 +X(카 쪽)로 뻗고, 캠에 눌리면 dir 방향(하부 −, 상부 +)으로 60° 젖혀진다.
         레버·롤러는 본체 옆면(+Z)의 축에 달려 본체와 다른 Z 평면에서 돈다. */
      const bodyW = 0.046, bodyH = 0.105, bodyD = 0.038;
      function addLimitSwitch(spec) {
        const laneZ  = FLS_Z + spec.dz;              // 이 스위치의 레버 레인
        const leverZ = laneZ;                        // 공용 캠 중앙과 롤러 중심 일치
        const bodyZ  = laneZ - 0.027;                // 본체는 레버 뒤쪽
        const pivotY = spec.y;
        const bodyY  = pivotY - 0.050;               // 축은 본체 상단 근처
        const bodyX  = FLS_PIVOT_X - 0.004;

        // (a) 레일 클립 + 슬롯 암 (레일 브라켓 단 회피) + 수직 취부판
        //     ★브라켓 단과 겹쳐 armY가 크게 밀리면(예: ULS/UFL이 상단 브라켓과 5cm 이내)
        //     연결판이 그만큼 길어진다 — 폭 75mm 통판 그대로 늘리면 덩어리가 튀어나와 보이므로
        //     늘어난 길이만큼 폭을 좁혀 얇은 스탠드오프 스트럿처럼 보이게 한다(하부와 같은 인상).
        const armY = clearOfBracket(bodyY);
        addSlotArm(armY, laneZ);
        const plateX = railX - 0.012;
        const stretch = Math.abs(armY - bodyY);
        const plateH  = stretch + 0.130;
        const plateD  = Math.max(0.028, 0.075 * (0.130 / plateH));
        createBox(0.010, plateH, plateD, armMat, plateX, (armY + bodyY) / 2, laneZ - 0.010, limitGrp);
        if (stretch < 0.010) {
          [-0.030, 0.030].forEach(dy => {
            createBox(0.002, 0.052, 0.010, M.paint(0x2b3038), plateX + 0.005, bodyY + dy, laneZ - 0.010, limitGrp);
          });
        }
        // 암 ↔ 판 볼트
        createCylinder(0.005, 0.005, 0.030, boltMat, armX + 0.004, armY, laneZ, limitGrp).rotation.z = Math.PI / 2;

        // (b) 스위치 본체 + 케이블 글랜드 + 판 고정 볼트 2개
        const body = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedOutline(bodyW-0.002,bodyH-0.002,0.004),
          {depth:bodyD-0.002,bevelEnabled:true,bevelSize:0.001,bevelThickness:0.001,bevelSegments:2,steps:1}),swBodyMat);
        body.position.set(bodyX,bodyY,bodyZ-bodyD/2+0.001);limitGrp.add(body);
        body.name = 'terminalBody_' + spec.name;
        body.userData = {type:'terminal-switch', name:spec.name, kind:spec.kind};
        createBox(bodyW-0.005,bodyH-0.026,0.002,M.paint(0x34383a),bodyX,bodyY-0.005,bodyZ+bodyD/2+0.001,limitGrp);
        for(const dx of [-0.016,0.016]) for(const dy of [-0.038,0.029]) {
          createCylinder(0.0028,0.0028,0.003,boltMat,bodyX+dx,bodyY+dy,bodyZ+bodyD/2+0.003,limitGrp).rotation.x=Math.PI/2;
        }
        createBox(bodyW + 0.002, 0.020, bodyD + 0.002, swCapMat, bodyX, bodyY + bodyH / 2 - 0.010, bodyZ, limitGrp);
        createCylinder(0.008, 0.008, 0.019, boltMat, bodyX, bodyY - bodyH / 2 - 0.009, bodyZ, limitGrp);
        // 현장처럼 암 뒷면으로 정리한 검정 배선과 레일 배면 수직 간선.
        const cablePts=[new THREE.Vector3(bodyX,bodyY-bodyH/2-0.019,bodyZ),
          new THREE.Vector3(armX-0.012,bodyY-bodyH/2-0.030,bodyZ),
          new THREE.Vector3(armX-0.012,armY-0.027,bodyZ),
          new THREE.Vector3(armX-0.012,armY-0.027,CAR_RAIL_Z-0.065)];
        const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts),28,0.003,8,false),M.paint(0x202124));
        cable.name='terminalCable_'+spec.name;limitGrp.add(cable);
        [-0.032, 0.032].forEach(dy => {
          createCylinder(0.004, 0.004, 0.014, boltMat, plateX + 0.010, bodyY + dy, bodyZ, limitGrp).rotation.z = Math.PI / 2;
        });

        // (c) 레버 + 롤러 — 고정축(피벗)에서 +X 로 뻗고, 캠에 눌리면 dir 방향으로 회전한다
        const lever = new THREE.Group();
        lever.name = 'limitLever_' + spec.name;
        lever.position.set(FLS_PIVOT_X, pivotY, leverZ);
        limitGrp.add(lever);
        createCylinder(0.006, 0.006, 0.030, M.ss(0xc8ced4), 0, 0, -0.012, lever).rotation.x = Math.PI / 2; // 고정축
        createBox(FLS_LEVER_L, 0.014, 0.008, leverMat, FLS_LEVER_L / 2, 0, 0, lever);
        createBox(FLS_LEVER_L * 0.6, 0.004, 0.010, M.paint(0x2b3038), FLS_LEVER_L / 2, 0, 0, lever); // 길이 조절 장공
        const roller = createCylinder(FLS_ROLLER_R, FLS_ROLLER_R, 0.014, rollerMat, FLS_LEVER_L, 0, 0, lever);
        roller.rotation.x = Math.PI / 2;
        createCylinder(0.009, 0.009, 0.018, M.ss(0xd0d6dc), FLS_LEVER_L, 0, 0, lever).rotation.x = Math.PI / 2;
        roller.userData = { type: 'terminal-switch', name: spec.name, kind: spec.kind };

        terminalDevices.switches.push({ ...spec, lever, body, ratio: 0 });
      }

      TERMINAL_SWITCHES.forEach(addLimitSwitch);
      const cableLo=TERMINAL_SWITCHES[0].y-0.15, cableHi=TERMINAL_SWITCHES[5].y+0.12;
      const trunk=createCylinder(0.005,0.005,cableHi-cableLo,M.paint(0x202124),armX-0.012,(cableHi+cableLo)/2,CAR_RAIL_Z-0.065,limitGrp);
      trunk.name='terminalFixedCableTrunk';

      scene.add(limitGrp);
    }

    /* ==========================================================================
       buildLevelingVanes — 각 층 착상장치 차폐판 (LCD Vane)
       MR_설계.pdf 20.4 (파일 186~187p) 레일 부착형.
       GLB 원점은 좌측 카 레일 배면 중심. 형상은 index.html LCD_* 계약에서 파생.
       층별 Y는 착상 카의 톱빔 월드 높이(카 중심 + LCD_VANE_TOP_BEAM_LY)와 맞춘다.
       ========================================================================== */
    function buildLevelingVanes() {
      levelingSystem.vanes.length = 0;
      new THREE.GLTFLoader().load('models/gltf/leveling_vane.glb', (gltf) => {
        const proto = gltf.scene;
        proto.traverse(o => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        });
        for (let f = 0; f < FLOORS; f++) {
          const vane = proto.clone(true);
          vane.name = 'levelingVane_' + (f + 1);
          vane.position.set(-CAR_RAIL_X, FLOOR_Y[f] + S.CAR_H / 2 + LCD_VANE_TOP_BEAM_LY, CAR_RAIL_Z);
          vane.userData = { type: 'leveling-vane', floor: f + 1 };
          railGrp.add(vane);
          registerLevelingVane(vane, f + 1);
        }
      }, undefined, (err) => {
        console.error('[Leveling Vane Load Error]:', err);
      });
    }

    /* 기계실형: 도어 접점과 조명 검정 배선, 상하 스위치 박스. */
    function buildShaftCableHarness() {
      const G = shaftCableGrp = new THREE.Group();
      G.name = 'shaftCableGrp';
      const black = M.paint(0x141619), metal = M.ss(0xa3a6a8);
      const wallX = -S.SHAFT_W / 2;
      const wireX = wallX + 0.045;
      const pitY = Y0 + 0.02;
      function wire(points, name) {
        const group = new THREE.Group(); group.name = name; G.add(group);
        for (let i=1; i<points.length; i++) {
          const a = new THREE.Vector3(...points[i-1]), b = new THREE.Vector3(...points[i]);
          const v = b.clone().sub(a);
          const m = createCylinder(0.006, 0.006, v.length(), black, ...a.clone().add(b).multiplyScalar(0.5).toArray(), group);
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), v.normalize());
        }
        return group;
      }
      // 제어반 하부에서 벽면으로 내려오는 검정 접점선과 조명선.
      const mrY = Y0 + TOTAL_H + 0.055;
      [HARNESS_Z, SHAFT_LIGHT_Z - 0.40].forEach((z,i) => {
        wire([[MR_CABLE_HOLE_X-0.16,mrY,HARNESS_Z],[MR_CABLE_HOLE_X,mrY,HARNESS_Z],
          [MR_CABLE_HOLE_X,CEIL_RUN_Y,HARNESS_Z],[wireX,CEIL_RUN_Y,HARNESS_Z],
          [wireX,CEIL_RUN_Y,z],[wireX,i ? pitY+0.85 : PIT_REMOTE_Y,z]],i ? 'lightingRiser' : 'doorContactRiser');
        for(let y=pitY+1; y<CEIL_RUN_Y; y+=1.5)
          createBox(0.05,0.014,0.022,metal,wallX+0.025,y,z,G);
      });
      for(let f=0; f<FLOORS; f++) {
        const interlock=hatchDoors[f].interlock;
        interlock.promise.then(()=>{
          interlock.fixed.updateWorldMatrix(true,true);
          interlock.fixed.traverse(o=>{
            if(o.isMesh && o.name.startsWith('Yellow lead')) o.material=black;
          });
          const back=interlock.fixed.getObjectByName('SwitchBackplate');
          const bb=new THREE.Box3().setFromObject(back);
          const y=bb.max.y+0.035, z=bb.max.z+0.015;
          // 부품설계.pdf 189p: 각 층 헤더 옆 통신·인터록 분기 박스.
          const jb=new THREE.Group(); jb.name='hallJunctionBox_'+f;
          jb.userData={type:'hall-junction-box',floor:f};
          jb.position.set(wireX,y-0.07,HARNESS_Z); G.add(jb);
          const housing=M.paint(0x090b0d); housing.clearcoat=0; housing.roughness=0.85;
          createBox(0.065,0.20,0.095,housing,0,0,0,jb);
          createBox(0.008,0.18,0.080,housing,0.036,0,0,jb);
          for(const dy of [-0.075,0.075]) for(const dz of [-0.029,0.029])
            createCylinder(0.0025,0.0025,0.004,metal,0.042,dy,dz,jb).rotation.z=Math.PI/2;
          // 상하 간선 인입과 하부 인터록 분기선 글랜드.
          for(const side of [-1,1])
            createCylinder(0.010,0.010,0.026,housing,0,side*0.11,0,jb);
          createCylinder(0.009,0.009,0.026,housing,0,-0.11,0.030,jb);
          createBox(0.006,0.24,0.040,metal,-0.036,0,0,jb);
          const outY=jb.position.y-0.123;
          wire([[wireX,outY,HARNESS_Z+0.030],[wireX,outY-0.045,HARNESS_Z+0.030],
            [wireX,outY-0.045,z],[wireX,y,z],[bb.max.x,y,z],
            [bb.max.x,bb.getCenter(new THREE.Vector3()).y,z]],'doorContactWire_'+f);
          for(const ty of [outY-0.025,y+0.09])
            createBox(0.018,0.004,0.052,housing,wireX,ty,HARNESS_Z+0.01,G);
        });
      }
      function switchBox(y, stop) {
        const b = new THREE.Group(); b.position.set(wallX+0.052,y,SHAFT_SWITCH_Z);
        b.name = stop ? 'pitSwitchBox' : 'topLightSwitchBox';
        b.userData = {type:'shaft-switch-box', hasEstop:stop}; G.add(b);
        createBox(0.09,0.29,0.12,metal,0,0,0,b);
        createBox(0.006,0.278,0.108,M.ss(0xc2c4c5),0.048,0,0,b);
        [-0.125,0.125].forEach(dy=>[-0.042,0.042].forEach(dz=>{
          createCylinder(0.003,0.003,0.008,metal,0.054,dy,dz,b).rotation.z=Math.PI/2;
        }));
        // 白색 원형 상하 커버, 중앙 토글과 적색 버섯형 정지버튼.
        if(stop) [-0.09,0.09].forEach(dy=>{
          createCylinder(0.032,0.032,0.009,M.paint(0xe3e3df),0.057,dy,0,b).rotation.z=Math.PI/2;
          [-0.011,0.011].forEach(dz=>createCylinder(0.003,0.003,0.002,black,0.063,dy,dz,b).rotation.z=Math.PI/2);
        });
        createBox(0.006,0.033,0.021,black,0.058,0,stop ? 0.032 : 0,b);
        createCylinder(0.004,0.004,0.025,metal,0.071,0,stop ? 0.032 : 0,b).rotation.z=-Math.PI/3;
        if(stop) {
          createCylinder(0.025,0.025,0.006,M.paint(0xe4ba39),0.059,0,-0.022,b).rotation.z=Math.PI/2;
          const button=createCylinder(0.020,0.018,0.024,M.paint(0xd52e25),0.075,0,-0.022,b);
          button.rotation.z=Math.PI/2; button.name='pitEstopButton';
        }
        wire([[wireX,y,SHAFT_LIGHT_Z-0.40],[wireX,y,SHAFT_SWITCH_Z],[wallX+0.052,y-0.16,SHAFT_SWITCH_Z]],b.name+'Wire');
      }
      switchBox(PIT_REMOTE_Y,true); switchBox(TOP_LIGHT_SWITCH_Y,false);
      wire([[wireX,PIT_REMOTE_Y,HARNESS_Z],[wireX,PIT_REMOTE_Y,SHAFT_SWITCH_Z]],'pitStopWire');
      [pitY+0.85,...FLOOR_Y.map(y=>y+2.0)].forEach((y,i)=>{
        const lamp=new THREE.Group(); lamp.name='shaftLED_'+i;
        lamp.userData={type:'shaft-led',level:i-1}; lamp.position.set(wallX+0.055,y,SHAFT_LIGHT_Z); G.add(lamp);
        createBox(0.055,0.055,0.65,M.paint(0xc6cbce),0,0,0,lamp);
        createBox(0.022,0.038,0.59,M.emit(0xf3f6ff,0.85),0.038,0,0,lamp);
        [-0.32,0.32].forEach(z=>createBox(0.065,0.062,0.022,metal,0,0,z,lamp));
        wire([[wireX,y,SHAFT_LIGHT_Z-0.40],[wireX,y,SHAFT_LIGHT_Z-0.325]],lamp.name+'Wire');
      });
      scene.add(G);
    }

    let governorMetalEnvironment = null;
    function getGovernorMetalEnvironment() {
      if (governorMetalEnvironment) return governorMetalEnvironment;
      // Broad light panels give machined edges readable highlights without
      // changing the lighting or materials of the surrounding simulator.
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
      const ctx=canvas.getContext('2d'),base=ctx.createLinearGradient(0,0,0,256);
      base.addColorStop(0,'#e1e7ed');base.addColorStop(.46,'#b6c0ca');
      base.addColorStop(.64,'#8c98a5');base.addColorStop(1,'#586572');
      ctx.fillStyle=base;ctx.fillRect(0,0,512,256);
      for(const [x,width] of [[44,78],[213,118],[410,56]]){
        const light=ctx.createLinearGradient(x,0,x+width,0);
        light.addColorStop(0,'rgba(240,245,250,0)');light.addColorStop(.22,'rgba(240,245,250,.95)');
        light.addColorStop(.78,'rgba(240,245,250,.95)');light.addColorStop(1,'rgba(240,245,250,0)');
        ctx.fillStyle=light;ctx.fillRect(x,12,width,172);
      }
      const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
      texture.mapping=THREE.EquirectangularReflectionMapping;
      const pmrem=new THREE.PMREMGenerator(renderer);
      governorMetalEnvironment=pmrem.fromEquirectangular(texture).texture;
      texture.dispose();pmrem.dispose();return governorMetalEnvironment;
    }

    /* 권상기 교육 연출 — 기어 케이스 절개(웜·휠 이물림·오일 레벨)와 브레이크 개방.
       형상은 GLB 원본 그대로이며, 절개 조각은 -X(벽 쪽)로 빼낸 뒤 숨긴다. */
    function setTractionCutaway(on, instant = false) {
      const t = mrGrp && mrGrp.userData && mrGrp.userData.traction;
      if (!t) return;
      t.cutaway = !!on;
      if (!t.ready) return;
      const dur = instant ? 0 : 0.7;
      t.oil.visible = t.cutaway;
      t.cutPieces.forEach(p => {
        gsap.killTweensOf(p.position);
        if (t.cutaway) {
          gsap.to(p.position, { x: p.userData.homeX - 0.32, duration: dur, ease: 'power2.in',
            onComplete: () => { if (t.cutaway) p.visible = false; } });
        } else {
          p.visible = true;
          gsap.to(p.position, { x: p.userData.homeX, duration: dur, ease: 'power2.out' });
        }
      });
    }

    function setTractionBrake(open, instant = false) {
      const t = mrGrp && mrGrp.userData && mrGrp.userData.traction;
      if (!t) return;
      t.brakeOpen = !!open;
      if (!t.ready) return;
      // 하단 피벗 기준 암 상단이 바깥으로 벌어진다 (슈-드럼 틈 약 2mm).
      const lift = t.brakeOpen ? 0.012 : 0;
      t.arms.forEach((arm, i) => {
        gsap.killTweensOf(arm.rotation);
        gsap.to(arm.rotation, { z: (i === 0 ? 1 : -1) * lift, duration: instant ? 0 : 0.14, ease: 'power1.out' });
      });
    }

    /* 권상기(웜 기어드) 장착 계약 — blender/scripts/traction_machine.py 가 이 JSON을 읽는다.
       좌표는 주도르래 축 중심 기준 로컬(m). sheaveR = 로프 중심선 반경(mrGrp.userData.mainR).
       wheelX = 웜휠 평면, wormY = 웜축 높이(중심거리), base* = 권상기 받침대(JS) 상면·범위. */
    // deflector* = 현수도르래 반경·주도르래 축 기준 중심 오프셋(Z,Y) — 가드 후방 터널이 로프 접선을 따른다.
    const TRACTION_MACHINE_MOUNT = {"sheaveR":0.33,"wheelX":-0.33,"wormY":0.25,"wormStarts":2,"wheelTeeth":50,"baseTop":-0.3,"baseX":[-0.53,-0.12],"baseZ":[-0.36,0.77],"deflectorR":0.144,"deflectorDZ":-0.991625,"deflectorDY":-0.306};

    function buildMachineRoom() {
      mrGrp = new THREE.Group();
      const my = Y0 + TOTAL_H;

      // 기계실 바닥 (초록색 계열로 변경) — 전면 고정, 후면은 SHAFT_BACK_Z 로 확장
      const mrFloorY = my + 0.02; // 마감 바닥 상면
      const mrSlabCZ = (S.SHAFT_D / 2 + SHAFT_BACK_Z) / 2;            // 슬래브 Z 중심
      createBox(S.SHAFT_W + 0.4, 0.25, S.SHAFT_D / 2 - SHAFT_BACK_Z + 0.4, M.conc(), 0, my - 0.12, mrSlabCZ, mrGrp);
      createBox(S.SHAFT_W + 0.2, 0.02, S.SHAFT_D / 2 - SHAFT_BACK_Z + 0.2, M.paint(0x2e7d32), 0, my + 0.01, mrSlabCZ, mrGrp); // 진한 초록색 (우레탄 도장 느낌)

      /* 기계실 내벽 마감 — 콘크리트 벽에 준불연 흡음보드를 덧시공한 라이닝.
         기계실을 두르는 벽은 좌측벽 하나뿐이다(나머지는 절개면). 그 벽은
         buildFrontWallAndLobby()의 승강로 좌측벽이 기계실 위로 2.2m 더 뻗은 것이라
         면 재질을 못 바꾼다 → 실제 시공처럼 안쪽에 보드를 한 겹 덧대 가린다.
         치수는 좌측벽과 같은 식으로 뽑아야 어긋나지 않는다. */
      const linT = MR_LINING_T;
      const linFront = FRONT_WALL_INNER_Z + S.WALL_T;      // 좌측벽 전면 (좌측벽 생성식과 동일)
      const linD = linFront - SHAFT_BACK_Z;
      const linH = (my + 2.2) - mrFloorY;                  // 좌측벽이 기계실 위로 뻗은 높이
      createBox(linT, linH, linD, mrLiningMats(linD, linH),
        -(S.SHAFT_W / 2) + linT / 2, mrFloorY + linH / 2, (linFront + SHAFT_BACK_Z) / 2, mrGrp);

      // 로프 이송구 — 네모 홀 + 회색 플라스틱 방수턱 (검사기준 ≥50mm / 체대는 그 50%) 및 승강로 천장 슬리브
      const ropeHoleMat = M.paint(0x141618);
      const ropeSillMat = M.paint(0x9aa0a6); // 회색 플라스틱 커버
      const slabCeilingY = SHAFT_CEIL_Y; // 승강로 천장 슬래브 하면 (index.html 계약)
      function addRopeHole(cx, floorY, cz, holeW, holeD, sillH) {
        const tw = 0.014; // 턱 두께
        // 1. 기계실 바닥면 상면 홀(암부) & 방수턱
        createBox(holeW, 0.006, holeD, ropeHoleMat, cx, floorY - 0.003, cz, mrGrp);
        // 전후 방수턱
        createBox(holeW + tw * 2, sillH, tw, ropeSillMat,
          cx, floorY + sillH / 2, cz + holeD / 2 + tw / 2, mrGrp);
        createBox(holeW + tw * 2, sillH, tw, ropeSillMat,
          cx, floorY + sillH / 2, cz - holeD / 2 - tw / 2, mrGrp);
        // 좌우 방수턱
        createBox(tw, sillH, holeD, ropeSillMat,
          cx + holeW / 2 + tw / 2, floorY + sillH / 2, cz, mrGrp);
        createBox(tw, sillH, holeD, ropeSillMat,
          cx - holeW / 2 - tw / 2, floorY + sillH / 2, cz, mrGrp);

        // 2. 승강로 천장 콘크리트 슬래브 하면 사각 관통구 (스크린샷 180501)
        const ceilSillH = 0.020; // 천장 하면 돌출 사각 슬리브 칼라
        createBox(holeW, 0.008, holeD, ropeHoleMat, cx, slabCeilingY + 0.004, cz, mrGrp);
        // 천장 하면 사각 테두리 슬리브 플랜지
        createBox(holeW + tw * 2, ceilSillH, tw, ropeSillMat,
          cx, slabCeilingY - ceilSillH / 2, cz + holeD / 2 + tw / 2, mrGrp);
        createBox(holeW + tw * 2, ceilSillH, tw, ropeSillMat,
          cx, slabCeilingY - ceilSillH / 2, cz - holeD / 2 - tw / 2, mrGrp);
        createBox(tw, ceilSillH, holeD, ropeSillMat,
          cx + holeW / 2 + tw / 2, slabCeilingY - ceilSillH / 2, cz, mrGrp);
        createBox(tw, ceilSillH, holeD, ropeSillMat,
          cx - holeW / 2 - tw / 2, slabCeilingY - ceilSillH / 2, cz, mrGrp);
      }
      const floorSillH = 0.050; // ≥50mm
      const bedSillH = floorSillH * 0.5; // 체대측 1번 = 50%
      const rhW = 0.20, rhD = 0.14; // 5가닥(±0.06) + 여유
      // ② 카측 주로프 — 기계실 바닥 & 승강로 천장 (Z=CAR_CTR_Z, 카 히치 수직선)
      addRopeHole(0, mrFloorY, CAR_CTR_Z, rhW, rhD, floorSillH);
      // ③ 균형추측 주로프 — 기계실 바닥 & 승강로 천장 (Z=CWT)
      addRopeHole(0, mrFloorY, CWT_CENTER_Z, rhW, rhD, floorSillH);

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

      /* ══════════════════════════════════════════════════════════════
         1. 머신 빔 (Machine Beam) + 써포트 빔 (Support Beam)
         PDF 5/31 참고: H형강 I빔 단면 2방향 배치
         ══════════════════════════════════════════════════════════════ */
      const beamMat = M.paint(0x1c2833);
      const beamWH = 0.18, beamFW = 0.15, beamTk = 0.014;
      const lowerY  = my + 0.09;
      // 전단(카/시브측) 앵커: 메인 시브 전면 접선을 카 로프 수직선(CAR_CTR_Z)에 정렬
      //   tmCenterZ = -0.20 + offsetZ, mainR = 0.33 → tmCenterZ + mainR = CAR_CTR_Z
      const offsetZ = CAR_CTR_Z - 0.13;
      // 후단(균형추/편향도르래측) 앵커: 카 깊이 확장 시 체대·빔이 후방으로 성장
      const bedZ1 = 0.57 + offsetZ;           // 체대 전단 (base 0.44)
      const bedZ2 = CWT_CENTER_Z - 0.3125;    // 체대 후단 (base -1.525)
      const machBackSup = CWT_CENTER_Z - 0.2975; // 후단 써포트빔·앵글 (base -1.51)
      const machBackPad = CWT_CENTER_Z - 0.0875; // 후단 방진고무      (base -1.30)
      // 주 I-빔은 체대 전·후단을 모두 덮도록 스팬을 산출 (base 길이 3.05, 중심 -0.23 보존)
      const beamFrontEnd = bedZ1 + 0.855;
      const beamBackEnd  = bedZ2 - 0.23;
      const lowerZc = (beamFrontEnd + beamBackEnd) / 2;
      const lowerL  = beamFrontEnd - beamBackEnd;

      // 주 I-빔 2개 (X=±0.6, Z축 방향)
      [-0.6, 0.6].forEach(bx => {
        createBox(beamTk, beamWH - beamTk * 2, lowerL, beamMat, bx, lowerY, lowerZc, mrGrp);
        createBox(beamFW, beamTk, lowerL, beamMat, bx, lowerY + (beamWH - beamTk) / 2, lowerZc, mrGrp);
        createBox(beamFW, beamTk, lowerL, beamMat, bx, lowerY - (beamWH - beamTk) / 2, lowerZc, mrGrp);
      });

      // 써포트 빔 (Support Beam) 2개 - X축 방향 가로 I-빔 (전단=시브측, 후단=도르래측)
      [1.26 + offsetZ, machBackSup].forEach(sz => {
        const sLen = 1.44;
        createBox(sLen, beamWH - beamTk * 2, beamTk, beamMat, 0, lowerY, sz, mrGrp);
        createBox(sLen, beamTk, beamFW, beamMat, 0, lowerY + (beamWH - beamTk) / 2, sz, mrGrp);
        createBox(sLen, beamTk, beamFW, beamMat, 0, lowerY - (beamWH - beamTk) / 2, sz, mrGrp);
      });

      // 써포트 앵글 (Support Angle) - ㄱ형강 코너 보강 4개소
      const angleMat = M.paint(0x2c3e50);
      [[-0.6, 1.26 + offsetZ], [-0.6, machBackSup], [0.6, 1.26 + offsetZ], [0.6, machBackSup]].forEach(([ax, az]) => {
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
      const pxs = [-0.6, 0.6], pzs = [machBackPad, 0.57 + offsetZ];

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
      // bedZ1(전단)·bedZ2(후단)은 상단 빔 섹션에서 이미 정의 (체대 후방 성장 앵커)
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

      // 중간 내부 보강재 2개 — 권상기 받침대 하중 지지 (두꺼운 채널, 무너지지 않게)
      const bedCrossW = 0.11; // 플랜지 폭(Z)
      const bedCrossT = 0.018;
      function addBedCrossBeam(bz) {
        const xLen = bedXL - 0.10;
        createBox(xLen, bedFH - bedCrossT * 2, bedCrossT, bedMat, bedXC, bedY + bedFH / 2, bz, mrGrp);
        createBox(xLen, bedCrossT, bedCrossW, bedMat, bedXC, bedY + bedFH, bz, mrGrp);
        createBox(xLen, bedCrossT, bedCrossW, bedMat, bedXC, bedY, bz, mrGrp);
      }
      [offsetZ - 0.29, offsetZ + 0.25].forEach(bz => addBedCrossBeam(bz)); // 전측 권상기 받침대 하중 지지 (기계 추종)

      const bedTopY = bedY + bedFH; // 머신 베드 상단 높이 원상 복구

      /* ══════════════════════════════════════════════════════════════
         4. 디플렉터 시브 (Deflector / 현수도르래)
         — 중심 Z = CWT + R → 후면 접선이 균형추 수직선
         — 체대 위 베어링 브라켓 (축 회전)
         ══════════════════════════════════════════════════════════════ */
      const defRadius = TRACTION_MACHINE_MOUNT.deflectorR; // 현수도르래 로프 중심 반경 (0.144)
      const tmPedestalH = 0.20; // 권상기 받침대 높이 복구
      // 로프브레이크 설치 공간 확보 — 시브 축을 체대 쪽으로 하강 (기존 bedTopY + 0.284)
      const defY = bedTopY + defRadius + 0.05;
      // 시브 형상 = GLB(traction_machine.py 의 공용 build_spoked_sheave — 노란 주물·곡선 스포크·검은 홈 림).
      // defGrp 는 스핀 래퍼, 정렬 그룹이 마운트 회전(π/2)을 되돌려 GLB(축=X)를 그대로 싣는다.
      const defGrp = new THREE.Group();
      const defAlign = new THREE.Group();
      defAlign.rotation.y = -Math.PI / 2;
      defGrp.add(defAlign);
      new THREE.GLTFLoader().load('models/gltf/deflector_sheave.glb', gltf => {
        const model = gltf.scene.getObjectByName('DeflectorSheaveModel');
        const c = model?.userData.deflectorSheave;
        if (!c || c.sheaveR !== defRadius || JSON.stringify(c.ropeX) !== JSON.stringify(ROPE_GROOVE_X)) {
          console.error('[deflector glb] 장착 계약 불일치 — traction_machine.py 재내보내기 필요', c);
          return;
        }
        model.traverse(o => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          if (o.material.metalness > .5) { o.material.envMap = getGovernorMetalEnvironment(); o.material.envMapIntensity = .9; }
        });
        defAlign.add(model);
        defGrp.userData.contract = c;
      }, undefined, err => console.error('[deflector glb] 로드 실패', err));

      // 후면 접선 = 균형추 수직선 — 현수 로프가 도르래에서 이탈 후 반듯하게 수직 하강
      const defCenterZ = CWT_CENTER_Z + defRadius;
      // 스핀 래퍼 — 주도르래(tmShvMount/tmShvSpin)와 동일 구조.
      // 마운트가 축을 월드 X로 눕히고, 자식(defGrp)이 rotation.z 로 자전한다.
      // 자전은 ui.js spinSheaves()가 카 실이동량에서 물리적으로 구동한다.
      const defMount = new THREE.Group();
      defMount.rotation.y = Math.PI / 2;
      defMount.position.set(0, defY, defCenterZ);
      defMount.add(defGrp);
      mrGrp.add(defMount);
      deflectorSheaveGrp = defGrp;

      // 로프브레이크↔편향도르래 공용 넓은 받침대 — 균형추 로프 네모 통로
      const defPedW = 0.56;
      const defPedD = 0.72;
      const defPedY = bedTopY + 0.014;
      const defPedCZ = defCenterZ + 0.18; // 메인·로프브레이크 쪽으로 확장
      const defPedMat = M.ss(0x8a929a);
      const defRopeHoleCZ = CWT_CENTER_Z; // 수직 이탈 로프
      const defRopeHoleW = rhW, defRopeHoleD = rhD;
      (function addDefPedWithRopeHole() {
        const fx0 = -defPedW / 2, fx1 = defPedW / 2;
        const fz0 = defPedCZ - defPedD / 2, fz1 = defPedCZ + defPedD / 2;
        const hx0 = -defRopeHoleW / 2, hx1 = defRopeHoleW / 2;
        const hz0 = defRopeHoleCZ - defRopeHoleD / 2, hz1 = defRopeHoleCZ + defRopeHoleD / 2;
        const h = 0.030;
        const leftW = hx0 - fx0;
        if (leftW > 0.008) createBox(leftW, h, defPedD, defPedMat, fx0 + leftW / 2, defPedY, defPedCZ, mrGrp);
        const rightW = fx1 - hx1;
        if (rightW > 0.008) createBox(rightW, h, defPedD, defPedMat, hx1 + rightW / 2, defPedY, defPedCZ, mrGrp);
        const frontD = Math.max(0, hz0 - fz0);
        if (frontD > 0.008) createBox(defRopeHoleW, h, frontD, defPedMat, 0, defPedY, fz0 + frontD / 2, mrGrp);
        const backD = Math.max(0, fz1 - hz1);
        if (backD > 0.008) createBox(defRopeHoleW, h, backD, defPedMat, 0, defPedY, hz1 + backD / 2, mrGrp);
      })();
      addRopeHole(0, defPedY + 0.015, defRopeHoleCZ, defRopeHoleW, defRopeHoleD, bedSillH);
      // 받침대 직하 체대 가로보 2본 (로프 홀 Z는 피함)
      addBedCrossBeam(defPedCZ - defPedD * 0.22);
      addBedCrossBeam(defPedCZ + defPedD * 0.28);
      [[-0.22, -0.28], [-0.22, 0.28], [0.22, -0.28], [0.22, 0.28]].forEach(([ox, oz]) => {
        const bz = defPedCZ + oz;
        if (Math.abs(bz - defRopeHoleCZ) < defRopeHoleD / 2 + 0.02 && Math.abs(ox) < defRopeHoleW / 2 + 0.02) return;
        createCylinder(0.008, 0.008, 0.016, M.ss(0x777777),
          ox, defPedY + 0.020, bz, mrGrp);
      });

      // 체대 일체형 베어링 브라켓 — 넓은 받침대 위 측판→베어링 하우징→축
      const pillowMat = M.ss(0x9ca3af);
      const brkSteel = M.ss(0x8a929a);
      const brkCast = M.paint(0x4a5560);
      const defAxle = createCylinder(0.022, 0.022, 0.30, M.ss(0xb8bcc4), 0, defY, defCenterZ, mrGrp);
      defAxle.rotation.z = Math.PI / 2;

      [-1, 1].forEach(side => {
        const bx = side * 0.13;
        // 수직 측판 (공용 받침대 → 축)
        const standH = defY - defPedY - 0.02;
        createBox(0.018, standH, 0.14, brkCast, bx, defPedY + 0.02 + standH / 2, defCenterZ, mrGrp);
        // 베어링 하우징 (축 주위 원통 + 플랜지)
        createCylinder(0.048, 0.048, 0.040, pillowMat, bx, defY, defCenterZ, mrGrp)
          .rotation.z = Math.PI / 2;
        createCylinder(0.058, 0.058, 0.012, brkSteel, bx + side * 0.026, defY, defCenterZ, mrGrp)
          .rotation.z = Math.PI / 2;
        createCylinder(0.024, 0.024, 0.044, M.paint(0x2a3038), bx, defY, defCenterZ, mrGrp)
          .rotation.z = Math.PI / 2; // 베어링 보어
        // 측판–하우징 리브
        createBox(0.014, 0.055, 0.050, brkCast, bx, defY - 0.055, defCenterZ, mrGrp);
      });

      /* ══════════════════════════════════════════════════════════════
         5. 권상기 (웜 기어드) — blender/scripts/traction_machine.py → models/gltf/traction_machine.glb
         구동 일렬(Z): 크랭크 끝 → 웜(청동 휠 위, 2줄) → 브레이크 드럼 → 전동기 → 엔코더
         휠과 시브는 같은 출력축(X). 로컬 원점 = 주도르래 축 중심(월드 x=0), 스케일 1.
         장착 수치는 TRACTION_MACHINE_MOUNT 하나가 원본이다(Python이 읽고 GLB extras로 되돌려 대조).
         ══════════════════════════════════════════════════════════════ */
      const TM = TRACTION_MACHINE_MOUNT;
      const tmR = TM.sheaveR;                                   // 로프 중심선 반경 = mainR
      const tmAxisY = bedTopY + tmPedestalH - TM.baseTop;       // 받침대 상면 + 0.30
      const tmCenterZ = -0.20 + offsetZ;                        // tmCenterZ + tmR = CAR_CTR_Z (카측 로프 수직선)
      const tmGrp = new THREE.Group();
      tmGrp.name = 'TractionMachine';
      tmGrp.position.set(0, tmAxisY, tmCenterZ);

      // 권상기 받침대 — 체대 가로보 위 사각 페데스탈. 시브는 받침대 밖(+X)에 걸려 체대 위로 내려간다.
      const pedMat = M.paint(0x3d4a58);
      const pedTopMat = M.ss(0x6a7582);
      const pedX0 = TM.baseX[0], pedX1 = TM.baseX[1];
      const pedZ0 = tmCenterZ + TM.baseZ[0], pedZ1 = tmCenterZ + TM.baseZ[1];
      const pedCX = (pedX0 + pedX1) / 2, pedCZ = (pedZ0 + pedZ1) / 2;
      createBox(pedX1 - pedX0 - 0.02, tmPedestalH - 0.018, pedZ1 - pedZ0 - 0.02, pedMat,
        pedCX, bedTopY + (tmPedestalH - 0.018) / 2, pedCZ, mrGrp);
      createBox(pedX1 - pedX0, 0.018, pedZ1 - pedZ0, pedTopMat, pedCX, bedTopY + tmPedestalH - 0.009, pedCZ, mrGrp);

      // 스핀 래퍼 — mainSheaveGrp.rotation.z 가 월드 +X 회전(ui.js spinSheaves). 정렬 그룹이 마운트 회전을 되돌려
      // GLB SheaveRotor(시브+출력축+웜휠)를 권상기 좌표 그대로 싣는다.
      const tmSheaveGrp = new THREE.Group();
      tmSheaveGrp.name = 'MainSheave';
      tmGrp.add(tmSheaveGrp);
      const tmShvMount = new THREE.Group();
      tmShvMount.rotation.y = Math.PI / 2;
      tmSheaveGrp.add(tmShvMount);
      const tmShvSpin = new THREE.Group();
      tmShvMount.add(tmShvSpin);
      mainSheaveGrp = tmShvSpin;
      const tmShvAlign = new THREE.Group();
      tmShvAlign.rotation.y = -Math.PI / 2;
      tmShvSpin.add(tmShvAlign);
      // 웜 스핀(축 = 월드 Z) — 회전량은 spinTractionSheaves 가 시브 각도 × wormPerSheave 로 맞춘다.
      const tmWormSpin = new THREE.Group();
      tmWormSpin.name = 'TMWormSpin';
      tmWormSpin.position.set(TM.wheelX, TM.wormY, 0);
      tmGrp.add(tmWormSpin);
      const tmCoverMat = M.paint(0xB08A20);   // 현수도르래 보호덮개가 복제해 쓴다
      mrGrp.add(tmGrp);

      // 교육용 상태: 절개(웜·휠·오일 노출), 브레이크 개방. 가동부는 GLB 원점 = 피벗.
      const tractionState = {
        ready: false, worm: tmWormSpin, wormPerSheave: 0, cutaway: false, brakeOpen: false,
        cutPieces: [], oil: null, arms: [], contract: null
      };
      new THREE.GLTFLoader().load('models/gltf/traction_machine.glb', gltf => {
        const model = gltf.scene.getObjectByName('TractionMachineModel');
        const c = model?.userData.tractionMachine;
        if (!c || c.sheaveR !== TM.sheaveR || c.wheelX !== TM.wheelX || c.wormY !== TM.wormY ||
            c.baseTop !== TM.baseTop || JSON.stringify(c.ropeX) !== JSON.stringify(ROPE_GROOVE_X) ||
            Math.abs((defCenterZ - tmCenterZ) - c.deflectorDZ) > 1e-6 || Math.abs((defY - tmAxisY) - c.deflectorDY) > 1e-6) {
          console.error('[traction glb] 장착 계약 불일치 — traction_machine.py 재내보내기 필요', c);
          return;
        }
        model.traverse(o => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          const m = o.material;
          if (m.transparent) { m.depthWrite = false; o.renderOrder = 2; o.castShadow = false; }
          else if (m.metalness > .5) { m.envMap = getGovernorMetalEnvironment(); m.envMapIntensity = .9; }
        });
        const node = name => model.getObjectByName(name);
        const rotor = node('SheaveRotor');
        tmShvAlign.add(rotor);                         // 원점 = 시브 축
        const worm = node('WormRotor');
        worm.position.set(0, 0, 0);                    // 원점 = 웜 축 (래퍼가 위치를 가진다)
        tmWormSpin.add(worm);
        tmGrp.add(model);                              // 나머지: 케이스·브레이크·전동기·베드판·가드
        tractionState.cutPieces = ['GearCaseCutaway', 'InspectionWindowCutaway'].map(node);
        tractionState.cutPieces.forEach(p => { p.userData.homeX = p.position.x; });
        tractionState.oil = node('GearOil');
        tractionState.oil.visible = false;
        tractionState.arms = [node('BrakeArmL'), node('BrakeArmR')];
        tractionState.contract = c;
        tractionState.wormPerSheave = c.wormPerSheave;
        tmWormSpin.rotation.z = c.wormPerSheave * tmShvSpin.rotation.z;
        machineSafetyWiring.attachTractionMachine(tmGrp, c.cableExits);
        tractionState.ready = true;
        if (tractionState.cutaway) setTractionCutaway(true, true);
        if (tractionState.brakeOpen) setTractionBrake(true, true);
      }, undefined, err => console.error('[traction glb] 로드 실패', err));

      /* 로프브레이크: 기존 공통 접선에 정렬하고 체대 양쪽에 볼트식 가로
         받침·각도 조절 측판을 추가한다. 형상·배선은 machine-room-safety.js. */
      let brakeInstallation;
      {
        const Rm = tmR, Rd = defRadius;
        // elevator.js refreshRopes()와 동일한 상부 공통 외접선 기하 — 로프 중심선과 정확히 일치
        const ddz = defCenterZ - tmCenterZ, ddy = defY - tmAxisY;
        const Dd = Math.hypot(ddz, ddy);
        let rbTanA = Math.atan2(ddy, ddz) - Math.acos((Rm - Rd) / Dd);
        if (rbTanA < 0) rbTanA += Math.PI * 2;
        // 접선 이탈점 P1(메인시브) → 진입점 P2(현수도르래)
        const p1z = tmCenterZ + Rm * Math.cos(rbTanA), p1y = tmAxisY + Rm * Math.sin(rbTanA);
        const p2z = defCenterZ + Rd * Math.cos(rbTanA), p2y = defY + Rd * Math.sin(rbTanA);
        const tRB = 0.55; // 메인→현수 55% 지점 (현수도르래 보호덮개·브라켓과 간섭 회피)
        const rbRopeY = p1y + (p2y - p1y) * tRB;
        const rbRopeZ = p1z + (p2z - p1z) * tRB;
        // 로컬 +Z(경사 위, 메인 방향)·+Y(위)가 유지되도록 X축 피치 정렬
        const ropePitch = -Math.atan2(p1y - p2y, p1z - p2z);

        brakeInstallation = buildRopeBrakeOnBed(mrGrp, {
          ropeY: rbRopeY, ropeZ: rbRopeZ, pitch: ropePitch,
          bedTop: bedTopY + bedFT / 2, railX: bedX2 - bedFW / 2,
          plateTop: defPedY + .015
        });

        /* ─── 현수도르래 보호덮개 — 단일 연속 후드, 로프홀(초록 구간)까지 가림 ─── */
        const defCovMat = tmCoverMat.clone();
        defCovMat.side = THREE.DoubleSide;
        const covR = 0.185;
        const covW2 = 0.24;
        const covA0 = rbTanA - 0.45;
        // 후연을 수직 로프·받침대 홀 직전까지 내려 초록 노출 구간을 가림
        const aEnd = Math.PI - 0.05;
        const covLen = aEnd - covA0;
        const holeLocalZ = CWT_CENTER_Z - defCenterZ; // ≈ -defRadius

        const defCovGrp = new THREE.Group();
        defCovGrp.name = 'DeflectorCover';
        defCovGrp.position.set(0, defY, defCenterZ);
        mrGrp.add(defCovGrp);

        // ① 단일 곡면 덮개 (전폭·연속) — 초록 구간까지 연장
        const covShell = new THREE.Mesh(
          new THREE.CylinderGeometry(covR, covR, covW2, 48, 1, true, covA0, covLen), defCovMat);
        covShell.rotation.z = Math.PI / 2;
        defCovGrp.add(covShell);

        // ② 좌우 가장자리 보강
        [-1, 1].forEach(s => {
          const band = new THREE.Mesh(
            new THREE.CylinderGeometry(covR + 0.005, covR + 0.005, 0.020, 48, 1, true, covA0, covLen), defCovMat);
          band.rotation.z = Math.PI / 2;
          band.position.x = s * (covW2 / 2 - 0.010);
          defCovGrp.add(band);
        });

        // ③ 로프 이탈 방지 리브 (노란, 로프에 안 닿음)
        const guardR = defRadius + 0.016;
        const gA0 = Math.max(covA0 + covLen * 0.40, Math.PI - 0.90);
        const gLen = aEnd - gA0;
        if (gLen > 0.08) {
          const guard = new THREE.Mesh(
            new THREE.CylinderGeometry(guardR, guardR, covW2 * 0.72, 24, 1, true, gA0, gLen), defCovMat);
          guard.rotation.z = Math.PI / 2;
          defCovGrp.add(guard);
        }

        // ④ 하부 슈라우드 — 덮개 끝 → 받침대 로프홀까지 좌우·후면으로 가림 (중앙은 로프 통과)
        const endY = covR * Math.sin(aEnd);
        const endZ = covR * Math.cos(aEnd);
        const shroudBot = defPedY - defY + 0.012;
        const shroudTop = endY + 0.02;
        const shroudH = Math.max(0.06, shroudTop - shroudBot);
        const shroudMidY = (shroudTop + shroudBot) / 2;
        const shroudZ1 = holeLocalZ - 0.02;
        const shroudD = Math.abs(endZ - shroudZ1) + 0.04;
        const shroudCZ = (endZ + shroudZ1) / 2;
        const ropeClear = rhW * 0.55; // 중앙 로프 통로 반폭

        [-1, 1].forEach(s => {
          const lx = s * (covW2 / 2 - 0.012);
          // 측판: 덮개 끝단 → 홀까지 깊이·높이 연속
          createBox(0.018, shroudH, shroudD, tmCoverMat, lx, shroudMidY, shroudCZ, defCovGrp);
          // 덮개–측판 이음
          createBox(0.036, 0.024, 0.040, tmCoverMat, lx, endY, endZ, defCovGrp);
          // 받침대 풋 (홀 좌우)
          const footZ = defCenterZ + shroudZ1 + 0.02;
          createBox(0.042, 0.010, 0.040, tmCoverMat, lx, defPedY + 0.006, footZ, mrGrp);
          [[-0.012, -0.010], [-0.012, 0.010], [0.012, -0.010], [0.012, 0.010]].forEach(([ox, oz]) => {
            createCylinder(0.0035, 0.0035, 0.010, M.ss(0x888888),
              lx + ox, defPedY + 0.012, footZ + oz, mrGrp);
          });
        });
        // 후면 가림판 (로프 뒤, 초록 구간 가림) — 중앙은 비워 홀과 맞춤
        const backW = (covW2 - ropeClear * 2) / 2;
        if (backW > 0.02) {
          [-1, 1].forEach(s => {
            createBox(backW, shroudH * 0.92, 0.014, tmCoverMat,
              s * (ropeClear + backW / 2), shroudMidY, shroudZ1, defCovGrp);
          });
        }
        // 전면(시브쪽) 하부 가림 — 덮개 끝과 홀 사이 노출부
        [-1, 1].forEach(s => {
          createBox(0.020, shroudH * 0.85, 0.014, tmCoverMat,
            s * (ropeClear + 0.02), shroudMidY, endZ + 0.01, defCovGrp);
        });
      }

      /* ⑤ 개방 레버 + ⑥ 수동 핸들 — 제어반 반대편(-Z) 좌측벽, 같은 높이·걸쇠 각각 (PDF 4·6p) */
      // 걸쇠는 콘크리트가 아니라 흡음보드 라이닝 면에 붙는다 → 보드 두께만큼 안쪽으로.
      const wallInnerX = -(S.SHAFT_W / 2) + MR_LINING_T + 0.01;
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
      const machineSafetyWiring = buildMachineRoomDucts(mrGrp, {
        floorY: mrFloorY, frontZ: beamFrontEnd + .12,
        panelX, panelZ, governorX: GOV_TENS_X, governorZ: GOV_TENS_Z,
        traction: { x: -0.77, zA: tmCenterZ + 0.85, zB: tmCenterZ + 0.25, pedX: TM.baseX[0] - 0.013, bedY: bedTopY }
      }, brakeInstallation);
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

      // 디테일: 상판 & 하판 로프 관통 홀 2개소 (검은색 테두리 슬리브 링) — 로컬 ±0.10 (월드 ±0.15 로프 가닥 정렬)
      const holeMat = M.paint(0x111315);
      const ringMat = M.paint(0x1a1c1e);
      [-0.10, 0.10].forEach(pz => {
        // 상판 관통 홀 및 테두리 링
        createCylinder(0.016, 0.016, 0.028, holeMat, 0, pHeight + 0.047, pz, govGrp);
        const topRimU = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0028, 6, 16), ringMat);
        topRimU.rotation.x = Math.PI / 2;
        topRimU.position.set(0, pHeight + 0.047 + 0.0126, pz);
        govGrp.add(topRimU);
        const topRimD = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0028, 6, 16), ringMat);
        topRimD.rotation.x = Math.PI / 2;
        topRimD.position.set(0, pHeight + 0.047 - 0.0126, pz);
        govGrp.add(topRimD);

        // 하판 관통 홀 및 테두리 링 (스크린샷 1734371)
        createCylinder(0.016, 0.016, 0.038, holeMat, 0, 0.018, pz, govGrp);
        const botRimU = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0028, 6, 16), ringMat);
        botRimU.rotation.x = Math.PI / 2;
        botRimU.position.set(0, 0.018 + 0.0176, pz);
        govGrp.add(botRimU);
        const botRimD = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0028, 6, 16), ringMat);
        botRimD.rotation.x = Math.PI / 2;
        botRimD.position.set(0, 0.018 - 0.0176, pz);
        govGrp.add(botRimD);
      });

      // 승강로 천정 콘크리트 슬래브 하면 로프 관통구 (스크린샷 1735031 — 검은색 테두리 슬리브 링)
      [-0.15, 0.15].forEach(wz => {
        // 기계실 바닥면 관통 슬리브
        createCylinder(0.022, 0.022, 0.040, holeMat, govX, mrFloorY, govZ + wz, mrGrp);
        const flRim = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0035, 6, 16), ringMat);
        flRim.rotation.x = Math.PI / 2;
        flRim.position.set(govX, mrFloorY + 0.002, govZ + wz);
        mrGrp.add(flRim);

        // 승강로 천장 하면 관통구 (슬리브 링 및 내부 암부)
        createCylinder(0.022, 0.022, 0.035, holeMat, govX, slabCeilingY + 0.010, govZ + wz, mrGrp);
        const ceilRim = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0035, 6, 16), ringMat);
        ceilRim.rotation.x = Math.PI / 2;
        ceilRim.position.set(govX, slabCeilingY - 0.001, govZ + wz);
        mrGrp.add(ceilRim);
      });

      const boltHoleZ = 0.22;
      const boltHoleX = 0.05;
      createCylinder(0.005, 0.005, 0.022, holeMat, boltHoleX, 0.01, boltHoleZ, govGrp);
      createCylinder(0.005, 0.005, 0.022, holeMat, -boltHoleX, 0.01, boltHoleZ, govGrp);
      createCylinder(0.005, 0.005, 0.022, holeMat, boltHoleX, 0.01, -boltHoleZ, govGrp);
      createCylinder(0.005, 0.005, 0.022, holeMat, -boltHoleX, 0.01, -boltHoleZ, govGrp);
      
      mrGrp.add(govGrp);

      /* 7. 조속기(과속조절기) 본체 — Blender 실사 .glb v3.4 (2026-08-01)
         ★유일한 시각 소스 = models/gltf/overspeed_governor.glb
           (blender/scripts/overspeed_governor.py 가 생성. 프리미티브 조속기는 없다.)
         참조: 스크린샷 2026-07-21 003217.png (device_china.mp4 CG) + 육성 지시 3편
               (11:24 스위치 수직·팁 타격 / 11:41 기구 원리 / 13:06 "이 디자인 그대로").

         [아키텍처 — 이중 소스 축척 불일치 재발 방지]
         · .glb 좌표계 = govBodyGrp 로컬 1:1 (로더 스케일 1.0, 오프셋 0).
           로프 홈 반경 0.10 × govGrp 1.5 = 월드 0.15 로 로프 정렬 불변.
         · 가동부 핸들은 아래 '빈 래퍼 그룹'이며 동기 생성된다 — 로드 전에도
           userData.governor 계약(elevator.js governorTrip/Reset)이 유효하다.
         · 로드 완료 시 .glb 노드(원점=피벗, 대기 자세 구움)를 래퍼에 끼운다.
           래퍼 위치는 .glb 노드가 내보낸 원점에서 읽으므로 두 파일 상수가 어긋날 수 없다.

         [16:10 육성 지시 — 레버·떡판·스프링은 한 직선(일자)]
         · 캐치 레버를 LEV_TILT(17°) 눕히고 스프링이 그 축선을 그대로 이어받는다.
         · 레버 우단에서 시브 우측을 따라 내려온 레그 끝 = 떡판(캐치슈).
           로프를 시브 홈에 눌러 잡아 로프를 멈춘다.

         트립 연출 — 2단계 (elevator.js governorTrip):
         ① 낙하  과속 → 진자(크롬 돔) 원심 개방(+0.45) → 캐치 낙하(topArm +0.12)
                 좌단 립이 수직 플런저를 타격 + 쐐기가 날(캠 톱니) 골에 물림
         ② 파지  물린 쐐기를 휠이 끌고 가며 레버를 반대로 돌린다(topArm -0.05)
                 → 피벗 아래·우측의 떡판이 로프 쪽(-x)으로 4mm 파고들어 파지
                 → 로프·휠 정지 → 카 안전기 물림 */
      const govYBase = pHeight + 0.04;
      const govBodyGrp = new THREE.Group();
      govBodyGrp.position.set(0, govYBase, 0);
      govBodyGrp.rotation.y = Math.PI / 2; // 로컬 +X=월드 -Z, 로컬 +Z=월드 +X(카메라측)

      const gR  = 0.10;   // 로프 홈 반경(로컬) — ×govGrp 1.5 = 월드 0.15 (불변)
      const gWY = 0.225;  // 휠 중심 높이(로컬)
      // 캐치 레버 기울기 — .py LEV_TILT(17°)와 반드시 같아야 한다.
      // 스프링은 레버 축선을 그대로 이어받으므로 수직에서 (90°-LEV_TILT) 만큼 눕는다.
      // (.glb 는 스프링을 수직으로 굽고 이 래퍼가 눕힌다 — .py SPR_TILT 의 부호 반대)
      const LEV_TILT = Math.PI * 17 / 180;
      const SPRING_TILT = -(Math.PI / 2 - LEV_TILT); // -1.2741

      // ── 가동부 래퍼(핸들) — 전부 동기 생성 ──────────────────────────────
      const govWheelGrpL = new THREE.Group();                 // 휠 (rotation.z 스핀)
      govWheelGrpL.position.set(0, gWY, 0);
      govBodyGrp.add(govWheelGrpL);
      governorWheelGrp = govWheelGrpL;
      const govPendA = new THREE.Group();                     // 진자 (원심 개방)
      const govPendB = new THREE.Group();
      govWheelGrpL.add(govPendA, govPendB);
      // 진자 뒷면 연동 링크 2개 — 두 진자를 실제로 잇는 부재라 진자가 아니라
      // 휠 직계 자식이다 (진자에 매달면 상대 진자를 따라갈 수 없다).
      const govPendTie = new THREE.Group();                   // 강성 타이바 (평행이동)
      const govPendSpr = new THREE.Group();                   // 복귀 인장 스프링 (회전+신장)
      govWheelGrpL.add(govPendTie, govPendSpr);
      const govTopArmGrp = new THREE.Group();                 // 캐치 레버 (트립 낙하)
      govBodyGrp.add(govTopArmGrp);
      const govSprGrp = new THREE.Group();                    // 그립 스프링 (scale.y 압축)
      govSprGrp.rotation.z = SPRING_TILT;
      govTopArmGrp.add(govSprGrp);
      const govSwMountGrp = new THREE.Group();                // 플런저 마운트 (-90°: 로컬 +X = 아래)
      govSwMountGrp.rotation.z = -Math.PI / 2;
      govBodyGrp.add(govSwMountGrp);
      const govPlungerGrp = new THREE.Group();                // 플런저 핸들 (position.x = 눌림량)
      govSwMountGrp.add(govPlungerGrp);
      const govRatchetGrp = new THREE.Group();                // 끌림 계산용 핸들 (메시 없음)
      govBodyGrp.add(govRatchetGrp);
      const govPawlGrp = new THREE.Group();
      govWheelGrpL.add(govPawlGrp);                       // 쇄기는 삼발이 브라켓에 고정, 휠과 같이 돈다
      const govTripGrp = new THREE.Group();
      govTopArmGrp.add(govTripGrp);
      const govLink = new THREE.Group();                      // 구 API 더미
      govLink.visible = false;
      govBodyGrp.add(govLink);

      /* ── ★진자 연동 기구 (뒷면 링크 2개) — .py 와 같은 상수·같은 식 ──────────
         두 진자는 휠 중심 기준 점대칭으로 놓여 같은 각(open)만큼 함께 벌어진다.
         캐노니컬 좌표(x=접선, y=반경)에서 캐노니컬 +x 의 월드 방향이 E1 이고,
         B 진자는 프레임이 180° 뒤집혀 캐노니컬 c 가 월드 -c·E1 로 나온다.

         · 타이바(스프링 아닌 링크): A 러그 +k, B 러그 -k → 두 러그의 월드
           오프셋이 같아져 러그 간 벡터가 피벗-피벗 벡터(60mm)로 **고정**된다.
           길이가 안 변하는 진짜 강성 링크라, 회전 없이 평행이동만 시키면 된다.
         · 인장 스프링: A·B 러그를 캐노니컬 같은 부호 쪽에 두어 길이가 변한다.
           대기 60.83mm → 개방(0.45rad) 64.98mm 로 늘어나며 복귀력을 만든다.
           메시는 로컬 +X 로 곧게 구워져 있어 회전 + scale.x 로 늘인다. */
      const PIV_A = Math.PI * 155 / 180;   // .py PEND_ANG_A
      const PIV_R = 0.030;                 // .py PEND_PIV_R
      const TIE_KX = 0.027, SPR_MX = -0.022, SPR_NX = 0.032;  // .py 동명 상수
      const E1X = Math.cos(PIV_A - Math.PI / 2), E1Y = Math.sin(PIV_A - Math.PI / 2);
      const OWX = PIV_R * Math.cos(PIV_A), OWY = PIV_R * Math.sin(PIV_A);
      const TIE_K0X = TIE_KX * E1X, TIE_K0Y = TIE_KX * E1Y;
      let govSprL0 = 1;
      // 진자 러그의 휠 로컬 좌표 — sgn +1 = A, -1 = B (B 는 오프셋 부호가 뒤집힌다)
      const govLug = (cx, sgn, c, s) => {
        const ox = sgn * cx * E1X, oy = sgn * cx * E1Y;
        return { x: sgn * OWX + ox * c - oy * s, y: sgn * OWY + ox * s + oy * c };
      };
      const govSetLinkage = (open) => {
        const c = Math.cos(open), s = Math.sin(open);
        // 타이바 — 길이·방향 불변, 러그를 따라 평행이동만
        govPendTie.position.set(TIE_K0X * c - TIE_K0Y * s - TIE_K0X,
                                TIE_K0X * s + TIE_K0Y * c - TIE_K0Y, 0);
        // 인장 스프링 — A 러그에 앉아 B 러그를 향해 돌고, 그만큼 늘어난다
        const a = govLug(SPR_MX, 1, c, s), b = govLug(SPR_NX, -1, c, s);
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
        govPendSpr.position.set(a.x, a.y, 0);
        govPendSpr.rotation.z = Math.atan2(dy, dx);
        govPendSpr.scale.x = L / govSprL0;
      };
      {   // 대기 길이 기준값 — scale.x = 1 이 되는 지점
        const a = govLug(SPR_MX, 1, 1, 0), b = govLug(SPR_NX, -1, 1, 0);
        govSprL0 = Math.hypot(b.x - a.x, b.y - a.y);
      }
      govSetLinkage(0);

      // ── .glb 로드 — 노드(원점=피벗)를 래퍼에 장착 ───────────────────────
      new THREE.GLTFLoader().load('models/gltf/overspeed_governor.glb', (gltf) => {
        const g = gltf.scene;
        g.traverse(o => {
          if (o.isMesh) {
            o.castShadow = true; o.receiveShadow = true;
            if(o.material?.metalness>.5 && !o.material.transparent){
              o.material.envMap=getGovernorMetalEnvironment();o.material.envMapIntensity=1.05;
            }
            if (o.material && o.material.transparent) {      // 반투명 커버
              o.material.depthWrite = false; o.renderOrder = 2; o.castShadow = false;
            }
          }
        });
        // 노드 이식: 래퍼 위치 = 노드가 내보낸 원점 (parentPivot 기준 상대)
        const mount = (name, wrapper, parentPivot) => {
          const n = g.getObjectByName(name);
          if (!n) { console.error('[gov glb] 노드 없음:', name); return; }
          wrapper.position.copy(n.position);
          if (parentPivot) wrapper.position.sub(parentPivot);
          n.position.set(0, 0, 0);
          n.rotation.set(0, 0, 0);
          wrapper.add(n);
        };
        const wheelPivot = g.getObjectByName('Pulley').position.clone(); // = (0, gWY, 0)
        mount('Pulley', govWheelGrpL);
        mount('Ratchet', govRatchetGrp);
        mount('PendA', govPendA, wheelPivot);
        mount('PendB', govPendB, wheelPivot);
        // 연동 링크 — 대기 위치는 govSetLinkage 가 매번 다시 잡으므로 장착만 한다
        mount('PendTie', govPendTie, wheelPivot);
        mount('PendSpring', govPendSpr, wheelPivot);
        govSetLinkage(govPendA.rotation.z);
        mount('Catch', govTopArmGrp);
        mount('Pawl', govPawlGrp, wheelPivot);               // 원점 = 쇄기 피벗, 삼발이 브라켓에 물림
        mount('Spring', govSprGrp, govTopArmGrp.position);   // 수직 메시 → SPRING_TILT 로 기울음
        // 플런저: 마운트(-90°) 안에 원상 복원 회전(+90°)으로 장착 → position.x = 아래로 눌림
        const plg = g.getObjectByName('Plunger');
        if (plg) {
          govSwMountGrp.position.copy(plg.position);
          plg.position.set(0, 0, 0);
          plg.rotation.set(0, 0, Math.PI / 2);
          govPlungerGrp.add(plg);
        }
        // 정적 부재만 이식 (씬 루트 통째 add 금지 — 빈 노드/이중 계층 방지)
        ['BaseFrame', 'Cover'].forEach(name => {
          const n = g.getObjectByName(name);
          if (n) govBodyGrp.add(n);
          else console.error('[gov glb] 노드 없음:', name);
        });
        const mechanism=g.getObjectByName('BaseFrame')?.userData.mechanism || govBodyGrp.getObjectByName('BaseFrame')?.userData.mechanism;
        const handle=mrGrp.userData.governor;
        if(mechanism){
          handle.mechanism=mechanism;
          Object.assign(handle.pose.trip,{pendulum:mechanism.pendulum,pawl:mechanism.pawl,
            topArm:mechanism.releaseArm,gripArm:mechanism.gripArm,switchRot:mechanism.switchRot,ratchet:mechanism.drag});
          handle.geom.toothStep=mechanism.toothStep;
        }
        machineSafetyWiring.attachGovernor(govBodyGrp, mechanism);
        handle.ready=true;
        handle.switchLever.userData.contactClosed=true;
        console.log('[gov glb] independent ratchet and mechanical pose loaded');
      }, undefined, (err) => {
        console.error('[gov glb] 로드 실패 — 조속기 외형 없음:', err);
      });

      govGrp.add(govBodyGrp);

      const govScale = govGrp.scale.x;
      const govWheelWorldY = govGrp.position.y + (govYBase + gWY) * govScale;
      mrGrp.userData = {
        defY: defY,
        defZ: defCenterZ - defRadius,
        defCenterZ: defCenterZ,
        defRadius: defRadius,
        mainY: tmAxisY,
        mainZ: tmCenterZ,
        mainR: tmR,
        traction: tractionState,
        govX: govX,
        govZ: govZ,
        govWheelY: govWheelWorldY,
        govR: gR * govScale,
        governor: {
          wheel: govWheelGrpL,
          ratchet: govRatchetGrp,
          pendulums: [govPendA, govPendB],
          // 진자 개방각(rad)을 넣으면 뒷면 링크 2개가 따라 움직인다.
          // 진자 rotation.z 를 바꾸는 곳은 반드시 이걸 같이 호출해야 한다.
          setLinkage: govSetLinkage,
          pendTie: govPendTie,
          pendSpring: govPendSpr,
          pawl: govPawlGrp,
          tripLever: govTripGrp,
          switchLever: govPlungerGrp,
          topArm: govTopArmGrp,
          catcherArm: govTopArmGrp,
          spring: govSprGrp,
          link: govLink,
          geom: {
            wheelY: gWY,
            armRot0: 0,          // 대기 자세는 .glb 메시에 구워짐 — 래퍼 0 = 대기
            pawlRot0: 0,
            pendRot0: [0, 0],
            toothStep: (Math.PI * 2) / 8, // 날(원형 톱날 래칫) 톱니 8개 (.py CAM_TEETH 와 반드시 일치)
            sprScale0: 1,
            plungerX0: 0
          },
          /* 트립은 2단계다 (.py v5.0 참조).
             ① trip  원심 개방 → 쐐기 +0.60rad 로 톱날 골에 갈고리 부리 맞물림 + 플런저 타격
             ② grip  물린 쐐기를 휠이 끌고 가며 레버를 반대(-CW)로 돌린다 →
                     피벗 아래·우측의 떡판(캐치슈)이 로프를 홈 쪽(-x)으로 눌러 파지
                     → 로프·휠 정지 → 카 안전기 물림 */
          pose: {
            rest: { pendulum: 0, topArm: 0, pawl: 0, switchLever: 0, switchRot: 0, ratchet: 0, spring: 1 },
            trip: {
              pendulum: 0.45,      // 원심 진자 개방
              topArm: 0.14,        // 캐치 레버 전방 밀림 (로프 파지 및 스위치 타격 위치)
              pawl: 0.60,          // +z = 부리가 골 바닥(r≈39mm)으로. 음수는 톱니 위로 들어 올림
              switchLever: 0.016,  // 스위치 플런저 하강 (+x)
              switchRot: -0.52,    // 스위치 레버 아래로 뚝 떨어짐 (트립 차단 각도)
              ratchet: 0.22,       // 휠 관성 드래그 회전량
              spring: 0.95         // 가압 스프링 압축
            }
          }
        }
      };
      scene.add(mrGrp);
    }

    // 부품설계 254~255p. 치수 원본은 Blender GLB extras이며 S는 변경하지 않는다.
    function buildPitScreen(parent) {
      const mount = new THREE.Group();
      mount.name = 'pitScreenAssembly';
      mount.userData = { type: 'pit-screen', ready: false };
      parent.add(mount);
      new THREE.GLTFLoader().load('models/gltf/pit_screen.glb', gltf => {
        const root = gltf.scene.getObjectByName('PitScreen');
        const spec = root?.userData.pitScreen;
        if (!spec || Math.abs(spec.railSpan - S.CWT_W) > 1e-6) {
          console.error('[PitScreen] 레일 간격 계약 불일치: pit_screen.py를 다시 내보내세요.');
          return;
        }
        const yellow = M.paint(0xffc400);
        yellow.metalness = 0.25; yellow.roughness = 0.48; yellow.clearcoat = 0.15;
        const zinc = M.ss(0xb5bdc4);
        gltf.scene.traverse(o => {
          if (!o.isMesh) return;
          const original = o.material;
          o.material = original.name === 'PitScreenFasteners' ? zinc : yellow;
          original.dispose();
          o.castShadow = true; o.receiveShadow = true;
        });
        mount.position.set(0, Y0 + spec.floorGap, CWT_CENTER_Z + spec.frontOffset);
        mount.add(gltf.scene);
        mount.userData.spec = spec;
        mount.userData.ready = true;
        attachPitScreenStickers(parent, spec);
      }, undefined, err => console.error('[PitScreen Load Error]', err));
    }

    // 피트 스크린 안전 스티커 (자세 표시 및 최대 런바이 표지 — 스크린 하단 1/3 지점)
    function attachPitScreenStickers(parent, spec) {
      const stickerGrp = new THREE.Group();
      stickerGrp.name = 'pitScreenStickers';

      const texLoader = new THREE.TextureLoader();
      const postureTex = texLoader.load('assets/bg/pit_posture.png');
      const runbyTex = texLoader.load('assets/bg/pit_runby.png');
      [postureTex, runbyTex].forEach(t => {
        t.encoding = THREE.sRGBEncoding;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
      });

      const postW = 0.16;
      const postH = postW * (680 / 600); // 0.1813m
      const runW = 0.16;
      const runH = runW * (300 / 660); // 0.0727m
      const gap = 0.015; // 상하 간격 15mm

      // 스크린 높이 기준 아래서 1/3 지점 중심 정렬
      const centerY = (spec?.height || 2.0) / 3;
      const postY = centerY + gap / 2 + postH / 2;
      const runY = centerY - gap / 2 - runH / 2;

      const stickerX = -0.28; // 좌측 패널 중앙 (볼트 간섭 회피 및 진입 시 정면 시야)
      const frontZ = CWT_CENTER_Z + (spec?.frontOffset || 0.15) + (spec?.sheetThickness || 0.0015) / 2 + 0.001;
      const baseY = Y0 + (spec?.floorGap || 0.20);

      const postMat = new THREE.MeshBasicMaterial({
        map: postureTex,
        transparent: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        depthWrite: false
      });
      const postMesh = new THREE.Mesh(new THREE.PlaneGeometry(postW, postH), postMat);
      postMesh.position.set(stickerX, baseY + postY, frontZ);
      postMesh.name = 'pitStickerPosture';
      stickerGrp.add(postMesh);

      const runMat = new THREE.MeshBasicMaterial({
        map: runbyTex,
        transparent: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        depthWrite: false
      });
      const runMesh = new THREE.Mesh(new THREE.PlaneGeometry(runW, runH), runMat);
      runMesh.position.set(stickerX, baseY + runY, frontZ);
      runMesh.name = 'pitStickerRunby';
      stickerGrp.add(runMesh);

      parent.add(stickerGrp);
    }

    function buildPitFoundation() {
      pitGrp = new THREE.Group();
      // 피트 기초·바닥 — 전면 고정, 후면은 SHAFT_BACK_Z 로 확장 (기계실 슬래브와 동일 원리)
      const pitSlabCZ = (S.SHAFT_D / 2 + SHAFT_BACK_Z) / 2;
      createBox(S.SHAFT_W + S.WALL_T * 2, 0.2, S.SHAFT_D / 2 - SHAFT_BACK_Z + S.WALL_T * 2, M.conc(), 0, Y0 - 0.1, pitSlabCZ, pitGrp);
      createBox(S.SHAFT_W - 0.1, 0.02, S.SHAFT_D / 2 - SHAFT_BACK_Z - 0.1, M.paint(0x4b5563), 0, Y0 + 0.01, pitSlabCZ, pitGrp);
      buildPitScreen(pitGrp);
      
      // [추가] 1. 피트 사다리 (승강로 좌측 벽면 안쪽 — 전면벽 관통 방지)
      const ladderH = FLOOR_Y[0] + 1.1;
      const WALL_GAP = 0.250; // 좌측 벽 내면 → 사다리 레일 중심 250mm (교재)
      const ladderZ = FRONT_WALL_INNER_Z - 0.40;
      const ladderX = -(S.SHAFT_W / 2) + WALL_GAP;
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

      // L브라켓 3단 × 좌우 레일 — 벽체 앙카 + 수평 암 (공중 부유 방지)
      const brMat = M.ss(0x9aa3ad);
      const brBolt = M.ss(0xb8bec6);
      [Y0 + 0.32, Y0 + ladderH * 0.52, Y0 + ladderH - 0.22].forEach(by => {
        [-0.15, 0.15].forEach(rx => {
          createBox(0.072, 0.090, 0.006, brMat, rx, by, -(WALL_GAP - 0.003), ladderGrp);
          createBox(0.010, 0.040, WALL_GAP - 0.028, brMat, rx, by, -WALL_GAP / 2, ladderGrp);
          createBox(0.036, 0.048, 0.008, brMat, rx, by, -0.024, ladderGrp);
          [-0.018, 0.018].forEach(oy => {
            const anc = createCylinder(0.006, 0.006, 0.028, brBolt,
              rx, by + oy, -(WALL_GAP + 0.008), ladderGrp);
            anc.rotation.x = Math.PI / 2;
          });
          const rb = createCylinder(0.005, 0.005, 0.022, brBolt, rx, by, -0.012, ladderGrp);
          rb.rotation.x = Math.PI / 2;
        });
      });

      // Y축 기준 90도 회전시켜 좌측 벽면과 완벽히 평행하게 배치
      ladderGrp.position.set(ladderX, 0, ladderZ);
      ladderGrp.rotation.y = Math.PI / 2;
      pitGrp.add(ladderGrp);

      // ─── 조속기 인장추 어셈블리 (Governor Tension Weight Assembly) ───
      // 조속기 휠 축 = Z축 방향(표현 기준) | X는 조속기와 GOV_TENS_X로 정렬
      const tensGovX = GOV_TENS_X;               // buildMachineRoom govX와 동일 축
      const tensBaseZ = GOV_TENS_Z;                   // 가이드 레일 파묻힘 방지 — Z축으로 카 후면측 이격
      const tensionerY = Y0 + 0.5;               // 피트 바닥 +500mm

      // ── 1. 가이드 레일 고정 브라켓 (인장시브는 tensBaseZ, 구 전면 피벗·플랫 암은 제거)
      const bracketMat = M.ss(0x4b5563);

      // 수직 베이스판 (가이드 레일 웹/플랜지 측면에 체결되는 지지대) — 카 레일 Z 추종
      createBox(0.04, 0.45, 0.08, bracketMat,
        S.CAR_BG / 2 - 0.02, tensionerY + 0.15, CAR_CTR_Z + 0.04, pitGrp);

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
      // ★얇은 THREE.Line(옛 과속조절기 선)을 전부 걷어내고 실사 와이어로프 메시로 교체.
      //   조속기부터 피트 인장추까지 한 굵기로 이어진다 (사용자 지시).
      const govData = mrGrp.userData || {};
      const govWheelY = govData.govWheelY || (Y0 + TOTAL_H + 0.42);
      // 풀리 홈 반경 = 가닥 Z 오프셋.
      // ★.glb 로더 스케일이 1.0 이므로 userData.govR(= 로컬 gR 0.10 × govGrp 1.5 = 0.15)이 정답.
      const ropeR = govData.govR || 0.15;
      const tensShvY = tensionerY + 0.30;
      const GOV_ROPE_R = GOV_ROPE_D / 2;       // Ø8mm
      if (!govRopeGeom) govRopeGeom = makeRopeGeometry(GOV_ROPE_R);

      // 귀환측(자유측) 로프 — 후면(Z-) 탄젠트, 카와 무관하게 고정
      const retRope = new THREE.Mesh(govRopeGeom, makeGovRopeMat());
      retRope.position.set(tensGovX, (govWheelY + tensShvY) / 2, tensBaseZ - ropeR);
      setGovRopeLen(retRope, govWheelY - tensShvY);
      retRope.castShadow = true;
      pitGrp.add(retRope);

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
      const wrapTube = (pts) => {
        const path = new THREE.CatmullRomCurve3(pts);
        const mat = makeGovRopeMat();
        mat.userData.ropeLen = path.getLength();
        const geometry=new THREE.TubeGeometry(path,96,GOV_ROPE_R,24,false);
        const uv=geometry.attributes.uv,pos=geometry.attributes.position;
        // TubeGeometry's U runs along the rope; the straight cylinder uses V.
        // Align both before applying the shared strand texture/pitch.
        for(let i=0;i<uv.count;i++){
          const along=uv.getX(i),around=uv.getY(i),center=path.getPointAt(along);
          const lobe=.94+.06*Math.cos(6*(around*Math.PI*2-along*mat.userData.ropeLen/GOV_ROPE_PITCH*Math.PI*2));
          pos.setXYZ(i,center.x+(pos.getX(i)-center.x)*lobe,
            center.y+(pos.getY(i)-center.y)*lobe,center.z+(pos.getZ(i)-center.z)*lobe);
          uv.setXY(i,around,along);
        }
        geometry.computeVertexNormals();
        const m = new THREE.Mesh(geometry, mat);m.name='GovernorRopeWrap';
        m.userData={strandCount:6,pitch:GOV_ROPE_PITCH,uvAlongV:true};
        const n = Math.max(0.4, mat.userData.ropeLen / GOV_ROPE_PITCH);
        if (mat.map) mat.map.repeat.set(1, n);
        if (mat.normalMap) mat.normalMap.repeat.set(1, n);
        m.castShadow = true;
        return m;
      };
      pitGrp.add(wrapTube(wrapArc(govWheelY, 1)));
      pitGrp.add(wrapTube(wrapArc(tensShvY, -1)));

      // 카 연동측(작동) 로프 — 전면(Z+) 탄젠트, 카상부 safetyClamp를 관통.
      // ★이 가닥이 앞쪽(+Z)이라 조속기 휠이 주도르래와 같은 방향으로 돈다.
      //   (권상 로프도 카측 가닥이 주도르래 앞쪽 접점 — ui.js spinSheaves 부호 규칙)
      //   GOV_TENS_Z 오프셋이 클램프 오프셋 + 홈반경으로 맞춰져 있어 z 값이 클램프와 일치한다.
      // 클램프에서 꺾이므로 상·하 2구간. 메시는 여기서 한 번만 만들고
      // refreshGovernorRope()는 위치·길이·기울기만 갱신한다.
      govRopeSegs = [new THREE.Mesh(govRopeGeom, makeGovRopeMat()), new THREE.Mesh(govRopeGeom, makeGovRopeMat())];
      govRopeSegs.forEach(m => { m.castShadow = true; pitGrp.add(m); });
      govRopeData = { x: tensGovX, z: tensBaseZ + ropeR, topY: govWheelY, botY: tensShvY };
      refreshGovernorRope();

      scene.add(pitGrp);
    }

    // 완충기 형상과 균형추 최하단 위치가 공유하는 치수 원본.
    const BUFFER_DIM = Object.freeze({ baseHeight: 0.4, cwtBaseScale: 0.35,
      hydraulicRodCenter: 0.55, hydraulicRodHeight: 0.25, cwtMinGap: 0.16 });

    function counterweightBottomHeight() {
      // 속도 변경 시 균형추가 순간 이동하지 않도록 가장 높은 완충기를 기준으로 고정한다.
      return BUFFER_DIM.baseHeight * BUFFER_DIM.cwtBaseScale
        + BUFFER_DIM.hydraulicRodCenter + BUFFER_DIM.hydraulicRodHeight / 2
        + BUFFER_DIM.cwtMinGap;
    }

    function updateBuffers() {
      if (bufferGrp) scene.remove(bufferGrp);
      bufferGrp = new THREE.Group();

      // 위치: [x좌표, z좌표, 지지대 높이 비율(1.0=기본, 0.33=균형추용)]
      const pos = [
        [0, CAR_CTR_Z, 1.0],         // 카 하부 (카 중심 추종)
        [0, CWT_CENTER_Z, BUFFER_DIM.cwtBaseScale] // 균형추 하부
      ];

      pos.forEach(([px, pz, heightScale]) => {
        // 1. 완충기 지지대 (철재 기둥)
        const baseH = BUFFER_DIM.baseHeight * heightScale; // 카 0.4m, 균형추 0.14m
        createBox(0.2, baseH, 0.2, M.ss(0x8a929a), px, Y0 + baseH / 2, pz, bufferGrp);
        // 지지대 상판 (베이스 플레이트)
        const plateY = Y0 + baseH;
        createBox(0.28, 0.02, 0.28, M.ss(0x6b7280), px, plateY + 0.01, pz, bufferGrp);

        if (targetSpeed === 90) {
          // [고속] 유입식 완충기 (에너지 분산형 - 유압 실린더)
          createCylinder(0.08, 0.09, 0.4, M.paint(0x111827), px, plateY + 0.22, pz, bufferGrp);
          createCylinder(0.035, 0.035, BUFFER_DIM.hydraulicRodHeight, M.ss(0xd8e0e8),
            px, plateY + BUFFER_DIM.hydraulicRodCenter, pz, bufferGrp);
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
