-- ============================================================
-- Demo Data Seed Script
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================
-- Creates 7 demo consultant accounts + 500 time entries
-- across Jan–Mar 2026 using your existing customers.
--
-- Demo login credentials after running:
--   erica.blair@demo.example.com   / Demo1234!
--   christine.ng@demo.example.com  / Demo1234!
--   dev.patel@demo.example.com     / Demo1234!
--   leslie.guthrie@demo.example.com/ Demo1234!
--   aja.servais@demo.example.com   / Demo1234!
--   martyna.smiech@demo.example.com/ Demo1234!
--   nish.hines@demo.example.com    / Demo1234!
-- ============================================================

DO $$
DECLARE
  v_names   text[] := ARRAY[
    'Erica Blair', 'Christine Ng', 'Dev Patel', 'Leslie Guthrie',
    'AJA Servais', 'Martyna Smiech', 'Nish Hines'
  ];
  v_emails  text[] := ARRAY[
    'erica.blair@demo.example.com', 'christine.ng@demo.example.com',
    'dev.patel@demo.example.com',   'leslie.guthrie@demo.example.com',
    'aja.servais@demo.example.com', 'martyna.smiech@demo.example.com',
    'nish.hines@demo.example.com'
  ];
  v_pw         text;
  v_ids        uuid[]  := '{}';
  v_id         uuid;
  v_existing   uuid;

  v_customers  uuid[];
  v_slines     uuid[];
  v_sline_names text[];
  v_wstreams   uuid[];
  v_atypes     uuid[];
  v_weekdays   date[]  := '{}';
  v_sc_id      uuid;

  v_durations  int[]  := ARRAY[30, 45, 60, 90, 120, 180, 240];
  v_notes      text[] := ARRAY[
    'Initial kickoff meeting',
    'Reviewed migration plan with client',
    'Built custom widget per spec',
    'QA pass on integration',
    'Follow-up on open items',
    'Documentation update',
    'Internal sync',
    'Client onboarding session',
    'Investigated reported bug',
    'Deployed latest changes to staging',
    '', '', '', '', '', '', '', '', '', ''  -- blanks for 50% empty notes
  ];

  v_d       date;
  v_uid     uuid;
  v_sl_id   uuid;
  v_n       int;
  i         int;
BEGIN

  -- ── 1. Pre-compute bcrypt hash once (pgcrypto is enabled by default) ──────
  v_pw := crypt('Demo1234!', gen_salt('bf'));

  -- ── 2. Create consultant users ────────────────────────────────────────────
  FOR i IN 1..array_length(v_names, 1) LOOP
    SELECT id INTO v_existing FROM auth.users WHERE email = v_emails[i];

    IF v_existing IS NOT NULL THEN
      v_ids := v_ids || v_existing;
      RAISE NOTICE 'User % already exists — reusing', v_emails[i];
    ELSE
      v_id := gen_random_uuid();

      INSERT INTO auth.users (
        id, instance_id,
        email, encrypted_password,
        email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        aud, role,
        created_at, updated_at
      ) VALUES (
        v_id,
        '00000000-0000-0000-0000-000000000000',
        v_emails[i], v_pw,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_names[i]),
        'authenticated', 'authenticated',
        now(), now()
      );

      -- Ensure profile row exists (trigger should create it, this is a safety net)
      INSERT INTO public.profiles (id, email, full_name)
      VALUES (v_id, v_emails[i], v_names[i])
      ON CONFLICT (id) DO NOTHING;

      -- Ensure consultant role exists (trigger should create it, safety net)
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_id, 'consultant')
      ON CONFLICT (user_id) DO NOTHING;

      v_ids := v_ids || v_id;
      RAISE NOTICE 'Created user %', v_emails[i];
    END IF;
  END LOOP;

  -- ── 3. Load lookup tables ─────────────────────────────────────────────────
  SELECT array_agg(id) INTO v_customers
  FROM public.customers WHERE is_active = true;

  SELECT array_agg(id ORDER BY display_order),
         array_agg(name ORDER BY display_order)
  INTO v_slines, v_sline_names
  FROM public.service_lines WHERE is_active = true;

  SELECT array_agg(id) INTO v_wstreams
  FROM public.workstreams WHERE is_active = true;

  SELECT array_agg(id) INTO v_atypes
  FROM public.activity_types WHERE is_active = true;

  IF v_customers IS NULL THEN
    RAISE EXCEPTION 'No active customers found — add customers first';
  END IF;
  IF v_slines IS NULL THEN
    RAISE EXCEPTION 'No active service lines found';
  END IF;

  -- Find Signature Care so we can weight it at ~25%
  FOR i IN 1..array_length(v_sline_names, 1) LOOP
    IF v_sline_names[i] ILIKE '%signature care%' THEN
      v_sc_id := v_slines[i];
    END IF;
  END LOOP;

  -- ── 4. Build weekdays array (Jan 1 – Mar 11 2026) ────────────────────────
  v_d := '2026-01-01'::date;
  WHILE v_d <= '2026-03-11'::date LOOP
    -- EXTRACT(DOW): 0 = Sunday, 6 = Saturday
    IF EXTRACT(DOW FROM v_d) NOT IN (0, 6) THEN
      v_weekdays := v_weekdays || v_d;
    END IF;
    v_d := v_d + 1;
  END LOOP;

  v_n := array_length(v_weekdays, 1);

  -- ── 5. Insert 500 time entries ────────────────────────────────────────────
  FOR i IN 1..500 LOOP
    -- Round-robin consultant assignment
    v_uid := v_ids[ 1 + ((i - 1) % array_length(v_ids, 1)) ];

    -- Service line: ~25% Signature Care, rest uniform random
    IF v_sc_id IS NOT NULL AND random() < 0.25 THEN
      v_sl_id := v_sc_id;
    ELSE
      v_sl_id := v_slines[ 1 + (floor(random() * array_length(v_slines, 1)))::int ];
    END IF;

    INSERT INTO public.time_entries (
      user_id,
      customer_id,
      service_line_id,
      workstream_id,
      activity_type_id,
      entry_date,
      duration_minutes,
      notes,
      created_by,
      updated_by
    ) VALUES (
      v_uid,
      v_customers[ 1 + (floor(random() * array_length(v_customers, 1)))::int ],
      v_sl_id,
      v_wstreams[  1 + (floor(random() * array_length(v_wstreams,  1)))::int ],
      v_atypes[    1 + (floor(random() * array_length(v_atypes,    1)))::int ],
      v_weekdays[  1 + (floor(random() * v_n))::int ],
      v_durations[ 1 + (floor(random() * array_length(v_durations, 1)))::int ],
      v_notes[     1 + (floor(random() * array_length(v_notes,     1)))::int ],
      v_uid,
      v_uid
    );
  END LOOP;

  RAISE NOTICE '✓ Done — 500 entries inserted for % consultants across % customers',
    array_length(v_ids, 1), array_length(v_customers, 1);

END $$;
