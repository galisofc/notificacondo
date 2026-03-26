UPDATE whatsapp_templates 
SET button_config = NULL
WHERE slug IN ('decision_fine', 'decision_archived', 'decision_warning') AND is_active = true;