import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { sanitizeNickname } from '@/lib/types';
import { Button, Input, Modal } from '@/components/ui';

export interface RenamablePlayer {
  id: string;
  nickname: string;
}

/**
 * Host-only player list with inline renaming.
 * Available in every phase — after the game starts the host is the only one who may rename.
 */
export function PlayersModal({
  open,
  onClose,
  players,
  onRename,
}: {
  open: boolean;
  onClose: () => void;
  players: RenamablePlayer[];
  /** Resolves to an error message, or null on success. */
  onRename: (playerId: string, nickname: string) => Promise<string | null>;
}) {
  return (
    <Modal open={open} onClose={onClose} title={`Гравці (${players.length})`}>
      {players.length === 0 ? (
        <p className="text-sm text-mist-600">Поки ніхто не приєднався.</p>
      ) : (
        <ul className="space-y-2">
          {players.map((player) => (
            <PlayerRow key={player.id} player={player} onRename={onRename} />
          ))}
        </ul>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Закрити
        </Button>
      </div>
    </Modal>
  );
}

function PlayerRow({
  player,
  onRename,
}: {
  player: RenamablePlayer;
  onRename: (playerId: string, nickname: string) => Promise<string | null>;
}) {
  const [value, setValue] = useState(player.nickname);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow renames that arrive from elsewhere (the player's own device, another host tab).
  useEffect(() => {
    setValue(player.nickname);
  }, [player.nickname]);

  const clean = sanitizeNickname(value);
  const dirty = clean.length > 0 && clean !== player.nickname;

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    const message = await onRename(player.id, clean);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <li>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          maxLength={24}
          aria-label={`Імʼя гравця ${player.nickname}`}
        />
        <Button type="submit" size="sm" disabled={!dirty} loading={saving}>
          {saved && !dirty ? <Check size={15} /> : 'Зберегти'}
        </Button>
      </form>
      {error && <p className="mt-1 text-xs font-medium text-error-500">{error}</p>}
    </li>
  );
}
