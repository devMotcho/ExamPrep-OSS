/** Grades and other decimals in the reader's locale, so Portuguese always gets a decimal comma. */
export const formatDecimal = (value: number | string | null | undefined, locale: string, digits = 1): string => {
  const number = Number(value ?? 0);
  return number.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

/** Like formatDecimal, without trailing zeros: 0,25 and 10 instead of 0,25 and 10,0. */
export const formatTrimmed = (value: number, locale: string, maxDigits = 2): string =>
  value.toLocaleString(locale, { maximumFractionDigits: maxDigits });
