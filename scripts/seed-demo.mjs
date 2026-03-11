/**
 * Demo Data Seed Script
 *
 * Creates fake consultant users and ~500 time entries for demo purposes.
 *
 * SETUP (before running):
 * 1. Add your service role key to .env.local:
 *      SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *    (Supabase Dashboard → Project Settings → API → service_role key)
 *
 * 2. Fill in the CONSULTANT_NAMES array below with the names you want.
 *
 * RUN:
 *   node scripts/seed-demo.mjs
 *
 * RE-RUNS: Already-created users are skipped. New entries are always added.
 * To wipe demo entries first, run with --clean flag:
 *   node scripts/seed-demo.mjs --clean
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ─── CONFIGURE THESE ──────────────────────────────────────────────────────────

const CONSULTANT_NAMES = [
  // Add names here, e.g.:
  // "Sarah Johnson",
  // "Marcus Williams",
  // "Priya Patel",
  // "Derek Chen",
];

const TOTAL_ENTRIES = 500;
const DATE_FROM = new Date("2026-01-01");
const DATE_TO = new Date("2026-03-11");

// ─── SCRIPT ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Parse .env.local
function loadEnv() {
  const envPath = resolve(ROOT, ".env.local");
  let raw;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    console.error("❌ Could not read .env.local");
    process.exit(1);
  }
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env["VITE_SUPABASE_URL"];
const SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL) {
  console.error("❌ VITE_SUPABASE_URL not found in .env.local");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error(
    "❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local\n" +
      "   Add it: SUPABASE_SERVICE_ROLE_KEY=eyJ...\n" +
      "   (Supabase Dashboard → Project Settings → API → service_role)"
  );
  process.exit(1);
}
if (CONSULTANT_NAMES.length === 0) {
  console.error(
    "❌ CONSULTANT_NAMES array is empty.\n" +
      "   Edit scripts/seed-demo.mjs and add names at the top."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CLEAN = process.argv.includes("--clean");

// Helpers
function nameToEmail(name) {
  return name.toLowerCase().replace(/\s+/g, ".") + "@demo.example.com";
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRandom(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function allWeekdays(from, to) {
  const days = [];
  const d = new Date(from);
  while (d <= to) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

const DURATIONS = [30, 45, 60, 90, 120, 180, 240];
const DURATION_WEIGHTS = [5, 8, 15, 20, 20, 15, 10];

const NOTES_POOL = [
  "Initial kickoff meeting",
  "Reviewed migration plan with client",
  "Built custom widget per spec",
  "QA pass on integration",
  "Follow-up on open items",
  "Documentation update",
  "Internal sync",
  "Client onboarding session",
  "Investigated reported bug",
  "Deployed latest changes to staging",
  "Reviewed design mockups",
  "Strategy session with stakeholders",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
];

async function main() {
  console.log(`\n🌱 Time Tracker Demo Seeder`);
  console.log(`   Consultants : ${CONSULTANT_NAMES.join(", ")}`);
  console.log(`   Target entries: ${TOTAL_ENTRIES}`);
  console.log(`   Date range: ${toISODate(DATE_FROM)} → ${toISODate(DATE_TO)}\n`);

  // ── Optional clean ────────────────────────────────────────────────────────
  if (CLEAN) {
    console.log("🧹 --clean flag detected. Deleting existing demo entries...");
    const demoEmails = CONSULTANT_NAMES.map(nameToEmail);
    const { data: demoPros } = await supabase
      .from("profiles")
      .select("id, email")
      .in("email", demoEmails);
    const demoIds = (demoPros ?? []).map((p) => p.id);
    if (demoIds.length > 0) {
      const { error } = await supabase
        .from("time_entries")
        .delete()
        .in("user_id", demoIds);
      if (error) console.warn("  Warning deleting entries:", error.message);
      else console.log(`  Deleted entries for ${demoIds.length} demo users.\n`);
    } else {
      console.log("  No demo users found yet.\n");
    }
  }

  // ── Step 1: Create consultant users ──────────────────────────────────────
  console.log("👤 Creating consultant users...");
  const consultantIds = [];

  for (const name of CONSULTANT_NAMES) {
    const email = nameToEmail(name);

    // Check if user already exists via profiles table
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      console.log(`   ↩  ${name} (${email}) already exists — skipping`);
      consultantIds.push(existing.id);
      continue;
    }

    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password: "Demo1234!",
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (error) {
      // User may already exist in auth but not profiles (edge case)
      if (error.message?.includes("already been registered")) {
        console.log(`   ↩  ${name} (${email}) already in auth — fetching profile`);
        const { data: p } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (p) consultantIds.push(p.id);
      } else {
        console.error(`   ❌ Failed to create ${name}: ${error.message}`);
      }
      continue;
    }

    const userId = created.user.id;
    consultantIds.push(userId);
    console.log(`   ✓  ${name} (${email}) created`);

    // The trg_handle_new_user trigger should create profile + consultant role.
    // Add a small delay to allow the trigger to fire before we proceed.
    await new Promise((r) => setTimeout(r, 300));
  }

  if (consultantIds.length === 0) {
    console.error("\n❌ No consultant IDs available. Aborting.");
    process.exit(1);
  }
  console.log(`\n   ${consultantIds.length} consultant(s) ready.\n`);

  // ── Step 2: Query lookup data ─────────────────────────────────────────────
  console.log("📋 Fetching lookup data...");

  const [
    { data: customers, error: cErr },
    { data: serviceLines, error: slErr },
    { data: workstreams, error: wsErr },
    { data: activityTypes, error: atErr },
  ] = await Promise.all([
    supabase.from("customers").select("id, name").eq("is_active", true),
    supabase.from("service_lines").select("id, name").eq("is_active", true),
    supabase.from("workstreams").select("id, name").eq("is_active", true),
    supabase.from("activity_types").select("id, name").eq("is_active", true),
  ]);

  for (const [label, data, err] of [
    ["customers", customers, cErr],
    ["service_lines", serviceLines, slErr],
    ["workstreams", workstreams, wsErr],
    ["activity_types", activityTypes, atErr],
  ]) {
    if (err) {
      console.error(`❌ Failed to fetch ${label}: ${err.message}`);
      process.exit(1);
    }
    if (!data || data.length === 0) {
      console.error(`❌ No ${label} found in the database. Add some first.`);
      process.exit(1);
    }
    console.log(`   ✓  ${data.length} ${label}`);
  }

  // Weight customers: top 3 get ~60% of entries
  const customerWeights = customers.map((_, i) =>
    i === 0 ? 25 : i === 1 ? 20 : i === 2 ? 15 : Math.max(1, 40 / (customers.length - 3 || 1))
  );

  // Weight service lines: "Signature Care" gets ~25%
  const scIndex = serviceLines.findIndex((sl) =>
    sl.name.toLowerCase().includes("signature care")
  );
  const serviceLineWeights = serviceLines.map((_, i) => {
    if (i === scIndex) return 25;
    const remaining = serviceLines.length - (scIndex >= 0 ? 1 : 0);
    return remaining > 0 ? 75 / remaining : 33;
  });

  // ── Step 3: Generate entries ──────────────────────────────────────────────
  console.log(`\n⚙️  Generating ${TOTAL_ENTRIES} time entries...`);
  const weekdays = allWeekdays(DATE_FROM, DATE_TO);

  const entries = [];
  for (let i = 0; i < TOTAL_ENTRIES; i++) {
    const userId = consultantIds[i % consultantIds.length];
    const customer = weightedRandom(customers, customerWeights);
    const serviceLine = weightedRandom(serviceLines, serviceLineWeights);
    const workstream = randomFrom(workstreams);
    const activityType = randomFrom(activityTypes);
    const entryDate = randomFrom(weekdays);
    const duration = weightedRandom(DURATIONS, DURATION_WEIGHTS);
    const notes = randomFrom(NOTES_POOL);

    entries.push({
      user_id: userId,
      customer_id: customer.id,
      service_line_id: serviceLine.id,
      workstream_id: workstream.id,
      activity_type_id: activityType.id,
      entry_date: entryDate,
      duration_minutes: duration,
      notes,
      created_by: userId,
      updated_by: userId,
    });
  }

  // ── Step 4: Batch insert ──────────────────────────────────────────────────
  console.log(`   Inserting in batches of 50...`);
  const BATCH_SIZE = 50;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("time_entries").insert(batch);
    if (error) {
      console.warn(`   ⚠  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`);
      failed += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`\r   Progress: ${inserted}/${TOTAL_ENTRIES}`);
    }
  }
  console.log();

  // ── Summary ───────────────────────────────────────────────────────────────
  const uniqueCustomers = new Set(entries.map((e) => e.customer_id)).size;
  const scEntries = entries.filter((e) => {
    const sl = serviceLines.find((s) => s.id === e.service_line_id);
    return sl?.name?.includes("Signature Care");
  }).length;

  console.log(`
✅ Done!
   ${consultantIds.length} consultant user(s) ready
   ${inserted} entries inserted${failed > 0 ? ` (${failed} failed)` : ""}
   ${uniqueCustomers} customers covered
   ~${scEntries} Signature Care entries

Next steps:
  • Open the app → Reports → Dashboard tab
  • Check Customers Overview and Signature Care tabs
  • Log in as a demo consultant: <email>@demo.example.com / Demo1234!
`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
