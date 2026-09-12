# CAR-REBUILD — 카 본체 재공사 기록

2026-08-17에 카 형상을 화면에서 걷어내고, 전면부터 다시 올리기 위해 남긴 기록이다.
Claude Code, Google Antigravity, Codex, Cursor는 카 작업을 시작하기 전에 이 문서와 `js/archive/car.js`를 먼저 읽는다.

앱은 이 원본을 로드하지 않는다. `index.html`에 `js/archive/car.js`를 추가하지 않는다.

도어 재공사(`docs/DOOR-REBUILD.md`)와 같다. 카문 원본은 `js/archive/doors.js`에 따로 있다.

## 현재 화면 상태

- **카 프레임(Car Sling) 및 플랫폼 재공사 완료 (2026-09-06)**:
  - `부품설계.pdf` 89~105p 상세 설계 및 현장 스크린샷 반영.
  - 상부 크로스헤드 빔(Top Beam): ㄷ자 더블 C채널, 보강 브레이스 암, 엔드플레이트.
  - 1:1 주 권상 와이어로프 결합용 5구 바빗 로프 소켓(Babbitt Sockets / Wedge Sockets): M20 타이로드, 완충 코일 스프링, 더블 잠금 너트, 테이퍼 소켓 바디 (`Y = +S.CAR_H / 2 + 0.68`).
  - 좌/우 수직 기둥(Car Stiles / 종형 세로 ㄷ자 채널): 상부 거싯 6-볼트, 하부 거싯 12-볼트 체결열, 천장 임시 고정 앵글 브라켓.
  - 하부 세이프티 디바이스(Safety Plank): 하부 채널빔, 완충 타격 플레이트.
  - 추락방지 안전장치: `assets/safety_gear.glb` 로드 및 `carGrp.userData.safetyGear` 인터페이스 복원 (수평 샤프트, 좌우 웨지 블록, U스프링). 2026-09-11 현대 SAFETY (CAR) 스타일로 재생성 — 아래 **세이프티기어 GLB 계약** 참고.
  - 카 상부 크로스헤드 비상정지 연동부 (2026-09-12 재설계): 빔 전면 웹에 바짝 붙인 Ø14 장죽과 관통 ㄷ자 브라켓 + 중간 가이드 6개소, 중앙 턴버클, 흑색 압축 복귀 스프링(Ø32)·시트 와셔·조절 더블 너트, U자 클레비스, 골드 캠 플레이트(육각 보스 + 분할 핀), 웹 하단에 납작하게 붙인 Honeywell형 리미트 스위치와 롤러 레버·케이블 새들, 좌우 트립 레버, 하부 플랭크로 내려가는 수직 연동 타이 로드 2본. 조속기 로프는 빔을 관통하는 Z축 토크 튜브와 후방 크랭크를 통해 이 트립 레버에 직결된다 — 아래 **카 상부 크로스헤드 비상정지 연동부 계약** 참고.
  - 상·하부 슬라이딩 가이드슈 4개소: `models/gltf/car_guide_shoe.glb`. 관통 U자 라이너, 주철형 하우징, 장공 어댑터, 조정볼트·잠금너트·고무 스토퍼, 상부 급유통. 도면의 5mm는 스토퍼 세팅 간격이며 레일 운전 간극이 아니다.
  - 카 플랫폼 베이스 프레임: 외곽 4변 C채널, 하부 종통 보강 채널 6본, 하부 강판 서브팬, 전면 실 서포트 채널, 하부 무릎 대각 브레이스.
  - 카 상부 안전 난간대: 톱빔 상단 고시인성 황색 베이스 가드, 3면 안전 파이프 난간(탑레일 900mm, 미드레일 480mm & M8 볼트, 토보드 100mm, 7개 수직 지주).

### 가이드슈 GLB 계약 (2026-09-08)

- 생성: `blender/scripts/car_guide_shoe.py`. 레일 단면은 기존 `guide_rail_13k.glb`의 `T_Rail_13K` POSITION에서 읽는다. 레일 변경 후에는 슈도 다시 생성·검증한다.
- 미터 단위, glTF Y-up, 원점은 레일 뒷면과 장착면의 교점. 날은 로컬 +X로 향한다. `T(x,y,z)=(x,-z,y)`로 Blender에 만든 뒤 기본 glTF 축 변환으로 내보낸다. scale은 1이다.
- 부모는 `carGrp → carFrameGrp → CarGuideShoe_{L|R}_{Upper|Lower}`이다. X는 `±S.CAR_BG/2`, 카 로컬 Z는 `0.04`. 우측은 Y축 180도, 하부 모델은 X축 180도로 회전하며 `Oiler`를 숨긴다.
- 상부 Y는 크로스헤드 상면 `chY+chH/2`. 하부 Y는 안전기 하부 캡 밑면 `plankY-0.145`로, `tools/build_safety_glb.mjs`의 캡 중심 `baseY-0.135`와 두께 `0.020`에 대응한다. 안전기 캡 변경 시 이 마운트도 함께 확인한다.
- 노드: `GuideShoeRoot`, `Adapter`, `Housing`, `Liner`, `Retainers`, `Fasteners`, `RubberStop`, `Adjuster`, `Oiler`. 별도 가동 애니메이션 없이 카 부모를 따라 이동한다.
- 안내 길이 120mm는 참고 도면 기반이다. 레일 측면·끝면의 0.5mm는 시각화용 간극이며 실제 설치·검사 허용값을 주장하지 않는다. 상세 두께·체결부는 기존 구조에 맞춘 교육용 재구성으로, 제작도면이나 인증 제품 복제품은 아니다.
- `assets/safety_gear.glb` 안에는 더 이상 하부 가이드슈 박스가 없다(2026-09-11 재생성). 로더는 GLB를 그대로 올리며 안전기 샤프트·웨지·스프링 노드와 피벗은 유지한다.
- 검증: `node tools/verify_car_guide_shoe.mjs`. 4개 배치, 레일 날 통과, 안전기 참조, 운행 중 상대 위치, 데스크톱·모바일 캡처를 확인한다. 캡처는 `.shot-guide-shoe/`에 저장한다.
- 재생성: `& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b -P blender/scripts/car_guide_shoe.py`.
- 검증 스크립트는 임시 로컬 HTTP 서버와 새 Chromium 세션을 사용한다. 앱의 CDN 라이브러리에 접근할 수 있어야 하며, 실패 시 네트워크·콘솔 오류를 함께 출력한다. 기존 배경의 `toNonIndexed` 중복 변환과 캡처의 GPU `ReadPixels` 경고는 별도 기록하고, 다른 경고와 실제 오류는 실패 처리한다.

### 세이프티기어 GLB 계약 (2026-09-11, 현대 SAFETY (CAR) 스타일)

- 생성: `node tools/build_safety_glb.mjs` → `assets/safety_gear.glb`. 참고 자료는 `temporary/safety_switch_device_elbaksa.mp4`(엘박사 세프티 스위치 영상, 현대 명판), 부품설계.pdf 224–225p 하부 프레임 도면, 사용자 스크린샷 2026-09-11 171814/172006. 제작도면이나 인증 제품 복제가 아닌 교육용 재구성이다.
- 애니메이션 계약 노드(`js/ui.js engageDeviceStop`, `js/elevator.js governorReset/refreshGovernorRope`)는 그대로다: `shaft`(원점 `(0, plankY, -0.15)`, `rotation.x` 트립), `liftL`/`liftR`(`position.y` 상승), `wedge{L,R}{0,1}`(`position.z` 레일 날 쪽 이동, `userData.z0` 기준), `spring{L,R}{0,1}`(`scale.y` 압축). 이름·피벗·좌표를 바꾸지 않는다. **`clamp` 노드는 2026-09-12에 제거했다** — 조속기 로프는 실물처럼 카 상부 크로스헤드 트립 레버의 후방 크랭크가 문다(아래 계약).
- 하우징: 민트그레이 도장, 카 로컬 X 1.205–1.306(플랫폼 측면 채널 1.20 바깥, 레일 뒷면 1.3125 안쪽), Z -0.08–0.16, 상·하판은 레일 날 슬롯(Z 0.024–0.056)을 비운 세 조각. 안쪽(카 중심 쪽)은 열려 있어 웨지·U스프링이 보인다. 하판 밑면 `plankY-0.145`가 하부 가이드슈 마운트면이다. 전면 조 블록에 황색 명판.
- 시각 부품(계약 외): 샤프트 양단 육각 보스와 골드 트립 레버(X ±1.2835, 아래로 120mm)는 `shaft` 자식이라 함께 회전한다. 복귀 스프링 로드(Y `plankY-0.10`, Z -0.15→0.02, 타격 플레이트 밑 브라켓 관통, 흑색 코일·더블 너트)는 정적이다. 트립 시 레버 핀과 로드 끝이 약 17mm 벌어지는 것은 허용한 근사다.
- 하부 가이드슈와 안전 스위치는 GLB에 없다. 가이드슈는 `models/gltf/car_guide_shoe.glb`가, Honeywell 안전 스위치는 실물 위치인 카 상부 크로스헤드(아래 **카 상부 크로스헤드 비상정지 연동부 계약**)가 담당한다. 2026-09-12에 하부 블록에서 중복 스위치를 걷어냈다.
- 검증: `.claude-tmp`/임시 스크립트로 트립 상태(`shaft.rotation.x=-0.38`, 리프트 +0.055, 웨지 ±0.012, 스프링 0.65)를 재현해 레버·클램프 암 회전과 웨지 물림을 확인했다. `node tools/verify_car_panels.mjs --load`의 `pm2` 화면에 우측 레버·스프링 로드가 함께 잡힌다.

### 카 상부 크로스헤드 비상정지 연동부 계약 (2026-09-12 재설계)

- 위치: `js/elevator.js` `buildCarCabin()` §4-B. 그룹 `carSafetyLinkage`(부모 `carFrameGrp`). 참고 자료는 `docs/safety_switch_device/frames.md`, `temporary/safety_switch_frames/`, 사용자 육성 지시 영상(2026-09-12). 제작도면이나 인증 제품 복제가 아닌 교육용 재구성이다.
- **좌우 반전**: 영상 현장은 좌측(-X) 거버너지만 우리 승강로는 조속기·피트 인장추가 우측(`GOV_TENS_X = +1.4275`)이다. 조작 뭉치(관통 브라켓·흑색 스프링·더블 너트·클레비스·캠 플레이트·Honeywell 스위치)는 전부 우측(+X). 스위치 글랜드는 카 중심(-X)을, 롤러 레버는 외측(+X, 캠)을 본다.
- **기구학 원본**(§4-B 상수에서 전부 파생. 각도·행정을 다른 곳에 다시 적지 않는다):
  - `SL_PIN_R = 0.058` 회전축 → 클레비스 핀. 핀은 회전축 **위**에 있다.
  - `SL_HALF = 11°` → 대기 `-11°` ↔ 트립 `+11°`, 총 22°. 좌우 레버는 **거울상이 아니라 같은 부호**로 돈다. 장죽 하나가 두 레버를 같은 각도로 끌어올려야 하기 때문이다(frames.md 06). 그 결과 타이로드 부착점이 좌우 모두 회전축의 로컬 +X 쪽이어서 **좌우 배치가 대칭이 아니다** — 좌측 회전축을 안쪽으로 옮기면 좌측 타이로드가 캐빈(|X|<1.20)을 관통한다.
  - 대칭 각이라 클레비스 핀 Y가 양 끝에서 같다 → 장죽은 **순수 X 이동** `2·R·sin11° = 22.1mm`만 한다. **같은 트릭을 후방 크랭크에도 써서** 로프 클램프 X를 양 끝에서 로프 수직선과 일치시킨다.
  - 장죽은 **카 중심 쪽(-X)**으로 끌려온다. 관통 브라켓이 빔 고정, 시트 와셔·더블 너트가 장죽 고정, 그 사이가 흑색 압축 스프링이라 이 방향이라야 압축된다(`scale.x` 1 → 0.643). 복귀 때 스프링이 장죽을 +X로 밀어 레버를 대기각으로 되돌린다(frames.md 07).
  - 스위치 롤러 레버는 대기 `-13°`, 트립 `+2°`(15° 상승). **스위치가 회전축보다 아래**에 있으므로 롤러는 캠을 아래에서 받친다 → 대기가 **큰 반경(로브)**, 트립이 **작은 반경(기초원)**이다. 캠이 돌면 롤러가 로브에서 떨어져 튀어 오르며 NC 접점이 열린다(frames.md 03). 롤러 축 X는 `SL_CAM_AIM`(대기 반경 0.050)에서 **역산**한다. 롤러 중심~캠면 간격은 전 행정에서 롤러 반지름 9mm를 유지한다.
- **조속기 로프 직결 (Z축 토크 튜브 + 후방 크랭크)**: 실물처럼 로프가 카 상부 트립 레버를 직접 끌어올린다. 레버(Z≈+0.135)와 로프 평면(Z=-0.37)이 0.5m 떨어져 있어, 회전축을 Ø22 튜브(`safetyTorqueTube`)로 연장해 전·후 웹을 관통시키고 후단에 크랭크(`safetyGovCrank`)를 물렸다. **Z축 회전은 점의 Z를 보존**하므로 클램프가 로프 평면에 정확히 머문다. 빔 끝을 도는 절곡 링크는 레일 Z 밴드를 가로질러 불가하고, 후면 X축 로커는 전면 레버가 Z축 회전이라 Z 변위를 2차항(<1mm)밖에 못 만들어 불가하다.
  - `SL_CRK_R = (GOV_TENS_X - SL_PIV_XR) / cos(SL_HALF)` = 0.2175. 클램프 상승 83mm.
  - ※ `engageDeviceStop`에서 카는 250mm 낙하하는데 클램프는 카 상대 83mm만 올라간다. 엄밀히는 로프가 잡혔으니 월드 Y 고정이어야 하지만 그러려면 크랭크 반경이 0.65m여야 해 불가능하다. **"로프가 클램프를 미끄러진다"로 본 근사**이며, 예전(하부 샤프트 클램프)보다 오차가 줄었다.
- **Z 레이어**: 빔 전면 웹 앞면 `0.097`, 스타일 전면 플랜지 앞면 `0.120`, 상부 거싯 앞면 `0.100`. 가동부는 그 앞 `SL_ROD_Z = chFwdZ + 0.065 = 0.135` 한 평면에 모은다(웹면에서 38mm).
  - 이 값은 **클레비스 포크 바깥면(평면 −0.012)이 스타일 전면 플랜지 0.120을 넘어야 한다**는 조건이 정한다. 포크를 넓히거나 평면을 당기면 바로 플랜지를 파고든다.
  - 상부 거싯 플레이트 Z 깊이를 `0.19 → 0.12`(`js/elevator.js` 스타일 루프)로 줄여 확보한 여유다. 되돌리면 가동부가 다시 빔에서 55mm 떠야 한다(사용자 지적 "우리 건 이게 떨어져있지").
- **Y**: 장죽 축 `SL_ROD_Y = chY + chH/2 - 0.020`. 더 올리면 스프링 외경(Ø32) 윗면이 황색 베이스 가드 밑면(`chY+chH/2`)을 파고든다. 레버 회전축 Y는 `SL_ROD_Y - R·cos11°`로 파생. 스위치는 `chY - chH/2 + 0.008 + SL_SW_H/2`(빔 웹 하단 +8mm) — 사용자 지적 "스위치가 최대 아래 붙어있고".
- **X**: 우측 회전축 `1.214`, 좌측 `-stileX`. 타이로드는 대기 시 우측 `1.2575`, 좌측 `-1.214`(둘 다 캐빈 반폭 1.20 바깥). 타이로드 하단은 `plankY + 0.200` — 안전기 상판 캡 볼트 머리 위 52mm.
- **가동 노드**: `safetyCrossRod`(`position.x`), `safetyReturnSpring`(`scale.x`), `safetyCamLeverR`/`safetyTripLeverL`(`rotation.z`), `safetySwitchArm`(`rotation.z`), `safetyTorqueTube`·`safetyGovCrank`(`rotation.z`), `safetyTieRod` 2본(`position` + 미세 `rotation.z`로 하단을 제자리에 둔다). 정지부: `safetyLimitSwitch`, 관통 브라켓 1 + 중간 가이드 브라켓 6, 레버 필로블록, 토크튜브 필로블록 2, 타이로드 가이드 브라켓 6.
- **트립 연동 계약**: 진입점은 `carGrp.userData.safetyLinkage.set(p)` 하나다(`p` 0 대기 ~ 1 트립). `refreshCarSafetyLinkage()`가 `shaft.rotation.x / SG_TRIP_ROT`로 `p`를 만들어 넘기며, `refreshRopes()` 끝과 `governorReset()` `onUpdate`에서 호출된다. `SG_TRIP_ROT = -0.38`은 `js/elevator.js` 단일 원본이고 `js/ui.js engageDeviceStop`이 같은 상수를 쓴다.
  - `set(p)`는 **매 프레임 호출**된다. 지오메트리 생성·dispose 금지, transform 대입만.
  - `set(p)`가 `carGrp.userData.govClamp`(카 로컬 `{x,y,z}`)를 갱신하고 `refreshGovernorRope()`가 그걸 읽는다. **호출 순서가 중요하다** — `governorReset()` `onUpdate`는 링키지를 먼저 부른다. 뒤집으면 로프가 한 프레임 늦는다.
  - `environment.js buildPit()`이 카 생성 전에 `refreshGovernorRope()`를 부를 수 있어, `govClamp`가 없으면 꺾임 없는 직선 1구간으로 그리는 fallback이 있다.
- **정지 브라켓 겹침**: 레버 필로블록·체결 볼트는 체결 대상(웹·플랜지)과 겹친다. 이 파일의 기존 방식과 같다. 토크 튜브는 빔 전·후 웹을 **관통**한다(구멍). 자기 축으로만 도는 축대칭 부품이라 회전해도 스윕 체적이 늘지 않는다. 그 외 가동부는 대기·트립 어느 자세에서도 기존 부품과 겹치지 않는다.
- 검증: `node .claude-tmp-verify-linkage.mjs` — ⓐ 대기/트립 수치 11항목, ⓑ 롤러-캠 접촉 5점, ⓒ 가동부 p 스윕(0.05 간격) AABB 간섭 0, ⓓ 층별 승강로 고정물 스윕, ⓔ 로프 2구간이 클램프에서 만나는지(<1mm)·구간 길이 하한, ⓕ 캡처 8장(`.shot-linkage/`). 실동작은 `node .claude-tmp-dynamic.mjs` — 실제 `onGovernorOverspeed → engageDeviceStop → resetGovernorFault`에서 웨지와의 위상 오차 0, 복귀 후 전 부품 원위치. 헤드리스는 `gsap.ticker.lagSmoothing(0)` 필수이고 낙하 물리적분 구간은 건너뛴다.

### 카 판넬 조립 (2026-09-11)

- `js/car-panels.js`의 `buildCarPanels(carGrp)`가 부품설계.pdf 205–219p의 설치 완료 상태를 생성한다. 11장 벽 판넬, 절곡 이음/체결부, 4T 바닥 마감, 홈이 있는 카 실, 후면 손잡이, 출입구 트랜섬, 천장 덮개/보강대/스타일 방진 고정부를 포함한다. 임시 받침목·양중구와 천장 임시 앵글은 남기지 않는다.
- 사용자 변경: 왼쪽 벽과 출입구 리턴은 금속, 후면과 오른쪽 벽은 중앙 사각 개구 면적 약 80%의 투시 유리다. 판넬 이음 기둥과 금속 테두리를 유지한다. 특정 제조사의 제품 복제가 아닌 기존 카 치수에 맞춘 시각화다.
- 치수는 `S`에서 파생하며 `carGrp`의 위치·로프·FSM은 유지한다. 승장 실 끝면 `HALL_SILL_SHAFT_Z`는 `index.html`에서 공유하고 카 실은 `SILL_GAP`만큼 떨어진다.
- 검증: `node tools/verify_car_panels.mjs`로 실 간극/바닥 높이, 스타일·이동케이블 간극, 층별 추종과 전면·후면·승강로 화면을 확인한다.

아직 미복원(재공사 대기):

- 카 실내 추가 설비(천장 조명). OPB·카 탑 박스는 221–223p, 하중 감지는 224–226p A 타입 포텐셜 미터 PM1/PM2 기준으로 추가했다. 전기 동작은 미연결이며 상세는 [CAR-CONTROLS.md](CAR-CONTROLS.md).
- 카 도어 및 오퍼레이터(도어 패널, 행거)
- 탑승자 메시

그대로 둔 것:

- `carGrp` — `position.y` / `position.z` 로 운행
- 주 로프, 조속기 로프, 균형추와 그 움직임
- 조속기·권상기·피트·가이드레일·로비 벽
- 치수 `S.CAR_W`, `S.CAR_D`, `S.CAR_H` — `js/config.js`
- 운행 FSM, 도어 스텁, 비상정지 시퀀스

`buildPassenger()`는 빈 그룹만 만든다.

## 원본 코드 위치

파일: `js/archive/car.js`

| 구간 | 위치 | 부품 |
|---|---|---|
| 실내 측면·후면·바닥·천장 | `buildCarCabin()` 앞부분 | 유리, PVD, 대리석, 코브조명 |
| COP | 같은 함수 | 카 조작반 |
| 카 센서 | `carSensorGrp` | 층 인식 캠 |
| 체대 | `carFrameGrp` | PDF 11p 프레임 |
| 플랫폼·에이프런 | `platformGrp` | PDF 10p, 카 실, 에이프런 |
| 세이프티기어 | GLTFLoader | `assets/safety_gear.glb` |
| 롤러 가이드 | `rollerGuideGrp` | 가이드슈 |
| 트랜섬·컬럼 | 함수 하단 | 전면 개구 프레임 |
| 탑승자 | `buildPassenger()`, `togglePassenger()` | 프리미티브 인체 |

## 부품을 다시 올릴 때

1. 이 문서와 `js/archive/car.js`에서 해당 구간만 읽는다.
2. `js/elevator.js`의 스텁 `buildCarCabin()`에 그 구간만 넣는다.
3. 전면 디자인부터 다시 올릴 때는 과거 트랜섬·컬럼·에이프런을 참고하되, 새 자료가 있으면 새 자료가 우선이다.
4. 요청하지 않은 실내·체대·세이프티기어를 한꺼번에 복원하지 않는다.
5. `carGrp.position.y` / `z`, 주 로프, 조속기 로프, 균형추 연동을 요청 없이 바꾸지 않는다.
6. `const S` 카 치수는 확인 없이 바꾸지 않는다.
7. `index.html`에 아카이브 파일을 연결하지 않는다.

운행 계약(복원 전까지 스텁이 지킨다):

- `carGrp` 존재, `scene`에 add, 1층 정위치 `FLOOR_Y[0] + S.CAR_H / 2`, `z = CAR_CTR_Z`
- `carGrp.userData.safetyGear` 는 `null`이어도 `ui.js` / `governorReset()`이 통과한다
- `carGrp.userData.safetyLinkage` 도 없으면 `refreshCarSafetyLinkage()`가 그냥 빠져나온다
- 조속기 로프 클램프 Y는 `carGrp.position.y - S.CAR_H / 2 - 0.16`
- 주 로프 히치 Y는 `carGrp.position.y + S.CAR_H / 2 + 0.68`

## 관련 파일

- 치수: `js/config.js` `S.CAR_*`
- 카문 원본: `js/archive/doors.js`, `docs/DOOR-REBUILD.md`
- 로프: `js/elevator.js` `buildWireRopes()`, `refreshRopes()`, `refreshGovernorRope()`
- 균형추: `js/elevator.js` `buildCounterWeight()`
- 세이프티기어 GLB: `assets/safety_gear.glb`, 생성 `tools/build_safety_glb.mjs`
