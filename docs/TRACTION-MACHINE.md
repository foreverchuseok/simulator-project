# 권상기 (웜 기어드) — 형상·장착·교육 연출 계약

## 원본과 연결

- 형상 원본: `blender/scripts/traction_machine.py` → `models/gltf/traction_machine.glb`. 형상을 JS에서 다시 만들지 않는다.
- 장착 수치 원본: `js/environment.js`의 `TRACTION_MACHINE_MOUNT` JSON. Python이 읽고 GLB 루트 extras(`tractionMachine`)에 되돌려 쓴다. 로더가 `sheaveR`·`wheelX`·`wormY`·`baseTop`·로프 X(`ROPE_GROOVE_X`)를 대조한다. 불일치하면 GLB를 붙이지 않고 콘솔 오류를 낸다.
- 로프 X는 `js/elevator.js`의 `ROPE_GROOVE_X`, 로프 반경은 `buildWireRopes()`의 `ropeR`에서 읽는다.
- 참고: 동양엘리베이터 전시용 절개 권상기 사진(2005)과 웜·휠 근접 사진. 제품 치수를 복제한 모델은 아니다. 회색 도장이며 상표는 넣지 않는다.

## 좌표와 구성

- 로컬 원점은 주도르래 축 중심이고, 월드 좌표로는 `x=0, y=mainY, z=mainZ`다. 스케일은 1이다(옛 1.5배 스케일을 제거했다).
- X축은 출력축 방향이다. 시브는 x=0, 웜휠 평면은 `wheelX=-0.33`이다. 웜은 휠 **위**에 놓이며(`wormY=0.25` = 중심거리), 웜 축은 Z 방향이다.
- 구동 순서는 -Z → +Z 방향으로 `크랭크 육각(노랑, 벽걸이 수동 핸들용) → 웜(2줄, 우나사) → 브레이크 드럼(컵형, 커플링 겸용) → 전동기 → 엔코더`다.
- 기어는 모듈 8이다. 휠은 청동 50치(피치 반경 0.2)이고 목(throat)을 웜 뿌리 원환으로 깎았다. 치에는 리드각 비틀림(tan λ = 0.16)을 줬다. 감속비는 25:1이다.
- 기어 케이스: 휠실, 웜 튜브, -X 측면 볼트 커버·베어링 캡, +X 보스, 상부 아크릴 점검창, 내부 오일 와이퍼, 출력축 롤러 베어링.
- 오일: 레벨은 `OIL_Y=-0.155`다(휠이 약 2.5치 잠김). -X면 후방 하단에 유면계(H/L 눈금)와 드레인 플러그가 있고, 웜 튜브 -Z 쪽 위에 주유구·브리더가 있다.
- 모터 후면(2026-09-24 보완): 프레스 강판 팬 커버(말린 테두리, 동심 링 3개 + 방사 살 10개 그릴, 중앙 허브판·볼트 4개)를 달고, 그릴 뒤에 회전 냉각팬(`WormRotor` 소속, 8날개)을 넣었다. 허브 앞에는 **중공축 로터리 엔코더**가 있다(국내 승강기에서 흔한 Ø60급 형태). 검은 몸체에 알루미늄 앞면·뒷링, `ROTARY ENCODER 2048 P/R DC5V` 라벨 띠가 있고, ㄱ자 토크암이 커버 허브에 볼트로 고정된다. 회전부(청동 중공축·알루미늄 클램프 링·축 끝)는 모터축과 함께 돈다. 케이블 글랜드는 좌상 방향이며 전선관 시작점은 `cableExits.encoder`다.
- 생성 메시에는 박스 투영 UV를 넣었다(주물 노멀맵 좌표 — 이전에 GLTFLoader 'Custom UV set -1' 경고가 나던 원인).
- 브레이크 = **이중브레이크 개조형**(TKE `티케이 구동기 설치 매뉴얼`, TM30B 기준). 검사기준 12.4.2.1은 "드럼 제동에 관여하는 브레이크의 모든 기계 부품은 2세트"를 요구한다(2013.09.15 건축허가분 이후 필수, 개정 승강기안전관리법 추가 안전장치 8종 중 '브레이크 시스템').
  - 양 암·곡면 슈(라이닝)는 하단 피벗이다.
  - 도금 원통 몸체(솔레노이드 2개, 가운데 분할 밴드) 위에 노란 코일 단자박스가 있고, 회색 글랜드 4개와 라벨 `BM1± BM2± MS1 MS2`를 달았다. 몸체는 검은 BASE 위에 있고, BASE는 평형볼트 블록 2개로 웜 끝 플랜지 브래킷에 고정한다.
  - 좌우는 독립이다. 푸시로드·푸시로드볼트 2개, 암볼트 2개(가운데 앵커에서 암을 관통), 스프링캡·스프링·이중 너트 2세트, 눈금자 2개, 개방 스위치 MS1·MS2가 있다.
  - 스프링 설치치수는 캡 안쪽 기준 **116mm**다(TM30B 11kW 성능표). 암↔암볼트 고정너트 간격은 4mm다(점검 기준 3mm 이상, 패드 마모 시 제동력 상실 방지). 고정너트와 스프링 너트에 **적색 표기**를 넣었다.
  - 몸체 앞에는 수동 개방 레버 끼움부(육각)가 있다. 벽걸이 개방 레버·수동 핸들은 기존 JS 그대로다.
  - GLB extras `dualBrake`에 `sets:2`, `springSet:.116`, `armNutGap:.004`, `motorKW:11`이 있다.
- 시브(주·현수 공용 설계, `build_spoked_sheave`): 노란 주물 몸체, 곡선 S스포크(긴 타원 구멍 6개), 검은 가공 홈 림이다. 홈은 `ROPE_GROOVE_X` 5개이고 홈 반경은 로프 반경 + 0.5mm다(주 홈 바닥 0.3235, 현수 홈 바닥 0.1375). 현수도르래는 같은 스크립트가 `models/gltf/deflector_sheave.glb`로 따로 내보낸다. 허브에 밀봉 베어링면이 있고 보어는 JS 축 지름 22mm다.
- 가드(노란 타공판): 연속 경로는 **앞 스커트**(카로 내려가는 로프 앞, y=-0.28까지) → 감김부(0°~로프 이탈각 117.5°) → **뒤 터널**(로프 접선을 따라 0.33m, 로프브레이크 몸체 70mm 앞에서 끝남)이다. 옆판은 로프선 30mm 아래까지 내려온다. 앞 스커트는 브레이크 스탠드 탭에, 뒤 터널은 베드판 지주에 고정한다. 로프 이탈각은 `TRACTION_MACHINE_MOUNT`의 `deflectorR/DZ/DY`로 Python이 계산하고, JS 로더가 실제 현수도르래 위치와 대조한다.
- 받침대는 JS가 만든다. 범위는 `baseX`·`baseZ`이고 상면은 `baseTop`이다. 시브는 받침대 밖(+X)에 걸려 체대 위로 내려간다. 옛 받침대의 카측 로프 홀은 없앴고, 기계실 바닥 로프 홀·방수턱은 그대로다.

## GLB 노드 계약

| 노드 | 원점(피벗) | JS 장착 |
|---|---|---|
| `SheaveRotor` | 시브 축 | `mainSheaveGrp`(스핀) → 정렬 그룹(rotation.y=-π/2) 아래. 시브·출력축·웜휠이 함께 돈다. |
| `WormRotor` | 웜 축 `(wheelX, wormY, 0)` | `TMWormSpin` 래퍼(축 Z). |
| `BrakeArmL`, `BrakeArmR` | 암 하단 피벗 | `rotation.z` ±0.012 rad(개방). |
| `GearCaseCutaway`, `InspectionWindowCutaway` | 모델 원점 | 절개 시 -X로 0.32m 빼낸 뒤 숨긴다. |
| `GearOil` | 모델 원점 | 절개 시에만 표시(반투명). |
| `GearCase`, `InspectionWindow`, `BrakeFrame`, `Motor`, `Bedplate`, `SheaveGuard` | 모델 원점 | 정적. |

- 절개 조각은 케이스 셸과 하나의 절단 입체(상부 웜 1/4 + 전면 하부 오일 1/4)의 교집합이다. 절단면은 빨강(`TM_SectionRed`), 내부는 프라이머색이다. 볼트는 중심 위치로 판정해 조각 쪽에 붙인다.
- Blender 함정 1: 컬렉션을 피연산자로 INTERSECT하면 멤버마다 따로 교차된다. 절단 상자는 먼저 하나로 합친다.
- Blender 함정 2: 베벨을 먼저 걸면 EXACT 불리언이 뒤집힌다(부피가 음수가 된다). 베벨은 절단 뒤에 건다.

## 동작

- 회전: `ui.js`의 `spinTractionSheaves()`가 시브를 `-Δy/R`만큼 돌린다. 웜은 절대각 `worm.rotation.z = wormPerSheave(-25) × mainSheaveGrp.rotation.z`로 맞춰서 이물림 위상이 누적 오차 없이 유지된다.
- 부호: 우나사 웜이 휠 위에 있을 때, 휠이 +X로 α 돌면 웜은 +Z로 -25α 돈다. 휠 치 0번은 +Y(웜 아래)에 있고, 웜 나사산은 접점에서 z = P/2 + nP에 놓인다.
- 브레이크: `MACH.brakeRelease()`/`brakeSet()`(운행음)이 `setTractionBrake(true/false)`를 부른다.
- 배선(매뉴얼 결선: 코일 BM1±/BM2±, 개방 스위치 MS1/MS2 → 제어반 TB): GLB extras `cableExits`(코일 단자박스 글랜드, 모터 단자함, 엔코더)에서 플렉시블 전선관 3가닥 `DualBrakeSupply`·`MotorPowerSupply`·`EncoderSignal`을 뽑는다. 전선관은 받침대 -X면 클립을 따라 내려가 체대 채널을 넘고, 바닥 덕트 분기(x=-0.77)로 들어가 제어반까지 이어진다. 구현은 `machine-room-safety.js`의 `attachTractionMachine()`이다.
- 절개: 카메라 메뉴 「권상기 내부」 → `setTractionCutaway(on)`. 켜면 -X 시점으로 이동하고, 카메라가 벽 라이닝 앞에서 멈춘다. 「권상기」 버튼은 전체 관찰 시점이다.
- 상태는 `mrGrp.userData.traction`에 있다(`ready`, `worm`, `wormPerSheave`, `cutaway`, `brakeOpen`, `cutPieces`, `oil`, `arms`, `contract`).

## 확인

- `& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b -P blender\scripts\traction_machine.py`
- `node tools/verify_traction_machine.mjs`: 이중브레이크 계약(2세트·116mm·간격 3mm 이상), 가드↔로프 최소 간격(스커트·감김·터널, 현재 43.9mm), 터널 끝↔로프브레이크(70mm), 현수도르래 홈 5개, 전선관 3가닥 시작점 = GLB 연결점 / 끝점 = 덕트, 장착 계약, 로프 5홈 바닥 광선, 휠 1치 피치 12위상 × 면 3곳의 피치선 웜/휠 간섭(0mm), 25:1 연동, 브레이크 개방 방향, 절개 버튼 토글, 받침대·가드·브레이크 암·로프브레이크 간극, 근접 스크린샷(`.shot-traction-machine/`).
- 회귀: `verify_machine_room_safety.mjs`(로프브레이크 접선), `verify_wire_rope.mjs`, `verify_babbitt_hitch.mjs`, `verify_overhead.mjs`, `verify_overspeed.mjs --shadows`.
