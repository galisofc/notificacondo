-- Update existing WhatsApp templates to use uppercase BLOCO and APTO
UPDATE public.whatsapp_templates
SET content = REPLACE(
  REPLACE(content, 'Bloco {bloco}, Apto {apartamento}', 'BLOCO {bloco}, APTO {apartamento}'),
  'Bloco {bloco}, Ap. {apartamento}', 'BLOCO {bloco}, APTO {apartamento}'
),
updated_at = now()
WHERE content LIKE '%Bloco {bloco}%' 
   OR content LIKE '%Apto {apartamento}%'
   OR content LIKE '%Ap. {apartamento}%';

-- Also update any condominium-specific templates
UPDATE public.condominium_whatsapp_templates
SET content = REPLACE(
  REPLACE(content, 'Bloco {bloco}, Apto {apartamento}', 'BLOCO {bloco}, APTO {apartamento}'),
  'Bloco {bloco}, Ap. {apartamento}', 'BLOCO {bloco}, APTO {apartamento}'
),
updated_at = now()
WHERE content LIKE '%Bloco {bloco}%' 
   OR content LIKE '%Apto {apartamento}%'
   OR content LIKE '%Ap. {apartamento}%';