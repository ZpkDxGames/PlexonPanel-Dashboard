import localFont from "next/font/local";

// The shared family joins disjoint faces; range selection stays with the browser.
export const hankenLatin = localFont({
  src: "./fonts/hanken-latin.woff2",
  variable: "--font-hanken",
  weight: "100 900",
  display: "swap",
  preload: true,
  declarations: [
    { prop: "font-family", value: "Plexon Hanken" },
    { prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
  ],
});

export const hankenExtended = localFont({
  src: "./fonts/hanken-latin-ext.woff2",
  variable: "--font-hanken-extended",
  weight: "100 900",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "Plexon Hanken" },
    { prop: "unicode-range", value: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF" },
  ],
});

export const commitMono = localFont({
  src: "./fonts/commit-mono-400.woff2",
  variable: "--font-commit",
  weight: "400",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "Plexon Commit Mono" },
    { prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
  ],
});
