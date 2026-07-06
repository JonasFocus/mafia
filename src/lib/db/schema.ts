import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const gameStatusEnum = pgEnum("game_status", [
  "lobby",
  "role_reveal",
  "hint_phase",
  "voting",
  "round_result",
  "game_over",
  "night",
  "day_result",
  "day_vote",
  "lynch_result",
]);

export const playerRoleEnum = pgEnum("player_role", [
  "faithful",
  "mafia",
  "sheriff",
  "angel",
]);

export const nightActionTypeEnum = pgEnum("night_action_type", [
  "kill",
  "inspect",
  "protect",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // = auth.users.id
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  isGuest: boolean("is_guest").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isCustom: boolean("is_custom").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id),
});

export const words = pgTable("words", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
});

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomCode: text("room_code").notNull().unique(),
  hostId: uuid("host_id").notNull().references(() => users.id),
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  wordId: uuid("word_id").references(() => words.id),
  status: gameStatusEnum("status").notNull().default("lobby"),
  currentRound: integer("current_round").notNull().default(0),
  maxRounds: integer("max_rounds").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  mafiaCount: integer("mafia_count").notNull().default(1),
  showCategories: boolean("show_categories").notNull().default(false),
  gameMode: text("game_mode").notNull().default("chameleon"),
  sheriffEnabled: boolean("sheriff_enabled").notNull().default(true),
  angelEnabled: boolean("angel_enabled").notNull().default(true),
  revealRoleOnDeath: boolean("reveal_role_on_death").notNull().default(false),
  winner: text("winner"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastNightVictim: uuid("last_night_victim").references(() => users.id, { onDelete: "set null" }),
  lastLynchVictim: uuid("last_lynch_victim").references(() => users.id, { onDelete: "set null" }),
});

export const gamePlayers = pgTable("game_players", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  isOutsider: boolean("is_outsider").notNull().default(false),
  isEliminated: boolean("is_eliminated").notNull().default(false),
  joinOrder: integer("join_order").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  role: playerRoleEnum("role"),
});

export const rounds = pgTable("rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  hintOrder: uuid("hint_order").array().notNull(),
});

export const hintsGiven = pgTable("hints_given", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").notNull().references(() => rounds.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").notNull().references(() => users.id),
  givenAt: timestamp("given_at", { withTimezone: true }).notNull().defaultNow(),
});

export const votes = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").notNull().references(() => rounds.id, { onDelete: "cascade" }),
  voterId: uuid("voter_id").notNull().references(() => users.id),
  votedForId: uuid("voted_for_id").notNull().references(() => users.id),
  castAt: timestamp("cast_at", { withTimezone: true }).notNull().defaultNow(),
});

export const nightActions = pgTable("night_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  actionType: nightActionTypeEnum("action_type").notNull(),
  targetId: uuid("target_id").notNull().references(() => users.id),
  result: text("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dayVotes = pgTable("day_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  voterId: uuid("voter_id").notNull().references(() => users.id),
  targetId: uuid("target_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
