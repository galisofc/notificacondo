-- Create table for contact messages
CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  read_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (public form)
CREATE POLICY "Anyone can submit contact messages"
ON public.contact_messages
FOR INSERT
WITH CHECK (true);

-- Policy: Only super_admin can read
CREATE POLICY "Super admins can view contact messages"
ON public.contact_messages
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- Policy: Only super_admin can update (mark as read)
CREATE POLICY "Super admins can update contact messages"
ON public.contact_messages
FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

-- Policy: Only super_admin can delete
CREATE POLICY "Super admins can delete contact messages"
ON public.contact_messages
FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));