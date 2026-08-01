-- 022_qg_launch_rewards_exit_popup.sql
-- Phase: Exit-Intent Popup Settings
-- Adds settings for the temporary QG Launch Rewards exit-intent popup feature

INSERT INTO app.qg_launch_reward_settings (key, value, updated_at)
VALUES
  ('exit_popup_enabled', 'true', now()),
  ('exit_popup_show_on_homepage', 'true', now()),
  ('exit_popup_mobile_delay_seconds', '45', now()),
  ('exit_popup_cooldown_days', '7', now())
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at;