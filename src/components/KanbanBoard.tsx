'use client';

import { useState, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Restaurant } from '@/lib/types';
import { updateRestaurantStatus } from '@/app/actions';
import SortableRestaurantCard from './SortableRestaurantCard';
import RestaurantCard from './RestaurantCard';
import EnhancedRestaurantCard from './EnhancedRestaurantCard';
import styles from './KanbanBoard.module.css';

interface KanbanBoardProps {
    initialRestaurants: Restaurant[];
}

type PipelineStage = 'A Analisar' | 'Qualificado' | 'Contatado' | 'Negociação' | 'Fechado';
const STAGES: PipelineStage[] = ['A Analisar', 'Qualificado', 'Contatado', 'Negociação', 'Fechado'];

export default function KanbanBoard({ initialRestaurants }: KanbanBoardProps) {
    const [items, setItems] = useState<{ restaurant: Restaurant; status: PipelineStage }[]>(
        initialRestaurants.map(r => ({
            restaurant: r,
            status: (r.status as PipelineStage) || 'A Analisar'
        }))
    );

    // Sync state with props when server revalidates
    useEffect(() => {
        setItems(initialRestaurants.map(r => ({
            restaurant: r,
            status: (r.status as PipelineStage) || 'A Analisar'
        })));
    }, [initialRestaurants]);

    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // Find the containers
        const activeItem = items.find(i => i.restaurant.id === activeId);

        // If over a container (column) directly
        if (STAGES.includes(overId as PipelineStage)) {
            const newStatus = overId as PipelineStage;
            if (activeItem && activeItem.status !== newStatus) {
                setItems(prev => prev.map(item =>
                    item.restaurant.id === activeId ? { ...item, status: newStatus } : item
                ));
            }
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        const activeItem = items.find(i => i.restaurant.id === activeId);

        // If dropped on a column
        if (STAGES.includes(overId as PipelineStage)) {
            if (activeItem && activeItem.status !== overId) {
                const newStatus = overId as PipelineStage;
                setItems(prev => prev.map(item =>
                    item.restaurant.id === activeId ? { ...item, status: newStatus } : item
                ));

                // Persist change
                updateRestaurantStatus(activeId, newStatus);
            }
        }
    };

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className={styles.board}>
                {STAGES.map(stage => (
                    <div key={stage} className={styles.column}>
                        <div className={styles.columnHeader}>
                            <h3>{stage}</h3>
                            <span className={styles.count}>
                                {items.filter(i => i.status === stage).length}
                            </span>
                        </div>
                        <div className={styles.columnContent}>
                            {items
                                .filter(i => i.status === stage)
                                .map(({ restaurant }) => (
                                    <RestaurantCard key={restaurant.id} restaurant={restaurant} />
                                ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className={styles.board}>
                {STAGES.map(stage => (
                    <div key={stage} className={styles.column}>
                        <div className={styles.columnHeader}>
                            <h3>{stage}</h3>
                            <span className={styles.count}>
                                {items.filter(i => i.status === stage).length}
                            </span>
                        </div>

                        <SortableContext
                            id={stage}
                            items={items.filter(i => i.status === stage).map(i => i.restaurant.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className={styles.columnContent}>
                                {items
                                    .filter(i => i.status === stage)
                                    .map(({ restaurant }) => (
                                        <SortableRestaurantCard 
                                            key={restaurant.id} 
                                            restaurant={restaurant}
                                            onFollowUpCreated={() => {
                                                // Refresh or show notification
                                            }}
                                        />
                                    ))}
                                {/* Drop zone placeholder if empty */}
                                {items.filter(i => i.status === stage).length === 0 && (
                                    <div className={styles.emptyZone} id={stage}>
                                        <span>Arraste cards aqui</span>
                                    </div>
                                )}
                            </div>
                        </SortableContext>
                    </div>
                ))}
            </div>

            <DragOverlay>
                {activeId ? (
                    <div className={styles.dragOverlay}>
                        <RestaurantCard restaurant={items.find(i => i.restaurant.id === activeId)?.restaurant!} />
                    </div>
                ) : null}
            </DragOverlay>
            
            {/* Quick Stats Footer */}
            <div className={styles.statsFooter}>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Total:</span>
                    <span className={styles.statValue}>{items.length}</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Qualificados:</span>
                    <span className={styles.statValue}>{items.filter(i => i.status === 'Qualificado').length}</span>
                </div>
                <div className={styles.statItem}>
                    <span className={styles.statLabel}>Em Negociação:</span>
                    <span className={styles.statValue}>{items.filter(i => i.status === 'Negociação').length}</span>
                </div>
            </div>
        </DndContext>
    );
}
