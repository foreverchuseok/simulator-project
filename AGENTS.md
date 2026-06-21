# AGENTS.md — KoELSA 전기식 엘리베이터 3D 시뮬레이터

## 프로젝트 개요

- 작업 파일은 아래 멀티 파일 구조로 분리되어 있다.
- 목적은 KoELSA 경기북부지사 전기식 엘리베이터 3D 시뮬레이터 제작이다.
- 사용 라이브러리는 Three.js r128, OrbitControls, GSAP 3.12.2이다.
- 실행은 Live Server로 `index.html`을 브라우저에서 확인한다.

## 프로젝트 폴더 구성

현재 작업 폴더(`simmul`)에 존재하는 파일.

- `index.html` — HTML 뼈대 및 전역 변수, 초기화 진입점
- `js/config.js` — 도면 제원 `const S`, PBR 재질 라이브러리 `const M` 정의
- `js/environment.js` — 정적 배경 객체 (조명, 벽, 레일, 기계실, 피트 등)
- `js/elevator.js` — 동적 객체 (카, 도어, 균형추, 로프 등)
- `js/ui.js` — 엘리베이터 상태 제어 및 UI 이벤트 로직
- `디자인.pdf` — 초기 부품 디자인 참고 자료 (TK동양 시스템 구성도 31페이지)
- `logo.png` — 현판 로고 이미지
- `.cursor/rules/elevator.mdc` — Cursor AI 규칙 파일 (이 파일과 동일 내용)
- `AGENTS.md` — 이 파일 (Claude.ai 및 Claude Code용)

### 참고 영상 (최우선)

리미트 스위치, 조속기, 랜딩 디바이스 등 복잡한 부품 작업 전 반드시 실제 기계 구조를 먼저 확인할 것.

- 한국승강기안전공단 유튜브: https://youtu.be/ZjjRp3onkZs?si=ub_PiOvDpLuGE2b_

---

## 워크플로우

### 역할 분담

- **Claude.ai** — 설계 상담, 프롬프트 작성, 코드 리뷰, 이 파일 관리
- **Cursor 에디터 모드** — 좌표 미세조정, 부품 위치 수정, 눈으로 보면서 수정
- **Cursor 에이전트 모드** — 복잡한 로직, 다중 파일 동시 수정
- **Gemini** — 유튜브 영상 분석 후 부품 구조 설명 전달
- **Claude Code (터미널)** — 추후 검토, 현재 미정

### GitHub 코드 공유

Cursor 수정 → GitHub 푸시 → Claude.ai에 raw 링크 붙여넣기 → 최신 코드 기준 대화.

```
https://raw.githubusercontent.com/foreverchuseok/simulator-project/main/js/elevator.js
https://raw.githubusercontent.com/foreverchuseok/simulator-project/main/js/environment.js
https://raw.githubusercontent.com/foreverchuseok/simulator-project/main/js/config.js
https://raw.githubusercontent.com/foreverchuseok/simulator-project/main/js/ui.js
https://raw.githubusercontent.com/foreverchuseok/simulator-project/main/index.html
```

### 배포 상태

- GitHub: Public (Claude.ai raw 읽기용)
- Vercel: GitHub 연동 해제 상태 (작업 중 자동배포 차단)
- 로컬 확인: Cursor Live Server

---

## 코딩 전 필수 절차

**코드부터 짜지 않는다. 반드시 아래 순서를 따른다.**

1. 요청을 이해했는지 먼저 확인한다.
2. 불확실한 부분이 있으면 짜기 전에 질문한다.
3. 해석이 여러 가지일 경우 선택지를 제시하고 사용자가 고르게 한다.
4. 더 단순한 방법이 있으면 먼저 말한다.
5. 비자명한 작업은 수정 전 간단한 계획을 먼저 제시한다.

```
예시.
1. js/elevator.js — buildMachineRoom() 내 조속기 블록 위치 확인
2. js/environment.js — tensGuard 회전 보정 수정
3. js/elevator.js — pitGrp에 추가 확인
```

---

## 역할

- 이 프로젝트의 코드 수정 실행자다.
- 사용자의 설명, 화면 캡처, PDF 부품 디자인 자료를 참고해 해당 파일을 부분 수정한다.
- 좌표, 부품 위치, 재질, 그룹 구조를 임의로 크게 바꾸지 않는다.
- 기존 구조를 먼저 읽고, 필요한 함수 블록만 최소 범위로 수정한다.

---

## 절대 금지

- 각 파일(`index.html`, `config.js`, `environment.js`, `elevator.js`, `ui.js`) 전체 재출력 절대 금지.
- CSS 불필요 수정 금지.
- Three.js / OrbitControls / GSAP 버전 변경 금지.
- 전역 도면 제원 `const S = { ... }` 값 임의 수정 금지.
- 사용자가 만들었거나 이미 적용된 변경을 되돌리지 않는다.
- 관련 없는 리팩터링 금지.
- 함수 전체 삭제 금지.
- 기존 애니메이션 흐름 임의 변경 금지.
- 요청하지 않은 기능 추가 금지.
- 요청하지 않은 유연성, 확장성 코드 추가 금지.

---

## 수정 범위 원칙

**요청한 것만 건드린다. 인접 코드는 절대 손대지 않는다.**

- 기존 코드 스타일, 주석, 포맷을 그대로 유지한다.
- 내 수정으로 생긴 불필요한 변수만 정리한다.
- 기존의 불필요해 보이는 코드는 삭제하지 말고 사용자에게 알린다.
- 변경된 모든 줄은 사용자 요청과 직접 연결되어야 한다.

---

## 응답 형식

수정 요청 시 반드시 아래 순서로 응답한다.

```
[수정 목적]
어떤 부품을 왜 수정하는지 한 줄 설명.

[수정 위치]
파일명 / 함수명 / 대략적인 줄 번호.
예. js/elevator.js — buildMachineRoom() 약 862~920줄 내 tensGuard 블록.

[수정 코드]
변경 전/후를 명확히 구분하여 해당 블록만 제시.

[주의사항]
좌표 충돌, 재질 주의점 등 있을 경우 명시.
```

---

## 좌표 기준

- X축. 좌(-) / 우(+), 승강로 중심은 `0`.
- Y축. 아래(0 = `Y0`) / 위(+), 피트 바닥 기준.
- Z축. 전면(+) / 후면(-).
- 카 후면은 `CAR_BACK_Z`.
- 균형추는 항상 카 후면, Z 마이너스 방향에 위치한다.
- 카와 균형추는 반대 방향으로 움직인다.

### 센서 도킹 좌표 규칙

- 승강로(레일) 측 센서·스위치의 Y축 높이는 층 바닥(`FLOOR_Y`) 기준으로 단순 배치하지 않는다.
- **"카가 해당 층에 정위치했을 때, 카에 부착된 타격 부품(차폐판, 캠 등)의 중심 Y 좌표"** 를 먼저 계산하고, 그 값에 승강로 측 센서를 역산하여 맞춘다.

```js
// 카 중심 Y = FLOOR_Y[i] + S.CAR_H / 2
// 캠 중심 Y = 카 중심 Y + 카 로컬 캠 오프셋
// 스위치 트리거 Y = 캠 중심 Y (롤러 리프트 보정 포함)
const deviceY = FLOOR_Y[fIdx] + S.CAR_H / 2;
```

---

## 재질 규칙

새 부품은 기존 재질 함수를 우선 사용한다. 재질 정의는 `js/config.js`에 있다.

- `M.ss()` → 스테인리스/금속
- `M.paint()` → 도장 부품
- `M.conc()` → 콘크리트
- `M.glass()` → 유리
- `M.emit()` → 발광 표시
- `M.gold()` → 골드 포인트

추가 규칙.

- 새 색상이 필요하면 `M.paint(0xHEXCODE)` 형식을 사용한다.
- 투명 부품은 `transparent: true`와 `opacity`를 명시한다.
- 재질 임의 신규 생성을 최소화한다.

---

## 생성 함수 규칙

- 직육면체는 `createBox(...)` 우선 사용.
- 원통은 `createCylinder(...)` 우선 사용.
- 복잡한 회전체나 표식은 Three.js 기본 Geometry 사용 가능.
- 회전 부품은 반드시 `THREE.Group()`에 묶는다.
- 보호커버처럼 고정되어야 하는 부품은 상위 고정 그룹에 둔다.

### 데이터 라벨링 (필수)

- 모든 동적·센서 메시 생성 시 반드시 `userData`로 이름표를 부착한다.

```js
mesh.userData = { type: 'limit-switch', floor: fIdx, function: 'slowdown' };
```

### 디버그 시각화 (필수)

- 센서·충돌 처리가 필요한 객체는 생성 시 반드시 `if (DEBUG_SENSOR)` 블록을 함께 작성한다.

```js
if (DEBUG_SENSOR) {
  mesh.add(new THREE.BoxHelper(mesh, 0x00ff44));
  mesh.add(new THREE.AxesHelper(0.1));
}
```

### 안전 간극 (Clearance)

- 승강로 측 부품은 카 외곽선(`S.CAR_W / 2`, `S.CAR_D / 2`) 기준으로 실제 현장과 같은 충돌 여유 공간을 계산하여 배치한다.
- 간극 없이 카에 바짝 붙이지 않는다.

---

## Geometry 최적화 규칙

- 반복 생성되는 BoxGeometry/CylinderGeometry는 가능하면 재사용한다.
- renderLoop 내부에서 Geometry 생성 금지.
- renderLoop 내부에서 `new THREE.Mesh()` 생성 금지.
- renderLoop 내부에서 Material 생성 금지.
- 불필요한 shadow 설정 금지.

---

## 애니메이션 규칙

- 이동 애니메이션은 GSAP 우선 사용한다.
- renderLoop에서는 위치 동기화 및 회전만 처리한다.
- 이동 중 직접 `position` 값을 반복 덮어쓰지 않는다.
- 카 이동 시 균형추 및 로프를 함께 동기화한다.
- 급격한 위치 순간이동 방식 금지.

---

## 상태관리 규칙

- moving, doorOpen, estop 같은 상태는 임의 추가하지 않는다.
- 신규 상태는 상태 변수 영역에만 추가한다.
- 상태 충돌 가능성을 먼저 확인한다.

### 예상 상태 (FSM)

```js
IDLE / MOVING / LEVELING / DOOR_OPENING / DOOR_OPEN / DOOR_CLOSING / INSPECTION / FAULT / EMERGENCY_STOP
```

### 물리 센서 상태 객체

```js
elevatorState = {
  direction:        '',       // 'up' | 'down' | ''
  speed:            0,        // m/min
  targetFloor:      0,
  slowdownActive:   false,    // 감속 리미트 스위치 작동 여부
  limitActive:      false,    // 리미트 스위치 작동 여부
  finalLimitActive: false     // 파이널 리미트 스위치 작동 여부
};
```

---

## 오류 발생 시 처리 원칙

- 오류 메시지 전체를 읽는다. 키워드만 보고 짐작하지 않는다.
- 실제 스택 트레이스를 확인한 후 수정한다.
- 원인 확인 전 흔한 수정을 먼저 적용하지 않는다.
- 불확실하면 `console.log`로 상태를 먼저 확인하고 수정한다.

---

## 한국어 출력 규칙

- 사용자가 한국어로 쓰면 응답도 한국어로 한다.
- 한국어 문장은 마침표, 물음표, 느낌표로 끝낸다.
- 콜론으로 한국어 문장을 끝내지 않는다.
- 코드, key-value, 레이블 내부의 콜론은 허용한다.