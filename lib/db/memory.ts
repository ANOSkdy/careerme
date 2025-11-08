import type {
  BasicInfo,
  CvQa,
  HighestEducation,
  ResumeStatus,
} from "../validation/schemas";

export type MemoryResumeRecord = {
  id: string;
  anonKey: string;
  basicInfo?: BasicInfo;
  status?: ResumeStatus;
  highestEducation?: HighestEducation;
  qa?: CvQa;
  selfPr?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoryEducationRecord = {
  id: string;
  resumeId: string;
  schoolName: string;
  faculty: string;
  start: string;
  end: string;
  present: boolean;
};

type MemoryStore = {
  resumes: Map<string, MemoryResumeRecord>;
  education: Map<string, MemoryEducationRecord[]>;
};

interface MemoryGlobal {
  __careermeMemoryStore?: MemoryStore;
}

export function getMemoryStore(): MemoryStore {
  const globalObj = globalThis as typeof globalThis & MemoryGlobal;
  if (!globalObj.__careermeMemoryStore) {
    globalObj.__careermeMemoryStore = {
      resumes: new Map<string, MemoryResumeRecord>(),
      education: new Map<string, MemoryEducationRecord[]>(),
    };
  }
  return globalObj.__careermeMemoryStore;
}
