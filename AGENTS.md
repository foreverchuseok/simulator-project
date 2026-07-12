# AGENTS.md — KoELSA 전기식 엘리베이터 3D 시뮬레이터

## 프로젝트 개요

- 멀티 파일 구조: `index.html`, `js/config.js`, `js/environment.js`, `js/elevator.js`, `js/ui.js`
- 라이브러리: Three.js r128, OrbitControls, GSAP 3.12.2
- 실행: Live Server → `index.html`
- GitHub: `foreverchuseok/simulator-project` (Public)
- 기하 헬퍼: `createBox()`, `createCylinder()` — `index.html`에 정의

---

## 워크플로우

터미널을 **2개** 연다. 하나는 **Claude Code**, 다른 하나는 **Google Antigravity**. 코딩은 **Cursor (Grok 4.5 Fast)** 가 담당한다.

### 역할 분담

| 도구 | 정확한 명칭 | 역할 |
|------|-------------|------|
| **Claude Code** | 모델 **Claude Fable 5** (`claude-fable-5`, `/model` → Fable) | 스크린샷·PDF·파일 분석 후 `PLAN.md` 작성. 코드는 짜지 않는다. |
| **Google Antigravity** | 제품명 **Google Antigravity** (약칭 Antigravity; “Gravity”가 아님) | YouTube·동영상·메커니즘 영상 분석에 강점. 분석 결과를 `PLAN.md`로 저장. 코드는 짜지 않는다. |
| **Cursor** | 모델 **Grok 4.5 Fast** (Cursor에서 Grok 4.5 Fast / High 계열로 선택) | `PLAN.md`를 보고 **코드 작성·수정**. 좌표 미세 조정도 여기서 처리. |

### 기본 작업 흐름

```
① [터미널 A] Claude Code → Claude Fable 5
   스크린샷·PDF·파일 분석 → PLAN.md 저장
        또는
   [터미널 B] Google Antigravity
   YouTube·승강기 메커니즘 동영상 분석 → PLAN.md 저장
        ↓
② [Cursor] Grok 4.5 Fast
   "PLAN.md 보고 코드 작성해줘" (계획서에 없는 내용 추가 금지)
        ↓
③ Live Server 확인
        ↓
④ 필요 시 Cursor에서 position/rotation만 미세 조정
        ↓
⑤ GitHub 푸시 → PLAN.md 삭제(또는 덮어쓰기)
```

핵심:
- **계획(Plan)** = Claude Code(Fable 5) 또는 Google Antigravity → 산출물은 항상 `PLAN.md`.
- **실행(Code)** = Cursor Grok 4.5 Fast.
- 영상·동작 메커니즘 파악은 Antigravity, 도면·캡처·PDF는 Claude Code(Fable 5)를 우선한다.

### 명칭 검증 (혼동 방지)

| 잘못된 말 | 올바른 표기 |
|-----------|-------------|
| 페이블 / fable5 (모호) | **Claude Fable 5** (`claude-fable-5`) |
| 그래비티 / Gravity | **Google Antigravity** |
| Cursor Grok high fast (비공식) | Cursor에서 **Grok 4.5 Fast** (필요 시 High thinking 설정) |
| Sonnet으로 코드 실행 (구 워크플로) | 현재는 **Cursor Grok 4.5 Fast** 가 실행 담당 |

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

# 2. 계획 담당 — Claude Code (Claude Fable 5) · Google Antigravity

> 둘 다 **계획만** 한다. 코드를 직접 수정하지 않는다. 산출물은 `PLAN.md`다.

## Claude Code — Claude Fable 5

- 용도: 스크린샷·PDF·로컬 파일 분석, 도면·캡처 기반 계획.
- Claude Code에서 `/model` → **Fable** / `claude-fable-5` 선택.
- Plan Mode(Shift+Tab)로 분석만 하고 `PLAN.md`에 저장한다.
- 채팅창에 긴 코드를 출력하지 않는다. 저장 완료만 짧게 보고한다.

### 고정 명령어 (Claude Code)

```
Plan Mode로 분석해줘. 코드 수정하지 말고.
분석 결과를 PLAN.md 파일로 저장해줘.
파일명, 함수명, 줄번호를 반드시 명시해줘.
```

## Google Antigravity

- 용도: YouTube·동영상·승강기 메커니즘 동작 분석 (용어를 몰라도 영상으로 구조·시퀀스 파악).
- 분석 결과를 같은 형식의 `PLAN.md`로 저장한다.
- 코드 작성·파일 대량 수정은 Antigravity에 맡기지 않는다. 계획은 Antigravity, 구현은 Cursor Grok 4.5 Fast.

### 고정 명령어 (Antigravity)

```
이 동영상(또는 YouTube)의 승강기 메커니즘을 분석해줘. 코드는 수정하지 말고.
분석 결과를 PLAN.md 파일로 저장해줘.
파일명, 함수명, 줄번호를 알면 명시하고, 모르면 추정 근거를 적어줘.
```

## PLAN.md 작성 형식 (공통)

```markdown
# PLAN — [작업명] ([날짜])

## 분석 결과
## 수정 대상 (파일명 / 함수명 / 줄번호)
## 변경 내용 (변경 전 → 변경 후)
## 주의사항
```

## 계획 완료 후 보고 형식

```
[분석 완료] PLAN.md 파일에 저장했습니다.
Cursor에서 Grok 4.5 Fast로 PLAN.md를 보고 코드 작성하세요.
```

---

# 3. 실행 담당 — Cursor (Grok 4.5 Fast)

> `PLAN.md`대로 실제 코드를 작성한다. 계획이 정확하면 이 단계만으로 구현한다.

## 역할

- `PLAN.md`에 적힌 내용만 그대로 구현한다.
- 계획서에 없는 내용은 추가하지 않는다.
- 기존 구조를 먼저 읽고, 필요한 함수 블록만 최소 범위로 수정한다.
- 미세한 `position.set()` / `rotation` 조정도 Cursor에서 처리한다.

## 모델 선택

- Cursor 채팅 모델: **Grok 4.5 Fast** (High thinking이 필요하면 해당 설정 사용).
- Agent Mode로 `PLAN.md` 구현. Ask/Plan Mode는 질문·설계 확인용.

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

## PLAN.md 관리

- `PLAN.md`는 `.gitignore`에 등록되어 GitHub에 올라가지 않는다.
- 작업 완료 후 삭제하거나 덮어쓴다. 다음 작업과 섞이지 않도록 매번 초기화한다.
- Claude Code와 Antigravity가 같은 `PLAN.md`를 쓰면 **덮어쓰기 전에 이전 계획을 백업하거나 작업명을 바꿔** 섞이지 않게 한다.

## 임시 파일 (로컬 전용)

- `.shot-*.png`, `.rv-*.png`, `.pdf-*.png`, `.claude-tmp-shot*.js` — AI 캡처·PDF 추출용. `.gitignore` 등록됨. 앱 실행에 불필요.
