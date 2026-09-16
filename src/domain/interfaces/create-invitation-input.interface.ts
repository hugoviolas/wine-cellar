export interface CreateInvitationInput {
  cellarId: string;
  email: string;
  role: 'editor' | 'reader';
  invitedByUserId: string;
}
