import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '@/db';
import { useProfiles } from '@/contexts/ProfileContext';
import { generateId } from '@/utils/id';
import { WearLogForm, type WearLogSaveData } from '@/components/WearLogForm';

export function AddWearLog() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeProfile } = useProfiles();

  const initialDate = searchParams.get('date') ?? undefined;

  async function handleSave(data: WearLogSaveData) {
    if (!activeProfile) return;
    await db.wearLogs.add({
      id: generateId(),
      ownerId: activeProfile.id,
      createdAt: new Date().toISOString(),
      ...data,
    });
    navigate('/journal', { replace: true });
  }

  return (
    <WearLogForm
      heading="Log outfit"
      initial={{ date: initialDate }}
      saveLabel="Log it"
      onSave={handleSave}
      onCancel={() => navigate(-1)}
    />
  );
}
