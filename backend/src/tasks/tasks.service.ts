import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Task } from './task.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepo: Repository<Task>,
    private notificationsService: NotificationsService,
    private aiService: AiService,
  ) {}

  async createTask(userId: string, data: { contract_id: string; title: string; description?: string; assigned_to: string | string[]; due_date?: string }): Promise<Task | Task[]> {
    const assignees = Array.isArray(data.assigned_to) ? data.assigned_to : [data.assigned_to];
    const savedTasks = [];

    for (const assigneeId of assignees) {
      const task = this.tasksRepo.create({
        contract_id: data.contract_id,
        title: data.title,
        description: data.description || undefined,
        assignedBy: { id: userId } as any,
        assignedTo: { id: assigneeId } as any,
        due_date: data.due_date ? new Date(data.due_date) : undefined,
        status: 'pending',
      });
      const saved = await this.tasksRepo.save(task as any);
      savedTasks.push(saved);

      await this.notificationsService.createNotification(
        assigneeId,
        'TASK_ASSIGNED',
        `New task assigned: "${data.title}"`,
        (saved as any).id,
      );
    }

    return savedTasks.length === 1 ? (savedTasks[0] as any) : (savedTasks as any);
  }

  async getTasksForContract(userId: string, contractId: string): Promise<Task[]> {
    return this.tasksRepo.find({
      where: { contract_id: contractId },
      relations: ['assignedBy', 'assignedTo'],
      order: { created_at: 'DESC' },
    });
  }

  async getMyTasks(userId: string): Promise<Task[]> {
    return this.tasksRepo.find({
      where: { assignedTo: { id: userId } },
      relations: ['assignedBy', 'assignedTo'],
      order: { created_at: 'DESC' },
    });
  }

  async getAssignedByMe(userId: string): Promise<Task[]> {
    // 1. Get all invitation IDs for this brand
    const invitations = await this.tasksRepo.manager.query(
      'SELECT id FROM invitations WHERE brand_id = $1 OR sender_id = $1',
      [userId]
    );
    const invIds = invitations.map((i: any) => i.id);

    // 2. Get all contract IDs for this brand's campaigns
    const contracts = await this.tasksRepo.manager.query(
      `SELECT c.id FROM contracts c 
       INNER JOIN applications a ON a.id = c.application_id 
       INNER JOIN campaigns camp ON camp.id = a.campaign_id 
       WHERE camp.brand_id = $1`,
      [userId]
    );
    const contIds = contracts.map((c: any) => c.id);

    const allContextIds = [...new Set([...invIds, ...contIds])];

    const where: any[] = [{ assignedBy: { id: userId } }];
    if (allContextIds.length > 0) {
      where.push({ contract_id: In(allContextIds) });
    }

    // 3. Find tasks where user is assigner OR linked to these contexts
    return this.tasksRepo.find({
      where,
      relations: ['assignedBy', 'assignedTo'],
      order: { created_at: 'DESC' },
    });
  }

  async updateTaskStatus(userId: string, taskId: string, status: string, postLink?: string): Promise<Task> {
    const task = await this.tasksRepo.findOne({
      where: { id: taskId },
      relations: ['assignedTo', 'assignedBy'],
    });
    if (!task) throw new BadRequestException('Task not found');
    
    let authorized = false;
    if (task.assignedTo?.id === userId || task.assignedBy?.id === userId) {
      authorized = true;
    } else if (task.contract_id) {
      // Check if user is associated with the contract/invitation
      const invCount = await this.tasksRepo.manager.query(
        'SELECT count(id) FROM invitations WHERE id = $1 AND (brand_id = $2 OR sender_id = $2)',
        [task.contract_id, userId]
      );
      if (parseInt(invCount[0].count) > 0) authorized = true;
      else {
        const contCount = await this.tasksRepo.manager.query(
          `SELECT count(c.id) FROM contracts c 
           INNER JOIN applications a ON a.id = c.application_id 
           INNER JOIN campaigns camp ON camp.id = a.campaign_id 
           WHERE c.id = $1 AND camp.brand_id = $2`,
          [task.contract_id, userId]
        );
        if (parseInt(contCount[0].count) > 0) authorized = true;
      }
    }

    if (!authorized) {
      throw new BadRequestException('Unauthorized');
    }

    task.status = status;
    if (postLink !== undefined) {
      task.post_link = postLink;
    }
    await this.tasksRepo.save(task);

    const finalLink = postLink || task.post_link;

    // If it's a new link submission OR marking as completed, run AI asynchronously
    if (finalLink && (status === 'completed' || status === 'reviewed')) {
      this.aiService.analyzePostLink(finalLink, task.title).then(review => {
        if (review) {
          this.setAiReview(taskId, review);
        }
      }).catch(e => console.error('[Tasks] AI Analysis failed:', e.message));
    }

    // Notify the other party
    const notifyId = task.assignedTo.id === userId ? task.assignedBy.id : task.assignedTo.id;
    let notifMsg = `Task "${task.title}" status changed to ${status}`;
    if (postLink) notifMsg = `Content submitted for task "${task.title}". 🤖 AI bot is actively watching.`;

    await this.notificationsService.createNotification(
      notifyId,
      'TASK_UPDATED',
      notifMsg,
      taskId,
    );

    return task;
  }

  async setAiReview(taskId: string, review: string): Promise<void> {
    await this.tasksRepo.update(taskId, { ai_review: review });
  }

  async reanalyzeTask(userId: string, taskId: string): Promise<Task> {
    const task = await this.tasksRepo.findOne({
      where: { id: taskId },
      relations: ['assignedTo', 'assignedBy'],
    });
    if (!task) throw new BadRequestException(`Task ${taskId} not found`);
    // Check permissions
    let authorized = false;
    if (task.assignedTo?.id === userId || task.assignedBy?.id === userId) {
      authorized = true;
    } else if (task.contract_id) {
      // Check if user is associated with the contract/invitation
      const invCount = await this.tasksRepo.manager.query(
        'SELECT count(id) FROM invitations WHERE id = $1 AND (brand_id = $2 OR sender_id = $2)',
        [task.contract_id, userId]
      );
      if (parseInt(invCount[0].count) > 0) authorized = true;
      else {
        const contCount = await this.tasksRepo.manager.query(
          `SELECT count(c.id) FROM contracts c 
           INNER JOIN applications a ON a.id = c.application_id 
           INNER JOIN campaigns camp ON camp.id = a.campaign_id 
           WHERE c.id = $1 AND camp.brand_id = $2`,
          [task.contract_id, userId]
        );
        if (parseInt(contCount[0].count) > 0) authorized = true;
      }
    }

    if (!authorized) {
      throw new BadRequestException(`Unauthorized: You are not assigned to or managing task ${taskId}`);
    }

    if (!task.post_link) {
      throw new BadRequestException(`No post link found in database for task ${taskId}. Please submit a link first.`);
    }

    // Clear old review, run fresh analysis
    task.ai_review = '🔄 Re-analyzing...';
    await this.tasksRepo.save(task);

    this.aiService.analyzePostLink(task.post_link, task.title).then(review => {
      this.setAiReview(taskId, review);
    }).catch(e => {
      console.error('[Tasks] Re-analysis failed:', e.message);
      this.setAiReview(taskId, '❌ Re-analysis failed: ' + e.message);
    });

    return task;
  }

  async getTeamProgress(userId: string): Promise<any> {
    const tasks = await this.tasksRepo.find({
      where: { assignedBy: { id: userId } },
      relations: ['assignedTo'],
    });

    // Group by assigned user
    const byUser: Record<string, { email: string; total: number; completed: number; pending: number; in_progress: number }> = {};
    for (const t of tasks) {
      const uid = t.assignedTo?.id || 'unknown';
      if (!byUser[uid]) {
        byUser[uid] = { email: t.assignedTo?.email || 'Unknown', total: 0, completed: 0, pending: 0, in_progress: 0 };
      }
      byUser[uid].total++;
      if (t.status === 'completed' || t.status === 'reviewed') byUser[uid].completed++;
      else if (t.status === 'in_progress') byUser[uid].in_progress++;
      else byUser[uid].pending++;
    }

    return {
      total_tasks: tasks.length,
      completed: tasks.filter(t => t.status === 'completed' || t.status === 'reviewed').length,
      team_breakdown: Object.entries(byUser).map(([id, data]) => ({ user_id: id, ...data })),
    };
  }

  async deleteTask(userId: string, taskId: string): Promise<void> {
    const task = await this.tasksRepo.findOne({ where: { id: taskId }, relations: ['assignedBy'] });
    if (!task) throw new BadRequestException('Task not found');
    if (task.assignedBy.id !== userId) throw new BadRequestException('Only the assigner can delete tasks');
    await this.tasksRepo.remove(task);
  }
}
