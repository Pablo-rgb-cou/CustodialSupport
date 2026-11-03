import type { ReactNode } from "react";

const assets: Record<string, { name: string; background: string }> = {
  BTC: { name: "Bitcoin", background: "#F7931A" },
  ETH: { name: "Ethereum", background: "#627EEA" },
  USDT: { name: "Tether", background: "#26A17B" },
  USDC: { name: "USD Coin", background: "#2775CA" },
  BNB: { name: "BNB", background: "#F3BA2F" },
  XRP: { name: "XRP", background: "#23292F" },
  LTC: { name: "Litecoin", background: "#345D9D" },
  SOL: { name: "Solana", background: "#161724" },
  ADA: { name: "Cardano", background: "#0033AD" },
  DOGE: { name: "Dogecoin", background: "#C2A633" },
  TRX: { name: "TRON", background: "#EF0027" },
};

export function getCryptoAssetName(symbol: string | null | undefined) {
  const key = symbol?.trim().toUpperCase();
  return key ? assets[key]?.name ?? key : "Withdrawal";
}

function AssetMark({ symbol }: { symbol: string }): ReactNode {
  switch (symbol) {
    case "BTC":
      return (
        <g transform="rotate(13 16 16)" fill="white">
          <path fillRule="evenodd" d="M10 8h9.1c3.9 0 6.2 1.7 6.2 4.5 0 1.9-1.1 3.2-2.7 3.8 2.1.6 3.4 2 3.4 4.2 0 3.2-2.6 5.1-7 5.1H10v-3h2V11h-2V8Zm6 3v4.1h2.4c1.9 0 2.9-.7 2.9-2.1 0-1.3-1-2-2.9-2H16Zm0 7v4.6h2.9c2 0 3.1-.8 3.1-2.3 0-1.6-1.2-2.3-3.4-2.3H16Z" transform="translate(-1 -1)" />
          <path d="M13 4h2v4h-2zm4 0h2v4h-2zm-4 21h2v3h-2zm4 0h2v3h-2z" />
        </g>
      );
    case "ETH":
      return (
        <g>
          <path fill="#FFF" d="m16 3 8 13-8 4.6-8-4.6L16 3Z" />
          <path fill="#C1CCFF" d="m16 3 8 13-8 4.6V3Z" />
          <path fill="#829BEF" d="m8 16 8-3.6 8 3.6-8 4.6L8 16Z" />
          <path fill="#FFF" d="m8 18.2 8 4.6 8-4.6L16 29 8 18.2Z" />
          <path fill="#C1CCFF" d="M16 22.8v6.1l8-10.7-8 4.6Z" />
        </g>
      );
    case "USDT":
      return (
        <g fill="white">
          <path d="M7 7h18v4h-7v15h-4V11H7V7Z" />
          <path fillRule="evenodd" d="M16 12c-7.2 0-12 1.4-12 3.1 0 1.8 4.8 3.1 12 3.1s12-1.3 12-3.1C28 13.4 23.2 12 16 12Zm0 1.5c5.9 0 10.3.7 10.3 1.6 0 .8-4.4 1.5-10.3 1.5S5.7 16 5.7 15.1c0-.9 4.4-1.6 10.3-1.6Z" />
        </g>
      );
    case "USDC":
      return (
        <g fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
          <path d="M11 5a12 12 0 0 0 0 22M21 5a12 12 0 0 1 0 22M20 11c-.7-1.1-2-1.7-4-1.7-2.4 0-4 1.2-4 3.1 0 4.6 8.3 2 8.3 6.8 0 1.9-1.8 3-4.3 3-2 0-3.5-.8-4.3-2M16 7v18" />
        </g>
      );
    case "BNB":
      return <path fill="white" d="m16 4 6.8 6.8-2.6 2.6L16 9.2l-4.2 4.2-2.6-2.6L16 4Zm-9.4 9.4L9.2 16l-2.6 2.6L4 16l2.6-2.6Zm9.4-1L19.6 16 16 19.6 12.4 16l3.6-3.6Zm9.4 1L28 16l-2.6 2.6-2.6-2.6 2.6-2.6Zm-14.2 5.2 4.8 4.8 4.8-4.8 2.6 2.6L16 28.6l-7.4-7.4 2.6-2.6Z" />;
    case "XRP":
      return <path fill="white" d="M6 7h4l3.9 4a3 3 0 0 0 4.2 0L22 7h4l-5.9 6.1a5.7 5.7 0 0 1-8.2 0L6 7Zm0 18 5.9-6.1a5.7 5.7 0 0 1 8.2 0L26 25h-4l-3.9-4a3 3 0 0 0-4.2 0L10 25H6Z" />;
    case "LTC":
      return <path fill="white" d="M14 5h5l-3.1 12 5-1.6-.9 3.2-5 1.6-.8 3.3H24l-1 4H8.2l1.8-7-3 1 .8-3.3 3-1L14 5Z" />;
    case "SOL":
      return (
        <g>
          <path fill="#8B80F9" d="M9 7h17l-4 4H5l4-4Z" />
          <path fill="#58C6CD" d="M5 14h17l4 4H9l-4-4Z" />
          <path fill="#72F1BA" d="M9 21h17l-4 4H5l4-4Z" />
        </g>
      );
    case "ADA":
      return (
        <g fill="white">
          <circle cx="13.4" cy="11.5" r="1.6" /><circle cx="18.6" cy="11.5" r="1.6" />
          <circle cx="10.8" cy="16" r="1.6" /><circle cx="21.2" cy="16" r="1.6" />
          <circle cx="13.4" cy="20.5" r="1.6" /><circle cx="18.6" cy="20.5" r="1.6" />
          <circle cx="16" cy="5.5" r="1.1" /><circle cx="16" cy="26.5" r="1.1" />
          <circle cx="6.9" cy="10.8" r="1.1" /><circle cx="25.1" cy="10.8" r="1.1" />
          <circle cx="6.9" cy="21.2" r="1.1" /><circle cx="25.1" cy="21.2" r="1.1" />
          <circle cx="9.5" cy="4.8" r=".65" /><circle cx="22.5" cy="4.8" r=".65" />
          <circle cx="3" cy="16" r=".65" /><circle cx="29" cy="16" r=".65" />
          <circle cx="9.5" cy="27.2" r=".65" /><circle cx="22.5" cy="27.2" r=".65" />
        </g>
      );
    case "DOGE":
      return (
        <g fill="white">
          <path fillRule="evenodd" d="M10 5h7c7 0 11 4 11 11s-4 11-11 11h-7V5Zm4 4v14h3c4.5 0 7-2.4 7-7s-2.5-7-7-7h-3Z" transform="translate(-2 0)" />
          <path d="M5 14h14v3H5z" />
        </g>
      );
    case "TRX":
      return (
        <g fill="none" stroke="white" strokeWidth="1.35" strokeLinejoin="round">
          <path d="m6 5 21 4-10 19L6 5Zm0 0 14.5 9.5L27 9M6 5l11 23 3.5-13.5L6 5Z" />
        </g>
      );
    default:
      return (
        <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 9h18v16H7zM7 9V6h15v3M20 15h7v6h-7z" />
          <circle cx="23.5" cy="18" r=".7" fill="currentColor" stroke="none" />
        </g>
      );
  }
}

type CryptoAssetIconProps = {
  symbol?: string | null;
  className?: string;
  /** Set false when the nearby text already identifies this asset. */
  labelled?: boolean;
};

export default function CryptoAssetIcon({ symbol, className = "size-11", labelled = false }: CryptoAssetIconProps) {
  const key = symbol?.trim().toUpperCase() ?? "";
  const asset = assets[key];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-slate-200 ring-1 ring-inset ring-white/10 ${className}`}
      style={{ backgroundColor: asset?.background ?? "#1C3347" }}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? getCryptoAssetName(symbol) : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      <svg viewBox="0 0 32 32" className="h-[76%] w-[76%]" fill="none" aria-hidden="true">
        <AssetMark symbol={key} />
      </svg>
    </span>
  );
}
