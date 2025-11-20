import { Module } from '@nestjs/common';
import { MessageRepository } from './repositories/messages.repository';
import { MessagesService } from './messages.service';
import { ProductsService } from '../products/products.service';
import { ProductsRepository } from '../products/repositories/products.repository';
import { MessagesController } from './messages.controller';

@Module({
  providers: [
    MessageRepository,
    MessagesService,
    ProductsRepository,
    ProductsService,
  ],
  controllers: [MessagesController],
})
export class MessagesModule {}
