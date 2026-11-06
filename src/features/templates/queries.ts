import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TemplateDraft } from '@/core/templates';
import { useDataContext } from '@/features/auth/auth-provider';
import { queryKeys } from '@/lib/data/query-keys';

import { deleteTemplate, getTemplate, listTemplates, saveTemplate } from './repository';

export function useTemplates() {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.templateList(ctx.userId),
    queryFn: () => listTemplates(ctx),
  });
}

export function useTemplate(templateId: string, options: { enabled?: boolean } = {}) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.template(ctx.userId, templateId),
    queryFn: () => getTemplate(ctx, templateId),
    enabled: options.enabled ?? true,
  });
}

function useTemplateWrite<Input>(write: (input: Input) => Promise<void>) {
  const ctx = useDataContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.templates(ctx.userId) }),
  });
}

/**
 * Saves a template and its list in one request. "Try again" calls `mutate` with the same draft:
 * the ids in it are the same, so nothing is duplicated.
 */
export function useSaveTemplate() {
  const ctx = useDataContext();
  return useTemplateWrite((draft: TemplateDraft) => saveTemplate(ctx, draft));
}

export function useDeleteTemplate() {
  const ctx = useDataContext();
  return useTemplateWrite((id: string) => deleteTemplate(ctx, id));
}
