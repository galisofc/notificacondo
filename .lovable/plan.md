

## Drag-and-Drop para Cards de Manutenção (Zelador)

### Problema atual
Não existe drag-and-drop implementado. Os cards só mudam de coluna via botão "Iniciar". O usuário quer arrastar cards (incluindo vencidos) para "Em execução" sem alterar a data de vencimento.

### Implementação

**Arquivo**: `src/pages/zelador/Manutencoes.tsx`

1. **Importar `@dnd-kit`** (já instalado): `DndContext`, `DragOverlay`, `useDroppable`, `useDraggable`, sensores `PointerSensor` e `TouchSensor`

2. **Componente `DroppableColumn`**: Envolver cada coluna (Vencidas, Pendentes, Em execução) com `useDroppable`, usando IDs `vencidas`, `pendentes`, `em_execucao`

3. **Componente `DraggableCard`**: Envolver cada card com `useDraggable`, usando `task.id` como identificador. Cursor `grab`/`grabbing`. Cards finalizados **não** serão arrastáveis.

4. **Handler `onDragEnd`**:
   - Card solto em **"Em execução"** → executa `startTaskMutation` (muda status para `em_execucao`, **sem alterar `next_due_date`**)
   - Card de "Em execução" solto em **"Pendentes"** ou **"Vencidas"** → reverte status para `em_dia`
   - Drop na mesma coluna ou em "Finalizados" → ignorado

5. **Feedback visual**:
   - `DragOverlay` com versão semitransparente do card
   - Highlight (borda/fundo) na coluna destino durante hover
   - Sensores com `activationConstraint: { distance: 8 }` para não conflitar com cliques/scroll no mobile

6. **Texto do card em execução**: Quando `status === "em_execucao"` e a data estiver vencida, exibir algo como "Em execução • Vencida em dd/MM" em vez de "Atrasada há X dias", para deixar claro que está sendo trabalhada mesmo com data passada.

### Sem alterações no banco
A mutation `startTaskMutation` já existe e só altera `status` sem tocar na data. Nenhuma migração necessária.

