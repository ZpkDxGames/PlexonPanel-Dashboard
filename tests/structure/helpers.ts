import type { Page } from "@playwright/test";
export async function noNestedBoxes(page: Page) {
  return page.evaluate(() => {
    const isBox = (el: Element) => {
      const cs = getComputedStyle(el),
        keys = ["Top", "Right", "Bottom", "Left"];
      return (
        keys.some(
          (k) =>
            parseFloat(cs.getPropertyValue(`border-${k.toLowerCase()}-width`)) >
            0,
        ) &&
        ["top-left", "top-right", "bottom-left", "bottom-right"].some(
          (k) => parseFloat(cs.getPropertyValue(`border-${k}-radius`)) >= 12,
        ) &&
        cs.display !== "none"
      );
    };
    const bad: string[] = [];
    document.querySelectorAll('body *:not([role="dialog"] *)').forEach((el) => {
      if (!isBox(el)) return;
      let p = el.parentElement;
      while (p) {
        if (isBox(p)) {
          bad.push(`${el.className} inside ${p.className}`);
          break;
        }
        p = p.parentElement;
      }
    });
    return bad;
  });
}
export const heights = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().height)),
    );
export async function consoleLines(page: Page, needle: string) {
  return page.evaluate((n) => {
    const row = [...document.querySelectorAll(".pp-crow__msg")].find((e) =>
      e.textContent?.includes(n),
    );
    return row
      ? Math.round(
          row.getBoundingClientRect().height /
            parseFloat(getComputedStyle(row).lineHeight),
        )
      : -1;
  }, needle);
}
