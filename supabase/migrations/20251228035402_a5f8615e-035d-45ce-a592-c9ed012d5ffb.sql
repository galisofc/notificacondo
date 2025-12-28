-- Remove the existing foreign key constraint that prevents user deletion
ALTER TABLE public.audit_logs 
DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

-- Re-add the foreign key with ON DELETE SET NULL to allow user deletion
-- while preserving audit log history (user_id will become NULL for deleted users)
ALTER TABLE public.audit_logs 
ADD CONSTRAINT audit_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;