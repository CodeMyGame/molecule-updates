/**
 * Tax labels for POS UI: India uses real GST/CGST/SGST; other languages use
 * jurisdiction-appropriate terms while the engine still splits tax 50/50 (India-style).
 */

export type TaxTerminology = {
  scheme: string;
  componentA: string;
  componentB: string;
  businessTaxId: string;
  foodLicense: string;
  settingsTaxTitle: string;
  settingsTaxSubtitle: string;
  slabsSectionTitle: string;
  splitExplanation: string;
  filingSummaryTitle: string;
  totalTaxable: string;
  totalComponentA: string;
  totalComponentB: string;
  grandTotalTax: string;
};

const EN_IN: TaxTerminology = {
  scheme: 'GST',
  componentA: 'CGST',
  componentB: 'SGST',
  businessTaxId: 'GSTIN',
  foodLicense: 'FSSAI License',
  settingsTaxTitle: 'Tax Configuration',
  settingsTaxSubtitle: 'Configure GST rates and tax behavior.',
  slabsSectionTitle: 'GST Slabs',
  splitExplanation:
    'GST is automatically split into CGST and SGST at equal rates for intra-state transactions.',
  filingSummaryTitle: 'GST summary for filing',
  totalTaxable: 'Total Taxable',
  totalComponentA: 'Total CGST',
  totalComponentB: 'Total SGST',
  grandTotalTax: 'Grand Total Tax',
};

const HI: TaxTerminology = {
  ...EN_IN,
  settingsTaxTitle: 'कर कॉन्फ़िगरेशन',
  settingsTaxSubtitle: 'जीएसटी दरें और कर व्यवहार सेट करें।',
  slabsSectionTitle: 'जीएसटी स्लैब',
  splitExplanation:
    'अंतर-राज्यीय लेनदेन के लिए जीएसटी स्वतः समान दरों पर सीजीएसटी और एसजीएसटी में विभाजित होता है।',
  filingSummaryTitle: 'दाखिल हेतु जीएसटी सारांश',
  totalTaxable: 'कुल कर योग्य',
  totalComponentA: 'कुल सीजीएसटी',
  totalComponentB: 'कुल एसजीएसटी',
  grandTotalTax: 'कुल कर',
};

const TA: TaxTerminology = {
  ...EN_IN,
  settingsTaxTitle: 'வரி உள்ளமைவு',
  settingsTaxSubtitle: 'ஜிஎஸ்டி விகிதங்கள் மற்றும் வரி நடத்தையை அமைக்கவும்.',
  slabsSectionTitle: 'ஜிஎஸ்டி ஸ்லாப்கள்',
  splitExplanation:
    'மாநிலத்திற்குள் பரிவர்த்தனைகளுக்கு ஜிஎஸ்டி சம விகிதங்களில் மத்திய மற்றும் மாநில ஜிஎஸ்டியாக பிரிக்கப்படுகிறது.',
  filingSummaryTitle: 'தாக்கலுக்கான ஜிஎஸ்டி சுருக்கம்',
  totalTaxable: 'மொத்த வரிவிதிப்பு தொகை',
  totalComponentA: 'மொத்த மத்திய ஜிஎஸ்டி',
  totalComponentB: 'மொத்த மாநில ஜிஎஸ்டி',
  grandTotalTax: 'மொத்த வரி',
};

const ZH: TaxTerminology = {
  scheme: '增值税',
  componentA: '中央分成',
  componentB: '地方分成',
  businessTaxId: '纳税人识别号',
  foodLicense: '食品经营许可证',
  settingsTaxTitle: '税费设置',
  settingsTaxSubtitle: '配置增值税税率与含税计价方式。',
  slabsSectionTitle: '税率档次',
  splitExplanation:
    '税额按中央与地方各占一半展示，便于与其他地区税制对照（金额拆分仅为展示逻辑）。',
  filingSummaryTitle: '增值税汇总（申报参考）',
  totalTaxable: '应税金额合计',
  totalComponentA: '中央项合计',
  totalComponentB: '地方项合计',
  grandTotalTax: '税额合计',
};

const JA: TaxTerminology = {
  scheme: '消費税',
  componentA: '国税相当分',
  componentB: '地方税相当分',
  businessTaxId: '登録番号',
  foodLicense: '営業許可・届出番号',
  settingsTaxTitle: '税の設定',
  settingsTaxSubtitle: '消費税率と税込価格の扱いを設定します。',
  slabsSectionTitle: '税率区分',
  splitExplanation:
    '内訳は国税・地方のイメージで半分ずつ表示します（計算上の区分であり、インボイス制度の正式区分ではありません）。',
  filingSummaryTitle: '消費税集計（参考）',
  totalTaxable: '課税標準額（合計）',
  totalComponentA: '国税相当分（合計）',
  totalComponentB: '地方税相当分（合計）',
  grandTotalTax: '消費税合計',
};

const ES: TaxTerminology = {
  scheme: 'IVA',
  componentA: 'Cuota estatal',
  componentB: 'Cuota autonómica',
  businessTaxId: 'NIF-IVA',
  foodLicense: 'Licencia sanitaria',
  settingsTaxTitle: 'Configuración fiscal',
  settingsTaxSubtitle: 'Configure tipos de IVA y si los precios incluyen impuestos.',
  slabsSectionTitle: 'Tramos de IVA',
  splitExplanation:
    'El importe se muestra dividido en dos partes iguales (estatal / autonómica) solo como referencia visual.',
  filingSummaryTitle: 'Resumen de IVA (referencia)',
  totalTaxable: 'Base imponible total',
  totalComponentA: 'Total cuota estatal',
  totalComponentB: 'Total cuota autonómica',
  grandTotalTax: 'IVA total',
};

const FR: TaxTerminology = {
  scheme: 'TVA',
  componentA: 'Part centrale',
  componentB: 'Part locale',
  businessTaxId: 'N° TVA',
  foodLicense: 'Autorisation sanitaire',
  settingsTaxTitle: 'Configuration fiscale',
  settingsTaxSubtitle: 'Configurez les taux de TVA et le comportement des prix.',
  slabsSectionTitle: 'Tranches de TVA',
  splitExplanation:
    'La TVA est affichée en deux parts égales (centrale / locale) à titre indicatif pour correspondre à l’affichage du logiciel.',
  filingSummaryTitle: 'Récapitulatif TVA (référence)',
  totalTaxable: 'Total HT',
  totalComponentA: 'Total part centrale',
  totalComponentB: 'Total part locale',
  grandTotalTax: 'TVA totale',
};

const AR: TaxTerminology = {
  scheme: 'ضريبة القيمة المضافة',
  componentA: 'الحصة الاتحادية',
  componentB: 'الحصة المحلية',
  businessTaxId: 'الرقم الضريبي',
  foodLicense: 'ترخيص أغذية',
  settingsTaxTitle: 'إعدادات الضريبة',
  settingsTaxSubtitle: 'اضبط نسب الضريبة وسلوك الأسعار شاملة الضريبة أو لا.',
  slabsSectionTitle: 'شرائح الضريبة',
  splitExplanation:
    'تُعرض الضريبة مقسومة إلى نصفين متساويين (اتحادي / محلي) للعرض فقط ومقارنة مع أنظمة أخرى.',
  filingSummaryTitle: 'ملخص ضريبة القيمة المضافة (مرجعي)',
  totalTaxable: 'إجمالي الخاضع للضريبة',
  totalComponentA: 'إجمالي الحصة الاتحادية',
  totalComponentB: 'إجمالي الحصة المحلية',
  grandTotalTax: 'إجمالي الضريبة',
};

/** Indian languages — localized GST split labels for cart/receipts */
const TE = {
  ...EN_IN,
  settingsTaxTitle: 'పన్ను కాన్ఫిగరేషన్',
  settingsTaxSubtitle: 'GST రేట్లు మరియు పన్ను ప్రవర్తనను కాన్ఫిగర్ చేయండి.',
  slabsSectionTitle: 'GST స్లాబ్‌లు',
  splitExplanation:
    'రాష్ట్రంలోపల లావాదేవీలకు GST సమాన రేట్లతో కేంద్ర మరియు రాష్ట్ర జీఎస్టీగా విభజించబడుతుంది.',
  filingSummaryTitle: 'దాఖలు కోసం GST సారాంశం',
  totalTaxable: 'మొత్తం పన్ను విధింపు',
  totalComponentA: 'మొత్తం కేంద్ర జీఎస్టీ',
  totalComponentB: 'మొత్తం రాష్ట్ర జీఎస్టీ',
  grandTotalTax: 'మొత్తం పన్ను',
};
const KN = {
  ...EN_IN,
  settingsTaxTitle: 'ತೆರಿಗೆ ಕಾನ್ಫಿಗರೇಶನ್',
  settingsTaxSubtitle: 'GST ದರಗಳು ಮತ್ತು ತೆರಿಗೆ ವರ್ತನೆಯನ್ನು ಕಾನ್ಫಿಗರ್ ಮಾಡಿ.',
  slabsSectionTitle: 'GST ಸ್ಲ್ಯಾಬ್‌ಗಳು',
  splitExplanation:
    'ರಾಜ್ಯೊಳಗಿನ ವ್ಯವಹಾರಗಳಿಗೆ GST ಸಮಾನ ದರಗಳಲ್ಲಿ ಕೇಂದ್ರ ಮತ್ತು ರಾಜ್ಯ ಜಿಎಸ್ಟಿಯಾಗಿ ವಿಭಾಗಿಸಲಾಗುತ್ತದೆ.',
  filingSummaryTitle: 'ದಾಖಲೆಗಾಗಿ GST ಸಾರಾಂಶ',
  totalTaxable: 'ಒಟ್ಟು ತೆರಿಗೆ ಘಟಕ',
  totalComponentA: 'ಒಟ್ಟು ಕೇಂದ್ರ ಜಿಎಸ್ಟಿ',
  totalComponentB: 'ಒಟ್ಟು ರಾಜ್ಯ ಜಿಎಸ್ಟಿ',
  grandTotalTax: 'ಒಟ್ಟು ತೆರಿಗೆ',
};
const ML = {
  ...EN_IN,
  settingsTaxTitle: 'നികുതി കോൺഫിഗറേഷൻ',
  settingsTaxSubtitle: 'ജിഎസ്ടി നിരക്കുകളും നികുതി പെരുമാറ്റവും കോൺഫിഗർ ചെയ്യുക.',
  slabsSectionTitle: 'ജിഎസ്ടി സ്ലാബുകൾ',
  splitExplanation:
    'സംസ്ഥാനത്തിനകത്തെ ഇടപാടുകൾക്ക് ജിഎസ്ടി സമാന നിരക്കുകളിൽ കേന്ദ്ര, സംസ്ഥാന ജിഎസ്ടിയായി വിഭജിക്കുന്നു.',
  filingSummaryTitle: 'ഫയലിംഗിനുള്ള ജിഎസ്ടി സംഗ്രഹം',
  totalTaxable: 'ആകെ നികുതി ബാധ്യത',
  totalComponentA: 'ആകെ കേന്ദ്ര ജിഎസ്ടി',
  totalComponentB: 'ആകെ സംസ്ഥാന ജിഎസ്ടി',
  grandTotalTax: 'ആകെ നികുതി',
};
const MR = {
  ...EN_IN,
  settingsTaxTitle: 'कर संरचना',
  settingsTaxSubtitle: 'जीएसटी दर आणि कर वर्तन कॉन्फिगर करा.',
  slabsSectionTitle: 'जीएसटी स्लॅब',
  splitExplanation: 'राज्यांतर्गत व्यवहारांसाठी जीएसटी समान दरांनी सीजीएसटी आणि एसजीएसटीमध्ये विभागला जातो.',
  filingSummaryTitle: 'सादरपत्रासाठी जीएसटी सारांश',
  totalTaxable: 'एकूण करपात्र',
  totalComponentA: 'एकूण सीजीएसटी',
  totalComponentB: 'एकूण एसजीएसटी',
  grandTotalTax: 'एकूण कर',
};
const BN = {
  ...EN_IN,
  settingsTaxTitle: 'কর কনফিগারেশন',
  settingsTaxSubtitle: 'জিএসটি হার এবং কর আচরণ কনফিগার করুন।',
  slabsSectionTitle: 'জিএসটি স্ল্যাব',
  splitExplanation: 'অন্তর্দেশীয় লেনদেনের জন্য জিএসটি স্বয়ংক্রিয়ভাবে সমান হারে সিজিএসটি ও এসজিএসটিতে বিভক্ত হয়।',
  filingSummaryTitle: 'দাখিলের জন্য জিএসটি সারাংশ',
  totalTaxable: 'মোট করযোগ্য',
  totalComponentA: 'মোট সিজিএসটি',
  totalComponentB: 'মোট এসজিএসটি',
  grandTotalTax: 'মোট কর',
};
const GU = {
  ...EN_IN,
  settingsTaxTitle: 'કર કોન્ફિગરેશન',
  settingsTaxSubtitle: 'જીએસટી દર અને કર વર્તન કોન્ફિગર કરો.',
  slabsSectionTitle: 'જીએસટી સ્લેબ',
  splitExplanation: 'રાજ્ય અંતર્ગત વ્યવહારો માટે જીએસટી સમાન દરે સીજીએસટી અને એસજીએસટીમાં વિભાજિત થાય છે.',
  filingSummaryTitle: 'ફાઇલિંગ માટે જીએસટી સારાંશ',
  totalTaxable: 'કુલ કરપાત્ર',
  totalComponentA: 'કુલ સીજીએસટી',
  totalComponentB: 'કુલ એસજીએસટી',
  grandTotalTax: 'કુલ કર',
};
const PA = {
  ...EN_IN,
  settingsTaxTitle: 'ਟੈਕਸ ਸੰਰਚਨਾ',
  settingsTaxSubtitle: 'ਜੀਐਸਟੀ ਦਰਾਂ ਅਤੇ ਟੈਕਸ ਵਿਹਾਰ ਕਨਫ਼ਿਗਰ ਕਰੋ।',
  slabsSectionTitle: 'ਜੀਐਸਟੀ ਸਲੈਬ',
  splitExplanation:
    'ਰਾਜ ਅੰਦਰ ਲੈਣ-ਦੇਣ ਲਈ ਜੀਐਸਟੀ ਬਰਾਬਰ ਦਰਾਂ ਨਾਲ ਕੇਂਦਰੀ ਅਤੇ ਰਾਜ ਜੀਐਸਟੀ ਵਿੱਚ ਵੰਡਿਆ ਜਾਂਦਾ ਹੈ।',
  filingSummaryTitle: 'ਦਾਖਲ ਹਿਤ ਜੀਐਸਟੀ ਸਾਰ',
  totalTaxable: 'ਕੁੱਲ ਟੈਕਸਯੋਗ',
  totalComponentA: 'ਕੁੱਲ ਕੇਂਦਰੀ ਜੀਐਸਟੀ',
  totalComponentB: 'ਕੁੱਲ ਰਾਜ ਜੀਐਸਟੀ',
  grandTotalTax: 'ਕੁੱਲ ਟੈਕਸ',
};

const BY_LANG: Record<string, TaxTerminology> = {
  en: EN_IN,
  hi: HI,
  ta: TA,
  te: TE,
  kn: KN,
  ml: ML,
  mr: MR,
  bn: BN,
  gu: GU,
  pa: PA,
  zh: ZH,
  ja: JA,
  es: ES,
  fr: FR,
  ar: AR,
};

export function normalizeLangCode(lang: string): string {
  return (lang || 'en').split('-')[0].toLowerCase();
}

export function getTaxTerminology(langCode: string): TaxTerminology {
  const code = normalizeLangCode(langCode);
  return BY_LANG[code] ?? EN_IN;
}

export function formatSlabSplitLine(ratePercent: string | number, terms: TaxTerminology): string {
  const r = typeof ratePercent === 'string' ? parseFloat(ratePercent) : ratePercent;
  const half = r / 2;
  return `${terms.componentA}: ${half}% + ${terms.componentB}: ${half}%`;
}
