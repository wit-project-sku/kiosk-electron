/**
 * Normalizes an AI/AR image response into raw image bytes plus the public result
 * URL when the API provides one (so the kiosk can QR a phone-openable link).
 * Accepts a binary body, or JSON carrying a base64 `image` or a `result_url`.
 */
export async function parseImageResponse(response: Response): Promise<{ buffer: Buffer; url: string | null }> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const json = (await response.json()) as {
      image?: string;
      result_url?: string;
      result?: string;
      url?: string;
    };
    const inlineBase64 = json.image;
    if (inlineBase64) {
      const base64 = inlineBase64.replace(/^data:image\/\w+;base64,/, '');
      return { buffer: Buffer.from(base64, 'base64'), url: null };
    }
    const url = json.result_url ?? json.url ?? json.result;
    if (url) {
      const imgResponse = await fetch(url);
      if (!imgResponse.ok) throw new Error('Failed to download AI result image.');
      return { buffer: Buffer.from(await imgResponse.arrayBuffer()), url };
    }
    throw new Error('AI response JSON missing image data.');
  }

  return { buffer: Buffer.from(await response.arrayBuffer()), url: null };
}
