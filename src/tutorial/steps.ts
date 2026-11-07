// 튜토리얼 (GDD 12.1): 이야기 → 대사창 + 하이라이트로 한 단계씩. 튜토리얼 중엔 강조된 곳만 누를 수 있음
import type { ClassId } from '../data/classes';

/** 말하는 사람: 기록관(안내), 처음 영웅 두 명, 새로 모집한 영웅 */
export type Speaker = 'guide' | 'hero0' | 'hero1' | 'newest';

export interface TutStep {
  id: string;
  /** 이 단계가 나오는 화면 (scene key) */
  scene: string;
  speaker: Speaker;
  text: string;
  /** 강조할 대상 (화면이 mark로 등록한 이름) */
  target?: string;
  /** tap: 아무 데나 눌러 넘김 / action: 강조된 곳을 눌러야 넘어감 */
  mode: 'tap' | 'action';
}

export const GUIDE_NAME = '기록관 오렌';

export const STEPS: TutStep[] = [
  { id: 'story', scene: 'story', speaker: 'guide', text: '', mode: 'tap' },
  // ── 탑 입구 ──
  { id: 'formation', scene: 'tower', speaker: 'guide', target: 'formation', mode: 'tap', text: '여기는 탑 입구야. 아래쪽이 진형이지.\n앞줄(전열)이 먼저 맞고, 뒷줄은 조금 더 안전해.' },
  { id: 'hello0', scene: 'tower', speaker: 'hero0', target: 'slot0', mode: 'tap', text: '' },
  { id: 'hello1', scene: 'tower', speaker: 'hero1', target: 'slot1', mode: 'tap', text: '' },
  { id: 'unknown', scene: 'tower', speaker: 'guide', target: 'scout', mode: 'tap', text: '처음 오르는 층은 적이 보이지 않아.\n한 번 부딪혀 봐야 무엇이 기다리는지 알 수 있지. 그게 이 탑이야.' },
  { id: 'go1', scene: 'tower', speaker: 'guide', target: 'go', mode: 'action', text: '준비됐으면 1층에 도전하자.' },
  // ── 전투 ──
  { id: 'auto', scene: 'battle', speaker: 'guide', mode: 'tap', text: '전투는 자동이야. 영웅들이 알아서 싸우지.\n너는 싸우기 전에 누구를 어디에 세울지만 정하면 돼.' },
  { id: 'speed', scene: 'battle', speaker: 'guide', target: 'speed', mode: 'tap', text: '답답하면 배속 버튼을 눌러. 1배속 · 2배속 · 3배속.' },
  { id: 'result', scene: 'battle', speaker: 'guide', target: 'rewards', mode: 'tap', text: '이기면 경험치와 골드, 재료를 얻어.\n경험치가 쌓이면 레벨이 오르지.' },
  { id: 'stamina', scene: 'battle', speaker: 'guide', mode: 'tap', text: '그리고 기력. 탑에 오르면 기력이 5 줄어.\n최대 10이고 6분마다 1씩 돌아와. 기력이 모자라면 출전할 수 없고, 지친 채로 싸우면 약해져.' },
  { id: 'home', scene: 'battle', speaker: 'guide', target: 'leave', mode: 'action', text: '수고했어. 기지로 돌아가자.' },
  // ── 기지 ──
  { id: 'town', scene: 'base', speaker: 'guide', mode: 'tap', text: '여기가 우리 기지야.\n건물을 지어서 영웅들을 돌보고, 키우고, 무장시키지.' },
  { id: 'plot', scene: 'base', speaker: 'guide', target: 'plot-recruit', mode: 'action', text: '둘만으로는 부족해. 모집소를 지어 보자.' },
  { id: 'build', scene: 'base', speaker: 'guide', target: 'build', mode: 'action', text: '이번 건설은 공짜야. 건설을 눌러.' },
  { id: 'odds', scene: 'base', speaker: 'guide', target: 'odds', mode: 'tap', text: '모집소 레벨이 오를수록 높은 등급 영웅이 나올 확률이 올라가.\n하루 1명은 무료, 광고를 보면 2명 더.' },
  { id: 'recruit', scene: 'base', speaker: 'guide', target: 'recruitFree', mode: 'action', text: '한 명 불러 보자.' },
  { id: 'newhero', scene: 'base', speaker: 'newest', target: 'recruited', mode: 'tap', text: '' },
  { id: 'close', scene: 'base', speaker: 'guide', target: 'close', mode: 'action', text: '새 동료를 진형에 넣어 주자. 창을 닫아.' },
  { id: 'tabTower', scene: 'base', speaker: 'guide', target: 'tab-tower', mode: 'action', text: '탑으로 가자.' },
  // ── 진형 배치 ──
  { id: 'slot', scene: 'tower', speaker: 'guide', target: 'slot-empty', mode: 'action', text: '비어 있는 칸을 눌러.' },
  { id: 'pick', scene: 'tower', speaker: 'guide', target: 'pick-new', mode: 'action', text: '새 영웅을 골라.' },
  { id: 'go2', scene: 'tower', speaker: 'guide', target: 'go', mode: 'tap', text: '좋아, 셋이 됐어. 다음은 2층이야.\n이제부턴 네 판단이야. 다치면 쉬게 하고, 위험해 보이면 물러나는 것도 실력이지.' },
];

export const TUT_DONE = STEPS.length;
export const stepIndex = (id: string) => STEPS.findIndex((s) => s.id === id);

/** 처음 영웅이 하는 인사 (직업별) */
export const GREETING: Record<ClassId, (name: string) => string> = {
  knight: (n) => `저는 ${n}. 제 방패 뒤에 서십시오.\n누구도 먼저 쓰러지게 두지 않겠습니다.`,
  warrior: (n) => `내 이름은 ${n}! 싸울 상대는 어디 있지?\n앞장서는 건 내가 맡지.`,
  archer: (n) => `저는 ${n}, 궁수예요. 멀리서 지켜볼게요.\n제 화살은 빗나가지 않아요.`,
  mage: (n) => `${n}... 마력은 충분합니다.\n적이 많을수록 좋지요.`,
  priest: (n) => `${n}입니다. 다치면 저를 부르세요.\n모두 살아서 돌아가요.`,
};

// ─── 상황별 도움말: 처음 겪을 때 한 번 ───
export const TIPS: Record<string, string> = {
  injury: '중상을 입은 영웅은 회복될 때까지 출전할 수 없어.\n병원을 지으면 더 빨리 낫지.',
  death: '...탑에서 쓰러진 영웅은 돌아오지 않아.\n하지만 살아서 많은 걸 해낸 영웅은 기지에 유산을 남기지. 도감의 "죽은 영웅"에서 볼 수 있어.',
  zone: '새 구간이야. 적도, 싸우는 방식도 달라.\n처음 가는 층은 정보가 없으니 조심해.',
  boss: '보스 층이야. 보스는 강력한 기술을 쓰고, 체력이 줄면 더 위험해지기도 해.\n파티와 진형을 단단히 준비해.',
};
