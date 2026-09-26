-- O dono precisa enxergar o grupo logo ao criar (antes do gatilho que o torna membro ficar visível)
drop policy if exists "groups: membros veem" on public.groups;
create policy "groups: membros veem" on public.groups for select
  using (owner_id = auth.uid() or public.group_role(id) is not null);
