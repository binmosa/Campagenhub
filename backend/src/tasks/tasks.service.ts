import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Contract } from '../contracts/contract.entity';
import { Task } from './task.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepo: Repository<Task>,
    @InjectRepository(Contract)
    private contractsRepo: Repository<Contract>,
    private notificationsService: NotificationsService,
  ) {}

  async createTask(
    userId: string,
    data: { contract_id: string; title: string; description?: string; assigned_to: string | string[]; due_date?: string; campaign_id?: string | null; platform?: string | null },
  ): Promise<Task | Task[]> {
    const assignees = Array.isArray(data.assigned_to) ? data.assigned_to : [data.assigned_to];
    const savedTasks = [];
    if (!data.title || !String(data.title).trim()) throw new BadRequestException('Give the task a title.');

    // Tasks live under the campaign the contract was signed for.
    let campaignId: string | null = data.campaign_id || null;
    let applicationId: string | null = null;
    if (data.contract_id) {
      const contract = await this.contractsRepo.findOne({ where: { id: data.contract_id }, relations: ['application', 'application.campaign'] });
      if (contract?.application) {
        applicationId = contract.application.id;
        campaignId = campaignId || contract.application.campaign?.id || null;
      }
    }

    for (const assigneeId of assignees) {
      const task = this.tasksRepo.create({
        contract_id: data.contract_id,
        campaign: campaignId ? ({ id: campaignId } as any) : null,
        application_id: applicationId,
        platform: data.platform ? String(data.platform).slice(0, 40) : null,
        source: 'manual',
        title: String(data.title).trim().slice(0, 200),
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
      relations: ['assignedBy', 'assignedTo', 'campaign'],
      order: { created_at: 'DESC' },
    });
  }

  async getMyTasks(userId: string): Promise<Task[]> {
    return this.tasksRepo.find({
      where: { assignedTo: { id: userId } },
      relations: ['assignedBy', 'assignedTo', 'campaign'],
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
      relations: ['assignedBy', 'assignedTo', 'campaign'],
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

    // Who may do what: the creator starts, submits, withdraws or changes a link
    // until the brand approves; the brand approves, sends back or resets.
    // Approved work is locked for everyone.
    const isAssignee = task.assignedTo?.id === userId;
    if (task.status === 'reviewed') throw new BadRequestException('This task was approved and is locked.');
    if (isAssignee && !['in_progress', 'completed'].includes(status)) {
      throw new BadRequestException('Creators can start a task, submit a link, or withdraw a submission.');
    }
    if (!isAssignee && !['pending', 'in_progress', 'reviewed'].includes(status)) {
      throw new BadRequestException('Brands can approve, send back, or reset a task.');
    }
    if (!isAssignee && postLink !== undefined && postLink !== task.post_link) {
      throw new BadRequestException('Only the creator can change the submitted link.');
    }

    task.status = status;
    if (postLink !== undefined) {
      task.post_link = postLink || null;
    }
    await this.tasksRepo.save(task);

    // Notify the other party
    const notifyId = task.assignedTo.id === userId ? task.assignedBy.id : task.assignedTo.id;
    const label: Record<string, string> = { pending: 'moved back to to-do', in_progress: 'started', completed: 'submitted for review', reviewed: 'approved' };
    let notifMsg = `Task "${task.title}" was ${label[status] || `set to ${status}`}.`;
    if (postLink) notifMsg = `${task.assignedTo?.email?.split('@')[0] || 'The creator'} submitted a link for "${task.title}" — open your workspace to review and approve it.`;

    await this.notificationsService.createNotification(
      notifyId,
      'TASK_UPDATED',
      notifMsg,
      taskId,
    );

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
    if (task.status !== 'pending') {
      throw new BadRequestException('Only tasks nobody has started can be deleted. Submitted work can be withdrawn by the creator; approved work is locked.');
    }
    await this.tasksRepo.remove(task);
  }
}
