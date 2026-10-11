export function BlockMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="block-mark">
      <path d="M16 3 28 9.5 16 16 4 9.5Z" className="grass-top" />
      <path d="M4 9.5 16 16v3.5L4 13Z" className="grass-left" />
      <path d="M28 9.5 16 16v3.5l12-6.5Z" className="grass-right" />
      <path d="M4 13 16 19.5V29L4 22.5Z" className="earth-left" />
      <path d="M28 13 16 19.5V29l12-6.5Z" className="earth-right" />
    </svg>
  );
}
