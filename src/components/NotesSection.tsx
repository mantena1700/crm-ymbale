'use client';

import { useState } from 'react';
import { Note } from '@/lib/types';
import { addNote } from '@/app/actions';
import styles from './NotesSection.module.css';

interface NotesSectionProps {
    restaurantId: string;
    initialNotes: Note[];
}

export default function NotesSection({ restaurantId, initialNotes }: NotesSectionProps) {
    const [notes, setNotes] = useState<Note[]>(initialNotes);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAddNote = async () => {
        if (!newNote.trim()) return;

        setLoading(true);
        try {
            // Optimistic update could be done here, but for simplicity we wait
            await addNote(restaurantId, newNote);
            // In a real app with server actions revalidating, we might just rely on router refresh
            // But since we are passing initialNotes, we might need to manually update local state 
            // if we don't want to trigger a full page reload.
            // For now, let's just fake the local update to feel instant
            const note: Note = {
                id: Date.now().toString(),
                content: newNote,
                createdAt: new Date().toISOString()
            };
            setNotes([note, ...notes]);
            setNewNote('');
        } catch (error) {
            console.error('Failed to add note', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Observações & Anotações</h3>

            <div className={styles.inputArea}>
                <textarea
                    className={styles.textarea}
                    placeholder="Adicione uma observação sobre este cliente..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                />
                <button
                    className={styles.addButton}
                    onClick={handleAddNote}
                    disabled={loading || !newNote.trim()}
                >
                    {loading ? 'Salvando...' : 'Adicionar Nota'}
                </button>
            </div>

            <div className={styles.notesList}>
                {notes.length === 0 ? (
                    <p className={styles.empty}>Nenhuma observação registrada.</p>
                ) : (
                    notes.map(note => (
                        <div key={note.id} className={styles.noteCard}>
                            <div className={styles.noteHeader}>
                                <span className={styles.date}>
                                    {new Date(note.createdAt).toLocaleString('pt-BR')}
                                </span>
                            </div>
                            <p className={styles.content}>{note.content}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
