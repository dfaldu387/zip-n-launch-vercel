import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Parse a date string in 'yyyy-MM-dd' format as local time (not UTC)
// This prevents timezone shifts when converting date strings to Date objects
export function parseLocalDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isWalkTrotDivision(divisionName) {
    if (!divisionName) return false;
    const lowerCaseName = divisionName.toLowerCase();
    return lowerCaseName.includes('walk-trot') || lowerCaseName.includes('walk/trot') || lowerCaseName.includes(' w/t ') || lowerCaseName.endsWith(' w/t') || lowerCaseName.startsWith('w/t ') || lowerCaseName.includes(' wt ') || lowerCaseName.endsWith(' wt') || lowerCaseName.startsWith('wt ');
}