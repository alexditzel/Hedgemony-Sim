import type { Card, PlayerId } from "../engine";

import americaAction from "../../images/card_backs/America_Action.png";
import americaInvestment from "../../images/card_backs/America_Investment.png";
import chinaAction from "../../images/card_backs/China_Action.png";
import chinaInvestment from "../../images/card_backs/China_Investment.png";
import dprkAction from "../../images/card_backs/DPRK_Action.png";
import dprkInvestment from "../../images/card_backs/DPRK_Investment.png";
import iranAction from "../../images/card_backs/Iran_Action.png";
import iranInvestment from "../../images/card_backs/Iran_Investment.png";
import israelAction from "../../images/card_backs/Israel_Action.png";
import israelInvestment from "../../images/card_backs/Israel_Investment.png";
import natoAction from "../../images/card_backs/NATO_Action.png";
import natoInvestment from "../../images/card_backs/NATO_Investment.png";
import russiaAction from "../../images/card_backs/Russia_Action.png";
import russiaInvestment from "../../images/card_backs/Russia_Investment.png";

export type CardBackKind = "Action" | "Investment";

type CardBackFaction = "America" | "NATO" | "Russia" | "China" | "DPRK" | "Iran" | "Israel";

const playerBackFaction: Record<string, CardBackFaction> = {
  US: "America",
  NATO_EU: "NATO",
  NATO: "NATO",
  RU: "Russia",
  PRC: "China",
  CHINA: "China",
  DPRK: "DPRK",
  IR: "Iran",
  IRAN: "Iran",
  IL: "Israel",
  ISRAEL: "Israel"
};

const cardBackImages: Record<CardBackFaction, Record<CardBackKind, string>> = {
  America: { Action: americaAction, Investment: americaInvestment },
  NATO: { Action: natoAction, Investment: natoInvestment },
  Russia: { Action: russiaAction, Investment: russiaInvestment },
  China: { Action: chinaAction, Investment: chinaInvestment },
  DPRK: { Action: dprkAction, Investment: dprkInvestment },
  Iran: { Action: iranAction, Investment: iranInvestment },
  Israel: { Action: israelAction, Investment: israelInvestment }
};

export function cardBackImageUrl(playerId: PlayerId | undefined, kind: CardBackKind | undefined): string | undefined {
  if (!playerId || !kind) return undefined;
  const faction = playerBackFaction[playerId];
  return faction ? cardBackImages[faction][kind] : undefined;
}

export function cardBackImageUrlForCard(card: Card): string | undefined {
  if (card.type !== "Action" && card.type !== "Investment") return undefined;
  return cardBackImageUrl(card.owner ?? undefined, card.type);
}
