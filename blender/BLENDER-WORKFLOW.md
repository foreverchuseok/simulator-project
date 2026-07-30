# Blender → Three.js 실사 부품 워크플로

> **작성일:** 2026-07-26  
> **대상:** Claude Code · Google Antigravity · Cursor (Grok 4.5) 공통 참조  
> **목적:** 승강기 부품을 Blender로 실사 모델링 → `.glb` 내보내기 → Three.js에서 기존 물리·애니메이션은 유지한 채 외형만 교체

---

## 1. 왜 Blender인가

| 구분 | 설명 |
|------|------|
| **Blender** | 무료 3D 제작 프로그램 (현재 PC에 설치됨, 예: 3.2 LTS) |
| **스크립트 언어** | **Python** (`bpy` API) — 모델링·내보내기를 코드로 자동화 가능 |
| **목표 포맷** | **`.glb`** (glTF 2.0 바이너리, 단일 파일) |
| **Three.js** | 이미 `GLTFLoader` 사용 중 (`index.html` → Three.js r128) |

### 파일 포맷 (이름 정리)

| 확장자 | 의미 | 이 프로젝트에서 |
|--------|------|-----------------|
| **`.blend`** | Blender 작업용 원본 파일 | `blender/` 아래에 보관 (편집용) |
| **`.glb`** | glTF **바이너리** (메시+텍스처 한 파일) | **내보내기·로드 표준** ✅ |
| **`.gltf`** | glTF **JSON** (+ `.bin`/이미지 여러 파일) | 가능하나 관리가 번거로워 **비권장** |

> 앱에서 읽는 건 **`.glb`** 이다. (기존 예: `assets/safety_gear.glb`)

---

## 2. 도구 역할 분담 (Blender 작업 전용)

| 도구 | 잘하는 것 | Blender 작업 시 규칙 |
|------|-----------|----------------------|
| **Claude Code** | 이미지·스크린샷·PDF·로컬 영상 직접 분석 + **Python(`bpy`) 스크립트 작성** | 부품 사진/캡처를 보고 **Blender용 Python 코드를 직접 작성·수정**해도 됨 |
| **Google Antigravity (`agy`)** | YouTube·메커니즘 **영상 분석** | 코딩은 약함 → **반드시 `PLAN.md` 작성** → Cursor가 코딩 |
| **Cursor (Grok 4.5)** | Three.js 연동·좌표·`GLTFLoader`·물리 유지 | `PLAN.md`가 있으면 **계획서만** 구현. 일반 요청은 바로 코딩 |

### Antigravity 고정 규칙 (중요)

Antigravity로 Blender/부품 영상·메커니즘을 분석할 때는:

```
Plan 모드로 분석해줘. 코드는 수정하지 말고.
분석 결과를 PLAN.md 파일로 저장해줘.
파일명, 함수명, 줄번호를 알면 명시하고, 모르면 추정 근거를 적어줘.
Blender Python(bpy) / .glb 내보내기 / Three.js GLTFLoader 연동 단계를 포함할 것.
```

→ Cursor에서: `"PLAN.md 보고 코드 작성해줘. 계획서에 없는 내용은 추가하지 마."`

### Claude Code 사용 예

```
이 부품 사진(또는 영상 프레임)을 보고
Blender Python(bpy)으로 모델링하는 스크립트를 작성해줘.
최종 출력은 .glb로 내보내게 해줘.
```

---

## 3. 표준 워크플로 (6단계)

```
① Blender 설치·실행
   → 부품별로 모델링 (예: 과속조절기, 로프브레이크, 안전기 …)
        ↓
② File → Export → glTF 2.0 (.glb)
   → Format: glTF Binary (.glb)
        ↓
③ 내보낸 .glb 를 프로젝트에 복사
   → models/gltf/<부품이름>.glb
        ↓
④ Three.js에서 로드
   → new THREE.GLTFLoader().load('models/gltf/<부품이름>.glb', ...)
        ↓
⑤ 기존 물리·애니메이션 로직은 그대로 유지
   → position / rotation / FSM / 센서 / GSAP 등 동작 코드는 수정 최소화
   → 교체 대상은 “외형 메시”만
        ↓
⑥ 완성 = 실사 외형 + 기존 물리 움직임
```

### 단계별 상세

#### ① Blender에서 모델링

- 부품 **1개 = 1개 `.blend` + 1개 `.glb`** 를 권장 (관리 쉬움)
- 스케일: 프로젝트 `const S` (`js/config.js`) 치수와 맞출 것. **`S` 값은 임의 변경 금지** (AGENTS.md)
- 원점·축: 프로젝트 좌표와 맞춤  
  - X: 좌(-) / 우(+)  
  - Y: 아래 / 위(+)  
  - Z: 전면(+) / 후면(-)  
  ※ Blender 기본 축(Z-up)과 Three.js(Y-up)가 다를 수 있음 → 내보내기 옵션 또는 로드 시 `rotation`으로 보정

#### ② `.glb` 내보내기 (Blender)

1. `File` → `Export` → `glTF 2.0 (.glb/.gltf)`
2. **Format:** `glTF Binary (.glb)`
3. 필요한 경우: Selected Objects only / Apply Modifiers / Include materials
4. 저장 위치 예: `blender/export/과속조절기.glb` (임시) 후 ③으로 복사

#### ③ 프로젝트 폴더에 배치

| 경로 | 용도 |
|------|------|
| **`models/gltf/`** | **앞으로 실사 `.glb` 표준 보관 위치** ✅ |
| `assets/` | 기존 파일 (예: `safety_gear.glb`) — 이미 쓰는 에셋은 유지 가능 |
| `blender/` | `.blend` 원본, 참고 이미지, Python 스크립트 (작업용) |

파일명 예:

```
models/gltf/overspeed_governor.glb   # 과속조절기
models/gltf/rope_brake.glb           # 로프브레이크
models/gltf/safety_gear.glb          # 안전기 (신규 실사본)
```

영문 파일명 권장 (경로·로더 호환).

#### ④ Three.js 로드 예시

이미 `index.html`에 `GLTFLoader`가 로드되어 있다.

```js
new THREE.GLTFLoader().load('models/gltf/overspeed_governor.glb', (gltf) => {
  const part = gltf.scene;
  // 스케일·위치·회전만 조정 (물리 로직은 기존 Group에 붙이기)
  part.scale.set(1, 1, 1);
  existingGroup.add(part);
}, undefined, (err) => console.error('[glb] 로드 실패:', err));
```

기존 참고 구현: `js/elevator.js` 의 `assets/safety_gear.glb` 로드 블록.

#### ⑤ 물리·애니메이션 유지 원칙

- **유지:** `elevatorState`, FSM(`IDLE`/`MOVING`/…), GSAP, 센서 `userData`, 카·균형추 이동
- **교체:** `createBox`/`createCylinder`로 만든 **단순 메시 외형** → `.glb` 장면으로 대체
- **금지:** 요청 없이 `const S` 변경, Three.js 버전 변경, 관련 없는 리팩터

#### ⑥ 확인

1. Live Server → `index.html`
2. 부품 위치·스케일·회전 확인
3. 운행·도어·센서 동작이 이전과 같은지 확인
4. 필요 시 Cursor에서 `position` / `rotation` / `scale`만 미세 조정

---

## 4. 폴더 구조 (권장)

```
simmul/
├── blender/                    ← Blender 작업·이 문서
│   ├── BLENDER-WORKFLOW.md     ← 본 문서 (Claude / Antigravity / Cursor 공통)
│   ├── scripts/                ← bpy Python 스크립트 (있으면)
│   ├── source/                 ← .blend 원본 (있으면)
│   └── refs/                   ← 참고 사진·캡처 (있으면)
├── models/
│   └── gltf/                   ← 내보낸 .glb 최종본 (Three.js 로드)
├── assets/                     ← 기존 .glb 등 (하위 호환)
├── js/
│   ├── elevator.js
│   ├── environment.js
│   └── ...
└── AGENTS.md
```

---

## 5. Claude Code / Antigravity / Cursor 호출 문장 (복사용)

### Claude Code — 이미지·도면 → Blender Python

```
이 부품 이미지(또는 PDF 캡처)를 분석해서
Blender Python(bpy) 스크립트로 모델링해줘.
축·스케일은 프로젝트 AGENTS.md / const S 기준으로 맞추고,
최종로 .glb 내보내기까지 스크립트에 포함해줘.
코드는 blender/scripts/ 아래에 저장해줘.
```

### Antigravity — 영상 → PLAN.md (코딩은 Cursor)

```
이 동영상(또는 YouTube)의 승강기 부품 메커니즘을 분석해줘. 코드는 수정하지 말고.
분석 결과를 PLAN.md 파일로 저장해줘.
Blender 모델링 포인트 / .glb 내보내기 / Three.js GLTFLoader 연동 /
기존 물리 유지 범위를 파일명·함수명·줄번호와 함께 적어줘.
```

### Cursor — PLAN.md 구현 또는 직접 연동

```
PLAN.md 보고 코드 작성해줘.
계획서에 없는 내용은 추가하지 마.
.glb는 models/gltf/ 경로로 로드하고, 기존 물리·애니메이션은 유지해.
```

```
models/gltf/에 있는 .glb를 Three.js에 연결해줘.
기존 createBox 외형만 교체하고 움직임 로직은 건드리지 마.
```

---

## 6. 체크리스트 (부품 1개 완성 시)

- [ ] Blender에서 부품 모델링 완료
- [ ] `.glb` (Binary)로 내보내기 완료
- [ ] `models/gltf/<name>.glb` 에 복사
- [ ] `GLTFLoader().load('models/gltf/<name>.glb', …)` 연결
- [ ] Live Server에서 위치·스케일·회전 OK
- [ ] 운행·도어·센서 등 **기존 동작** 이상 없음
- [ ] (선택) `.blend` 원본을 `blender/source/` 에 보관

---

## 7. 기존 프로젝트와의 관계

| 항목 | 현재 상태 |
|------|-----------|
| Loader | `THREE.GLTFLoader` (`index.html`) |
| 기존 예시 | `assets/safety_gear.glb` ← `js/elevator.js` |
| 신규 표준 경로 | **`models/gltf/*.glb`** |
| 기하 헬퍼 | `createBox()` / `createCylinder()` — 실사 교체 전까지 병행 가능 |

실사 `.glb`가 준비된 부품부터 하나씩 `createBox` 메시를 대체하면 된다.

---

## 8. 주의사항

- Blender·`.blend`·대용량 텍스처는 GitHub에 올릴지 팀 규칙을 따를 것 (용량 큼). **앱 실행에 필요한 건 `.glb`만**이면 된다.
- `PLAN.md`는 `.gitignore` 대상 — 작업 후 삭제 또는 덮어쓰기 (AGENTS.md).
- `const S` 임의 변경 금지.
- renderLoop 안에서 Geometry·Mesh·Material **생성 금지** (로드는 초기화 시 1회).
