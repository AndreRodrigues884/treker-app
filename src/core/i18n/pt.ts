import type { Messages } from './en';

export const pt: Messages = {
  common: {
    loading: 'A carregar',
  },
  home: {
    tagline: 'Registo de ginásio e natação para atletas que treinam por conta própria.',
    greeting: 'Olá, {name}',
    signOut: 'Terminar sessão',
  },
  records: {
    prShort: 'PR',
    prLabel: 'Recorde pessoal',
  },
  auth: {
    emailTitle: 'Entrar',
    emailSubtitle: 'Enviamos-te um código de 6 dígitos por email. Sem password.',
    emailLabel: 'Email',
    emailPlaceholder: 'tu@exemplo.com',
    sendCode: 'Enviar código',
    codeTitle: 'Introduz o código',
    codeSubtitle: 'Enviámos um código de 6 dígitos para {email}.',
    codeLabel: 'Código de 6 dígitos',
    verify: 'Continuar',
    resend: 'Enviar novo código',
    resendIn: 'Enviar novo código dentro de {seconds} s',
    codeResent: 'Enviámos-te um novo código.',
    changeEmail: 'Usar outro email',
    errors: {
      invalidEmail: 'Introduz um email válido.',
      invalidCodeFormat: 'O código tem 6 dígitos.',
      wrongCode: 'Código incorreto. Confirma o email mais recente e tenta outra vez.',
      expiredCode: 'Este código expirou. Pede um novo.',
      tooManyAttempts: 'Demasiadas tentativas. Espera alguns minutos e tenta outra vez.',
      network: 'Sem ligação. Verifica a internet e tenta outra vez.',
      generic: 'Algo correu mal. Tenta outra vez.',
    },
  },
  onboarding: {
    title: 'Boas-vindas ao Treker',
    subtitle: 'Alguns dados para preparar o teu registo de treinos.',
    nameLabel: 'Nome',
    weightUnitLabel: 'Unidade de peso',
    poolUnitLabel: 'Unidade da piscina',
    metres: 'Metros',
    yards: 'Jardas',
    bodyweightLabel: 'Peso corporal em {unit} (opcional)',
    bodyweightHint:
      'Serve para o 1RM das elevações e dos dips, em que o teu peso faz parte da carga.',
    continue: 'Continuar',
    errors: {
      nameRequired: 'Introduz o teu nome.',
      bodyweightInvalid: 'Introduz um peso corporal realista, ou deixa em branco.',
    },
  },
};
