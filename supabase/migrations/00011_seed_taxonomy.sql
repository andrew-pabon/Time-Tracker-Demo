-- 00011_seed_taxonomy.sql
--
-- Inserts the initial taxonomy values specified in the product requirements.
-- These are normal database rows — admins can rename, reorder, deactivate,
-- or add new ones through the UI after deployment.
--
-- display_order values are spaced by 10 so new items can be inserted
-- between existing ones without reordering the entire table.

-- Service Lines
insert into public.service_lines (name, display_order) values
    ('Onboarding',       10),
    ('Email Migration',  20),
    ('Signature Care',   30);

-- Workstreams
insert into public.workstreams (name, display_order) values
    ('Custom Design',       10),
    ('Widget Development',  20),
    ('Custom Integration',  30),
    ('Troubleshooting',     40),
    ('Strategic Advisory',  50),
    ('Documentation',       60),
    ('QA',                  70);

-- Activity Types
insert into public.activity_types (name, display_order) values
    ('Meeting',                10),
    ('Build',                  20),
    ('Review',                 30),
    ('Research',               40),
    ('Internal Collaboration', 50);
