'use client';

import { useState } from 'react';
import { Restaurant } from '@/lib/types';
import styles from './MapsModal.module.css';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    query: string;
    restaurant?: Restaurant;
}

export default function MapsModal({ isOpen, onClose, query, restaurant }: Props) {
    const [activeTab, setActiveTab] = useState<'map' | 'street' | 'info'>('map');
    const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
    const [savedPhotos, setSavedPhotos] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    // Different map views
    const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    const streetViewUrl = `https://www.google.com/maps/embed/v1/streetview?key=AIzaSyDMhElgb9AuWmnGweVAPsl6EIUMBm8A0X4&location=${encodeURIComponent(query)}&heading=210&pitch=10&fov=90`;
    const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;

    // Copy address to clipboard
    const copyAddress = () => {
        const address = restaurant 
            ? `${restaurant.address?.street}, ${restaurant.address?.neighborhood}, ${restaurant.address?.city} - ${restaurant.address?.state}, ${restaurant.address?.zip}`
            : query;
        navigator.clipboard.writeText(address);
        alert('Endereço copiado!');
    };

    // Save photo (simulated - would need actual Google Places API)
    const handleSavePhoto = (photoUrl: string) => {
        setIsSaving(true);
        setTimeout(() => {
            setSavedPhotos(prev => [...prev, photoUrl]);
            setIsSaving(false);
            alert('Foto salva para o cliente!');
        }, 500);
    };

    // Sample photos (in real implementation, these would come from Google Places API)
    const samplePhotos = [
        'https://via.placeholder.com/400x300/6366f1/ffffff?text=Foto+1',
        'https://via.placeholder.com/400x300/8b5cf6/ffffff?text=Foto+2',
        'https://via.placeholder.com/400x300/10b981/ffffff?text=Foto+3',
    ];

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={onClose}>✕</button>
                
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerInfo}>
                        <h2>📍 {restaurant?.name || 'Localização'}</h2>
                        {restaurant && (
                            <div className={styles.headerMeta}>
                                <span className={styles.rating}>⭐ {restaurant.rating}</span>
                                <span className={styles.category}>{restaurant.category || 'Restaurante'}</span>
                            </div>
                        )}
                    </div>
                    <div className={styles.headerActions}>
                        <button 
                            className={styles.actionButton}
                            onClick={copyAddress}
                            title="Copiar endereço"
                        >
                            📋 Copiar
                        </button>
                        <a
                            href={directionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.actionButton}
                        >
                            🧭 Rotas
                        </a>
                    </div>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    <button 
                        className={`${styles.tab} ${activeTab === 'map' ? styles.active : ''}`}
                        onClick={() => setActiveTab('map')}
                    >
                        🗺️ Mapa
                    </button>
                    <button 
                        className={`${styles.tab} ${activeTab === 'street' ? styles.active : ''}`}
                        onClick={() => setActiveTab('street')}
                    >
                        🏙️ Street View
                    </button>
                    <button 
                        className={`${styles.tab} ${activeTab === 'info' ? styles.active : ''}`}
                        onClick={() => setActiveTab('info')}
                    >
                        ℹ️ Informações
                    </button>
                </div>

                {/* Content */}
                <div className={styles.content}>
                    {activeTab === 'map' && (
                        <>
                            <div className={styles.mapControls}>
                                <button 
                                    className={`${styles.mapTypeBtn} ${mapType === 'roadmap' ? styles.active : ''}`}
                                    onClick={() => setMapType('roadmap')}
                                >
                                    🗺️ Normal
                                </button>
                                <button 
                                    className={`${styles.mapTypeBtn} ${mapType === 'satellite' ? styles.active : ''}`}
                                    onClick={() => setMapType('satellite')}
                                >
                                    🛰️ Satélite
                                </button>
                            </div>
                            <div className={styles.mapContainer}>
                                <iframe
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    loading="lazy"
                                    allowFullScreen
                                    src={mapUrl + (mapType === 'satellite' ? '&t=k' : '')}
                                    title="Google Maps"
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'street' && (
                        <div className={styles.mapContainer}>
                            <iframe
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                loading="lazy"
                                allowFullScreen
                                src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&layer=c&output=embed`}
                                title="Street View"
                            />
                        </div>
                    )}

                    {activeTab === 'info' && restaurant && (
                        <div className={styles.infoContainer}>
                            {/* Address Card */}
                            <div className={styles.infoCard}>
                                <h4>📍 Endereço Completo</h4>
                                <div className={styles.addressBlock}>
                                    <p className={styles.addressLine}>{restaurant.address?.street}</p>
                                    <p className={styles.addressLine}>{restaurant.address?.neighborhood}</p>
                                    <p className={styles.addressLine}>
                                        {restaurant.address?.city} - {restaurant.address?.state}
                                    </p>
                                    <p className={styles.addressLine}>CEP: {restaurant.address?.zip}</p>
                                </div>
                                <button className={styles.copyBtn} onClick={copyAddress}>
                                    📋 Copiar Endereço
                                </button>
                            </div>

                            {/* Stats Card */}
                            <div className={styles.infoCard}>
                                <h4>📊 Informações do Estabelecimento</h4>
                                <div className={styles.statsGrid}>
                                    <div className={styles.statItem}>
                                        <span className={styles.statLabel}>Avaliação</span>
                                        <span className={styles.statValue}>⭐ {restaurant.rating}</span>
                                    </div>
                                    <div className={styles.statItem}>
                                        <span className={styles.statLabel}>Avaliações</span>
                                        <span className={styles.statValue}>{restaurant.reviewCount?.toLocaleString()}</span>
                                    </div>
                                    <div className={styles.statItem}>
                                        <span className={styles.statLabel}>Categoria</span>
                                        <span className={styles.statValue}>{restaurant.category || 'N/A'}</span>
                                    </div>
                                    <div className={styles.statItem}>
                                        <span className={styles.statLabel}>Potencial</span>
                                        <span className={styles.statValue}>{restaurant.salesPotential}</span>
                                    </div>
                                    <div className={styles.statItem}>
                                        <span className={styles.statLabel}>Entregas/Mês</span>
                                        <span className={styles.statValue}>{restaurant.projectedDeliveries?.toLocaleString()}</span>
                                    </div>
                                    <div className={styles.statItem}>
                                        <span className={styles.statLabel}>Status</span>
                                        <span className={styles.statValue}>{restaurant.status || 'A Analisar'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Photos Section */}
                            <div className={styles.infoCard}>
                                <h4>📸 Fotos do Local</h4>
                                <p className={styles.photoNote}>
                                    Clique nas fotos para salvar no perfil do cliente
                                </p>
                                <div className={styles.photosGrid}>
                                    {samplePhotos.map((photo, i) => (
                                        <div key={i} className={styles.photoItem}>
                                            <img src={photo} alt={`Foto ${i + 1}`} />
                                            <button 
                                                className={styles.savePhotoBtn}
                                                onClick={() => handleSavePhoto(photo)}
                                                disabled={isSaving || savedPhotos.includes(photo)}
                                            >
                                                {savedPhotos.includes(photo) ? '✓ Salva' : '💾 Salvar'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {savedPhotos.length > 0 && (
                                    <div className={styles.savedInfo}>
                                        ✓ {savedPhotos.length} foto(s) salva(s) para este cliente
                                    </div>
                                )}
                            </div>

                            {/* Quick Actions */}
                            <div className={styles.infoCard}>
                                <h4>⚡ Ações Rápidas</h4>
                                <div className={styles.quickActions}>
                                    <a
                                        href={searchUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.quickAction}
                                    >
                                        🔍 Buscar no Google Maps
                                    </a>
                                    <a
                                        href={directionsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.quickAction}
                                    >
                                        🚗 Como Chegar
                                    </a>
                                    <a
                                        href={`https://www.google.com/search?q=${encodeURIComponent(restaurant.name + ' ' + restaurant.address?.city)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.quickAction}
                                    >
                                        🌐 Pesquisar na Web
                                    </a>
                                    <a
                                        href={`https://www.google.com/maps/search/${encodeURIComponent(restaurant.name)}/@-23.5,-46.6,15z`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.quickAction}
                                    >
                                        📍 Ver no Maps Completo
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'info' && !restaurant && (
                        <div className={styles.noInfo}>
                            <p>Informações do restaurante não disponíveis</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <a
                        href={searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.externalLink}
                    >
                        Abrir no Google Maps ↗
                    </a>
                </div>
            </div>
        </div>
    );
}
