import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const userActivity = sqliteTable("user_activity", {
  email: text("email").primaryKey(),
  fullName: text("full_name"),
  firstSeenAt: text("first_seen_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  lastStep: integer("last_step").notNull().default(0),
  furthestStep: integer("furthest_step").notNull().default(0),
});

export const profiles = sqliteTable("profiles", {
  email: text("email").primaryKey(),
  fullName: text("full_name"),
  school: text("school").notNull(),
  major: text("major").notNull(),
  graduationYear: text("graduation_year").notNull(),
  academicLevel: text("academic_level").notNull().default("undergraduate"),
  isUmichStudent: integer("is_umich_student", { mode: "boolean" }).notNull().default(true),
  reportLanguage: text("report_language").notNull().default("en"),
  deliveryEmail: text("delivery_email").notNull().default(""),
  emailDeliveryEnabled: integer("email_delivery_enabled", { mode: "boolean" }).notNull().default(true),
  inboundAlias: text("inbound_alias"),
  forwardingEnabled: integer("forwarding_enabled", { mode: "boolean" }).notNull().default(false),
  goalsJson: text("goals_json").notNull().default("[]"),
  interestsJson: text("interests_json").notNull().default("[]"),
  roleTracksJson: text("role_tracks_json").notNull().default("[]"),
  opportunityPreferencesJson: text("opportunity_preferences_json").notNull().default("{}"),
  careerStage: text("career_stage").notNull().default("exploring"),
  bottleneck: text("bottleneck").notNull().default("finding"),
  sponsorship: text("sponsorship").notNull().default("unsure"),
  paidOnly: integer("paid_only", { mode: "boolean" }).notNull().default(false),
  deliveryTime: text("delivery_time").notNull().default("07:30"),
  weekends: integer("weekends", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  type: text("type").notNull(),
  encryptedConfig: text("encrypted_config"),
  displayLabel: text("display_label"),
  status: text("status").notNull().default("pending"),
  eventCount: integer("event_count").notNull().default(0),
  lastError: text("last_error"),
  lastSyncedAt: text("last_synced_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("sources_user_type_idx").on(table.userEmail, table.type),
]);

export const inboundEmails = sqliteTable("inbound_emails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  messageId: text("message_id").notNull(),
  encryptedContent: text("encrypted_content").notNull(),
  receivedAt: text("received_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("inbound_emails_message_idx").on(table.messageId),
  index("inbound_emails_user_received_idx").on(table.userEmail, table.receivedAt),
]);

export const radarRuns = sqliteTable("radar_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  status: text("status").notNull().default("preview"),
  outputJson: text("output_json").notNull(),
  sourceCount: integer("source_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  sentAt: text("sent_at"),
}, (table) => [
  index("radar_runs_user_created_idx").on(table.userEmail, table.createdAt),
]);

export const feedback = sqliteTable("feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  radarRunId: integer("radar_run_id"),
  itemId: text("item_id").notNull(),
  reaction: text("reaction").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("feedback_user_idx").on(table.userEmail),
]);

export const emailDeliveries = sqliteTable("email_deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  deliveryDate: text("delivery_date").notNull(),
  radarRunId: integer("radar_run_id").notNull(),
  deliveryEmail: text("delivery_email").notNull(),
  status: text("status").notNull().default("pending"),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  sentAt: text("sent_at"),
}, (table) => [
  uniqueIndex("email_deliveries_user_date_idx").on(table.userEmail, table.deliveryDate),
]);

export const publicSignals = sqliteTable("public_signals", {
  id: text("id").primaryKey(), category: text("category").notNull(), sourceId: text("source_id").notNull(),
  canonicalUrl: text("canonical_url").notNull(), contentHash: text("content_hash").notNull(), payloadJson: text("payload_json").notNull(),
  firstSeenAt: text("first_seen_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("signals_source_url_idx").on(table.sourceId, table.canonicalUrl)]);
export const publicSourceRuns = sqliteTable("public_source_runs", {
  id: text("id").primaryKey(), status: text("status").notNull(), lastAttemptAt: text("last_attempt_at").notNull(),
  lastSuccessAt: text("last_success_at"), itemCount: integer("item_count").notNull().default(0), lastError: text("last_error"),
});
export const apiRateLimits = sqliteTable("api_rate_limits", {
  id: text("id").primaryKey(), windowStart: integer("window_start").notNull(), hits: integer("hits").notNull().default(1),
});
