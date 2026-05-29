/**
 * Snapshot export / import utilities.
 *
 * A snapshot is a plain JSON object that captures the full app state so the
 * user can restore a comparison session without re-uploading PDFs.
 *
 * Schema:
 *   {
 *     version:      1,                  // bump when shape changes
 *     exportedAt:   ISO-8601 string,
 *     mainOwner:    Owner | null,
 *     friendOwners: Owner[],
 *   }
 *
 * Owner shape:
 *   { id, name, entries: ScheduleEntry[], format, fileName }
 */

const SCHEMA_VERSION = 1;
const MIME_TYPE = "application/json";

/** Trigger a browser download of the current state as a .json file. */
export const exportSnapshot = (mainOwner, friendOwners) => {
  const snapshot = {
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    mainOwner: mainOwner ?? null,
    friendOwners: friendOwners ?? [],
  };

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: MIME_TYPE,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `schedule_snapshot_${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Parses a File (or text string) as a snapshot.
 * Returns { mainOwner, friendOwners } or throws an Error with a human-readable
 * message when the file is invalid.
 */
export const importSnapshot = async (file) => {
  let text;
  if (typeof file === "string") {
    text = file;
  } else {
    text = await file.text();
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Unrecognised snapshot format.");
  }

  if (parsed.version !== SCHEMA_VERSION) {
    throw new Error(
      `Snapshot version ${parsed.version} is not supported (expected ${SCHEMA_VERSION}).`
    );
  }

  const mainOwner = parsed.mainOwner ?? null;
  const friendOwners = Array.isArray(parsed.friendOwners)
    ? parsed.friendOwners
    : [];

  // Basic shape validation so a corrupt file fails loudly.
  const validateOwner = (o, label) => {
    if (!o || typeof o !== "object") throw new Error(`${label} is missing.`);
    if (typeof o.id !== "string" || !o.id)
      throw new Error(`${label} has no id.`);
    if (typeof o.name !== "string")
      throw new Error(`${label} has no name.`);
    if (!Array.isArray(o.entries))
      throw new Error(`${label} has no entries array.`);
  };

  if (mainOwner) validateOwner(mainOwner, "Main schedule");
  friendOwners.forEach((f, i) => validateOwner(f, `Friend schedule #${i + 1}`));

  return { mainOwner, friendOwners };
};
