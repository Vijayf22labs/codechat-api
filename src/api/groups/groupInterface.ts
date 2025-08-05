export interface Igroup {
  group_id: string;
  message: string;
  delay: number;
  status: string; // Required in Igroup but missing in IGroup
}
