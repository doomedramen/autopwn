/**
 * Format a number with appropriate scale suffix
 * Examples:
 * - 6 → "6 words"
 * - 123 → "123 words"
 * - 1,100 → "1.1k words"
 * - 1,234,567 → "1.2M words"
 * - 1,234,567,890 → "1.2B words"
 */
export const formatNumber = (count: number, unit = 'words'): string => {
  if (count === 0) return `0 ${unit}`;

  // Less than 1,000: show exact number
  if (count < 1000) {
    return `${count.toLocaleString()} ${unit}`;
  }

  // 1,000 - 999,999: show as "k"
  if (count < 1000000) {
    const thousands = count / 1000;
    // Only show decimal if it's meaningful (not .0)
    const formatted =
      thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1);
    return `${formatted}k ${unit}`;
  }

  // 1,000,000 - 999,999,999: show as "M"
  if (count < 1000000000) {
    const millions = count / 1000000;
    const formatted =
      millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1);
    return `${formatted}M ${unit}`;
  }

  // 1,000,000,000+: show as "B"
  const billions = count / 1000000000;
  const formatted =
    billions % 1 === 0 ? billions.toFixed(0) : billions.toFixed(1);
  return `${formatted}B ${unit}`;
};
