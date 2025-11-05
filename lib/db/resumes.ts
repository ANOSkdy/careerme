import { updateAirtableRecords } from './airtable';

const DEFAULT_RESUME_TABLE = 'Resumes';

function getResumeTableName(): string {
  return process.env.AIRTABLE_TABLE_RESUMES || DEFAULT_RESUME_TABLE;
}

type DraftFields = Partial<{
  selfpr_draft: string;
  summary_draft: string;
}>;

export async function updateResumeDraft(
  resumeId: string,
  fields: DraftFields
): Promise<void> {
  if (!resumeId) {
    throw new Error('resumeId is required to update a resume draft');
  }
  if (!fields || !Object.keys(fields).length) {
    throw new Error('At least one field must be provided to update a resume draft');
  }

  const table = getResumeTableName();
  const records = await updateAirtableRecords(table, [
    {
      id: resumeId,
      fields,
    },
  ]);

  if (!records.length) {
    throw new Error('Airtable response did not include an updated record');
  }
}
