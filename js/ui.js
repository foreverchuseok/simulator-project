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

    function bindUIEvents() {
      document.getElementById('btn-menu-left').addEventListener('click', () => document.getElementById('panel-left').classList.toggle('open'));
      document.getElementById('btn-menu-right').addEventListener('click', () => document.getElementById('panel-right').classList.toggle('open'));

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
        const btn = e.target.closest('.c-btn'); if (btn) moveElevator(parseInt(btn.dataset.f));
      });
      document.getElementById('btn-open').addEventListener('click', () => { if (!moving && !estop) openDoors(); });
      document.getElementById('btn-close').addEventListener('click', () => { if (!moving) closeDoors(); });

      document.getElementById('btn-estop').addEventListener('click', e => {
        estop = !estop;
        if (estop) {
          gsap.killTweensOf(carGrp.position); gsap.killTweensOf(cwtGrp.position); moving = false;
          currentState = ELEVATOR_STATE.ESTOP;
          updateStatus('v-dir', '■ 비상정지', '#f85149'); updateStatus('v-spd', '0 m/min');
          e.target.textContent = '▶ 운전 재개 (RESET)'; e.target.className = 'c-btn blue';
        } else {
          e.target.textContent = '🔴 E-STOP'; e.target.className = 'c-btn red'; updateStatus('v-dir', '정지 대기', '#8b949e');
        }
      });

      document.getElementById('t-wall')?.addEventListener('change', e => { if (wallGrp) wallGrp.visible = e.target.checked; });
      document.getElementById('t-rope')?.addEventListener('change', e => { ropeObjs.forEach(r => r.line.visible = e.target.checked); });

      const midY = Y0 + TOTAL_H * 0.4;
      document.getElementById('c-front').addEventListener('click', () => moveCam(14, midY, 16, 0, midY, 0));
      document.getElementById('c-iso').addEventListener('click', () => moveCam(16, midY + 6, 16, 0, midY, 0));
      document.getElementById('c-mr').addEventListener('click', () => moveCam(5, Y0 + TOTAL_H + 1.5, 5, 0, Y0 + TOTAL_H + 1.5, 0));
      document.getElementById('c-pit').addEventListener('click', () => moveCam(5, Y0 + 1.0, 5, 0, Y0 + 1.0, 0));
      document.getElementById('c-car').addEventListener('click', () => {
        const cy = carGrp.position.y; moveCam(0, cy, S.CAR_D / 2 + 0.5, 0, cy - 0.1, 0);
      });
      document.getElementById('c-cwt').addEventListener('click', () => {
        const cy = cwtGrp.position.y; moveCam(-4, cy, CWT_CENTER_Z + 2, 0, cy, CWT_CENTER_Z);
      });
    }

    function moveCam(cx, cy, cz, tx, ty, tz) {
      gsap.to(camera.position, { x: cx, y: cy, z: cz, duration: 1.2, ease: 'power2.inOut' });
      gsap.to(controls.target, { x: tx, y: ty, z: tz, duration: 1.2, onUpdate: () => controls.update() });
    }

    function makeDraggable(btn) {
      let isDragging = false, startX, startY, initialLeft, initialTop, dragged = false;
      btn.addEventListener('mousedown', (e) => {
        isDragging = true; dragged = false; startX = e.clientX; startY = e.clientY;
        initialLeft = btn.offsetLeft; initialTop = btn.offsetTop; btn.style.cursor = 'grabbing';
      });
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragged = true;
        btn.style.left = `${initialLeft + dx}px`; btn.style.top = `${initialTop + dy}px`; btn.style.right = 'auto';
      });
      document.addEventListener('mouseup', () => { isDragging = false; btn.style.cursor = 'grab'; });
      btn.addEventListener('click', (e) => { if (dragged) e.stopImmediatePropagation(); }, true);
    }
