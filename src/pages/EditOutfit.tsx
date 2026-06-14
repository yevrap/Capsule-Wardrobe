import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { OutfitForm, type OutfitFormValues } from '@/components/OutfitForm';

export function EditOutfit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const outfit = useLiveQuery(() => (id ? db.outfits.get(id) : undefined), [id]);

  if (outfit === undefined) return null;
  if (!outfit) return <Navigate to="/outfits" replace />;

  const initial: OutfitFormValues = {
    name: outfit.name,
    garmentIds: outfit.garmentIds,
    occasionTags: outfit.occasionTags,
  };

  async function handleSave(values: OutfitFormValues) {
    await db.outfits.update(outfit!.id, {
      name: values.name,
      garmentIds: values.garmentIds,
      occasionTags: values.occasionTags,
    });
    navigate(`/outfit/${outfit!.id}`, { replace: true });
  }

  return (
    <OutfitForm
      initial={initial}
      onSave={handleSave}
      onCancel={() => navigate(-1)}
    />
  );
}
