-- 028_qg_popup_all_public_pages.sql
-- Adds exit_popup_show_on_all_public_pages and exit_popup_mobile_enabled settings
-- for controlling the QG Launch Rewards exit popup across public marketing pages.

INSERT INTO app.qg_launch_reward_settings (key, value, updated_at)
VALUES ('exit_popup_show_on_all_public_pages', 'true'::jsonb, now())
ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();

INSERT INTO app.qg_launch_reward_settings (key, value, updated_at)
VALUES ('exit_popup_mobile_enabled', 'false'::jsonb, now())
ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();