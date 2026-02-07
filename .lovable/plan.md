

# Correcao: mover delete de party_hall_notifications para fora do bloco condicional

## Problema
A exclusao de `party_hall_notifications` esta dentro do bloco `if (bookings && bookings.length > 0)` (linha 252). Se houver notificacoes mas nenhuma reserva ativa, elas nao serao removidas e a exclusao do condominio falhara.

## Correcao
Mover a linha `await supabase.from("party_hall_notifications").delete().eq("condominium_id", condominiumId);` para **fora** do bloco condicional, junto com os outros deletes independentes (como `party_hall_settings` e `party_hall_checklist_templates`).

## Detalhes Tecnicos

Arquivo: `src/components/superadmin/CondominiumsManagement.tsx`

Antes (linhas 246-278):
```typescript
// 2. Delete party hall related data
const { data: bookings } = await supabase...
if (bookings && bookings.length > 0) {
  // ... checklists ...
  // Delete party hall notifications  <-- DENTRO do if
  await supabase.from("party_hall_notifications").delete()...
  // Delete bookings
  await supabase.from("party_hall_bookings").delete()...
}
// Delete party hall settings
// Delete party hall checklist templates
```

Depois:
```typescript
// 2. Delete party hall related data
const { data: bookings } = await supabase...
if (bookings && bookings.length > 0) {
  // ... checklists ...
  // Delete bookings
  await supabase.from("party_hall_bookings").delete()...
}
// Delete party hall notifications  <-- FORA do if
await supabase.from("party_hall_notifications").delete()...
// Delete party hall settings
// Delete party hall checklist templates
```

Nenhuma outra alteracao e necessaria. A ordem das demais exclusoes esta correta.
