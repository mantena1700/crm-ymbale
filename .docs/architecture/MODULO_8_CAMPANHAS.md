# 📧 MÓDULO 8: CAMPANHAS E WORKFLOWS

## Objetivo
Implementar sistema completo de campanhas de marketing e workflows de automação.

## Passos de Implementação

### 1. Estrutura de Campanhas

**Modelo:**
```typescript
interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'linkedin';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  segmentCriteria: {
    status?: string[];
    salesPotential?: string[];
    sellerId?: string;
    region?: string;
  };
  subject?: string;
  content?: string;
  templateId?: string;
  scheduledAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  convertedCount: number;
}
```

### 2. Criar Campanha

**Arquivo:** `src/app/campaigns/actions.ts`

```typescript
export async function createCampaign(data: {
  name: string;
  type: string;
  segmentCriteria: any;
  subject?: string;
  content?: string;
  templateId?: string;
  scheduledAt?: string;
}) {
  'use server';
  
  // 1. Validar dados
  if (!data.name || !data.type) {
    throw new Error('Nome e tipo são obrigatórios');
  }
  
  // 2. Criar campanha
  const campaign = await prisma.campaign.create({
    data: {
      name: data.name,
      type: data.type,
      status: 'draft',
      segmentCriteria: data.segmentCriteria || {},
      subject: data.subject,
      content: data.content,
      templateId: data.templateId,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      totalRecipients: 0
    }
  });
  
  // 3. Calcular destinatários baseado na segmentação
  const recipients = await calculateRecipients(data.segmentCriteria);
  
  // 4. Criar registros de destinatários
  await prisma.campaignRecipient.createMany({
    data: recipients.map(r => ({
      campaignId: campaign.id,
      restaurantId: r.id,
      status: 'pending'
    }))
  });
  
  // 5. Atualizar total de destinatários
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { totalRecipients: recipients.length }
  });
  
  revalidatePath('/campaigns');
  
  return { success: true, campaignId: campaign.id };
}
```

### 3. Calcular Destinatários

```typescript
async function calculateRecipients(criteria: any) {
  const where: any = {};
  
  if (criteria.status && criteria.status.length > 0) {
    where.status = { in: criteria.status };
  }
  
  if (criteria.salesPotential && criteria.salesPotential.length > 0) {
    where.salesPotential = { in: criteria.salesPotential };
  }
  
  if (criteria.sellerId) {
    where.sellerId = criteria.sellerId;
  }
  
  if (criteria.region) {
    where.address = { path: ['city'], equals: criteria.region };
  }
  
  const restaurants = await prisma.restaurant.findMany({
    where,
    select: { id: true }
  });
  
  return restaurants;
}
```

### 4. Executar Campanha

```typescript
export async function executeCampaign(campaignId: string) {
  'use server';
  
  // 1. Buscar campanha
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      recipients: {
        where: { status: 'pending' },
        include: { restaurant: true }
      }
    }
  });
  
  if (!campaign) throw new Error('Campanha não encontrada');
  
  // 2. Atualizar status
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'active',
      startedAt: new Date()
    }
  });
  
  // 3. Para cada destinatário
  for (const recipient of campaign.recipients) {
    try {
      // 3.1. Substituir variáveis no conteúdo
      const content = replaceVariables(campaign.content || '', recipient.restaurant);
      const subject = replaceVariables(campaign.subject || '', recipient.restaurant);
      
      // 3.2. Enviar (integração com serviço de email/SMS)
      if (campaign.type === 'email') {
        await sendEmail({
          to: recipient.restaurant.address?.email || '',
          subject: subject,
          body: content
        });
      }
      
      // 3.3. Atualizar status do destinatário
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'sent',
          sentAt: new Date()
        }
      });
      
      // 3.4. Atualizar contadores da campanha
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          sentCount: { increment: 1 }
        }
      });
      
    } catch (error) {
      console.error(`Erro ao enviar para ${recipient.restaurant.name}:`, error);
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: 'bounced' }
      });
    }
  }
  
  // 4. Finalizar campanha
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'completed',
      endedAt: new Date()
    }
  });
  
  revalidatePath('/campaigns');
  
  return { success: true };
}
```

### 5. Substituição de Variáveis

```typescript
function replaceVariables(template: string, restaurant: Restaurant): string {
  const variables: Record<string, string> = {
    '{{nome}}': restaurant.name,
    '{{cidade}}': restaurant.address?.city || '',
    '{{bairro}}': restaurant.address?.neighborhood || '',
    '{{rating}}': String(restaurant.rating || 0),
    '{{avaliacoes}}': String(restaurant.reviewCount || 0),
    '{{potencial}}': restaurant.salesPotential || 'N/A'
  };
  
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(key, 'g'), value);
  }
  
  return result;
}
```

### 6. Templates de Email

**Estrutura:**
```typescript
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string; // HTML
  variables: string[]; // ['nome', 'cidade', 'rating']
  category: 'prospecting' | 'follow_up' | 're_engagement' | 'custom';
  isDefault: boolean;
}
```

**Criar Template:**
```typescript
export async function createEmailTemplate(data: {
  name: string;
  subject: string;
  content: string;
  category: string;
  variables?: string[];
}) {
  'use server';
  
  const template = await prisma.emailTemplate.create({
    data: {
      name: data.name,
      subject: data.subject,
      content: data.content,
      category: data.category,
      variables: data.variables || [],
      isDefault: false
    }
  });
  
  revalidatePath('/campaigns');
  
  return { success: true, templateId: template.id };
}
```

### 7. Workflows (Automações)

**Estrutura:**
```typescript
interface Workflow {
  id: string;
  name: string;
  triggerType: 'status_change' | 'new_lead' | 'no_contact_days' | 'rating_threshold' | 'manual';
  triggerConditions: {
    status?: string;
    days?: number;
    rating?: number;
  };
  steps: Array<{
    type: 'send_email' | 'create_followup' | 'update_status' | 'assign_seller' | 'create_note';
    delay: number; // dias
    config: any;
  }>;
  active: boolean;
}
```

### 8. Executar Workflow

**Arquivo:** `src/app/campaigns/workflow-actions.ts`

```typescript
export async function executeWorkflow(workflowId: string, restaurantId: string) {
  'use server';
  
  // 1. Buscar workflow
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId }
  });
  
  if (!workflow || !workflow.active) {
    throw new Error('Workflow não encontrado ou inativo');
  }
  
  // 2. Verificar condições do trigger
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId }
  });
  
  if (!restaurant) throw new Error('Restaurante não encontrado');
  
  if (!checkTriggerConditions(workflow, restaurant)) {
    return { success: false, reason: 'Condições do trigger não atendidas' };
  }
  
  // 3. Criar execução do workflow
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId: workflowId,
      restaurantId: restaurantId,
      status: 'running',
      currentStep: 0,
      stepsCompleted: []
    }
  });
  
  // 4. Executar steps
  const steps = workflow.steps as any[];
  const completedSteps: any[] = [];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    try {
      // Aguardar delay (em produção, usar job queue)
      if (step.delay && step.delay > 0) {
        // Por enquanto, apenas registrar
        console.log(`Delay de ${step.delay} dias para step ${i}`);
      }
      
      // Executar ação
      switch (step.type) {
        case 'send_email':
          // Integrar com serviço de email
          break;
        
        case 'create_followup':
          await prisma.followUp.create({
            data: {
              restaurantId: restaurantId,
              type: 'email',
              scheduledDate: new Date(Date.now() + (step.delay || 0) * 24 * 60 * 60 * 1000),
              notes: step.config?.notes || 'Follow-up automático do workflow'
            }
          });
          break;
        
        case 'update_status':
          await prisma.restaurant.update({
            where: { id: restaurantId },
            data: { status: step.config?.status || 'Contatado' }
          });
          break;
        
        case 'assign_seller':
          if (step.config?.sellerId) {
            await prisma.restaurant.update({
              where: { id: restaurantId },
              data: {
                sellerId: step.config.sellerId,
                assignedAt: new Date()
              }
            });
          }
          break;
        
        case 'create_note':
          await prisma.note.create({
            data: {
              restaurantId: restaurantId,
              content: step.config?.content || 'Nota automática do workflow'
            }
          });
          break;
      }
      
      completedSteps.push({ step: i, completedAt: new Date() });
      
      // Atualizar execução
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          currentStep: i + 1,
          stepsCompleted: completedSteps
        }
      });
      
    } catch (error) {
      console.error(`Erro ao executar step ${i}:`, error);
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          errorMessage: error.message
        }
      });
      throw error;
    }
  }
  
  // 5. Finalizar execução
  await prisma.workflowExecution.update({
    where: { id: execution.id },
    data: {
      status: 'completed',
      completedAt: new Date()
    }
  });
  
  return { success: true };
}

function checkTriggerConditions(workflow: Workflow, restaurant: Restaurant): boolean {
  const conditions = workflow.triggerConditions;
  
  if (workflow.triggerType === 'status_change' && conditions.status) {
    return restaurant.status === conditions.status;
  }
  
  if (workflow.triggerType === 'new_lead') {
    // Verificar se é novo (criado nas últimas 24h)
    const createdAt = new Date(restaurant.createdAt || 0);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 24;
  }
  
  if (workflow.triggerType === 'no_contact_days' && conditions.days) {
    // Verificar última visita/follow-up
    // Implementar lógica
    return true;
  }
  
  if (workflow.triggerType === 'rating_threshold' && conditions.rating) {
    return (restaurant.rating || 0) >= conditions.rating;
  }
  
  return false;
}
```

### 9. Interface de Campanhas

**Funcionalidades:**
- Listar campanhas
- Criar nova campanha
- Editar campanha
- Executar campanha
- Ver métricas
- Duplicar campanha
- Cancelar campanha

### 10. Interface de Workflows

**Funcionalidades:**
- Listar workflows
- Criar workflow
- Editar workflow
- Ativar/desativar
- Executar manualmente
- Ver histórico de execuções

## Integrações Necessárias

1. **Serviço de Email:**
   - SendGrid, Mailgun, AWS SES, etc.
   - Configurar SMTP ou API

2. **Serviço de SMS (Opcional):**
   - Twilio, etc.

3. **Job Queue (Para Delays):**
   - Bull, Agenda.js, etc.

## Testes

1. Criar campanha
2. Segmentar destinatários
3. Executar campanha
4. Ver métricas
5. Criar workflow
6. Executar workflow
7. Verificar triggers automáticos

## Próximo Passo

Após concluir todos os módulos, seguir para: **TESTES FINAIS E DEPLOY**
