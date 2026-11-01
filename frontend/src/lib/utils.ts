import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function hexToHSL(hex: string): string {
  if (!hex) return '0 0% 0%'; // Fallback black
  hex = hex.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  // Validate hex format
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return '0 0% 0%'; // Safe fallback HSL black
  }

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function getLuminance(hex: string): number {
  if (!hex) return 0;
  hex = hex.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  // Validate hex format
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return 0; // Dark luminance fallback
  }

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const a = [r, g, b].map(function (v) {
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function getContrastForegroundHSL(hex: string): string {
  // Returns black or white HSL depending on luminance
  return getLuminance(hex) > 0.179 ? '222.2 84% 4.9%' : '210 40% 98%';
}

/**
 * Sanitizes a color hex input to ensure it is always a valid '#rrggbb' color
 * string suitable for the browser's native <input type="color"> element.
 */
export function sanitizeHexForColorInput(hex: string): string {
  if (!hex) return '#000000';
  let sanitized = hex.trim();
  if (!sanitized.startsWith('#')) {
    sanitized = '#' + sanitized;
  }
  
  // Standardize 3-character hex to 6-character
  if (/^#[0-9a-fA-F]{3}$/.test(sanitized)) {
    return `#${sanitized[1]}${sanitized[1]}${sanitized[2]}${sanitized[2]}${sanitized[3]}${sanitized[3]}`.toLowerCase();
  }
  
  // Standardize 6-character hex
  if (/^#[0-9a-fA-F]{6}$/.test(sanitized)) {
    return sanitized.toLowerCase();
  }
  
  // Dynamic parsing fallback: try to fill remaining characters if partial
  const rawHex = sanitized.replace(/^#/, '');
  if (rawHex.length > 0 && rawHex.length < 6) {
    // Pad with zeros to make it exactly 6 characters
    const padded = rawHex.padEnd(6, '0');
    if (/^[0-9a-fA-F]{6}$/.test(padded)) {
      return `#${padded}`.toLowerCase();
    }
  }

  // Return fallback black
  return '#000000';
}
