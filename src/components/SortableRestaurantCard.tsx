import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import EnhancedRestaurantCard from './EnhancedRestaurantCard';
import { Restaurant } from '@/lib/types';

interface SortableRestaurantCardProps {
    restaurant: Restaurant;
    onFollowUpCreated?: () => void;
}

export default function SortableRestaurantCard({ restaurant, onFollowUpCreated }: SortableRestaurantCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: restaurant.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <EnhancedRestaurantCard 
                restaurant={restaurant} 
                onFollowUpCreated={onFollowUpCreated}
            />
        </div>
    );
}
