<p align="center">
  <img src="../assets/cover.png" alt="nitpic" width="640" />
</p>

<h3 align="center">انقر على أي شيء. قل ما المشكلة. وشاهد Claude يصلحها.</h3>

<p align="center">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-91C31C?style=flat-square" alt="رخصة MIT" /></a>
  <img src="https://img.shields.io/badge/Chrome%20Web%20Store-%D9%82%D8%B1%D9%8A%D8%A8%D9%8B%D8%A7-FF8C00?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Web Store" />
  <img src="https://img.shields.io/badge/Claude%20Code-%D8%A5%D8%B6%D8%A7%D9%81%D8%A9-91C31C?style=flat-square&logo=anthropic&logoColor=white" alt="إضافة Claude Code" />
  <a href="https://buymeacoffee.com/jibrilai"><img src="https://img.shields.io/badge/%E2%98%95-%D8%A7%D8%AF%D8%B9%D9%85%D9%86%D9%8A%20%D8%A8%D9%82%D9%87%D9%88%D8%A9-FFDD00?style=flat-square" alt="ادعمني بقهوة" /></a>
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ar.md">العربية</a>
</p>

---

<div dir="rtl">

يربط **nitpic** متصفحك بـ [Claude Code](https://claude.com/claude-code). فعِّل وضع الملاحظات، وانقر على أي عنصر في أي صفحة — سواء `localhost` أو الإنتاج — واكتب ما يجب تغييره ثم أرسِل. يصل تعليقك مع لقطة شاشة مقصوصة وكود HTML الخاص بالعنصر إلى جلسة Claude Code الجارية **وكأنك كتبتها هناك بنفسك**، ويبدأ Claude العمل فورًا.

صُمم للمصممين والمطورين وكل من يراجع تطبيقه في المتصفح ويصلحه في الطرفية.

## ✨ المزايا

- **🎯 أشِر إلى المشكلة** — مرّر لتظليل أي عنصر أو اسحب لتحديد منطقة؛ يلتقط nitpic مُحدِّد CSS ولقطة الشاشة وكود HTML نيابةً عنك
- **⚡ تسليم فوري** — تصل الملاحظات إلى طرفيتك خلال ثانية (يحصل tmux و iTerm2 على حقنٍ حقيقي للمدخلات؛ وفي غيرهما تصل عند الدور التالي لـ Claude)
- **🎛 أنت تختار الجلسة** — اكتب `/nitpic` في جلسة Claude Code التي يجب أن تستمع؛ ونفّذه في جلسة أخرى لنقل الاتصال
- **📚 مراجعات دفعة واحدة** — اجمع التعليقات عبر الصفحات والتبويبات ثم أرسلها كرسالة واحدة مجمّعة حسب الصفحة
- **🫧 لوحة عائمة** — قابلة للسحب والطي إلى كبسولة، ولا تضغط أبدًا على مساحة العرض ولا تُفعِّل نقاط التوقف المتجاوبة
- **🔒 محلي بالكامل** — بلا حسابات ولا خوادم ولا قياس عن بُعد؛ كل شيء يبقى على جهازك
- **🪄 إعداد بلا احتكاك** — يتم الاقتران تلقائيًا؛ لن تنسخ رمزًا ولن تلمس ملف إعدادات أبدًا

## 🚀 البداية السريعة

**١. ثبّت إضافة Chrome** — *(رابط المتجر قريبًا؛ حتى ذلك الحين: `chrome://extensions` ← وضع المطوّر ← تحميل إضافة غير مضغوطة ← `extension/dist`)*

**٢. ثبّت إضافة Claude Code** — الصق في أي جلسة:

</div>

```
/plugin marketplace add jibril4000/nitpic
/plugin install nitpic@nitpic
```

<div dir="rtl">

**٣. اتصل** — في الجلسة التي ستستقبل الملاحظات:

</div>

```
/nitpic
```

<div dir="rtl">

**٤. ابدأ النقد** — انقر على أيقونة nitpic في الصفحة التي تراجعها، ثم **Start feedback**، وانقر على أي عنصر، واكتب تعليقًا، ثم **Send**. هذه هي الدورة كاملة.

## 🧠 كيف يعمل

| طرفيتك | التسليم |
| --- | --- |
| tmux | ⚡ فوري — يُحقن في النافذة المحددة بالضبط |
| iTerm2 | ⚡ فوري — يُحقن عبر واجهة برمجة الجلسات |
| غير ذلك | ⏭ عند حدود الأدوار — يصل عندما ينهي Claude رده الحالي، مع إشعار على سطح المكتب |

تُكتب لقطات الشاشة ومقتطفات HTML في ‎`<project>/.feedback/`‎ (تُضاف تلقائيًا إلى `.gitignore`). وإذا لم تكن هناك جلسة تستمع، تُحفظ الملاحظات في طابور على القرص وتُسلَّم فور اتصال جلسة.

## 🔒 الخصوصية والأمان

كل شيء محلي: يستمع المُبدِّل على ‎`127.0.0.1`‎ فقط، ويمنع رمز الاقتران (المتبادل تلقائيًا) صفحات الويب العشوائية من انتحال الملاحظات. لا تجمع الإضافة أي بيانات.

## 🗺 خارطة الطريق

- [x] Claude Code
- [ ] Cursor
- [ ] Codex
- [ ] Gemini CLI
- [ ] الحقن في طرفية VS Code
- [ ] معاينة أحجام الأجهزة
- [ ] متجر Chrome + اقتران بلا رمز

## ☕ الدعم

إذا وفّر عليك nitpic عشر جولات ذهابًا وإيابًا، [ادعمني بقهوة](https://buymeacoffee.com/jibrilai). صنعه [جبريل](https://linkedin.com/in/jibril-ai).

## 📝 الرخصة

[MIT](../LICENSE)

</div>
