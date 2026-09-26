// English / Arabic strings. Arabic switches the page to right-to-left.

const STR = {
  en: {
    level: 'Level {n}',
    dailyTitle: 'Daily ⭐',
    daily: 'Daily',
    tut1: 'Tap an arrow to slide it off the cube',
    tut2: 'Drag to spin the cube — arrows hide on every side',
    tut3: 'Golden arrows ✨ are worth triple points!',
    tut4: 'A blocked arrow costs a heart ❤️ Look before you tap!',
    tut5: 'Stuck? Tap the 💡 for a hint',
    tut6: 'Frozen arrows ❄️ need one tap to crack the ice first',
    tut7: 'Free 8 arrows quickly to start 🔥 FEVER: double points!',
    tut8: 'Bomb arrows 💣 blast away their neighbours when freed!',
    praise5: 'Nice!', praise10: 'Great!', praise15: 'Amazing!', praise20: 'Unstoppable!', praise30: 'Legendary!',
    fever: '🔥 FEVER ×2',
    feverShort: 'FEVER',
    boom: 'BOOM!',
    crack: 'Crack!',
    win1: 'Cleared!', win2: 'Great job!', win3: 'Perfect!',
    points: 'points', time: 'time', arrows: 'arrows',
    hintYes: 'Flawless! +1 💡 hint',
    hintNo: 'No mistakes = +1 💡 hint',
    next: 'Next level ›',
    continueLevels: 'Back to levels ›',
    replay: 'Replay',
    share: 'Share result',
    copied: 'Copied to clipboard!',
    shareText: 'Foz Arrows · Daily {date}\n{stars}  ⏱ {time}  🔥 {streak}',
    streakLine: 'Daily streak: 🔥 {n}',
    loseTitle: 'Out of hearts 💔',
    loseText: 'You freed {a} of {b} arrows ({p}%). So close!',
    retry: 'Try again',
    settings: 'Settings',
    sound: 'Sound',
    vibration: 'Vibration',
    language: 'Language',
    style: 'Cube style',
    styleLocked: 'Earn {n} ★ to unlock',
    newSkin: '🎨 New cube style unlocked: {name}!',
    howto: '<b>How to play:</b> tap an arrow to slide it off the cube in the direction it points. It can only leave if nothing is in its way until the edge of its face. Tapping a blocked arrow costs a ❤️. <b>Drag</b> to spin the cube, <b>pinch</b> to zoom.<br>✨ Golden = triple points · ❄️ Frozen = tap twice · 💣 Bomb = clears its neighbours · Free 8 arrows fast for 🔥 FEVER!',
    resume: 'Resume',
    restart: 'Restart level',
    reset: 'Reset progress',
    resetConfirm: 'Reset all progress?',
    lbTitle: '🏆 Leaderboard',
    lbPlaceholder: 'Your nickname',
    join: 'Join',
    rename: 'Rename',
    close: 'Close',
    loading: 'Loading…',
    saving: 'Saving…',
    players: '{n} players',
    player1: '1 player',
    noScores: 'No scores yet. Be the first!',
    lbError: "Couldn't load the leaderboard. Check your connection.",
    lv: 'Lv {n}',
    joinRanking: 'Join the world ranking 🏆',
    updatingRank: 'Updating ranking…',
    yourRank: "🏆 You're <b>#{n}</b> worldwide",
    seeLb: '🏆 See the leaderboard',
    skin_classic: 'Classic', skin_candy: 'Candy', skin_ocean: 'Ocean', skin_oasis: 'Oasis', skin_neon: 'Neon', skin_royal: 'Royal',
  },
  ar: {
    level: 'المستوى {n}',
    dailyTitle: 'تحدي اليوم ⭐',
    daily: 'اليومي',
    tut1: 'اضغط على سهم لينزلق خارج المكعب',
    tut2: 'اسحب لتدوير المكعب — الأسهم مختبئة في كل الجهات',
    tut3: 'الأسهم الذهبية ✨ تمنحك ثلاثة أضعاف النقاط!',
    tut4: 'السهم المحجوب يكلّفك قلباً ❤️ انظر قبل أن تضغط!',
    tut5: 'علقت؟ اضغط 💡 للحصول على تلميح',
    tut6: 'الأسهم المتجمدة ❄️ تحتاج ضغطة لكسر الجليد أولاً',
    tut7: 'حرّر ٨ أسهم بسرعة لتشعل 🔥 وضع الحماس: نقاط مضاعفة!',
    tut8: 'أسهم القنابل 💣 تفجّر الأسهم المجاورة عند خروجها!',
    praise5: 'رائع!', praise10: 'ممتاز!', praise15: 'مذهل!', praise20: 'لا يُوقَف!', praise30: 'أسطوري!',
    fever: '🔥 حماس ×٢',
    feverShort: 'حماس',
    boom: 'بووم!',
    crack: 'طَق!',
    win1: 'تم!', win2: 'أحسنت!', win3: 'مثالي!',
    points: 'نقطة', time: 'الوقت', arrows: 'سهم',
    hintYes: 'بلا أخطاء! +١ 💡 تلميح',
    hintNo: 'العب بلا أخطاء = +١ 💡 تلميح',
    next: 'المستوى التالي ›',
    continueLevels: 'العودة للمستويات ›',
    replay: 'إعادة اللعب',
    share: 'شارك نتيجتك',
    copied: 'تم النسخ!',
    shareText: 'أسهم فوز · تحدي {date}\n{stars}  ⏱ {time}  🔥 {streak}',
    streakLine: 'سلسلة الأيام: 🔥 {n}',
    loseTitle: 'نفدت القلوب 💔',
    loseText: 'حرّرت {a} من {b} سهماً ({p}٪). كنت قريباً جداً!',
    retry: 'حاول مجدداً',
    settings: 'الإعدادات',
    sound: 'الصوت',
    vibration: 'الاهتزاز',
    language: 'اللغة',
    style: 'شكل المكعب',
    styleLocked: 'اجمع {n} ★ لفتحه',
    newSkin: '🎨 فتحت شكلاً جديداً للمكعب: {name}!',
    howto: '<b>طريقة اللعب:</b> اضغط على سهم لينزلق خارج المكعب في الاتجاه الذي يشير إليه. لا يخرج إلا إذا كان طريقه خالياً حتى حافة الوجه. الضغط على سهم محجوب يكلّفك ❤️. <b>اسحب</b> لتدوير المكعب، و<b>اقرص</b> للتكبير.<br>✨ ذهبي = نقاط ×٣ · ❄️ متجمد = اضغط مرتين · 💣 قنبلة = تفجّر ما حولها · حرّر ٨ أسهم بسرعة لتشعل 🔥 الحماس!',
    resume: 'متابعة',
    restart: 'إعادة المستوى',
    reset: 'مسح التقدم',
    resetConfirm: 'هل تريد مسح كل التقدم؟',
    lbTitle: '🏆 لوحة الصدارة',
    lbPlaceholder: 'اسمك المستعار',
    join: 'انضم',
    rename: 'تغيير الاسم',
    close: 'إغلاق',
    loading: 'جارٍ التحميل…',
    saving: 'جارٍ الحفظ…',
    players: '{n} لاعب',
    player1: 'لاعب واحد',
    noScores: 'لا توجد نتائج بعد. كن الأول!',
    lbError: 'تعذّر تحميل لوحة الصدارة. تحقّق من اتصالك.',
    lv: 'م {n}',
    joinRanking: 'انضم إلى التصنيف العالمي 🏆',
    updatingRank: 'جارٍ تحديث التصنيف…',
    yourRank: '🏆 ترتيبك <b>#{n}</b> عالمياً',
    seeLb: '🏆 عرض لوحة الصدارة',
    skin_classic: 'كلاسيكي', skin_candy: 'حلوى', skin_ocean: 'محيط', skin_oasis: 'واحة', skin_neon: 'نيون', skin_royal: 'ملكي',
  },
};

export let lang = 'en';

export function detectLang(saved) {
  if (saved && STR[saved]) return saved;
  return (navigator.language || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

const nf = { en: new Intl.NumberFormat('en-US'), ar: new Intl.NumberFormat('ar-EG') };
/** Formats a number with the current language's digits. */
export const fmt = (n) => nf[lang].format(n);

export function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  // Isolated left-to-right so "1:05" doesn't flip in Arabic text.
  return '\u2066' + fmt(m) + ':' + (s < 10 ? fmt(0) : '') + fmt(s) + '\u2069';
}

/** Looks up a string and fills {placeholders}. Numbers are formatted. */
export function t(k, vars = {}) {
  const s = STR[lang][k] ?? STR.en[k] ?? k;
  return s.replace(/\{(\w+)\}/g, (_, v) => (typeof vars[v] === 'number' ? fmt(vars[v]) : vars[v] ?? ''));
}

export function setLang(l) {
  lang = STR[l] ? l : 'en';
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
}
