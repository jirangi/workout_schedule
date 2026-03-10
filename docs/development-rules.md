# Development Rules

이 문서는 **Minimal Fit 프로젝트 (workout_schedule)**의 개발 규칙을 정의한다.

목적

- 개발 기준 통일
- AI 협업 안정성 확보
- PRD 기반 개발 유지
- 설계 문서와 코드 동기화 유지

---

# 1. 기준 문서 (Source of Truth)

모든 개발 작업은 다음 문서를 기준으로 한다.

- docs/prd.md
- docs/designspec.md

규칙

1. 기능 구현 전 반드시 PRD 요구사항을 확인한다.
2. 기능 구현 전 설계 문서를 확인한다.
3. PRD와 설계서가 충돌할 경우 PRD를 우선 기준으로 한다.

---

# 2. 개발 프로세스

모든 개발 작업은 다음 순서를 따른다.

## Step 1 — 요구사항 확인

다음 항목을 확인한다.

- 해당 기능이 PRD의 어떤 REQ에 해당하는지
- 요구사항 범위
- UX 흐름

예

REQ-01 Rolling Routine  
REQ-02 FP Reward  
REQ-03 Today Routine View  

---

## Step 2 — 설계 확인

다음 설계 요소를 확인한다.

- 데이터 구조
- 상태 저장 방식
- 알고리즘

예

ExerciseInfo  
UserPersistence  
Rolling Algorithm  

---

## Step 3 — 코드 구현

코드는 반드시 다음 원칙을 따른다.

- PRD 요구사항 충족
- 설계서 구조 유지
- 기존 코드 구조 유지
- 단순한 구현 우선

---

## Step 4 — 역분석 검토

코드 작성 후 반드시 다음을 검토한다.

체크 항목

- PRD 요구사항 충족 여부
- 설계서 데이터 구조 충돌 여부
- 기존 코드와 충돌 여부
- 문서 수정 필요 여부

---

# 3. 문서 동기화 규칙

코드 변경으로 인해 다음 상황이 발생하면 문서를 업데이트한다.

## PRD 수정이 필요한 경우

예

- 기능 범위 변경
- 요구사항 변경
- UX 변경

수정 대상

docs/prd.md

---

## 설계서 수정이 필요한 경우

예

- 데이터 구조 변경
- 알고리즘 변경
- 상태 저장 방식 변경

수정 대상

docs/designspec.md

---

# 4. 커밋 규칙

모든 커밋 메시지는 다음 형식을 따른다.

커밋명 [ver] 제목  
내용 [commit 주요 내용]

예

[v0.2.1] 개발 로드맵 문서 추가

[commit 주요 내용]
Minimal Fit 개발 단계 정의  
MVP 범위 정리  
PRD 기반 개발 우선순위 정의  

---

# 5. 브랜치 규칙 (권장)

가능하면 기능별 브랜치를 사용한다.

브랜치 이름 규칙

feature/기능명  
docs/문서명  
fix/버그명  

예

feature/rolling-routine  
feature/workout-session  
docs/roadmap-update  
fix/storage-bug  

---

# 6. 코드 작성 원칙

코드는 다음 원칙을 따른다.

## 단순성 우선

- MVP 구현 우선
- 과도한 구조 금지

---

## 상태 관리 최소화

Minimal Fit은 가능한 한 로컬 상태 기반 구조를 유지한다.

기본 저장소

LocalStorage

---

## UX 우선

Minimal Fit 핵심 UX

- 고민 없는 시작
- 빠른 운동 기록
- 운동 지속 동기

모든 기능은 이 UX를 기준으로 판단한다.

---

# 7. AI 협업 규칙

AI가 코드나 설계를 제안할 경우 반드시 다음을 수행한다.

1. 저장소 구조 확인
2. PRD 요구사항 확인
3. 설계 문서 확인
4. 코드 제안
5. PRD 충족 여부 검토

AI는 다음 저장소를 기준으로 판단해야 한다.

https://github.com/jirangi/workout_schedule

---

# 8. MVP 기준

Minimal Fit MVP 범위

REQ-01 Rolling Routine  
REQ-02 FP Reward  
REQ-03 Today Routine View  
REQ-08 Fast Set Logging  

MVP 목표

1. 고민 없는 운동 시작
2. 최소 입력 기록
3. 휴식 보상
4. 루틴 확인

---

# 9. 개발 우선순위

개발 순서

1. 프로젝트 구조
2. Rolling Routine
3. 운동 세션 UX
4. FP 적립
5. 통계
6. 시작 템플릿
7. FP 사용
8. 달력 기록

---

# 10. 저장소 문서 구조

프로젝트 문서는 다음 구조를 따른다.

docs/
 ├ prd.md
 ├ designspec.md
 ├ roadmap.md
 └ development-rules.md

---

# 11. 최종 원칙

Minimal Fit 개발의 핵심 원칙

PRD 중심 개발  
설계 기반 구현  
단순한 코드  
빠른 UX  
지속 가능한 구조
