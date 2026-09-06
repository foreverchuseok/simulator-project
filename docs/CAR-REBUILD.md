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
  - 상·하부 가이드 슈 4개소: 가이드레일 날(`Z = +0.04m`)에 5mm 틈새로 결합되는 U자 라이너, 주철 하우징, 상단 자동 오일 급유통.
  - 카 플랫폼 베이스 프레임: 외곽 4변 C채널, 하부 종통 보강 채널 6본, 하부 강판 서브팬, 전면 실 서포트 채널, 하부 무릎 대각 브레이스.
  - 카 상부 안전 난간대: 톱빔 상단 고시인성 황색 베이스 가드, 3면 안전 파이프 난간(탑레일 900mm, 미드레일 480mm & M8 볼트, 토보드 100mm, 7개 수직 지주).

아직 미복원(재공사 대기):

- 카 실내(측면 유리, 후면 패널, 대리석 바닥, 천장 조명, COP)
- 카 도어 및 오퍼레이터(카 실, 도어 패널, 행거)
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
