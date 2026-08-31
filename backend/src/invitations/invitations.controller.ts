import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/invitations')
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly svc: InvitationsService) {}

  @Post()
  send(@Request() req: any, @Body() body: any) {
    return this.svc.sendInvitation(req.user.userId, body);
  }

  @Get('received')
  received(@Request() req: any) {
    return this.svc.getReceived(req.user.userId);
  }

  @Get('sent')
  sent(@Request() req: any) {
    return this.svc.getSent(req.user.userId);
  }

  @Get('team')
  team(@Request() req: any) {
    return this.svc.getMyTeam(req.user.userId);
  }

  @Get('pending-approvals')
  pendingApprovals(@Request() req: any) {
    return this.svc.getPendingApprovals(req.user.userId);
  }

  @Get('check/:receiverId')
  checkStatus(@Request() req: any, @Param('receiverId') receiverId: string) {
    return this.svc.checkStatus(req.user.userId, receiverId);
  }

  @Get(':id')
  getOne(@Request() req: any, @Param('id') id: string) {
    return this.svc.findOne(req.user.userId, id);
  }

  @Patch(':id/accept')
  accept(@Request() req: any, @Param('id') id: string) {
    return this.svc.accept(req.user.userId, id);
  }

  @Patch(':id/decline')
  decline(@Request() req: any, @Param('id') id: string) {
    return this.svc.decline(req.user.userId, id);
  }

  @Patch(':id/negotiate')
  negotiate(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.negotiateInvitation(req.user.userId, id, body);
  }

  @Patch(':id/approve-payment')
  approvePayment(@Request() req: any, @Param('id') id: string) {
    return this.svc.approvePayment(req.user.userId, id);
  }

  @Patch('team/:id/permissions')
  updatePermissions(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updatePermissions(req.user.userId, id, body.permissions);
  }

  @Patch('team/:id/payment-terms')
  updatePaymentTerms(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updatePaymentTerms(req.user.userId, id, body);
  }

  @Delete(':id/cancel')
  cancel(@Request() req: any, @Param('id') id: string) {
    return this.svc.cancel(req.user.userId, id);
  }

  @Delete('team/:id')
  removeMember(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.removeMember(req.user.userId, id, body?.reason);
  }
}
