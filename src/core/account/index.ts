// Deleting the account needs the confirmation word ("DELETE" / "APAGAR") typed exactly; case and
// surrounding spaces are forgiven so a phone keyboard's capitalization doesn't get in the way.
export function isDeleteConfirmed(input: string, word: string): boolean {
  return input.trim().toUpperCase() === word.toUpperCase();
}
