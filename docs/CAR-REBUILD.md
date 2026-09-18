# CAR-REBUILD — 카 본체 재공사 기록

2026-08-17에 카 형상을 화면에서 걷어내고, 전면부터 다시 올리기 위해 남긴 기록이다.
Claude Code, Google Antigravity, Codex, Cursor는 카 작업을 시작하기 전에 이 문서와 `js/archive/car.js`를 먼저 읽는다.

앱은 이 원본을 로드하지 않는다. `index.html`에 `js/archive/car.js`를 추가하지 않는다.

도어 재공사(`docs/DOOR-REBUILD.md`)와 같다. 카문 원본은 `js/archive/doors.js`에 따로 있다.

## 현재 화면 상태

- 렌더링 최적화(2026-09-18): 체대·플랫폼·난간의 이름 없는 고정 메시만 `batchStaticChildren()`으로 부모 로컬 좌표에서 묶는다. 이름 있는 하부 판·가이드슈·가동부·센서와 `carGrp`의 이동 계약은 유지한다. 상세 결과는 [공유 로드맵](ROADMAP.md)의 렌더링 2차 기록을 참고한다.

### 2026-09-16 하부 디바이스 재구성

사용자 목표 이미지와 설명 영상에 따라 하부 디바이스·링크·가이드슈·스위치 배선을 수정했다. 아래 **세이프티기어 GLB 및 하부 연동부 계약**이 현재 구현 기준이다.

- **카 프레임(Car Sling) 및 플랫폼 재공사 완료 (2026-09-06)**:
  - `부품설계.pdf` 89~105p 상세 설계 및 현장 스크린샷 반영.
  - 상부 크로스헤드 빔(Top Beam): ㄷ자 더블 C채널, 보강 브레이스 암, 엔드플레이트.
  - 1:1 주 권상 와이어로프 결합용 5구 바빗 로프 소켓(Babbitt Sockets / Wedge Sockets): M20 타이로드, 완충 코일 스프링, 더블 잠금 너트, 테이퍼 소켓 바디 (`Y = +S.CAR_H / 2 + 0.68`).
  - 좌/우 수직 기둥(Car Stiles / 종형 세로 ㄷ자 채널): 상부 거싯 6-볼트, 하부 거싯 12-볼트 체결열, 천장 임시 고정 앵글 브라켓.
  - 하부 세이프티 디바이스(Safety Plank): 하부 채널빔. 내부 작업을 위해 밑면 판 `safetyPlankBottomCover` 하나만 임시로 숨겼다. 양쪽 세로 웹과 플랜지는 유지한다.
  - 추락방지 안전장치: `assets/safety_gear.glb` 로드 및 `carGrp.userData.safetyGear` 인터페이스 복원 (진행률 노드, 좌우 웨지 블록). 2026-09-16 하부 설계도 스타일로 재생성 — 아래 **세이프티기어 GLB 및 하부 연동부 계약** 참고.
  - 카 하부 비상정지 연동부: 장죽 하나, 양단 절곡 링크와 슬롯 요크, 조속기 클램프, 복귀 스프링 및 안전 스위치. 아래 현재 계약 참고.
  - 상·하부 슬라이딩 가이드슈 4개소: 상부는 `models/gltf/car_guide_shoe.glb`, 하부는 실사 기반 `models/gltf/car_lower_guide_shoe.glb`. 하부는 금색 절곡 외함 안에 청색 U자 우레탄을 넣으며 가장자리에서만 조금 드러난다. 상부의 조정장치·급유통은 유지한다.
  - 카 플랫폼 베이스 프레임: 외곽 4변 C채널, 하부 종통 보강 채널 6본, 하부 강판 서브팬, 전면 실 서포트 채널. 하부 무릎 대각 브레이스는 2026-09-16 실사 수정 요청으로 제거했다.
  - 카 상부 안전 난간대: 톱빔 상단 고시인성 황색 베이스 가드, 3면 안전 파이프 난간(탑레일 900mm, 미드레일 480mm & M8 볼트, 토보드 100mm, 7개 수직 지주).

### 가이드슈 GLB 계약 (2026-09-08)

- 생성: 상부 `blender/scripts/car_guide_shoe.py`, 하부 `blender/scripts/car_lower_guide_shoe.py`. 하부 스크립트는 상부 스크립트의 좌표·레일 단면·라이너 치수와 기하 헬퍼를 가져온다. 레일 단면은 기존 `guide_rail_13k.glb`의 `T_Rail_13K` POSITION에서 읽는다. 레일 변경 후에는 두 슈를 다시 생성·검증한다.
- 미터 단위, glTF Y-up, 원점은 레일 뒷면과 장착면의 교점. 날은 로컬 +X로 향한다. `T(x,y,z)=(x,-z,y)`로 Blender에 만든 뒤 기본 glTF 축 변환으로 내보낸다. scale은 1이다.
- 부모는 `carGrp → carFrameGrp → CarGuideShoe_{L|R}_{Upper|Lower}`이다. X는 `±S.CAR_BG/2`, 카 로컬 Z는 `0.04`. 우측은 Y축 180도, 하부 모델은 X축 180도로 회전하며 `Oiler`를 숨긴다.
- 상부 Y는 크로스헤드 상면 `chY+chH/2`. 하부 Y는 안전기 하부 캡 밑면 `plankY-0.145`로, `tools/build_safety_glb.mjs`의 캡 중심 `baseY-0.135`와 두께 `0.020`에 대응한다. 안전기 캡 변경 시 이 마운트도 함께 확인한다.
- 공통 노드: `GuideShoeRoot`, `Adapter`, `Housing`, `Liner`, `Retainers`, `Fasteners`, `Oiler`. 상부만 `RubberStop`, `Adjuster`와 급유통 형상이 있다. 하부의 `Oiler`는 형상 없는 호환 노드다. 별도 가동 애니메이션 없이 카 부모를 따라 이동한다.
- 안내 길이 120mm는 참고 도면 기반이다. 레일 측면·끝면의 0.5mm는 시각화용 간극이며 실제 설치·검사 허용값을 주장하지 않는다. 상세 두께·체결부는 기존 구조에 맞춘 교육용 재구성으로, 제작도면이나 인증 제품 복제품은 아니다.
- `assets/safety_gear.glb` 안에는 더 이상 하부 가이드슈 박스가 없다(2026-09-11 재생성). 로더는 GLB를 그대로 올리며 안전기 샤프트·웨지·스프링 노드와 피벗은 유지한다.
- 검증: `node tools/verify_car_guide_shoe.mjs`. 4개 배치, 레일 날 통과, 안전기 참조, 운행 중 상대 위치, 데스크톱·모바일 캡처를 확인한다. 캡처는 `.shot-guide-shoe/`에 저장한다.
- 재생성: `& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b -P blender/scripts/car_guide_shoe.py`.
- 하부 재생성: `& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b -P blender/scripts/car_lower_guide_shoe.py`.
- 검증 스크립트는 임시 로컬 HTTP 서버와 새 Chromium 세션을 사용한다. 앱의 CDN 라이브러리에 접근할 수 있어야 하며, 실패 시 네트워크·콘솔 오류를 함께 출력한다. 기존 배경의 `toNonIndexed` 중복 변환과 캡처의 GPU `ReadPixels` 경고는 별도 기록하고, 다른 경고와 실제 오류는 실패 처리한다.

### 세이프티기어 GLB 및 하부 연동부 계약 (2026-09-16)

- 사용자 목표 도면과 설명 영상에 맞춰 열린 절곡 하우징과 레일 한 개당 흑색 삼각 쐐기 두 개(전체 네 개), 외부·내부 링크를 구성했다. 레일 안쪽 코일 형상은 제거했다.
- 생성: `node tools/build_safety_glb.mjs` → `assets/safety_gear.glb`. 공용 치수는 `js/safety-device.js`의 `safetyDeviceDimensions(H, BG)`가 원본이다. 레일 반두께는 기존 가이드슈 GLB 메타데이터에서 읽는다.
- `shaft`는 형상 없는 트립 진행률 호환 노드다. `liftL`/`liftR`, `wedge{L,R}{0,1}` 이름을 유지한다. `spring{L,R}{0,1}`은 형상 없는 호환 노드다.
- `buildCarCabin()`이 `buildHyundaiSafetyLinkage()`를 호출한다. 부모는 `carGrp → carFrameGrp → carSafetyLinkage`. 조속기 입력은 +X, 스위치는 -X다. 카 후면에서 보면 입력이 왼쪽이다.
- 장죽은 `safetyCrossRod` 하나다. 핀이 입력축 아래와 출력축 위에 있으므로 양단 레버는 반대 방향으로 회전한다. `pose()`가 두 원의 교점으로 장죽 길이를 유지한다. 실사 수정으로 출력축을 중앙 쪽으로 140mm, 위로 70mm 옮겨 장죽이 스위치 쪽으로 올라간다. 길이는 양단 핀의 초기 간격에서 계산한다. 외부 링크와 포크는 금색이며 링크 위를 가로지르던 플랫폼 대각 보강대는 제거했다.
- 내부 크랭크가 슬롯 요크를 통해 양쪽 리프트를 약 19.08mm 올린다. 쐐기는 상승량과 공용 경사에서 계산한 만큼 레일에 접근한다. 네 쐐기 모두 대기 간극 약 4.74mm에서 트립 끝에 접촉한다. 수치는 교육용 모델의 기하값이다.
- 하우징 상면은 `capTopY`, 하부 가이드슈 장착면은 `capBottomY`다. 하부 빔과 마운트도 이 계약을 따른다.
- 하부 가이드슈는 `car_lower_guide_shoe.glb`를 직접 로드한다. 과거 `rebuildLowerSafetyGuideShoe()`의 개방 클램프 덧붙이기는 제거했다. 외함·마운트·나사는 새 Blender 모델에 한 번만 포함되며, 레일이 들어가는 청색 우레탄 홈은 금속 외함 안쪽에 있다. 상부 모델은 유지한다.
- `safetyLimitSwitch.userData.contactClosed`는 트립 진행률 0.12부터 false, 복귀 시 true다. 이 표시값이 운행 FSM을 직접 제어하지는 않는다.
- 확대 실사 세부 수정: 복귀 스프링은 16회 권선이며, 스프링 받침을 연결 핀에서 135mm 떨어뜨렸다. 받침 앞 이중 육각 너트·노출 나사산·포크 잠금 너트를 분리했다. 캠 정면에는 관통 육각 소켓과 눈고리·두 다리를 가진 분할핀이 있다.
- 스위치는 가로 청색 몸체와 하향 롤러 암이다. 진행률 0.12까지 캠 접촉면을 따르고, 해제 후에는 수평으로 복귀한다. 후면에서 왼쪽 글랜드로 나온 선은 빔을 따라 끝까지 직선으로 가서 카 외벽과 천장을 거쳐 올라간다. 직선 구간에 고정 새들을 두며 모서리만 짧게 굽힌다. `connectTopBox()`는 판넬 조립 후 실제 `carTopBox` 글랜드까지 `safetySwitchHarness`를 한 번 생성한다.
- 조속기 클램프는 `carGrp.userData.govClamp`에서 읽는다. `engageDeviceStop()`은 `clampLift`만큼 하강하면서 회전 진행률을 역산해 클램프 월드 Y를 유지한다. 이전 250mm 하강·로프 미끄러짐 근사는 사용하지 않는다.
- 검증: `node tools/verify_safety_device.mjs`. 101개 자세의 장죽 길이·요크 정렬·네 쐐기 간극, 롤러와 캠의 간극·수평 복귀, 스프링 권선 간극, 가이드슈 레일 통로, 트립·복귀와 배선을 검사한다. 실제 설치 화면과 레일을 숨긴 도면 비교 화면은 `.shot-safety-device/`에 저장한다.

### 카 판넬 조립 (2026-09-11)

- `js/car-panels.js`의 `buildCarPanels(carGrp)`가 부품설계.pdf 205–219p의 설치 완료 상태를 생성한다. 11장 벽 판넬, 절곡 이음/체결부, 4T 바닥 마감, 홈이 있는 카 실, 후면 손잡이, 출입구 트랜섬, 천장 덮개/보강대/스타일 방진 고정부를 포함한다. 임시 받침목·양중구와 천장 임시 앵글은 남기지 않는다.
- 사용자 변경: 왼쪽 벽과 출입구 리턴은 금속, 후면과 오른쪽 벽은 중앙 사각 개구 면적 약 80%의 투시 유리다. 판넬 이음 기둥과 금속 테두리를 유지한다. 특정 제조사의 제품 복제가 아닌 기존 카 치수에 맞춘 시각화다.
- 치수는 `S`에서 파생하며 `carGrp`의 위치·로프·FSM은 유지한다. 승장 실 끝면 `HALL_SILL_SHAFT_Z`는 `index.html`에서 공유하고 카 실은 `SILL_GAP`만큼 떨어진다.
- 검증: `node tools/verify_car_panels.mjs`로 실 간극/바닥 높이, 스타일·이동케이블 간극, 층별 추종과 전면·후면·승강로 화면을 확인한다.

아직 미복원(재공사 대기):

- 카 실내 추가 설비(천장 조명). OPB·카 탑 박스는 221–223p, 하중 감지는 224–226p A 타입 포텐셜 미터 PM1/PM2 기준으로 추가했다. 전기 동작은 미연결이며 상세는 [CAR-CONTROLS.md](CAR-CONTROLS.md).
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
- `carGrp.userData.safetyLinkage` 도 없으면 `refreshCarSafetyLinkage()`가 그냥 빠져나온다
- 조속기 로프 클램프 위치는 `carGrp.userData.govClamp`에서 읽는다.
- 주 로프 히치 Y는 `carGrp.position.y + S.CAR_H / 2 + 0.68`

## 관련 파일

- 치수: `js/config.js` `S.CAR_*`
- 카문 원본: `js/archive/doors.js`, `docs/DOOR-REBUILD.md`
- 로프: `js/elevator.js` `buildWireRopes()`, `refreshRopes()`, `refreshGovernorRope()`
- 균형추: `js/elevator.js` `buildCounterWeight()`
- 세이프티기어 GLB: `assets/safety_gear.glb`, 생성 `tools/build_safety_glb.mjs`
