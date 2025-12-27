# Git Rebase와 --no-ff 옵션 완벽 가이드

> **작성일**: 2025-12-27
> **목적**: Git 브랜치 통합 전략 (rebase vs merge) 이해 및 실전 활용

---

## 📌 핵심 개념

### Git 브랜치 통합의 두 가지 철학

1. **merge --no-ff**: 브랜치 역사 보존 (기능 단위 추적 용이)
2. **rebase**: 선형 히스토리 유지 (깔끔하지만 히스토리 재작성)

각각의 목적과 상황에 맞게 사용하는 것이 핵심입니다.

---

## 1. `git rebase` (재배치)

### 개념

**"브랜치의 베이스(시작점)를 다시 설정"**

```
Before rebase:
main:     A---B---C
               \
feature:        D---E

After rebase:
main:     A---B---C
                   \
feature:            D'---E'
```

D, E 커밋이 C 뒤로 **이동**됨 (실제로는 새로운 커밋 D', E' 생성)

### 실제 예시

```bash
# 상황: feature 브랜치 작업 중, main이 업데이트됨
git checkout feature
git rebase main

# 결과: feature 브랜치가 최신 main 위에 재배치됨
```

### 시각적 비교

#### Before (충돌 가능성)
```
main:     A---B---C---F---G
               \
feature:        D---E
```

#### After rebase
```
main:     A---B---C---F---G
                           \
feature:                    D'---E'
```

### 장점 ✅

#### 1. 깔끔한 선형 히스토리
```bash
# Rebase 사용
* E' - feat: 기능 완료
* D' - feat: 기능 추가
* G  - fix: 버그 수정
* F  - feat: 다른 기능
* C  - refactor: 리팩토링
```

#### 2. 충돌 조기 발견
```bash
# main의 최신 변경사항과 즉시 통합
# merge 전에 충돌 해결 가능
```

#### 3. 코드 리뷰 용이
```bash
# feature 브랜치가 main의 최신 코드 반영
# 리뷰어가 최신 컨텍스트에서 확인 가능
```

### 단점 ⚠️

#### 1. 히스토리 재작성 (위험)
```bash
# ❌ 절대 금지: 공개 브랜치에서 rebase
git checkout main
git rebase feature  # 다른 사람도 사용하는 main을 재작성!

# ✅ 안전: 로컬 feature 브랜치에서만
git checkout feature
git rebase main
```

#### 2. force push 필요
```bash
# rebase 후 원격에 push하려면
git push --force-with-lease  # 더 안전
# 또는
git push -f  # 위험
```

#### 3. 복잡한 충돌 해결
```bash
# 커밋마다 충돌 해결 필요
# Conflict in commit D'
# ... 해결 ...
git rebase --continue

# Conflict in commit E'
# ... 해결 ...
git rebase --continue
```

### Rebase 황금률 🏆

```
✅ 로컬 브랜치: rebase 사용 가능
❌ 공개 브랜치: rebase 절대 금지
❌ 협업 브랜치: rebase 위험

예외: force push 허용된 개인 feature 브랜치
```

---

## 2. `--no-ff` (No Fast-Forward)

### 개념

**"merge 커밋을 강제로 생성"**

```
Fast-Forward (기본):
main:     A---B---C
               \    (feature를 merge하면)
                    A---B---C---D---E
                    (feature 커밋이 main에 직접 추가)

No Fast-Forward (--no-ff):
main:     A---B---C-----------M
               \             /
feature:        D-----------E
                (merge 커밋 M 생성)
```

### 실제 예시

#### 일반 merge (fast-forward)
```bash
git checkout main
git merge feature

# 결과
* E - feat: 기능 완료
* D - feat: 기능 추가
* C - refactor: 리팩토링

# 어디서 브랜치가 시작/끝났는지 모름
```

#### --no-ff merge
```bash
git checkout main
git merge --no-ff feature

# 결과
*   M - Merge branch 'feature' into main
|\
| * E - feat: 기능 완료
| * D - feat: 기능 추가
|/
* C - refactor: 리팩토링

# 브랜치 시작/끝 명확
```

### 장점 ✅

#### 1. 기능 단위 추적
```bash
# git log --oneline --graph
*   a1b2c3 Merge branch 'feature/user-auth' (merge 커밋)
|\
| * d4e5f6 feat: 비밀번호 암호화 추가
| * g7h8i9 feat: 로그인 API 구현
|/
*   j0k1l2 Merge branch 'feature/product-list'
|\
| * m3n4o5 feat: 상품 필터링 추가
| * p6q7r8 feat: 상품 목록 API 구현
```

**한눈에 파악**: "user-auth 기능은 2개 커밋", "product-list는 2개 커밋"

#### 2. 롤백 용이
```bash
# 전체 기능을 한 번에 되돌리기
git revert -m 1 a1b2c3  # user-auth 기능 전체 롤백

# --no-ff 없으면 커밋 하나씩 revert 필요
git revert d4e5f6
git revert g7h8i9
```

#### 3. 코드 리뷰 추적
```bash
# PR 승인 후 merge
git merge --no-ff feature/user-auth -m "Merge PR #123: 사용자 인증 기능"

# 나중에 PR과 커밋 연결 가능
```

### 단점 ⚠️

#### 1. 히스토리 복잡
```bash
# 많은 브랜치가 merge되면 그래프가 복잡
*   M1
|\
| *   M2
| |\
| | *
| |/
|/
*
```

#### 2. 불필요한 merge 커밋
```bash
# 사소한 수정에도 merge 커밋 생성
*   Merge branch 'fix/typo'
|\
| * Fix typo in README
|/
* Previous commit
```

---

## 🎯 실전 전략 가이드

### 시나리오별 사용법

#### 1. 개인 Feature 브랜치 개발

```bash
# 매일 아침: main의 최신 변경사항 가져오기
git checkout feature/my-work
git fetch origin
git rebase origin/main  # ✅ rebase 사용

# 이유:
# - 로컬 브랜치라 안전
# - 선형 히스토리 유지
# - 충돌 조기 발견
```

#### 2. Feature 완료 후 Main에 통합

```bash
# main에 merge할 때
git checkout main
git merge --no-ff feature/my-work  # ✅ --no-ff 사용

# 이유:
# - 기능 단위 추적
# - 롤백 용이
# - PR/기능 히스토리 보존
```

#### 3. 핫픽스 (긴급 수정)

```bash
# 빠른 수정은 fast-forward 허용
git checkout main
git merge hotfix/critical-bug  # --no-ff 생략

# 이유:
# - 단일 커밋이라 추적 불필요
# - 긴급하므로 빠르게 처리
```

#### 4. 대규모 팀 협업

```bash
# 공유 브랜치는 절대 rebase 금지
git checkout shared-feature
git merge main  # ✅ merge 사용 (rebase ❌)

# main에 통합 시
git checkout main
git merge --no-ff shared-feature  # ✅ --no-ff 사용
```

---

## 📊 비교표

| 항목 | `rebase` | `merge --no-ff` | `merge` (기본) |
|------|----------|-----------------|----------------|
| **히스토리** | 선형 (깔끔) | 브랜치 보존 | 자동 판단 |
| **커밋 수정** | O (위험) | X (안전) | X (안전) |
| **롤백** | 커밋별 | 기능 단위 | 혼재 |
| **충돌 해결** | 커밋마다 | 한 번에 | 한 번에 |
| **추적성** | 낮음 | 높음 | 중간 |
| **공개 브랜치** | ❌ 금지 | ✅ 안전 | ✅ 안전 |
| **로컬 브랜치** | ✅ 권장 | ⚠️ 선택 | ⚠️ 선택 |

---

## 🏆 권장 워크플로우

### 프로젝트 규칙 설정

```bash
# .git/config 또는 전역 설정
[merge]
    ff = false  # 항상 --no-ff (기능 추적 중시)
    # 또는
    ff = only   # fast-forward만 허용 (선형 중시)
```

### 실무 예시

```bash
# 1. Feature 브랜치 생성
git checkout -b feature/user-profile

# 2. 작업 중 매일 rebase (선형 유지)
git fetch origin
git rebase origin/main

# 3. 작업 완료 후 정리 (선택)
git rebase -i HEAD~5  # 마지막 5개 커밋 정리

# 4. Main에 PR 후 merge (기능 추적)
# GitHub에서: "Create a merge commit" 선택 (--no-ff와 동일)
# 또는 로컬에서:
git checkout main
git merge --no-ff feature/user-profile
```

---

## 🎓 핵심 정리

### Rebase를 사용하세요

```
✅ 로컬 feature 브랜치 업데이트
✅ 커밋 히스토리 정리 (interactive rebase)
✅ 선형 히스토리 선호하는 팀
```

### --no-ff를 사용하세요

```
✅ Feature를 main에 merge
✅ 기능 단위 추적이 중요한 프로젝트
✅ 롤백 가능성이 있는 큰 기능
```

### 조합 전략 (Best Practice)

```bash
# 개발 중: rebase로 선형 유지
git checkout feature/my-work
git rebase main

# 완료 후: --no-ff로 기능 보존
git checkout main
git merge --no-ff feature/my-work
```

**결과**: "개발 중엔 깔끔하고, 통합 후엔 추적 가능"한 최적의 히스토리 유지! 🚀

---

## 🔧 고급 기법

### Interactive Rebase

```bash
# 마지막 5개 커밋 정리
git rebase -i HEAD~5

# 에디터에서:
pick a1b2c3 feat: 기능 A 추가
squash d4e5f6 fix: 오타 수정  # 이전 커밋에 합치기
reword g7h8i9 feat: 기능 B 추가  # 메시지 수정
drop j0k1l2 temp: 임시 커밋  # 삭제
```

### Rebase 충돌 해결

```bash
# 충돌 발생 시
git rebase main
# CONFLICT (content): Merge conflict in file.ts

# 1. 충돌 파일 수정
vim file.ts

# 2. 스테이징
git add file.ts

# 3. 계속 진행
git rebase --continue

# 또는 중단
git rebase --abort
```

### Merge 커밋 메시지 커스터마이징

```bash
# 상세한 merge 커밋 메시지
git merge --no-ff feature/user-auth -m "$(cat <<EOF
Merge feature/user-auth into main

기능 요약:
- JWT 기반 인증 구현
- 비밀번호 암호화 (bcrypt)
- 리프레시 토큰 지원

리뷰어: @reviewer
PR: #123
EOF
)"
```

---

## 📚 참고 자료

- [Git 공식 문서 - Rebase](https://git-scm.com/docs/git-rebase)
- [Git 공식 문서 - Merge](https://git-scm.com/docs/git-merge)
- [Atlassian Git Tutorial - Merging vs Rebasing](https://www.atlassian.com/git/tutorials/merging-vs-rebasing)

---

**문서 버전**: v1.0
**최종 업데이트**: 2025-12-27
**작성자**: 개발팀
