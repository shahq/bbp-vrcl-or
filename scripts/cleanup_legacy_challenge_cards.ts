import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

process.env.DATA_STORE_PROVIDER = process.env.CLEANUP_DATA_STORE_PROVIDER || "sqlite";

const { getCurrentBackend } = await import("../src/server/backend/current");

const { sessions, cards, connections } = getCurrentBackend();
const allSessions = await sessions.getAllSessions();

let removedCards = 0;
let touchedSessions = 0;

for (const session of allSessions) {
  const sessionCards = await cards.getCardsBySession(session.id);
  const challengeCards = sessionCards.filter((card) => card.section === "challenge");

  if (challengeCards.length === 0) continue;

  touchedSessions += 1;

  for (const card of challengeCards) {
    await connections.deleteConnectionsForCard(card.id, session.id);
    await cards.deleteCard(session.id, card.id);
    removedCards += 1;
  }
}

const dataSessionsDir = path.join(process.cwd(), "data", "sessions");
let removedOrphanFiles = 0;
let cleanedConnectionFiles = 0;

if (fs.existsSync(dataSessionsDir)) {
  for (const sessionDirName of fs.readdirSync(dataSessionsDir)) {
    const sessionDir = path.join(dataSessionsDir, sessionDirName);
    const cardsDir = path.join(sessionDir, "cards");
    if (!fs.statSync(sessionDir).isDirectory() || !fs.existsSync(cardsDir)) continue;

    const removedCardIds = new Set<string>();
    for (const fileName of fs.readdirSync(cardsDir)) {
      if (!/^challenge-\d+\.md$/.test(fileName)) continue;

      const fullPath = path.join(cardsDir, fileName);
      const content = fs.readFileSync(fullPath, "utf-8");
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = match ? yaml.load(match[1]) as { id?: string } | null : null;
      if (frontmatter?.id) removedCardIds.add(String(frontmatter.id));

      fs.unlinkSync(fullPath);
      removedOrphanFiles += 1;
    }

    if (removedCardIds.size === 0) continue;

    const connectionsPath = path.join(sessionDir, "connections.json");
    if (!fs.existsSync(connectionsPath)) continue;

    const connectionsJson = JSON.parse(fs.readFileSync(connectionsPath, "utf-8"));
    if (!Array.isArray(connectionsJson)) continue;

    const nextConnections = connectionsJson.filter((connection) =>
      !removedCardIds.has(connection?.from) && !removedCardIds.has(connection?.to)
    );

    if (nextConnections.length !== connectionsJson.length) {
      fs.writeFileSync(connectionsPath, JSON.stringify(nextConnections, null, 2), "utf-8");
      cleanedConnectionFiles += 1;
    }
  }
}

console.log(
  [
    `Removed ${removedCards} legacy challenge card${removedCards === 1 ? "" : "s"} from ${touchedSessions} session${touchedSessions === 1 ? "" : "s"} using ${process.env.DATA_STORE_PROVIDER}.`,
    `Removed ${removedOrphanFiles} orphaned challenge card file${removedOrphanFiles === 1 ? "" : "s"} and cleaned ${cleanedConnectionFiles} file-based connection index${cleanedConnectionFiles === 1 ? "" : "es"}.`,
  ].join("\n")
);
