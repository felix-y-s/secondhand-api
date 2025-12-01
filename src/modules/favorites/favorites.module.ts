import { Module } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesRepository } from './repositories/favorites.repository';
import { FavoritesService } from './favorites.service';
import { ProductsModule } from '../products/products.module';
import { ProductsService } from '../products/products.service';
import { ProductsRepository } from '../products/repositories/products.repository';

@Module({
  imports: [ProductsModule],
  providers: [
    FavoritesRepository, 
    FavoritesService,
  ],
  controllers: [FavoritesController],
})
export class FavoritesModule {}