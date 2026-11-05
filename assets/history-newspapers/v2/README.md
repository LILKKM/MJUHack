# 역사 신문 이미지·위치 매칭 v2

사전 제작한 사건별 이미지 58장과 한글·영문 신문 SVG 116개를 기존 장소 ID 및 이미 보완한 58핀 좌표에 연결한 전달 패키지다. 이 폴더만 추가하며 Front·Spring·DB·기존 좌표 파일을 변경하지 않는다.

## 사용

- [`image-location-map.json`](image-location-map.json): 프로그램용 전체 매칭 파일. `items`에서 `spotId`로 조회한다.
- [`image-location-map.csv`](image-location-map.csv): 엑셀에서 확인하기 위한 동일 매칭의 평면 표. UTF-8 BOM.
- [`gallery.html`](gallery.html): 로컬에서 열어 한영 지면을 사건별로 비교한다.
- `illustrations/{spotId}.png`: AI 생성 원본 1536×1024, 58장.
- `newspapers/ko/{spotId}.svg`, `newspapers/en/{spotId}.svg`: 이미지와 폰트가 내장된 완성 조판 116개.
- `articles/{ko|en}/{spotId}.txt`: 기사 전문. 한글은 엑셀 원문 그대로, 영문은 전체 번역.
- `previews/`: 모든 지면 축소 JPG, 제목·이미지 비교판 6개, 독립문 한영 전체 PNG.
- `fonts/`: 조선100년체, Abhaya Libre ExtraBold, 한자 13자용 Noto Serif KR 및 출처·사용조건.
- `provenance/`: 기존 핀·보완 좌표·생성 기록·프롬프트·원문·번역·선행 렌더링 증거.

JSON의 모든 자산 경로는 **이 폴더 기준 상대 경로**다. 예를 들어 SDM05의 `illustration.path`는 `illustrations/SDM05.png`다. 앱에 제공할 때 확정된 정적 파일 URL의 기준 주소를 붙인다. 서버 연결이나 URL/DB 반영은 이 PR 범위에 포함하지 않는다. SVG에 포함한 그림과 원본 PNG는 동일한 SHA-256이다.

## 좌표·사건 매칭

이름 유사성이나 배열 순서가 아닌 `spotId == sourceId`의 정확한 ID로 조인했다. 주 좌표 `location.latitude/longitude`는 기존 `data/history/coordinates/pins.review-preview.json`의 58곳과 정확히 같다. 엑셀의 기존40개 좌표는 보존하고 이미 작성된 18개 보완값을 사용했다. 원본 좌표는 `location.originalCoordinate`, 보완 근거와 검토 상태는 `coordinateSupplement` 및 `location.coordinateOverlay`로 함께 보존한다. 새로 추정하거나 좌표를 재조사하지 않았다.

58곳은 기존40 + 문서·지도 대조14 + 통합 검토 필요 후보4다. SDM04(독립관), MPO05(밤섬), EPY02(북한산성), EPY03(셋이서문학관)은 기존 `requiresIntegrationApproval=true`를 유지한다. 좌표가 있다는 이유로 최종 승인·현장 방문 정확도·접근성 검증으로 승격하지 않는다. MPO03은 사용자 선택 서강나루 현 표석, EPY08은 보완된 독립 공식 좌표다.

좌표는 **현재 방문 거점 위치**다. 이미지 속 역사 사건의 발생 좌표와 같다는 뜻이 아니다. 예를 들어 SDM03의 서울 임시정부기념관은 상하이 임시정부 수립 사건을 소개하는 거점이다. 상세 관계는 보완 좌표의 `visitPointRelation`을 확인한다.

기준 커밋은 JSON의 `baseCommit`으로 고정했다. 그 기준의 V9 migration에서 제외된16개 장소 자산도 요청대로 모두 보존했다. `repositorySpotStatus.presentAfterBaseMigrations`는 당시 DB seed에 남는지 알려주는 참고 값이며 이미지를 삭제하거나 16곳을 DB에 복원하지 않는다. 현재 실제 운영 DB를 조회한 결과가 아니다. 프론트에서 사용할 최종 목록/서버 연결은 별도다.

## 조판 및 상태

한글 조선100년체, 영문 Abhaya Libre ExtraBold(800). 제목은 사진 위 영역의 실제 폰트 폭·높이에 맞춰 크기와 줄바꿈을 조정했고, 본문 전체를 보존하도록 지면 높이를 늘렸다. 그림은 원본 비율의 contain 배치다. 브라우저에서 단독 열기 가능하며 편집기별 내장 서체 지원은 미검증이다.

전체 이미지는 **AI 역사 재구성**이며 실제 사료 사진이 아니다. `publicationStatus=unpublished`, `historicalReviewStatus=unverified`를 유지한다. 파일 매칭·조판 검증은 역사 고증·독립 영문 감수·앱 연결 완료를 뜻하지 않는다. 기존 기사 초안의 오류 가능성을 수정했다고 주장하지 않는다. SDM09 원문은 지난3월과4월1일 표현이 상충해 후속 검토가 필요하다.

## 검증

저장소 루트에서 실행:

```sh
python3 assets/history-newspapers/v2/validate.py
```

Python 3.9+ 표준 라이브러리만 사용한다. 기존58핀 좌표와 원본40좌표·보완18근거 보존, ID 중복/누락, 이미지58해시·PNG 규격, SVG116 내장 이미지 및 파일 해시, 한글232·영문232문단 전문, CSV/JSON 일치, 갤러리464참조를 검사한다. 잘못된 ID·위경도 교환·게시 상태 승격도 거부하는 방어 검증을 포함했다. `checksums.json`은 전달 자산의 전체 파일 체크섬 목록이다.

선행 Chrome 렌더링 결과는 `provenance/newspaper-v2/qa/render-report.json`에 있다. 이번 전달에서 SVG 바이트가 선행 검증본과 같은지 전수 대조했다. 선행116개 서체 로딩 및 텍스트 경계 검사, 실제 사용 문자 cmap 검사의 누락 글리프0 결과를 보존했다. 대표 전체 지면·전체 제목/그림 비교판도 함께 제공한다. 앱 동작은 바꾸지 않아 앱 빌드는 실행하지 않았다.

원본 워크북 및 대용량 ZIP은 중복 커밋하지 않았다. 원본58PNG와116SVG, 전문, 출처/검증 자료는 개별 파일로 모두 포함했다. 출처 snapshot 안의 과거 작업 공간 경로는 제작 provenance이며 이 저장소에서 실행할 파일 경로가 아니다. 좌표 원문 응답 전체는 이 패키지에 복사하지 않았으며 overlay의 `sourceUrls`와 원문 ID를 참조한다. OpenStreetMap 유래 보완값: © OpenStreetMap contributors, https://www.openstreetmap.org/copyright (ODbL).

Plan: 입력·기준 커밋·소유권 확인. Design: ID 조인과 좌표 검토 상태 보존. Build: 자산/별도 JSON·CSV 패키징. Test: 해시·전문·참조·기존 렌더링 증거 대조. Deploy: 사용자 요청 범위의 브랜치 push 및 PR 생성, 병합·클라우드 배포는 포함하지 않음. 프로젝트 지침에 열거된 별도 스킬 이름은 현 카탈로그에 없어 직접 검증 절차를 사용했다.
