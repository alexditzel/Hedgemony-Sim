import type { Card } from "../engine";

const cardFrontModules = import.meta.glob(
  [
    "../../images/card_fronts/*.{avif,jpeg,jpg,png,webp}",
    "../../images/card-fronts/*.{avif,jpeg,jpg,png,webp}"
  ],
  { eager: true, import: "default", query: "?url" }
) as Record<string, string>;

const cardFrontImages = Object.fromEntries(
  Object.entries(cardFrontModules).map(([path, url]) => {
    const fileName = path.split("/").pop() ?? "";
    return [fileName.replace(/\.[^.]+$/, ""), url];
  })
);

export function cardFrontImageUrl(card: Pick<Card, "id">): string | undefined {
  return cardFrontImages[card.id];
}
