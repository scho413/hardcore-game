// 영웅 이름: 종족·성별별 음절 조합. 원작 이름은 쓰지 않습니다 (GDD 1 IP 주의).
import type { Gender } from '../art/heroArt';
import type { RaceId } from './races';

type Syl = { first: string[]; mid: string[]; last: string[]; threeChance: number };

/** 여성 이름 끝 음절 (종족별). 앞·가운데 음절은 공용 */
const LAST_F: Record<RaceId, string[]> = {
  human: ['나', '아', '린', '엘', '라', '리', '미', '세', '샤', '니', '렌'],
  barbarian: ['가', '라', '샤', '야', '나', '카', '루', '레'],
  elf: ['리아', '엘', '린', '네', '아', '이스', '라', '윈', '셀'],
  dwarf: ['다', '나', '리', '가', '라', '디', '마'],
  beastfolk: ['미', '냥', '코', '루', '삐', '나', '리', '쿠'],
};

const SETS: Record<RaceId, Syl> = {
  human: {
    first: ['카', '레', '시', '노', '에', '로', '하', '유', '데', '마', '리', '세', '아', '루', '벨', '미', '소', '오', '헤', '이'],
    mid: ['리', '르', '나', '로', '에', '아'],
    last: ['온', '스', '안', '든', '빈', '노', '카', '크', '드', '우스', '론'],
    threeChance: 0.2,
  },
  barbarian: {
    first: ['그', '라', '쿠', '토', '보', '가', '우', '드', '하', '카', '브', '크'],
    mid: ['라', '로', '루', '가'],
    last: ['크', '그', '르', '탄', '록', '쿤', '즈', '가', '쉬', '둔'],
    threeChance: 0.25,
  },
  elf: {
    first: ['엘', '아', '실', '리', '세', '네', '라', '이', '파', '루', '갈', '셀'],
    mid: ['라', '리', '에', '나', '로', '윈', '디'],
    last: ['린', '엘', '아', '스', '엔', '온', '리아', '델', '윈', '니엘'],
    threeChance: 0.6,
  },
  dwarf: {
    first: ['브', '도', '그', '토', '바', '군', '두', '보', '트', '키', '모', '발'],
    mid: ['로', '린', '가', '룸'],
    last: ['린', '단', '롬', '그', '릭', '덴', '굼', '복', '트', '린', '돌'],
    threeChance: 0.3,
  },
  beastfolk: {
    first: ['토', '모', '코', '뭉', '보', '나', '쿠', '치', '포', '루', '미', '삐'],
    mid: ['코', '루', '미', '토'],
    last: ['토', '치', '루', '코', '미', '롱', '냥', '몽', '삐', '둥', '리'],
    threeChance: 0.15,
  },
};

export function randomName(rand: () => number, taken: Set<string>, race: RaceId = 'human', gender: Gender = 'm'): string {
  const s = gender === 'f' ? { ...SETS[race], last: LAST_F[race] } : SETS[race];
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  for (let i = 0; i < 60; i++) {
    const n = rand() < s.threeChance ? pick(s.first) + pick(s.mid) + pick(s.last) : pick(s.first) + pick(s.last);
    if (!taken.has(n) && n[0] !== n[1]) return n;
  }
  return pick(s.first) + pick(s.last) + Math.floor(rand() * 90 + 10);
}
