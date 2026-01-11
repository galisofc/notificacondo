-- Create table for party hall notification history
CREATE TABLE public.party_hall_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.party_hall_bookings(id) ON DELETE CASCADE,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('reminder', 'cancelled', 'confirmed')),
  phone TEXT NOT NULL,
  message_content TEXT NOT NULL,
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.party_hall_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for sindicos (condominium owners)
CREATE POLICY "Sindicos can view their condominium notifications"
ON public.party_hall_notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.condominiums c
    WHERE c.id = party_hall_notifications.condominium_id
    AND c.owner_id = auth.uid()
  )
);

-- Policy for super admins
CREATE POLICY "Super admins can view all notifications"
ON public.party_hall_notifications
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- Create index for faster queries
CREATE INDEX idx_party_hall_notifications_condominium ON public.party_hall_notifications(condominium_id);
CREATE INDEX idx_party_hall_notifications_booking ON public.party_hall_notifications(booking_id);
CREATE INDEX idx_party_hall_notifications_sent_at ON public.party_hall_notifications(sent_at DESC);