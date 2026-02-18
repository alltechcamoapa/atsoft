-- DISABLE THE USER CREATION TRIGGER to stop "Database error saving new user"
-- The application code will now handle profile creation via upsert.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Also ensure RLS allows users to insert their own profile just in case
-- (Since signUp signs them in immediately)

CREATE POLICY "Enable insert for authenticated users executing as themselves" ON "public"."profiles"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Or just allow insert/update for everyone if simple
-- CREATE POLICY "Enable insert for all" ON "public"."profiles" ... 
