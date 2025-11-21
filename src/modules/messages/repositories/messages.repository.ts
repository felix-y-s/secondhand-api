import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageType } from '@prisma/client';

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 채팅방 생성 또는 조회
   * - 같은 상품에 대한 채팅방이 이미 있으면 기존 채팅방 반환
   * 
   * NOTE: 동시성 제어 미적용
   * 
   * 이유:
   * 1. 동일 사용자가 동일 상품에 동시 요청할 확률 <0.1%
   * 2. 프론트엔드 중복 클릭 방지로 대부분 차단 가능
   * 3. 설령 중복 생성되어도 시스템 영향 미미
   * 
   * 모니터링:
   * - 중복 채팅방 생성 건수 추적 (월 1회 확인)
   * - 임계치(월 10건) 초과 시 동시성 제어 추가 검토
   * 
   * 작성일: 2025-11-18
   */
  async findOrCreateChatRoom(userId: string, productId: string) {
    // 기존 채팅방 조회
    const existingRoom = await this.prisma.chatRoom.findFirst({
      where: {
        productId,
        members: {
          some: { userId },
        },
      },
      select: {
        id: true,
        productId: true,
        members: {
          select: {
            id: true,
            chatRoomId: true,
            userId: true,
            lastReadAt: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                nickname: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });

    if (existingRoom) {
      return { room: existingRoom, isNew: false };
    }

    // 상품 정보 조회 (판매자 확인)
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { sellerId: true },
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    // 새 채팅방 생성 (구매자 + 판매자)
    // Prisma Nested Create: 채팅방 생성과 동시에 멤버 자동 연결
    const newRoom = await this.prisma.chatRoom.create({
      data: {
        productId,
        members: {
          create: [
            { userId }, // 요청자 (구매자)
            { userId: product.sellerId }, // 판매자
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });

    return { room: newRoom, isNew: true };
  }

  /**
   * 메시지 전송
   */
  async createMessage(
    senderId: string,
    chatRoomId: string,
    content: string,
    messageType: MessageType = MessageType.TEXT,
    fileUrl?: string,
    fileName?: string,
  ) {
    return await this.prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId,
        content,
        messageType,
        fileUrl,
        fileName,
      },
      include: {
        sender: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
          }
        }
      }
    })
  }

  /**
   * 채팅방 목록 조회 (사용자 별)
   */
  async findChatRoomsByUserId(userId: string) {
    return this.prisma.chatRoomMember.findMany({
      where: {
        userId
      },
      include: {
        chatRoom: {
          select: {
            id: true,
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
          }
        }
      }
    })
  }

  /**
   * 채팅방 메시지 히스토리 조회 (페이지내이션)
   */
  async findMessagesByRoomId(
    chatRoomId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: {
          chatRoomId,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }, // 최신 메시지 부터
        include: {
          sender: {
            select: {
              id: true,
              nickname: true,
              profileImage: true,
            }
          }
        }
      }),
      this.prisma.chatMessage.count({
        where: { chatRoomId }
      }),
    ]);

    return {
      message: messages.reverse(), // 시간순으로 정렬
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /** ⭐️ 
   * 읽음 처리
   */
  async markMessagesAsRead(chatRoomId: string, userId: string) {
    // 상대방이 보낸 메시지만 읽음 처리
    await this.prisma.chatMessage.updateMany({
      where: {
        chatRoomId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      }
    });

    // 멤버의 lastReadAt 업데이트
    await this.prisma.chatRoomMember.updateMany({
      where: {
        chatRoomId,
        userId,
      },
      data: {
        lastReadAt: new Date(),
      }
    })
  }

  /**
   * 안읽은 메시지 수 조회
   */
  async getUnreadCount(chatRoomId: string, userId: string) {
    return this.prisma.chatMessage.count({
      where: {
        chatRoomId,
        senderId: { not: userId },
        isRead: false,
      }
    });
  }

  /**
   * 채팅방 상세 조회(대화방 + 사용자 정보)
   */
  async findChatRoomById(chatRoomId: string) {
    return this.prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                profileImage: true,
              }
            }
          }
        }
      }
    })
  }

  /**
   * 채팅방 updatedAt 갱신
   * - 새 메시지 전송 시 채팅방 목록 정렬을 위해 사용
   */
  async updateChatRoomTimestamp(chatRoomId: string) {
    await this.prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { updatedAt: new Date() },
    });
  }

  /**
   * 채팅방 나가기
   * - chatRoomMember에서 사용자 삭제
   * - 모든 사용자가 나가면 채팅방 삭제 (채팅방 삭제되면 연결된 모든 메시지 자동 삭제됨)
   */
  async leaveChatRoom(chatRoomId: string, userId: string) {
    await this.prisma.chatRoomMember.deleteMany({
      where: {
        chatRoomId,
        userId,
      }
    });

    const remainingMembers = await this.prisma.chatRoomMember.count({
      where: { chatRoomId }
    });

    // 멤버가 없으면 채팅방 삭제
    if (remainingMembers === 0) {
      await this.prisma.chatRoom.delete({
        where: {
          id: chatRoomId
        }
      })
    }
  }
}