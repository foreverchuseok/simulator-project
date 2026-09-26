# KoELSA 전기식 엘리베이터 3D 시뮬레이터

한국승강기안전공단 교육·시연용 전기식 엘리베이터 3D 시뮬레이터다.
Three.js로 승강로, 카, 도어, 기계실, 피트와 안전장치를 구성하고 GSAP으로 운행·도어·고장 동작을 연출한다.

문서와 코드가 다르면 현재 코드가 기준이다.

현재 단계는 **1단계 — 웹 최적화와 기본 사용 경험 정리**다. 사용 기준은 Galaxy S22 이상 / Chrome이며 기존 버전이 S22+에서 원활하다는 사용자 확인을 받았다. 부품 더블클릭·더블탭으로 가까이 보고 오른쪽 위 「전체 보기」로 복귀한다. 새 카메라 조작의 실제 모바일 검증과 통합 확인이 남아 있다. 전체 순서와 다음 작업은 [공유 로드맵](docs/ROADMAP.md)을 참고한다.

## 빠른 시작

1. 프로젝트 루트에서 Live Server로 `index.html`을 연다.
2. 아래 운행바(도어·층·비상정지)와 오른쪽 위 「고장·점검」「설정」「전체 보기」를 사용한다.
3. 코드나 GLB를 바꾼 뒤 브라우저에서 하드 리프레시한다.

기본 화면은 부품 윤곽과 명암을 구분하는 청회색 관찰 배경이다. 「설정」에서 정격 속도, **권상기 내부**(절개), **주변 풍경**, **캐릭터**를 켜고 끈다.

### 화면 구성 (2026-09-26 HUD 재설계)

- 왼쪽 위 **상태 카드**: 층(지나는 층마다 갱신)·방향 화살표·상태 칩(정상 초록 / 안내 파랑 / 경고 주황 / 고장 빨강)·속도 막대(정격 130% = 가득). `updateStatus()`가 넘겨받은 색을 칩 톤으로 바꾼다.
- 아래 **운행바**: 도어 열림·닫힘, 층 버튼(현재 층 점등, 호출 층 파란 링), 비상정지(누르면 「해제」로 바뀜). 메뉴를 열지 않고 바로 쓴다.
- 오른쪽 위 **레일**: 「고장·점검」 시트(운전 모드 AUT/INS·▲▼, 과속 OVS, 개문발차 UCM·로프브레이크 상태, 승장문 점검, BYPASS, 피트 사다리), 「설정」 시트, 「전체 보기」.
- 부품별 카메라 프리셋 메뉴는 없앴다. 부품은 더블클릭·더블탭으로 다가가고, 시연(OVS·UCM 등)은 카메라가 알아서 움직인다.
- 선택 항목(로프브레이크 상태·BYPASS·정격 속도)은 숨긴 `<select>` 원본의 값·change 이벤트를 그대로 쓰고, 화면에는 세그먼트 버튼으로 보인다(`renderSegments()`).
- 세로 폰(≤600px)에서는 시트와 승장문 점검 패널이 운행바 위 바텀시트로 뜨고, 가로 폰에서는 오른쪽 패널로 뜬다. 버튼은 모두 44px 이상이다. 검증: `node tools/verify_view_modes.mjs`.
- **모바일 컴팩트 모드**(2026-09-26, 폰 세로 ≤600px·가로 폰): PC 화면은 그대로 두고 폰에서만 적용한다.
  - 설명·안내·조작 방법 문구를 숨기고 약자·짧은 라벨로 바꾼다(`.l-full`/`.l-short` 쌍). 예: 운전(AUT·INS·▲▼ 한 줄), 고장(OVS 과속·UCM 개문 2열 타일), 로프브레이크, 점검(문 삼각키·사다리 피트), BYP. 설정은 토글 3개를 칩으로 둔다.
  - 버튼 48px, 글자 14px 이상이고 바텀시트에는 드래그 핸들 모양을 둔다(Material 3 기준). S22+(384×740)에서 고장·점검 시트가 스크롤 없이 들어간다.
  - ★페이지 높이는 `100dvh`다. `100vh`는 모바일 크롬 주소창이 숨은 높이라서 하단 운행바가 화면 밖으로 밀려 있었다(S22+ 화면 녹화로 확인).

앱은 CDN의 Three.js r128, OrbitControls, GLTFLoader와 GSAP 3.12.2를 사용한다.
`npm`은 Playwright 등 로컬 검증 도구용이며 앱 실행 자체에는 필요하지 않다.

## 문서 안내

- [docs/ROADMAP.md](docs/ROADMAP.md): 웹 운영 방향, 전체 개발 순서, 현재 단계와 인계 상태의 원본.
- `AGENTS.md`: Claude Code, Google Antigravity, Codex, Cursor가 따르는 공통 규칙. Codex·Cursor 전용 md는 없다.
- `CLAUDE.md`: Claude Code 입구. 내용은 `AGENTS.md`를 읽으라는 한 줄이다.
- `GEMINI.md`: Google Antigravity 입구. 내용은 `AGENTS.md`를 읽으라는 한 줄이다.
- `blender/BLENDER-WORKFLOW.md`: Blender Python에서 GLB를 만들고 연결하는 절차.
- `PLAN.md`: 사용자가 이 파일에 담아 달라고 지정했을 때만 쓰는 로컬 임시 계획. Git에는 포함하지 않는다.
- `docs/DOOR-REBUILD.md`: 도어 재공사 기록. 원본 코드는 `js/archive/doors.js`.
- `docs/CAR-DOOR.md`: 카 도어 오퍼레이터·베인·카도어락·승장문 연동과 검증.
- `docs/CAR-REBUILD.md`: 카 재공사 기록. 원본 코드는 `js/archive/car.js`.
- `js/car-underbody.js`: 카 에이프런·CC27 빨간 경광등과 BYPASS 점검운전 경보. 「고장·점검」에서 우회할 문을 선택하고 ▲▼를 누른다.
- `js/car-wiring.js`: 카 고정 검은 배선의 모서리 경로·고정 새들과 카탑 박스 하부의 단일 묶음 인입구/보호 부시. `tools/verify_car_wiring.mjs`로 형상·간섭을 확인한다.
- `docs/CAR-CONTROLS.md`: 카 탑 박스·OPB·하중 감지.
- `docs/PIT-SCREEN.md`: 후면 균형추 앞 노란색 철제 피트 스크린·Blender 원본·장착과 검증.
- `docs/MACHINE-ROOM-SAFETY.md`: 로프브레이크 볼트식 받침·각도 조절 측판·조속기와 브레이크의 바닥 덕트 배선.
- `docs/GOVERNOR-DESIGN.md`: 조속기 스위치·쐐기·진자 형상과 기존 작동점 유지·검증.
- `docs/LEVELING-SENSORS.md`: 레벨링 센서.
- `docs/TRAVEL-CABLE-TERMINAL.md`: 이동케이블·종단 리미트 스위치(파이널·리미트·강제감속, 스위치 방식) (MR_설계.pdf 137~138p, 부품설계.pdf 184~204p).

## 실제 프로젝트 구조

```text
simmul/
├─ index.html                     앱 진입점, HTML/CSS/HUD, 전역 상태, 초기화, 렌더 루프
├─ js/
│  ├─ config.js                   카·도어 치수와 공통 재질
│  ├─ environment.js              배경, 승강로, 센서, 기계실, 피트, 조속기 마운트
│  ├─ elevator.js                 카·도어 스텁, 균형추, 로프, 조속기 동작
│  ├─ car-door.js                 카문·오퍼레이터·CDL·승장문 종동 운동학
│  ├─ ui.js                       운행, 도어, HUD, 사운드, 과속 고장 시퀀스
│  └─ archive/
│     ├─ doors.js                 도어 재공사 원본 (앱 미로드)
│     └─ car.js                   카 재공사 원본 (앱 미로드)
├─ docs/
│  ├─ ROADMAP.md                  전체 개발 순서·현재 단계·다음 작업
│  ├─ DOOR-REBUILD.md             도어 재공사 안내
│  ├─ CAR-REBUILD.md              카 재공사 안내
│  ├─ CAR-CONTROLS.md             카 탑 박스·OPB·하중 감지
│  ├─ LEVELING-SENSORS.md         레벨링 센서
│  └─ TRAVEL-CABLE-TERMINAL.md    이동케이블·종단 안전장치 (184~204p)
├─ blender/
│  ├─ BLENDER-WORKFLOW.md
│  └─ scripts/
│     ├─ overspeed_governor.py    조속기 형상 원본 및 GLB 내보내기
│     └─ render_governor.py       조속기 정면·사선 렌더 검증
├─ models/gltf/
│  └─ overspeed_governor.glb      앱이 로드하는 조속기 최종 모델
├─ assets/
│  ├─ safety_gear.glb             세이프티기어 모델
│  └─ bg/                         배경, 로고, 점자, 도어 스티커 텍스처
├─ sound/                         도어·층 안내·차임 음원
├─ tools/
│  ├─ build_safety_glb.mjs        세이프티기어 GLB 생성 도구
│  ├─ verify_travel_cable.mjs     이동케이블·종단 안전장치 수치 검증
│  └─ transcribe.py               개발 보조 도구
├─ generate_sounds.py             사운드 생성 보조
├─ extract_audio.py               오디오 추출 보조
├─ package.json                   로컬 검증 의존성
└─ vercel.json                    배포 헤더 설정
```

## 로드 순서와 전역 구조

이 프로젝트는 ES module이 아니라 classic script를 사용한다.
각 파일이 `scene`, `carGrp`, `mrGrp`, `currentState` 같은 전역 심볼을 공유하므로 스크립트 순서와 이름 변경에 주의한다.

```text
Three.js → OrbitControls → GLTFLoader → GSAP
        → js/config.js
        → js/environment.js
        → js/elevator.js
        → js/ui.js
        → index.html의 init() / renderLoop()
```

### 초기화 흐름

`index.html`의 `init()`이 다음 빌더를 순서대로 호출한다.

```text
장면·카메라·렌더러
  → buildLighting()
  → buildBackground()
  → buildFrontWallAndLobby()
  → buildGuideRails()
  → buildShaftLandingDevices()
  → buildLimitSwitches()          레일 고정 종단 리미트 스위치 6개 (DFL/DLS/DSD/USD/ULS/UFL)
  → buildMachineRoom()
  → buildShaftCableHarness()      제어반 인출 → 좌측벽 하네스 → 층 분기박스 → 피트 리모컨
  → buildCarCabin()               재공사 스텁 (빈 그룹)
  → buildPassenger()              재공사 스텁
  → buildCarDoors()               재공사 스텁 (빈 그룹)
  → buildHatchDoors()             재공사 스텁 (빈 그룹)
  → buildCounterWeight()
  → buildTravelCable()            이동케이블(T-Cable) U 곡면
  → buildWireRopes()
  → buildPitFoundation()
  → updateBuffers()
  → bindUIEvents()
  → renderLoop()
```

`renderLoop()`은 주도르래 회전, OrbitControls 갱신, 카메라 제한과 렌더링을 담당한다.
루프 안에서 새 Geometry, Mesh, Material을 생성하면 안 된다.

## 핵심 파일별 역할

### `index.html`

- HTML, HUD, 메뉴와 전체 CSS.
- `ELEVATOR_STATE`, `currentState`, `curFloor`, `moving`, `doorOpen`, `estop` 등 전역 상태.
- 층 좌표 `FLOOR_Y`, 피트·오버헤드와 카/승강로 Z 파생 좌표.
- `createBox()`, `createCylinder()`, `makeRopeGeometry()` 기하 헬퍼.
- `init()`과 `renderLoop()`.
- `?mrcam`, `?doorcam=1~4`, `?govcam`, `?tcam`, `?flscam`, `?sldcam` 카메라 확인 쿼리.

### `js/config.js`

- `const S`: 카, 도어, 승강로 관련 기준 치수.
- `CAR_DEPTH_SCALE`: 카 깊이 연동 스케일.
- `const M`: 금속, 도장, 콘크리트, 유리, 발광 등 공통 재질 팩토리.

`const S`는 여러 좌표의 기준이므로 수정 전에 사용자 확인이 필요하다.

### `js/environment.js`

- 조명과 배경 지형·건물.
- 전면벽, 로비, 점자블록.
- 가이드레일, 층 인식 장치.
- 종단 안전장치 승강로측: 레일 클립 고정 리미트 스위치 6개 — 파이널·리미트·강제감속 (`buildLimitSwitches()`). 캠은 카 스타일(`elevator.js buildCarCabin()` §7).
- 승강로 케이블 하네스: 제어반 인출, 층 분기 박스, 피트 리모컨 (`buildShaftCableHarness()`).
- 기계실, 권상기(웜 기어드 GLB, 절개·브레이크 연출), 주도르래와 조속기 GLB 마운트.
- 피트, 완충기, 인장시브와 조속기 로프 기반 형상.
- 조속기 래퍼와 `mrGrp.userData.governor` 계약.

주요 함수:

- `buildLighting()`
- `buildBackground()`
- `buildFrontWallAndLobby()`
- `buildGuideRails()`
- `buildShaftLandingDevices()`
- `buildLimitSwitches()`
- `buildShaftCableHarness()`
- `buildMachineRoom()`
- `buildPitFoundation()`
- `updateBuffers()`

### `js/elevator.js`

- 카는 재공사 중: `buildCarCabin()` / `buildPassenger()`는 빈 그룹만 만든다. 원본 `js/archive/car.js`.
- 도어는 재공사 중: `buildCarDoors()` / `buildHatchDoors()`는 빈 그룹만 만든다. 원본 `js/archive/doors.js`.
- 균형추, 주 로프와 조속기 로프 갱신은 그대로다.

주요 함수:

- `buildCarCabin()`, `buildPassenger()`, `togglePassenger()` — 현재 스텁. 원본 `js/archive/car.js`
- `buildCarDoors()`, `buildHatchDoors()`, `spinDoorDrive()` — 현재 스텁. 원본 `js/archive/doors.js`
- `buildCounterWeight()`
- `buildTravelCable()`, `refreshTravelCable()`, `refreshTerminalDevices()`
- `buildWireRopes()`, `refreshRopes()`, `refreshGovernorRope()`
- `governorTrip()`, `governorReset()`
- `syncAllIndicators()`

### `js/ui.js`

- 층 운행, 도어 열림·닫힘, 자동 닫힘.
- HUD 이벤트(시트·세그먼트·전체 보기·조작 안내)와 상태 카드 갱신(`updateStatus()`).
- Web Audio 기반 기계음과 파일 음원.
- 과속 고장, 조속기 트립, 세이프티기어 정지와 복귀 시퀀스.

주요 함수:

- `openDoors()`, `closeDoors()`, `moveElevator()`
- `startOverspeedFault()`, `onGovernorOverspeed()`
- `engageDeviceStop()`, `resetGovernorFault()`
- `rescueToNearestFloor()`
- `bindUIEvents()`, `moveCam()`, `rotateGovernorTension()`

## 주요 동작 흐름

### 정상 운행

```text
층 버튼
  → moveElevator(fIdx)
  → 필요하면 도어 닫힘
  → currentState = MOVING
  → carGrp 이동 + cwtGrp 반대 이동
  → 도르래·로프·층 표시 갱신
  → 도착 차임·층 안내
  → openDoors()
```

### 도어

카문은 재공사 중이라 형상이 없다. 승장 쪽은 실·삼방틀·행거 케이스까지 올라와 있다.
`openDoors()` / `closeDoors()`는 빈 문짝 그룹과 상태만 바꾼다.
헤더 구조(양단 브라켓 → C레일, 행거판·롤러·인터록은 아직 없음)는 `docs/DOOR-REBUILD.md` 행거 케이스 계약을 따른다.

```text
openDoors() / closeDoors()
  → 카 도어 carDoorL/R (CarDoor 오퍼레이터·착상층 승장문 연동)
  → 현재 층 hatchDoors (스텁)
  → spinDoorDrive() (no-op)
```

### 과속 고장

```text
OVS 버튼
  → startOverspeedFault()
  → 낙하 속도 적분과 진자 개방
  → onGovernorOverspeed()
  → governorTrip()
  → engageDeviceStop()
  → 세이프티기어 물림과 카 급정지

RST 버튼
  → resetGovernorFault()
  → governorReset()
  → rescueToNearestFloor()
  → openDoors()
```

## 상태와 센서의 현재 수준

실제 운행은 `currentState`와 다음 상태를 사용한다.

```text
IDLE
MOVING
DOOR_OPENING
DOOR_OPEN
DOOR_CLOSING
ESTOP
```

`moving`, `doorOpen`, `estop`, `curFloor`도 운행 분기에 함께 쓰인다.

`elevatorState`의 `slowdownActive`, `limitActive`, `finalLimitActive`는 선언되어 있지만 현재 운행 FSM과 연결되지 않았다.
`landingDevices[]`와 `carSensors`도 시각적 배치·디버그 참조이며 실제 충돌 검출로 카를 감속하거나 정지시키지는 않는다.

「고장·점검」에서 실제 연결된 고장 시나리오는 OVS 과속 고장과 UCM 개문발차(`js/ucm-demo.js`)다.
동작이 연결되지 않았던 DR·SAF·탑승자 버튼은 2026-09-26 HUD 재설계에서 뺐다.

## 기능별 수정 위치

| 수정 대상 | 파일 | 주요 위치 |
|---|---|---|
| 카·도어 기준 치수 | `js/config.js` | `const S`, `CAR_DEPTH_SCALE` |
| 공통 색상·재질 | `js/config.js` | `const M` |
| 층수·층고·피트 | `index.html` | `FLOORS`, `FLOOR_Y`, `PIT`, `OVERHEAD` |
| 카 깊이 연동 Z 좌표 | `index.html` | `CAR_FRONT_Z`, `CAR_CTR_Z`, `SHAFT_BACK_Z` 등 |
| HUD 모양 | `index.html` | HTML과 `<style>` |
| 카 실내·프레임·에이프런 | `js/elevator.js` 스텁, 원본 `js/archive/car.js` | `buildCarCabin()` |
| 카 재공사 안내 | `docs/CAR-REBUILD.md` | 부품별 복원 규칙 |
| 카 도어·오퍼레이터 | `js/car-door.js`, `docs/CAR-DOOR.md` | `buildCarDoors()`, `CarDoor.pose()`, `spinDoorDrive()` |
| 승장문·헤더·페시아·토가드 | `js/elevator.js`, 원본 `js/archive/doors.js` | `buildHatchDoors()` |
| 승장 행거 케이스 | `js/elevator.js` | `createHangerCaseAssembly()` — 계약은 `docs/DOOR-REBUILD.md` |
| 도어 재공사 안내 | `docs/DOOR-REBUILD.md` | 부품별 복원 규칙 |
| 균형추 | `js/elevator.js`, 형상 `blender/scripts/counterweight.py` | `buildCounterWeight()` → `models/gltf/counterweight.glb` |
| 주 로프 | `js/elevator.js` | `buildWireRopes()`, `refreshRopes()` |
| 주 로프 바빗 히치(카·균형추) | `js/elevator.js` | `buildBabbittHitch()`, 홀 배치 `ROPE_HITCH_XZ` |
| 배경·건물 | `js/environment.js` | `buildBackground()` 계열 |
| 전면벽·로비·점자 | `js/environment.js` | `buildFrontWallAndLobby()` |
| 가이드레일 | `js/environment.js` | `buildGuideRails()` |
| 층 센서·리미트 | `js/environment.js` | `buildShaftLandingDevices()`, `buildLimitSwitches()` |
| 기계실 마스코트 「승강곰」 | `js/mascot.js` | `Mascot.build/update/setVisible`, 「설정」 「캐릭터」 토글 |
| 기계실·권상기 | `js/environment.js` | `buildMachineRoom()`, `setTractionCutaway()`, `setTractionBrake()` |
| 권상기 형상 | `blender/scripts/traction_machine.py` | 계약: `docs/TRACTION-MACHINE.md` |
| 피트·완충기 | `js/environment.js` | `buildPitFoundation()`, `updateBuffers()` |
| 조속기 형상 | `blender/scripts/overspeed_governor.py` | 상수 블록과 `build_*()` |
| 조속기 마운트 | `js/environment.js` | `buildMachineRoom()` 조속기 GLTFLoader 구간 |
| 조속기 동작 | `js/elevator.js` | `governorTrip()`, `governorReset()` |
| 과속 시퀀스·카메라 | `js/ui.js` | `startOverspeedFault()` 계열 |
| 세이프티기어 형상 | `tools/build_safety_glb.mjs` | GLB 생성 |
| 세이프티기어 마운트 | `js/archive/car.js` (현재 미로드) | `buildCarCabin()` GLTFLoader 구간 |
| 운행·도어 UI | `js/ui.js` | `bindUIEvents()`, `moveElevator()` |
| 사운드 | `js/ui.js`, `sound/` | `MACH`, `snd` |

## 조속기 데이터 경로

```text
blender/scripts/overspeed_governor.py
  → models/gltf/overspeed_governor.glb
  → js/environment.js의 buildMachineRoom()
  → GLB 노드를 빈 래퍼 Group에 mount()
  → mrGrp.userData.governor
  → js/elevator.js의 governorTrip() / governorReset()
  → js/ui.js의 과속 고장 시퀀스
```

조속기 GLB의 주요 노드 이름은 다음과 같다.

```text
Pulley
PendA
PendB
Catch
Spring
Plunger
BaseFrame
Cover
```

이 이름과 각 원점은 Three.js 애니메이션 피벗 계약이므로 함부로 바꾸면 안 된다.
Python의 `LEV_TILT`, 휠 중심, 피벗과 JavaScript의 래퍼·pose 값도 함께 확인한다.

세이프티기어는 아직 하위 호환 경로인 `assets/safety_gear.glb`를 사용한다.

## 텍스처와 에셋

- `assets/bg/logo.png`: 전면벽 지사 현판.
- `assets/bg/tactile.png`: 점형블록.
- `assets/bg/hand.png`, `lean.png`: 도어 안전 스티커. 재공사 중 화면에는 안 붙지만 파일은 유지한다. 붙임 좌표는 `docs/DOOR-REBUILD.md`.
- `assets/bg/koelsa.png`, `koelsa2.png`: 사진 배경 미리보기.
- `assets/bg/k_front.png`, `t_length.png`: 3D 배경 건물 간판.

코드에서 참조하지 않는 사진을 새로 추가할 때는 목적과 로드 위치를 함께 기록한다.

## 수정 후 확인

### 일반 JavaScript·UI 작업

1. Live Server 하드 리프레시.
2. 콘솔 오류 확인.
3. 변경 기능과 인접한 운행·도어 흐름 확인.

### Blender·GLB 작업

1. `blender/scripts/overspeed_governor.py` 실행.
2. GLB 내보내기 성공 확인.
3. 필요하면 `render_governor.py`로 정면·사선 렌더 확인.
4. Live Server에서 위치, 회전, 크기, 간극, 피벗과 트립·복귀 확인.

### 문서 작업

1. 파일과 함수 이름이 실제 코드와 일치하는지 확인.
2. 삭제된 파일 링크와 오래된 모델·버전 문구가 없는지 확인.
3. Git diff에서 런타임 파일이 의도치 않게 바뀌지 않았는지 확인.
