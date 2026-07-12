// 엘리베이터 상태 제어와 UI 이벤트 로직을 정의한다.
    function updateStatus(id, txt, col) { const e = document.getElementById(id); if (e) { e.textContent = txt; if (col) e.style.color = col; } console.log("Current FSM State:", currentState); }

    function openDoors(cb) {
      if (gsap.isTweening(carDoorL.position) || moving || estop) return;
      currentState = ELEVATOR_STATE.DOOR_OPENING;
      doorOpen = true; updateStatus('v-door', '열리는 중', '#f0883e'); clearTimeout(autoTimer);
      currentState = ELEVATOR_STATE.DOOR_OPEN;
      gsap.to(carDoorL.position, { x: carDoorL.userData.ox, duration: 1.15, ease: 'power2.out' });
      gsap.to(carDoorR.position, {
        x: carDoorR.userData.ox, duration: 1.15, ease: 'power2.out', onComplete: () => {
          updateStatus('v-door', '완전 개방', '#3fb950'); if (cb) cb();
          autoTimer = setTimeout(() => { if (doorOpen && !moving) closeDoors(); }, 3500);
        }
      });
      const h = hatchDoors[curFloor];
      if (h) { gsap.to(h.left.position, { x: h.left.userData.ox, duration: 1.15, ease: 'power2.out' }); gsap.to(h.right.position, { x: h.right.userData.ox, duration: 1.15, ease: 'power2.out' }); }
    }

    function closeDoors(cb) {
      if (!doorOpen) { if (cb) cb(); return; }
      currentState = ELEVATOR_STATE.DOOR_CLOSING;
      clearTimeout(autoTimer); updateStatus('v-door', '닫히는 중', '#f0883e');
      gsap.to(carDoorL.position, { x: carDoorL.userData.cx, duration: 0.95, ease: 'power2.inOut' });
      gsap.to(carDoorR.position, {
        x: carDoorR.userData.cx, duration: 0.95, ease: 'power2.inOut', onComplete: () => {
          doorOpen = false; updateStatus('v-door', '닫힘', '#3fb950'); if (cb) cb();
          currentState = ELEVATOR_STATE.IDLE;
        }
      });
      const h = hatchDoors[curFloor];
      if (h) { gsap.to(h.left.position, { x: h.left.userData.cx, duration: 0.95, ease: 'power2.inOut' }); gsap.to(h.right.position, { x: h.right.userData.cx, duration: 0.95, ease: 'power2.inOut' }); }
    }

    function rotateGovernorTension(deltaY) {
      if (!deltaY) return;
      const govR = (mrGrp && mrGrp.userData && mrGrp.userData.govR) || 0.14;
      if (governorWheelGrp) governorWheelGrp.rotation.z -= deltaY / govR;
      if (tensionSheaveGrp) tensionSheaveGrp.rotation.x += deltaY / 0.15;
    }

    /* ─────────────────────────────────────────────────────────────
       돌상/돌하 (Overspeed) 고장 주입 — 조속기 트립 시퀀스 연동
       카 폭주 가속 → 정격 130% 검출 → governorTrip() → 카 급정지 →
       governorReset() → 최근접 층 구출 운전
    ───────────────────────────────────────────────────────────── */
    let overspeedActive = false;

    function startOverspeedFault(btn) {
      const gov = mrGrp.userData.governor;
      if (!gov || moving || doorOpen || estop || gsap.isTweening(carDoorL.position)) return;

      // 방향 결정: 하부층이면 돌상(폭주 상승), 상부층이면 돌하(폭주 하강)
      const goingUp = curFloor <= 1;
      const fIdx = goingUp ? FLOORS - 1 : 0;
      const ty = FLOOR_Y[fIdx] + S.CAR_H / 2, cy = carGrp.position.y;
      const spinDir = goingUp ? -1 : 1; // rotateGovernorTension: 상승 시 휠 rotation.z 감소

      overspeedActive = true; moving = true;
      currentState = ELEVATOR_STATE.MOVING;
      updateStatus('v-dir', goingUp ? '▲▲ 돌상 (과속)' : '▼▼ 돌하 (과속)', '#f85149');
      btn.disabled = true;

      const vTrip = targetSpeed * 1.3; // 트립 임계 — 정격 130%
      const dur = Math.abs(ty - cy) / (targetSpeed * 1.6 / 60); // 종단 160%까지 가속되는 폭주
      let prevY = cy, prevT = performance.now(), tripped = false;
      const tw = gsap.to(carGrp.position, {
        y: ty, duration: dur, ease: 'power2.in',
        onUpdate: () => {
          const now = performance.now();
          const dt = Math.max((now - prevT) / 1000, 1e-4);
          const deltaY = carGrp.position.y - prevY;
          prevY = carGrp.position.y; prevT = now;
          rotateGovernorTension(deltaY);
          cwtGrp.position.y -= deltaY;
          refreshRopes(); refreshGovernorRope();
          let curF = 1;
          for (let i = FLOORS - 1; i >= 0; i--) { if (carGrp.position.y >= FLOOR_Y[i]) { curF = i + 1; break; } }
          syncAllIndicators(curF, goingUp ? '↑' : '↓');
          const v = Math.abs(deltaY) / dt * 60; // m/min
          updateStatus('v-spd', Math.round(v) + ' m/min', '#f85149');
          // 진자 원심 개방 — 정격 90%부터 속도 비례로 벌어짐 (대기각 기준, 트립 최대각의 80%까지)
          const open = Math.min(Math.max((v - targetSpeed * 0.9) / (vTrip - targetSpeed * 0.9), 0), 1)
            * gov.pose.trip.pendulum * 0.8;
          gov.pendulums[0].rotation.z = gov.geom.pendRot0[0] + open;
          gov.pendulums[1].rotation.z = gov.geom.pendRot0[1] + open;
          if (!tripped && v >= vTrip) { tripped = true; tw.kill(); onGovernorOverspeed(spinDir, btn); }
        },
        onComplete: () => { if (!tripped) { tripped = true; onGovernorOverspeed(spinDir, btn); } }
      });
    }

    function onGovernorOverspeed(spinDir, btn) {
      estop = true; moving = false;
      currentState = ELEVATOR_STATE.ESTOP;
      updateStatus('v-dir', '⚠ 과속 검출 — 조속기 트립', '#f85149');
      governorTrip(spinDir, () => {
        // 쐐기 걸림 → 조속기로프 정지 → 세이프티 링크 견인 → 카 짧은 미끄럼 후 급정지
        let prevY = carGrp.position.y;
        const stopTween = gsap.to(carGrp.position, {
          y: carGrp.position.y + (spinDir > 0 ? -0.22 : 0.22), duration: 0.5, ease: 'power3.out',
          onUpdate: () => {
            const deltaY = carGrp.position.y - prevY; prevY = carGrp.position.y;
            cwtGrp.position.y -= deltaY;

            // 세이프티 기어 동적 애니메이션 연동 (하부 샤프트 회전 복원)
            const progress = stopTween.progress(); // 0 ~ 1
            const sg = carGrp.userData.safetyGear;
            if (sg) {
              const targetRotX = -0.35 * progress;
              sg.shaft.rotation.x = targetRotX;
              
              const targetLiftY = 0.07 * progress;
              sg.liftL.position.y = targetLiftY;
              sg.liftR.position.y = targetLiftY;
              
              const targetScaleZ = 1.0 + 0.18 * progress;
              sg.uSprings.forEach(spr => {
                spr.scale.z = targetScaleZ;
              });
            }

            refreshRopes(); refreshGovernorRope();
          },
          onComplete: () => {
            updateStatus('v-spd', '0 m/min', '#f0883e');
            updateStatus('v-dir', '■ 비상정지 (조속기 작동)', '#f85149');
            btn.disabled = false; btn.textContent = 'RESET';
          }
        });
      });
    }

    function resetGovernorFault(btn) {
      btn.disabled = true;
      updateStatus('v-dir', '조속기 복귀 중…', '#f0883e');
      governorReset(() => {
        estop = false; overspeedActive = false;
        btn.disabled = false; btn.textContent = 'OVERSPEED';
        rescueToNearestFloor();
      });
    }

    // 구출 운전 — 최근접 층까지 서행 이동 후 도어 개방
    function rescueToNearestFloor() {
      let nf = 0, best = Infinity;
      FLOOR_Y.forEach((fy, i) => {
        const d = Math.abs(carGrp.position.y - (fy + S.CAR_H / 2));
        if (d < best) { best = d; nf = i; }
      });
      const ty = FLOOR_Y[nf] + S.CAR_H / 2;
      moving = true; currentState = ELEVATOR_STATE.MOVING;
      updateStatus('v-dir', '구출 운전 (서행)', '#f0883e');
      let prevY = carGrp.position.y;
      gsap.to(carGrp.position, {
        y: ty, duration: Math.max(Math.abs(ty - carGrp.position.y) / 0.4, 0.6), ease: 'power1.inOut',
        onUpdate: () => {
          const deltaY = carGrp.position.y - prevY; prevY = carGrp.position.y;
          rotateGovernorTension(deltaY);
          cwtGrp.position.y -= deltaY;
          refreshRopes(); refreshGovernorRope();
        },
        onComplete: () => {
          moving = false; currentState = ELEVATOR_STATE.IDLE;
          curFloor = nf;
          syncAllIndicators(nf + 1, '');
          updateStatus('v-floor', (nf + 1) + 'F', '#3fb950');
          updateStatus('v-dir', '정지 대기', '#8b949e');
          updateStatus('v-spd', '0 m/min', '#f0883e');
          document.querySelectorAll('#fbtns .c-btn').forEach((b, i) => b.classList.toggle('active', i === nf));
          setTimeout(() => openDoors(), 300);
        }
      });
    }

    function moveElevator(fIdx) {
      if (moving || estop || fIdx === curFloor) return;
      if (doorOpen || gsap.isTweening(carDoorL.position)) { closeDoors(() => moveElevator(fIdx)); return; }

      moving = true;
      currentState = ELEVATOR_STATE.MOVING;
      const ty = FLOOR_Y[fIdx] + S.CAR_H / 2, cy = carGrp.position.y;
      const cwtY = cwtGrp.position.y;
      let prevCarY = cy;
      const dur = Math.max(Math.abs(ty - cy) / (targetSpeed / 60), 0.5);

      // 운행 방향 화살표 결정
      const isUp = ty > cy;
      const dirStr = isUp ? '↑' : '↓';
      updateStatus('v-dir', isUp ? '▲ 상승' : '▼ 하강', '#3fb950');

      gsap.to(carGrp.position, {
        y: ty, duration: dur, ease: 'power2.inOut',
        onUpdate: () => {
          const deltaY = carGrp.position.y - prevCarY;
          prevCarY = carGrp.position.y;
          rotateGovernorTension(deltaY);
          cwtGrp.position.y = cwtY - (carGrp.position.y - cy);
          refreshRopes();
          refreshGovernorRope();

          // 실시간 높이(Y축)에 따른 통과 층수 계산 및 인디케이터 업데이트
          let currentDisplayFloor = 1;
          for (let i = FLOORS - 1; i >= 0; i--) {
            if (carGrp.position.y >= FLOOR_Y[i]) { currentDisplayFloor = i + 1; break; }
          }
          syncAllIndicators(currentDisplayFloor, dirStr);

          const p = Math.min(Math.max((carGrp.position.y - cy) / (ty - cy), 0), 1);
          updateStatus('v-spd', Math.round(targetSpeed * Math.sin(p * Math.PI)) + ' m/min', '#f0883e');
          const l = scene.getObjectByName('carLight'); if (l) l.position.y = carGrp.position.y + S.CAR_H * 0.75;
        },
        onComplete: () => {
          curFloor = fIdx; moving = false;
          currentState = ELEVATOR_STATE.IDLE;
          // 도착 완료 시 화살표 제거하고 해당 층수만 표시
          syncAllIndicators(fIdx + 1, '');
          updateStatus('v-dir', '정지 대기', '#8b949e');
          updateStatus('v-spd', '0 m/min', '#f0883e');
          updateStatus('v-floor', (fIdx + 1) + 'F', '#3fb950');
          document.querySelectorAll('#fbtns .c-btn').forEach((b, i) => b.classList.toggle('active', i === fIdx));
          setTimeout(() => openDoors(), 300);
        }
      });
    }

    // 독 팝오버 — 한 번에 하나만 열림, 아이콘 재탭·다른 아이콘·접기 버튼으로 닫힘
    function closeAllMenus() {
      document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
      document.querySelectorAll('.dock-btn.active').forEach(b => b.classList.remove('active'));
    }

    // HUD 드래그 이동 — 상태 디스플레이가 핸들 (마우스·터치 공용)
    function makeHudDraggable() {
      const hud = document.getElementById('hud');
      const handle = document.getElementById('statusbar');
      let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
      handle.addEventListener('pointerdown', e => {
        if (e.target.closest('#hud-toggle')) return;
        dragging = true; sx = e.clientX; sy = e.clientY;
        ox = hud.offsetLeft; oy = hud.offsetTop;
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener('pointermove', e => {
        if (!dragging) return;
        const nx = Math.min(Math.max(ox + e.clientX - sx, 4), window.innerWidth - 80);
        const ny = Math.min(Math.max(oy + e.clientY - sy, 4), window.innerHeight - 48);
        hud.style.left = nx + 'px'; hud.style.top = ny + 'px';
      });
      handle.addEventListener('pointerup', () => { dragging = false; });
      handle.addEventListener('pointercancel', () => { dragging = false; });
    }

    function bindUIEvents() {
      document.querySelectorAll('.dock-btn[data-menu]').forEach(btn => {
        btn.addEventListener('click', () => {
          const menu = document.getElementById(btn.dataset.menu);
          const wasOpen = menu.classList.contains('open');
          closeAllMenus();
          if (!wasOpen) { menu.classList.add('open'); btn.classList.add('active'); }
        });
      });
      // 메뉴는 아이콘 재탭·다른 아이콘 선택·접기 버튼으로만 닫힘 (실행 중 사라짐 방지)

      // 접기/펴기 — 독(아이콘) 숨김, 열린 메뉴도 함께 닫음
      document.getElementById('hud-toggle').addEventListener('click', () => {
        closeAllMenus();
        document.getElementById('hud').classList.toggle('collapsed');
      });
      makeHudDraggable();

      document.querySelectorAll('input[name="speed"]').forEach(r => {
        r.addEventListener('change', e => {
          targetSpeed = parseInt(e.target.value);
          updateBuffers();
        });
      });
      document.getElementById('speed-select').addEventListener('change', e => {
        targetSpeed = parseInt(e.target.value);
        updateBuffers();
      });

      document.getElementById('fbtns').addEventListener('click', e => {
        const btn = e.target.closest('.c-btn');
        if (btn) moveElevator(parseInt(btn.dataset.f));
      });
      document.getElementById('btn-open').addEventListener('click', () => { if (!moving && !estop) openDoors(); });
      document.getElementById('btn-close').addEventListener('click', () => { if (!moving) closeDoors(); });

      document.getElementById('btn-estop').addEventListener('click', e => {
        if (overspeedActive) { updateStatus('v-dir', '조속기 트립 — 우측 패널에서 복귀', '#f85149'); return; }
        estop = !estop;
        if (estop) {
          gsap.killTweensOf(carGrp.position); gsap.killTweensOf(cwtGrp.position); moving = false;
          currentState = ELEVATOR_STATE.ESTOP;
          updateStatus('v-dir', '■ 비상정지', '#f85149'); updateStatus('v-spd', '0 m/min');
          e.target.textContent = '▶ 운전 재개 (RESET)'; e.target.className = 'c-btn blue';
        } else {
          e.target.textContent = 'E-STOP'; e.target.className = 'c-btn red'; updateStatus('v-dir', '정지 대기', '#8b949e');
        }
      });

      const ovBtn = document.getElementById('btn-overspeed');
      if (ovBtn) ovBtn.addEventListener('click', () => {
        if (!overspeedActive) startOverspeedFault(ovBtn);
        else if (governorPhase === 'tripped') resetGovernorFault(ovBtn);
      });

      document.getElementById('t-wall')?.addEventListener('change', e => { if (wallGrp) wallGrp.visible = e.target.checked; });
      document.getElementById('t-rope')?.addEventListener('change', e => { ropeObjs.forEach(r => r.line.visible = e.target.checked); });

      // 카메라 4뷰
      const midY = Y0 + TOTAL_H * 0.4;
      const camViews = {
        'c-mr': () => moveCam(8, Y0 + TOTAL_H + 5, 8, 0, Y0 + TOTAL_H + 0.8, 0),
        'c-pit': () => moveCam(6.5, Y0 + 1.0, 6.5, 0, Y0 + 1.0, 0),
        'c-car': () => { const cy = carGrp.position.y; moveCam(0, cy, S.CAR_D / 2 + 0.5, 0, cy - 0.1, 0); },
        'c-shaft': () => moveCam(18, midY, 21, 0, midY, 0)
      };
      Object.keys(camViews).forEach(id => {
        document.getElementById(id).addEventListener('click', camViews[id]);
      });
    }

    function moveCam(cx, cy, cz, tx, ty, tz) {
      gsap.to(camera.position, { x: cx, y: cy, z: cz, duration: 1.2, ease: 'power2.inOut' });
      gsap.to(controls.target, { x: tx, y: ty, z: tz, duration: 1.2, onUpdate: () => controls.update() });
    }

    // makeDraggable(구 플로팅 메뉴 버튼용)은 상단 바 개편으로 제거됨
