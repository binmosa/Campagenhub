import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './message.entity';
import { Application } from '../applications/application.entity';
import { Invitation } from '../invitations/invitation.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messagesRepo: Repository<Message>,
    @InjectRepository(Application)
    private applicationsRepo: Repository<Application>,
    @InjectRepository(Invitation)
    private invitationsRepo: Repository<Invitation>,
    private notificationsService: NotificationsService,
  ) {}

  async getMessagesForApplication(userId: string, contextId: string): Promise<Message[]> {
    // Check if it's an application
    const application = await this.applicationsRepo.findOne({
      where: { id: contextId },
      relations: ['creator', 'campaign', 'campaign.brand']
    });

    if (application) {
      if (application.creator.id !== userId && application.campaign.brand.id !== userId) {
        throw new BadRequestException('You do not have permission to view these messages');
      }

      const otherUserId = application.creator.id === userId ? application.campaign.brand.id : application.creator.id;

      // Mark unread messages from this user as read
      await this.messagesRepo.update(
        { sender: { id: otherUserId }, receiver: { id: userId }, is_read: false },
        { is_read: true }
      );

      return this.messagesRepo.find({
        where: [
          { sender: { id: userId }, receiver: { id: otherUserId } },
          { sender: { id: otherUserId }, receiver: { id: userId } },
        ],
        relations: ['sender', 'receiver'],
        order: { created_at: 'ASC' },
      });
    }

    // Check if it's an invitation
    const invitation = await this.invitationsRepo.findOne({
      where: { id: contextId },
      relations: ['sender', 'receiver']
    });

    if (invitation) {
      if (invitation.sender.id !== userId && invitation.receiver.id !== userId) {
        throw new BadRequestException('You do not have permission to view these messages');
      }

      const otherUserId = invitation.sender.id === userId ? invitation.receiver.id : invitation.sender.id;

      // Mark unread messages from this user as read
      await this.messagesRepo.update(
        { sender: { id: otherUserId }, receiver: { id: userId }, is_read: false },
        { is_read: true }
      );

      return this.messagesRepo.find({
        where: [
          { sender: { id: userId }, receiver: { id: otherUserId } },
          { sender: { id: otherUserId }, receiver: { id: userId } },
        ],
        relations: ['sender', 'receiver'],
        order: { created_at: 'ASC' },
      });
    }

    throw new BadRequestException('Chat context not found');
  }

  async sendMessage(senderId: string, contextId: string, content: string): Promise<Message> {
    // Try Application context
    const application = await this.applicationsRepo.findOne({
      where: { id: contextId },
      relations: ['creator', 'campaign', 'campaign.brand']
    });

    if (application) {
      const isBrand = application.campaign.brand.id === senderId;
      const isCreator = application.creator.id === senderId;
      if (!isBrand && !isCreator) throw new BadRequestException('Not authorized');
      const receiverId = isBrand ? application.creator.id : application.campaign.brand.id;

      const message = this.messagesRepo.create({
        content,
        sender: { id: senderId },
        receiver: { id: receiverId },
        applicationContext: { id: contextId },
      });
      const savedMsg = await this.messagesRepo.save(message);
      await this.notificationsService.createNotification(receiverId, 'NEW_MESSAGE', `New message for campaign: ${application.campaign.title}`, contextId);
      return savedMsg;
    }

    // Try Invitation context
    const invitation = await this.invitationsRepo.findOne({
      where: { id: contextId },
      relations: ['sender', 'receiver']
    });

    if (invitation) {
      const isSender = invitation.sender.id === senderId;
      const isReceiver = invitation.receiver.id === senderId;
      if (!isSender && !isReceiver) throw new BadRequestException('Not authorized');
      const receiverId = isSender ? invitation.receiver.id : invitation.sender.id;

      const message = this.messagesRepo.create({
        content,
        sender: { id: senderId },
        receiver: { id: receiverId },
        invitationContext: { id: contextId },
      });
      const savedMsg = await this.messagesRepo.save(message);
      await this.notificationsService.createNotification(receiverId, 'NEW_MESSAGE', `New negotiation message regarding invitation`, contextId);
      return savedMsg;
    }

    throw new BadRequestException('Chat context not found');
  }
  async getConversations(userId: string): Promise<any[]> {
    const rawMessages = await this.messagesRepo
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('sender.creatorProfile', 'senderCreator')
      .leftJoinAndSelect('sender.brandProfile', 'senderBrand')
      .leftJoinAndSelect('message.receiver', 'receiver')
      .leftJoinAndSelect('receiver.creatorProfile', 'receiverCreator')
      .leftJoinAndSelect('receiver.brandProfile', 'receiverBrand')
      .where('message.sender_id = :userId OR message.receiver_id = :userId', { userId })
      .orderBy('message.created_at', 'DESC')
      .getMany();

    const convoMap = new Map<string, any>();
    
    for (const msg of rawMessages) {
      const isSenderMe = msg.sender.id === userId;
      const otherUser = isSenderMe ? msg.receiver : msg.sender;
      if (!convoMap.has(otherUser.id)) {
        convoMap.set(otherUser.id, {
          id: otherUser.id,
          name: otherUser.creatorProfile?.full_name || otherUser.brandProfile?.company_name || otherUser.email,
          email: otherUser.email,
          avatar: otherUser.creatorProfile?.avatar_url || otherUser.brandProfile?.logo_url,
          lastMessage: msg.content,
          time: msg.created_at,
          unread: (!isSenderMe && !msg.is_read) ? 1 : 0
        });
      } else if (!isSenderMe && !msg.is_read) {
        // accumulate unread count
        const existing = convoMap.get(otherUser.id);
        existing.unread++;
      }
    }

    return Array.from(convoMap.values());
  }

  async getDirectMessages(userId: string, otherUserId: string): Promise<Message[]> {
    // Mark messages from the other user as read
    await this.messagesRepo.update(
      { sender: { id: otherUserId }, receiver: { id: userId }, is_read: false },
      { is_read: true }
    );

    return this.messagesRepo
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.receiver', 'receiver')
      .where('(message.sender_id = :userId AND message.receiver_id = :otherUserId)', { userId, otherUserId })
      .orWhere('(message.sender_id = :otherUserId AND message.receiver_id = :userId)', { userId, otherUserId })
      .orderBy('message.created_at', 'ASC')
      .getMany();
  }

  async sendDirectMessage(senderId: string, receiverId: string, content: string): Promise<Message> {
    const message = this.messagesRepo.create({
      content,
      sender: { id: senderId },
      receiver: { id: receiverId },
    });
    const saved = await this.messagesRepo.save(message);

    await this.notificationsService.createNotification(
      receiverId,
      'NEW_MESSAGE',
      'You have a new direct message.',
      senderId
    );

    return saved;
  }
}
