const BREAK_AFTER = /([\/,\:\]\)\[=&?_-])(?=[^\s])/g;
const BREAK_DIGITS = /(\d{6})(?=\d)/g;
export const softBreak = (s: string) =>
  s.replace(BREAK_AFTER, "$1\u200B").replace(BREAK_DIGITS, "$1\u200B");
export const stripSoftBreaks = (s: string) => s.replaceAll("\u200B", "");
