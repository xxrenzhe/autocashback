ALTER TABLE offers ADD COLUMN ad_spend_cap_usd NUMERIC(10, 2) NOT NULL DEFAULT 200;
ALTER TABLE offers ADD COLUMN manual_recorded_ad_spend_usd NUMERIC(10, 2) NOT NULL DEFAULT 0;

UPDATE offers
SET ad_spend_cap_usd = commission_cap_usd
WHERE ad_spend_cap_usd = 200
  AND commission_cap_usd IS NOT NULL;
