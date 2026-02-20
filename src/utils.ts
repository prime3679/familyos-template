/**
 * Capitalizes the first letter of a string and converts the rest to lowercase.
 * Example: "monday" -> "Monday", "MONDAY" -> "Monday"
 */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
