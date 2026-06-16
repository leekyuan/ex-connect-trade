ALTER TABLE public.trading_settings
  DROP COLUMN IF EXISTS api_key_encrypted,
  DROP COLUMN IF EXISTS api_secret_encrypted,
  DROP COLUMN IF EXISTS passphrase_encrypted;