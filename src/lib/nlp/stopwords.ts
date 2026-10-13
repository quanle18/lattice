/**
 * Multilingual stopword sets.
 *
 * Deliberately small and transparent — this is not meant to be exhaustive
 * linguistics, it is meant to keep keyword extraction clean at $0 with no
 * model downloads. Words are stored lowercased.
 */

const EN = `a about above after again against all am an and any are aren't as at be because been before being below between both but by can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves also may might must shall will upon within without among across per via etc ie eg thereby therefore however moreover furthermore thus hence whereas although though since whether either neither given whose being able according based toward towards often many much less least one two three new used using use uses including include included include can rather unlike others argue argues argued suggests suggest note notes noted claims claim shows show says said finds find several various numerous`;

const VI = `và của là các có cho không được trong với này đó những một hai ba như để từ đến trên dưới khi thì mà nếu vì nên về theo tại cũng đã sẽ đang bị các một những nhiều ít rất hơn kém cùng nhưng hoặc do bởi ở ra vào lên xuống lại nữa chỉ còn phải nếu như tuy rằng mặc dù bởi vì cho nên`;

const FR = `le la les un une des du de d et en à au aux pour par avec sans sous sur dans entre vers chez est sont était étaient être avoir a ont ce cette ces qui que quoi dont où mais ou et donc or ni car si comme plus moins très tout tous toute toutes même aussi ainsi`;

const ES = `el la los las un una unos unas de del y o en a para por con sin sobre entre hacia desde es son era eran ser estar ha han este esta estos estas que quien cuyo donde pero si como mas menos muy todo todos toda todas mismo tambien asi`;

const DE = `der die das den dem des ein eine einen einem einer und oder aber wenn wie als bei mit ohne über unter für von zu aus nach vor durch ist sind war waren sein haben hat habe wird werden nicht auch nur noch schon sehr mehr weniger alle jeder jede jedes`;

const PT = `o a os as um uma uns umas de do da dos das e ou em para por com sem sobre entre ate desde e sao era ser estar tem tem este esta estes estas que quem onde mas se como mais menos muito todo todos toda todas mesmo tambem assim`;

function toSet(s: string): Set<string> {
  return new Set(
    s
      .split(/\s+/)
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const STOPWORDS: Record<string, Set<string>> = {
  en: toSet(EN),
  vi: toSet(VI),
  fr: toSet(FR),
  es: toSet(ES),
  de: toSet(DE),
  pt: toSet(PT),
};

/** Union used when we cannot detect a language. */
export const ALL_STOPWORDS: Set<string> = (() => {
  const all = new Set<string>();
  for (const set of Object.values(STOPWORDS)) for (const w of set) all.add(w);
  return all;
})();

export function isStopword(word: string): boolean {
  const w = word.toLowerCase();
  return ALL_STOPWORDS.has(w);
}
