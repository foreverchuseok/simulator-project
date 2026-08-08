# KoELSA 전기식 엘리베이터 3D 시뮬레이터

한국승강기안전공단 교육·시연용 전기식 엘리베이터 3D 시뮬레이터다.
Three.js로 승강로, 카, 도어, 기계실, 피트와 안전장치를 구성하고 GSAP으로 운행·도어·고장 동작을 연출한다.

문서와 코드가 다르면 현재 코드가 기준이다.

## 빠른 시작

1. 프로젝트 루트에서 Live Server로 `index.html`을 연다.
2. 화면의 층 버튼, 도어 버튼, 속도 선택, 카메라 메뉴와 고장 메뉴를 사용한다.
3. 코드나 GLB를 바꾼 뒤 브라우저에서 하드 리프레시한다.

앱은 CDN의 Three.js r128, OrbitControls, GLTFLoader와 GSAP 3.12.2를 사용한다.
`npm`은 Playwright 등 로컬 검증 도구용이며 앱 실행 자체에는 필요하지 않다.

## 문서 안내

- `AGENTS.md`: Claude Code, Google Antigravity, Cursor가 따르는 공통 규칙.
- `CLAUDE.md`: Claude Code 진입점.
- `GEMINI.md`: Google Antigravity 진입점과 영상·이미지 분석 게이트.
- `blender/BLENDER-WORKFLOW.md`: Blender Python에서 GLB를 만들고 연결하는 절차.
- `PLAN.md`: 현재 분석 작업 하나를 넘기는 로컬 임시 문서. Git에는 포함하지 않는다.

## 실제 프로젝트 구조

```text
simmul/
├─ index.html                     앱 진입점, HTML/CSS/HUD, 전역 상태, 초기화, 렌더 루프
├─ js/
│  ├─ config.js                   카·도어 치수와 공통 재질
│  ├─ environment.js              배경, 승강로, 센서, 기계실, 피트, 조속기 마운트
│  ├─ elevator.js                 카, 도어, 균형추, 로프, 세이프티기어, 조속기 동작
│  └─ ui.js                       운행, 도어, HUD, 사운드, 과속 고장 시퀀스
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
  → buildLimitSwitches()
  → buildMachineRoom()
  → buildCarCabin()
  → buildPassenger()
  → buildCarDoors()
  → buildHatchDoors()
  → buildCounterWeight()
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
- `?mrcam`, `?doorcam=1~4`, `?govcam` 카메라 확인 쿼리.

### `js/config.js`

- `const S`: 카, 도어, 승강로 관련 기준 치수.
- `CAR_DEPTH_SCALE`: 카 깊이 연동 스케일.
- `const M`: 금속, 도장, 콘크리트, 유리, 발광 등 공통 재질 팩토리.

`const S`는 여러 좌표의 기준이므로 수정 전에 사용자 확인이 필요하다.

### `js/environment.js`

- 조명과 배경 지형·건물.
- 전면벽, 로비, 점자블록.
- 가이드레일, 층 인식 장치, 리미트 스위치.
- 기계실, 권상기, 주도르래와 조속기 GLB 마운트.
- 피트, 완충기, 인장시브와 조속기 로프 기반 형상.
- 조속기 래퍼와 `mrGrp.userData.governor` 계약.

주요 함수:

- `buildLighting()`
- `buildBackground()`
- `buildFrontWallAndLobby()`
- `buildGuideRails()`
- `buildShaftLandingDevices()`
- `buildLimitSwitches()`
- `buildMachineRoom()`
- `buildPitFoundation()`
- `updateBuffers()`

### `js/elevator.js`

- 카 프레임·실내·플랫폼과 승객.
- 카 도어, 승장문, 도어 오퍼레이터·인터록.
- 균형추, 주 로프와 조속기 로프 갱신.
- `assets/safety_gear.glb` 로드와 세이프티기어 참조.
- 조속기 트립·복귀 애니메이션.

주요 함수:

- `buildCarCabin()`, `buildPassenger()`, `togglePassenger()`
- `buildCarDoors()`, `buildHatchDoors()`, `spinDoorDrive()`
- `buildCounterWeight()`
- `buildWireRopes()`, `refreshRopes()`, `refreshGovernorRope()`
- `governorTrip()`, `governorReset()`
- `syncAllIndicators()`

### `js/ui.js`

- 층 운행, 도어 열림·닫힘, 자동 닫힘.
- HUD 이벤트와 카메라 프리셋.
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

```text
openDoors() / closeDoors()
  → 카 도어 carDoorL/R
  → 현재 층 hatchDoors
  → 인터록 hook / triKey
  → spinDoorDrive()
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

고장 메뉴 중 현재 실제 연결된 핵심 시나리오는 OVS 과속 고장이다.
다른 메뉴 표시는 구현 완료 기능으로 간주하지 않는다.

## 기능별 수정 위치

| 수정 대상 | 파일 | 주요 위치 |
|---|---|---|
| 카·도어 기준 치수 | `js/config.js` | `const S`, `CAR_DEPTH_SCALE` |
| 공통 색상·재질 | `js/config.js` | `const M` |
| 층수·층고·피트 | `index.html` | `FLOORS`, `FLOOR_Y`, `PIT`, `OVERHEAD` |
| 카 깊이 연동 Z 좌표 | `index.html` | `CAR_FRONT_Z`, `CAR_CTR_Z`, `SHAFT_BACK_Z` 등 |
| HUD 모양 | `index.html` | HTML과 `<style>` |
| 카 실내·프레임 | `js/elevator.js` | `buildCarCabin()` |
| 카 도어·오퍼레이터 | `js/elevator.js` | `buildCarDoors()`, `spinDoorDrive()` |
| 승장문·인터록 | `js/elevator.js` | `buildHatchDoors()` |
| 균형추 | `js/elevator.js` | `buildCounterWeight()` |
| 주 로프 | `js/elevator.js` | `buildWireRopes()`, `refreshRopes()` |
| 배경·건물 | `js/environment.js` | `buildBackground()` 계열 |
| 전면벽·로비·점자 | `js/environment.js` | `buildFrontWallAndLobby()` |
| 가이드레일 | `js/environment.js` | `buildGuideRails()` |
| 층 센서·리미트 | `js/environment.js` | `buildShaftLandingDevices()`, `buildLimitSwitches()` |
| 기계실·권상기 | `js/environment.js` | `buildMachineRoom()` |
| 피트·완충기 | `js/environment.js` | `buildPitFoundation()`, `updateBuffers()` |
| 조속기 형상 | `blender/scripts/overspeed_governor.py` | 상수 블록과 `build_*()` |
| 조속기 마운트 | `js/environment.js` | `buildMachineRoom()` 조속기 GLTFLoader 구간 |
| 조속기 동작 | `js/elevator.js` | `governorTrip()`, `governorReset()` |
| 과속 시퀀스·카메라 | `js/ui.js` | `startOverspeedFault()` 계열 |
| 세이프티기어 형상 | `tools/build_safety_glb.mjs` | GLB 생성 |
| 세이프티기어 마운트 | `js/elevator.js` | `buildCarCabin()` GLTFLoader 구간 |
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
- `assets/bg/hand.png`, `lean.png`: 도어 안전 스티커.
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
