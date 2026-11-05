// Instagram username rules, shared by the form (instant feedback) and the server action (enforcement).
// The database repeats the same rules as a CHECK constraint in supabase/schema.sql.

export const INSTAGRAM_MAX_LENGTH = 30;

export type InstagramParseResult = { ok: true; username: string } | { ok: false; error: string };

const LINK_PATTERN = /^(https?:\/\/|www\.)|instagram\.com|instagr\.am|[/\\]/i;
const ALLOWED_CHARS = /^[a-z0-9._]+$/;

export function parseInstagramUsername(input: string): InstagramParseResult {
  let value = input.trim();

  if (value === "") return fail("Enter your Instagram username.");
  if (LINK_PATTERN.test(value)) {
    return fail("Enter just the username, not a link. For instagram.com/yourname, type yourname.");
  }

  // "@yourname" is how people write handles; keep the name, drop the @.
  value = value.replace(/^@+/, "");

  if (value === "") return fail("Enter your Instagram username.");
  if (value.includes("@")) return fail("That looks like an email. Enter your Instagram username instead.");
  if (/\s/.test(value)) return fail("Instagram usernames can't contain spaces.");

  value = value.toLowerCase();

  if (value.length > INSTAGRAM_MAX_LENGTH) {
    return fail(`Instagram usernames are ${INSTAGRAM_MAX_LENGTH} characters or fewer.`);
  }
  if (!ALLOWED_CHARS.test(value)) {
    return fail("Only letters, numbers, periods (.) and underscores (_) are allowed.");
  }
  if (value.startsWith(".") || value.endsWith(".")) {
    return fail("Instagram usernames can't start or end with a period.");
  }
  if (value.includes("..")) return fail("Instagram usernames can't have two periods in a row.");

  return { ok: true, username: value };
}

function fail(error: string): InstagramParseResult {
  return { ok: false, error };
}
