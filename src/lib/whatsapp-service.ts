'use server';

// @ts-ignore - whatsapp-web.js não tem tipos oficiais
import { Client, LocalAuth } from 'whatsapp-web.js';
import { prisma } from './db';

// Função para gerar QR Code - importação dinâmica apenas no servidor
async function generateQRCode(qr: string): Promise<string> {
    try {
        // Importação dinâmica que só funciona no servidor
        const qrcode = await import('qrcode');
        return await qrcode.default.toDataURL(qr);
    } catch (error: any) {
        console.error('Erro ao gerar QR Code:', error);
        throw new Error(error?.message || 'Erro ao gerar QR Code');
    }
}

let whatsappClient: Client | null = null;
let isConnecting = false;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

export interface WhatsAppStatus {
    connected: boolean;
    qrCode?: string;
    status: 'disconnected' | 'connecting' | 'connected';
    phoneNumber?: string;
    error?: string;
}

export interface WhatsAppMessage {
    id: string;
    from: string;
    to: string;
    body: string;
    timestamp: Date;
    isFromMe: boolean;
    contactName?: string;
}

export interface WhatsAppConversation {
    phoneNumber: string;
    contactName?: string;
    lastMessage: string;
    lastMessageTime: Date;
    unreadCount: number;
    restaurantId?: string;
    restaurantName?: string;
    funnelStage?: string;
}

// Inicializar cliente WhatsApp
export async function initializeWhatsApp(): Promise<WhatsAppStatus> {
    if (whatsappClient && connectionStatus === 'connected') {
        return {
            connected: true,
            status: 'connected',
            phoneNumber: whatsappClient.info?.wid?.user
        };
    }

    if (isConnecting) {
        return {
            connected: false,
            status: 'connecting'
        };
    }

    try {
        isConnecting = true;
        connectionStatus = 'connecting';

        whatsappClient = new Client({
            authStrategy: new LocalAuth({
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        return new Promise((resolve) => {
            whatsappClient!.on('qr', async (qr: string) => {
                try {
                    const qrCodeDataUrl = await generateQRCode(qr);
                    resolve({
                        connected: false,
                        status: 'connecting',
                        qrCode: qrCodeDataUrl
                    });
                } catch (error) {
                    resolve({
                        connected: false,
                        status: 'connecting',
                        error: 'Erro ao gerar QR Code'
                    });
                }
            });

            whatsappClient!.on('ready', () => {
                connectionStatus = 'connected';
                isConnecting = false;
                resolve({
                    connected: true,
                    status: 'connected',
                    phoneNumber: whatsappClient!.info?.wid?.user
                });
            });

            whatsappClient!.on('authenticated', () => {
                console.log('WhatsApp autenticado');
            });

            whatsappClient!.on('auth_failure', (msg: string) => {
                connectionStatus = 'disconnected';
                isConnecting = false;
                resolve({
                    connected: false,
                    status: 'disconnected',
                    error: msg || 'Falha na autenticação'
                });
            });

            whatsappClient!.on('disconnected', (reason: string) => {
                connectionStatus = 'disconnected';
                isConnecting = false;
                whatsappClient = null;
            });

            whatsappClient!.initialize();
        });
    } catch (error: any) {
        isConnecting = false;
        connectionStatus = 'disconnected';
        return {
            connected: false,
            status: 'disconnected',
            error: error.message || 'Erro ao inicializar WhatsApp'
        };
    }
}

// Obter status da conexão
export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
    if (whatsappClient && connectionStatus === 'connected') {
        return {
            connected: true,
            status: 'connected',
            phoneNumber: whatsappClient.info?.wid?.user
        };
    }

    return {
        connected: false,
        status: connectionStatus
    };
}

// Desconectar WhatsApp
export async function disconnectWhatsApp(): Promise<void> {
    if (whatsappClient) {
        await whatsappClient.logout();
        await whatsappClient.destroy();
        whatsappClient = null;
        connectionStatus = 'disconnected';
    }
}

// Enviar mensagem
export async function sendWhatsAppMessage(
    phoneNumber: string,
    message: string,
    restaurantId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!whatsappClient || connectionStatus !== 'connected') {
        return {
            success: false,
            error: 'WhatsApp não está conectado'
        };
    }

    try {
        // Formatar número (adicionar @c.us se necessário)
        const formattedNumber = phoneNumber.includes('@') 
            ? phoneNumber 
            : `${phoneNumber}@c.us`;

        const sentMessage = await whatsappClient.sendMessage(formattedNumber, message);

        // Salvar mensagem no banco
        if (restaurantId) {
            try {
                await prisma.$executeRaw`
                    INSERT INTO whatsapp_messages (
                        id, restaurant_id, phone_number, message, direction, 
                        message_id, created_at
                    )
                    VALUES (
                        gen_random_uuid(), ${restaurantId}::uuid, ${phoneNumber}, 
                        ${message}, 'outbound', ${sentMessage.id._serialized}, NOW()
                    )
                `;
            } catch (dbError) {
                console.warn('Erro ao salvar mensagem no banco:', dbError);
            }
        }

        return {
            success: true,
            messageId: sentMessage.id._serialized
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Erro ao enviar mensagem'
        };
    }
}

// Obter conversas
export async function getWhatsAppConversations(): Promise<WhatsAppConversation[]> {
    if (!whatsappClient || connectionStatus !== 'connected') {
        return [];
    }

    try {
        const chats = await whatsappClient.getChats();
        const conversations: WhatsAppConversation[] = [];

        for (const chat of chats.slice(0, 50)) { // Limitar a 50 conversas
            const contact = await chat.getContact();
            const messages = await chat.fetchMessages({ limit: 1 });
            const lastMessage = messages[0];

            // Tentar encontrar restaurante pelo número de telefone
            let restaurantId: string | undefined;
            let restaurantName: string | undefined;
            let funnelStage: string | undefined;

            try {
                const phoneNumber = contact.number.replace(/\D/g, '');
                const restaurant = await prisma.$queryRaw<any[]>`
                    SELECT r.id, r.name, r.status
                    FROM restaurants r
                    WHERE REPLACE(REPLACE(REPLACE(REPLACE(r.phone, ' ', ''), '-', ''), '(', ''), ')', '') = ${phoneNumber}
                    LIMIT 1
                `;

                if (restaurant && restaurant.length > 0) {
                    restaurantId = restaurant[0].id;
                    restaurantName = restaurant[0].name;
                    funnelStage = restaurant[0].status;
                }
            } catch (error) {
                console.warn('Erro ao buscar restaurante:', error);
            }

            conversations.push({
                phoneNumber: contact.number,
                contactName: contact.pushname || contact.name || contact.number,
                lastMessage: lastMessage?.body || '',
                lastMessageTime: lastMessage?.timestamp ? new Date(lastMessage.timestamp * 1000) : new Date(),
                unreadCount: chat.unreadCount,
                restaurantId,
                restaurantName,
                funnelStage
            });
        }

        return conversations.sort((a, b) => 
            b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
        );
    } catch (error) {
        console.error('Erro ao obter conversas:', error);
        return [];
    }
}

// Obter mensagens de uma conversa
export async function getWhatsAppMessages(
    phoneNumber: string,
    limit: number = 50
): Promise<WhatsAppMessage[]> {
    if (!whatsappClient || connectionStatus !== 'connected') {
        return [];
    }

    try {
        const formattedNumber = phoneNumber.includes('@') 
            ? phoneNumber 
            : `${phoneNumber}@c.us`;

        const chat = await whatsappClient.getChatById(formattedNumber);
        const messages = await chat.fetchMessages({ limit });

        return messages.map((msg: any) => ({
            id: msg.id._serialized,
            from: msg.from,
            to: msg.to,
            body: msg.body,
            timestamp: new Date(msg.timestamp * 1000),
            isFromMe: msg.fromMe,
            contactName: msg.notifyName || undefined
        })).reverse();
    } catch (error) {
        console.error('Erro ao obter mensagens:', error);
        return [];
    }
}

// Mover cliente para funil
export async function moveToFunnel(
    restaurantId: string,
    newStage: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.$executeRaw`
            UPDATE restaurants
            SET status = ${newStage}, updated_at = NOW()
            WHERE id = ${restaurantId}::uuid
        `;

        return { success: true };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Erro ao mover para funil'
        };
    }
}

