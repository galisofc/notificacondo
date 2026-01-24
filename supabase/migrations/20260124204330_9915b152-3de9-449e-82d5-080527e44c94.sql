-- Create table for WABA notification debug logs
CREATE TABLE public.whatsapp_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Context
  function_name TEXT NOT NULL,
  package_id UUID,
  resident_id UUID,
  phone TEXT,
  
  -- Template info
  template_name TEXT,
  template_language TEXT,
  
  -- Request/Response
  request_payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  
  -- Result
  success BOOLEAN NOT NULL DEFAULT false,
  message_id TEXT,
  error_message TEXT,
  
  -- Debug details from WABA sender
  debug_info JSONB
);

-- Enable RLS
ALTER TABLE public.whatsapp_notification_logs ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view these logs
CREATE POLICY "Super admins can view WABA logs"
  ON public.whatsapp_notification_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Service role can insert (from edge functions)
CREATE POLICY "Service role can insert WABA logs"
  ON public.whatsapp_notification_logs
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for common queries
CREATE INDEX idx_whatsapp_notification_logs_created_at 
  ON public.whatsapp_notification_logs(created_at DESC);

CREATE INDEX idx_whatsapp_notification_logs_package_id 
  ON public.whatsapp_notification_logs(package_id);

CREATE INDEX idx_whatsapp_notification_logs_success 
  ON public.whatsapp_notification_logs(success);

-- Add comment
COMMENT ON TABLE public.whatsapp_notification_logs IS 'Logs de debug para notificações WABA (WhatsApp Business API)';