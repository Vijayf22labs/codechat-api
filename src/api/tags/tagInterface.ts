export interface Imember {
  user_name: string;
  mobile_number: string;
  addedAt: Date | null;
}

interface Itag {
  name: string;
  members: Imember[];
}

export type TagsArray = Itag[] | undefined | null;
