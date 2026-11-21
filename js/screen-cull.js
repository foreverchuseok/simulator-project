// 원거리 소형 부품 화면 크기 컬링 (2026-11-21 최적화 4단계).
// 메인 카메라에서 경계구 지름이 2장치픽셀 미만인 메시를 그 프레임의 메인 그리기 목록에서만 뺀다.
// r128 은 메인 목록(projectObject)을 만든 다음 그림자 패스를 그리므로, 그림자 패스 직전에 되돌린다.
// → 그림자·그림자 캐시·클릭(레이캐스트)·부품 발광·인셋 카메라는 그대로다. 형상·노드·피벗·재질은 바꾸지 않는다.
// 지름 1cm 미만 부품은 그림자를 그리지 않는다(그림자 맵 한 칸 약 5mm라 흐린 점 정도, 운행 중 그림자 패스 호출 절약).
// ?cull=0 이면 둘 다 끈다(전후 비교용).
const ScreenCull = (() => {
  const off = /[?&]cull=0(&|$)/.test(location.search);
  const MIN_PX = 2, TINY_SHADOW_RADIUS = 0.005, COLLECT_EVERY = 120;
  const defaultHook = THREE.Object3D.prototype.onBeforeRender;
  const sphere = new THREE.Sphere(), forward = new THREE.Vector3(), size = new THREE.Vector2();
  let candidates = [], hidden = [], frame = 0, mainCamera, glRenderer, lastCount = 0, culled = 0;

  // 프레임 함수로 갱신하는 메시(onBeforeRender)·인스턴스·스킨·컬링 제외 메시는 대상에서 뺀다.
  function collect(scene) {
    candidates = [];
    scene.traverse(o => {
      if (!o.isMesh || !o.frustumCulled || o.isSkinnedMesh || o.isInstancedMesh || o.onBeforeRender !== defaultHook) return;
      candidates.push(o);
      if (o.castShadow) {
        const g = o.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        if (g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() < TINY_SHADOW_RADIUS) o.castShadow = false;
      }
    });
    lastCount = candidates.length;
  }
  function restore() { for (const o of hidden) o.visible = true; hidden.length = 0; }
  function cull() {
    glRenderer.getDrawingBufferSize(size);
    // 투영 지름(px) = 2r · (H/2) · P[5] / z   (P[5] = zoom / tan(fov/2))
    const limit = MIN_PX / (size.y * mainCamera.projectionMatrix.elements[5]);
    const e = mainCamera.matrixWorld.elements, cx = e[12], cy = e[13], cz = e[14];
    mainCamera.getWorldDirection(forward);
    for (const o of candidates) {
      if (!o.visible) continue;
      const g = o.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      sphere.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
      const z = (sphere.center.x - cx) * forward.x + (sphere.center.y - cy) * forward.y + (sphere.center.z - cz) * forward.z;
      if (z > 0 && sphere.radius < limit * z) { o.visible = false; hidden.push(o); }
    }
    culled = hidden.length;
  }

  function install(scene, camera, renderer) {
    if (off) return;
    mainCamera = camera; glRenderer = renderer;
    const before = scene.onBeforeRender;
    scene.onBeforeRender = function (r, s, c, target) {
      restore();
      before.call(this, r, s, c, target);   // 그림자 캐시 검사는 원래 보이는 상태로 한다
      if (c !== mainCamera || target) return;
      if (frame++ % COLLECT_EVERY === 0) collect(scene);
      cull();
    };
    const sm = renderer.shadowMap, render = sm.render;
    sm.render = function (...a) { restore(); return render.apply(this, a); };   // 메인 목록은 이미 만들어졌다
  }

  return { install, off, get culled() { return culled; }, get candidates() { return lastCount; } };
})();
