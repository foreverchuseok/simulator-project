# Blender → GLB → Three.js 작업 절차

이 문서는 Blender 부품 제작과 앱 연결에 필요한 절차만 설명한다.
AI 공통 규칙과 `PLAN.md` 운영 방식은 루트 `AGENTS.md`를 따른다.

## 현재 환경과 경로

- Blender: 5.2 LTS.
- 모델링 스크립트: `blender/scripts/*.py`.
- 앱이 로드하는 신규 GLB 표준 경로: `models/gltf/*.glb`.
- 조속기 형상 원본: `blender/scripts/overspeed_governor.py`.
- 조속기 최종 모델: `models/gltf/overspeed_governor.glb`.
- 조속기 렌더 검증: `blender/scripts/render_governor.py`.
- 세이프티기어는 예외적으로 기존 경로 `assets/safety_gear.glb`를 사용한다.

앱이 읽는 최종 형식은 glTF Binary 단일 파일인 `.glb`다.
현재 프로젝트는 `.blend` 파일을 필수 원본으로 사용하지 않고 Python `bpy` 스크립트를 형상 원본으로 사용한다.

## 표준 작업 순서

```text
실사·도면·표시된 스크린샷 분석
  → Python 상수와 build_*() 수정
  → Blender 헤드리스 실행
  → models/gltf/*.glb 내보내기
  → 필요하면 헤드리스 렌더 확인
  → Live Server 하드 리프레시
  → Three.js 위치·피벗·애니메이션 확인
```

### 1. 형상 원본 수정

- 부품 치수, 위치, 각도는 Python 상단 상수 블록에 모은다.
- 기하 함수 안에 같은 수치를 반복해서 넣지 않는다.
- 가동 부품은 개별 GLB 노드로 내보내고 원점을 실제 회전·이동 피벗에 둔다.
- 실사와 시뮬 화면의 관찰 방향이 반대일 수 있으므로 전면·후면·좌우를 먼저 확인한다.
- 사용자가 표시한 색, 원, 선은 수정 대상과 목표 실루엣을 구분하는 근거로 사용한다.

### 2. 좌표 변환

Three.js 프로젝트 좌표는 Y-up이고 Blender는 Z-up이다.
조속기 스크립트는 다음 변환 함수를 사용한다.

```python
def T(x, y, z):
    return (x, -z, y)
```

즉, Three.js `(x, y, z)`를 Blender `(x, -z, y)`로 옮긴다.
수동으로 축을 다시 바꾸거나 로더에서 중복 회전시키지 않는다.

### 3. GLB 내보내기

프로젝트 루트의 PowerShell에서 실행한다.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' `
  -b -P blender\scripts\overspeed_governor.py
```

성공 조건:

- Blender 프로세스가 종료 코드 0으로 끝난다.
- `models/gltf/overspeed_governor.glb`가 갱신된다.
- 출력 오브젝트 목록에 필요한 가동 노드가 포함된다.

### 4. 헤드리스 렌더 확인

형상·간극을 브라우저보다 먼저 확인해야 할 때 실행한다.

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' `
  -b -P blender\scripts\render_governor.py
```

루트에 생성되는 `.shot-gov-blender-*.png`는 로컬 검증용이며 Git에 올리지 않는다.
정면만 보지 말고 사선, 측면, 상단에서 겹침과 피벗을 확인한다.

### 5. Three.js 연결

조속기는 `js/environment.js`의 `buildMachineRoom()`에서 로드한다.

```text
overspeed_governor.glb
  → GLTFLoader
  → 이름으로 노드 검색
  → 빈 THREE.Group 래퍼에 mount()
  → mrGrp.userData.governor에 참조 저장
```

빈 래퍼 그룹은 애니메이션 피벗이다.
GLB 노드 이름, 원점 또는 래퍼 계층을 바꾸면 `js/elevator.js`의 동작이 깨질 수 있다.

### 6. Live Server 검증

브라우저에서 하드 리프레시한 뒤 다음을 확인한다.

1. 모델이 로드되고 콘솔에 GLB 오류가 없는가.
2. 위치·회전·크기가 기계실 프레임과 맞는가.
3. 가동 부품 원점이 실제 피벗과 맞는가.
4. 대기 상태에서 부품끼리 미리 닿거나 관통하지 않는가.
5. 과속 트립과 복귀 시 움직임 방향·간극이 맞는가.
6. 조속기 로프와 휠 홈의 정렬이 유지되는가.

## 조속기 노드 계약

현재 GLB의 주요 노드는 다음과 같다.

| 노드 | 역할 | Three.js 동작 |
|---|---|---|
| `Pulley` | 노란 조속기 휠 | 회전 |
| `PendA`, `PendB` | 원심 진자 | 트립 시 개방 |
| `Catch` | 캐치 레버·슈 | 낙하·파지 회전 |
| `Spring` | 복귀 스프링 | 캐치 동작 연동 |
| `Plunger` | 과속스위치 액추에이터 | 눌림·복귀 |
| `BaseFrame` | 베이스와 고정 형상 | 정적 |
| `Cover` | 반투명 보호 덮개 | 정적 |

노드 이름은 `js/environment.js`의 `mount()` 검색 키와 연결된다.
삭제하거나 바꾸려면 Python, GLB, `environment.js`, `elevator.js` 계약을 함께 수정해야 한다.

## 조속기 동작 데이터

```text
overspeed_governor.py
  → 노드 형상·피벗
environment.js
  → 래퍼 그룹·pose·geom·userData.governor
elevator.js
  → governorTrip() / governorReset()
ui.js
  → 과속 시나리오와 카메라 연출
```

특히 다음 값은 양쪽 동기 여부를 확인한다.

- Python과 JavaScript의 `LEV_TILT`.
- 스프링 축과 `SPRING_TILT`.
- 휠 중심과 로프 홈 반경.
- `Plunger` 이동축과 `pose.switchLever`.
- `Catch` 대기·트립·파지 pose.

같은 숫자를 두 파일에서 각각 임의로 바꾸지 말고 가능한 한 한쪽 값에서 파생한다.

## 형상 수정 체크리스트

- [ ] 실사 관찰 방향과 시뮬 카메라 방향을 구분했다.
- [ ] 수정 대상 외 부품을 건드리지 않았다.
- [ ] 치수·각도를 상수 블록에 두었다.
- [ ] 가동 노드 이름과 피벗을 유지했다.
- [ ] GLB를 다시 내보냈다.
- [ ] 정면·사선 렌더에서 겹침을 확인했다.
- [ ] Live Server에서 하드 리프레시했다.
- [ ] 대기·트립·복귀 상태를 확인했다.
- [ ] JS/Python 공유 값이 어긋나지 않았다.

## 금지 사항

- GLB만 직접 편집하고 Python 형상 원본을 갱신하지 않는다.
- `const S`를 Blender 형상에 맞추기 위해 임의 변경하지 않는다.
- 요청 없이 Three.js, GLTFLoader, GSAP 또는 Blender 버전을 바꾸지 않는다.
- 가동 노드를 하나의 정적 메시로 합치지 않는다.
- 렌더가 예뻐 보인다는 이유로 실제 충돌 간극이나 로프 경로를 무시하지 않는다.
