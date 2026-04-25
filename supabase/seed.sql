-- Replace the placeholders before running this seed in Supabase SQL editor.
-- Admin users are created in Supabase Auth first, then linked here.
-- Store passwords are created through the app admin UI so they can be hashed by the server.

insert into public.admin_profiles (user_id, email)
values ('00000000-0000-0000-0000-000000000000', 'admin@example.com')
on conflict (user_id) do update set email = excluded.email;
