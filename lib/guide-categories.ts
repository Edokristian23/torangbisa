import type { ComponentType } from 'react';
import { BookOpen, FileArchive, GraduationCap, Scale, Wrench } from 'lucide-react';

export type GuideDocumentCategory =
  | 'PETUNJUK_TOOLS'
  | 'PERATURAN_MR'
  | 'BAHAN_PEMBELAJARAN'
  | 'CONTOH_DOKUMEN';

export type GuideCategoryOption = {
  value: GuideDocumentCategory;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; size?: number }>;
};

export const GUIDE_CATEGORY_VALUES: GuideDocumentCategory[] = [
  'PETUNJUK_TOOLS',
  'PERATURAN_MR',
  'BAHAN_PEMBELAJARAN',
  'CONTOH_DOKUMEN',
];

export const GUIDE_CATEGORY_OPTIONS: GuideCategoryOption[] = [
  {
    value: 'PETUNJUK_TOOLS',
    label: 'Petunjuk Tools',
    description: 'Panduan penggunaan tools, fitur aplikasi, dan alur kerja sistem.',
    icon: Wrench,
  },
  {
    value: 'PERATURAN_MR',
    label: 'Peraturan MR',
    description: 'Regulasi, kebijakan, dan rujukan formal terkait manajemen risiko.',
    icon: Scale,
  },
  {
    value: 'BAHAN_PEMBELAJARAN',
    label: 'Bahan Pembelajaran',
    description: 'Materi edukasi, pelatihan, presentasi, dan referensi pembelajaran.',
    icon: GraduationCap,
  },
  {
    value: 'CONTOH_DOKUMEN',
    label: 'Contoh Dokumen',
    description: 'Template, contoh isian, dan dokumen referensi yang dapat digunakan.',
    icon: FileArchive,
  },
];

export function isGuideDocumentCategory(value: unknown): value is GuideDocumentCategory {
  return typeof value === 'string' && GUIDE_CATEGORY_VALUES.includes(value as GuideDocumentCategory);
}

export function normalizeGuideCategory(value: unknown): GuideDocumentCategory {
  return isGuideDocumentCategory(value) ? value : 'PETUNJUK_TOOLS';
}

export function getGuideCategoryOption(value: unknown): GuideCategoryOption {
  const normalized = normalizeGuideCategory(value);
  return GUIDE_CATEGORY_OPTIONS.find((item) => item.value === normalized) || GUIDE_CATEGORY_OPTIONS[0];
}

export const GUIDE_HEADER_ICON = BookOpen;
