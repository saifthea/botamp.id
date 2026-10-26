/**
 * Parse pesan chat menjadi JSX dengan link yang bisa diklik.
 * Mendukung URL apa pun (http/https).
 */
export function renderMessageText(text: string): React.ReactNode {
  if (!text) return text;

  // Cari semua URL dalam teks
  const urlRegex = /(https?:\/\/[^\s<>"')\]]+)/g;
  const parts = text.split(urlRegex);

  if (parts.length <= 1) return text;

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
