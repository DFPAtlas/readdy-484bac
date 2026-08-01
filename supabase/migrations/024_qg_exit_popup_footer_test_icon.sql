-- QG Launch Rewards: Exit Popup Footer Test Icon
-- Adds a setting so admin can toggle a small footer test icon
-- for manually opening the QG Launch Rewards exit-intent popup

INSERT INTO app.qg_launch_reward_settings (key, value, updated_at)
VALUES ('exit_popup_test_icon_enabled', 'false', now())
ON CONFLICT (key) DO NOTHING;