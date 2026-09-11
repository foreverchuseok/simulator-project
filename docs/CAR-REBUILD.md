# CAR-REBUILD — 카 본체 재공사 기록

2026-08-17에 카 형상을 화면에서 걷어내고, 전면부터 다시 올리기 위해 남긴 기록이다.
Claude Code, Google Antigravity, Cursor는 카 작업을 시작하기 전에 이 문서와 `js/archive/car.js`를 먼저 읽는다.

앱은 이 원본을 로드하지 않는다. `index.html`에 `js/archive/car.js`를 추가하지 않는다.

도어 재공사(`docs/DOOR-REBUILD.md`)와 같다. 카문 원본은 `js/archive/doors.js`에 따로 있다.

## 현재 화면 상태

- **카 프레임(Car Sling) 및 플랫폼 재공사 완료 (2026-09-06)**:
  - `부품설계.pdf` 89~105p 상세 설계 및 현장 스크린샷 반영.
  - 상부 크로스헤드 빔(Top Beam): ㄷ자 더블 C채널, 보강 브레이스 암, 엔드플레이트.
  - 1:1 주 권상 와이어로프 결합용 5구 바빗 로프 소켓(Babbitt Sockets / Wedge Sockets): M20 타이로드, 완충 코일 스프링, 더블 잠금 너트, 테이퍼 소켓 바디 (`Y = +S.CAR_H / 2 + 0.68`).
  - 좌/우 수직 기둥(Car Stiles / 종형 세로 ㄷ자 채널): 상부 거싯 6-볼트, 하부 거싯 12-볼트 체결열, 천장 임시 고정 앵글 브라켓.
  - 하부 세이프티 디바이스(Safety Plank): 하부 채널빔, 완충 타격 플레이트.
  - 추락방지 안전장치: `assets/safety_gear.glb` 로드 및 `carGrp.userData.safetyGear` 인터페이스 복원 (수평 샤프트, 좌우 웨지 블록, U스프링, 조속기 로프 클램프 암).
  - 상·하부 슬라이딩 가이드슈 4개소: `models/gltf/car_guide_shoe.glb`. 관통 U자 라이너, 주철형 하우징, 장공 어댑터, 조정볼트·잠금너트·고무 스토퍼, 상부 급유통. 도면의 5mm는 스토퍼 세팅 간격이며 레일 운전 간극이 아니다.
  - 카 플랫폼 베이스 프레임: 외곽 4변 C채널, 하부 종통 보강 채널 6본, 하부 강판 서브팬, 전면 실 서포트 채널, 하부 무릎 대각 브레이스.
  - 카 상부 안전 난간대: 톱빔 상단 고시인성 황색 베이스 가드, 3면 안전 파이프 난간(탑레일 900mm, 미드레일 480mm & M8 볼트, 토보드 100mm, 7개 수직 지주).

### 가이드슈 GLB 계약 (2026-09-08)

- 생성: `blender/scripts/car_guide_shoe.py`. 레일 단면은 기존 `guide_rail_13k.glb`의 `T_Rail_13K` POSITION에서 읽는다. 레일 변경 후에는 슈도 다시 생성·검증한다.
- 미터 단위, glTF Y-up, 원점은 레일 뒷면과 장착면의 교점. 날은 로컬 +X로 향한다. `T(x,y,z)=(x,-z,y)`로 Blender에 만든 뒤 기본 glTF 축 변환으로 내보낸다. scale은 1이다.
- 부모는 `carGrp → carFrameGrp → CarGuideShoe_{L|R}_{Upper|Lower}`이다. X는 `±S.CAR_BG/2`, 카 로컬 Z는 `0.04`. 우측은 Y축 180도, 하부 모델은 X축 180도로 회전하며 `Oiler`를 숨긴다.
- 상부 Y는 크로스헤드 상면 `chY+chH/2`. 하부 Y는 안전기 하부 캡 밑면 `plankY-0.145`로, `tools/build_safety_glb.mjs`의 캡 중심 `baseY-0.135`와 두께 `0.020`에 대응한다. 안전기 캡 변경 시 이 마운트도 함께 확인한다.
- 노드: `GuideShoeRoot`, `Adapter`, `Housing`, `Liner`, `Retainers`, `Fasteners`, `RubberStop`, `Adjuster`, `Oiler`. 별도 가동 애니메이션 없이 카 부모를 따라 이동한다.
- 안내 길이 120mm는 참고 도면 기반이다. 레일 측면·끝면의 0.5mm는 시각화용 간극이며 실제 설치·검사 허용값을 주장하지 않는다. 상세 두께·체결부는 기존 구조에 맞춘 교육용 재구성으로, 제작도면이나 인증 제품 복제품은 아니다.
- `assets/safety_gear.glb`는 수정하지 않았다. 로더가 기존 하부 가이드슈 박스 4개의 정확한 크기·중심을 확인해 숨긴다. 안전기 샤프트·웨지·스프링 노드와 피벗은 유지한다.
- 검증: `node tools/verify_car_guide_shoe.mjs`. 4개 배치, 레일 날 통과, 안전기 참조, 운행 중 상대 위치, 데스크톱·모바일 캡처를 확인한다. 캡처는 `.shot-guide-shoe/`에 저장한다.
- 재생성: `& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b -P blender/scripts/car_guide_shoe.py`.
- 검증 스크립트는 임시 로컬 HTTP 서버와 새 Chromium 세션을 사용한다. 앱의 CDN 라이브러리에 접근할 수 있어야 하며, 실패 시 네트워크·콘솔 오류를 함께 출력한다. 기존 배경의 `toNonIndexed` 중복 변환과 캡처의 GPU `ReadPixels` 경고는 별도 기록하고, 다른 경고와 실제 오류는 실패 처리한다.

### 카 판넬 조립 (2026-09-11)

- `js/car-panels.js`의 `buildCarPanels(carGrp)`가 부품설계.pdf 205–219p의 설치 완료 상태를 생성한다. 11장 벽 판넬, 절곡 이음/체결부, 4T 바닥 마감, 홈이 있는 카 실, 후면 손잡이, 출입구 트랜섬, 천장 덮개/보강대/스타일 방진 고정부를 포함한다. 임시 받침목·양중구와 천장 임시 앵글은 남기지 않는다.
- 사용자 변경: 왼쪽 벽과 출입구 리턴은 금속, 후면과 오른쪽 벽은 중앙 사각 개구 면적 약 80%의 투시 유리다. 판넬 이음 기둥과 금속 테두리를 유지한다. 특정 제조사의 제품 복제가 아닌 기존 카 치수에 맞춘 시각화다.
- 치수는 `S`에서 파생하며 `carGrp`의 위치·로프·FSM은 유지한다. 승장 실 끝면 `HALL_SILL_SHAFT_Z`는 `index.html`에서 공유하고 카 실은 `SILL_GAP`만큼 떨어진다.
- 검증: `node tools/verify_car_panels.mjs`로 실 간극/바닥 높이, 스타일·이동케이블 간극, 층별 추종과 전면·후면·승강로 화면을 확인한다.

아직 미복원(재공사 대기):

- 카 실내 추가 설비(천장 조명). OPB·카 탑 박스·하중 스위치 외형은 221–223p 기준으로 추가했다. 전기 동작은 미연결이며 상세는 [CAR-CONTROLS.md](CAR-CONTROLS.md).
- 카 도어 및 오퍼레이터(도어 패널, 행거)
- 탑승자 메시

그대로 둔 것:

- `carGrp` — `position.y` / `position.z` 로 운행
- 주 로프, 조속기 로프, 균형추와 그 움직임
- 조속기·권상기·피트·가이드레일·로비 벽
- 치수 `S.CAR_W`, `S.CAR_D`, `S.CAR_H` — `js/config.js`
- 운행 FSM, 도어 스텁, 비상정지 시퀀스

`buildPassenger()`는 빈 그룹만 만든다.

## 원본 코드 위치

파일: `js/archive/car.js`

| 구간 | 위치 | 부품 |
|---|---|---|
| 실내 측면·후면·바닥·천장 | `buildCarCabin()` 앞부분 | 유리, PVD, 대리석, 코브조명 |
| COP | 같은 함수 | 카 조작반 |
| 카 센서 | `carSensorGrp` | 층 인식 캠 |
| 체대 | `carFrameGrp` | PDF 11p 프레임 |
| 플랫폼·에이프런 | `platformGrp` | PDF 10p, 카 실, 에이프런 |
| 세이프티기어 | GLTFLoader | `assets/safety_gear.glb` |
| 롤러 가이드 | `rollerGuideGrp` | 가이드슈 |
| 트랜섬·컬럼 | 함수 하단 | 전면 개구 프레임 |
| 탑승자 | `buildPassenger()`, `togglePassenger()` | 프리미티브 인체 |

## 부품을 다시 올릴 때

1. 이 문서와 `js/archive/car.js`에서 해당 구간만 읽는다.
2. `js/elevator.js`의 스텁 `buildCarCabin()`에 그 구간만 넣는다.
3. 전면 디자인부터 다시 올릴 때는 과거 트랜섬·컬럼·에이프런을 참고하되, 새 자료가 있으면 새 자료가 우선이다.
4. 요청하지 않은 실내·체대·세이프티기어를 한꺼번에 복원하지 않는다.
5. `carGrp.position.y` / `z`, 주 로프, 조속기 로프, 균형추 연동을 요청 없이 바꾸지 않는다.
6. `const S` 카 치수는 확인 없이 바꾸지 않는다.
7. `index.html`에 아카이브 파일을 연결하지 않는다.

운행 계약(복원 전까지 스텁이 지킨다):

- `carGrp` 존재, `scene`에 add, 1층 정위치 `FLOOR_Y[0] + S.CAR_H / 2`, `z = CAR_CTR_Z`
- `carGrp.userData.safetyGear` 는 `null`이어도 `ui.js` / `governorReset()`이 통과한다
- 조속기 로프 클램프 Y는 `carGrp.position.y - S.CAR_H / 2 - 0.16`
- 주 로프 히치 Y는 `carGrp.position.y + S.CAR_H / 2 + 0.68`

## 관련 파일

- 치수: `js/config.js` `S.CAR_*`
- 카문 원본: `js/archive/doors.js`, `docs/DOOR-REBUILD.md`
- 로프: `js/elevator.js` `buildWireRopes()`, `refreshRopes()`, `refreshGovernorRope()`
- 균형추: `js/elevator.js` `buildCounterWeight()`
- 세이프티기어 GLB: `assets/safety_gear.glb`, 생성 `tools/build_safety_glb.mjs`
