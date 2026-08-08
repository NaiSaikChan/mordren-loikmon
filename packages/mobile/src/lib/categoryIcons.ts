const ICONS: Record<string, string> = {
  '24': '🏛️', // ပရေၚ်ဍုၚ်ကွာန် — Politics
  '29': '🎭', // ဇာတ် — Drama / Fiction
  '30': '🙏', // ဘာသာ — Religion / Language
  '31': '🤝', // ပရေၚ်မၞိဟ် — Human Rights
  '32': '🔬', // သုတေသန — Research
  '33': '🎓', // ပညာစိုတ် — Education
  '34': '⚖️', // သၞောဝ်ဥပဒေ — Law
  '35': '💰', // ပရေၚ်ပိုန်ဒြပ် — Economics
  '38': '📜', // ဝၚ် — History
  '43': '👥', // ပရေၚ်ဂကူ — Ethnic Affairs
  '44': '🔮', // ပုံအာဂီု — Future / Sci-fi
  '46': '✍️', // လိက်ပတ် — Literature
  '51': '🌿', // ပွဳပွူသဘာဝ — Nature / Environment
}

export function getCategoryIcon(id: string | number): string {
  return ICONS[String(id)] ?? '📂'
}
