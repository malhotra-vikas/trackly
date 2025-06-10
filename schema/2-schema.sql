-- Drop policy if it already exists to avoid errors on recreation
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON users;
CREATE POLICY "Allow insert for authenticated users" ON users
FOR INSERT
WITH CHECK (true);

-- Drop policy if it already exists
DROP POLICY IF EXISTS "Allow all select on users" ON users;
CREATE POLICY "Allow all select on users" ON users
FOR SELECT
USING (true);

-- Drop policy if it already exists
DROP POLICY IF EXISTS "Allow insert for watchlist items" ON watchlist_items;
CREATE POLICY "Allow insert for watchlist items" ON watchlist_items
FOR INSERT
WITH CHECK (true);

-- Drop policy if it already exists
DROP POLICY IF EXISTS "Allow all select on watchlist items" ON watchlist_items;
CREATE POLICY "Allow all select on watchlist items" ON watchlist_items
FOR SELECT
USING (true);

-- Drop policy if it already exists
DROP POLICY IF EXISTS "Allow all delete on watchlist items" ON watchlist_items; 
CREATE POLICY "Allow all delete on watchlist items" ON watchlist_items
FOR DELETE
USING (true);