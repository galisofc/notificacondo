

# Corrigir exclusao de condominios - Foreign Key whatsapp_notification_logs

## Problema
Ao excluir um condominio, a tabela `whatsapp_notification_logs` possui uma foreign key (`condominium_id`) que referencia `condominiums`, impedindo a exclusao.

O mesmo problema pode ocorrer com `party_hall_notifications` que tambem tem `condominium_id`.

## Causa Raiz
Dois locais do codigo fazem exclusao de condominios, mas nenhum deles limpa os registros de `whatsapp_notification_logs` nem `party_hall_notifications` antes:

1. **Edge Function `delete-sindico`** - usada para excluir sindicos e seus condominios
2. **`CondominiumsManagement.tsx`** - exclusao direta de condominios pelo Super Admin

## Correcao

### 1. Edge Function `delete-sindico/index.ts`
Adicionar a exclusao de `whatsapp_notification_logs` e `party_hall_notifications` antes de excluir os condominios (antes do passo 6 - condominium_transfers):

```typescript
// Delete whatsapp_notification_logs
await supabaseAdmin.from("whatsapp_notification_logs").delete().in("condominium_id", condoIds);
console.log("Deleted whatsapp_notification_logs");

// Delete party_hall_notifications
await supabaseAdmin.from("party_hall_notifications").delete().in("condominium_id", condoIds);
console.log("Deleted party_hall_notifications");

// Delete party_hall_bookings and checklists
const { data: bookings } = await supabaseAdmin
  .from("party_hall_bookings")
  .select("id")
  .in("condominium_id", condoIds);

if (bookings && bookings.length > 0) {
  const bookingIds = bookings.map(b => b.id);
  await supabaseAdmin.from("party_hall_checklist_items").delete()
    .in("checklist_id", 
      (await supabaseAdmin.from("party_hall_checklists").select("id").in("booking_id", bookingIds)).data?.map(c => c.id) || []
    );
  await supabaseAdmin.from("party_hall_checklists").delete().in("booking_id", bookingIds);
  await supabaseAdmin.from("party_hall_bookings").delete().in("condominium_id", condoIds);
}
console.log("Deleted party hall data");
```

### 2. `CondominiumsManagement.tsx`
Adicionar antes do passo 10 (delete condominium):

```typescript
// Delete whatsapp_notification_logs
await supabase.from("whatsapp_notification_logs").delete().eq("condominium_id", condominiumId);

// Delete party_hall_notifications
await supabase.from("party_hall_notifications").delete().eq("condominium_id", condominiumId);
```

---

## Detalhes Tecnicos

As tabelas que referenciam `condominiums` via foreign key e que precisam ser limpas antes da exclusao:

| Tabela | Coluna FK | Ja tratada? |
|--------|-----------|-------------|
| `blocks` | `condominium_id` | Sim |
| `subscriptions` | `condominium_id` | Sim |
| `invoices` | `condominium_id` | Sim |
| `packages` | `condominium_id` | Sim |
| `occurrences` | `condominium_id` | Sim |
| `condominium_transfers` | `condominium_id` | Sim |
| `condominium_whatsapp_templates` | `condominium_id` | Sim (so no frontend) |
| `whatsapp_notification_logs` | `condominium_id` | **NAO** - causa o erro |
| `party_hall_notifications` | `condominium_id` | **NAO** - pode causar erro |
| `party_hall_bookings` | `condominium_id` | **NAO** - pode causar erro |

