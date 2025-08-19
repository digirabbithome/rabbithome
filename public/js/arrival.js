console.log('arrival.js v7 with extended alias mapping loaded');

// ====== 型號別名標準化（GRIII↔GR3、A7RIV↔A7R4、A7III↔A73、MarkII/MII/MKII/M2、RX100VII/M7/MkVII/MKVII 等） ======
const aliasMap = [
  // GR 系列
  { regex: /\bgr\s*iii\b/gi,                norm: "gr3" },

  // Sony A7 系列
  { regex: /\ba7\s*r\s*iv\b/gi,             norm: "a7r4" },
  { regex: /\ba7\s*r4\b/gi,                 norm: "a7r4" },
  { regex: /\ba7\s*iii\b/gi,                norm: "a73" },
  { regex: /\ba73\b/gi,                     norm: "a73" },

  // Mark II（允許任意前綴）：MARKII / MK II / MII / M2 / MARK 2 → m2
  { regex: /(mark|mk)\s*[-\s]*ii/gi,        norm: "m2" },
  { regex: /(mark|mk)\s*[-\s]*2/gi,         norm: "m2" },
  { regex: /mkii/gi,                          norm: "m2" },
  { regex: /mii/gi,                           norm: "m2" },
  { regex: /m2/gi,                            norm: "m2" },

  // RX100 VII 全系列 → rx100m7
  { regex: /\brx100\s*(mark|mk)?\s*vii\b/gi, norm: "rx100m7" },
  { regex: /\brx100\s*mk\s*vii\b/gi,         norm: "rx100m7" },
  { regex: /\brx100\s*mk\s*7\b/gi,           norm: "rx100m7" },
  { regex: /\brx100\s*m7\b/gi,               norm: "rx100m7" },
  { regex: /\brx100m7\b/gi,                  norm: "rx100m7" },
  { regex: /\brx100vii\b/gi,                 norm: "rx100m7" }
]; // ← 一定要有這個分號

function normalizeAlias(str = "") {
  let s = baseNormalize(str);

  // 羅馬數字 → 阿拉伯數字（先長再短，避免重疊）
  s = s.replace(/\bviii\b/gi,"8")
       .replace(/\bvii\b/gi,"7")
       .replace(/\bvi\b/gi,"6")
       .replace(/\bv\b/gi,"5")
       .replace(/\biv\b/gi,"4")
       .replace(/\biii\b/gi,"3")
       .replace(/\bii\b/gi,"2");

  for (const rule of aliasMap) s = s.replace(rule.regex, rule.norm);
  return s;
}

// 用 alias 後的版本取代原本的 compact/tokens
function compact(str = "") {
  return normalizeAlias(str).replace(/[^a-z0-9]/g, "");
}
function tokens(str = "") {
  return normalizeAlias(str).split(/[^a-z0-9]+/).filter(Boolean);
}
