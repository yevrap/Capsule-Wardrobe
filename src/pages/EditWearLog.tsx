import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { WearLogForm, type WearLogSaveData } from '@/components/WearLogForm';

export function EditWearLog() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const log = useLiveQuery(
    async () => {
      if (!id) return null;
      return (await db.wearLogs.get(id)) ?? null;
    },
    [id],
  );

  if (log === undefined) return null; // loading
  if (log === null) {
    navigate('/journal', { replace: true });
    return null;
  }

  async function handleSave(data: WearLogSaveData) {
    await db.wearLogs.update(log!.id, data);
    navigate(`/journal/${log!.id}`, { replace: true });
  }

  return (
    <WearLogForm
      heading="Edit entry"
      initial={{
        date:     log.date,
        photo:    log.photo,
        notes:    log.notes,
        tags:     log.tags,
        outfitId: log.outfitId,
      }}
      saveLabel="Save"
      onSave={handleSave}
      onCancel={() => navigate(-1)}
    />
  );
}
