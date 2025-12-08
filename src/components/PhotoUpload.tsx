'use client';

import { useState, useRef } from 'react';
import styles from './PhotoUpload.module.css';

interface PhotoUploadProps {
    currentPhotoUrl?: string;
    onPhotoChange: (file: File | null) => void;
    sellerName?: string;
}

export default function PhotoUpload({ currentPhotoUrl, onPhotoChange, sellerName }: PhotoUploadProps) {
    const [preview, setPreview] = useState<string | null>(currentPhotoUrl || null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            onPhotoChange(file);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleRemove = () => {
        setPreview(null);
        onPhotoChange(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className={styles.container}>
            <label className={styles.label}>Foto do Vendedor</label>
            
            <div
                className={`${styles.uploadArea} ${isDragging ? styles.dragging : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleInputChange}
                    className={styles.hiddenInput}
                />
                
                {preview ? (
                    <div className={styles.previewContainer}>
                        <img src={preview} alt="Preview" className={styles.previewImage} />
                        <div className={styles.overlay}>
                            <span className={styles.changeText}>📷 Alterar Foto</span>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemove();
                            }}
                            className={styles.removeButton}
                            title="Remover foto"
                        >
                            ×
                        </button>
                    </div>
                ) : (
                    <div className={styles.placeholder}>
                        {sellerName ? (
                            <div className={styles.initials}>
                                {getInitials(sellerName)}
                            </div>
                        ) : (
                            <div className={styles.icon}>📷</div>
                        )}
                        <p className={styles.placeholderText}>
                            Clique ou arraste uma foto aqui
                        </p>
                        <p className={styles.placeholderSubtext}>
                            PNG, JPG até 5MB
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

