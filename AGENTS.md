# AGENTS.md — KoELSA 전기식 엘리베이터 3D 시뮬레이터

## 프로젝트 개요

- 멀티 파일 구조: `index.html`, `js/config.js`, `js/environment.js`, `js/elevator.js`, `js/ui.js`
- 라이브러리: Three.js r128, OrbitControls, GSAP 3.12.2
- 실행: Live Server → `index.html`
- GitHub: `foreverchuseok/simulator-project` (Public)

---

## 워크플로우 (공통)

### 역할 분담

| 도구 | 역할 |
|------|------|
| **Cursor Composer 2.5 Fast** | **메인 실행자.** 스크린샷·설명 기반 세부 조정, 좌표·방향·재질 수정, 반복 작업 전부 이걸로 처리. |
| **Claude.ai** | 설계 자문, 스크린샷·PDF 분석, Cursor에 붙여넣을 프롬프트 작성. raw 링크로 코드 확인. |
| **Claude Code (터미널)** | **큰 구조 작업 전용.** 새 부품 전체 신설, 여러 파일 동시 로직(FSM, 충돌감지 등)일 때만 호출. 일반 세부 조정에는 쓰지 않는다. |
| **Gemini** | 유튜브 영상 분석 후 부품 구조 설명 생성. |

### 일반 작업 흐름 (기본, 대부분의 경우)

```
스크린샷 (Win+Shift+S) → Claude.ai에 업로드 + 설명
      ↓
Claude.ai — 분석 + Cursor용 프롬프트 작성 (채팅으로 바로 답)
      ↓
Cursor Composer — 프롬프트 받아 코드 수정
      ↓
Live Server — 결과 확인
      ↓
GitHub 푸시
```

### 큰 작업 흐름 (Claude Code, 선택적)

파일 여러 개를 동시에 뜯어고쳐야 하는 작업(예: 새 안전장치 전체 로직, 대규모 리팩터링)만 아래 방식을 쓴다. 일반 세부 조정에는 쓰지 않는다.

```
Claude Code (Plan Mode) — 분석 + PLAN.md 생성
      ↓
Cursor Composer — @PLAN.md 참조해서 코드 수정
      ↓
Live Server 확인 → GitHub 푸시 → PLAN.md 삭제
```

---

# 1. 공통 규칙 (Cursor · Claude Code · Claude.ai 모두 적용)

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

## 재질 규칙 (`js/config.js`)

- `M.ss()` 금속 / `M.paint()` 도장 / `M.conc()` 콘크리트
- `M.glass()` 유리 / `M.emit()` 발광 / `M.gold()` 골드
- 새 색상: `M.paint(0xHEXCODE)`
- 투명: `transparent: true` + `opacity` 명시

## 생성 규칙

- 직육면체: `createBox()` / 원통: `createCylinder()`
- 회전 부품: `THREE.Group()` 필수
- renderLoop 내 Geometry·Mesh·Material 생성 금지
- 센서 메시: `userData` 필수 부착
- 충돌 객체: `if (DEBUG_SENSOR)` 블록 필수

### 안전 간극 (Clearance)

- 승강로 측 부품은 카 외곽선(`S.CAR_W / 2`, `S.CAR_D / 2`) 기준으로 실제 현장과 같은 충돌 여유 공간을 계산하여 배치한다.
- 간극 없이 카에 바짝 붙이지 않는다.

## 상태 (FSM)

```js
IDLE / MOVING / LEVELING / DOOR_OPENING / DOOR_OPEN / DOOR_CLOSING / INSPECTION / FAULT / EMERGENCY_STOP

elevatorState = { direction:'', speed:0, targetFloor:0,
  slowdownActive:false, limitActive:false, finalLimitActive:false };
```

## 에셋 참조

- 부품 디자인: 상위 폴더 `Part design.pdf` 최우선 → 없으면 `디자인.pdf`
- 카·도어 치수: 상위 폴더 `size.pdf` 기준 → `const S`에 반영
- `const S` 변경 필요 시 사용자에게 먼저 확인

## 오류 발생 시 처리 원칙

- 오류 메시지 전체를 읽는다. 키워드만 보고 짐작하지 않는다.
- 실제 스택 트레이스를 확인한 후 수정한다.
- 원인 확인 전 흔한 수정을 먼저 적용하지 않는다.
- 불확실하면 `console.log`로 상태를 먼저 확인하고 수정한다.

## 한국어 출력 규칙

- 한국어로 질문하면 한국어로 답한다.
- 문장은 마침표·물음표·느낌표로 끝낸다. 콜론으로 끝내지 않는다.

---

# 2. Cursor 전용 지침 (메인 실행자)

> 이 섹션은 Cursor Composer에만 적용된다. 대부분의 작업이 여기서 처리된다.

## 역할

- 이 프로젝트의 **주 코드 수정 실행자**다.
- 사용자가 스크린샷이나 Claude.ai가 작성한 프롬프트를 붙여넣으면 그대로 실행한다.
- `@PLAN.md`가 첨부된 경우에만 그 계획서 내용을 따른다.
- 좌표, 부품 위치, 재질, 그룹 구조를 임의로 크게 바꾸지 않는다.
- 기존 구조를 먼저 읽고, 필요한 함수 블록만 최소 범위로 수정한다.

## 절대 금지

- 파일 전체 재출력 금지.
- `const S` 값 임의 수정 금지.
- Three.js / OrbitControls / GSAP 버전 변경 금지.
- 관련 없는 리팩터링, 함수 삭제, 기존 애니메이션 흐름 변경 금지.
- 요청하지 않은 기능 추가 금지.
- 사용자가 만든 변경 되돌리기 금지.

## 수정 원칙

- 요청한 것만 건드린다. 인접 코드 손대지 않는다.
- 기존 코드 스타일·주석·포맷 그대로 유지.
- 불필요해 보이는 코드는 삭제하지 말고 사용자에게 알린다.

---

# 3. Claude Code 전용 지침 (큰 작업 전용, 선택적 호출)

> 이 섹션은 Claude Code(터미널) 호출 시에만 적용된다. 일반 세부 조정에는 이 섹션을 쓰지 않는다.

## 언제 부르는가

- 새 부품·기능을 처음부터 통째로 신설할 때 (예: 조속기 전체 로직, 새 안전장치 모듈)
- `elevator.js` + `ui.js` + `index.html` 등 3개 이상 파일을 동시에 뜯어고쳐야 할 때
- 그 외 세부 방향·좌표·재질 조정은 Cursor로 직접 처리한다.

## 역할

- Plan Mode 전용 분석가다. 코드를 직접 수정하지 않는다.
- 분석 결과를 **`PLAN.md` 파일로 저장**한다.
- 채팅창에 프롬프트 텍스트를 길게 출력하지 않는다. `PLAN.md` 작성 완료 여부만 짧게 보고한다.

## 고정 명령어

```
Plan Mode로 분석해줘. 코드 수정하지 말고.
분석 결과를 PLAN.md 파일로 저장해줘.
파일명, 함수명, 줄번호 반드시 명시해줘.
```

## PLAN.md 작성 형식

```markdown
# PLAN — [작업명] ([날짜])

## 분석 결과
## 수정 대상 (파일명 / 함수명 / 줄번호)
## 변경 내용 (변경 전 → 변경 후)
## 주의사항
```

## 완료 후 보고 형식

```
[분석 완료] PLAN.md 파일에 저장했습니다.
Cursor에서 @PLAN.md 참조해서 실행하세요.
```

## PLAN.md 관리

- `PLAN.md`는 `.gitignore`에 등록되어 GitHub에 올라가지 않는다.
- 작업 완료 후 삭제하거나 덮어쓴다. 다음 작업과 섞이지 않도록 매번 초기화한다.
