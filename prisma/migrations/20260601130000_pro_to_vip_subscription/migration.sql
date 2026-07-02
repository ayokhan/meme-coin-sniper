-- Retire Pro tier: all active and historical Pro subscriptions are VIP.
UPDATE "Subscription" SET tier = 'vip' WHERE tier = 'pro';
