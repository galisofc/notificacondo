
UPDATE whatsapp_templates 
SET variables = ARRAY['nome', 'titulo', 'condominio', 'justificativa'],
    params_order = NULL,
    button_config = '[{"type": "url", "has_dynamic_suffix": true}]'::jsonb
WHERE slug = 'decision_fine' AND is_active = true;

UPDATE whatsapp_templates 
SET variables = ARRAY['nome', 'titulo', 'condominio', 'justificativa'],
    params_order = NULL,
    button_config = '[{"type": "url", "has_dynamic_suffix": true}]'::jsonb
WHERE slug = 'decision_archived' AND is_active = true;

UPDATE whatsapp_templates 
SET variables = ARRAY['nome', 'titulo', 'condominio', 'justificativa'],
    params_order = ARRAY['condominio', 'nome', 'titulo', 'justificativa'],
    button_config = '[{"type": "url", "has_dynamic_suffix": true}]'::jsonb
WHERE slug = 'decision_warning' AND is_active = true;
