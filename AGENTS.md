# AGENTS.md — KoELSA 전기식 엘리베이터 3D 시뮬레이터

## 프로젝트 개요

- 멀티 파일 구조: `index.html`, `js/config.js`, `js/environment.js`, `js/elevator.js`, `js/ui.js`
- 라이브러리: Three.js r128, OrbitControls, GSAP 3.12.2
- 실행: Live Server → `index.html`
- GitHub: `foreverchuseok/simulator-project` (Public)
- 기하 헬퍼: `createBox()`, `createCylinder()` — `index.html`에 정의

---

## 워크플로우

### 역할 분담

| 도구 | 역할 |
|------|------|
| **Claude Code — Fable 5 (Plan)** | 계획 담당. 스크린샷·PDF·파일 분석 후 `PLAN.md` 작성. 코드는 짜지 않는다. |
| **Claude Code — Sonnet 4.6 (실행)** | 실행 담당. `PLAN.md`대로 실제 코드 작성. |
| **Cursor** | 세부 위치 이동만. `position.set`·`rotation` 좌표값 옮기는 정도의 아주 쉬운 조정만. |

### 기본 작업 흐름 (토큰 절약형)

```
① /model → Fable 5 선택, Plan Mode(Shift+Tab)
   스크린샷·PDF 주고 "PLAN.md로 계획만 저장해줘"
        ↓
② /model → Sonnet 4.6 전환
   "PLAN.md 보고 코드 작성해줘"
        ↓
③ Live Server 확인
        ↓
④ 미세한 위치 이동만 필요하면 Cursor로
        ↓
⑤ GitHub 푸시 → PLAN.md 삭제
```

핵심: 비싼 판단(계획)은 Fable, 단순 실행(코딩)은 Sonnet. 계획이 정확하면 Sonnet 실행으로 충분하다.

---

# 1. 공통 규칙

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

- 직육면체: `createBox()` / 원통: `createCylinder()` (`index.html`)
- 회전 부품: `THREE.Group()` 필수
- renderLoop 내 Geometry·Mesh·Material 생성 금지
- 센서 메시: `userData` 필수 부착
- 충돌 객체: `if (DEBUG_SENSOR)` 블록 필수

### 안전 간극 (Clearance)

- 승강로 측 부품은 카 외곽선(`S.CAR_W / 2`, `S.CAR_D / 2`) 기준으로 실제 현장과 같은 충돌 여유 공간을 계산하여 배치한다.
- 간극 없이 카에 바짝 붙이지 않는다.

## 상태 (FSM)

`index.html` · `js/ui.js` 기준. 문서와 코드가 다르면 **코드가 우선**이다.

```js
// currentState — ELEVATOR_STATE (index.html)
IDLE / MOVING / DOOR_OPENING / DOOR_OPEN / DOOR_CLOSING / ESTOP

// elevatorState — 물리·센서 플래그 (index.html)
elevatorState = {
  direction: 0,
  speed: 0,
  slowdownActive: false,
  limitActive: false,
  finalLimitActive: false
};
```

## 에셋 참조

- 부품 디자인: 프로젝트 루트 `Part design.pdf`
- 카·도어 치수: 프로젝트 루트 `size.pdf` → `const S`(`js/config.js`)에 반영
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

# 2. Fable 5 (Plan) 전용 지침

> Plan Mode로 계획만 세운다. 코드를 직접 수정하지 않는다.

## 역할

- 스크린샷·PDF·파일을 분석하고 결과를 `PLAN.md` 파일로 저장한다.
- 채팅창에 긴 코드를 출력하지 않는다. `PLAN.md` 저장 완료만 짧게 보고한다.

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
Sonnet 4.6에서 PLAN.md 보고 코드 작성하세요.
```

---

# 3. Sonnet 4.6 (실행) 전용 지침

> `PLAN.md`대로 실제 코드를 작성한다.

## 역할

- `PLAN.md`에 적힌 내용만 그대로 구현한다.
- 계획서에 없는 내용은 추가하지 않는다.
- 기존 구조를 먼저 읽고, 필요한 함수 블록만 최소 범위로 수정한다.

## 고정 명령어

```
PLAN.md 보고 코드 작성해줘.
계획서에 없는 내용은 추가하지 마.
```

## 절대 금지

- 파일 전체 재출력 금지.
- `const S` 값 임의 수정 금지.
- Three.js / OrbitControls / GSAP 버전 변경 금지.
- 관련 없는 리팩터링, 함수 삭제, 기존 애니메이션 흐름 변경 금지.
- 요청하지 않은 기능 추가 금지.
- 사용자가 만든 변경 되돌리기 금지.
- `PLAN.md`에 없는 내용 임의 추가 금지.

## 수정 원칙

- 요청한 것만 건드린다. 인접 코드 손대지 않는다.
- 기존 코드 스타일·주석·포맷 그대로 유지.
- 불필요해 보이는 코드는 삭제하지 말고 사용자에게 알린다.

---

# 4. Cursor 전용 지침 (세부 위치 이동만)

> Cursor는 이미 만들어진 부품의 위치를 옮기는 정도의 아주 쉬운 작업만 한다.

- `position.set()`, `rotation` 좌표값 조정 정도만 처리한다.
- 새 부품 생성, 재질 변경, 복잡한 로직은 Cursor에 맡기지 않는다.
- `@PLAN.md`가 첨부된 경우에도 Sonnet 4.6 실행 범위에 해당하면 Cursor는 좌표 미세 조정만 한다.
- 요청한 좌표만 수정하고 인접 코드는 손대지 않는다.

---

## PLAN.md 관리

- `PLAN.md`는 `.gitignore`에 등록되어 GitHub에 올라가지 않는다.
- 작업 완료 후 삭제하거나 덮어쓴다. 다음 작업과 섞이지 않도록 매번 초기화한다.

## 임시 파일 (로컬 전용)

- `.shot-*.png`, `.rv-*.png`, `.pdf-*.png`, `.claude-tmp-shot*.js` — AI 캡처·PDF 추출용. `.gitignore` 등록됨. 앱 실행에 불필요.
