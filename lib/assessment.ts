import { AssessmentStatus, UserRole } from '@prisma/client';
import { canEditAssessment, canReview } from '@/lib/authz';

export const MODULE_LABELS: Record<string, string> = {
  'sub-perencanaan': 'Kualitas Perencanaan',
  'sub-kapabilitas-1': 'Kepemimpinan',
  'sub-kapabilitas-2': 'Kebijakan MR',
  'sub-kapabilitas-3': 'Sumber Daya Manusia',
  'sub-kapabilitas-4': 'Kemitraan',
  'sub-kapabilitas-5': 'Proses MR',
  'sub-hasil-1': 'Aktivitas Penanganan MR',
  'sub-hasil-2': 'Outcomes',
  'sub-hasil-3': 'Tindak Lanjut',
};

export function mapStatusLabel(status: AssessmentStatus) {
  return {
    DRAFT: 'Draft',
    SUBMITTED: 'Diajukan',
    IN_REVIEW: 'Sedang Direview',
    REVISION_REQUESTED: 'Perlu Revisi',
    APPROVED: 'Disetujui',
    REJECTED: 'Ditolak',
  }[status];
}

/**
 * Status dasar yang boleh diubah oleh actor terkait.
 *
 * Makna status per actor:
 * - BLUD_OPERATOR:
 *   - DRAFT = input awal
 *   - REVISION_REQUESTED = revisi dari Admin BLUD
 *
 * - BLUD_ADMIN:
 *   - REVISION_REQUESTED = revisi dari BPKP
 *
 * Catatan:
 * Dengan enum status yang ada saat ini, sumber revisi tidak dibedakan secara eksplisit.
 * Karena itu, pengecekan actor aktif tetap perlu dibantu dari context route / period owner.
 */
export function canMutateAssessment(role: UserRole, status: AssessmentStatus) {
  if (!canEditAssessment(role)) return false;

  if (role === 'BLUD_OPERATOR') {
    return status === 'DRAFT' || status === 'REVISION_REQUESTED';
  }

  if (role === 'BLUD_ADMIN') {
    return status === 'REVISION_REQUESTED';
  }

  return false;
}

/**
 * Reviewer aktif:
 * - BLUD_ADMIN me-review assessment yang dikirim operator
 * - BPKP me-review assessment yang dikirim admin
 */
export function canReviewAssessment(role: UserRole, status: AssessmentStatus) {
  if (!canReview(role)) return false;

  if (role === 'BLUD_ADMIN' || role === 'BPKP_ADMIN') {
    return status === 'SUBMITTED' || status === 'IN_REVIEW';
  }

  return false;
}

/**
 * Actor yang boleh melakukan submit ke tahap berikutnya.
 *
 * - BLUD_OPERATOR:
 *   submit dari DRAFT / REVISION_REQUESTED -> SUBMITTED
 *
 * - BLUD_ADMIN:
 *   submit ke BPKP setelah hasil review admin siap,
 *   umumnya dari APPROVED atau setelah revisi BPKP selesai.
 *
 * Backend workflow tetap harus memvalidasi:
 * - operator: semua parameter sudah lengkap
 * - admin: semua row review sudah accepted
 */
export function canSubmitAssessment(role: UserRole, status: AssessmentStatus) {
  if (role === 'BLUD_OPERATOR') {
    return status === 'DRAFT' || status === 'REVISION_REQUESTED';
  }

  if (role === 'BLUD_ADMIN') {
    return status === 'APPROVED' || status === 'REVISION_REQUESTED';
  }

  return false;
}

/**
 * Status berikut yang diizinkan dari sisi helper umum.
 *
 * Catatan penting:
 * Karena enum status period Anda generik, status SUBMITTED dipakai di dua tahap:
 * 1) Operator -> Admin
 * 2) Admin -> BPKP
 *
 * Jadi penentuan "submit ke siapa" tetap ditentukan dari role actor saat ini.
 */
export function allowedNextStatuses(role: UserRole, status: AssessmentStatus) {
  // Operator BLUD: isi / revisi lalu submit ke Admin BLUD
  if (role === 'BLUD_OPERATOR') {
    if (status === 'DRAFT' || status === 'REVISION_REQUESTED') {
      return ['SUBMITTED'] as AssessmentStatus[];
    }
    return [];
  }

  // Admin BLUD:
  // - review assessment dari operator
  // - submit hasil approved ke BPKP
  if (role === 'BLUD_ADMIN') {
    if (status === 'SUBMITTED') {
      return [
        'IN_REVIEW',
        'REVISION_REQUESTED',
        'APPROVED',
        'REJECTED',
      ] as AssessmentStatus[];
    }

    if (status === 'IN_REVIEW') {
      return [
        'REVISION_REQUESTED',
        'APPROVED',
        'REJECTED',
      ] as AssessmentStatus[];
    }

    if (status === 'APPROVED' || status === 'REVISION_REQUESTED') {
      return ['SUBMITTED'] as AssessmentStatus[];
    }

    return [];
  }

  // BPKP:
  // - review assessment dari admin
  if (role === 'BPKP_ADMIN') {
    if (status === 'SUBMITTED') {
      return [
        'IN_REVIEW',
        'REVISION_REQUESTED',
        'APPROVED',
        'REJECTED',
      ] as AssessmentStatus[];
    }

    if (status === 'IN_REVIEW') {
      return [
        'REVISION_REQUESTED',
        'APPROVED',
        'REJECTED',
      ] as AssessmentStatus[];
    }

    return [];
  }

  return [];
}

export function isDraftLikeStatus(status: AssessmentStatus) {
  return status === 'DRAFT' || status === 'REVISION_REQUESTED';
}

export function isReviewableStatus(status: AssessmentStatus) {
  return status === 'SUBMITTED' || status === 'IN_REVIEW';
}

export function isFinalStatus(status: AssessmentStatus) {
  return status === 'APPROVED' || status === 'REJECTED';
}

/**
 * Label target submit berdasarkan actor aktif.
 * Berguna untuk tombol "Kirim ke ..."
 */
export function getSubmitTargetLabel(role: UserRole) {
  if (role === 'BLUD_OPERATOR') return 'Admin BLUD';
  if (role === 'BLUD_ADMIN') return 'BPKP';
  return 'Tahap Berikutnya';
}