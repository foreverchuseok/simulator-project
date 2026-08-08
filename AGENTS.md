# AGENTS.md — KoELSA 전기식 엘리베이터 3D 시뮬레이터

이 파일은 Claude Code, Google Antigravity, Cursor가 함께 따르는 프로젝트 공통 규칙이다.
도구별 진입 파일보다 이 문서가 우선하며, 문서와 코드가 다르면 현재 코드가 우선한다.

## 1. 프로젝트 핵심

- 실행: Live Server로 `index.html`을 연다.
- 라이브러리: Three.js r128, OrbitControls, GLTFLoader, GSAP 3.12.2.
- 핵심 파일: `index.html`, `js/config.js`, `js/environment.js`, `js/elevator.js`, `js/ui.js`.
- Blender 모델: `blender/scripts/*.py`에서 생성하여 `models/gltf/*.glb`로 내보낸다.
- 상세한 파일·기능 지도는 `README.md`를 참고한다.
- Blender 작업 절차는 `blender/BLENDER-WORKFLOW.md`를 참고한다.

## 2. 실제 업무 방식

### 입력 자료

- 보통 Live Server 화면을 캡처한 뒤 색칠, 선, 원, 메모로 수정 위치를 표시한다.
- 구조·작동 원리가 복잡하면 실사, 설치도면, PDF, YouTube, 화면 녹화와 음성 설명을 함께 사용한다.
- 수정 후 Live Server에서 다시 확인하고, 캡처 또는 영상으로 부족한 부분을 설명하는 과정을 반복한다.

### 도구 사용

- 특정 모델이나 한 도구만 고정하지 않는다. 작업 난이도, 사용 한도, 자료 형식에 따라 Claude Code, Google Antigravity, Cursor를 혼용한다.
- Claude Code와 Cursor는 일반 요청에서 기존 코드를 확인한 뒤 바로 분석·수정·검증한다.
- 어느 도구든 사용자가 간단한 구현을 명시하면 직접 수행할 수 있다.
- 모델명과 요금제는 바뀔 수 있으므로 프로젝트 규칙에 고정하지 않는다.

### Google Antigravity의 분석 게이트

Google Antigravity에 영상·이미지·메커니즘 분석을 요청한 경우에는 다음 순서를 지킨다.

1. 코드를 먼저 수정하지 않는다.
2. 분석 결과를 루트 `PLAN.md`에 작성한다.
3. 사용자에게 다음 중 무엇을 할지 묻는다.
   - Antigravity가 계획대로 직접 구현한다.
   - 구현하지 않고 `PLAN.md`만 남겨 Claude Code 또는 Cursor에 전달한다.
4. 사용자 선택 전에는 구현을 시작하지 않는다.

처음부터 단순한 코드 수정을 명시한 요청은 위 분석 게이트 없이 바로 구현할 수 있다.

### PLAN.md 운영

- `PLAN.md`는 현재 작업 하나만 담는 로컬 임시 핸드오프 문서이며 Git에 올리지 않는다.
- Claude Code나 Cursor는 사용자가 `PLAN.md`를 읽으라고 명시했을 때만 해당 계획을 실행 근거로 사용한다.
- 파일이 존재한다는 이유만으로 현재 요청과 무관한 계획을 자동 실행하지 않는다.
- 계획을 구현할 때는 계획 범위만 수정하고, 불가피한 변경이 생기면 먼저 사용자에게 알린다.
- 작업 완료 후 삭제하거나 다음 작업 내용으로 교체한다.
- 기본 형식은 다음과 같다.

```markdown
# PLAN — 작업명

## 분석 결과
## 수정 대상
## 변경 내용
## 검증 방법
## 주의사항
```

## 3. 공통 작업 원칙

- 요청한 범위만 최소 수정한다. 관련 없는 리팩터링이나 기능 추가를 하지 않는다.
- 사용자가 만든 기존 변경을 되돌리지 않는다.
- 기존 구조와 함수 흐름을 먼저 읽고 수정한다.
- 오류 메시지와 실제 스택 트레이스를 확인한 뒤 원인을 수정한다.
- 불확실하면 로그나 재현 절차로 상태를 확인한다.
- 렌더 결과가 중요한 작업은 코드 성공만으로 끝내지 말고 화면에서 형상·간극·동작을 확인한다.
- 요청 없이 커밋하거나 푸시하지 않는다.

### 작업 보고

- 첫 도구 호출 전에 무엇을 할지 한 문장으로 알린다.
- 진행 중에는 중요한 발견, 방향 변경, 실제 영향이 있는 문제만 짧게 알린다.
- 완료 보고는 과정보다 결과를 먼저 말한다.
- 바뀐 파일, 확인한 동작, 남은 문제가 있으면 짧게 적는다.
- 채팅창에 긴 코드를 불필요하게 출력하지 않는다.
- 한국어 질문에는 한국어로 답하고 문장을 마침표·물음표·느낌표로 끝낸다.

## 4. 코드 구조와 데이터 규칙

### 좌표 기준

- X: 좌(-) / 우(+), 승강로 중심 `0`.
- Y: 아래(`Y0`) / 위(+), 피트 바닥 기준.
- Z: 전면(+) / 후면(-).
- 균형추는 카 후면 Z(-)에 있고 카와 반대로 움직인다.

### 치수·재질·부품 데이터

- 카·도어 치수는 `js/config.js`의 `const S`가 원본이다.
- `const S`를 바꿔야 하면 먼저 사용자에게 확인한다.
- Three.js 재질은 `js/config.js`의 `M.*`를 사용한다.
  - `M.ss()` 금속, `M.paint()` 도장, `M.conc()` 콘크리트.
  - `M.glass()` 유리, `M.emit()` 발광, `M.gold()` 골드.
- Blender 부품 치수는 각 Python 파일 상단의 상수 블록에 모은다.
- 같은 수치를 여러 파일에 독립적으로 중복 하드코딩하지 않는다. 한 원본에서 파생하거나 동기화 계약을 문서화한다.
- 긴 부품 목록은 필요하면 JSON 등 데이터 파일로 분리한다.

### 기하 생성

- 직육면체는 `createBox()`, 원통은 `createCylinder()`를 우선 사용한다.
- 회전·가동 부품은 `THREE.Group()`에 넣어 피벗을 분리한다.
- `renderLoop()` 안에서 Geometry, Mesh, Material을 새로 만들지 않는다.
- 센서 메시에는 식별 가능한 `userData`를 붙인다.
- 센서 디버그 형상은 `DEBUG_SENSOR` 조건 안에서만 표시한다.

### 안전 간극

- 승강로 부품은 `S.CAR_W / 2`, `S.CAR_D / 2` 기준으로 카와 실제 충돌 여유를 계산한다.
- 센서 도킹 Y는 정위치 카의 타격 부품 중심에서 역산한다.

```js
const deviceY = FLOOR_Y[fIdx] + S.CAR_H / 2;
```

### 상태와 동작

- 실제 운행 FSM은 `currentState`와 `ELEVATOR_STATE`가 기준이다.
- 상태: `IDLE`, `MOVING`, `DOOR_OPENING`, `DOOR_OPEN`, `DOOR_CLOSING`, `ESTOP`.
- `moving`, `doorOpen`, `estop`, `curFloor`가 현재 운행 흐름에서 함께 사용된다.
- `elevatorState`의 감속·리미트 플래그는 현재 선언만 있고 운행 FSM에는 연결되지 않았다. 구현된 센서 동작으로 오해하지 않는다.
- 기존 FSM, 도어 애니메이션, 로프 갱신, 센서 배치를 요청 없이 변경하지 않는다.

## 5. Blender·GLB 계약

- 앱이 로드하는 최종 형식은 `.glb`다.
- 신규 Blender 부품의 표준 경로는 `models/gltf/`다.
- 조속기 형상의 단일 원본은 `blender/scripts/overspeed_governor.py`다.
- 조속기 변경 후 `models/gltf/overspeed_governor.glb`를 다시 내보내야 화면에 반영된다.
- Blender 노드명과 Three.js 래퍼 이름은 애니메이션 계약이다. 이름·피벗을 임의로 바꾸지 않는다.
  - `Pulley`, `PendA`, `PendB`, `Catch`, `Spring`, `Plunger`, `BaseFrame`, `Cover`.
- Blender 좌표 변환과 Three.js 마운트 규칙은 스크립트의 `T()` 및 `js/environment.js`의 조속기 로더를 함께 확인한다.
- 조속기 트립·복귀 동작은 `js/elevator.js`의 `governorTrip()`과 `governorReset()`이 담당한다.
- Python과 JavaScript가 공유하는 각도·피벗·pose 값은 한쪽만 바꾸고 끝내지 않는다.
- Blender/Three.js/GSAP 버전은 요청 없이 변경하지 않는다.

## 6. 검증 기준

- 일반 화면 작업은 Live Server에서 하드 리프레시 후 확인한다.
- Blender 작업은 Python 실행과 GLB 내보내기 성공을 확인한다.
- 필요하면 `blender/scripts/render_governor.py`로 정면·사선 렌더를 확인한다.
- 형상 변경은 최소한 위치, 회전, 스케일, 간극, 가동부 피벗을 확인한다.
- 동작 변경은 운행, 도어, 로프, 조속기 트립·복귀 중 영향 범위를 확인한다.
- 문서만 수정한 작업은 링크, 파일명, 함수명과 Git diff를 확인한다.

## 7. 로컬 참고 자료와 임시 파일

- `Part design.pdf`: 부품 디자인 참고.
- `size.pdf`: 카·도어 치수 참고. 반영 원본은 `js/config.js`의 `const S`.
- `PLAN.md`: 현재 작업용 로컬 핸드오프.
- `.shot-*.png`, `.rv-*.png`, `.pdf-*.png`, `.claude-tmp*`: AI 검증·분석용 임시 파일.
- `temporary/`, 루트 `*.mp4`, `mobile.jpg`: 로컬 참고용. 앱이 로드하지 않으며 Git에 올리지 않는다.
- 앱 구동에 필요한 이미지는 `assets/bg/`에 있는 코드 참조 PNG만이다.
- 로컬 자료가 없을 수도 있으므로 파일 존재를 확인한 뒤 사용한다.
