# CAR-REBUILD — 카 본체 재공사 기록

2026-08-17에 카 형상을 화면에서 걷어내고, 전면부터 다시 올리기 위해 남긴 기록이다.
Claude Code, Google Antigravity, Cursor는 카 작업을 시작하기 전에 이 문서와 `js/archive/car.js`를 먼저 읽는다.

앱은 이 원본을 로드하지 않는다. `index.html`에 `js/archive/car.js`를 추가하지 않는다.

도어 재공사(`docs/DOOR-REBUILD.md`)와 같다. 카문 원본은 `js/archive/doors.js`에 따로 있다.

## 현재 화면 상태

걷어낸 것:

- 카 실내(측면 유리, 후면 플루티드 패널, 대리석 바닥, 천장 코브조명, COP)
- 카 프레임(크로스헤드, 업라이트, 플랭크, 브레이스, 도어머신 베이스, 난간)
- 플랫폼(플로어, 킥플레이트, 카 실, 에이프런, 하중장치)
- 세이프티기어 메시(`assets/safety_gear.glb` 로드)
- 롤러 가이드, 천장 점검 커버, 패널 조인트, 카 트랜섬·컬럼
- 카 센서 캠 디버그 형상
- 탑승자 메시

그대로 둔 것:

- `carGrp` 빈 그룹 — `position.y` / `position.z` 로 운행
- 주 로프, 조속기 로프, 균형추와 그 움직임
- 조속기·권상기·피트·가이드레일·로비 벽
- 치수 `S.CAR_W`, `S.CAR_D`, `S.CAR_H` — `js/config.js`
- 운행 FSM, 도어 스텁, 과속 시퀀스(세이프티기어 메시만 없음)
- `assets/safety_gear.glb` 파일 자체

`buildCarCabin()`은 위치만 잡는 빈 `carGrp`를 만든다.
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
