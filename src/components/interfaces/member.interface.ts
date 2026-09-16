export interface Member {
  membershipId: string;
  email: string | null;
  role: 'owner' | 'editor' | 'reader';
}
