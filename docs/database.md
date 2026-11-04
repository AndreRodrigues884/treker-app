# Base de dados do Treker

Este documento explica como estão organizados os dados da v1 (Gym e Natação) e que regras os protegem. O código está em [`supabase/migrations/`](../supabase/migrations/) e os testes em [`supabase/tests/`](../supabase/tests/).

## Ideias de base

- **O Postgres é a última linha de defesa.** A app fala diretamente com o Supabase, por isso tudo o que a app verifica também é verificado na base de dados: quem pode ver o quê, a quem pertencem as referências e que valores são possíveis.
- **Preparada para funcionar offline.** Os ids (UUID) podem ser gerados no telemóvel. Assim, reenviar a mesma série durante a sincronização nunca a duplica: o id já existe.
- **Apagar é marcar.** Nas tabelas de dados, apagar significa preencher `deleted_at`. A linha continua lá para que os outros telemóveis do atleta saibam, na sincronização, que ela foi apagada. Só o servidor apaga linhas a sério (por exemplo, quando se apaga a conta).
- **Datas de treino são datas locais.** `local_date` é o dia do calendário do atleta, enviado pela app. Nunca se calcula a partir de UTC; um treino às 00:30 em Lisboa fica no dia certo.

## Tabelas

```mermaid
erDiagram
  auth_users ||--|| profiles : "tem"
  auth_users ||--o{ exercises : "cria (personalizados)"
  auth_users ||--o{ workout_templates : "guarda"
  auth_users ||--o{ activities : "regista"
  workout_templates ||--o{ workout_template_exercises : "contém"
  exercises ||--o{ workout_template_exercises : "usado em"
  workout_templates |o--o{ activities : "origem de"
  activities ||--o{ gym_sets : "séries (gym)"
  activities ||--o{ swim_entries : "tempos (natação)"
  exercises ||--o{ gym_sets : "usado em"
```

### `profiles` — o perfil

Uma linha por utilizador, com o mesmo id da conta (`auth.users.id`). **É criada automaticamente quando a pessoa se regista**, por um trigger que lê o nome escolhido no registo.

| Coluna | O que guarda |
| --- | --- |
| `display_name` | Nome a mostrar (até 50 caracteres, opcional) |
| `weight_unit` | `kg` ou `lb` |
| `pool_unit` | `m` ou `yd` |
| `timezone` | Fuso horário IANA, por exemplo `Europe/Lisbon` |
| `locale` | Língua da app: `en` ou `pt` |
| `bodyweight_kg` | Peso corporal. **Privado**: nunca entra em vistas públicas |
| `visibility` | `private` por defeito |

### `exercises` — exercícios

Duas famílias na mesma tabela:

- **Biblioteca partilhada** (`owner_id` vazio): 68 exercícios comuns, com `slug` (ex.: `barbell-bench-press`) e nomes em inglês e português. É carregada pelo [`supabase/seed.sql`](../supabase/seed.sql). Os ids são calculados a partir do slug, por isso são iguais em todos os ambientes.
- **Personalizados** (`owner_id` = utilizador): criados pelo atleta. Guardam o nome nas duas colunas de nome e não têm slug.

| Coluna | O que guarda |
| --- | --- |
| `muscle_group` | Grupo muscular principal. É só uma etiqueta, não uma forma de navegar |
| `equipment` | Barra, halteres, máquina, polia, peso corporal, etc. |
| `tracks_load` | Se regista peso. Falso na prancha, por exemplo |
| `unit` | `reps` (repetições) ou `seconds` (segundos, como a prancha) |
| `adds_bodyweight` | Se o peso corporal conta como carga (elevações, dips) |
| `archived` | Escondido das listas, mas mantido no histórico |

### `workout_templates` e `workout_template_exercises` — treinos guardados

Um treino guardado ("Push A") e a lista ordenada dos seus exercícios (`position`), com séries alvo (`target_sets`), intervalo de repetições alvo (`target_reps_min` a `target_reps_max`, ex.: 8 a 12) ou segundos alvo (`target_seconds`).

### `activities` — treinos

Uma linha por treino, de qualquer modalidade. É a base do calendário, do perfil e da partilha.

| Coluna | O que guarda |
| --- | --- |
| `type` | `gym` ou `swim` |
| `local_date` | Dia do treino no calendário do atleta |
| `timezone` | Fuso onde o treino aconteceu |
| `started_at`, `ended_at` | Início e fim (opcionais; o fim nunca é antes do início) |
| `title`, `notes` | Título e notas |
| `visibility` | `private` (por defeito), `followers` ou `public` |
| `template_id` | Treino guardado que deu origem a esta sessão (só gym) |

### `gym_sets` — séries de ginásio

| Coluna | O que guarda |
| --- | --- |
| `exercise_position` | Ordem do exercício na sessão |
| `set_number` | Número da série dentro do exercício |
| `weight_kg` | Carga em kg (3 casas decimais para que valores em lb não se percam). Nos exercícios com peso corporal é o peso **adicionado**; negativo significa assistência (máquina de elevações assistidas) |
| `reps` ou `duration_s` | Repetições **ou** segundos, conforme a unidade do exercício. Nunca os dois |
| `rpe` | Esforço percebido de 1 a 10, em passos de 0,5 (opcional) |
| `is_warmup` | Séries de aquecimento ficam fora do volume, 1RM e PRs |

### `swim_entries` — tempos de natação

| Coluna | O que guarda |
| --- | --- |
| `stroke` | `free`, `back`, `breast`, `fly` ou `im` |
| `distance` | Distância **na unidade da piscina**: metros em piscinas `25m`/`50m`, jardas em `25yd`. Tem de ser um número inteiro de piscinas |
| `pool_length` | `25m` (curta), `50m` (longa) ou `25yd`. Tempos de piscinas diferentes nunca se comparam |
| `time_cs` | Tempo em centésimos de segundo (27,61 s = `2761`) |
| `kind` | `race` (prova) ou `training` (treino) |
| `splits_cs` | Parciais em centésimos, por ordem (opcional) |
| `position` | Ordem dentro do treino |

### Colunas comuns

Todas as tabelas de dados do utilizador têm:

- `id`: UUID, que pode ser gerado no telemóvel.
- `user_id` (ou `owner_id` nos exercícios): o dono da linha.
- `created_at` e `updated_at`: **escritos pelo servidor**, nunca pela app. A sincronização usa o `updated_at` para saber o que mudou desde a última vez.
- `deleted_at`: preenchido quando a linha é apagada.

O `id` de uma linha nunca muda depois de criada.

## Regras de segurança

### Quem vê e altera o quê

| Tabela | Ler | Criar | Alterar | Apagar a sério |
| --- | --- | --- | --- | --- |
| `profiles` | Só o próprio | Ninguém (é o trigger do registo) | Só o próprio, e só as colunas editáveis | Ninguém |
| `exercises` (biblioteca) | Todos os utilizadores com sessão | Ninguém pela API | Ninguém pela API | Ninguém |
| `exercises` (personalizados) | Só o dono | Só para si próprio | Só o dono | Ninguém (usa `deleted_at`) |
| Restantes tabelas | Só o dono | Só para si próprio | Só o dono | Ninguém (usa `deleted_at`) |

- **Visitantes sem sessão (chave `anon`) não leem nem escrevem nada.**
- Todas as tabelas têm RLS (Row Level Security) ativo, com uma política explícita para cada operação. Um teste falha se alguma tabela nova ficar sem RLS.
- Ninguém consegue passar as suas linhas para outro utilizador.

### As referências também são verificadas

Não basta a linha ter o `user_id` certo; aquilo para que ela aponta também tem de ser do mesmo utilizador:

- Uma **série** só pode pertencer a uma atividade do próprio utilizador, e essa atividade tem de ser de ginásio.
- Um **tempo de natação** só pode pertencer a uma atividade de natação do próprio utilizador.
- Uma série ou um treino guardado só podem usar exercícios **da biblioteca ou do próprio utilizador**.
- Uma atividade só pode vir de um treino guardado do próprio utilizador.

A posse da atividade e do treino guardado é garantida por chaves estrangeiras compostas, `(activity_id, user_id) → activities (id, user_id)`. A posse do exercício é garantida por um trigger. Por isso estas regras também valem dentro das funções do servidor, que ignoram o RLS.

### Valores impossíveis são recusados

Exemplos: repetições a zero ou negativas, RPE fora de 1 a 10 ou fora dos passos de 0,5, tempos de natação a zero, distâncias que não são um número inteiro de piscinas, parciais a zero, um treino que acaba antes de começar, fusos horários inexistentes, peso numa prancha, repetições num exercício medido em segundos, e peso negativo num exercício que não é de peso corporal.

### Funções internas

As funções dos triggers vivem no schema `private`, que não está exposto pela API. As funções `security definer` têm sempre o `search_path` fixo e não podem ser chamadas pelos utilizadores.

## Índices

| Para quê | Índice |
| --- | --- |
| Calendário e histórico, paginados por cursor | `activities (user_id, local_date desc, id desc)` |
| Séries de uma sessão | `gym_sets (activity_id)` |
| Histórico de um exercício | `gym_sets (user_id, exercise_id)` |
| Melhores tempos por prova | `swim_entries (user_id, stroke, distance, pool_length)` |
| Sincronização ("o que mudou desde...") | `(user_id, updated_at)` em todas as tabelas de dados |

## Comandos

```bash
npm run db:start   # arranca o Supabase local (precisa do Docker Desktop)
npm run db:reset   # recria a base de dados: migrações + seed
npm run db:test    # corre os testes pgTAP em supabase/tests
npm run db:types   # gera src/lib/supabase/database.types.ts
npm run db:stop    # para o Supabase local
```

O Studio local fica em http://127.0.0.1:54323.

## Ao acrescentar uma tabela

1. Uma migração nova em `supabase/migrations/` (`npx supabase migration new <nome>`).
2. Na mesma migração: RLS ativo, `revoke all` para `anon` e `authenticated`, só os `grant` necessários, e uma política por operação.
3. `id` uuid, `user_id`, `created_at`, `updated_at`, `deleted_at` e o trigger `private.set_timestamps`.
4. Chaves estrangeiras compostas `(…, user_id)` para referências a dados do utilizador.
5. Testes em `supabase/tests/` que provem que outro utilizador não lê, não altera e não apaga.
6. `npm run db:types` para atualizar os tipos da app.
7. As migrações acrescentam primeiro e só removem quando nenhuma versão antiga da app usa a coluna (as versões antigas ficam instaladas durante meses).

## Por fazer

- A biblioteca de exercícios está no `seed.sql`, que só corre localmente. Antes de lançar, tem de passar para uma migração, ou ser carregada uma vez em produção.
- O cálculo de recordes (`personal_records`, `user_stats`) e a função `save_gym_session` chegam no passo 3b.
