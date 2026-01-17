-- Create trigger to log package deletions to audit_logs
CREATE TRIGGER log_packages_delete
  AFTER DELETE ON public.packages
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event();

-- Also add triggers for INSERT and UPDATE to have complete audit trail
CREATE TRIGGER log_packages_insert
  AFTER INSERT ON public.packages
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER log_packages_update
  AFTER UPDATE ON public.packages
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event();