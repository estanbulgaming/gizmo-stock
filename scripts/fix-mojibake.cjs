const fs = require('fs');

const file = process.argv[2] || 'App.tsx';
let src = fs.readFileSync(file, 'utf8');

// 1) Decode numeric HTML entities (e.g., &#252; -> ü)
src = src.replace(/&#(\d+);/g, (_, d) => {
  try {
    const code = parseInt(d, 10);
    return String.fromCharCode(code);
  } catch {
    return _;
  }
});
src = src.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
  try {
    const code = parseInt(h, 16);
    return String.fromCharCode(code);
  } catch {
    return _;
  }
});

// 2) Common Turkish mojibake mappings
const replacements = [
  ['Ã¼', 'ü'], ['Ãœ', 'Ü'], ['Ã¶', 'ö'], ['Ã–', 'Ö'],
  ['Ä±', 'ı'], ['Ä°', 'İ'], ['Ã§', 'ç'], ['Ã‡', 'Ç'],
  ['ÅŸ', 'ş'], ['Åž', 'Ş'], ['ÄŸ', 'ğ'], ['Ä', 'Ğ'],
  ['Ã©', 'é'], ['Â', ''],
  ['â€“', '–'], ['â€”', '—'], ['â€˜', '‘'], ['â€™', '’'],
  ['â€œ', '“'], ['â€', '”'], ['â€¢', '•'], ['â€¦', '…'],
  ['âŒ', '❌'], ['âœ…', '✔️'], ['âš ï¸', '⚠️'], ['âš ', '⚠'], ['â†’', '→'],
  ['â†', '←'], ['ğŸ’¥', '💥'], ['ğŸ“¦', '📦'],
  // Variants seen in file
  ['YǬ', 'Yü'], ['yǬ', 'yü'], ['GǬ', 'Gü'], ['gǬ', 'gü'],
  ['�', ''],
];

for (const [bad, good] of replacements) {
  src = src.split(bad).join(good);
}

fs.writeFileSync(file, src, 'utf8');
console.log(`Fixed mojibake in ${file}`);
