'use client';

import { useState, useEffect } from 'react';
import { PageLayout, Card, Button, Badge } from '@/components/PageLayout';
import styles from './page.module.css';

interface WhatsAppStatus {
    connected: boolean;
    qrCode?: string;
    status: 'disconnected' | 'connecting' | 'connected';
    phoneNumber?: string;
    error?: string;
}

interface Conversation {
    phoneNumber: string;
    contactName?: string;
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
    restaurantId?: string;
    restaurantName?: string;
    funnelStage?: string;
}

interface Message {
    id: string;
    from: string;
    to: string;
    body: string;
    timestamp: Date;
    isFromMe: boolean;
    contactName?: string;
}

export default function WhatsAppClient() {
    const [status, setStatus] = useState<WhatsAppStatus>({
        connected: false,
        status: 'disconnected'
    });
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);

    // Carregar status inicial
    useEffect(() => {
        loadStatus();
        loadConversations();
        
        const interval = setInterval(() => {
            if (status.connected) {
                loadConversations();
            }
        }, 5000); // Atualizar a cada 5 segundos

        return () => clearInterval(interval);
    }, [status.connected]);

    // Carregar mensagens quando selecionar conversa
    useEffect(() => {
        if (selectedConversation) {
            loadMessages(selectedConversation.phoneNumber);
            const interval = setInterval(() => {
                loadMessages(selectedConversation.phoneNumber);
            }, 3000); // Atualizar mensagens a cada 3 segundos

            return () => clearInterval(interval);
        }
    }, [selectedConversation]);

    const loadStatus = async () => {
        try {
            const response = await fetch('/api/whatsapp/status');
            const data = await response.json();
            setStatus(data);
            setLoading(false);
        } catch (error) {
            console.error('Erro ao carregar status:', error);
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/whatsapp/connect', { method: 'POST' });
            const data = await response.json();
            setStatus(data);

            // Se tem QR Code, continuar verificando status
            if (data.qrCode) {
                const checkInterval = setInterval(async () => {
                    const statusResponse = await fetch('/api/whatsapp/status');
                    const statusData = await statusResponse.json();
                    setStatus(statusData);
                    
                    if (statusData.connected) {
                        clearInterval(checkInterval);
                        loadConversations();
                    }
                }, 2000);

                setTimeout(() => clearInterval(checkInterval), 120000); // Timeout de 2 minutos
            } else if (data.connected) {
                loadConversations();
            }
        } catch (error) {
            console.error('Erro ao conectar:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            await fetch('/api/whatsapp/disconnect', { method: 'POST' });
            setStatus({ connected: false, status: 'disconnected' });
            setConversations([]);
            setSelectedConversation(null);
            setMessages([]);
        } catch (error) {
            console.error('Erro ao desconectar:', error);
        }
    };

    const loadConversations = async () => {
        try {
            const response = await fetch('/api/whatsapp/conversations');
            const data = await response.json();
            setConversations(data.conversations || []);
        } catch (error) {
            console.error('Erro ao carregar conversas:', error);
        }
    };

    const loadMessages = async (phoneNumber: string) => {
        try {
            const response = await fetch(`/api/whatsapp/messages?phoneNumber=${encodeURIComponent(phoneNumber)}`);
            const data = await response.json();
            setMessages(data.messages || []);
        } catch (error) {
            console.error('Erro ao carregar mensagens:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedConversation || sending) return;

        setSending(true);
        try {
            const response = await fetch('/api/whatsapp/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: selectedConversation.phoneNumber,
                    message: newMessage,
                    restaurantId: selectedConversation.restaurantId
                })
            });

            const data = await response.json();
            if (data.success) {
                setNewMessage('');
                loadMessages(selectedConversation.phoneNumber);
            } else {
                alert(`Erro: ${data.error}`);
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            alert('Erro ao enviar mensagem');
        } finally {
            setSending(false);
        }
    };

    const handleMoveToFunnel = async (restaurantId: string, newStage: string) => {
        if (!confirm(`Mover cliente para "${newStage}"?`)) return;

        try {
            const response = await fetch('/api/whatsapp/funnel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restaurantId, newStage })
            });

            const data = await response.json();
            if (data.success) {
                alert('Cliente movido com sucesso!');
                loadConversations();
                if (selectedConversation) {
                    const updated = conversations.find(c => c.restaurantId === restaurantId);
                    if (updated) {
                        setSelectedConversation({ ...updated, funnelStage: newStage });
                    }
                }
            } else {
                alert(`Erro: ${data.error}`);
            }
        } catch (error) {
            console.error('Erro ao mover para funil:', error);
            alert('Erro ao mover cliente');
        }
    };

    const funnelStages = [
        'A Analisar',
        'Qualificado',
        'Contatado',
        'Negociação',
        'Fechado',
        'Descartado'
    ];

    return (
        <PageLayout>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1>💬 WhatsApp CRM</h1>
                    <p>Gerencie conversas e integre com seus funis de vendas</p>
                </div>

                {/* Status e Conexão */}
                <Card>
                    <div className={styles.statusSection}>
                        <div className={styles.statusInfo}>
                            <div className={styles.statusIndicator}>
                                <span className={`${styles.statusDot} ${status.connected ? styles.connected : styles.disconnected}`}></span>
                                <span>
                                    {status.connected ? '✅ Conectado' : status.status === 'connecting' ? '🔄 Conectando...' : '❌ Desconectado'}
                                </span>
                            </div>
                            {status.phoneNumber && (
                                <p className={styles.phoneNumber}>📱 {status.phoneNumber}</p>
                            )}
                        </div>
                        <div className={styles.statusActions}>
                            {!status.connected ? (
                                <Button 
                                    onClick={handleConnect} 
                                    disabled={loading || status.status === 'connecting'}
                                    variant="primary"
                                >
                                    {status.status === 'connecting' ? '🔄 Conectando...' : '🔗 Conectar WhatsApp'}
                                </Button>
                            ) : (
                                <Button 
                                    onClick={handleDisconnect} 
                                    variant="danger"
                                >
                                    🔌 Desconectar
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* QR Code */}
                    {status.qrCode && (
                        <div className={styles.qrSection}>
                            <p className={styles.qrInstructions}>
                                📱 Escaneie o QR Code com seu WhatsApp:
                            </p>
                            <div className={styles.qrContainer}>
                                <img src={status.qrCode} alt="QR Code WhatsApp" className={styles.qrCode} />
                            </div>
                            <p className={styles.qrHint}>
                                1. Abra o WhatsApp no seu celular<br />
                                2. Toque em Menu ou Configurações<br />
                                3. Toque em Aparelhos conectados<br />
                                4. Toque em Conectar um aparelho<br />
                                5. Aponte seu celular para esta tela para capturar o código
                            </p>
                        </div>
                    )}
                </Card>

                {/* Layout Principal: Conversas e Mensagens */}
                <div className={styles.mainLayout}>
                    {/* Lista de Conversas */}
                    <div className={styles.conversationsPanel}>
                        <div className={styles.panelHeader}>
                            <h2>💬 Conversas ({conversations.length})</h2>
                        </div>
                        <div className={styles.conversationsList}>
                            {conversations.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <p>Nenhuma conversa encontrada</p>
                                    {!status.connected && (
                                        <p className={styles.emptyHint}>Conecte o WhatsApp para ver conversas</p>
                                    )}
                                </div>
                            ) : (
                                conversations.map((conv) => (
                                    <div
                                        key={conv.phoneNumber}
                                        className={`${styles.conversationItem} ${selectedConversation?.phoneNumber === conv.phoneNumber ? styles.active : ''}`}
                                        onClick={() => setSelectedConversation(conv)}
                                    >
                                        <div className={styles.conversationAvatar}>
                                            {conv.contactName?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div className={styles.conversationContent}>
                                            <div className={styles.conversationHeader}>
                                                <span className={styles.conversationName}>
                                                    {conv.contactName || conv.phoneNumber}
                                                </span>
                                                {conv.unreadCount > 0 && (
                                                    <Badge variant="primary">{conv.unreadCount}</Badge>
                                                )}
                                            </div>
                                            <p className={styles.conversationPreview}>
                                                {conv.lastMessage || 'Sem mensagens'}
                                            </p>
                                            {conv.restaurantName && (
                                                <div className={styles.conversationMeta}>
                                                    <Badge variant="secondary">🏢 {conv.restaurantName}</Badge>
                                                    {conv.funnelStage && (
                                                        <Badge variant="info">📊 {conv.funnelStage}</Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Área de Mensagens */}
                    <div className={styles.messagesPanel}>
                        {selectedConversation ? (
                            <>
                                <div className={styles.messagesHeader}>
                                    <div>
                                        <h3>{selectedConversation.contactName || selectedConversation.phoneNumber}</h3>
                                        {selectedConversation.restaurantName && (
                                            <p className={styles.restaurantInfo}>
                                                🏢 {selectedConversation.restaurantName}
                                                {selectedConversation.funnelStage && (
                                                    <> • 📊 {selectedConversation.funnelStage}</>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    {selectedConversation.restaurantId && (
                                        <div className={styles.funnelActions}>
                                            <select
                                                value={selectedConversation.funnelStage || ''}
                                                onChange={(e) => handleMoveToFunnel(selectedConversation.restaurantId!, e.target.value)}
                                                className={styles.funnelSelect}
                                            >
                                                <option value="">Mover para funil...</option>
                                                {funnelStages.map(stage => (
                                                    <option key={stage} value={stage}>{stage}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className={styles.messagesList}>
                                    {messages.length === 0 ? (
                                        <div className={styles.emptyMessages}>
                                            <p>Nenhuma mensagem ainda</p>
                                        </div>
                                    ) : (
                                        messages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`${styles.message} ${msg.isFromMe ? styles.messageOut : styles.messageIn}`}
                                            >
                                                <div className={styles.messageContent}>
                                                    <p>{msg.body}</p>
                                                    <span className={styles.messageTime}>
                                                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className={styles.messageInput}>
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Digite sua mensagem..."
                                        disabled={!status.connected || sending}
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={!status.connected || sending || !newMessage.trim()}
                                        variant="primary"
                                    >
                                        {sending ? '⏳' : '📤'}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className={styles.noSelection}>
                                <p>👈 Selecione uma conversa para começar</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}

