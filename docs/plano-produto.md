# Treker — Plano de Produto (React Native)

Nov 4, 2026 · @André

## Visão e âmbito

O Treker recomeça em React Native (Expo) com **Gym e Natação** na v1; a Corrida entra depois de validar com utilizadores reais.

- **O que é:** uma app de tracking para atletas autónomos que se treinam a si próprios. Regista, mede e mostra evolução. Não prescreve treinos nem faz coaching.
- **Diferencial frente ao Hevy e ao Strong:** design e estética cuidados, e o ginásio e a natação na mesma app, com um histórico único.
- **Público inicial:** nadadores e atletas de outras modalidades que também fazem ginásio. Os primeiros testers vêm do clube de natação.
- **Princípios:** registar em segundos, a meio do treino (sem rede só depois da v1: o offline foi adiado); dados em que o atleta pode confiar; ver a evolução das modalidades juntas.
- **A base de dados é desenhada para várias modalidades desde o início**, para que a Corrida entre sem reescrever o perfil, o histórico ou a partilha.

**Critério para avançar para a Corrida:** pelo menos 12 testers durante 14 dias (obrigatório na Play Store para contas novas) e, ao fim de 4 semanas, a maioria ainda regista treinos todas as semanas.

## Manter

Prioridades usadas em todo o documento: **P0** = obrigatório na v1, **P1** = logo a seguir (v1.1), **P2** = depois de validar.

| Funcionalidade | Área | Prioridade | Porquê |
| --- | --- | --- | --- |
| Registo de séries com "a última vez" visível | Gym | P0 | É o que um atleta autónomo mais usa: comparar com a sessão anterior enquanto treina |
| Deteção automática de PRs (regra do `save_gym_session`) | Gym | P0 | Transação única, sem PRs duplicados nem volume contado a dobrar |
| 1RM estimado com peso corporal (`adds_bodyweight`) | Gym | P0 | Poucas apps tratam bem elevações e dips com peso |
| Séries pendentes guardadas no telemóvel + aviso ao sair | Gym | P0 | No móvel a app é fechada a meio do treino com frequência |
| Gráficos de progresso por exercício | Gym | P0 | A razão para registar é ver a evolução |
| Tempos por estilo e distância | Natação | P0 | Base do tracking de natação |
| Objetivos de tempo com projeção | Natação | P1 | Motivação concreta para nadadores de competição |
| Supabase com RLS em todas as tabelas | Base | P0 | Isolamento de dados por utilizador |
| Regras de negócio em funções Postgres | Base | P0 | A mesma lógica serve a app móvel e a web |
| Funções puras `derive` com testes | Base | P0 | Cálculos (1RM, projeções) partilhados e testados |
| Login com email e Google, rate limiting, apagar conta | Base | P0 | Requisitos mínimos de um produto real |

## Atualizar

A mudança mais importante é passar de páginas por grupo muscular para **sessões de treino como entidade principal**.

| Hoje | Passa a ser | Área | Prioridade | Porquê |
| --- | --- | --- | --- | --- |
| Exercícios organizados por página de grupo muscular; "Save session" grava um grupo de cada vez | Sessão de treino ("Treino A", "Push day") com hora de início; a duração não é registada, e as notas foram adiadas (fora da v1); grupo muscular só como etiqueta | Gym | P0 | Os atletas pensam em treinos, não em grupos; um treino de corpo inteiro hoje obriga a várias gravações |
| Exercícios só personalizados | Biblioteca partilhada + exercícios personalizados | Gym | P0 | Facilita registo, ícones, grupos musculares, importações e comparações |
| Dificuldade fácil/médio/difícil | **Decisão de nov. 2026: fica Fácil / Médio / Difícil por série** (coluna `gym_sets.difficulty`), com cor (verde, amarelo, vermelho) nos quadrados das séries. O RPE deixa de ser usado pela app; a coluna `rpe` fica na base de dados | Gym | P0 | Mais rápido de registar a meio do treino e fácil de ler de relance. Antes: "RPE ou RIR", que exige conhecer a escala |
| Apagar só o último registo | Editar e apagar qualquer registo, com reconstrução dos PRs | Gym, Natação | P0 | Um erro antigo não pode ficar para sempre nos gráficos e recordes |
| Datas gravadas em UTC | Data local do atleta | Base | P0 | Treinos depois da meia-noite ou noutros fusos ficam no dia errado |
| Tempos de natação sem tipo de piscina | Piscina curta (25 m) ou longa (50 m) em cada tempo | Natação | P0 | Os tempos não são comparáveis; recordes e mínimos são sempre separados |
| Só tempos isolados | Prova ou treino, e sessões de treino com séries e volume em metros | Natação | P1 | Mostra o volume de treino, não só as provas |
| "Deload" como recomendação | Deteção de estagnação ("o supino não sobe há 4 semanas") | Gym | P1 | Informar sim, prescrever não: mantém o posicionamento sem coaching |
| Projeção linear de objetivos | Projeção em intervalo ("entre março e maio") | Natação | P2 | O progresso abranda; uma reta promete datas otimistas |

## Eliminar

Sai tudo o que não muda nada na app ou que mostra números enganadores.

| Funcionalidade | Porquê sai |
| --- | --- |
| Objetivos de treino no onboarding | São guardados e editáveis, mas não alteram nada no resto da app; só atrasam a entrada |
| "Força Total" | Soma o 1RM de todos os exercícios: sobe sempre que se acrescenta um exercício, mesmo sem ficar mais forte. Substituída pela evolução de 3 a 5 exercícios escolhidos pelo atleta |
| Toggle de notificações sem notificações | Um botão que não faz nada tira confiança; volta com o temporizador de descanso |
| Altura no perfil | Não entra em nenhum cálculo |
| Corrida na v1 | Entra depois de validar Gym e Natação (ver critério acima) |
| Marcos de volume em destaque | Ficam discretos nas conquistas; os atletas valorizam PRs, não totais acumulados |
| Navegação por páginas de grupo muscular | Substituída por sessões de treino |

## Adicionar

Na v1 entra o que um atleta usa em todos os treinos; o social e os pagamentos esperam pela validação.

| Funcionalidade | Área | Prioridade | Porquê |
| --- | --- | --- | --- |
| ~~Offline-first: base local (SQLite) com sincronização e sem duplicados~~ **Adiado (fora da v1)**: a v1 funciona só com rede | Base | — | Ginásios em caves e piscinas têm rede fraca; volta depois de validar a v1 (ver docs/data-access.md, "Voltar ao offline") |
| Temporizador de descanso com notificação no ecrã bloqueado | Gym | P0 | Das funções mais usadas; mantém a app aberta durante o treino |
| ~~Séries de aquecimento fora das estatísticas~~ **Adiado na sessão (fora da v1)** | Gym | — | A sessão não tem aquecimentos: o atleta regista só as séries de trabalho. A base de dados continua a suportar `is_warmup` (fora do volume, 1RM e PRs), para voltar mais tarde |
| Histórico em calendário com Gym e Natação juntos | Base | P0 | É a vista que mostra o diferencial multi-modalidade |
| ~~Notas por sessão~~ **Adiado (fora da v1)** | Gym, Natação | — | Explicaria um dia mau nos gráficos meses depois, mas não é necessário por agora. A coluna `activities.notes` fica na base de dados, vazia, para ser fácil voltar a ter notas |
| Perfil privado com lista de atividades recentes | Base | P0 | Página "Eu"; preparada para ser pública no futuro |
| Cartão de partilha para Instagram/WhatsApp no fim da atividade | Gym, Natação | P0 | Publicidade grátis junto de pessoas que treinam |
| Exportar dados em CSV | Base | P0 | Confiança e direito de portabilidade (RGPD) |
| Unidades: kg/lb, piscina em metros ou jardas | Base | P0 | Atletas fora de Portugal |
| Sign in with Apple | Base | P0 | Exigido pela Apple na maioria das apps com login social (ver plataformas) |
| Superséries | Gym | P1 | Comum, mas só se os testers pedirem |
| Parciais nas provas de 100 m ou mais | Natação | P1 | Mostra onde se perde tempo |
| Importação do Health Connect e do HealthKit | Natação | P1 | Treinos dos relógios sem registo manual |
| Resumo semanal das modalidades (tempo, sessões, volume, metros) | Base | P1 | Visão de conjunto da semana |
| Subscrição Pro | Base | P2 | Só depois de haver utilizadores que voltam |
| Link público do perfil (só leitura) | Social | P2 | Testa o interesse social sem moderação |
| Seguir pessoas e feed | Social | P2 | Exige reescrever o RLS, feed, bloquear e denunciar |
| Integração com Strava e Garmin | Natação, Corrida | P2 | Maior trabalho; depende da Corrida e de aprovações externas |
| Corrida (registo, ritmo por distância, quilómetros por sapatilha) | Corrida | P2 | Depois do critério de avanço |

**Nota:** As respostas do onboarding decidem o ecrã inicial (modalidades, foco do ginásio, estilo de natação, objetivo semanal) — aplicar quando o ecrã inicial for construído.

## Estatísticas do ginásio (v1)

Mostram a evolução sem prescrever nada. As contas são feitas no Postgres (ver [database.md](database.md#progresso-e-estatísticas-do-ginásio)).

- **Progresso em cada treino:** cada exercício é comparado com a última vez que o atleta o fez. Sobe ou desce com uma mudança de 0,5% ou mais no 1RM estimado da melhor série; sem 1RM, conta o tempo (prancha) ou o volume. O treino mostra "4 de 6 exercícios progrediram" e uma seta ao lado de cada exercício.
- **Ecrã de um treino guardado:** quantas vezes foi feito, a última data, e a evolução de cada exercício nos últimos treinos.
- **Ecrã Estatísticas:** treinos por semana contra o objetivo semanal, a força dos exercícios escolhidos (até 5, em vez da "Força Total"), o volume por semana e por grupo muscular, e os treinos guardados mais feitos. Tem 4 semanas, 3 meses, 1 ano ou tudo.

**Ideias para mais tarde** (fora da v1):

| Ideia | Porquê |
| --- | --- |
| Sequência de semanas a cumprir o objetivo | Motivação simples e visível, sem prescrever treinos |
| Recordes por mês | Mostra que o atleta continua a evoluir mesmo quando o 1RM abranda |
| Percentagem de séries difíceis por semana | Usa a dificuldade que o atleta já regista para mostrar a carga da semana |
| Aviso de estagnação ("o supino não sobe há 4 semanas") | É a "Deteção de estagnação" (P1) da tabela [Atualizar](#atualizar): informa, não prescreve. Pode usar a mesma regra de progresso |

## Roadmap por prioridade

**Nota para a Fase 1:** O treino em curso fica guardado num rascunho no telemóvel até ser gravado no servidor, para uma falha de rede no fim não perder as séries.

As fases 0 a 3 são a v1 (todas as P0); a v1.1 e a fase 5 só arrancam depois de passarem os testes com utilizadores.

&#91;embedded content: roadmap · 6 fases, 2 testes com utilizadores\]

Cada fase só começa quando a anterior está usável de ponta a ponta; a Fase 0 é a mais cara de mudar depois, por isso vem primeiro.

## Regras de segurança

A app móvel fala diretamente com o Supabase, por isso **a base de dados é a última linha de defesa**: tudo o que a app verifica tem de ser verificado também no Postgres.

1. **RLS em todas as tabelas, sem exceção.** Sem política, nada é acessível. Cada tabela nova leva as suas políticas na mesma migração.
2. **Verificar a posse das referências, não só do `user_id`.** Uma série só pode apontar para uma sessão e um exercício do mesmo utilizador (`with check` com `exists`, ou chave estrangeira composta `(user_id, id)`). Hoje as políticas só verificam o `user_id` da própria linha.
3. **Dados calculados só escritos por funções do servidor.** PRs, marcos e totais são escritos por funções Postgres; os utilizadores não têm política de `insert` nessas tabelas, por isso não os podem forjar.
4. **Funções `security definer` com regras fixas:** `set search_path`, identidade sempre de `auth.uid()`, nunca um `user_id` como parâmetro, e `execute` só para `authenticated`.
5. **Nenhum segredo na app móvel.** Só a chave pública (anon) vai no código. A `service_role`, as chaves do Strava, do RevenueCat e outras ficam em Edge Functions.
6. **Sessão guardada em armazenamento seguro** (`expo-secure-store`, que usa o Keychain e o Keystore), nunca em `AsyncStorage`.
7. **Login social com o fluxo PKCE** e login nativo da Apple e da Google; email verificado no registo; limites de tentativas no login e no registo.
8. **Validação nos dois lados.** Zod na app para dar feedback rápido; `check constraints` e funções no Postgres para garantir.
9. **Privado por defeito.** Cada atividade e o perfil têm `visibility` (`private`, `followers`, `public`), começando em `private`. Peso corporal, notas e percursos nunca aparecem em vistas públicas; os dados públicos saem só de uma *view* com campos seguros.
10. **Mapas de percursos sem o início e o fim** (cerca de 200 m escondidos) quando forem partilhados.
11. **Tokens de serviços externos cifrados** (Supabase Vault) e só usados no servidor.
12. **Webhooks verificados por assinatura** (RevenueCat, Strava) e processados de forma idempotente.
13. **Storage com políticas**: avatares e imagens com limite de tamanho e tipo, cada utilizador só escreve na sua pasta.
14. **RGPD:** apagar a conta remove todos os dados e ficheiros; exportação disponível; política de privacidade; dados alojados na UE.
15. **Testes de segurança no CI:** testes SQL que confirmam que um utilizador não lê nem escreve dados de outro, como o `save_gym_session.sql`.

## Escalabilidade e modelo de dados

A regra de fundo: **o trabalho pesado acontece no Postgres, perto dos dados, e a app recebe só o que vai mostrar.**

### Regras

1. **Nunca carregar o histórico inteiro.** Totais, máximos e PRs calculam-se em SQL. Os valores mais usados (melhor 1RM por exercício, volume total, totais semanais) ficam em tabelas de agregados atualizadas na mesma transação que grava os dados.
2. **Uma gravação = uma função (RPC) = uma transação.** Menos pedidos pela rede móvel e nunca dados a meio.
3. **Listas com paginação por cursor** (`local_date`, `id`), nunca por `offset`, e sempre abaixo do limite `max_rows`.
4. **Um índice por padrão de acesso**, por exemplo `(user_id, local_date desc)` nas atividades e `(user_id, stroke, distance_m, course)` nos tempos de natação. Confirmar com `explain` as queries mais usadas.
5. **Sincronização offline idempotente.** Os ids (UUID) são gerados no telemóvel, por isso reenviar a mesma sessão não a duplica. Conflitos resolvidos com `updated_at`, e o envio é feito em lotes.
6. **Trabalho lento fora do pedido.** Importações de relógios, webhooks e reconstrução de estatísticas vão para uma fila (por exemplo `pgmq` ou `pg_cron` no Supabase), com tentativas repetidas e respeitando os limites das APIs externas.
7. **Compatibilidade com versões antigas da app.** No telemóvel, versões antigas ficam instaladas durante meses. As migrações fazem-se em duas fases (acrescentar primeiro, remover só quando nenhuma versão antiga usa) e as funções mantêm a assinatura ou ganham uma versão nova.
8. **Imagens geradas no telemóvel.** Os cartões de partilha são desenhados no dispositivo, não no servidor; avatares servidos pelo CDN do Storage.
9. **Feed calculado ao ler** quando o social chegar; guardar cópias por seguidor só se as medições o justificarem.
10. **Medir antes de otimizar:** erros e crashes no Sentry, queries lentas com `pg_stat_statements`, e uso da app com analytics.

### Tabelas principais

| Tabela | Guarda | Notas |
| --- | --- | --- |
| `profiles` | Nome, foto, unidades, fuso horário, `visibility` | Peso corporal numa coluna privada |
| `activities` | Uma linha por treino: tipo (`gym`, `swim`, `run`), `local_date`, início (ordena os treinos do mesmo dia), fim (a sessão de ginásio não regista o fim nem a duração na v1), título, notas (vazias na v1), `visibility` | Base do perfil, calendário, partilha e feed |
| `exercises` | Biblioteca partilhada (`user_id` nulo) e exercícios personalizados | Grupo muscular como etiqueta |
| `workout_templates` | Treinos guardados ("Treino A") e a ordem dos exercícios | Substitui as rotinas por grupo muscular |
| `gym_sets` | Séries de uma atividade: exercício, peso, reps, dificuldade (fácil/médio/difícil), aquecimento (não usado na v1) | Chave estrangeira para a atividade do mesmo utilizador |
| `swim_entries` | Estilo, distância, tipo de piscina, tempo, prova ou treino, parciais | Um treino de natação tem várias entradas |
| `personal_records` | PRs de todas as modalidades, com a origem | Escrita só por funções do servidor |
| `user_stats` | Agregados: melhor 1RM por exercício, volume total, totais semanais | Atualizada na mesma transação |

## Plataformas externas

Para lançar a v1 nas duas lojas, o custo fixo é **25 dólares uma vez (Google) + 99 dólares por ano (Apple)**; o resto começa em planos gratuitos.

### Infraestrutura e lojas

| Plataforma | Para quê | Quando | Custo e requisitos |
| --- | --- | --- | --- |
| [Supabase](https://supabase.com/pricing) | Base de dados, autenticação, storage, Edge Functions | v1 | Grátis: 2 projetos, 50 000 utilizadores ativos/mês, 500 MB; o projeto pausa após 1 semana sem atividade ([docs](https://supabase.com/docs/guides/platform/project-pausing)). Pro: desde 25 dólares/mês, sem pausas — necessário em produção |
| Expo + EAS | Build Android e iOS na cloud (sem Mac), atualizações OTA | v1 | Plano gratuito com builds limitados (valor aproximado, confirmar no site) |
| [Google Play](https://support.google.com/googleplay/android-developer/answer/6112435) | Publicar no Android | v1 | 25 dólares uma vez; identificação com documento; contas pessoais novas precisam de 12 testers durante 14 dias ([regra](https://support.google.com/googleplay/android-developer/answer/14151465)) |
| [Apple Developer Program](https://developer.apple.com/programs/) | Publicar no iOS | v1 | 99 dólares por ano |
| Upstash Redis | Rate limiting | v1 | Já usado; plano gratuito |
| Sentry | Erros e crashes da app | v1 | Plano gratuito (aproximado) |
| PostHog | Analytics de uso e retenção | v1 | Plano gratuito (aproximado) |
| Serviço de email (ex.: Resend) | Emails de autenticação em produção | v1 | O envio de email incluído no Supabase é limitado; em produção usa-se SMTP próprio (aproximado) |

### Login

| Plataforma | Para quê | Quando | Custo e requisitos |
| --- | --- | --- | --- |
| Google Sign-In | Login com Google (Android e iOS) | v1 | Grátis; cliente OAuth na Google Cloud Console |
| [Sign in with Apple](https://developer.apple.com/forums/thread/765145) | Login com Apple | v1 | Incluído na conta Apple. Com login Google numa app iOS, a regra 4.8 exige uma opção equivalente que proteja a privacidade, e a Apple aponta esta como a que cumpre |

### Relógios e dados de treino

| Plataforma | Para quê | Quando | Custo e requisitos |
| --- | --- | --- | --- |
| [Health Connect](https://developer.android.com/health-and-fitness/health-connect/publish) (Android) | Importar treinos de natação e corrida dos relógios | v1.1 | Grátis; formulário de declaração na Play Console, a justificar cada tipo de dado, e política de privacidade |
| HealthKit (iOS) | O mesmo no iPhone e no Apple Watch | v1.1 | Grátis com a conta Apple; permissão própria e explicação do uso |
| [Strava API](https://dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html) | Importar atividades | P2 | Desde nov. 2024, os termos proíbem mostrar os dados de um utilizador a outros e usá-los para treinar IA. Atividades vindas do Strava não podem ir para o perfil público nem para o feed |
| [Garmin Connect](https://the5krunner.com/2026/09/14/garmin-developer-api-access-paused/) | Importar diretamente da Garmin | Em espera | A Garmin deixou de aceitar novas aplicações à API desde a primavera de 2026, sem data de retoma. Os dados Garmin chegam via Health Connect ou HealthKit |

### Partilha e pagamentos

| Plataforma | Para quê | Quando | Custo e requisitos |
| --- | --- | --- | --- |
| [Instagram Stories](https://developers.facebook.com/docs/instagram-platform/sharing-to-stories) | Partilhar o cartão diretamente nas Stories | v1 | Grátis; exige uma Facebook App ID (Meta for Developers); imagem de pelo menos 720 × 1280 |
| Menu de partilha nativo | WhatsApp, mensagens e outras apps | v1 | Grátis, sem conta (`expo-sharing`) |
| [RevenueCat](https://www.revenuecat.com/plans/) | Subscrições nas duas lojas | P2 | Grátis até 2500 dólares de receita mensal, depois 1% |
| Paddle ou Lemon Squeezy | Pagamentos pela web, com o IVA europeu tratado | P2 | Comissão por venda (confirmar) |

**Implicação importante:** como o Strava não permite mostrar dados importados a outros utilizadores e a Garmin está fechada, a importação deve ser feita pelo **Health Connect e pelo HealthKit**, que recebem os dados da maioria dos relógios.
