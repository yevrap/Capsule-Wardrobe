import { useNavigate } from 'react-router-dom';
import { db } from '@/db';
import { useProfiles } from '@/contexts/ProfileContext';
import { generateId } from '@/utils/id';
import { OutfitForm, type OutfitFormValues } from '@/components/OutfitForm';

export function AddOutfit() {
  const navigate = useNavigate();
  const { activeProfile } = useProfiles();

  async function handleSave(values: OutfitFormValues) {
    if (!activeProfile) return;
    const id = generateId();
    const now = new Date().toISOString();
    await db.outfits.add({
      id,
      ownerId: activeProfile.id,
      name: values.name,
      garmentIds: values.garmentIds,
      occasionTags: values.occasionTags,
      photos: [],
      timesWorn: 0,
      createdAt: now,
    });
    navigate(`/outfit/${id}`, { replace: true });
  }

  return (
    <OutfitForm
      onSave={handleSave}
      onCancel={() => navigate(-1)}
      saveLabel="Create outfit"
    />
  );
}
