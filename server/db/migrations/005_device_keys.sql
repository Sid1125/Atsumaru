-- Hardware-backed device identity (docs/TRD.md) — 2026-09-01.
--
-- The mobile app generates an ECDSA P-256 key inside the Android Keystore, where the
-- private key is non-exportable (hardware-backed on StrongBox devices). It then uploads
-- the public key certificate (SPKI) and proves possession by signing a challenge nonce.
-- This gives the server a real, verifiable "this is the same physical device" signal,
-- rather than relying only on a token that could be lifted wholesale.
--
-- RLS stays on because the API uses the service-role key and enforces access in code.
-- `challenge_*` holds at most one pending proof so a stale signature cannot be replayed.

create table if not exists device_keys (
  user_id uuid not null references users (id) on delete cascade,
  device_id text not null,
  public_key_spki text not null,
  strongbox boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  challenge_nonce text,
  challenge_expires_at timestamptz,
  primary key (user_id, device_id)
);

alter table device_keys enable row level security;
