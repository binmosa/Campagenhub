import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { toPublicUser } from '../users/public-user';

/** Task rows carry two User relations — strip them to their public shape. */
const sanitizeTask = (task: any): any =>
  task
    ? {
        ...task,
        assignedBy: toPublicUser(task.assignedBy),
        assignedTo: toPublicUser(task.assignedTo),
        campaign: task.campaign ? { id: task.campaign.id, title: task.campaign.title, platform: task.campaign.platform, cover_image: task.campaign.cover_image, status: task.campaign.status } : task.campaign ?? null,
      }
    : task;

@Controller('api/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  async create(@Request() req: any, @Body() body: { contract_id: string; title: string; description?: string; assigned_to: string | string[]; due_date?: string; campaign_id?: string | null; platform?: string | null }) {
    return this.tasksService.createTask(req.user.userId, body);
  }

  @Get('mine')
  async getMyTasks(@Request() req: any) {
    return (await this.tasksService.getMyTasks(req.user.userId)).map(sanitizeTask);
  }

  @Get('assigned')
  async getAssignedByMe(@Request() req: any) {
    return (await this.tasksService.getAssignedByMe(req.user.userId)).map(sanitizeTask);
  }

  @Get('contract/:contractId')
  async getForContract(@Request() req: any, @Param('contractId') contractId: string) {
    return (await this.tasksService.getTasksForContract(req.user.userId, contractId)).map(sanitizeTask);
  }

  @Get('progress')
  async getTeamProgress(@Request() req: any) {
    return this.tasksService.getTeamProgress(req.user.userId);
  }

  @Patch(':id')
  async updateStatus(@Request() req: any, @Param('id') id: string, @Body() body: { status: string; post_link?: string }) {
    return this.tasksService.updateTaskStatus(req.user.userId, id, body.status, body.post_link);
  }

  @Delete(':id')
  async deleteTask(@Request() req: any, @Param('id') id: string) {
    return this.tasksService.deleteTask(req.user.userId, id);
  }

}
