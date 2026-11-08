// English / Arabic strings. Arabic switches the page to right-to-left.

const STR = {
  en: {
    level: 'Level {n}',
    dailyTitle: 'Daily ⭐',
    daily: 'Daily',
    levels: 'Levels',
    tut1: 'Tap an arrow to slide it out',
    tut2: 'An arrow can only leave if nothing blocks its way to the edge',
    tut3: 'Tapping a blocked arrow costs a 💧 — you have 3',
    tut4: 'Pinch to zoom in on big boards',
    tut5: 'Stuck? The 💡 hint numbers your next moves',
    praise5: 'Nice!', praise10: 'Great!', praise15: 'Amazing!', praise20: 'Unstoppable!', praise30: 'Legendary!',
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
    loseTitle: 'Out of drops 💧',
    loseText: 'You freed {a} of {b} arrows ({p}%). So close!',
    retry: 'Try again',
    settings: 'Settings',
    sound: 'Sound',
    vibration: 'Vibration',
    darkMode: 'Dark mode',
    language: 'Language',
    palette: 'Arrow colours',
    styleLocked: 'Earn {n} ★ to unlock',
    newSkin: '🎨 New arrow colour unlocked: {name}!',
    howto: '<b>How to play:</b> tap an arrow to slide it off the board in the direction it points. It can only leave if nothing is in its way all the way to the edge. Tapping a blocked arrow costs a 💧; lose all 3 and you start the level again. <b>Pinch</b> to zoom and <b>drag</b> to move around big boards. The 💡 hint shows your next moves in order: tap the 1s first, then the 2s.',
    resume: 'Resume',
    restart: 'Restart level',
    reset: 'Reset progress',
    resetConfirm: 'Reset all progress?',
    levelLocked: 'Clear level {n} first',
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
    achTitle: '🏅 Achievements',
    achReward: 'Achievement unlocked · +1 💡',
    ach_first: 'First Steps', achd_first: 'Clear your first level',
    ach_combo20: 'On Fire', achd_combo20: 'Free 20 arrows in a quick row',
    ach_flawless10: 'Perfectionist', achd_flawless10: 'Get 3 stars on 10 levels',
    ach_daily: 'Daily Player', achd_daily: 'Finish a Daily Challenge',
    ach_streak7: 'Dedicated', achd_streak7: 'Reach a 7-day daily streak',
    ach_speed: 'Speedster', achd_speed: 'Clear 30+ arrows in under a minute',
    ach_level50: 'Getting Good', achd_level50: 'Reach level 50',
    ach_level100: 'Centurion', achd_level100: 'Reach level 100',
    ach_level250: 'Maze Runner', achd_level250: 'Reach level 250',
    ach_level500: 'Arrow Master', achd_level500: 'Reach level 500',
    pal_classic: 'Classic', pal_ink: 'Ink', pal_ocean: 'Ocean', pal_rose: 'Rose', pal_forest: 'Forest', pal_violet: 'Violet', pal_sunset: 'Sunset',
  },
  ar: {
    level: 'المستوى {n}',
    dailyTitle: 'تحدي اليوم ⭐',
    daily: 'اليومي',
    levels: 'المستويات',
    tut1: 'اضغط على سهم ليخرج من اللوحة',
    tut2: 'لا يخرج السهم إلا إذا كان طريقه إلى الحافة خالياً',
    tut3: 'الضغط على سهم محجوب يكلّفك 💧 — لديك ٣',
    tut4: 'اقرص للتكبير في اللوحات الكبيرة',
    tut5: 'علقت؟ التلميح 💡 يرقّم حركاتك التالية',
    praise5: 'رائع!', praise10: 'ممتاز!', praise15: 'مذهل!', praise20: 'لا يُوقَف!', praise30: 'أسطوري!',
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
    loseTitle: 'نفدت القطرات 💧',
    loseText: 'حرّرت {a} من {b} سهماً ({p}٪). كنت قريباً جداً!',
    retry: 'حاول مجدداً',
    settings: 'الإعدادات',
    sound: 'الصوت',
    vibration: 'الاهتزاز',
    darkMode: 'الوضع الليلي',
    language: 'اللغة',
    palette: 'ألوان الأسهم',
    styleLocked: 'اجمع {n} ★ لفتحه',
    newSkin: '🎨 فتحت لوناً جديداً للأسهم: {name}!',
    howto: '<b>طريقة اللعب:</b> اضغط على سهم لينزلق خارج اللوحة في الاتجاه الذي يشير إليه. لا يخرج إلا إذا كان طريقه خالياً حتى الحافة. الضغط على سهم محجوب يكلّفك 💧، وإذا فقدت الثلاث تعيد المستوى. <b>اقرص</b> للتكبير و<b>اسحب</b> للتنقل في اللوحات الكبيرة. التلميح 💡 يعرض حركاتك التالية بالترتيب: اضغط أسهم ١ أولاً ثم أسهم ٢.',
    resume: 'متابعة',
    restart: 'إعادة المستوى',
    reset: 'مسح التقدم',
    resetConfirm: 'هل تريد مسح كل التقدم؟',
    levelLocked: 'أنهِ المستوى {n} أولاً',
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
    achTitle: '🏅 الإنجازات',
    achReward: 'إنجاز جديد · +١ 💡',
    ach_first: 'الخطوة الأولى', achd_first: 'أنهِ أول مستوى',
    ach_combo20: 'مشتعل', achd_combo20: 'حرّر ٢٠ سهماً متتالياً بسرعة',
    ach_flawless10: 'الكمال', achd_flawless10: 'احصل على ٣ نجوم في ١٠ مستويات',
    ach_daily: 'لاعب يومي', achd_daily: 'أنهِ تحدي اليوم',
    ach_streak7: 'مثابر', achd_streak7: 'حافظ على سلسلة ٧ أيام',
    ach_speed: 'سريع البرق', achd_speed: 'حرّر أكثر من ٣٠ سهماً في أقل من دقيقة',
    ach_level50: 'في تحسّن', achd_level50: 'صِل إلى المستوى ٥٠',
    ach_level100: 'المئوي', achd_level100: 'صِل إلى المستوى ١٠٠',
    ach_level250: 'عدّاء المتاهة', achd_level250: 'صِل إلى المستوى ٢٥٠',
    ach_level500: 'سيد الأسهم', achd_level500: 'صِل إلى المستوى ٥٠٠',
    pal_classic: 'كلاسيكي', pal_ink: 'حبر', pal_ocean: 'محيط', pal_rose: 'وردي', pal_forest: 'غابة', pal_violet: 'بنفسجي', pal_sunset: 'غروب',
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
const nfPlain = { en: new Intl.NumberFormat('en-US', { useGrouping: false }), ar: new Intl.NumberFormat('ar-EG', { useGrouping: false }) };
/** Formats a number without thousands separators (level numbers). */
export const fmtPlain = (n) => nfPlain[lang].format(n);

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
