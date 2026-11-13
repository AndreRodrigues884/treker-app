# Publicar a base de dados online

O Treker tem dois Supabase:

| | Para quê | Como se muda |
| --- | --- | --- |
| **Local** (Docker) | Desenvolver e testar | `supabase/migrations`, `npm run db:reset`, `npx supabase migration up` |
| **Online** (projeto na região UE) | A app a sério | Só com os scripts abaixo, a partir das mesmas migrações |

A app escolhe um ou outro ao arrancar (`npm start` ou `npm run start:prod`, ver [auth.md](auth.md#configuração)).

**A base de dados online só muda por migrações.** Nunca se cria nem se altera nada à mão no dashboard: a próxima migração ou o próximo `db:diff` deixariam de bater certo.

## Checklist, por ordem

Os passos que tu corres, do projeto vazio até à app no telemóvel. Cada um aponta para o detalhe mais abaixo.

### 1. Preparar (uma vez)

- [ ] `.env.production` preenchido com o URL `https://<ref>.supabase.co` e a chave **publishable** ([auth.md](auth.md#configuração)).
- [ ] `npx supabase login` (abre o browser).
- [ ] A password da base de dados à mão (Project Settings > Database). A CLI pede-a quando precisa.

### 2. Base de dados

```bash
npm run db:link                  # uma vez
npm run db:push -- --dry-run     # só mostra: as 24 migrações de supabase/migrations
npm run db:push                  # aplica (confirma com "y")
npm run db:diff                  # as duas colunas iguais e nenhuma diferença de schema
```

Detalhe: [Os scripts](#os-scripts) e [Primeira publicação](#primeira-publicação).

### 3. Autenticação (código de 6 dígitos)

- [ ] Em **Authentication > Emails > Templates**, vê se consegues editar o "Magic link" ([porquê](#antes-o-teu-projeto-pode-editar-os-templates)). Se estiver bloqueado, configura primeiro o SMTP ([caminho B](#caminho-b-smtp-próprio-só-se-os-templates-estiverem-bloqueados)).
- [ ] Aplica as definições do login:

  ```bash
  npm run auth:diff    # confere: otp_length 6, otp_expiry 600, max_frequency 60s, dois templates
  npm run auth:push    # aplica (confirma com "y")
  npm run auth:diff    # sem diferenças
  ```

### 4. Confirmar no painel

No painel do projeto (`https://supabase.com/dashboard/project/<ref>`). Só se olha; não se muda nada aqui.

- [ ] **Table Editor**, schema `public`: estas 9 tabelas, **nenhuma marcada como "Unrestricted"** (essa etiqueta quer dizer RLS desligado):
  - `activities`, `exercise_stats`, `exercises`, `gym_sets`, `personal_records`;
  - `profiles`, `swim_entries`, `workout_template_exercises`, `workout_templates`.

  A vista `current_records` também aparece.
- [ ] **Authentication > Policies:** todas as tabelas com "RLS enabled" e 22 políticas no total.
- [ ] **Database > Functions**, schema `public`: as 17 funções da app.
  - `current_gym_records`, `delete_activity`, `delete_custom_exercise`, `delete_my_account`;
  - `exercise_history`, `exercise_progress`, `last_performance`, `list_activity_summaries`;
  - `one_rep_max_series`, `save_gym_session`, `save_workout_template`, `session_progress`;
  - `template_progress`, `template_usage`, `update_gym_session`, `volume_by_muscle_group`, `weekly_summary`.
- [ ] **Database > Migrations:** 24 migrações, a última `20261113100000`.
- [ ] **SQL Editor:** estas consultas só leem. Corre-as e compara com o comentário:

  ```sql
  select count(*) from public.exercises where owner_id is null;                -- 68 (a biblioteca)
  select tablename from pg_tables where schemaname = 'public' and not rowsecurity;  -- nenhuma linha
  select count(*) from pg_policies where schemaname = 'public';                -- 22
  ```

### 5. Testar no telemóvel com dados móveis

Ligado ao Wi-Fi de casa, o telemóvel vai buscar a app ao PC pelo IP da rede local. Com dados móveis não chega lá, por isso o Expo precisa de um **túnel**. O Supabase online está na internet e funciona em qualquer rede.

1. No PC:

   ```bash
   npm run start:prod:tunnel
   ```

   Da primeira vez, o Expo pede para instalar o `@expo/ngrok`: aceita. O túnel é mais lento a carregar do que a rede local.
2. No telemóvel, **desliga o Wi-Fi** e liga os dados móveis.
3. Abre a app com o **Expo Go do SDK 58**, lendo o QR code.
4. Confirma:
   - [ ] **não** aparece a etiqueta "LOCAL";
   - [ ] o login com o código chega ao email e entra;
   - [ ] gravas um treino e ele aparece no painel, em **Table Editor > activities**;
   - [ ] o Perfil, os Recordes e as Estatísticas carregam;
   - [ ] fechas a app por completo, voltas a abrir e continuas com sessão iniciada.

### 6. Se o projeto for pausado por inatividade

No plano gratuito, o Supabase pode pausar o projeto se não tiver atividade suficiente durante uma semana. Contam como atividade os pedidos da app, as chamadas à API e as visitas ao painel. Avisa por email cerca de uma semana antes e outra vez quando pausa ([documentação](https://supabase.com/docs/guides/platform/project-pausing)).

- **Sinal:** a app mostra erros de ligação em todo o lado, e o painel mostra o projeto como pausado.
- **Recuperar:**
  1. No painel, abre a organização e depois o projeto pausado.
  2. Carrega em **Resume project** e confirma.
  3. Espera alguns minutos.

  Os dados e a configuração voltam como estavam. É possível até 1 ano depois da pausa.
- **Depois:** `npm run db:diff` e `npm run auth:diff`, para confirmares que está tudo igual.
- **Para evitar:** usa a app pelo menos uma vez por semana, ou passa para um plano pago, que nunca pausa ([Antes dos testers](#antes-dos-testers)).

## Antes da primeira vez

1. **Preenche o `.env.production`** (copiado de [`.env.production.example`](../.env.production.example)) com o URL do projeto, `https://<ref>.supabase.co`. Os scripts tiram daí o *project ref*, por isso não precisas de o escrever noutro sítio. Para usar outro projeto sem mudar o ficheiro: `SUPABASE_PROJECT_REF=<ref>`.
2. **Entra na CLI** com a tua conta Supabase (abre o browser):

   ```bash
   npx supabase login
   ```

3. **Tem à mão a password da base de dados** do projeto (a que escolheste ao criá-lo; em Project Settings > Database podes fazer reset). A CLI pede-a quando precisa. Os scripts nunca a leem nem a guardam. Para não a escreveres de cada vez, podes defini-la só na sessão do terminal:

   ```powershell
   $env:SUPABASE_DB_PASSWORD = '…'
   ```

## Os scripts

| Script | Faz | Muda o online? |
| --- | --- | --- |
| `npm run db:link` | Liga a CLI a este projeto (`supabase link`). Fica guardado em `supabase/.temp`, fora do git. Só é preciso uma vez | Não |
| `npm run db:diff` | Mostra que migrações estão aplicadas em cada lado (`migration list --remote`) e as diferenças de schema entre a base local e a online, em `public` e `private` (`db diff --from local --to remote`). Sem diferenças, a saída fica vazia | Não |
| `npm run db:push` | Aplica no online as migrações que lá faltam (`db push --remote`). Mostra a lista e pede confirmação antes de aplicar | **Sim** |
| `npm run db:backup` | Guarda os papéis, o schema e os dados do online em `backups/<data>/`, fora do git (ver [Cópias de segurança](#5-cópias-de-segurança)) | Não |

Notas:
- **`--remote` é obrigatório.** Na CLI v3, o `db push` e o `db diff` usam o Supabase **local** se não lhes passarmos `--remote`. Os scripts põem-no sempre. Por isso usa os scripts, e não os comandos da CLI à mão.
- **Só sobem as migrações, nunca o `seed.sql`.** Esse ficheiro tem dados de desenvolvimento. A biblioteca de exercícios (68 exercícios) está numa migração (`20261104140000_exercise_library.sql`), por isso o projeto online também a recebe.
- **Sem shell:** os scripts ([`scripts/supabase-online.js`](../scripts/supabase-online.js)) correm a CLI do Supabase instalada no projeto diretamente com o Node, sem `npx` nem shell. Cada flag passada depois de `--` chega à CLI tal como foi escrita, e o `cmd.exe` ou o `sh` nunca a interpretam. Funciona igual no Windows e no Linux.
- **Ver antes de aplicar:** `npm run db:push -- --dry-run` mostra as migrações que seriam aplicadas, sem aplicar nada. Os flags depois de `--` passam para a CLI.

## Primeira publicação

```bash
npx supabase login        # uma vez
npm run db:link           # uma vez; pede a password da base de dados
npm run db:push -- --dry-run   # confere a lista: todas as migrações de supabase/migrations
npm run db:push           # aplica (confirma com "y")
npm run db:diff           # confirma: as duas colunas iguais e nenhuma diferença de schema
```

Depois, arranca a app ligada ao online com `npm run start:prod`. Sem a etiqueta "LOCAL", está a falar com o projeto online.

## Uma migração nova

1. Cria-a e testa-a no local, como sempre: `npx supabase migration up` (ou `db:reset`, que apaga os dados locais), `npm run db:test` e `npm run db:types`.
2. `npm run db:diff`: a nova migração aparece só do lado local.
3. `npm run db:push -- --dry-run` e depois `npm run db:push`.
4. `npm run db:diff` outra vez: tudo igual.

As migrações devem funcionar com versões antigas da app instaladas (ver "Compatibilidade com versões antigas da app" no [plano-produto.md](plano-produto.md)): acrescentar primeiro, e só remover quando nenhuma versão usa.

## Confirmado: as migrações aplicam de raiz

Em 13 nov. 2026, todas as migrações foram aplicadas a uma base Supabase vazia: uma segunda instância local isolada, sem o `seed.sql`, como o projeto online.
- As 24 migrações aplicaram sem erros.
- A biblioteca tem os 68 exercícios.
- Todas as tabelas de `public` têm RLS.
- Os 390 testes pgTAP passaram.
- O schema de `public` e `private` ficou igual ao da base local de desenvolvimento.

Para repetir a verificação sem apagar os dados locais:
1. Copia a pasta `supabase/` para uma pasta temporária.
2. No `config.toml` da cópia:
   - muda o `project_id` (por exemplo, `treker-fresh`);
   - muda as portas (por exemplo, `543xx` para `553xx`);
   - desliga o `[db.seed]`.
3. Arranca a cópia: `npx supabase start --workdir <pasta>`.
4. Testa: `npx supabase test db --workdir <pasta>`.
5. Para e apaga a cópia: `npx supabase stop --workdir <pasta> --no-backup`.

## Autenticação online (login por código)

A app entra com um **código de 6 dígitos** enviado por email: `signInWithOtp` para pedir o código e `verifyOtp` (tipo `email`) para o confirmar. Não usa links. Para isto funcionar no projeto online, o email tem de trazer o código (`{{ .Token }}`), e não só o link de entrada.

| Definição | Valor |
| --- | --- |
| Tamanho do código (`otp_length`) | 6 dígitos |
| Validade (`otp_expiry`) | 600 s (10 minutos) |
| Espera entre envios para o mesmo email (`max_frequency`) | 60 s |
| Templates "Confirm signup" (contas novas) e "Magic link" (contas que já existem) | Assunto "Treker: your sign-in code / o teu código de acesso" e o corpo de [`supabase/templates/sign-in-code.html`](../supabase/templates/sign-in-code.html), com o código e sem link |

### Porque não chega o `supabase/config.toml`

O `supabase/config.toml` configura só o Supabase local. O projeto online tem a sua própria configuração, que se muda no painel ou com `supabase config push`.

O `config push` envia **todas** as propriedades que o ficheiro declara, e o nosso `config.toml` descreve o local:
- o `site_url` em `127.0.0.1`;
- as portas e o storage;
- um limite de emails que exige SMTP próprio.

Por isso há um segundo ficheiro, [`deploy/supabase/config.toml`](../deploy/supabase/config.toml), que declara **só** as definições da tabela acima. Tudo o resto no projeto online fica como está. O template é o mesmo ficheiro para o local e para o online: os scripts copiam-no para `deploy/supabase/templates/` (fora do git) antes de cada comando, porque a CLI só lê ficheiros dentro da pasta de trabalho.

| Script | Faz | Muda o online? |
| --- | --- | --- |
| `npm run auth:diff` | Mostra o que o `deploy/supabase/config.toml` mudaria no projeto online (`config diff`) | Não |
| `npm run auth:push` | Aplica essas definições (`config push`). Mostra a diferença e pede confirmação (por defeito, "não") | **Sim** |

Se mudares o tamanho, a validade ou o template, muda nos dois `config.toml` e corre outra vez o `auth:push`.

### Antes: o teu projeto pode editar os templates?

Desde **3 de junho de 2026**, os projetos **gratuitos criados a partir dessa data** que usam o email incluído no Supabase **não podem alterar os templates de autenticação** ([anúncio](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)).
- Os templates fixos desses projetos **não trazem o código**: o email chega só com um link, e a app não consegue entrar. O Supabase reconheceu o problema e não deu data para o resolver ([discussão](https://github.com/orgs/supabase/discussions/46599)).
- Não são afetados: projetos criados antes dessa data, planos pagos (Pro ou mais), e projetos gratuitos com **SMTP próprio**.

Para confirmar no teu projeto: abre **Authentication > Emails > Templates** (`https://supabase.com/dashboard/project/<ref>/auth/templates`).
- Se conseguires editar o "Magic link" → segue o **caminho A**.
- Se aparecer um aviso de que não se pode editar com o email incluído, ou o `auth:push` for recusado nos templates → precisas primeiro do **caminho B**.

### Caminho A: aplicar as definições

Com a CLI (recomendado, porque aplica exatamente o que está no repositório):

```bash
npx supabase login     # se ainda não o fizeste
npm run auth:diff      # confere: otp_length 6, otp_expiry 600, max_frequency 60s e os dois templates
npm run auth:push      # aplica (confirma com "y")
npm run auth:diff      # sem diferenças
```

Ou no painel, à mão:
1. **Authentication > Sign In / Providers > Email**:
   - "Enable Email provider" ligado;
   - **Email OTP Length** = 6;
   - **Email OTP Expiration** = 600 segundos.

   Guarda.
2. **Authentication > Emails > Templates > Magic link**:
   - **Subject:** `Treker: your sign-in code / o teu código de acesso`;
   - **Body:** cola o conteúdo de `supabase/templates/sign-in-code.html`.

   Guarda.
3. **Authentication > Emails > Templates > Confirm signup:** o mesmo assunto e o mesmo corpo. Guarda.
4. **A espera de 60 s entre envios** já é o valor por defeito do Supabase. Se não encontrares onde a confirmar no painel, o `auth:diff` mostra-a.

### Caminho B: SMTP próprio (só se os templates estiverem bloqueados)

Com SMTP próprio, o projeto gratuito volta a poder editar os templates. Depois disto, segue o caminho A. Não é preciso domínio, porque és o único utilizador:
- **Gmail:** host `smtp.gmail.com`, porta 587, utilizador = o teu Gmail, password = uma "password de app" do Google (exige a verificação em dois passos). Envia a partir do teu Gmail.
- **Resend sem domínio:** remetente `onboarding@resend.dev`, host `smtp.resend.com`, porta 465, utilizador `resend`, password = uma API key. Só entrega no email da tua conta Resend, o que chega para um único utilizador.

Onde configurar: **Authentication > Emails > SMTP Settings**:
1. Liga "Enable Custom SMTP".
2. Preenche o host, a porta, o utilizador, a password, o "Sender email" e o "Sender name" (`Treker`).
3. Guarda.

A password do SMTP fica só no painel, nunca no repositório. Com SMTP próprio, o limite passa a ser 30 emails por hora (em **Authentication > Rate Limits**).

### Confirmar que o email traz o código

1. `npm run start:prod`. A etiqueta "LOCAL" não deve aparecer.
2. **Conta nova:** entra com o email da tua conta Supabase (com o email incluído no Supabase, só os membros da organização recebem emails). O email deve trazer **6 dígitos e nenhum link**. Escreve-os na app. É o template "Confirm signup".
3. **Conta que já existe:** termina sessão e volta a entrar com o mesmo email. É o template "Magic link", e também deve trazer o código.
4. Se o email chegar com um link em vez do código, os templates não foram aplicados: volta ao "Antes".
5. Se não chegar nenhum email, abre **Authentication > Logs**. Com o email incluído no Supabase, o limite é de **2 emails por hora** e só para membros da organização; a app pede um minuto entre envios.

## Antes dos testers

Para pessoas além de ti, o email incluído no Supabase não chega (só envia para a tua conta, 2 por hora), e são precisos os requisitos legais e as cópias de segurança.

### 1. Domínio

- [ ] Compra um domínio (por exemplo `treker.app`) num registrar com DNS fácil de gerir, como o Cloudflare Registrar ou o Namecheap.
- [ ] Decide os endereços:
  - o remetente dos códigos (por exemplo `login@treker.app`);
  - a página da política de privacidade (por exemplo `https://treker.app/privacy`);
  - o email de contacto.

### 2. Resend como SMTP do Supabase

1. **Adiciona o domínio no [Resend](https://resend.com)**, em **Domains > Add domain**.
   - Escolhe a região **EU (Ireland)**, como o Supabase.
   - O Resend recomenda um subdomínio para enviar, por exemplo `send.treker.app`.
2. **Põe no DNS do domínio os registos que o Resend mostra:**
   - **DKIM:** um TXT `resend._domainkey…`;
   - **SPF:** um TXT e um MX no subdomínio de envio;
   - **DMARC:** um TXT `_dmarc`, recomendado.

   Depois carrega em **Verify** e espera até o domínio ficar **Verified**. Pode demorar de minutos a algumas horas.
3. **Cria uma API key** em **API Keys > Create API key**, com a permissão **Sending access**, limitada a esse domínio.
4. **No Supabase**, em **Authentication > Emails > SMTP Settings**, liga **Enable Custom SMTP** e preenche:

   | Campo | Valor |
   | --- | --- |
   | Sender email | um endereço do domínio verificado, por exemplo `login@treker.app` |
   | Sender name | `Treker` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | a API key do Resend |

   Guarda. A chave fica só no painel (e no teu gestor de passwords). Nunca vai para o repositório nem para variáveis `EXPO_PUBLIC_`.
5. **Em Authentication > Rate Limits**, o limite de emails passa a 30 por hora; ajusta-o ao número de testers.
6. **Confirma:**
   - `npm run auth:diff` não mostra diferenças (os templates continuam com o código);
   - entra na app com um email que **não** é da tua conta Supabase, e o código tem de chegar.

### 3. Política de privacidade

- [ ] **Escreve a política.** É exigida pelas lojas e pelo RGPD. Diz:
  - quem é o responsável e o contacto;
  - que dados guardas: email, treinos, peso corporal (que pode ser considerado um dado de saúde) e as definições;
  - para quê, e com que base legal;
  - quem os trata: o Supabase (região UE) e o Resend;
  - quanto tempo ficam guardados;
  - os direitos do atleta: acesso, exportação e apagar a conta, que a app já faz.
- [ ] **Publica-a no domínio** e atualiza `privacyPolicy` e o contacto em [`src/lib/links.ts`](../src/lib/links.ts), que ainda têm endereços provisórios.
- [ ] **Aceita os acordos de tratamento de dados (DPA)** do Supabase e do Resend.

### 4. Plano pago, se for preciso

O plano gratuito:
- pausa o projeto após uma semana sem atividade;
- não tem cópias de segurança automáticas;
- tem limites de tamanho (base de dados de 500 MB).

O **Pro** (cerca de 25 dólares por mês):
- nunca pausa;
- guarda cópias diárias dos últimos 7 dias.

- [ ] Decide antes dos testers. A recomendação é passar a Pro quando houver dados de outras pessoas, sobretudo pelas cópias de segurança. Se ficares no gratuito, faz as cópias à mão (secção seguinte), pelo menos uma vez por semana.

### 5. Cópias de segurança

- **Gratuito: não há cópias automáticas**, por isso fazes tu, com:

  ```bash
  npm run db:backup
  ```

  - Só lê o projeto: guarda os papéis, o schema e os dados (`roles.sql`, `schema.sql`, `data.sql`) em `backups/<data>/`.
  - Essa pasta não vai para o git, porque tem dados pessoais. Guarda uma cópia fora do PC, cifrada.
  - Faz uma cópia antes de cada `db:push` e uma vez por semana.
- **Pro:** em **Database > Backups**, as cópias diárias dos últimos 7 dias, que se restauram no painel. O PITR (recuperar até a um minuto exato) é um extra pago, e não é preciso no início.
- **Testa uma vez a recuperação**, numa cópia local isolada, como em [Confirmado: as migrações aplicam de raiz](#confirmado-as-migrações-aplicam-de-raiz), mas sem as migrações:
  1. carrega o `roles.sql`, depois o `schema.sql`, e por fim o `data.sql`, com `psql`;
  2. abre a app contra essa cópia.

## A app no telemóvel (APK, sem o Expo Go)

Uma build nativa do Treker para Android, instalada como uma app normal: não precisa do Expo Go nem do PC, e fala com o Supabase online. É feita na cloud pelo **EAS Build**.

| Ficheiro | O que tem |
| --- | --- |
| [`eas.json`](../eas.json) | O perfil `preview`: um APK para instalação direta (`distribution: internal`, `android.buildType: apk`), com as variáveis do ambiente **preview** do EAS. O perfil `production` fica pronto para a Play Store (AAB, número de versão aumentado sozinho) |
| [`app.json`](../app.json) | O nome `Treker`, o ícone e o splash com o logótipo e as cores atuais, e o identificador Android `app.treker` |

- **O identificador `app.treker` não se muda depois de publicar na Play Store.** Uma app com outro identificador é outra app. Foi escolhido a contar com o domínio `treker.app` ([Antes dos testers](#1-domínio)).
- **O ícone e o splash** vêm de [`assets/brand/treker-logo.svg`](../assets/brand/treker-logo.svg) (`npm run brand:icons`): fundo `#070D1C`, e o ícone adaptativo do Android com versão monocromática.
- **Permissões:** a app declara só a internet. Não tem notificações na v1: a dependência `expo-notifications` foi removida, e nenhuma biblioteca da build declara `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` ou alarmes exatos. As permissões antigas de armazenamento, que o Expo junta por defeito, estão bloqueadas em `android.blockedPermissions`, porque a app não as usa.

### As variáveis do Supabase, sem as pôr no git

O EAS Build envia para a cloud só os ficheiros que o git conhece: os `.env*` (que estão no `.gitignore`) não vão. As variáveis `EXPO_PUBLIC_` vêm das **variáveis de ambiente do EAS**, guardadas no projeto da Expo. O perfil `preview` usa o ambiente `preview` (`"environment": "preview"` no `eas.json`).

Para as copiar do teu `.env.production` (o URL do projeto e a chave publishable, que são públicos):

```bash
npx eas-cli@latest env:push preview --path .env.production
npx eas-cli@latest env:list --environment preview    # confere: as duas EXPO_PUBLIC_
```

Ou uma a uma:

```bash
npx eas-cli@latest env:set --environment preview --visibility plaintext \
  --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
npx eas-cli@latest env:set --environment preview --visibility plaintext \
  --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_...
```

- Usa `plaintext`, e não `secret`: as variáveis `EXPO_PUBLIC_` vão dentro da app, e os valores secretos nunca saem dos servidores da Expo. Nunca se põe aqui a chave secreta nem a `service_role`.
- Se mudares o URL ou a chave, corre outra vez o `env:push` (com `--force` para substituir) e faz uma build nova. As variáveis ficam dentro do APK quando ele é feito.

### Fazer a build (os comandos que corres)

```bash
npx eas-cli@latest login                                   # a tua conta Expo (cria uma em expo.dev)
npx eas-cli@latest init                                    # uma vez: cria o projeto na Expo e junta o projectId ao app.json
npx eas-cli@latest env:push preview --path .env.production # uma vez, e sempre que o URL ou a chave mudarem
npx eas-cli@latest build --profile preview --platform android
```

- **Na primeira build**, o EAS pergunta se gera uma *keystore* (a chave que assina a app Android): responde **sim**. Fica guardada na tua conta Expo. Não a percas: a mesma chave assina as versões seguintes.
- **Quanto demora:** no plano gratuito a build vai para uma fila de baixa prioridade. Normalmente demora 10 a 20 minutos, mas pode esperar mais de 90 minutos nas horas de maior uso. No fim, o comando mostra um link e um QR code. A build também aparece em [expo.dev](https://expo.dev), em **Projects > treker > Builds**.
- **O `init`** acrescenta ao `app.json` o `extra.eas.projectId` (e o `owner`). Essa alteração vai para o git: é um identificador, não um segredo.

### Instalar o APK no telemóvel

1. No telemóvel Android, abre o link da build (ou lê o QR code do terminal). Também o encontras na página da build em expo.dev, com o botão **Install**.
2. Descarrega o APK.
3. Abre o ficheiro. O Android pede para **permitir instalar apps desta origem** (o browser ou o gestor de ficheiros), porque a app não vem da Play Store: permite-o só para essa app.
4. Confirma o aviso de segurança ("app não verificada pela Play Store") e instala.
5. Abre o **Treker** a partir do ecrã principal. Funciona com o PC desligado e com dados móveis.

Para uma versão nova: faz outra build com o mesmo comando e instala o APK por cima. Os dados ficam, porque o identificador e a chave de assinatura são os mesmos.

Alternativa com cabo: ativa a depuração USB no telemóvel, descarrega o APK no PC e corre `adb install treker.apk`.

### O que funciona fora do Expo Go

Confirmado nas dependências e na configuração nativa (`npx expo-doctor`: 20 de 20 verificações, e `npx expo config --type prebuild` sem erros):

| Funcionalidade | Na build |
| --- | --- |
| **Notificações** | Não existem na v1 (o temporizador de descanso saiu). A app não as pede, e o APK não declara as permissões |
| **Ecrã aceso durante a sessão** | `expo-keep-awake`, um módulo nativo incluído na build |
| **Data e hora** (editar um treino) | Campos de texto, sem seletor nativo. Não dependem de nenhum módulo |
| **Gráficos** | `react-native-gifted-charts`, que desenha com `react-native-svg` e `expo-linear-gradient`, ambos incluídos na build |
| **Login, sessão e dados** | `expo-secure-store` (a sessão), AsyncStorage, NetInfo, gestos e animações (`react-native-gesture-handler`, `react-native-reanimated`): todos com código nativo incluído na build |

- **Na build não há modo de desenvolvimento.** O catálogo de componentes (`/dev`) fica fechado e a etiqueta "LOCAL" nunca aparece.
- **A app fala sempre com o Supabase online.** É o que está nas variáveis do ambiente `preview`.

### Limites do plano gratuito da Expo

- **15 builds Android e 15 iOS por mês**, que se renovam todos os meses ([preços](https://expo.dev/pricing)).
- Fila de baixa prioridade, e cada build pode durar até 45 minutos.

Para não gastar builds sem necessidade:
- testa as mudanças primeiro com o Expo Go (`npm run start:prod`);
- faz uma build só quando quiseres a versão instalada atualizada.

## CI (GitHub Actions)

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) corre em cada push e pull request, com dois jobs em paralelo:

| Job | Faz |
| --- | --- |
| **Lint, typecheck and Jest** | `npm ci`; gera os tipos do Expo (`npx expo customize tsconfig.json`, porque o `expo-env.d.ts` e `.expo/types` não estão no git); `npm run lint`, `npm run typecheck` e `npm test` |
| **pgTAP (local Supabase)** | `npm ci`; `supabase start`, que aplica todas as migrações a uma base vazia e depois o `seed.sql`, só com os serviços de que os testes precisam; `supabase test db`; `supabase stop` |

**Nunca usa o projeto online:**
- não tem segredos;
- não corre `link`, `db push` nem `config push`;
- só tem permissão para ler o código.

O Supabase do CI é local ao job e usa as chaves de desenvolvimento da CLI. Os testes Jest não precisam de `.env`, porque simulam o cliente Supabase.

A CLI do Supabase é uma dependência npm (`supabase` no `package.json`), por isso o CI usa a mesma versão que o desenvolvimento. Um push novo no mesmo ramo cancela a execução anterior.

## Tipos da app

O `npm run db:types` gera os tipos a partir do local. Como o online é igual (confirma com `db:diff`), não é preciso gerá-los a partir do online.
