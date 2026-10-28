export type ChangeGroup = {
  item: string;
  from: string;
  to: string;
  count: number;
  amount: number;
};

// dampak satu aturan (tambah/ubah)
export type EffectSummary = {
  groups: ChangeGroup[];
  hiddenGroups: number;
  totalChanged: number;
  totalAmount: number;
  protectedMatches: number;
};

// dampak "terapkan ulang" seluruh aturan
export type ReapplyPreview = {
  groups: ChangeGroup[];
  hiddenGroups: number;
  totalChanged: number;
  totalAmount: number;
  scopeItems: number;
  metadataOnly: number;
  digest: string;
};