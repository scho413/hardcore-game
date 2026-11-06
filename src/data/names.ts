// 영웅 이름: 음절 조합. 원작 이름은 쓰지 않습니다 (GDD 1 IP 주의).
const FIRST = ['카', '레', '시', '노', '에', '브', '로', '하', '유', '데', '마', '리', '세', '아', '루', '벨', '도', '키', '라', '제', '미', '소', '오', '타', '피', '헤', '이', '바'];
const MIDDLE = ['리', '르', '나', '로', '에', '아', '이', '드'];
const LAST = ['엘', '온', '린', '람', '스', '노', '르', '나', '크', '드', '트', '안', '윈', '렌', '카', '야', '든', '빈', '즈', '샤'];

export function randomName(rand: () => number, taken: Set<string>): string {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  for (let i = 0; i < 50; i++) {
    const n = rand() < 0.25 ? pick(FIRST) + pick(MIDDLE) + pick(LAST) : pick(FIRST) + pick(LAST);
    if (!taken.has(n)) return n;
  }
  return pick(FIRST) + pick(LAST) + Math.floor(rand() * 90 + 10);
}
