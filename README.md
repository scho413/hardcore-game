# Hardcore Game

픽셀아트 세로형 탑 등반 게임 (영구 사망 영웅, 무기 제작). Phaser + Capacitor, Android 우선.

- 기획서: [docs/GDD.md](docs/GDD.md)
- 1단계: [docs/STAGE1.md](docs/STAGE1.md) — 자동전투 + 탑 10층
- 2단계: [docs/STAGE2.md](docs/STAGE2.md) — 랜덤 영웅, 영구 사망, 귀환, 추모의 벽

## 실행

```bash
npm install
npm run dev          # 개발 서버 (같은 와이파이의 폰에서 표시된 Network 주소로 접속 가능)
npm run build        # dist/ 빌드
npm run build:single # dist-single/index.html 한 파일 빌드 (공유용)
npm run sim          # 밸런스 시뮬레이션 (층별 승률)
```

## 구조

```
src/
  battle/   전투 로직 (Phaser 없음 → 시뮬레이션과 화면이 같은 코드 사용)
  data/     직업, 몬스터, 층, 영웅 생성, 특성 데이터
  art/      임시 픽셀 스프라이트 + 영웅 외형 조합 (에셋 팩 선정 후 교체)
  scenes/   Phaser 화면 (Boot → 탑 / 영웅 / 도감 탭 → 전투)
  ui/       테마, 버튼, 하단 탭, 영웅 카드 등 공용 UI
  progress.ts  전투 결과 반영 (중상·사망·경험치)
  state.ts     저장 데이터
tools/
  sim.ts    헤드리스 밸런스 시뮬레이터
```

폰트: [Galmuri](https://github.com/quiple/galmuri) (SIL OFL 1.1)
