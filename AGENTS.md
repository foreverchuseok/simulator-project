# AGENTS.md — KoELSA 전기식 엘리베이터 3D 시뮬레이터

## 프로젝트 개요

- 멀티 파일 구조: `index.html`, `js/config.js`, `js/environment.js`, `js/elevator.js`, `js/ui.js`
- 라이브러리: Three.js r128, OrbitControls, GSAP 3.12.2
- 실행: Live Server → `index.html`
- GitHub: `foreverchuseok/simulator-project` (Public)

---

## 워크플로우

### 역할 분담

| 도구 | 역할 |
|------|------|
| **Claude Code (터미널)** | Plan Mode 전용. 파일·이미지 분석 후 Cursor용 프롬프트 생성. 직접 코드 수정 금지. |
| **Cursor Composer 2.5 Fast** | Claude Code가 만든 프롬프트 받아 실행. |
| **Claude.ai** | 설계 자문, 이미지·PDF 분석, 프롬프트 검토. raw 링크로 코드 공유. |
| **Gemini** | 유튜브 영상 분석 후 부품 구조 설명 생성. Claude Code에 전달. |

### 작업 흐름

```
스크린샷 (Win+Shift+S) → 터미널 Ctrl+V
      ↓
Claude Code (Plan Mode) — 분석 + Cursor 프롬프트 생성
      ↓
Cursor Composer — 프롬프트 받아 코드 수정
      ↓
Live Server — 결과 확인
      ↓
GitHub 푸시
```

### Claude Code 고정 명령어

```
Plan Mode로 이 화면 분석해줘.
코드 수정하지 말고.
Cursor 채팅창에 붙여넣을 프롬프트만 만들어줘.
파일명, 함수명, 줄번호 반드시 명시해줘.
```

### GitHub raw 링크 (Claude.ai 자문용)

```
https://raw.githubusercontent.com/foreverchuseok/simulator-project/main/js/elevator.js
https://raw.githubusercontent.com/foreverchuseok/simulator-project/main/js/environment.js
https://raw.githubusercontent.com/foreverchuseok/simulator-project/main/js/config.js
https://raw.githubusercontent.com/foreverchuseok/simulator-project/main/js/ui.js
https://raw.githubusercontent.com/foreverchuseok/simulator-project/main/index.html
```

---

## 절대 금지

- 파일 전체 재출력 금지.
- `const S` 값 임의 수정 금지.
- Three.js / OrbitControls / GSAP 버전 변경 금지.
- 관련 없는 리팩터링, 함수 삭제, 기존 애니메이션 흐름 변경 금지.
- 요청하지 않은 기능 추가 금지.
- 사용자가 만든 변경 되돌리기 금지.

---

## 수정 원칙

- 요청한 것만 건드린다. 인접 코드 손대지 않는다.
- 기존 코드 스타일·주석·포맷 그대로 유지.
- 불필요해 보이는 코드는 삭제하지 말고 사용자에게 알린다.

---

## 응답 형식

```
[분석 결과] 어떤 파일의 어떤 부분이 문제인지 한 줄.

[Cursor용 프롬프트]
파일명 / 함수명 / 줄번호
변경 전 → 변경 후 블록만 제시.

[주의사항] 있을 경우만 명시.
```

---

## 좌표 기준

- X: 좌(-) / 우(+), 승강로 중심 `0`
- Y: 아래(`Y0`) / 위(+), 피트 바닥 기준
- Z: 전면(+) / 후면(-)
- 균형추: 카 후면 Z(-) 방향, 카와 반대로 이동

### 센서 도킹 규칙

승강로 측 센서 Y = 카 정위치 시 타격 부품 중심 Y 역산.

```js
const deviceY = FLOOR_Y[fIdx] + S.CAR_H / 2;
```

---

## 재질 규칙 (`js/config.js`)

- `M.ss()` 금속 / `M.paint()` 도장 / `M.conc()` 콘크리트
- `M.glass()` 유리 / `M.emit()` 발광 / `M.gold()` 골드
- 새 색상: `M.paint(0xHEXCODE)`
- 투명: `transparent: true` + `opacity` 명시

---

## 생성 규칙

- 직육면체: `createBox()` / 원통: `createCylinder()`
- 회전 부품: `THREE.Group()` 필수
- renderLoop 내 Geometry·Mesh·Material 생성 금지
- 센서 메시: `userData` 필수 부착
- 충돌 객체: `if (DEBUG_SENSOR)` 블록 필수

---

## 상태 (FSM)

```js
IDLE / MOVING / LEVELING / DOOR_OPENING / DOOR_OPEN / DOOR_CLOSING / INSPECTION / FAULT / EMERGENCY_STOP

elevatorState = { direction:'', speed:0, targetFloor:0,
  slowdownActive:false, limitActive:false, finalLimitActive:false };
```

---

## 에셋 참조

- 부품 디자인: 상위 폴더 `Part design.pdf` 최우선 → 없으면 `디자인.pdf`
- 카·도어 치수: 상위 폴더 `size.pdf` 기준 → `const S`에 반영
- `const S` 변경 필요 시 사용자에게 먼저 확인

---

## 한국어 출력 규칙

- 한국어로 질문하면 한국어로 답한다.
- 문장은 마침표·물음표·느낌표로 끝낸다. 콜론으로 끝내지 않는다.