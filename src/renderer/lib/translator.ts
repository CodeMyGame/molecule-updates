const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

export async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    const res = await fetch(
      `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
    );
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
  } catch {
    // network error — fall back to original
  }
  return text;
}

export async function translateBatch(
  items: { id: number; name: string }[],
  targetLang: string,
  onProgress?: (translated: number, total: number) => void
): Promise<{ id: number; translatedName: string }[]> {
  const results: { id: number; translatedName: string }[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const translated = await Promise.all(
      batch.map(async (item) => ({
        id: item.id,
        translatedName: await translateText(item.name, targetLang),
      }))
    );
    results.push(...translated);
    onProgress?.(Math.min(i + BATCH_SIZE, items.length), items.length);
  }

  return results;
}
