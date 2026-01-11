-- Remove deposit_amount column from party_hall_settings table
ALTER TABLE public.party_hall_settings DROP COLUMN IF EXISTS deposit_amount;

-- Remove deposit_paid column from party_hall_bookings table (also not used)
ALTER TABLE public.party_hall_bookings DROP COLUMN IF EXISTS deposit_paid;