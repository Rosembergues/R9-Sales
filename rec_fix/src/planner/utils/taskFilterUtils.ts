import { Task, TeamMember } from '../types.ts';

/**
 * Verifica com precisão estrita se um determinado usuário (autenticado/membro) está explicitamente
 * atribuído como responsável por uma tarefa.
 * 
 * Verifica:
 * - array de múltiplos responsáveis (assignedToIds)
 * - campo de responsável principal (assignedTo)
 * - chaves de submissão individual (userSubmissions)
 * - mapeamento cruzado por ID do Supabase Auth, ID de membro da equipe, e-mail e nome.
 */
export function isUserAssignedToTask(
  task: Task | null | undefined,
  currentUser: TeamMember | null | undefined,
  authUser?: any,
  teamMembers: TeamMember[] = []
): boolean {
  if (!task) return false;

  const candidateIds = new Set<string>();
  const candidateEmails = new Set<string>();
  const candidateNames = new Set<string>();

  // 1. Identificadores diretos do currentUser
  if (currentUser?.id) candidateIds.add(String(currentUser.id).trim());
  if (currentUser?.email) candidateEmails.add(currentUser.email.trim().toLowerCase());
  if (currentUser?.name) candidateNames.add(currentUser.name.trim().toLowerCase());

  // 2. Identificadores diretos do authUser (Supabase Auth)
  if (authUser?.id) candidateIds.add(String(authUser.id).trim());
  if (authUser?.email) candidateEmails.add(String(authUser.email).trim().toLowerCase());
  const authName =
    authUser?.user_metadata?.full_name ||
    authUser?.user_metadata?.nome ||
    authUser?.user_metadata?.name;
  if (authName) candidateNames.add(String(authName).trim().toLowerCase());

  // 3. Mapear membros da equipe equivalentes (caso haja correspondência por id ou e-mail)
  if (Array.isArray(teamMembers) && teamMembers.length > 0) {
    teamMembers.forEach((member) => {
      if (!member) return;
      const mId = member.id ? String(member.id).trim() : '';
      const mEmail = member.email ? member.email.trim().toLowerCase() : '';
      const mName = member.name ? member.name.trim().toLowerCase() : '';

      const isSameUser =
        (mId && candidateIds.has(mId)) ||
        (mEmail && candidateEmails.has(mEmail)) ||
        (mName && candidateNames.has(mName));

      if (isSameUser) {
        if (mId) candidateIds.add(mId);
        if (mEmail) candidateEmails.add(mEmail);
        if (mName) candidateNames.add(mName);
      }
    });
  }

  const matchesCandidate = (val: string | null | undefined): boolean => {
    if (!val) return false;
    const str = String(val).trim();
    const strLower = str.toLowerCase();
    return (
      candidateIds.has(str) ||
      candidateEmails.has(strLower) ||
      candidateNames.has(strLower)
    );
  };

  // 1. Checagem em assignedToIds (array de múltiplos responsáveis)
  if (Array.isArray(task.assignedToIds) && task.assignedToIds.length > 0) {
    if (task.assignedToIds.some((id) => matchesCandidate(id))) {
      return true;
    }
  }

  // 2. Checagem em assignedTo (campo singular principal)
  if (task.assignedTo && matchesCandidate(task.assignedTo)) {
    return true;
  }

  // 3. Checagem em userSubmissions (chaves de submissão do responsável)
  if (task.userSubmissions && typeof task.userSubmissions === 'object') {
    const submissionKeys = Object.keys(task.userSubmissions);
    if (submissionKeys.some((subKey) => matchesCandidate(subKey))) {
      return true;
    }
  }

  return false;
}
