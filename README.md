# Hardcore Game

픽셀아트 세로형 탑 등반 게임 (영구 사망 영웅, 무기 제작). Phaser + Capacitor, Android 우선.

- 기획서: [docs/GDD.md](docs/GDD.md)
- 1단계: [docs/STAGE1.md](docs/STAGE1.md) — 자동전투 + 탑 10층
- 2단계: [docs/STAGE2.md](docs/STAGE2.md) — 랜덤 영웅·종족, 영구 사망, 귀환, 추모의 벽, 적 20종
- 3단계: [docs/STAGE3.md](docs/STAGE3.md) — 던전 3곳, 재료, 대장간 미니게임, 직업 전용 무기, 피로도

## 실행

```bash
npm install
npm run dev          # 개발 서버 (같은 와이파이의 폰에서 표시된 Network 주소로 접속 가능)
npm run build        # dist/ 빌드
npm run build:single # dist-single/index.html 한 파일 빌드 (공유용)
npm run sim          # 밸런스 시뮬레이션 (층별·던전별 승률)
# 외형 확인: npm run dev 후 /tools/faces.html (?mode=face | monsters)
```

## 구조

```
src/
  battle/   전투 로직 (Phaser 없음 → 시뮬레이션과 화면이 같은 코드 사용)
  data/     직업, 종족, 몬스터, 층, 영웅 생성, 특성 데이터
  art/      영웅 외형 생성기(32×32 레이어), 몬스터 임시 스프라이트, 무기·재료 아이콘
  scenes/   Phaser 화면 (Boot → 기지(대장간) / 영웅 / 탑 / 던전 / 도감 탭 → 전투·대장간 미니게임)
  ui/       테마, 버튼, 하단 탭, 영웅 카드 등 공용 UI
  progress.ts  전투 결과 반영 (중상·사망·경험치·피로·재료)
  state.ts     저장 데이터
tools/
  sim.ts    헤드리스 밸런스 시뮬레이터
  faces.*   외형 확인 페이지
```

폰트: [Galmuri](https://github.com/quiple/galmuri) (SIL OFL 1.1)
