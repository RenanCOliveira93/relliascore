
-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.leads;

-- Create a tighter INSERT policy that validates data constraints
CREATE POLICY "Allow validated anonymous inserts" ON public.leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Ensure name is reasonable length
    length(name) BETWEEN 1 AND 200
    -- Ensure email looks valid  
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(email) <= 320
    -- Ensure optional fields have reasonable limits
    AND (phone IS NULL OR length(phone) <= 30)
    AND (website_url IS NULL OR length(website_url) <= 2048)
    AND (search_query IS NULL OR length(search_query) <= 2000)
    AND (analysis_mode IS NULL OR analysis_mode IN ('business', 'influencer'))
  );
