// Zotero plugin bootstrap entry point
// This file is loaded when Zotero starts the plugin

export async function bootstrap({ id }: { id: string }): Promise<void> {
  console.log(`Zotero Translate Plugin loaded: ${id}`);
}
