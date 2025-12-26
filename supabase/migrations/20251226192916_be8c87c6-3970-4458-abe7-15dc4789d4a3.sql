-- Create table for MercadoPago webhook logs
CREATE TABLE public.mercadopago_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  event_action TEXT,
  data_id TEXT,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN,
  processing_status TEXT NOT NULL DEFAULT 'received',
  processing_result JSONB,
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  processing_duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for querying by event type and date
CREATE INDEX idx_mercadopago_webhook_logs_event_type ON public.mercadopago_webhook_logs(event_type);
CREATE INDEX idx_mercadopago_webhook_logs_received_at ON public.mercadopago_webhook_logs(received_at DESC);
CREATE INDEX idx_mercadopago_webhook_logs_data_id ON public.mercadopago_webhook_logs(data_id);
CREATE INDEX idx_mercadopago_webhook_logs_processing_status ON public.mercadopago_webhook_logs(processing_status);

-- Enable RLS
ALTER TABLE public.mercadopago_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view webhook logs
CREATE POLICY "Super admins can view webhook logs"
ON public.mercadopago_webhook_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- Add comment
COMMENT ON TABLE public.mercadopago_webhook_logs IS 'Audit logs for MercadoPago webhook notifications';