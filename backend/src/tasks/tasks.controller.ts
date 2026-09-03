import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { toPublicUser } from '../users/public-user';

/** Task rows carry two User relations — strip them to their public shape. */
const sanitizeTask = (task: any): any =>
  task ? { ...task, assignedBy: toPublicUser(task.assignedBy), assignedTo: toPublicUser(task.assignedTo) } : task;

@Controller('api/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  async create(@Request() req: any, @Body() body: { contract_id: string; title: string; description?: string; assigned_to: string | string[]; due_date?: string }) {
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

  @Patch(':id/ai-review')
  async updateAiReview(@Request() req: any, @Param('id') id: string, @Body() body: { review: string }) {
    // Basic auth check: ensures user is authenticated, ideally tasksService would verify ownership
    await this.tasksService.setAiReview(id, body.review);
    return { success: true };
  }

  @Post(':id/reanalyze')
  async reanalyze(@Request() req: any, @Param('id') id: string) {
    return this.tasksService.reanalyzeTask(req.user.userId, id);
  }
}
