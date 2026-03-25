

## Plano: Mostrar versão da API no card de conexão WhatsApp

### Objetivo
Adicionar a versão da API da Meta (v25.0) no card de informações de conexão, junto com Empresa, Número e Qualidade.

### Mudança

**`src/pages/superadmin/WhatsAppConfig.tsx`** (linhas 315-344)

Adicionar uma 4ª coluna no grid de informações de conexão, alterando `sm:grid-cols-3` para `sm:grid-cols-4`, com:

```tsx
<div>
  <p className="text-xs text-muted-foreground mb-1">Versão da API</p>
  <Badge className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
    v25.0
  </Badge>
</div>
```

O valor será estático (`v25.0`) pois é definido no módulo compartilhado do backend. Quando a versão mudar, basta atualizar aqui também.

### Arquivo
- `src/pages/superadmin/WhatsAppConfig.tsx`

