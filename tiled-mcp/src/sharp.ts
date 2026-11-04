// sharp is loaded lazily so the map tools keep working even if the native image library
// fails to install: only sprite generation and preview rendering need it.

export type Sharp = (typeof import("sharp"))["default"];

export async function loadSharp(): Promise<Sharp> {
  try {
    return (await import("sharp")).default;
  } catch (err) {
    throw new Error(
      `The 'sharp' image library could not be loaded (${err instanceof Error ? err.message : String(err)}). Run 'npm install' in the repository; sprite generation and previews need it, map editing does not.`,
    );
  }
}
